const db = require("../../config/db");
const pageRepository = require("../../repositories/page.repository");
const { invalidatePageCaches } = require("../../services/cache.services");
const { writeSitemapFile } = require("../../lib/sitemapGenerator");
const logger = require("../../utils/logger");
const pipeline = require("../../../generator/pipeline/generatePage");
const { collectParsingWarnings } = require("../../../generator/builders/sectionBuilder");

/** Canonical DB values for the predefined dropdown (lowercase). */
const CANONICAL_STATUSES = new Set([
  "new form",
  "admit card",
  "result",
  "answer key",
  "document",
  "admission",
  "syllabus"
]);

const LEGACY_STATUS_ALIASES = {
  new: "new form",
  form: "new form",
  admit: "admit card",
  answer: "answer key"
};

/**
 * Remove zero-width / BOM-style characters (expand if clients send more junk).
 */
function stripInvisible(s) {
  return String(s).replace(/[\u200B-\u200D\uFEFF]/g, "");
}

/** First key in list with a non-nullish value (exact property names). */
function readField(body, keys) {
  if (!body || typeof body !== "object") return null;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(body, k) && body[k] != null) return body[k];
  }
  return null;
}

/** Exact keys first, then case-insensitive key match (proxies / older clients). */
function readBodyFieldWithAliases(body, keys) {
  const direct = readField(body, keys);
  if (direct != null) return direct;
  if (!body || typeof body !== "object") return null;
  const lowerToOrig = new Map(Object.keys(body).map((k) => [String(k).toLowerCase(), k]));
  for (const k of keys) {
    const orig = lowerToOrig.get(String(k).toLowerCase());
    if (orig != null && body[orig] != null) return body[orig];
  }
  return null;
}

/**
 * Canonical status string for DB: invisible chars stripped, NBSP → space,
 * lowercase, trim, internal whitespace collapsed to single space.
 */
