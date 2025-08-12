require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();

// Middlewares
app.use(cookieParser());
app.use(morgan("dev"));
app.use(express.json());

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
