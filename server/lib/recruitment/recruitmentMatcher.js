"use strict";

/**
 * Phase 21 — deterministic recruitment identity matcher.
 * Pure library: no DB, no network, no runtime wiring in this phase.
 */

const MATCH_CONFIDENCE_LEVELS = Object.freeze(["high", "medium", "low", "none"]);

const UNKNOWN_MATCH = "unknown";

const RECRUITMENT_MATCH_SIGNALS = Object.freeze({
  ADVERTISEMENT_NUMBER: "ADVERTISEMENT_NUMBER",
  ORGANIZATION: "ORGANIZATION",
  POST: "POST",
  EXAM: "EXAM",
  YEAR: "YEAR"
});

const ORGANIZATION_ALIASES = Object.freeze([
  { canonical: "ssc", patterns: [/\bstaff selection commission\b/, /\bssc\b/] },
  { canonical: "rrb", patterns: [/\brailway recruitment board\b/, /\brrb\b/] },
  {
    canonical: "uppsc",
    patterns: [/\buttar pradesh public service commission\b/, /\buppsc\b/]
  },
  { canonical: "upsc", patterns: [/\bunion public service commission\b/, /\bupsc\b/] },
  { canonical: "ibps", patterns: [/\binstitute of banking personnel selection\b/, /\bibps\b/] },
  { canonical: "bpsc", patterns: [/\bbihar public service commission\b/, /\bbpsc\b/] }
]);

const EXAM_ALIASES = Object.freeze([
  { canonical: "cgl", patterns: [/\bcombined graduate level\b/, /\bcgl\b/] },
  {
    canonical: "chsl",
    patterns: [/\bcombined higher secondary level\b/, /\bchsl\b/, /\bldc\b/, /\budc\b/]
  },
  { canonical: "je", patterns: [/\bjunior engineer\b/, /\bje\b/] },
  { canonical: "gd", patterns: [/\bgeneral duty\b/, /\bgd constable\b/, /\bgd\b/] },
  { canonical: "mts", patterns: [/\bmultitasking staff\b/, /\bmts\b/] },
  { canonical: "ntpc", patterns: [/\bnon technical popular categories\b/, /\bntpc\b/] },
  { canonical: "alp", patterns: [/\bassistant loco pilot\b/, /\balp\b/] },
  { canonical: "group d", patterns: [/\bgroup d\b/, /\brailway group d\b/] }
]);

const TEXT_ABBREVIATION_REPLACEMENTS = [
  [/\badvt\.?\b/g, " advertisement "],
  [/\badvert\.?\b/g, " advertisement "],
  [/\bntf\.?\b/g, " notification "],
  [/\bnotif\.?\b/g, " notification "],
  [/\bno\.?\b/g, " number "]
];

const POST_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "for",
  "of",
  "and",
  "or",
  "to",
  "in",
  "on",
  "post",
  "posts",
  "vacancy",
  "vacancies",
  "recruitment",
  "notification",
  "advertisement",
  "online",
  "form",
  "apply",
  "level",
  "combined",
  "higher",
  "secondary",
  "graduate",
  "junior",
  "engineer",
  "general",
  "duty",
  "staff",
  "selection",
  "commission",
  "railway",
  "board",
  "examination",
  "exam"
]);

