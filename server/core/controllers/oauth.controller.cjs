const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const jwt = require("jsonwebtoken");

const oauthCallback = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Login failed", success: false });
    }
    const profile = req.user;
    //find user in db
    let user = await prisma.user.findUnique({
      where: { email: profile.emails[0].value },
    });

    // If user doesn't exist, create them
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: profile.emails?.[0]?.value || null,
          displayName: profile.displayName,
          provider: "google",
          googleId: profile.id,
          githubId: "",
          photo: profile.photos?.[0]?.value || null,
        },
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        name: user.displayName,
        email: user.email,
        provider: user.provider,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 1000 * 3,
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

const getCurrentUser = async (req, res) => {
  try {
    //uses user id
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found", success: false });
    }

    res.json({ user, success: true });
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ message: "Internal server error", success: false });
  }
};

const logout = (req, res) => {
  res.clearCookie("token");
  return res.json({ message: "Log out successful", success: true });
};

module.exports = { oauthCallback, logout };
