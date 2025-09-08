const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { createClient } = require("redis");
const redis = createClient({ url: process.env.REDIS_URL });
redis.connect().catch(console.error);

// Nodemailer transporter
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

  await transporter.sendMail(mailOptions);
};

// Request Magic Link
const requestMagicLink = async (req, res) => {
  const { displayName ,email } = req.body;
  if (!email || !displayName) return res.status(400).json({ message: "Email and displayName required!", success: false });

  // Rate limit → 1 request per minute
  const rateLimitKey = `magic:rate:${email}`;
  if (await redis.get(rateLimitKey)) {
    return res
      .status(429)
      .json({ message: "Please wait before requesting another magic link!", success: false });
  }
  await redis.set(rateLimitKey, "1", { EX: 60 });

  // Generate one-time token (emailed)
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(token)
    .digest("hex");

  // Upsert user
  let user = await prisma.user.findUnique({ where: { email : email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        displayName,
        provider: "magic",
      },
    });
  }

  // Store token in Redis (10m)
  await redis.set(`magic:${tokenHash}`, JSON.stringify({ email }), {
    EX: 10 * 60,
  });

  // Send email
  const link = `${process.env.FRONTEND_URL}/auth/magic/verify?token=${token}`;
  try {
    await sendMagicLinkEmail(email, link);
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Failed to send magic link!", success: false });
  }

  res.json({
    message: "If the email is registered, a magic link has been sent",
    success: true,
  });
};

// Verify Magic Link
const verifyMagicLink = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ message: "Invalid link!", success: false });

  const tokenHash = crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(token)
    .digest("hex");
  const redisKey = `magic:${tokenHash}`;
  const data = await redis.get(redisKey);

  if (!data)
    return res.status(401).json({ message: "Invalid or expired magic link!", success: false });

  const email = JSON.parse(data).email;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user)
    return res.status(401).json({ message: "Invalid or expired magic link!", success: false });

  // Delete magic link (one-time use)
  await redis.del(redisKey);

  // ---- Create Refresh Token ----
  const rawRefreshToken = crypto.randomBytes(40).toString("hex");
  const refreshTokenHash = crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(rawRefreshToken)
    .digest("hex");

  await prisma.user.update({
    where: { email },
    data: {
      refreshToken: refreshTokenHash,
      refreshExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7d
    },
  });

  // ---- Create Access Token ----
  const accessToken = jwt.sign(
    {
      id: user.id,
      name: user.displayName,
      email: user.email,
      provider: user.provider,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  // Set cookies
  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 1000, // 1h
  });

  res.cookie("refresh_token", rawRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
  });

  res.json({ message: "Login successful", success: true });
};

module.exports = { requestMagicLink, verifyMagicLink };
