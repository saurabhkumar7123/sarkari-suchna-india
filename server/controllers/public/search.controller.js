const searchService = require("../../services/search.service");
const asyncHandler = require("../../utils/asyncHandler");

const search = asyncHandler(async (req, res) => {
  const q = (req.query.q || "").trim();
  if (q.length < 2) {
    return res.json([]);
  }
  const result = await searchService.search(q);
  res.set("Cache-Control", "public, max-age=45");
  res.json(result);
});

const searchSuggest = asyncHandler(async (req, res) => {
  const q = (req.query.q || "").trim();
  if (q.length < 2) {
    return res.json([]);
  }
  const result = await searchService.searchSuggest(q);
  res.set("Cache-Control", "public, max-age=45");
  res.json(result);
});

module.exports = {
  search,
  searchSuggest,
  clearSearchCache: searchService.clearSearchCache
};
