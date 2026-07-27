"use strict";

/**
 * Phase AI-4 — Draft text helpers.
 * Deterministic utilities reused across completeness, validation and scoring.
 */

const {
  collapse,
  toText,
  toKey,
  clamp,
  round2,
  detectLanguage,
  toLines,
  uniqueBy
} = require("../noticeIntelligence/textUtils");
const { SECTION_TYPES, SECTION_TYPE_TO_TITLE, SECTION_HEADING_MAP } = require("../generatorIntelligence/types");
const { classifyLink, extractUrls } = require("../generatorIntelligence/linkClassification");

const DATE_TOKEN_RE =
  /\b(?:\d{1,2}[\/\-.\s]\d{1,2}[\/\-.\s]\d{2,4}|\d{1,2}\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{2,4})\b/gi;

const FEE_RE = /(?:rs\.?|inr|₹)\s*([0-9][0-9,]*)/gi;
const VACANCY_NUMBER_RE = /\b(\d{1,6})\b/g;
const ADV_RE =
  /(?:advertisement|advt\.?|adv\.?)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\/\-.]{2,40})/i;
const REF_RE =
  /(?:reference|ref\.?|notice)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\/\-.]{2,40})/i;

const PLACEHOLDER_LINK_RE =
  /(?:example\.com|example\.gov|localhost|127\.0\.0\.1|\btodo\b|\btbd\b|coming[\s_-]*soon|link[\s_-]*here|^#+$|\bn\/a\b|\bxxx\b)/i;

const BROKEN_UNICODE_RE = /(?:\uFFFD|Ã.|Â.|â€™|â€œ|â€|ï¿½|\\u00[0-9a-f]{2})/i;
const OCR_ARTIFACT_RE =
  /(?:[|]{3,}|(?:\b[Il]{4,}\b)|(?:\b[oO0]{5,}\b)|(?:[^\S\r\n]{8,})|(?:[A-Za-z]\s[A-Za-z]\s[A-Za-z]\s[A-Za-z])|(?:rn\b.*rn\b)|(?:\bvv\b)|(?:\bii\s+ii\b))/i;

/**
 * Resolve a heading string to an AI-1 section type, preserving unknowns.
 * @param {string} title
 * @returns {{ sectionType: string, generatorTitle: string|null, isKnown: boolean }}
 */
function resolveSectionType(title) {
  const raw = collapse(title);
  const key = toKey(raw);
  const mapped = SECTION_HEADING_MAP[key] || SECTION_HEADING_MAP[key.replace(/\s+/g, "")];
  if (mapped) {
    return {
      sectionType: mapped,
      generatorTitle: SECTION_TYPE_TO_TITLE[mapped] || raw,
      isKnown: true
    };
  }
  // FAQ alias already covered; treat "Important Questions" via map.
  if (/important\s+questions|faq/i.test(raw)) {
    return {
      sectionType: SECTION_TYPES.FAQ,
      generatorTitle: SECTION_TYPE_TO_TITLE[SECTION_TYPES.FAQ],
      isKnown: true
    };
  }
  return {
    sectionType: SECTION_TYPES.UNKNOWN,
    generatorTitle: raw || null,
    isKnown: false
  };
}

/**
 * Parse publisher-style `[Section: Title]` text into ordered sections.
 * Falls back to plain heading lines when brackets are absent.
 * @param {string} text
 * @returns {Array<object>}
 */
function parsePublisherSections(text) {
  const source = toText(text);
  if (!source.trim()) return [];

  const bracketParts = source.split(/\[Section:\s*([^\]]+)\]/i);
  if (bracketParts.length > 1) {
    const sections = [];
    for (let i = 1; i < bracketParts.length; i += 2) {
      const title = collapse(bracketParts[i]);
      const body = toText(bracketParts[i + 1]).trim();
      const resolved = resolveSectionType(title);
      sections.push({
        order: sections.length,
        title,
        sectionType: resolved.sectionType,
        generatorTitle: resolved.generatorTitle || title,
        isKnown: resolved.isKnown,
        content: body,
        lines: toLines(body)
      });
    }
    return sections;
  }

  // Plain heading fallback — reuse AI-1 heading map against standalone lines.
  const lines = source.split(/\r?\n/);
  const sections = [];
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current) current.lines.push("");
      continue;
    }
    const resolved = resolveSectionType(trimmed);
    const looksLikeHeading =
      resolved.isKnown &&
      trimmed.length < 80 &&
      !/[.:=]\s*\d/.test(trimmed) &&
      !/^https?:\/\//i.test(trimmed);

    if (looksLikeHeading) {
      if (current) {
        current.content = current.lines.join("\n").trim();
        sections.push(current);
      }
      current = {
        order: sections.length,
        title: trimmed,
        sectionType: resolved.sectionType,
        generatorTitle: resolved.generatorTitle || trimmed,
        isKnown: true,
        content: "",
        lines: []
      };
      continue;
    }

    if (!current) {
      current = {
        order: 0,
        title: "Short Information",
        sectionType: SECTION_TYPES.SHORT_INFORMATION,
        generatorTitle: SECTION_TYPE_TO_TITLE[SECTION_TYPES.SHORT_INFORMATION],
        isKnown: true,
        content: "",
        lines: []
      };
    }
    current.lines.push(trimmed);
  }

  if (current) {
    current.content = current.lines.join("\n").trim();
    sections.push(current);
  }

  return sections.map((sec, idx) => ({ ...sec, order: idx, lines: toLines(sec.content) }));
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function extractDates(text) {
  const matches = toText(text).match(DATE_TOKEN_RE) || [];
  return uniqueBy(
    matches.map((d) => collapse(d)),
    (d) => toKey(d)
  );
}

