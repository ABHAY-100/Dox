const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const getLoggedInUser = require("../utils/getLoggedInUser.cjs");
const { encrypt } = require("../utils/crypto.cjs");
const oauthCallback = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Login failed", success: false });
    }

    console.log("OAuth profile:", req.user);
    // If req.user has profile, use it; otherwise use req.user itself
    const userData = req.user;
    console.log("userData:", userData);

    const profile = userData.profile || userData;
    const githubAccessToken = userData.accessToken || null;
    const githubRefreshToken = userData.refreshToken || null;
    const provider = profile.provider; // "google" or "github"
    // Get email safely (Google always has, GitHub may not)
    const email = profile.emails?.[0]?.value || null;

    console.log("GitHub Access Token:", githubAccessToken);

    const encryptedToken = encrypt(githubAccessToken);

    // Find user
    if (email) {
      user = await prisma.user.findUnique({ where: { email } });
    } else if (provider === "github") {
      user = await prisma.user.findUnique({ where: { githubId: profile.id } });
    }

    // Create user if not exists
    if (!user) {
      user = await prisma.user.create({
        data: {
          email, // may be null
          displayName: profile.displayName || null,
          githubName: profile.username || null,
          provider,
          googleId: provider === "google" ? profile.id : null,
          githubId: provider === "github" ? profile.id : null,
          photo: profile.photos?.[0]?.value || null,
          githubAccessToken: encryptedToken.encryptedData || null,
          githubTokenIV: encryptedToken.iv || null,
          githubTokenAuthTag: encryptedToken.authTag || null,
        },
      });
    } else {
      // Update missing IDs if needed
      if (provider === "google" && !user.googleId) {
        user = await prisma.user.update({
          where: { email: email }, // safe: Google always gives email
          data: { googleId: profile.id, provider: "google" },
        });
      } else if (provider === "github" && !user.githubId) {
        const isUserLoggedIn = getLoggedInUser(req);
        if (isUserLoggedIn) {
          // Google user is logged in → connect GitHub
          user = await prisma.user.update({
            where: { id: isUserLoggedIn },
            data: {
              githubId: profile.id,
              githubAccessToken: encryptedToken.encryptedData || null,
              githubTokenIV: encryptedToken.iv || null,
              githubTokenAuthTag: encryptedToken.authTag || null,
              displayName: profile.displayName || null,
              githubName: profile.username || null,
              photo: profile.photos?.[0]?.value || null,
            },
          });
        } else if (email) {
          // No session → find by email
          user = await prisma.user.findUnique({ where: { email } });
          if (user) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                githubId: profile.id,
                githubAccessToken: encryptedToken.encryptedData || null,
                githubTokenIV: encryptedToken.iv || null,
                githubTokenAuthTag: encryptedToken.authTag || null,
              },
            });
          } else {
            // No user → create new
            user = await prisma.user.create({
              data: {
                email,
                displayName: profile.displayName || null,
                githubName: profile.username || null,
                provider: "github",
                githubId: profile.id,
                githubAccessToken: encryptedToken.encryptedData || null,
                githubTokenIV: encryptedToken.iv || null,
                githubTokenAuthTag: encryptedToken.authTag || null,
                photo: profile.photos?.[0]?.value || null,
              },
            });
          }
        } else {
          // fallback if email missing
          user = await prisma.user.findUnique({
            where: { githubId: profile.id },
          });
        }
      }
    }

    // Create refresh token
    const refreshToken = crypto.randomBytes(40).toString("hex");
    const refreshTokenHash = crypto
      .createHmac("sha256", process.env.JWT_SECRET)
      .update(refreshToken)
      .digest("hex");

    // Save refresh token safely
    await prisma.user.update({
      where: email ? { email } : { githubId: profile.id },
      data: {
        refreshToken: refreshTokenHash,
        refreshExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), /////////////////////////////////////////////////////////////////////////////////
      },
    });

    // Create access token
    const accessToken = jwt.sign(
      {
        id: user.id,
        name: user.displayName,
        email: user.email,
        provider: user.provider,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Set cookies
    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 1000,
    });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      user,
      message: "Login successful",
      success: true,
    });
  } catch (err) {
    console.error("OAuth callback error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const logout = (req, res) => {
  res.clearCookie("access_token");
  res.clearCookie("refresh_token");

  req.session.destroy();
  
  return res.json({ message: "Log out successful", success: true });
};

const createNewToken = async (req, res) => {
  const refreshToken = req.cookies.refresh_token;
  if (!refreshToken) {
    return res.status(401).json({ message: "Unauthorized!", success: false });
  }

  const refreshTokenHash = crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(refreshToken)
    .digest("hex");

  const user = await prisma.user.findFirst({
    where: { refreshToken: refreshTokenHash },
  });

  if (!user.refreshExpiry || user.refreshExpiry < new Date()) {
    res.clearCookie("access_token");
    res.clearCookie("refresh_token");

    return res
      .status(401)
      .json({ message: "Refresh token expired!", success: false });
  }

  // Issue new access token
  const accessToken = jwt.sign(
    {
      id: user.id,
      name: user.displayName,
      email: user.email,
      provider: user.provider,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 1000, // 1h
  });

  return res.json({ message: "New access token created!", success: true });
};

module.exports = { oauthCallback, logout, createNewToken };
