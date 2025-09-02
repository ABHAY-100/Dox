const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const getCurrentUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found!", success: false });
    }

    res.json({ user, success: true });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error", success: false });
  }
};

module.exports = { getCurrentUser };
