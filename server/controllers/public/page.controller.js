const pageService = require("../../services/page.service");
const asyncHandler = require("../../utils/asyncHandler");
const logger = require("../../utils/logger");

function parseIncludeRawTextFlag(query) {
  const v = query && query.includeRawText != null ? String(query.includeRawText).trim().toLowerCase() : "";
  return v === "1" || v === "true" || v === "yes";
}

const listPages = asyncHandler(async (req, res) => {
  let { status, section, type, department, page, limit } = req.query;
  if (!section && type) {
    const t = String(type).toLowerCase().trim();
    if (t === "new" || t === "new-form") section = "new-form";
    else if (["result", "admit-card", "answer-key", "syllabus", "document", "admission"].includes(t)) {
      section = t;
    }
  }
  const includeRawText = parseIncludeRawTextFlag(req.query);
  const payload = department
    ? await pageService.listPagesByDepartment({ department, page, limit, includeRawText })
    : await pageService.listPages({ status, section, page, limit, includeRawText });
  res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
  res.json(payload);
});

const listJobs = asyncHandler(async (req, res) => {
  const { qualification, state, department, jobType, status, page, limit, source } = req.query;
  logger.info("Jobs API request payload", {
    selectedValues: { qualification, state, department },
    payload: { qualification, state, department, jobType, status, page, limit, source },
    fieldNamesChecked: ["qualification", "state", "department", "jobType", "status", "page", "limit", "source"]
  });
  const data = await pageService.listJobs({ qualification, state, department, jobType, status, page, limit, source });
  res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
  res.json(data);
});

const getJobById = asyncHandler(async (req, res) => {
  const data = await pageService.getJobById(req.params.id);
  if (!data) {
    return res.status(404).json({ success: false, message: "Job not found" });
  }
  res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
  res.json(data);
});

const getPageBySlug = asyncHandler(async (req, res) => {
  const slug = req.params.slug.replace(/\.html$/i, "");
  const data = await pageService.getPublicPageBySlug(slug);
  if (!data) {
    return res.status(404).json({ success: false, message: "Page not found" });
  }
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
  res.json({ success: true, data });
});

const getTopViews = asyncHandler(async (req, res) => {
  const data = await pageService.getTopViews();
  res.set("Cache-Control", "public, max-age=45");
  res.json({ success: true, data });
});

const getActivityLog = asyncHandler(async (req, res) => {
  const data = await pageService.getActivityLogSlice();
  res.json({ success: true, data });
});

module.exports = {
  listJobs,
  getJobById,
  listPages,
  getPageBySlug,
  getTopViews,
  getActivityLog
};
