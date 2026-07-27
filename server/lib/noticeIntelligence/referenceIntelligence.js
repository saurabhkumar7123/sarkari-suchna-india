"use strict";

/**
 * Phase AI-2 — Reference, advertisement number and date extraction.
 *
 * Government notices identify themselves through advertisement / notification /
 * file numbers. Those identifiers plus the publication date are what future
 * duplicate-matching phases will key on, so they are extracted conservatively
 * and any suspicious value is flagged rather than silently accepted.
 */

const { collapse, round2, toText, uniqueBy } = require("./textUtils");

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

/**
 * Devanagari is expressed as a script property escape rather than a code point
 * range so composed patterns stay valid for matras and other combining marks.
 */
const DEVANAGARI = "\\p{Script=Devanagari}";

const ENGLISH_MONTHS = Object.freeze({
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12
});

const HINDI_MONTHS = Object.freeze({
  जनवरी: 1,
  फरवरी: 2,
  मार्च: 3,
  अप्रैल: 4,
  मई: 5,
  जून: 6,
  जुलाई: 7,
  अगस्त: 8,
  सितंबर: 9,
  सितम्बर: 9,
  अक्टूबर: 10,
  अक्तूबर: 10,
  नवंबर: 11,
  नवम्बर: 11,
  दिसंबर: 12,
  दिसम्बर: 12
});

const ADVERTISEMENT_LABELS =
  /(?:advertisement|advertisment|advt|adv|notification|notice)\s*(?:no|number|sr\.?\s*no)?\s*\.?\s*[:–-]?\s*/i;
const ADVERTISEMENT_HINDI_LABEL = /(?:विज्ञापन|अधिसूचना|सूचना)\s*(?:संख्या|सं\.?|क्रमांक)\s*[:–-]?\s*/;
const REFERENCE_LABELS =
  /(?:reference|ref|file|f)\s*\.?\s*(?:no|number)\s*\.?\s*[:–-]?\s*|(?:^|\s)no\s*\.\s*/i;
const REFERENCE_HINDI_LABEL = /(?:संदर्भ|पत्रांक|फाइल)\s*(?:संख्या|सं\.?)?\s*[:–-]?\s*/;

/**
 * Identifier bodies look like `A-1/E-1/2026`, `05/2025-26`, `RECT/2026/11`, and
 * their Devanagari equivalents such as `ए-2/ई-1/2025`.
 */
const IDENTIFIER_BODY = new RegExp(
  `[A-Za-z0-9${DEVANAGARI}]+(?:[./–—-][A-Za-z0-9()${DEVANAGARI}]+){1,6}|\\d{1,5}\\s*/\\s*\\d{4}`,
  "u"
);

/** How far past the label an identifier may start before it is treated as unrelated prose. */
const IDENTIFIER_MAX_OFFSET = 12;
const PURE_DATE = /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/;

// A bare "date" label is deliberately excluded: it would capture "Exam Date".
const PUBLICATION_LABELS =
  /(?:date\s*of\s*(?:publication|issue|notice|advertisement)|publication\s*date|published\s*on|issued\s*on|dated)\s*[:–-]?\s*/i;
const PUBLICATION_HINDI_LABEL = /(?:जारी\s*दिनांक|प्रकाशन\s*तिथि|दिनांक)\s*[:–-]?\s*/;

const NUMERIC_DATE = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/;
const TEXT_DATE_DMY = new RegExp(
  `\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s.-]+([A-Za-z${DEVANAGARI}]{3,12})[\\s.,-]+(\\d{4})\\b`,
  "u"
);
const TEXT_DATE_MDY = /\b([A-Za-z]{3,12})[\s.-]+(\d{1,2})(?:st|nd|rd|th)?[\s.,-]+(\d{4})\b/;
const YEAR_PATTERN = /\b(20\d{2})\b/g;

const BROKEN_IDENTIFIER =
  /(?:^[./–—-]|[./–—-]$|x{3,}|_{2,}|\.{3,}|^\W+$|\bnil\b|\bna\b|\btbd\b)/i;

/**
 * Convert Devanagari numerals so downstream parsing only sees ASCII digits.
 * @param {string} value
 * @returns {string}
 */
function normalizeDigits(value) {
  return toText(value).replace(/[०-९]/g, (char) => String(DEVANAGARI_DIGITS.indexOf(char)));
}

