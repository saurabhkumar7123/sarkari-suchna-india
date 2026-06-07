"use strict";

const fs = require("fs");
const path = require("path");

const pageService = require("./page.service");
const { getBoardHub, isBoardSlug, normalizeBoardSlug } = require("../lib/boardHubs");
const {
  resolveQualificationFromPath,
  resolveStateFromPath,
  buildBoardPath,
  buildQualificationPath,
  buildStatePath
} = require("../lib/taxonomySlugs");
const { renderTaxonomySSRPage } = require("../lib/renderTaxonomySSRPage");
const {
  QUALIFICATION_REGISTRY,
  STATE_REGISTRY
} = require("./homeStats.service");

const footerTemplatePath = path.join(process.cwd(), "generated", "static", "footer.html");
let cachedFooter = "";

function loadFooterIntoCache() {
  try {
    cachedFooter = String(fs.readFileSync(footerTemplatePath, "utf8") || "");
  } catch {
    cachedFooter = "";
  }
}

loadFooterIntoCache();

function getFooterHtml() {
  return cachedFooter;
}

function getQualificationMeta(slug) {
  const entry = QUALIFICATION_REGISTRY.find((item) => item.slug === slug);
  const label = entry ? entry.label : slug.replace(/\b\w/g, (c) => c.toUpperCase());
  const pathSlug = buildQualificationPath(slug).replace(/^\/qualification\//, "");
  return {
    title: `${label} Government Jobs 2026 | Sarkari Suchna India`,
    description: `Browse latest ${label} qualification government job notifications, results and admit card updates on Sarkari Suchna India.`,
    h1: `${label} Jobs`,
    sub: `Latest government job updates for ${label} qualification candidates.`,
    canonicalPath: `/qualification/${pathSlug}`
  };
}

function getStateMeta(slug) {
  const entry = STATE_REGISTRY.find((item) => item.slug === slug);
  const label = entry ? entry.label : slug.replace(/\b\w/g, (c) => c.toUpperCase());
  const pathSlug = buildStatePath(slug).replace(/^\/state\//, "");
  return {
    title: `${label} Government Jobs 2026 | Sarkari Suchna India`,
    description: `Find latest ${label} state government job notifications, recruitment forms and exam updates on Sarkari Suchna India.`,
    h1: `${label} Jobs`,
    sub: `Latest Sarkari job updates for ${label}.`,
    canonicalPath: `/state/${pathSlug}`
  };
}

function mapJobToCard(job) {
  let url = String(job && job.page ? job.page : "#");
  let slug = "";
  const legacyMatch = url.match(/^\/jobs\/([^/]+)\.html$/i);
  if (legacyMatch) {
    slug = legacyMatch[1];
    url = `/${slug}`;
  } else if (url.startsWith("/") && !url.startsWith("/jobs/")) {
    slug = url.replace(/^\/+/, "");
  }
  return {
    title: job.title || "",
    slug,
    url,
    status: String(job.status || "").toLowerCase()
  };
}

async function listTaxonomyPages({ type, value, limit = 25 }) {
  if (type === "board") {
    return pageService.listPagesByDepartment({ department: value, page: 1, limit });
  }
  if (type === "qualification") {
    const result = await pageService.listJobs({ qualification: value, page: 1, limit });
    return {
      success: true,
      data: Array.isArray(result.jobs) ? result.jobs.map(mapJobToCard) : [],
      pagination: result.pagination || null
    };
  }
  if (type === "state") {
    const result = await pageService.listJobs({ state: value, page: 1, limit });
    return {
      success: true,
      data: Array.isArray(result.jobs) ? result.jobs.map(mapJobToCard) : [],
      pagination: result.pagination || null
    };
  }
  return { success: false, data: [], pagination: null };
}

/**
 * @param {{ type: "board"|"qualification"|"state", slug: string, baseUrl?: string, headerHtml?: string, footerHtml?: string }} opts
 * @returns {Promise<string|null>}
 */
async function buildTaxonomyPage(opts) {
  const type = String(opts.type || "").trim().toLowerCase();
  const pathSlug = String(opts.slug || "").trim();
  if (!type || !pathSlug) return null;

  let filterValue = null;
  let meta = null;

  if (type === "board") {
    const boardSlug = normalizeBoardSlug(pathSlug);
    if (!boardSlug || !isBoardSlug(boardSlug)) return null;
    const hub = getBoardHub(boardSlug);
    if (!hub) return null;
    filterValue = boardSlug;
    meta = {
      title: hub.title,
      description: hub.description,
      h1: hub.h1,
      sub: hub.sub,
      canonicalPath: buildBoardPath(boardSlug)
    };
  } else if (type === "qualification") {
    filterValue = resolveQualificationFromPath(pathSlug);
    if (!filterValue) return null;
    meta = getQualificationMeta(filterValue);
  } else if (type === "state") {
    filterValue = resolveStateFromPath(pathSlug);
    if (!filterValue) return null;
    meta = getStateMeta(filterValue);
  } else {
    return null;
  }

  const payload = await listTaxonomyPages({ type, value: filterValue, limit: 25 }).catch(() => ({
    success: false,
    data: []
  }));

  return renderTaxonomySSRPage({
    ...meta,
    items: Array.isArray(payload.data) ? payload.data : [],
    baseUrl: opts.baseUrl || "",
    headerHtml: opts.headerHtml || "",
    footerHtml: opts.footerHtml != null ? opts.footerHtml : getFooterHtml()
  });
}

module.exports = {
  buildTaxonomyPage,
  listTaxonomyPages,
  getFooterHtml,
  mapJobToCard
};
