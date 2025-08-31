const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GithubStrategy = require("passport-github2").Strategy;
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/v1/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      // Just pass the Google profile forward — no DB logic here
      return done(null, profile);
    }
  )
);
passport.use(
  new GithubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: "/api/v1/auth/github/callback",
      scope: ["user:email", "read:user", "repo", "workflow" , "repo:status"]
    },
    async (accessToken, refreshToken, profile, done) => {
      // Just pass the GitHub profile forward — no DB logic here
      return done(null, { profile, accessToken, refreshToken });
    }
  )
);
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

module.exports = passport;
