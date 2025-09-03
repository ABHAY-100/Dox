require("dotenv").config({ override: true, debug: false });

const express = require("express");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const { PrismaClient } = require("@prisma/client");
const passport = require("passport");
const session = require("express-session");
const cors = require("cors");

const authRouter = require("./routes/auth.routes.cjs");
const githubRouter = require("./routes/github.routes.cjs");
require("./middlewares/passport.middleware.cjs");
const authMiddleware = require("./middlewares/auth.middleware.cjs");

const app = express();
const prisma = new PrismaClient();

// CORS setup
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

// Middlewares
app.use(cookieParser());
app.use(morgan("dev"));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/core", authMiddleware, githubRouter);

app.get("/api/v1", (_, res) => {
  return res.json({ success: true });
});

// Start server
app.listen(process.env.PORT, async () => {
  try {
    await prisma.$connect();
    console.log(`Server running on port ${process.env.PORT}`);
  } catch (err) {
    process.exit(1);
  }
});
