const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const getProfile = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized", success: false });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found!", success: false });
    }

    const payload = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      photo: user.photo,
    };

    res.json({ profile: payload, success: true });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error", success: false });
  }
};

const updateProfile = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized", success: false });
  }
  const user = req.user;
  try {
    const { displayName, photo } = req.body;

    const userRecord = await prisma.user.update({
      where: { id: user.id },
      data: { displayName, photo },
    });
    const payload = {
      id: userRecord.id,
      email: userRecord.email,
      displayName: userRecord.displayName,
      photo: userRecord.photo,
    };

    res.status(200).json({ profile: payload, success: true });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error", success: false });
  }
};

module.exports = { getProfile, updateProfile };
