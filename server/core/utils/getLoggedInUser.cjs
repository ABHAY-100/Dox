function getLoggedInUserId(req) {
  const token = req.cookies.access_token;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded JWT id of the user:", decoded.id);
    return decoded.id;
  } catch {
    return null;
  }
}
module.exports = getLoggedInUserId;