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

function escapeHtmlAttr(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Mark new/changed sections in Combined Preview HTML so admins can verify
 * existing data is preserved and update sections are correctly attached.
 */
function injectCombinedPreviewMarkers(html, sectionDiff, options = {}) {
  let out = String(html || "");
  if (!out) return out;

  const added = new Set(
    (sectionDiff && Array.isArray(sectionDiff.added) ? sectionDiff.added : []).map((t) =>
      String(t).toLowerCase()
    )
  );
  const modified = new Set(
    (sectionDiff && Array.isArray(sectionDiff.modified) ? sectionDiff.modified : []).map((t) =>
      String(t).toLowerCase()
    )
  );

  const banner = `
<style id="combined-preview-markers">
  .combined-preview-banner{margin:12px 16px;padding:12px 14px;border:1px solid #1d4ed8;border-radius:8px;background:#eff6ff;color:#1e3a5f;font-family:system-ui,sans-serif;font-size:14px;line-height:1.45}
  .combined-preview-banner strong{display:block;margin-bottom:4px}
  .combined-preview-legend{margin-top:6px;display:flex;flex-wrap:wrap;gap:8px}
  .combined-preview-pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600}
  .combined-preview-pill--new{background:#dcfce7;color:#166534;border:1px solid #86efac}
  .combined-preview-pill--changed{background:#fef3c7;color:#92400e;border:1px solid #fcd34d}
  .combined-preview-pill--existing{background:#f1f5f9;color:#334155;border:1px solid #cbd5e1}
  .card[data-preview-change="new"]{outline:2px solid #22c55e;outline-offset:2px}
  .card[data-preview-change="changed"]{outline:2px solid #f59e0b;outline-offset:2px}
  .preview-change-badge{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:700;vertical-align:middle}
  .preview-change-badge--new{background:#dcfce7;color:#166534}
  .preview-change-badge--changed{background:#fef3c7;color:#92400e}
</style>
<div class="combined-preview-banner" role="status">
  <strong>Combined Preview — existing published page + pending update</strong>
  This is the final page visitors will see after Manual Publish. Approve does not publish.
  <div class="combined-preview-legend">
    <span class="combined-preview-pill combined-preview-pill--existing">Existing (unchanged)</span>
    <span class="combined-preview-pill combined-preview-pill--changed">Changed</span>
    <span class="combined-preview-pill combined-preview-pill--new">New</span>
  </div>
  ${
    options.slug
      ? `<div style="margin-top:6px;opacity:.85">Canonical slug: /${escapeHtmlAttr(options.slug)}</div>`
      : ""
  }
</div>`;

  if (out.includes("<body")) {
    out = out.replace(/<body([^>]*)>/i, (m) => `${m}${banner}`);
  } else {
    out = banner + out;
  }

  out = out.replace(
    /<div class="card([^"]*)">\s*<div class="card-header([^"]*)">\s*<h2 class="section-title">\s*([^<]+)/gi,
    (full, cardClass, headerClass, titleRaw) => {
      const title = String(titleRaw || "")
        .replace(/\s*<span[\s\S]*$/i, "")
        .replace(/\s+/g, " ")
        .trim();
      const key = title.toLowerCase();
      let change = "";
      let badge = "";
      if (added.has(key)) {
        change = "new";
        badge = `<span class="preview-change-badge preview-change-badge--new">NEW</span>`;
      } else if (modified.has(key)) {
        change = "changed";
        badge = `<span class="preview-change-badge preview-change-badge--changed">CHANGED</span>`;
      }
      if (!change) return full;
      return `<div class="card${cardClass}" data-preview-change="${change}">
        <div class="card-header${headerClass}">
          <h2 class="section-title">
            ${titleRaw.trim()}${badge}`;
    }
  );

  return out;
}

const previewPage = asyncHandler(async (req, res) => {
  const row = req.body || {};
  const title = row.title || "";
  let text = row.text || "";
  let sectionDiff = null;
  let combined = false;

  const existingText =
    row.existingText != null
      ? String(row.existingText)
      : row.existing_page_text != null
        ? String(row.existing_page_text)
        : "";
  const wantCombine =
    row.combinePreview === true ||
    row.combinedPreview === true ||
    (existingText.trim() && row.combinePreview !== false && row.oldSlug);

  if (wantCombine && existingText.trim()) {
    try {
      const {
        resolveCombinedPreviewText,
        diffPublisherSections
      } = require("../../lib/recruitment/preparationPipeline/updateMergeContext");
      text = resolveCombinedPreviewText(existingText, text, {
        mergeAlreadyApplied: row.mergeAlreadyApplied === true
      });
      sectionDiff = diffPublisherSections(existingText, text);
      combined = true;
    } catch (err) {
      logger.warn("combined preview merge skipped", {
        message: err && err.message ? err.message : String(err)
      });
    }
  } else if (row.sectionDiff && typeof row.sectionDiff === "object") {
    sectionDiff = row.sectionDiff;
    combined = Boolean(row.combinedPreview || row.combinePreview);
  }

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

  let html = applyTemplatePlaceholders(template, variables);
  const htmlWithHeader = await injectPreviewHeader(html);
  html = htmlWithHeader;
  if (combined && sectionDiff) {
    html = injectCombinedPreviewMarkers(html, sectionDiff, {
      slug: row.oldSlug || row.canonicalSlug || null
    });
  }
  if (parserWarnings.length) {
    logger.warn("preview parser warnings", {
      count: parserWarnings.length,
      warnings: parserWarnings
    });
    res.set("X-Parser-Warnings-Count", String(parserWarnings.length));
  }
  if (combined) {
    res.set("X-Combined-Preview", "1");
  }
  res.send(html);
});

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
