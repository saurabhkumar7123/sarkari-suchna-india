"use strict";

/**
 * Preparation Pipeline — advisory validation with PASS / WARNING / BLOCKED.
 *
 * Critical identity errors → BLOCKED for unsafe automatic binding/publish prep.
 * Incomplete content → WARNING. Review Center remains available either way
 * (reviewEnqueueBlocked is always false).
 */

const {
  validatePublisherDraftContent,
  classifyDocumentFromTitle
} = require("../publisherDraftValidation");
const { ADVISORY_STATUS } = require("./extractionQualityGate");

const IDENTITY_CRITICAL_CODES = new Set([
  "missing_critical_identity",
  "contradictory_identity",
  "invalid_url",
  "obvious_extraction_failure",
  "extraction_too_short",
  "impossible_date_range",
  "ai_hallucination_indicator"
]);

const DATE_PARSE_RE =
  /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b|\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})\b/g;

const MONTHS = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11
};

function parseLooseDate(match) {
  if (!match) return null;
  if (match[1] != null) {
    let y = Number(match[3]);
    if (y < 100) y += 2000;
    const d = Number(match[1]);
    const m = Number(match[2]) - 1;
    if (!Number.isFinite(d) || !Number.isFinite(m) || m < 0 || m > 11 || d < 1 || d > 31) {
      return null;
    }
    const dt = new Date(Date.UTC(y, m, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m || dt.getUTCDate() !== d) return null;
    return dt;
  }
  const d = Number(match[4]);
  const mon = MONTHS[String(match[5] || "").toLowerCase()];
  let y = Number(match[6]);
  if (y < 100) y += 2000;
  if (!Number.isFinite(d) || mon == null || !Number.isFinite(y)) return null;
  const dt = new Date(Date.UTC(y, mon, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mon || dt.getUTCDate() !== d) return null;
  return dt;
}

function collectDates(text) {
  const dates = [];
  const re = new RegExp(DATE_PARSE_RE.source, "gi");
  let m;
  while ((m = re.exec(String(text || ""))) !== null) {
    const dt = parseLooseDate(m);
    if (dt) dates.push(dt);
  }
  return dates;
}

function detectImpossibleDateRanges(text) {
  const problems = [];
  const lower = String(text || "").toLowerCase();
  const startMatch = lower.match(/start(?:ing)?\s*(?:date)?\s*[:\-]?\s*([^\n|;]{6,40})/i);
  const endMatch = lower.match(/(?:last|end|closing)\s*(?:date)?\s*[:\-]?\s*([^\n|;]{6,40})/i);
  if (startMatch && endMatch) {
    const startDates = collectDates(startMatch[1]);
    const endDates = collectDates(endMatch[1]);
    if (startDates[0] && endDates[0] && startDates[0].getTime() > endDates[0].getTime()) {
      problems.push({
        code: "impossible_date_range",
        message: "Start date appears after end/last date."
      });
    }
  }
  return problems;
}

function detectDuplicateDates(text) {
  const warnings = [];
  const dates = collectDates(text);
  const seen = new Map();
  for (const dt of dates) {
    const key = dt.toISOString().slice(0, 10);
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  let dup = 0;
  for (const n of seen.values()) {
    if (n >= 4) dup += 1;
  }
  if (dup >= 2) {
    warnings.push({
      code: "duplicate_dates",
      message: "Same calendar dates repeat unusually often."
    });
  }
  return warnings;
}

function detectSuspiciousVacancy(text) {
  const warnings = [];
  const m = String(text || "").match(/\b(\d{1,8})\s*(posts?|vacancies|vacancy)\b/i);
  if (m) {
    const n = Number(m[1]);
    if (n === 0 || n > 500000) {
      warnings.push({
        code: "suspicious_vacancy_number",
        message: `Suspicious vacancy count: ${n}`
      });
    }
  }
  return warnings;
}

function detectHallucinationIndicators(text, extractedText) {
  const problems = [];
  const body = String(text || "");
  if (/lorem ipsum|as an ai language model|i cannot browse|hallucinat/i.test(body)) {
    problems.push({
      code: "ai_hallucination_indicator",
      message: "Content contains obvious AI hallucination / placeholder language."
    });
  }
  const src = String(extractedText || "");
  if (src.length > 120 && body.length > 120) {
    const tokens = body.toLowerCase().match(/[a-zA-Z\u0900-\u097F]{5,}/g) || [];
    const unique = [...new Set(tokens)].slice(0, 40);
    let hits = 0;
    const srcLower = src.toLowerCase();
    for (const tok of unique) {
      if (srcLower.includes(tok)) hits += 1;
    }
    if (unique.length >= 12 && hits / unique.length < 0.15) {
      problems.push({
        code: "ai_hallucination_indicator",
        message: "Converted text has very low overlap with source extraction."
      });
    }
  }
  return problems;
}

function detectMissingIdentity(identity = {}, eventType = null) {
  const problems = [];
  const org = String(identity.organization || identity.department || "").trim();
  const post = String(identity.postName || identity.post_name || identity.examName || identity.exam_name || "").trim();
  const year = identity.cycleYear || identity.cycle_year || identity.recruitmentYear || identity.year;
  const advt = String(identity.advertisementNo || identity.advertisement_no || "").trim();
  const product = String(eventType || "").toUpperCase();

  if (product === "NOTIFICATION" || product === "notification") {
    if (!advt && !(org && post && year)) {
      problems.push({
        code: "missing_critical_identity",
        message: "Notification lacks advertisement number or org+post+year identity."
      });
    }
  }
  return problems;
}

/**
 * @param {{
 *   text?: string,
 *   title?: string,
 *   eventType?: string|null,
 *   identity?: object,
 *   extractedText?: string|null,
 *   extractionStatus?: string|null
 * }} input
 */
function validatePreparationDraft(input = {}) {
  const base = validatePublisherDraftContent({
    text: input.text,
    title: input.title,
    eventType: input.eventType
  });

  const problems = [...(base.problems || [])];
  const warnings = [...(base.warnings || [])];

  problems.push(...detectImpossibleDateRanges(input.text));
  warnings.push(...detectDuplicateDates(input.text));
  warnings.push(...detectSuspiciousVacancy(input.text));
  problems.push(...detectHallucinationIndicators(input.text, input.extractedText));
  problems.push(...detectMissingIdentity(input.identity || {}, input.eventType || base.documentClass));

  if (String(input.extractionStatus || "").toUpperCase() === ADVISORY_STATUS.BLOCKED) {
    problems.push({
      code: "extraction_blocked",
      message: "Upstream extraction is BLOCKED / EXTRACTION_LOW_CONFIDENCE."
    });
  }

  const critical = problems.filter((p) => IDENTITY_CRITICAL_CODES.has(p.code) || p.code === "extraction_blocked");
  let status = ADVISORY_STATUS.PASS;
  if (critical.length || problems.some((p) => IDENTITY_CRITICAL_CODES.has(p.code))) {
    status = ADVISORY_STATUS.BLOCKED;
  } else if (problems.length || warnings.length) {
    status = problems.length ? ADVISORY_STATUS.BLOCKED : ADVISORY_STATUS.WARNING;
  }

  // Soft content incompleteness alone should not block Review Center.
  // Only critical identity / hallucination / extraction failures → BLOCKED for auto-prep.
  if (status === ADVISORY_STATUS.BLOCKED && critical.length === 0 && problems.length) {
    const onlySoft = problems.every(
      (p) =>
        p.code === "extraction_too_short" ||
        p.code === "obvious_extraction_failure" ||
        p.code === "invalid_url"
    );
    if (!onlySoft && !problems.some((p) => IDENTITY_CRITICAL_CODES.has(p.code))) {
      status = ADVISORY_STATUS.WARNING;
    }
  }

  return Object.freeze({
    status,
    ok: status === ADVISORY_STATUS.PASS,
    documentClass: base.documentClass || classifyDocumentFromTitle(input.title, input.eventType),
    sectionCount: base.sectionCount,
    sections: base.sections,
    problems: Object.freeze(problems),
    warnings: Object.freeze(warnings),
    blocking: false,
    reviewEnqueueBlocked: false,
    unsafeAutoBind: status === ADVISORY_STATUS.BLOCKED,
    unsafeAutoPublishPrep: status === ADVISORY_STATUS.BLOCKED
  });
}

module.exports = {
  ADVISORY_STATUS,
  validatePreparationDraft,
  detectImpossibleDateRanges,
  detectHallucinationIndicators,
  detectMissingIdentity
};
