"use strict";

/**
 * AMP-4B Part 6B — thin adapter: official PDF URL → existing Generator extractor.
 * Does not parse PDFs itself and does not call AI Convert.
 */

const net = require("net");
const dns = require("dns").promises;
const axios = require("axios");
const cheerio = require("cheerio");
const logger = require("../../../utils/logger");
const { MAX_UPLOAD_BYTES } = require("../../../config/uploadLimits");
const { extractGeneratorPdfText } = require("../../../services/pdfGeneratorExtract.service");
const {
  extractHostname,
  hostMatches
} = require("../../contentIntelligence/sourceIntelligence/officialDomains");

const DOWNLOAD_TIMEOUT_MS = 25000;
const PDF_MAGIC = Buffer.from("%PDF-");
const ALLOWED_PORTS = new Set([80, 443, "", null, undefined]);

const BRIDGE_CODES = Object.freeze({
  UNSAFE_URL: "UNSAFE_URL",
  HOST_MISMATCH: "HOST_MISMATCH",
  NOT_DIRECT_PDF: "NOT_DIRECT_PDF",
  NO_SAFE_PDF: "NO_SAFE_PDF",
  NOT_PDF: "NOT_PDF",
  DOWNLOAD_FAILED: "DOWNLOAD_FAILED",
  EXTRACT_FAILED: "EXTRACT_FAILED"
});

class OfficialPdfBridgeError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = "OfficialPdfBridgeError";
    this.code = code;
  }
}

function stripWww(host) {
  const h = String(host || "")
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  return h.replace(/^www\./, "");
}

function isPrivateIpv4(ip) {
  const p = String(ip)
    .split(".")
    .map((n) => Number(n));
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  if (p[0] === 0 || p[0] === 10 || p[0] === 127) return true;
  if (p[0] === 169 && p[1] === 254) return true;
  if (p[0] === 192 && p[1] === 168) return true;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
  if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;
  return false;
}

function isPrivateIpv6(ip) {
  const v = String(ip || "").toLowerCase();
  if (!v) return true;
  if (v === "::1" || v === "::") return true;
  if (v.startsWith("fe80:") || v.startsWith("fc") || v.startsWith("fd")) return true;
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  return false;
}

function isBlockedHostname(hostname) {
  const h = stripWww(hostname);
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h === "metadata.google.internal") return true;
  const version = net.isIP(h);
  if (version === 4) return isPrivateIpv4(h);
  if (version === 6) return isPrivateIpv6(h);
  return false;
}

function isDirectPdfPath(pathname) {
  const pathOnly = decodeURIComponent(String(pathname || ""))
    .toLowerCase()
    .split(";")[0];
  return pathOnly.endsWith(".pdf");
}

function assertSafeOfficialHttpUrl(rawUrl, monitoredSite) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || "").trim());
  } catch {
    throw new OfficialPdfBridgeError(BRIDGE_CODES.UNSAFE_URL, "Invalid document URL");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new OfficialPdfBridgeError(BRIDGE_CODES.UNSAFE_URL, "Document URL must be http or https");
  }

  const port = parsed.port === "" ? (parsed.protocol === "https:" ? 443 : 80) : Number(parsed.port);
  if (!ALLOWED_PORTS.has(parsed.port) && port !== 80 && port !== 443) {
    throw new OfficialPdfBridgeError(BRIDGE_CODES.UNSAFE_URL, "Document URL port is not allowed");
  }

  if (parsed.username || parsed.password) {
    throw new OfficialPdfBridgeError(BRIDGE_CODES.UNSAFE_URL, "Document URL must not include credentials");
  }

  const docHost = extractHostname(parsed.href);
  if (!docHost || isBlockedHostname(parsed.hostname) || isBlockedHostname(docHost)) {
    throw new OfficialPdfBridgeError(BRIDGE_CODES.UNSAFE_URL, "Document host is localhost or private");
  }

  const siteHost = extractHostname(monitoredSite && monitoredSite.url);
  if (!siteHost) {
    throw new OfficialPdfBridgeError(
      BRIDGE_CODES.HOST_MISMATCH,
      "Monitored site host is required to constrain PDF download"
    );
  }

  if (!hostMatches(docHost, siteHost) && !hostMatches(siteHost, docHost)) {
    throw new OfficialPdfBridgeError(
      BRIDGE_CODES.HOST_MISMATCH,
      "Document URL host does not match the monitored official source"
    );
  }

  return parsed;
}

