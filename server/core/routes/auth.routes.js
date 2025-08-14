const express = require("express");
const passport = require("passport");
const { onAuthCallback, logout } = require("../controllers/auth.controller");

const router = express.Router();

// Trigger Google OAuth login
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google OAuth callback
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  onAuthCallback // <-- call controller after successful login
);

// Logout
router.get("/logout", logout);

module.exports = router;
