const express = require("express");
const passport = require("../middlewares/passport.cjs");
const { oauthCallback, logout } = require("../controllers/auth.controller.cjs");

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
  oauthCallback
);

// Logout
router.get("/logout", logout);

module.exports = router;
