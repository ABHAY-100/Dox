const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const oauthCallback = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Login failed", success: false });
    }

    const profile = req.user; // from passport-google/github
    const provider = profile.provider; // "google" or "github"
    let user = null;

    // Get email safely (Google always has, GitHub may not)
    const email = profile.emails?.[0]?.value || null;

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
          displayName: profile.displayName || profile.username,
          provider,
          googleId: provider === "google" ? profile.id : null,
          githubId: provider === "github" ? profile.id : null,
          photo: profile.photos?.[0]?.value || null,
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
        user = await prisma.user.update({
          where: email ? { email } : { githubId: profile.id }, // fallback if email missing
          data: { githubId: profile.id, provider: "github" },
        });
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
        refreshExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
  return res.json({ message: "Log out successful", success: true });
};
const createNewToken = async (req, res) => {
  const refreshToken = req.cookies.refresh_token;
  console.log("refreshToken from cookie:", refreshToken);

  if (!refreshToken) {
    return res.status(401).json({ message: "Unauthorized", success: false });
  }

  const refreshTokenHash = crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(refreshToken)
    .digest("hex");

    console.log("hashed refreshToken:", refreshTokenHash);

  const user = await prisma.user.findFirst({
    where: { refreshToken: refreshTokenHash },
  });
  console.log("user from DB:", user);

  if ( !user.refreshExpiry || user.refreshExpiry < new Date()) {
    console.log("here");
    return res
      .status(401)
      .json({ message: "Refresh token expired", success: false });
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

  return res.json({ message: "New access token created", success: true });
};

module.exports = { oauthCallback, logout, createNewToken };
