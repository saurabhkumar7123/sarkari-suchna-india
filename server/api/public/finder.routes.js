const express = require("express");
const router = express.Router();

const { getFinderData } = require("../../controllers/public/finder.controller");
const requireDb = require("../../middleware/dbReady.middleware");

router.get("/finder-data", requireDb, getFinderData);
router.get("/finder", requireDb, getFinderData);

module.exports = router;