function assertSafeOfficialPdfUrl(rawUrl, monitoredSite) {
  const parsed = assertSafeOfficialHttpUrl(rawUrl, monitoredSite);
  if (!isDirectPdfPath(parsed.pathname)) {
    throw new OfficialPdfBridgeError(
      BRIDGE_CODES.NOT_DIRECT_PDF,
      "Document URL is not a direct PDF (HTML notice pages are not fetched)"
    );
  }
  return parsed;
}

function hostsExactlyMatch(urlOrHostA, urlOrHostB) {
  const a = extractHostname(urlOrHostA);
  const b = extractHostname(urlOrHostB);
  return Boolean(a && b && a === b);
}

function collectRawDocumentHrefs(html) {
  const $ = cheerio.load(String(html || ""));
  const hrefs = [];
  $("a[href], area[href], iframe[src], embed[src], object[data], source[src]").each((_, el) => {
    const node = $(el);
    const raw = node.attr("href") || node.attr("src") || node.attr("data");
    if (raw) hrefs.push(String(raw).trim());
  });
  return hrefs;
}

/**
 * First same-host .pdf href on the official HTML notice, or null.
 * Does not invent filenames. Unrelated/private hosts are skipped (fail closed if none remain).
 */
function pickSameHostPdfUrl(html, noticeUrl, monitoredSite) {
  const siteHost = extractHostname(monitoredSite && monitoredSite.url);
  const noticeHost = extractHostname(noticeUrl);
  if (!siteHost || !noticeHost || siteHost !== noticeHost) return null;

  for (const href of collectRawDocumentHrefs(html)) {
    if (!href || href.startsWith("#") || /^javascript:/i.test(href) || /^mailto:/i.test(href)) {
      continue;
    }
    let absolute;
    try {
      absolute = new URL(href, noticeUrl).href;
    } catch {
      continue;
    }
    let parsed;
    try {
      parsed = new URL(absolute);
    } catch {
      continue;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") continue;
    if (!isDirectPdfPath(parsed.pathname)) continue;
    if (!hostsExactlyMatch(parsed.href, monitoredSite && monitoredSite.url)) continue;
    if (!hostsExactlyMatch(parsed.href, noticeUrl)) continue;
    try {
      return assertSafeOfficialPdfUrl(parsed.href, monitoredSite);
    } catch {
      continue;
    }
  }
  return null;
}

async function assertResolvedAddressesArePublic(hostname) {
  if (net.isIP(hostname)) return;
  let records;
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch (err) {
    throw new OfficialPdfBridgeError(
      BRIDGE_CODES.UNSAFE_URL,
      `Document host could not be resolved: ${err.message}`
    );
  }
  if (!Array.isArray(records) || !records.length) {
    throw new OfficialPdfBridgeError(BRIDGE_CODES.UNSAFE_URL, "Document host resolved to no addresses");
  }
  for (const rec of records) {
    const addr = rec && rec.address;
    const family = rec && rec.family === 6 ? 6 : 4;
    const blocked = family === 6 ? isPrivateIpv6(addr) : isPrivateIpv4(addr);
    if (blocked) {
      throw new OfficialPdfBridgeError(
        BRIDGE_CODES.UNSAFE_URL,
        "Document host resolved to a private or loopback address"
      );
    }
  }
}

function resolveOfficialPdfUrl({ notice, payload } = {}) {
  const candidates = [
    notice && notice.pdfUrl,
    notice && notice.url,
    payload && payload.pageUrl,
    payload && payload.officialNotification
  ];
  for (const value of candidates) {
    const raw = String(value || "").trim();
    if (!raw) continue;
    try {
      const parsed = new URL(raw);
      if (isDirectPdfPath(parsed.pathname)) return raw;
    } catch {
      // try next candidate
    }
  }
  const fallback = String((notice && notice.url) || (payload && payload.pageUrl) || "").trim();
  if (fallback) return fallback;
  return "";
}

function looksLikeHtml(buffer, contentType) {
  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("text/html") || ct.includes("application/xhtml")) return true;
  const head = buffer.slice(0, 256).toString("latin1").trimStart().toLowerCase();
  return head.startsWith("<!doctype html") || head.startsWith("<html");
}

