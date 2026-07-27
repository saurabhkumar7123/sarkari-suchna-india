const path = require("path");
const miscService = require("../../services/misc.service");
const asyncHandler = require("../../utils/asyncHandler");
const logger = require("../../utils/logger");
const {
  applyTemplatePlaceholders,
  buildJobTemplateVariables
} = require("../../utils/templatePlaceholders");
const { collectParsingWarnings } = require("../../../generator/builders/sectionBuilder");
const { processJobParse } = require("../../services/aiParseJob.service");
const fileService = require("../../services/file.service");
const previewHeaderTemplatePath = path.join(process.cwd(), "generated", "static", "header.html");

async function injectPreviewHeader(html) {
  const source = String(html || "");
  if (!source.includes('<div id="header"></div>')) return source;
  try {
    const headerHtml = await fileService.readFile(previewHeaderTemplatePath, "utf8");
    const safeHeader = String(headerHtml || "");
    if (!safeHeader) return source;
    return source.replace('<div id="header"></div>', safeHeader);
  } catch (err) {
    logger.warn("preview header injection skipped", {
      message: err && err.message ? err.message : String(err)
    });
    return source;
  }
}

const getSmallBoxes = asyncHandler(async (req, res) => {
  const rows = await miscService.getSmallBoxes();
  res.set("Cache-Control", "public, max-age=30");
  res.json(rows);
});

const getBreakingNews = asyncHandler(async (req, res) => {
  const data = await miscService.getBreakingNews();
  res.set("Cache-Control", "public, max-age=20");
  res.json(data);
});

const getCountdownEvents = asyncHandler(async (req, res) => {
  const data = await miscService.getCountdownEvents();
  res.set("Cache-Control", "public, max-age=15");
  res.json(data);
});

const getTagPage = asyncHandler(async (req, res) => {
  const { isBoardSlug } = require("../../lib/boardHubs");
  const { normalizeTopicSlug } = require("../../lib/topicTags");
  const pageService = require("../../services/page.service");
  const pageRepository = require("../../repositories/page.repository");
  const tag = String(req.params.tag || "").trim().toLowerCase();
  if (isBoardSlug(tag)) {
    const payload = await pageService.listPagesByDepartment({ department: tag, page: 1, limit: 50 });
    res.set("Cache-Control", "public, max-age=60");
    return res.json(payload.data);
  }
  const topicSlug = normalizeTopicSlug(tag);
  const rows = topicSlug
    ? await pageRepository.selectPublicListByTopicSlug(topicSlug, 50, 0)
    : await miscService.getPagesByTag(req.params.tag);
  res.set("Cache-Control", "public, max-age=60");
  res.json(rows);
});

const previewPage = asyncHandler(async (req, res) => {
  const row = req.body;
  const title = row.title || "";
  const text = row.text || "";
  const parserWarnings = collectParsingWarnings(text);

  const template = await fileService.readFile(
    path.join(process.cwd(), "server", "templates", "template.html"),
    "utf8"
  );

  const variables = buildJobTemplateVariables({
    title: title || "Preview",
    text,
    slug: "preview",
    category: row.category || row.tag || "general",
    normalizedStatus: row.status || row.normalizedStatus || "general",
    postName: row.post_name ?? row.postName ?? null,
    totalPosts: row.total_posts ?? row.totalPosts ?? null,
    advertisementNo: row.advertisement_no ?? row.advertisementNo ?? null
  });

  console.log({
    TITLE: variables.TITLE,
    POST_NAME: variables.POST_NAME,
    TAG: variables.TAG,
    TOTAL_POSTS: variables.TOTAL_POSTS,
    SLUG: variables.SLUG,
    ADVERTISEMENT_NO: variables.ADVERTISEMENT_NO
  });

  const html = applyTemplatePlaceholders(template, variables);
  const htmlWithHeader = await injectPreviewHeader(html);
  if (parserWarnings.length) {
    logger.warn("preview parser warnings", {
      count: parserWarnings.length,
      warnings: parserWarnings
    });
    res.set("X-Parser-Warnings-Count", String(parserWarnings.length));
  }
  res.send(htmlWithHeader);
});

function readAiParseInputText(req) {
  const b = req.body || {};
  const keys = ["text", "content", "payloadText", "rawText", "data"];
  for (const k of keys) {
    const v = b[k];
    if (typeof v === "string" && v.trim()) return v;
    if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0];
  }
  return "";
}

/** Strip prompt-template tokens so real PDF text is not replaced by empty */
function normalizeAiParseInput(s) {
  if (typeof s !== "string") return "";
  return s
    .replace(/\{\{TEXT\}\}/gi, "")
    .replace(/\$\{text\}/gi, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

const aiParse = asyncHandler(async (req, res) => {
  const raw = readAiParseInputText(req);
  const input = String(raw || "").trim();
  const normalized = normalizeAiParseInput(input);
  logger.info("ai-parse request", {
    bodyKeys: Object.keys(req.body || {}),
    rawLen: input.length,
    normalizedLen: normalized.length,
    preview: normalized.slice(0, 160)
  });
  if (!normalized || normalized.length < 50) {
    logger.warn("ai-parse rejected: input too short", { normalizedLen: normalized ? normalized.length : 0 });
    return res.json({ result: "Input too short" });
  }
  const parsed = await processJobParse(normalized);
  const result = String(parsed?.result ?? "").trim() || "No usable data found";
  logger.info("ai-parse response", {
    resultLen: result.length,
    hasStructured: Boolean(parsed?.structured),
    overallConfidence: parsed?.meta?.overallConfidence
  });
  const payload = { result };
  // Optional Phase AI-1 quality fields — Generator UI uses `result` only.
  if (parsed?.structured) payload.structured = parsed.structured;
  if (parsed?.validation) payload.validation = parsed.validation;
  if (parsed?.meta) payload.meta = parsed.meta;
  res.json(payload);
});

const getSections = asyncHandler(async (req, res) => {
  const sections = await miscService.getHomepageSections();
  res.set("Cache-Control", "public, max-age=30");
  res.json(sections);
});

const getRelatedPages = asyncHandler(async (req, res) => {
  const rows = await miscService.getRelatedPages(req.params.slug);
  res.set("Cache-Control", "public, max-age=120");
  res.json(rows);
});

const { recordRelatedClick } = require("../../services/relatedAnalytics.service");

const postRelatedClick = asyncHandler(async (req, res) => {
  const from = String(req.body.from || "")
    .trim()
    .replace(/\.html$/i, "");
  const to = String(req.body.to || "")
    .trim()
    .replace(/\.html$/i, "");
  recordRelatedClick({ from, to });
  res.status(204).end();
});

module.exports = {
  getSmallBoxes,
  getBreakingNews,
  getCountdownEvents,
  getTagPage,
  previewPage,
  aiParse,
  getSections,
  getRelatedPages,
  postRelatedClick
};
