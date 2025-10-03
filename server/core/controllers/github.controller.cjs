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

    const { repoName, owner, branch } = req.body;
    
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
        owner: repo.data.owner.login,
        branch: branch && typeof branch === "string" && branch.trim().length > 0
          ? branch.trim()
          : (repo.data.default_branch || "main"),
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
  getDocsIndex: async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized!", success: false });
      }

      const { owner, repo } = req.params;

      const userRecord = await prisma.user.findUnique({
        where: { email: req.user.email },
      });

      if (!userRecord) {
        return res.status(404).json({ message: "User not found!", success: false });
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

      const connected = await prisma.userRepo.findFirst({
        where: { userId: userRecord.id, owner: owner, repoName: repo },
      });

      if (!connected) {
        return res.status(403).json({ message: "Repository not connected!", success: false });
      }

      const githubAccessToken = decrypt(
        userRecord.githubAccessToken,
        userRecord.githubTokenIV,
        userRecord.githubTokenAuthTag
      );

      const octokit = new Octokit({ auth: githubAccessToken });

      try {
        const ref = connected && connected.branch ? connected.branch : undefined;
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: "docs",
          ref,
        });

        if (!Array.isArray(data)) {
          return res.status(404).json({ success: false, message: "docs is not a directory" });
        }

        const files = data
          .filter(
            (item) =>
              item &&
              item.type === "file" &&
              (item.name.endsWith(".mdx") || item.name.endsWith(".mdc"))
          )
          .map((item) => ({
            name: item.name,
            path: item.path,
            sha: item.sha,
            size: item.size,
            html_url: item.html_url,
          }));

        return res.status(200).json({
          success: true,
          owner,
          repo,
          count: files.length,
          files,
        });
      } catch (err) {
        if (err && err.status === 404) {
          return res.status(404).json({ success: false, message: "docs folder not found" });
        }
        console.error("Error fetching docs index:", err);
        return res.status(502).json({ success: false, message: "Failed to fetch docs index" });
      }
    } catch (error) {
      console.error("Error in getDocsIndex:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
  getDocFile: async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized!", success: false });
      }

      const { owner, repo, filename } = req.params;

      if (!filename || filename.includes("/")) {
        return res.status(400).json({ success: false, message: "Invalid filename" });
      }

      const userRecord = await prisma.user.findUnique({
        where: { email: req.user.email },
      });

      if (!userRecord) {
        return res.status(404).json({ message: "User not found!", success: false });
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

      const connected = await prisma.userRepo.findFirst({
        where: { userId: userRecord.id, owner: owner, repoName: repo },
      });

      if (!connected) {
        return res.status(403).json({ message: "Repository not connected!", success: false });
      }

      const githubAccessToken = decrypt(
        userRecord.githubAccessToken,
        userRecord.githubTokenIV,
        userRecord.githubTokenAuthTag
      );

      const octokit = new Octokit({ auth: githubAccessToken });

      let meta;
      try {
        const ref = connected && connected.branch ? connected.branch : undefined;
        const metaResp = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: `docs/${filename}`,
          ref,
        });
        meta = metaResp.data;
      } catch (err) {
        if (err && err.status === 404) {
          return res.status(404).json({ success: false, message: "File not found" });
        }
        console.error("Error fetching file metadata:", err);
        return res.status(502).json({ success: false, message: "Failed to fetch file metadata" });
      }

      if (!meta || meta.type !== "file") {
        return res.status(404).json({ success: false, message: "File not found" });
      }

      // Size cap of 2MB
      const MAX_BYTES = 2 * 1024 * 1024;
      if (typeof meta.size === "number" && meta.size > MAX_BYTES) {
        return res.status(413).json({ success: false, message: "File too large" });
      }

      const etag = meta.sha;
      const ifNoneMatch = req.headers["if-none-match"];
      if (ifNoneMatch && etag && ifNoneMatch === etag) {
        return res.status(304).end();
      }

      try {
        const ref = connected && connected.branch ? connected.branch : undefined;
        const response = await octokit.request(
          "GET /repos/{owner}/{repo}/contents/{path}",
          {
            owner,
            repo,
            path: `docs/${filename}`,
            ref,
            mediaType: { format: "raw" },
          }
        );

        res.setHeader("Content-Type", "text/markdown; charset=utf-8");
        if (etag) res.setHeader("ETag", etag);
        res.setHeader("Cache-Control", "no-cache");

        return res.status(200).send(response.data);
      } catch (err) {
        if (err && err.status === 304) {
          return res.status(304).end();
        }
        if (err && err.status === 404) {
          return res.status(404).json({ success: false, message: "File not found" });
        }
        console.error("Error fetching raw file:", err);
        return res.status(502).json({ success: false, message: "Failed to fetch file content" });
      }
    } catch (error) {
      console.error("Error in getDocFile:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
};