function assertPdfMagic(buffer) {
  if (!buffer || buffer.length < PDF_MAGIC.length) {
    throw new OfficialPdfBridgeError(BRIDGE_CODES.NOT_PDF, "Downloaded body is not a PDF");
  }
  if (!buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
    throw new OfficialPdfBridgeError(BRIDGE_CODES.NOT_PDF, "Downloaded body is missing %PDF- signature");
  }
}

async function downloadOfficialPdfBuffer(parsedUrl, monitoredSite) {
  await assertResolvedAddressesArePublic(parsedUrl.hostname);

  let response;
  try {
    response = await axios.get(parsedUrl.href, {
      responseType: "arraybuffer",
      timeout: DOWNLOAD_TIMEOUT_MS,
      maxContentLength: MAX_UPLOAD_BYTES,
      maxBodyLength: MAX_UPLOAD_BYTES,
      maxRedirects: 3,
      headers: {
        Accept: "application/pdf,application/x-pdf,application/octet-stream",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
      },
      validateStatus: (status) => status >= 200 && status < 300,
      beforeRedirect(options) {
        const nextHref = `${options.protocol}//${options.hostname}${options.path || ""}`;
        assertSafeOfficialPdfUrl(nextHref, monitoredSite);
      }
    });
  } catch (err) {
    if (err instanceof OfficialPdfBridgeError) throw err;
    const code = err && err.code;
    if (code === "ERR_FR_MAX_BODY_LENGTH_EXCEEDED" || code === "ERR_BAD_RESPONSE") {
      throw new OfficialPdfBridgeError(BRIDGE_CODES.DOWNLOAD_FAILED, "PDF download exceeded size limit");
    }
    throw new OfficialPdfBridgeError(
      BRIDGE_CODES.DOWNLOAD_FAILED,
      err && err.message ? err.message : "PDF download failed"
    );
  }

  const buffer = Buffer.from(response.data || []);
  const contentType = response.headers && (response.headers["content-type"] || response.headers["Content-Type"]);
  if (looksLikeHtml(buffer, contentType)) {
    throw new OfficialPdfBridgeError(BRIDGE_CODES.NOT_PDF, "Response is HTML, not a PDF");
  }
  assertPdfMagic(buffer);
  return buffer;
}

async function downloadOfficialHtmlNotice(parsedUrl, monitoredSite) {
  await assertResolvedAddressesArePublic(parsedUrl.hostname);

  let response;
  try {
    response = await axios.get(parsedUrl.href, {
      responseType: "arraybuffer",
      timeout: DOWNLOAD_TIMEOUT_MS,
      maxContentLength: MAX_UPLOAD_BYTES,
      maxBodyLength: MAX_UPLOAD_BYTES,
      maxRedirects: 3,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
      },
      validateStatus: (status) => status >= 200 && status < 300,
      beforeRedirect(options) {
        const nextHref = `${options.protocol}//${options.hostname}${options.path || ""}`;
        assertSafeOfficialHttpUrl(nextHref, monitoredSite);
      }
    });
  } catch (err) {
    if (err instanceof OfficialPdfBridgeError) throw err;
    const code = err && err.code;
    if (code === "ERR_FR_MAX_BODY_LENGTH_EXCEEDED" || code === "ERR_BAD_RESPONSE") {
      throw new OfficialPdfBridgeError(BRIDGE_CODES.DOWNLOAD_FAILED, "Notice page download exceeded size limit");
    }
    throw new OfficialPdfBridgeError(
      BRIDGE_CODES.DOWNLOAD_FAILED,
      err && err.message ? err.message : "Notice page download failed"
    );
  }

  const buffer = Buffer.from(response.data || []);
  const contentType = response.headers && (response.headers["content-type"] || response.headers["Content-Type"]);
  if (!looksLikeHtml(buffer, contentType)) {
    assertPdfMagic(buffer);
    return { alreadyPdf: true, buffer };
  }
  return { alreadyPdf: false, html: buffer.toString("utf8") };
}

