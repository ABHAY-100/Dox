const jwt = require("jsonwebtoken");

function getLoggedInUserId(req) {
  const token = req.cookies.access_token;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.id;
  } catch {
    return null;
  }
}

module.exports = getLoggedInUserId;