const ADVERTISEMENT_LABEL_PATTERNS = [
  /\b(?:advertisement|advt|notification|notice|adv)\.?\s*(?:no|number)\.?\s*[:#-]?\s*/gi,
  /\b(?:advertisement|advt|notification|notice|adv)\.?\s*[:#-]?\s*/gi
];

const ADVERTISEMENT_NUMBER_PATTERN =
  /\b(?:[a-z]{2,10}[-\s])?\d{1,4}\s*(?:[/\\-]|\s+)\s*\d{4}\b/i;

const YEAR_PATTERN = /\b(19\d{2}|20\d{2})\b/;

/**
 * @typedef {Object} RecruitmentMatcherInput
 * @property {string} [title]
 * @property {string} [content]
 * @property {string} [url]
 * @property {string} [organization]
 * @property {string} [board]
 * @property {string} [department]
 * @property {string} [post_name]
 * @property {string} [advertisement_no]
 * @property {number|string} [recruitment_year]
 * @property {number|string} [cycle_year]
 * @property {string} [exam_name]
 */

/**
 * @typedef {Object} RecruitmentIdentity
 * @property {string|null} organization
 * @property {string|null} postName
 * @property {string|null} advertisementNo
 * @property {number|null} recruitmentYear
 * @property {string|null} examName
 * @property {string|null} department
 * @property {string[]} keywords
 * @property {string} normalizedText
 */

/**
 * @typedef {Object} RecruitmentAttributes
 * @property {string|null} organization
 * @property {string|null} postName
 * @property {string|null} advertisementNo
 * @property {number|null} recruitmentYear
 * @property {string|null} examName
 * @property {string|null} department
 * @property {string[]} keywords
 * @property {string} normalizedText
 * @property {Object} sources
 */

/**
 * @typedef {Object} RecruitmentMatchResult
 * @property {boolean|string} match
 * @property {'high'|'medium'|'low'|'none'} confidence
 * @property {string[]} matchedSignals
 * @property {string[]} conflictingSignals
 */

function collapseWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripPunctuationToSpaces(value) {
  return String(value ?? "")
    .replace(/[_/\\|]+/g, " ")
    .replace(/[^\w\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function applyTextAbbreviationExpansions(value) {
  let text = ` ${value} `;
  for (const [pattern, replacement] of TEXT_ABBREVIATION_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  return collapseWhitespace(text);
}

function buildUrlExtractionParts(urlValue) {
  try {
    const parsed = new URL(String(urlValue).trim(), "https://example.com");
    const hostname = parsed.hostname
      .replace(/^www\./i, "")
      .replace(/\./g, " ");
    const path = collapseWhitespace(`${parsed.pathname} ${parsed.search}`);
    return [hostname, path];
  } catch {
    return [collapseWhitespace(String(urlValue))];
  }
}

function buildRawExtractionText(input = {}) {
  const title = collapseWhitespace(input.title);
  const content = collapseWhitespace(input.content);
  const urlParts = input.url ? buildUrlExtractionParts(input.url) : [];
  return collapseWhitespace([title, content, ...urlParts].filter(Boolean).join(" "));
}

function buildNormalizedText(input = {}) {
  const raw = buildRawExtractionText(input);
  const lowered = raw.toLowerCase();
  const depunctuated = stripPunctuationToSpaces(lowered);
  return applyTextAbbreviationExpansions(depunctuated);
}

function normalizeScalarField(value) {
  const text = collapseWhitespace(value);
  if (!text) return null;
  return stripPunctuationToSpaces(text.toLowerCase());
}

function findCanonicalAlias(text, aliases) {
  if (!text) return null;
  const padded = ` ${text} `;
  for (const alias of aliases) {
    for (const pattern of alias.patterns) {
      if (pattern.test(padded)) {
        return alias.canonical;
      }
    }
  }
  return null;
}

function normalizeOrganization(value) {
  const text = normalizeScalarField(value);
  if (!text) return null;
  return findCanonicalAlias(text, ORGANIZATION_ALIASES) ?? text;
}

function normalizeExamName(value) {
  const text = normalizeScalarField(value);
  if (!text) return null;
  return findCanonicalAlias(text, EXAM_ALIASES) ?? text;
}

function normalizePostName(value) {
  const text = normalizeScalarField(value);
  if (!text) return null;
  const examFromPost = findCanonicalAlias(text, EXAM_ALIASES);
  if (examFromPost) return examFromPost;
  return text;
}

function stripAdvertisementLabels(value) {
  let text = String(value ?? "");
  for (const pattern of ADVERTISEMENT_LABEL_PATTERNS) {
    text = text.replace(pattern, " ");
  }
  return collapseWhitespace(text);
}

function canonicalizeAdvertisementNumberCore(value) {
  let text = stripAdvertisementLabels(value).toLowerCase();
  text = text.replace(/[^\w/\\-\s]+/g, " ");
  text = text.replace(/\\/g, "/");
  text = collapseWhitespace(text);

  const slashMatch = text.match(/\b([a-z]{2,10})[-\s]+(\d{1,4})\s*\/\s*(\d{4})\b/);
  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2]}/${slashMatch[3]}`;
  }

  const spacedYearMatch = text.match(/\b([a-z]{2,10})[-\s]+(\d{1,4})\s+(\d{4})\b/);
  if (spacedYearMatch) {
    return `${spacedYearMatch[1]}-${spacedYearMatch[2]}/${spacedYearMatch[3]}`;
  }

  const plainSlashMatch = text.match(/\b(\d{1,4})\s*\/\s*(\d{4})\b/);
  if (plainSlashMatch) {
    return `${plainSlashMatch[1]}/${plainSlashMatch[2]}`;
  }

  const plainSpacedMatch = text.match(/\b(\d{1,4})\s+(\d{4})\b/);
  if (plainSpacedMatch) {
    return `${plainSpacedMatch[1]}/${plainSpacedMatch[2]}`;
  }

  return null;
}

function normalizeAdvertisementNumber(value) {
  const raw = collapseWhitespace(value);
  if (!raw) return null;
  const canonical = canonicalizeAdvertisementNumberCore(raw);
  if (canonical) return canonical;
  // Explicit field values may use short tokens (e.g. AAA-1) without a year slash form.
  const stripped = stripAdvertisementLabels(raw).toLowerCase();
  const cleaned = collapseWhitespace(
    stripped
      .replace(/[^\w/\\-\s]+/g, " ")
      .replace(/\\/g, "/")
      .replace(/\s+/g, "")
  );
  return cleaned || null;
}

function parseRecruitmentYear(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const year = parseInt(String(value), 10);
  if (!Number.isInteger(year) || year < 1900 || year > 9999) {
    return null;
  }
  return year;
}

function extractYearFromText(text) {
  if (!text) return null;
  const matches = [...text.matchAll(new RegExp(YEAR_PATTERN.source, "g"))];
  if (matches.length === 0) return null;
  return parseInt(matches[matches.length - 1][1], 10);
}

function extractAdvertisementNumberFromText(text) {
  if (!text) return null;
  const cleaned = stripAdvertisementLabels(text);
  const match = cleaned.match(ADVERTISEMENT_NUMBER_PATTERN);
  if (!match) return null;
  return canonicalizeAdvertisementNumberCore(match[0]);
}

function extractOrganizationFromText(text) {
  return findCanonicalAlias(text, ORGANIZATION_ALIASES);
}

function extractExamNameFromText(text) {
  return findCanonicalAlias(text, EXAM_ALIASES);
}

function tokenizePostName(postName) {
  if (!postName) return [];
  return postName
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !POST_STOPWORDS.has(token));
}

function postsClearlyDifferent(postA, postB) {
  if (!postA || !postB) return false;
  if (postA === postB) return false;

  const examA = findCanonicalAlias(postA, EXAM_ALIASES);
  const examB = findCanonicalAlias(postB, EXAM_ALIASES);
  if (examA && examB) {
    return examA !== examB;
  }
  if (examA && examB === null && postB.includes(examA)) return false;
  if (examB && examA === null && postA.includes(examB)) return false;

  const tokensA = new Set(tokenizePostName(postA));
  const tokensB = new Set(tokenizePostName(postB));
  if (tokensA.size === 0 || tokensB.size === 0) {
    return postA !== postB;
  }

  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) overlap += 1;
  }

  return overlap === 0;
}

function buildKeywords(identity) {
  const keywords = new Set();
  for (const value of [
    identity.organization,
    identity.postName,
    identity.examName,
    identity.department,
    identity.advertisementNo
  ]) {
    if (value) keywords.add(value);
  }
  if (identity.recruitmentYear) {
    keywords.add(String(identity.recruitmentYear));
  }
  return [...keywords].sort((a, b) => a.localeCompare(b));
}

function pickFieldValue(input, keys) {
  for (const key of keys) {
    const value = input[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return null;
}

function resolveOrganization(input, normalizedText, rawExtractionText = normalizedText) {
  const raw = pickFieldValue(input, ["organization", "board", "department"]);
  if (raw) {
    return { value: normalizeOrganization(raw), source: "field" };
  }
  const extracted =
    extractOrganizationFromText(rawExtractionText) || extractOrganizationFromText(normalizedText);
  if (extracted) {
    return { value: extracted, source: "extracted" };
  }
  return { value: null, source: null };
}

function resolveExamName(input, normalizedText) {
  const raw = pickFieldValue(input, ["exam_name", "examName"]);
  if (raw) {
    return { value: normalizeExamName(raw), source: "field" };
  }
  const extracted = extractExamNameFromText(normalizedText);
  if (extracted) {
    return { value: extracted, source: "extracted" };
  }
  return { value: null, source: null };
}

function resolvePostName(input, normalizedText) {
  const raw = pickFieldValue(input, ["post_name", "postName"]);
  if (raw) {
    return { value: normalizePostName(raw), source: "field" };
  }
  return { value: null, source: null };
}

function resolveAdvertisementNumber(input, normalizedText) {
  const raw = pickFieldValue(input, ["advertisement_no", "advertisementNo"]);
  if (raw) {
    return { value: normalizeAdvertisementNumber(raw), source: "field" };
  }
  const extracted = extractAdvertisementNumberFromText(normalizedText);
  if (extracted) {
    return { value: extracted, source: "extracted" };
  }
  return { value: null, source: null };
}

function resolveRecruitmentYear(input, normalizedText) {
  const rawYear = pickFieldValue(input, [
    "recruitment_year",
    "cycle_year",
    "recruitmentYear",
    "cycleYear"
  ]);
  if (rawYear) {
    return { value: parseRecruitmentYear(rawYear), source: "field" };
  }
  const extracted = extractYearFromText(normalizedText);
  if (extracted) {
    return { value: extracted, source: "extracted" };
  }
  return { value: null, source: null };
}

function resolveDepartment(input) {
  const raw = pickFieldValue(input, ["department"]);
  if (!raw) return { value: null, source: null };
  return { value: normalizeScalarField(raw), source: "field" };
}

/**
 * @param {RecruitmentMatcherInput} input
 * @returns {RecruitmentAttributes}
 */
function extractRecruitmentAttributes(input = {}) {
  const rawExtractionText = buildRawExtractionText(input);
  const normalizedText = buildNormalizedText(input);
  const organization = resolveOrganization(input, normalizedText, rawExtractionText);
  const examName = resolveExamName(input, normalizedText);
  const postName = resolvePostName(input, normalizedText);
  const advertisementNo = resolveAdvertisementNumber(input, rawExtractionText);
  const recruitmentYear = resolveRecruitmentYear(input, normalizedText);
  const department = resolveDepartment(input);

  const identity = {
    organization: organization.value,
    postName: postName.value,
    advertisementNo: advertisementNo.value,
    recruitmentYear: recruitmentYear.value,
    examName: examName.value,
    department: department.value,
    keywords: [],
    normalizedText
  };
  identity.keywords = buildKeywords(identity);

  return {
    ...identity,
    sources: {
      organization: organization.source,
      postName: postName.source,
      advertisementNo: advertisementNo.source,
      recruitmentYear: recruitmentYear.source,
      examName: examName.source,
      department: department.source
    }
  };
}

/**
 * @param {RecruitmentMatcherInput} input
 * @returns {RecruitmentIdentity}
 */
function normalizeRecruitmentIdentity(input = {}) {
  const attributes = extractRecruitmentAttributes(input);
  return {
    organization: attributes.organization,
    postName: attributes.postName,
    advertisementNo: attributes.advertisementNo,
    recruitmentYear: attributes.recruitmentYear,
    examName: attributes.examName,
    department: attributes.department,
    keywords: attributes.keywords,
    normalizedText: attributes.normalizedText
  };
}

function finalizeMatchResult(match, confidence, matchedSignals, conflictingSignals) {
  return {
    match,
    confidence,
    matchedSignals: [...new Set(matchedSignals)].sort(),
    conflictingSignals: [...new Set(conflictingSignals)].sort()
  };
}

function comparableExamName(identity) {
  if (identity.examName) return identity.examName;
  if (identity.postName && findCanonicalAlias(identity.postName, EXAM_ALIASES)) {
    return identity.postName;
  }
  return null;
}

function comparablePostName(identity) {
  if (identity.postName) return identity.postName;
  if (identity.examName && findCanonicalAlias(identity.examName, EXAM_ALIASES)) {
    return identity.examName;
  }
  return null;
}

function collectAlignedSignals(identityA, identityB) {
  const matchedSignals = [];

  if (
    identityA.organization &&
    identityB.organization &&
    identityA.organization === identityB.organization
  ) {
    matchedSignals.push(RECRUITMENT_MATCH_SIGNALS.ORGANIZATION);
  }

  const examA = comparableExamName(identityA);
  const examB = comparableExamName(identityB);
  if (examA && examB && examA === examB) {
    matchedSignals.push(RECRUITMENT_MATCH_SIGNALS.EXAM);
  }

  const postA = comparablePostName(identityA);
  const postB = comparablePostName(identityB);
  if (postA && postB && !postsClearlyDifferent(postA, postB)) {
    matchedSignals.push(RECRUITMENT_MATCH_SIGNALS.POST);
  }
  if (
    identityA.recruitmentYear &&
    identityB.recruitmentYear &&
    identityA.recruitmentYear === identityB.recruitmentYear
  ) {
    matchedSignals.push(RECRUITMENT_MATCH_SIGNALS.YEAR);
  }

  return matchedSignals;
}

/**
 * @param {RecruitmentMatcherInput} a
 * @param {RecruitmentMatcherInput} b
 * @returns {RecruitmentMatchResult}
 */
function isSameRecruitment(a = {}, b = {}) {
  const identityA = normalizeRecruitmentIdentity(a);
  const identityB = normalizeRecruitmentIdentity(b);
  const matchedSignals = [];
  const conflictingSignals = [];

  if (identityA.advertisementNo && identityB.advertisementNo) {
    if (identityA.advertisementNo === identityB.advertisementNo) {
      matchedSignals.push(RECRUITMENT_MATCH_SIGNALS.ADVERTISEMENT_NUMBER);
      matchedSignals.push(...collectAlignedSignals(identityA, identityB));
      return finalizeMatchResult(true, "high", matchedSignals, conflictingSignals);
    }
    conflictingSignals.push(RECRUITMENT_MATCH_SIGNALS.ADVERTISEMENT_NUMBER);
    return finalizeMatchResult(false, "high", matchedSignals, conflictingSignals);
  }

  if (
    identityA.recruitmentYear &&
    identityB.recruitmentYear &&
    identityA.recruitmentYear !== identityB.recruitmentYear
  ) {
    conflictingSignals.push(RECRUITMENT_MATCH_SIGNALS.YEAR);
    return finalizeMatchResult(false, "high", matchedSignals, conflictingSignals);
  }

  const examA = comparableExamName(identityA);
  const examB = comparableExamName(identityB);
  if (examA && examB && examA !== examB) {
    conflictingSignals.push(RECRUITMENT_MATCH_SIGNALS.EXAM);
    return finalizeMatchResult(false, "high", matchedSignals, conflictingSignals);
  }

  const postA = comparablePostName(identityA);
  const postB = comparablePostName(identityB);
  if (postA && postB && postsClearlyDifferent(postA, postB)) {
    conflictingSignals.push(RECRUITMENT_MATCH_SIGNALS.POST);
    return finalizeMatchResult(false, "high", matchedSignals, conflictingSignals);
  }

  const alignedSignals = collectAlignedSignals(identityA, identityB);
  matchedSignals.push(...alignedSignals);

  const hasOrganization = matchedSignals.includes(RECRUITMENT_MATCH_SIGNALS.ORGANIZATION);
  const hasExam = matchedSignals.includes(RECRUITMENT_MATCH_SIGNALS.EXAM);
  const hasPost = matchedSignals.includes(RECRUITMENT_MATCH_SIGNALS.POST);
  const hasYear = matchedSignals.includes(RECRUITMENT_MATCH_SIGNALS.YEAR);

  if (hasOrganization && hasExam && hasYear) {
    return finalizeMatchResult(true, "high", matchedSignals, conflictingSignals);
  }

  if (hasOrganization && hasPost && hasYear) {
    return finalizeMatchResult(true, "high", matchedSignals, conflictingSignals);
  }

  if (hasOrganization && hasExam) {
    return finalizeMatchResult(true, "medium", matchedSignals, conflictingSignals);
  }

  if (hasOrganization && hasPost) {
    return finalizeMatchResult(true, "medium", matchedSignals, conflictingSignals);
  }

  return finalizeMatchResult(UNKNOWN_MATCH, "none", matchedSignals, conflictingSignals);
}

module.exports = {
  MATCH_CONFIDENCE_LEVELS,
  UNKNOWN_MATCH,
  RECRUITMENT_MATCH_SIGNALS,
  normalizeRecruitmentIdentity,
  extractRecruitmentAttributes,
  isSameRecruitment
};
