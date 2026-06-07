const path = require("path");
const pageRepository = require("../repositories/page.repository");
const { getCache, setCache } = require("./cache.services");
const fileService = require("./file.service");

const LIST_TTL_SEC = parseInt(process.env.CACHE_PAGES_LIST_TTL || "60", 10);
const PAGE_TTL_SEC = parseInt(process.env.CACHE_PAGE_DETAIL_TTL || "120", 10);

/**
 * mysql2 returns JSON columns either as parsed arrays/objects or as raw
 * strings depending on driver flags / column type. Treat any malformed
 * value as "no badges" so a single bad row never breaks a list response.
 * Always returns a plain string[] of uppercase codes.
 */
function parseBadges(value) {
  if (value == null || value === "") return [];
  let arr = value;
  if (typeof value === "string") {
    try {
      arr = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const item of arr) {
    const code = String(item || "").trim().toUpperCase();
    if (code) out.push(code);
  }
  return out;
}

/**
 * @param {{ status?: string, section?: string, page: number, limit: number, includeRawText?: boolean, freshnessSort?: boolean }} opts
 */
async function listPages({ status, section, page, limit, includeRawText = false, freshnessSort = false }) {
  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (page - 1) * limit;

  const cacheTier = includeRawText ? "full" : "lite";
  const cacheKey = `pages:list:${section || status || "all"}:${page}:${limit}:${cacheTier}${freshnessSort ? ":fresh" : ""}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // miss
    }
  }

  const total = await pageRepository.countPublicList(section, status);
  const totalPages = total === 0 ? 0 : Math.max(1, Math.ceil(total / limit));

  const rows = await pageRepository.selectPublicListPage(
    section,
    status,
    limit,
    offset,
    undefined,
    includeRawText,
    freshnessSort
  );

  const data = rows.map((p) => {
    const row = {
      title: p.title,
      slug: p.slug,
      url: "/" + p.slug,
      status: (p.status || "").toLowerCase(),
      badges: parseBadges(p.badges),
      category: p.category,
      date: p.created_at || null,
      lastDate: normalizeLastDate(pickLastDateColumn(p)),
      breaking: p.breaking,
      position: p.position,
      eventTime: p.event_time
    };
    if (includeRawText) {
      row.rawText = p.raw_text;
    }
    return row;
  });

  const payload = {
    success: true,
    data,
    pagination: { total, totalPages, currentPage: page, limit }
  };

  await setCache(cacheKey, payload, LIST_TTL_SEC);
  return payload;
}

/**
 * Board hub listing — pages.department = board slug (SSC, railway, …).
 * @param {{ department: string, page: number, limit: number, includeRawText?: boolean }} opts
 */
async function listPagesByDepartment({ department, page, limit, includeRawText = false }) {
  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (page - 1) * limit;
  const dept = String(department || "")
    .trim()
    .toLowerCase();

  const cacheTier = includeRawText ? "full" : "lite";
  const cacheKey = `pages:board:${dept}:${page}:${limit}:${cacheTier}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // miss
    }
  }

  const total = await pageRepository.countPublicListByDepartment(dept);
  const totalPages = total === 0 ? 0 : Math.max(1, Math.ceil(total / limit));
  const rows = await pageRepository.selectPublicListByDepartment(dept, limit, offset, undefined, includeRawText);

  const data = rows.map((p) => {
    const row = {
      title: p.title,
      slug: p.slug,
      url: "/" + p.slug,
      status: (p.status || "").toLowerCase(),
      badges: parseBadges(p.badges),
      category: p.category,
      date: p.created_at || null,
      lastDate: normalizeLastDate(pickLastDateColumn(p)),
      breaking: p.breaking,
      position: p.position,
      eventTime: p.event_time
    };
    if (includeRawText) {
      row.rawText = p.raw_text;
    }
    return row;
  });

  const payload = {
    success: true,
    data,
    pagination: { total, totalPages, currentPage: page, limit }
  };

  await setCache(cacheKey, payload, LIST_TTL_SEC);
  return payload;
}

