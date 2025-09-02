const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  try {
    // Check if access token exists
    const token = req.cookies.access_token;
    if (!token) {
      return res.status(401).json({ message: "Unauthorized!" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized!" });
  }
};

module.exports = authMiddleware;
