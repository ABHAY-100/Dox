require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const { PrismaClient } = require("@prisma/client");
const passport = require("./middlewares/passport");
const session = require("express-session");
const authRouter = require("./routes/auth.routes")
const app = express();
const prisma = new PrismaClient();

// Middlewares
app.use(cookieParser());
app.use(morgan("dev"));
app.use(express.json());
app.use(session({
  secret : process.env.SESSION_SECRET,
  resave : false,
  saveUninitialized: false,
}))
app.use(passport.initialize())
app.use(passport.session())

app.use("/auth" , authRouter)

// Test route
app.get("/", async (req, res) => {
  res.send("Hello World!");
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