/**
 * @param {string} text
 * @returns {number[]}
 */
function extractFeeAmounts(text) {
  const amounts = [];
  const s = toText(text);
  let m;
  const re = new RegExp(FEE_RE.source, "gi");
  while ((m = re.exec(s)) !== null) {
    const n = Number(String(m[1]).replace(/,/g, ""));
    if (Number.isFinite(n)) amounts.push(n);
  }
  return amounts;
}

/**
 * Pull vacancy integers from table-ish text; excludes years and small ages.
 * @param {string} text
 * @returns {number[]}
 */
function extractVacancyNumbers(text) {
  const lines = toLines(text);
  const nums = [];
  for (const line of lines) {
    if (/age|year|fee|rs\.?|https?:/i.test(line) && !/vacanc|post|total/i.test(line)) continue;
    const parts = line.split(/[,|]/);
    for (const part of parts) {
      const m = part.match(/\b(\d{1,5})\b/);
      if (!m) continue;
      const n = Number(m[1]);
      if (!Number.isFinite(n)) continue;
      if (n >= 1900 && n <= 2100) continue;
      if (n > 0 && n < 100000) nums.push(n);
    }
  }
  return nums;
}

/**
 * @param {string} text
 * @returns {string|null}
 */
function extractAdvertisementNumber(text) {
  const m = toText(text).match(ADV_RE);
  if (!m) return null;
  const value = collapse(m[1]);
  if (/^(pdf|http|https|www|html|aspx)$/i.test(value)) return null;
  return value;
}

/**
 * @param {string} text
 * @returns {string|null}
 */
function extractReferenceNumber(text) {
  const m = toText(text).match(REF_RE);
  if (!m) return null;
  const value = collapse(m[1]);
  if (/^(pdf|http|https|www|html|aspx)$/i.test(value)) return null;
  return value;
}

/**
 * Collect labelled links from Important Links style content.
 * @param {string} text
 * @returns {Array<{ label: string, url: string, category: string }>}
 */