async function resolvePdfUrlFromHtmlNotice(rawUrl, monitoredSite) {
  const pageUrl = assertSafeOfficialHttpUrl(rawUrl, monitoredSite);
  if (!hostsExactlyMatch(pageUrl.href, monitoredSite && monitoredSite.url)) {
    throw new OfficialPdfBridgeError(
      BRIDGE_CODES.HOST_MISMATCH,
      "Notice page host does not exactly match the monitored official source"
    );
  }

  logger.info("amp-4b pdf-bridge: fetching official HTML notice for same-host PDF", {
    host: pageUrl.hostname,
    path: pageUrl.pathname
  });

  const fetched = await downloadOfficialHtmlNotice(pageUrl, monitoredSite);
  if (fetched.alreadyPdf) {
    return { parsed: pageUrl, buffer: fetched.buffer };
  }

  const pdfParsed = pickSameHostPdfUrl(fetched.html, pageUrl.href, monitoredSite);
  if (!pdfParsed) {
    throw new OfficialPdfBridgeError(
      BRIDGE_CODES.NO_SAFE_PDF,
      "No safe same-host PDF link on official notice page"
    );
  }
  return { parsed: pdfParsed, buffer: null };
}

/**
 * Validate + download an official PDF URL, then call extractGeneratorPdfText.
 *
 * @param {object} input
 * @param {object} [input.notice]
 * @param {object} [input.payload]
 * @param {object} [input.monitoredSite]
 * @returns {Promise<{ text: string, extractionNote?: string, sourceUrl: string }>}
 */
async function downloadOfficialPdfForGeneratorExtraction(input = {}) {
  const monitoredSite = input.monitoredSite || null;
  const rawUrl = resolveOfficialPdfUrl({ notice: input.notice, payload: input.payload });
  if (!rawUrl) {
    throw new OfficialPdfBridgeError(BRIDGE_CODES.NOT_DIRECT_PDF, "No official document URL on notice");
  }

  let parsed;
  let prefetchedBuffer = null;
  try {
    parsed = assertSafeOfficialPdfUrl(rawUrl, monitoredSite);
  } catch (err) {
    if (!(err instanceof OfficialPdfBridgeError) || err.code !== BRIDGE_CODES.NOT_DIRECT_PDF) {
      throw err;
    }
    const resolved = await resolvePdfUrlFromHtmlNotice(rawUrl, monitoredSite);
    parsed = resolved.parsed;
    prefetchedBuffer = resolved.buffer;
  }

  logger.info("amp-4b pdf-bridge: downloading official PDF", {
    host: parsed.hostname,
    path: parsed.pathname
  });

  const buffer = prefetchedBuffer || (await downloadOfficialPdfBuffer(parsed, monitoredSite));

  try {
    const extracted = await extractGeneratorPdfText(buffer);
    const text = String(extracted && extracted.text ? extracted.text : "");
    const result = { text, sourceUrl: parsed.href };
    if (extracted && extracted.extractionNote) result.extractionNote = extracted.extractionNote;
    return result;
  } catch (err) {
    throw new OfficialPdfBridgeError(
      BRIDGE_CODES.EXTRACT_FAILED,
      err && err.message ? err.message : "Generator PDF extraction failed"
    );
  }
}

module.exports = {
  BRIDGE_CODES,
  OfficialPdfBridgeError,
  DOWNLOAD_TIMEOUT_MS,
  assertSafeOfficialHttpUrl,
  assertSafeOfficialPdfUrl,
  resolveOfficialPdfUrl,
  pickSameHostPdfUrl,
  assertPdfMagic,
  downloadOfficialPdfForGeneratorExtraction
};