/**
 * @param {number} year
 * @returns {number}
 */
function expandTwoDigitYear(year) {
  if (year >= 100) return year;
  return year >= 70 ? 1900 + year : 2000 + year;
}

/**
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @returns {string|null}
 */
function toIsoDate(year, month, day) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1950 || year > 2100) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * Parse an Indian-format date string (day first) in English or Hindi.
 * @param {string} value
 * @returns {{ iso: string|null, raw: string, format: string|null }}
 */
function parseDate(value) {
  const raw = collapse(value);
  const text = normalizeDigits(raw);
  if (!text) return { iso: null, raw, format: null };

  const numeric = text.match(NUMERIC_DATE);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const year = expandTwoDigitYear(Number(numeric[3]));
    const iso = toIsoDate(year, month, day);
    if (iso) return { iso, raw, format: "numeric_dmy" };
  }

  const dmy = text.match(TEXT_DATE_DMY);
  if (dmy) {
    const monthKey = dmy[2].toLowerCase();
    const month = ENGLISH_MONTHS[monthKey] || HINDI_MONTHS[dmy[2]] || null;
    const iso = month ? toIsoDate(Number(dmy[3]), month, Number(dmy[1])) : null;
    if (iso) return { iso, raw, format: "text_dmy" };
  }

  const mdy = text.match(TEXT_DATE_MDY);
  if (mdy) {
    const month = ENGLISH_MONTHS[mdy[1].toLowerCase()] || null;
    const iso = month ? toIsoDate(Number(mdy[3]), month, Number(mdy[2])) : null;
    if (iso) return { iso, raw, format: "text_mdy" };
  }

  return { iso: null, raw, format: null };
}

/**
 * @param {string} value
 * @returns {string|null}
 */
function cleanIdentifier(value) {
  const cleaned = collapse(value)
    .replace(/^[:\-–—.\s]+/, "")
    .replace(/[,;)\]]+$/, "")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s*-\s*/g, "-")
    .trim();
  return cleaned || null;
}

/**
 * Extract a labelled identifier such as an advertisement or file number.
 * @param {string[]} lines
 * @param {RegExp} englishLabel
 * @param {RegExp} hindiLabel
 * @param {{ skipLines?: Set<string> }} [options]
 * @returns {{ value: string|null, raw: string|null, line: string|null, language: string|null }}
 */
function extractLabelledIdentifier(lines, englishLabel, hindiLabel, options = {}) {
  const skipLines = options.skipLines instanceof Set ? options.skipLines : new Set();

  for (const line of lines) {
    const text = collapse(line);
    if (!text || skipLines.has(text)) continue;

    for (const [label, language] of [
      [englishLabel, "en"],
      [hindiLabel, "hi"]
    ]) {
      const labelMatch = text.match(label);
      if (!labelMatch) continue;
      const tail = text.slice(labelMatch.index + labelMatch[0].length);
      const bodyMatch = tail.match(IDENTIFIER_BODY);
      // An identifier that starts well after its label is prose, not a number.
      if (!bodyMatch || bodyMatch.index > IDENTIFIER_MAX_OFFSET) continue;
      const value = cleanIdentifier(bodyMatch[0]);
      if (!value || value.length < 3 || PURE_DATE.test(value)) continue;
      return { value, raw: text, line: text, language };
    }
  }
  return { value: null, raw: null, line: null, language: null };
}

/**
 * Collect every labelled date in the notice ("Last Date : 30/09/2025").
 * @param {string[]} lines
 * @returns {Array<{ label: string|null, raw: string, iso: string|null, format: string|null }>}
 */
function extractDates(lines) {
  const found = [];
  for (const line of lines) {
    const text = collapse(line);
    if (!text) continue;
    const parsed = parseDate(text);
    if (!parsed.iso) continue;
    const labelMatch = text.match(/^([^:：]{2,60})[:：]/);
    found.push({
      label: labelMatch ? collapse(labelMatch[1]) : null,
      raw: text,
      iso: parsed.iso,
      format: parsed.format
    });
  }
  return uniqueBy(found, (entry) => `${(entry.label || "").toLowerCase()}|${entry.iso}`);
}

/**
 * @param {string[]} lines
 * @returns {{ iso: string|null, raw: string|null, source: string|null }}
 */
