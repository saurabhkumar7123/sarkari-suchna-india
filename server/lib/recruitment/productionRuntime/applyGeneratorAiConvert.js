"use strict";

/**
 * AMP-4B Part 6C — thin adapter: extracted PDF text → existing processJobParse().
 * Does not duplicate AI Convert, publisher formatting, or draft persistence.
 */

const logger = require("../../../utils/logger");
const { processJobParse, isStrongAiOutput } = require("../../../services/aiParseJob.service");

const JUNK_RE = /No usable data found|Input too short|\{\{TEXT\}\}|\$\{text\}/i;
const MIN_BODY_CHARS = 80;

function sectionBodies(text) {
  const parts = String(text || "").split(/\[Section:\s*[^\]]+\]/i);
  return parts
    .map((p) => p.trim())
    .filter(Boolean);
}

function isPdfLinkOnly(text, officialUrl) {
  const stripped = String(text || "")
    .replace(/\[Section:[^\]]+\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const url = String(officialUrl || "").trim();
  if (url && (stripped === url || stripped.endsWith(url))) {
    const rest = stripped.replace(url, "").replace(/official\s*pdf/gi, "").trim();
    if (rest.length < 40) return true;
  }
  const urls = stripped.match(/https?:\/\/[^\s]+/gi) || [];
  const withoutUrls = stripped.replace(/https?:\/\/[^\s]+/gi, "").replace(/official\s*pdf/gi, "").trim();
  return urls.length > 0 && withoutUrls.length < 40;
}

function isTitleOnly(text, title) {
  const t = String(title || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!t) return false;
  const body = String(text || "")
    .replace(/\[Section:[^\]]+\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return body === t || body === `# ${t}` || (body.includes(t) && body.length < t.length + 24);
}

function hasSourceOverlap(result, extractedText) {
  const src = String(extractedText || "").toLowerCase();
  if (src.length < 40) return true;
  const tokens = String(result || "")
    .toLowerCase()
    .match(/[a-zA-Z\u0900-\u097F]{5,}/g);
  if (!tokens || !tokens.length) return false;
  let hits = 0;
  const seen = Object.create(null);
  for (const tok of tokens) {
    if (seen[tok]) continue;
    seen[tok] = true;
    if (src.includes(tok)) hits += 1;
    if (hits >= 3) return true;
  }
  return hits >= 3;
}

/**
 * Accept only meaningful canonical publisher documents.
 * @param {string} result
 * @param {{ title?: string, officialUrl?: string, extractedText?: string }} [ctx]
 */
function isAcceptablePublisherOutput(result, ctx = {}) {
  if (!isStrongAiOutput(result)) return false;
  if (JUNK_RE.test(result)) return false;
  const bodies = sectionBodies(result);
  if (bodies.length < 2) return false;
  const bodyLen = bodies.join("\n").replace(/\s+/g, " ").trim().length;
  if (bodyLen < MIN_BODY_CHARS) return false;
  if (isPdfLinkOnly(result, ctx.officialUrl)) return false;
  if (isTitleOnly(result, ctx.title)) return false;
  if (!hasSourceOverlap(result, ctx.extractedText)) return false;
  return true;
}

/**
 * @param {string} extractedText
 * @returns {Promise<{ result: string, structured?: object, validation?: object, meta?: object }>}
 */
async function convertExtractedTextWithProcessJobParse(extractedText) {
  const input = typeof extractedText === "string" ? extractedText : "";
  return processJobParse(input);
}

/**
 * Run existing AI Convert and return publisher text only when the quality gate passes.
 *
 * @param {object} input
 * @param {string} input.extractedText
 * @param {string} [input.title]
 * @param {string} [input.officialUrl]
 * @returns {Promise<{ accepted: boolean, result?: string, reason: string }>}
 */
async function convertAmpExtractedTextToPublisher(input = {}) {
  const extractedText = String(input.extractedText || "");
  if (extractedText.trim().length < 20) {
    return { accepted: false, reason: "extracted_text_too_short" };
  }

  let parsed;
  try {
    parsed = await convertExtractedTextWithProcessJobParse(extractedText);
  } catch (err) {
    logger.warn("amp-4b ai-convert: processJobParse failed", {
      message: err && err.message ? err.message : String(err)
    });
    return {
      accepted: false,
      reason: "convert_failed",
      message: err && err.message ? err.message : String(err)
    };
  }

  const result = parsed && typeof parsed.result === "string" ? parsed.result : "";
  const ctx = {
    title: input.title,
    officialUrl: input.officialUrl,
    extractedText
  };
  if (!isAcceptablePublisherOutput(result, ctx)) {
    return { accepted: false, reason: "weak_output", result };
  }
  return { accepted: true, reason: "accepted", result };
}

/**
 * Replace only payload.data when convert is accepted. All other fields stay as-is.
 * @param {object} payload
 * @param {string} publisherText
 */
function withConvertedPublisherData(payload, publisherText) {
  return { ...payload, data: publisherText };
}

module.exports = {
  isAcceptablePublisherOutput,
  convertExtractedTextWithProcessJobParse,
  convertAmpExtractedTextToPublisher,
  withConvertedPublisherData
};
