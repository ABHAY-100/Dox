require("dotenv").config();

const express = require("express");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const { PrismaClient } = require("@prisma/client");
const passport = require("passport");
const session = require("express-session");

const authRouter = require("./routes/auth.routes.cjs");
require("./middlewares/passport.middleware.cjs");

const app = express();
const prisma = new PrismaClient();

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

// Auth route
app.use("/api/v1/auth", authRouter);

// Ping route
app.get("/api/v1/", async (_, res) => {
  res.send("Dox is Alive!");
});

// Start server
app.listen(process.env.PORT, async () => {
  try {
    // Test Prisma connection
    await prisma.$connect();
    console.log("Prisma connected to MongoDB");
    console.log(`Server running on port ${process.env.PORT}`);
  } catch (err) {
    console.error("Prisma connection error:", err);
    process.exit(1);
  }
});
