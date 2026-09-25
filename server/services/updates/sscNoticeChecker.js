"use strict";

const logger = require("../../utils/logger");
const { monitoringSafeGet, MonitoringHttpSafetyError } = require("./monitoringHttpSafety");

const SSC_NOTICE_API_URL = "https://ssc.gov.in/api/general-website/portal/notice-boards";
const SSC_ATTACHMENT_BASE = "https://ssc.gov.in/api/attachment/";

function isSscApiEnabled() {
  return String(process.env.SSC_USE_API || "").trim() === "1";
}

function isSscApiSite(site) {
  try {
    const hostname = new URL(String((site && site.url) || "")).hostname.toLowerCase();
    return hostname === "ssc.gov.in" || hostname === "www.ssc.gov.in";
  } catch {
    return false;
  }
}

function getMaxItems() {
  return Math.min(10, Math.max(1, parseInt(process.env.UPDATE_MAX_ITEMS_PER_SITE || "5", 10)));
}

function buildAttachmentLink(path) {
  const normalized = String(path || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  if (!normalized) return "";
  return `${SSC_ATTACHMENT_BASE}${normalized}`;
}

function mapNoticeRow(row, helpers) {
  const { buildSignature, normalizeText } = helpers;
  const title = normalizeText(row && row.headline);
  if (!title) return null;

  const attachmentPath =
    row && row.attachments && row.attachments[0] && row.attachments[0].path
      ? row.attachments[0].path
      : "";
  const link = buildAttachmentLink(attachmentPath);
  const merged = normalizeText(`${title} ${link}`);

  return {
    title,
    link,
    latestContent: merged,
    fingerprint: buildSignature(merged)
  };
}

async function fetchSscNotices(options = {}) {
  const params = {
    language: "english",
    attributes: "id,headline,createdAt",
    page: 1,
    limit: getMaxItems(),
    key: "createdAt",
    order: "DESC",
    isPaginationRequired: false,
    isAttachment: true,
    contentType: "notice-boards"
  };

  const response = await monitoringSafeGet(SSC_NOTICE_API_URL, {
    params,
    timeout: 25000,
    accept: "application/json",
    allowWhenAutomationDormant: options.allowWhenAutomationDormant === true,
    siteId: options.siteId != null ? options.siteId : null,
    requireOfficialHost: true,
    responseType: "text",
    transformResponse: [(data) => data]
  });

  const raw = response.data;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

/**
 * @param {object} site
 * @param {{ buildSignature: Function, normalizeText: Function }} helpers
 * @param {{ allowWhenAutomationDormant?: boolean }} [options]
 */
async function extractSscNoticeItems(site, helpers, options = {}) {
  try {
    const body = await fetchSscNotices({
      allowWhenAutomationDormant: options.allowWhenAutomationDormant === true,
      siteId: site && site.id
    });

    if (!body || String(body.statusCode) !== "200") {
      logger.warn("updates: SSC API bad response", {
        siteId: site && site.id,
        statusCode: body && body.statusCode,
        error: body && body.error
      });
      return { invalid: true, reason: "ssc_api_error" };
    }

    const rows = Array.isArray(body.data) ? body.data : [];
    const items = [];

    for (const row of rows.slice(0, getMaxItems())) {
      const item = mapNoticeRow(row, helpers);
      if (item) items.push(item);
    }

    if (!items.length) {
      logger.warn("updates: SSC API returned no usable notices", {
        siteId: site && site.id
      });
      return { invalid: true, reason: "ssc_api_empty" };
    }

    logger.info("updates: SSC API notices fetched", {
      siteId: site && site.id,
      count: items.length
    });

    return { items };
  } catch (err) {
    if (err instanceof MonitoringHttpSafetyError) {
      logger.warn("updates: SSC API blocked by HTTP safety", {
        siteId: site && site.id,
        code: err.code,
        message: err.message
      });
      return { invalid: true, reason: err.code || "ssc_api_error", policySkip: true };
    }
    logger.warn("updates: SSC API request failed", {
      siteId: site && site.id,
      message: err && err.message ? err.message : String(err)
    });
    return { invalid: true, reason: "ssc_api_error" };
  }
}

module.exports = {
  isSscApiEnabled,
  isSscApiSite,
  buildAttachmentLink,
  mapNoticeRow,
  extractSscNoticeItems
};
