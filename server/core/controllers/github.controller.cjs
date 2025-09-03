const { Octokit } = require("octokit");

const { decrypt } = require("../utils/crypto.cjs");

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const getAllRepos = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized", success: false });
    }

    const user = req.user;
    const userRecord = await prisma.user.findUnique({
      where: { email: user.email },
    });
    if (!userRecord) {
      return res
        .status(404)
        .json({ message: "User not found", success: false });
    }

    if (
      !userRecord.githubAccessToken ||
      !userRecord.githubTokenIV ||
      !userRecord.githubTokenAuthTag
    ) {
      return res
        .status(400)
        .json({ message: "GitHub token not available", success: false });
    }

    const githubAccessToken = decrypt(
      userRecord.githubAccessToken,
      userRecord.githubTokenIV,
      userRecord.githubTokenAuthTag
    );

    const octokit = new Octokit({
      auth: githubAccessToken,
    });

    const repos = await octokit.rest.repos.listForAuthenticatedUser();
    if (!repos || repos.length === 0) {
      return res
        .status(200)
        .json({ message: "No repositories found", success: true });
    }

    return res.status(200).json({
      repos: repos.data,
      success: true,
      message: "Repositories fetched successfully",
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching repositories", success: false });
  }
};

const connectRepo = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized", success: false });
    }
    const user = req.user;

    // Get the repository information from the request body
    const { repoName, owner } = req.body;
    if (!repoName || !owner) {
      return res
        .status(400)
        .json({ message: "Missing repository information", success: false });
    }

    // Find the user
    const userRecord = await prisma.user.findUnique({
      where: { email: user.email },
    });
    if (!userRecord) {
      return res
        .status(404)
        .json({ message: "User not found", success: false });
    }

    // Decrypt the GitHub access token
    const githubAccessToken = decrypt(
      userRecord.githubAccessToken,
      userRecord.githubTokenIV,
      userRecord.githubTokenAuthTag
    );

    const octokit = new Octokit({
      auth: githubAccessToken,
    });

    // Get the repository information using octokit
    const repo = await octokit.rest.repos.get({
      owner: owner,
      repo: repoName,
    });

    // Check if repo is already connected
    const existingRepo = await prisma.userRepo.findFirst({
      where: {
        userId: userRecord.id,
        repoId: repo.data.id.toString(),
        connected: true,
      },
    });

    if (existingRepo) {
      return res.status(409).json({
        message: "Repository already connected",
        success: false,
        repo: existingRepo,
      });
    }

    // Save the repository information to the database
    const savedRepo = await prisma.userRepo.create({
      data: {
        userId: userRecord.id,
        repoId: repo.data.id.toString(), // GitHub repo ID
        name: repo.data.name, // Repo name
        fullName: repo.data.full_name, // owner/repo
        private: repo.data.private,
        connected: true, // set true since connected
      },
    });

    return res.status(200).json({
      repo: savedRepo,
      success: true,
      message: "Repository connected successfully",
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error connecting to repository", success: false });
  }
};

const disconnectRepo = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized", success: false });
    }
    const user = req.user;

    // Get the repository information from the request body
    const { repoId } = req.body;
    if (!repoId) {
      return res
        .status(400)
        .json({ message: "Missing repository information", success: false });
    }

    // Find the user
    const userRecord = await prisma.user.findUnique({
      where: { email: user.email },
    });
    if (!userRecord) {
      return res
        .status(404)
        .json({ message: "User not found", success: false });
    }

    // Find the repository
    const repo = await prisma.userRepo.findFirst({
      where: { repoId: repoId },
    });
    if (!repo) {
      return res
        .status(404)
        .json({ message: "Repository not found", success: false });
    }

    // Disconnect the repository
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
      .json({ message: "Error disconnecting repository", success: false });
  }
};

const getConnectedRepos = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized", success: false });
    }

    // Find the user
    const userRecord = await prisma.user.findUnique({
      where: { email: req.user.email },
    });
    if (!userRecord) {
      return res
        .status(404)
        .json({ message: "User not found", success: false });
    }

    // Fetch all connected repos for the user
    const repos = await prisma.userRepo.findMany({
      where: {
        userId: userRecord.id,
        connected: true,
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
      .json({ message: "Error fetching connected repositories", success: false });
  }
};

module.exports = {
  getAllRepos,
  connectRepo,
  disconnectRepo,
  getConnectedRepos
};
