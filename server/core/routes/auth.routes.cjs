const express = require("express");
const passport = require("../middlewares/passport.middleware.cjs");
const {
  oauthCallback,
  logout,
  createNewToken
} = require("../controllers/oauth.controller.cjs");
const {
  requestMagicLink,
  verifyMagicLink,
} = require("../controllers/magic.controller.cjs");

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
// Trigger Github OAuth
router.get(
  "/github",
  passport.authenticate("github", { scope: ["user:email"] })
);

// Github OAuth callback
router.get(
  "/github/callback",
  passport.authenticate("github", { failureRedirect: "/login" }),
  oauthCallback
);

// get new access token
router.post("/refresh", createNewToken);

// Logout
router.get("/logout", logout);

// Request magic link
router.post("/magic/request", requestMagicLink);

// Verify magic link
router.get("/magic/verify", verifyMagicLink);

module.exports = router;
