const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const getLoggedInUser = require("../utils/getLoggedInUser.cjs");
const { encrypt } = require("../utils/crypto.cjs");

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const oauthCallback = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Login failed!", success: false });
    }

    const userData = req.user;
    const profile = userData.profile || userData;
    const provider = profile.provider;
    const email = profile.emails?.[0]?.value || null;
    const providerId = profile.id;

    // Encrypt GitHub access token if available
    const githubAccessToken = userData.accessToken || null;
    const encryptedToken = githubAccessToken
      ? encrypt(githubAccessToken)
      : null;

    // Check if user is already logged in
    const loggedInUserId = getLoggedInUser(req);

    let user = null;

    // Strategy 1: Find existing user by email or provider ID
    if (email || provider === "github") {
      const whereClause = email ? { email } : { githubId: providerId };

      user = await prisma.user.findUnique({ where: whereClause });
    }

    if (user) {
      // User exists - update with new provider info if needed
      const updateData = {};

      if (provider === "google" && !user.googleId) {
        updateData.googleId = providerId;
        if (!user.provider || user.provider !== "google") {
          updateData.provider = "google";
        }
      } else if (provider === "github") {
        // Always update GitHub info when available
        updateData.githubId = providerId;
        updateData.displayName = profile.displayName || user.displayName;
        updateData.githubName = profile.username || user.githubName;

        if (encryptedToken) {
          updateData.githubAccessToken = encryptedToken.encryptedData;
          updateData.githubTokenIV = encryptedToken.iv;
          updateData.githubTokenAuthTag = encryptedToken.authTag;
        }

        if (!user.provider || user.provider !== "github") {
          updateData.provider = "github";
        }
      }

      // Update photo if not present
      if (!user.photo && profile.photos?.[0]?.value) {
        updateData.photo = profile.photos[0].value;
      }

      // Only update if there are changes
      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }
    } else if (loggedInUserId) {
      // Strategy 2: User is logged in but connecting a new provider
      try {
        const updateData = {};

        if (provider === "google") {
          updateData.googleId = providerId;
          if (email && !user?.email) {
            updateData.email = email;
          }
          // Update provider if user was created via magic link
          const existingUser = await prisma.user.findUnique({
            where: { id: loggedInUserId },
            select: { provider: true },
          });
          if (existingUser?.provider === "magic") {
            updateData.provider = "google";
          }
        } else if (provider === "github") {
          updateData.githubId = providerId;
          updateData.displayName = profile.displayName;
          updateData.githubName = profile.username;

          if (encryptedToken) {
            updateData.githubAccessToken = encryptedToken.encryptedData;
            updateData.githubTokenIV = encryptedToken.iv;
            updateData.githubTokenAuthTag = encryptedToken.authTag;
          }

          // Update email if GitHub provides one and user doesn't have one
          if (email) {
            const existingUser = await prisma.user.findUnique({
              where: { id: loggedInUserId },
              select: { email: true, provider: true },
            });

            if (!existingUser.email) {
              updateData.email = email;
            }

            // Update provider if user was created via magic link
            if (existingUser?.provider === "magic") {
              updateData.provider = "github";
            }
          }
        }

        // Update photo if not present
        if (profile.photos?.[0]?.value) {
          const existingUser = await prisma.user.findUnique({
            where: { id: loggedInUserId },
            select: { photo: true },
          });

          if (!existingUser.photo) {
            updateData.photo = profile.photos[0].value;
          }
        }

        user = await prisma.user.update({
          where: { id: loggedInUserId },
          data: updateData,
        });

        // user connected to github - function ends here (No token regeneration needed)
        return res.status(200).json({
          message: "GitHub connected successfully",
          success: true,
        });
      } catch (updateError) {
        // If update fails (e.g., email conflict), fall through to create new user
        console.warn("Failed to update existing user:", updateError.message);
        user = null;
      }
    }

    // Strategy 3: Create new user
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          displayName: profile.displayName || null,
          githubName: profile.username || null,
          provider,
          googleId: provider === "google" ? providerId : null,
          githubId: provider === "github" ? providerId : null,
          photo: profile.photos?.[0]?.value || null,
          githubAccessToken: encryptedToken?.encryptedData || null,
          githubTokenIV: encryptedToken?.iv || null,
          githubTokenAuthTag: encryptedToken?.authTag || null,
        },
      });
    }

    if (!user) {
      return res.status(500).json({
        message: "Failed to create or find user",
        success: false,
      });
    }

    // Generate tokens
    const refreshToken = crypto.randomBytes(40).toString("hex");
    const refreshTokenHash = crypto
      .createHmac("sha256", process.env.JWT_SECRET)
      .update(refreshToken)
      .digest("hex");

    // Update user with refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: refreshTokenHash,
        refreshExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Create access token
    const accessToken = jwt.sign(
      {
        id: user.id,
        name: user.displayName,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Set cookies
    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 1000, // 1h
    });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.redirect("http://localhost:3000/dashboard");
  } catch (err) {
    console.error("OAuth callback error:", err);
    return res.status(500).json({
      message: "Internal Server Error",
      success: false,
    });
  }
};

const logout = (req, res) => {
  res.clearCookie("access_token");
  res.clearCookie("refresh_token");

  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destroy error:", err);
      }
    });
  }

  return res.json({ message: "Log out successful", success: true });
};

const createNewToken = async (req, res) => {
  try {
    const oldAccessToken = req.cookies.access_token;
    const refreshToken = req.cookies.refresh_token;
   
    if (!refreshToken || !oldAccessToken) {
      return res.status(401).json({ message: "Unauthorized!", success: false });
    }

    // decode access token and get user id
    let decodedToken = null;
    try {
      decodedToken = jwt.verify(oldAccessToken, process.env.JWT_SECRET, {
        ignoreExpiration: true,
      });
    } catch (jwtError) {
      res.clearCookie("access_token");
      res.clearCookie("refresh_token");
      return res
        .status(401)
        .json({ message: "Invalid access token!", success: false });
    }
    //hash the token
    const refreshTokenHash = crypto
      .createHmac("sha256", process.env.JWT_SECRET)
      .update(refreshToken)
      .digest("hex");

    //fetch user from db using id
    const user = await prisma.user.findUnique({
      where: { id: decodedToken.id },
    });
    //check if user exists or tokens are valid
    if (
      !user ||
      user.refreshToken !== refreshTokenHash ||
      user.refreshExpiry <= new Date()
    ) {
      // Clear invalid cookies
      res.clearCookie("access_token");
      res.clearCookie("refresh_token");

      return res
        .status(401)
        .json({ message: "Invalid or expired refresh token!", success: false });
    }

    // Generate NEW refresh token (rotation)
    const newRefreshToken = crypto.randomBytes(40).toString("hex");
    const newRefreshTokenHash = crypto
      .createHmac("sha256", process.env.JWT_SECRET)
      .update(newRefreshToken)
      .digest("hex");

    // Update user with NEW refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: newRefreshTokenHash,
        refreshExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });


    // Issue new access token
    const accessToken = jwt.sign(
      {
        id: user.id,
        name: user.displayName,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Set BOTH new tokens as cookies
    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 1000, // 1h
    });

    res.cookie("refresh_token", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.json({ message: "New tokens created!", success: true });
  } catch (err) {
    console.error("Token refresh error:", err);

    // Clear cookies on error
    res.clearCookie("access_token");
    res.clearCookie("refresh_token");

    return res.status(500).json({
      message: "Internal server error",
      success: false,
    });
  }
};
module.exports = { oauthCallback, logout, createNewToken };
