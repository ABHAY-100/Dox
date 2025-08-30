const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { createClient } = require("redis");
const redis = createClient({ url: process.env.REDIS_URL });
redis.connect().catch(console.error);

// Configure transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendMagicLinkEmail = async (email, link) => {
  const mailOptions = {
    from: `"zero-day" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Your secure login link for Dox",
    html: `
    <p>Hello,</p>
    <p>Click the link below to securely log in to your <strong>Dox</strong> account:</p>
    <p><a href="${link}">Log in to Dox</a></p>
    <p>This link will expire in <strong>10 minutes</strong>.</p>
    <p>If you didn’t request this, you can safely ignore this email.</p>
    <strong><i>the zero-day team</i></strong>
  `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error("Error sending magic link email:", err);
    throw new Error("Failed to send magic link");
  }
};

// Request magic link
const requestMagicLink = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required!" });

  // Email format and length validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    !emailRegex.test(email)
  ) {
    return res.status(400).json({ message: "Invalid email format!" });
  }

  // allow only 1 request per minute per email
  const rateLimitKey = `magic:rate:${email}`;
  const recentlyRequested = await redis.get(rateLimitKey);
  if (recentlyRequested) {
    return res.status(429).json({ message: "Please wait before requesting another magic link." });
  }
  await redis.set(rateLimitKey, "1", { EX: 60 });

  // Generate token
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHmac("sha256", process.env.JWT_SECRET)
    .update(token)
    .digest("hex");
  const expiresIn = 10 * 60; // 10 minutes

  // Find or create user in DB
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        provider: "magic",
      },
    });
  }

  // Store token in Redis with expiry
  await redis.set(
    `magic:${tokenHash}`,
    JSON.stringify({ email }),
    { EX: expiresIn }
  );

  // Send email
  const link = `${process.env.FRONTEND_URL}/auth/magic/verify?token=${token}`;
  try {
    await sendMagicLinkEmail(email, link);
  } catch (err) {
    return res.status(500).json({ message: "Failed to send magic link", success: false });
  }

  res.json({ message: "If the email is registered, a magic link has been sent", success: true });
};

const verifyMagicLink = async (req, res) => {
  const { token } = req.query;
  if (!token)
    return res.status(400).json({ message: "Invalid link!" });

  // Recompute token hash
  const tokenHash = crypto.createHmac("sha256", process.env.JWT_SECRET)
    .update(token)
    .digest("hex");
  const redisKey = `magic:${tokenHash}`;

  const data = await redis.get(redisKey);
  if (!data) {
    return res.status(401).json({ message: "Invalid or expired magic link!" });
  }

  // Parse email from Redis
  const email = JSON.parse(data).email;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ message: "Invalid or expired magic link!" });
  }

  // Delete token from Redis
  await redis.del(redisKey);

  // Issue JWT
  const jwtToken = jwt.sign(
    {
      id: user.id,
      name: user.displayName,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "6h" }
  );

  res.cookie("token", jwtToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 1000 * 6,
  });

  res.json({ user, message: "Login successful", success: true });
};

module.exports = { requestMagicLink, verifyMagicLink };
