const express = require("express");

const router = express.Router();

const {
  getProfile,
  updateProfile,
} = require("../controllers/profile.controller.cjs");


router.get("/get-profile", getProfile);
router.post("/update-profile", updateProfile);

module.exports = router;
