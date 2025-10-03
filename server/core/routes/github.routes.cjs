const express = require("express");
const { getAllRepos, connectRepo, disconnectRepo, getConnectedRepos, getDocsIndex, getDocFile } = require("../controllers/github.controller.cjs");
const router = express.Router();

router.get("/repos", getAllRepos);
router.post("/connect-repo", connectRepo);
router.post("/disconnect-repo", disconnectRepo);
router.get("/connected-repos", getConnectedRepos);
router.get("/:owner/:repo/docs", getDocsIndex);
router.get("/:owner/:repo/docs/:filename", getDocFile);

module.exports = router;
