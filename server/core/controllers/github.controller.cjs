const { Octokit } = require("octokit");

const { decrypt } = require("../utils/crypto.cjs");

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const getAllRepos = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized!", success: false });
    }

    const user = req.user;

    const userRecord = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!userRecord) {
      return res
        .status(404)
        .json({ message: "User not found!", success: false });
    }

    if (
      !userRecord.githubAccessToken ||
      !userRecord.githubTokenIV ||
      !userRecord.githubTokenAuthTag
    ) {
      return res
        .status(400)
        .json({ message: "GitHub token not available!", success: false });
    }

    const githubAccessToken = decrypt(
      userRecord.githubAccessToken,
      userRecord.githubTokenIV,
      userRecord.githubTokenAuthTag
    );

    const octokit = new Octokit({
      auth: githubAccessToken,
    });

    const repos = await octokit.rest.repos.listForAuthenticatedUser({
      visibility: "all",
    });


    if (!repos || repos.data.length === 0) {
      return res
        .status(200)
        .json({ message: "No repositories found!", success: true });
    }

    return res.status(200).json({
      repos: repos.data,
      success: true,
      message: "Repositories fetched successfully",
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching repositories!", success: false });
  }
};

const connectRepo = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized!", success: false });
    }

    const user = req.user;

    const { repoName, owner } = req.body;
    
    if (!repoName || !owner) {
      return res
        .status(400)
        .json({ message: "Missing repository information!", success: false });
    }

    const userRecord = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!userRecord) {
      return res
        .status(404)
        .json({ message: "User not found!", success: false });
    }

    const githubAccessToken = decrypt(
      userRecord.githubAccessToken,
      userRecord.githubTokenIV,
      userRecord.githubTokenAuthTag
    );

    const octokit = new Octokit({
      auth: githubAccessToken,
    });

    const repo = await octokit.rest.repos.get({
      owner: owner,
      repo: repoName
    });

    const existingRepo = await prisma.userRepo.findFirst({
      where: {
        userId: userRecord.id,
        repoId: repo.data.id.toString(),
      },
    });

    if (existingRepo) {
      return res.status(409).json({
        message: "Repository already connected!",
        success: false
      });
    }

    await prisma.userRepo.create({
      data: {
        userId: userRecord.id,
        repoId: repo.data.id.toString(),
        name: repo.data.name,
        fullName: repo.data.full_name,
        private: repo.data.private
      },
    });

    return res.status(200).json({
      message: "Repository connected successfully",
      success: true
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error connecting to repository!", success: false });
  }
};

const disconnectRepo = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized!", success: false });
    }

    const user = req.user;

    const { repoId } = req.body;

    if (!repoId) {
      return res
        .status(400)
        .json({ message: "Missing repository information!", success: false });
    }

    const userRecord = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!userRecord) {
      return res
        .status(404)
        .json({ message: "User not found!", success: false });
    }

    const repo = await prisma.userRepo.findFirst({
      where: { repoId: repoId },
    });

    if (!repo) {
      return res
        .status(404)
        .json({ message: "Repository not found!", success: false });
    }

    await prisma.userRepo.deleteMany({
      where: {
        repoId: repoId,
        userId: userRecord.id,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Repository disconnected successfully",
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error disconnecting repository!", success: false });
  }
};

const getConnectedRepos = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized!", success: false });
    }

    const userRecord = await prisma.user.findUnique({
      where: { email: req.user.email },
    });

    if (!userRecord) {
      return res
        .status(404)
        .json({ message: "User not found!", success: false });
    }

    const repos = await prisma.userRepo.findMany({
      where: {
        userId: userRecord.id,
      },
      orderBy: { updatedAt: "desc" },
    });

    return res.status(200).json({
      repos,
      success: true,
      message: "Connected repositories fetched successfully",
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({
        message: "Error fetching connected repositories!",
        success: false,
      });
  }
};

module.exports = {
  getAllRepos,
  connectRepo,
  disconnectRepo,
  getConnectedRepos,
};
