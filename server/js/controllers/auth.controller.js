import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

export const oauthCallback = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Login failed", success: false });
    }

    // Find existing user in DB
    let user = await prisma.user.findUnique({
      where: { email: req.user.email },
    });

    // If user doesn't exist, create them
    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId: req.user.provider === "google" ? req.user.id : null,
          githubId: req.user.provider === "github" ? req.user.id : null,
          displayName: req.user.displayName,
          email: req.user.email,
          photo: req.user.photo,
          provider: req.user.provider,
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

export const getCurrentUser = async (req, res) => {
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

export const logout = (req, res) => {
  res.clearCookie("token");
  return res.json({ message: "Log out successful", success: true });
};