function extractLinksFromText(text) {
  const lines = toLines(text);
  const links = [];
  const seen = new Set();

  for (const line of lines) {
    const urls = extractUrls(line);
    if (!urls.length) continue;
    for (const url of urls) {
      const key = url.toLowerCase();
      if (seen.has(key)) {
        links.push({
          label: collapse(line.replace(url, "")),
          url,
          category: classifyLink(line, url),
          duplicateOf: key
        });
        continue;
      }
      seen.add(key);
      const label = collapse(line.replace(url, "").replace(/[=:\-–—]+$/, "").trim()) || classifyLink(line, url);
      links.push({
        label,
        url,
        category: classifyLink(label || line, url),
        duplicateOf: null
      });
    }
  }

  // Also catch bare URLs not on labelled lines
  for (const url of extractUrls(text)) {
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({
      label: LINK_LABEL_FALLBACK(classifyLink("", url)),
      url,
      category: classifyLink("", url),
      duplicateOf: null
    });
  }

  return links;
}

/**
 * @param {string} category
 * @returns {string}
 */
function LINK_LABEL_FALLBACK(category) {
  const { LINK_CATEGORY_TO_LABEL } = require("../generatorIntelligence/types");
  return LINK_CATEGORY_TO_LABEL[category] || "Link";
}

/**
 * @param {string} url
 * @returns {{ broken: boolean, reason: string|null }}
 */
function assessLinkHealth(url) {
  const u = toText(url).trim();
  if (!u) return { broken: true, reason: "empty_url" };
  if (PLACEHOLDER_LINK_RE.test(u)) return { broken: true, reason: "placeholder_or_dummy" };
  if (!/^https?:\/\//i.test(u) && !/^www\./i.test(u)) {
    return { broken: true, reason: "missing_scheme" };
  }
  if (/\s/.test(u)) return { broken: true, reason: "whitespace_in_url" };
  if (/https?:\/\/https?:\/\//i.test(u)) return { broken: true, reason: "doubled_scheme" };
  return { broken: false, reason: null };
}

/**
 * Sentence-ish split for repetition detection.
 * @param {string} text
 * @returns {string[]}
 */
function splitSentences(text) {
  return toText(text)
    .split(/(?<=[.!?।])\s+|\n+/)
    .map((s) => collapse(s))
    .filter((s) => s.length >= 20);
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function sameIdentifier(a, b) {
  const left = toKey(a).replace(/[\s.\-_/]/g, "");
  const right = toKey(b).replace(/[\s.\-_/]/g, "");
  if (!left || !right) return false;
  return left === right;
}

/**
 * Sum integers that look like category vacancy cells (last number on each data row).
 * @param {string} text
 * @returns {{ rowTotals: number[], statedTotal: number|null, sum: number }}
 */
function analyzeVacancyTotals(text) {
  const lines = toLines(text);
  const rowTotals = [];
  let statedTotal = null;

  for (const line of lines) {
    const lower = line.toLowerCase();
    const nums = [...line.matchAll(/\b(\d{1,6})\b/g)].map((m) => Number(m[1])).filter((n) => n < 1900 || n > 2100);
    if (!nums.length) continue;
    if (/total|grand\s*total|कुल/.test(lower)) {
      statedTotal = nums[nums.length - 1];
      continue;
    }
    if (/post\s*name|category|vacancy|force|posts/i.test(lower) && nums.length <= 1 && /[a-zA-Z]/.test(line)) {
      // header-ish
      continue;
    }
    rowTotals.push(nums[nums.length - 1]);
  }

  const sum = rowTotals.reduce((a, b) => a + b, 0);
  return { rowTotals, statedTotal, sum };
}

module.exports = {
  DATE_TOKEN_RE,
  FEE_RE,
  VACANCY_NUMBER_RE,
  PLACEHOLDER_LINK_RE,
  BROKEN_UNICODE_RE,
  OCR_ARTIFACT_RE,
  resolveSectionType,
  parsePublisherSections,
  extractDates,
  extractFeeAmounts,
  extractVacancyNumbers,
  extractAdvertisementNumber,
  extractReferenceNumber,
  extractLinksFromText,
  assessLinkHealth,
  splitSentences,
  sameIdentifier,
  analyzeVacancyTotals,
  collapse,
  toText,
  toKey,
  clamp,
  round2,
  detectLanguage,
  toLines,
  uniqueBy
};
