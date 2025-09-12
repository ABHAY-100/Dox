let Octokit;

(async () => {
  const { Octokit: OctokitModule } = await import("octokit");
  Octokit = OctokitModule;
})();

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

    const { data: allRepos } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: 'updated',
      direction: 'desc',
      per_page: 100
    });

    if (!allRepos || allRepos.length === 0) {
      return res.status(200).json({ 
        repos: [], 
        success: true,
        message: "No repositories found!" 
      });
    }

    return res.status(200).json({
      repos: allRepos,
      success: true,
      message: "All accessible repositories fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching repositories:", error);
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

    const savedRepo = await prisma.userRepo.create({
      data: {
        userId: userRecord.id,
        repoId: repo.data.id.toString(),
        repoName: repo.data.name,
        owner: repo.data.owner.login
      },
    });

    return res.status(200).json({
      repo: savedRepo,
      success: true,
      message: "Repository connected successfully",
    });
  } catch (error) {
    console.error("Error connecting repository:", error);
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
    console.error("Error disconnecting repository: ", error);
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
      }
    });

    return res.status(200).json({
      repos,
      success: true,
      message: "Connected repositories fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching connected repositories: ", error);
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
