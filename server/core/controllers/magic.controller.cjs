const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { createClient } = require("redis");
const redis = createClient({ url: process.env.REDIS_URL });

redis.connect().catch(console.error);

// Configure transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: process.env.GMAIL_USER,
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
    accessToken: process.env.GMAIL_ACCESS_TOKEN,
  },
});

const sendMagicLinkEmail = async (email, link) => {
  const mailOptions = {
    from: `"zero-day" <${process.env.GMAIL_USER}>`,
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
  }
};

// Request magic link
const requestMagicLink = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required!" });

  // Generate token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresIn = 10 * 60; // 10 min

  // Find or create user in DB
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        provider: "magic",
        displayName: "",
        githubId: "",
        googleId: "",
        photo: "",
      },
    });
  }

  // Store token in Redis with expiry
  await redis.set(`magic:${email}:${token}`, "valid", { EX: expiresIn });

  // Send email
  const link = `${
    process.env.FRONTEND_URL
  }/auth/magic/verify?token=${token}&email=${encodeURIComponent(email)}`;
  await sendMagicLinkEmail(email, link);

  res.json({ message: "Magic link sent", success: true });
};

const verifyMagicLink = async (req, res) => {
  const { token, email } = req.query;
  if (!token || !email)
    return res.status(400).json({ message: "Invalid link!" });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ message: "Invalid or expired magic link!" });
  }

  // Check token in Redis
  const redisKey = `magic:${email}:${token}`;
  const valid = await redis.get(redisKey);
  if (!valid) {
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
      provider: user.provider,
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