function normalizeStatus(input) {
  let s = stripInvisible(String(input ?? ""))
    .replace(/\u00A0/g, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
  if (!s) return "other";

  if (CANONICAL_STATUSES.has(s)) return s;
  if (Object.prototype.hasOwnProperty.call(LEGACY_STATUS_ALIASES, s)) {
    return LEGACY_STATUS_ALIASES[s];
  }

  s = s.slice(0, 64).trim();
  if (!s) return "other";
  return s;
}

/** Empty / whitespace-only → null; otherwise lowercase trimmed string. */
function normalizeOptionalStructuredField(input) {
  if (input == null) return null;
  const normalized = stripInvisible(String(input)).trim().toLowerCase();
  return normalized || null;
}

/**
 * Normalize user/admin input to YYYY-MM-DD for MySQL DATE.
 * Accepts:
 * - DD/MM/YYYY or D/M/YYYY (flexible digit counts, optional spaces)
 * - YYYY-MM-DD
 * Unicode slash variants (e.g. fullwidth) are normalized to /.
 */
function parseLastDateInputToIso(value) {
  let raw = stripInvisible(String(value ?? "")).trim();
  if (!raw) return null;
  raw = raw.replace(/[\u2044\u2215\uff0f／]/g, "/");
  raw = raw.replace(/\./g, "/");
  raw = raw.replace(/\s+/g, "");

  let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
      return null;
    }
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const parts = raw.split("/");
  if (parts.length !== 3) return null;
  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = Number(parts[2]);
  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    year < 1000 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Empty value -> null, valid DD/MM/YYYY -> YYYY-MM-DD, invalid -> null. */
function normalizeOptionalDateField(input) {
  if (input == null) return null;
  const raw = stripInvisible(String(input)).trim();
  if (!raw) return null;
  return parseLastDateInputToIso(raw);
}

function hasNonEmptyLastDateInput(input) {
  return stripInvisible(String(input ?? "")).trim().length > 0;
}

/** Accept canonical keys or legacy structured* aliases from older clients. */
function pickStructuredFieldsFromBody(body) {
  const b = body && typeof body === "object" ? body : {};

  const pickNonEmpty = (primary, fallback) => {
    const p = stripInvisible(String(primary ?? "")).trim();
    if (p) return p;
    const f = stripInvisible(String(fallback ?? "")).trim();
    return f || null;
  };

  const qualification = pickNonEmpty(
    b.qualification ?? b.Qualification,
    b.structuredQualification ?? b.StructuredQualification
  );
  const state = pickNonEmpty(b.state ?? b.State, b.structuredState ?? b.StructuredState);
  const department = pickNonEmpty(
    b.department ?? b.Department,
    b.structuredDepartment ?? b.StructuredDepartment
  );
  return { qualification, state, department };
}

const generatePage = async (req, res) => {
  let conn;

  try {
    if (req.body == null || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid or missing JSON body — use Content-Type: application/json and a JSON object"
      });
    }

    const ct = String(req.headers["content-type"] || "").toLowerCase();
    if (!ct.includes("application/json")) {
      logger.warn("generator unexpected content-type", { contentType: ct || "(empty)" });
    }

    const {
      title,
      status = "new",
      category = "",
      text: bodyText,
      content,
      pageUrl,
      oldSlug
    } = req.body;
    const text = bodyText || content || "";
    const parserWarnings = collectParsingWarnings(text);

    const rawStructured = {
      qualification: req.body?.qualification,
      state: req.body?.state,
      department: req.body?.department,
      structuredQualification: req.body?.structuredQualification,
      structuredState: req.body?.structuredState,
      structuredDepartment: req.body?.structuredDepartment
    };

    const { qualification, state, department } = pickStructuredFieldsFromBody(req.body);

    const postNameRaw = readBodyFieldWithAliases(req.body, ["post_name", "postName", "POST_NAME"]);
    const totalPostsRaw = readBodyFieldWithAliases(req.body, ["total_posts", "totalPosts", "TOTAL_POSTS"]);
    const normalizedPostName = postNameRaw ? String(postNameRaw).trim().slice(0, 512) : "";
    const normalizedTotalPosts = totalPostsRaw ? String(totalPostsRaw).trim().slice(0, 64) : "";
    const normalizedPosition =
      req.body.position && String(req.body.position).trim() !== "" ? String(req.body.position).trim() : "normal";
    logger.warn("POSITION FLOW [controller]", {
      incomingPosition: req.body.position,
      normalizedPosition
    });

    const normalizedStatus = normalizeStatus(status);
    logger.warn("STATUS FLOW [controller]", {
      incomingStatus: req.body && req.body.status,
      normalizedStatus
    });

    const normalizedQualification = normalizeOptionalStructuredField(qualification);
    const normalizedState = normalizeOptionalStructuredField(state);
    const normalizedDepartment = normalizeOptionalStructuredField(department);
    const rawLastDate =
      req.body?.lastDate ?? req.body?.last_date ?? req.body?.LastDate ?? req.body?.LAST_DATE;
    const normalizedLastDate = normalizeOptionalDateField(rawLastDate);
    if (hasNonEmptyLastDateInput(rawLastDate) && !normalizedLastDate) {
      return res.status(400).json({
        status: "error",
        message: "Last Date must be a valid date (DD/MM/YYYY or YYYY-MM-DD)"
      });
    }
    if (hasNonEmptyLastDateInput(rawLastDate) && normalizedLastDate && normalizedStatus !== "new form") {
      return res.status(400).json({
        status: "error",
        message: "Last Date can only be saved when Section is New Form."
      });
    }
    const finalLastDate = normalizedStatus === "new form" ? normalizedLastDate : null;
    logger.info("generator lastDate pipeline", {
      rawLastDate: rawLastDate == null ? null : String(rawLastDate),
      parsedIso: normalizedLastDate,
      normalizedStatus,
      finalLastDate
    });

    logger.info("structured fields pipeline [1 incoming → 2 picked → 3 normalized]", {
      stage1_rawBody: rawStructured,
      stage2_picked: { qualification, state, department },
      stage3_normalized: {
        qualification: normalizedQualification,
        state: normalizedState,
        department: normalizedDepartment,
        post_name: normalizedPostName,
        total_posts: normalizedTotalPosts,
        lastDate: finalLastDate
      },
      stage3_typeof: {
        qualification: typeof normalizedQualification,
        state: typeof normalizedState,
        department: typeof normalizedDepartment
      },
      titleLen: title ? String(title).length : 0,
      textLen: text ? String(text).length : 0,
      hasOldSlug: Boolean(oldSlug)
    });
    if (parserWarnings.length) {
      logger.warn("generator parser warnings", {
        count: parserWarnings.length,
        warnings: parserWarnings
      });
    }

    if (!title || title.length < 5) {
      return res.status(400).json({
        status: "error",
        message: "Invalid title"
      });
    }

    if (!text || text.length < 20) {
      return res.status(400).json({
        status: "error",
        message: "Content too short"
      });
    }
    conn = await db.getConnection();
    await conn.beginTransaction();

    let slug;

    if (oldSlug) {
      const os = String(oldSlug).trim().replace(/^\/+|\.html$/gi, "");
      const existing = await pageRepository.findActiveIdBySlug(os, conn);
      if (!existing) {
        await conn.rollback();
        return res.status(404).json({ status: "error", message: "Page not found" });
      }
      if (req.body.id && String(existing.id) !== String(req.body.id).trim()) {
        await conn.rollback();
        return res.status(400).json({ status: "error", message: "Invalid page id for this slug" });
      }
      slug = os;
    } else {
      const baseSlug = pageUrl
        ? String(pageUrl)
            .trim()
            .replace(/^\/+|\.html$/gi, "")
        : pipeline.createSlug(title);

      slug = await pageRepository.getUniqueSlug(baseSlug, conn);
    }

    let finalHTML;
    try {
      finalHTML = await pipeline.buildJobHtml({
        title,
        text,
        slug,
        category,
        normalizedStatus,
        postName: normalizedPostName,
        totalPosts: normalizedTotalPosts
      });
    } catch {
      await conn.rollback();
      return res.status(500).json({ status: "error", message: "Failed to build page HTML" });
    }

    let savedPageId;

    if (oldSlug) {
      const result = await pageRepository.updatePageBySlug(
        {
          title,
          slug,
          finalHTML,
          text,
          normalizedStatus,
          category,
          qualification: normalizedQualification,
          state: normalizedState,
          department: normalizedDepartment,
          postName: normalizedPostName,
          totalPosts: normalizedTotalPosts,
          lastDate: finalLastDate,
          position: normalizedPosition,
          breaking: req.body.breaking,
          breakingOrder: req.body.breakingOrder || 0,
          eventTime: req.body.eventTime || null
        },
        conn
      );

      if (!result.affectedRows) {
        throw new Error("Page not found for update");
      }
      savedPageId = await pageRepository.selectIdBySlug(slug, conn);
    } else {
      savedPageId = await pageRepository.insertPage(
        {
          title,
          slug,
          finalHTML,
          text,
          normalizedStatus,
          category,
          qualification: normalizedQualification,
          state: normalizedState,
          department: normalizedDepartment,
          postName: normalizedPostName,
          totalPosts: normalizedTotalPosts,
          lastDate: finalLastDate,
          position: normalizedPosition,
          breaking: req.body.breaking,
          breakingOrder: req.body.breakingOrder || 0,
          eventTime: req.body.eventTime || null
        },
        conn
      );
    }

    try {
      await pipeline.writeJobHtmlFile(slug, finalHTML);
    } catch (e) {
      await conn.rollback();
      logger.error("generator: writeJobHtmlFile failed — transaction rolled back (DB row including structured fields not committed)", {
        slug,
        message: e && e.message ? e.message : String(e)
      });
      return res.status(500).json({ status: "error", message: "Failed to write HTML file" });
    }

    await pipeline.removeOldJobFile(oldSlug, slug);

    await conn.commit();
    logger.info("generator: transaction committed", { slug, savedPageId });

    const cacheSlugs = [];
    if (oldSlug) cacheSlugs.push(String(oldSlug).trim().replace(/^\/+|\.html$/gi, ""));
    cacheSlugs.push(slug);
    await invalidatePageCaches(cacheSlugs);

    setImmediate(() => {
      writeSitemapFile(db).catch((e) => logger.warn("sitemap refresh after publish failed", { message: e.message }));
    });

    const url = `/${slug}`;
    return res.json({
      success: true,
      status: "success",
      data: {
        url,
        id: savedPageId,
        warnings: parserWarnings
      },
      url,
      id: savedPageId,
      warnings: parserWarnings
    });
  } catch (err) {
    if (conn) {
      await conn.rollback();
      logger.error("generator: transaction rolled back (no DB commit — any insert/update in this request discarded)", {
        message: err && err.message ? err.message : String(err)
      });
    }

    logger.error("generator route failed", {
      route: "/api/admin/pages",
      status: 500,
      message: err && err.message ? err.message : "Internal Server Error"
    });

    return res.status(500).json({
      status: "error",
      message: "Internal Server Error"
    });
  } finally {
    if (conn) conn.release();
  }
};

module.exports = { generatePage };
