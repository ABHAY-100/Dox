const express = require("express");
const { getAllRepos, connectRepo, disconnectRepo, getConnectedRepos } = require("../controllers/github.controller.cjs");
const router = express.Router();

router.get("/repos", getAllRepos);
router.post("/connect-repo", connectRepo);
router.post("/disconnect-repo", disconnectRepo);
router.get("/connected-repos", getConnectedRepos);

module.exports = router;
