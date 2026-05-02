const express = require("express");
const router = express.Router();

const searchController = require("../../controllers/public/search.controller");
const validate = require("../../middleware/validate.middleware");
const requireDb = require("../../middleware/dbReady.middleware");
const { searchQuerySchema } = require("../../validations/public.validation");

router.get(
  "/search",
  requireDb,
  validate(searchQuerySchema, "query"),
  searchController.search
);

router.get(
  "/search-suggest",
  requireDb,
  validate(searchQuerySchema, "query"),
  searchController.searchSuggest
);

module.exports = router;