async function getPageRowBySlug(slug) {
  return pageRepository.findRowBySlug(slug);
}

async function getPublicPageBySlug(slug) {
  const cacheKey = `page:detail:${slug}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // miss
    }
  }

  const page = await pageRepository.findPublicRowBySlug(slug);
  if (!page) return null;

  const payload = {
    title: page.title,
    slug: page.slug,
    url: "/" + page.slug,
    status: page.status,
    category: page.category,
    rawText: page.raw_text,
    lastDate: normalizeLastDate(pickLastDateColumn(page)),
    id: page.id
  };

  await setCache(cacheKey, payload, PAGE_TTL_SEC);
  return payload;
}

async function getTopViews() {
  const cacheKey = "pages:topviews";
  const cached = await getCache(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // miss
    }
  }

  const rows = await pageRepository.selectTopViews(10);

  await setCache(cacheKey, rows, 120);
  return rows;
}

async function getActivityLogSlice() {
  const logsPath = path.join(process.cwd(), "data", "activity.json");
  try {
    const file = await fileService.readFile(logsPath, "utf8");
    const logs = JSON.parse(file);
    return logs.slice(-20).reverse();
  } catch {
    return [];
  }
}

/**
 * mysql2 may return MySQL DATE as JS Date, string (with dateStrings), or Buffer.
 * API must expose strict YYYY-MM-DD strings for lastDate.
 */
function normalizeLastDate(value) {
  if (value == null || value === "") return null;

  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    value = value.toString("utf8").trim();
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getFullYear();
    const m = value.getMonth() + 1;
    const d = value.getDate();
    return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(da)) return null;
  if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
}

/** mysql2 row field casing; some stacks expose camelCase. */
function pickLastDateColumn(row) {
  if (!row || typeof row !== "object") return null;
  if (row.last_date != null) return row.last_date;
  if (row.LAST_DATE != null) return row.LAST_DATE;
  if (row.lastDate != null) return row.lastDate;
  return null;
}

function isNewFormStatusValue(status) {
  return String(status ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ") === "new form";
}

async function listJobs({ qualification, state, department, jobType, status, source, page, limit }) {
  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const offset = (page - 1) * limit;
  const normalizedSource = String(source || "").trim().toLowerCase();
  const isFinderSource = normalizedSource === "finder";

  const total = await pageRepository.countJobsFiltered({ qualification, state, department, jobType, status });
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  const rows = await pageRepository.selectJobsFiltered({
    qualification,
    state,
    department,
    jobType,
    status,
    source: isFinderSource ? "finder" : undefined,
    limit,
    offset
  });

  const jobs = rows.map((p) => ({
    id: `job_${p.id}`,
    title: p.title || "",
    department: p.department || "",
    qualification: p.qualification || "",
    state: p.state || "",
    jobType: p.jobType || "",
    status: p.status || "",
    lastDate: normalizeLastDate(pickLastDateColumn(p)),
    page: p.slug ? `/jobs/${p.slug}.html` : "#"
  }));

  return {
    jobs,
    pagination: {
      total,
      totalPages,
      currentPage: page,
      limit
    }
  };
}

async function getJobById(id) {
  const row = await pageRepository.findJobById(id);
  if (!row) return null;

  return {
    id: `job_${row.id}`,
    title: row.title || "",
    department: row.department || "",
    qualification: row.qualification || "",
    state: row.state || "",
    jobType: row.jobType || "",
    status: row.status || "",
    lastDate: normalizeLastDate(pickLastDateColumn(row)),
    page: row.slug ? `/jobs/${row.slug}.html` : "#"
  };
}

module.exports = {
  listPages,
  listPagesByDepartment,
  listJobs,
  getJobById,
  getPageRowBySlug,
  getPublicPageBySlug,
  getTopViews,
  getActivityLogSlice,
  normalizeLastDate,
  isNewFormStatusValue,
  pickLastDateColumn,
  parseBadges
};