function extractPublicationDate(lines) {
  for (const line of lines) {
    const text = collapse(line);
    if (!text) continue;
    for (const [label, source] of [
      [PUBLICATION_LABELS, "labelled_en"],
      [PUBLICATION_HINDI_LABEL, "labelled_hi"]
    ]) {
      const match = text.match(label);
      if (!match) continue;
      const parsed = parseDate(text.slice(match.index + match[0].length));
      if (parsed.iso) return { iso: parsed.iso, raw: collapse(parsed.raw), source };
    }
  }
  return { iso: null, raw: null, source: null };
}

/**
 * @param {string} text
 * @returns {number|null}
 */
function extractYear(text) {
  const normalized = normalizeDigits(text);
  const years = [];
  let match;
  YEAR_PATTERN.lastIndex = 0;
  while ((match = YEAR_PATTERN.exec(normalized)) !== null) years.push(Number(match[1]));
  if (!years.length) return null;
  const counts = new Map();
  for (const year of years) counts.set(year, (counts.get(year) || 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

/**
 * @param {string|null} identifier
 * @returns {boolean}
 */
function isBrokenIdentifier(identifier) {
  if (!identifier) return false;
  if (identifier.length < 3 || identifier.length > 60) return true;
  if (!/[0-9]/.test(identifier)) return true;
  return BROKEN_IDENTIFIER.test(identifier);
}

/**
 * Extract all reference-style metadata from a notice.
 *
 * @param {{ title?: string, lines?: string[], text?: string }} input
 * @returns {object}
 */
function extractReferences(input = {}) {
  const title = collapse(input.title);
  const bodyLines = Array.isArray(input.lines) ? input.lines : [];
  const lines = uniqueBy([title, ...bodyLines].filter(Boolean), (line) => collapse(line));

  const advertisement = extractLabelledIdentifier(
    lines,
    ADVERTISEMENT_LABELS,
    ADVERTISEMENT_HINDI_LABEL
  );
  // The advertisement line usually also contains a bare "No." — don't read it twice.
  const reference = extractLabelledIdentifier(lines, REFERENCE_LABELS, REFERENCE_HINDI_LABEL, {
    skipLines: new Set(advertisement.line ? [advertisement.line] : [])
  });
  const publication = extractPublicationDate(lines);
  const dates = extractDates(bodyLines);
  const year =
    extractYear(title) ||
    (advertisement.value ? extractYear(advertisement.value) : null) ||
    (publication.iso ? Number(publication.iso.slice(0, 4)) : null) ||
    extractYear(collapse(input.text) || lines.join(" "));

  if (
    reference.value &&
    advertisement.value &&
    reference.value.toLowerCase() === advertisement.value.toLowerCase()
  ) {
    reference.value = null;
    reference.raw = null;
    reference.language = null;
  }

  const issues = [];
  if (advertisement.value && isBrokenIdentifier(advertisement.value)) {
    issues.push({ field: "advertisementNumber", reason: "malformed_identifier", value: advertisement.value });
  }
  if (reference.value && isBrokenIdentifier(reference.value)) {
    issues.push({ field: "referenceNumber", reason: "malformed_identifier", value: reference.value });
  }
  if (publication.iso && Number(publication.iso.slice(0, 4)) > new Date().getUTCFullYear() + 1) {
    issues.push({ field: "publicationDate", reason: "implausible_year", value: publication.iso });
  }

  const identifierScore = round2(
    (advertisement.value ? 0.6 : 0) + (reference.value ? 0.3 : 0) + (publication.iso ? 0.1 : 0)
  );

  return {
    advertisementNumber: advertisement.value,
    advertisementNumberRaw: advertisement.raw,
    advertisementNumberLanguage: advertisement.language,
    referenceNumber: reference.value,
    referenceNumberRaw: reference.raw,
    referenceNumberLanguage: reference.language,
    publicationDate: publication.iso,
    publicationDateRaw: publication.raw,
    publicationDateSource: publication.source,
    dates,
    dateCount: dates.length,
    year,
    identifierScore,
    issues
  };
}

module.exports = {
  ENGLISH_MONTHS,
  HINDI_MONTHS,
  normalizeDigits,
  toIsoDate,
  parseDate,
  cleanIdentifier,
  extractLabelledIdentifier,
  extractDates,
  extractPublicationDate,
  extractYear,
  isBrokenIdentifier,
  extractReferences
};
