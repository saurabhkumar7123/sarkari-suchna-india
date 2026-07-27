"use strict";

/**
 * Phase AI-3 — Matching primitives.
 *
 * Deterministic text and identifier comparison helpers. Everything here is
 * pure: the same two inputs always produce the same score, which is what makes
 * a recommendation explainable and reproducible.
 *
 * Text normalization is reused from Phase AI-2 so both phases compare notices
 * the same way.
 */

const {
  clamp,
  collapse,
  round2,
  toKey,
  toText,
  uniqueBy
} = require("../noticeIntelligence/textUtils");
const { normalizeIdentifier } = require("../noticeIntelligence/fingerprint");
const { FACTOR_STATUS } = require("./types");

/**
 * Devanagari renderings of the Latin letters and digits that appear in Indian
 * advertisement numbers. A Hindi notice prints the same advertisement as
 * "ए-2/ई-1/2025" that an English record stores as "A-2/E-1/2025", so the two
 * have to fold onto one key before they can be compared.
 *
 * Longer sequences are listed first because they must be replaced first.
 */
const DEVANAGARI_IDENTIFIER_MAP = Object.freeze([
  ["एच", "h"],
  ["एस", "s"],
  ["एम", "m"],
  ["एन", "n"],
  ["एल", "l"],
  ["एफ", "f"],
  ["एक्स", "x"],
  ["आर", "r"],
  ["बी", "b"],
  ["सी", "c"],
  ["डी", "d"],
  ["जी", "g"],
  ["जे", "j"],
  ["के", "k"],
  ["पी", "p"],
  ["क्यू", "q"],
  ["टी", "t"],
  ["यू", "u"],
  ["वी", "v"],
  ["डब्ल्यू", "w"],
  ["वाई", "y"],
  ["जेड", "z"],
  ["ई", "e"],
  ["ए", "a"],
  ["ओ", "o"],
  ["०", "0"],
  ["१", "1"],
  ["२", "2"],
  ["३", "3"],
  ["४", "4"],
  ["५", "5"],
  ["६", "6"],
  ["७", "7"],
  ["८", "8"],
  ["९", "9"]
]);

/**
 * Fold Devanagari identifier characters onto their Latin equivalents, then
 * normalize with the shared Phase AI-2 identifier rules.
 *
 * @param {*} value
 * @returns {string}
 */
function foldIdentifier(value) {
  let text = toText(value);
  if (!text) return "";
  for (const [devanagari, latin] of DEVANAGARI_IDENTIFIER_MAP) {
    if (text.includes(devanagari)) text = text.split(devanagari).join(latin);
  }
  return normalizeIdentifier(text);
}

/**
 * Words that describe the *document* rather than the *recruitment*. They are
 * removed before comparing titles, so "UPPSC Upper Subordinate 2026 Admit Card"
 * still matches the recruitment "UPPSC Upper Subordinate Services Exam 2026".
 */
const LIFECYCLE_STOPWORDS = new Set([
  "notice",
  "notification",
  "notifications",
  "advertisement",
  "advt",
  "advertisment",
  "detailed",
  "short",
  "recruitment",
  "recruitments",
  "vacancy",
  "vacancies",
  "post",
  "posts",
  "online",
  "offline",
  "apply",
  "application",
  "applications",
  "form",
  "forms",
  "registration",
  "register",
  "exam",
  "examination",
  "test",
  "admit",
  "card",
  "hall",
  "ticket",
  "result",
  "results",
  "final",
  "answer",
  "key",
  "objection",
  "correction",
  "corrigendum",
  "addendum",
  "amendment",
  "revised",
  "extension",
  "extended",
  "extend",
  "date",
  "dates",
  "last",
  "city",
  "centre",
  "center",
  "intimation",
  "schedule",
  "declared",
  "released",
  "release",
  "published",
  "publication",
  "download",
  "link",
  "links",
  "document",
  "verification",
  "joining",
  "letter",
  "counselling",
  "counseling",
  "interview",
  "merit",
  "list",
  "cutoff",
  "cut",
  "off",
  "provisional",
  "important",
  "update",
  "updates",
  "new",
  "latest",
  "official",
  "govt",
  "government",
  "for",
  "the",
  "and",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
  "a",
  "an",
  "no",
  "number",
  "regarding",
  "against",
  "under",
  "from",
  "with"
]);

/**
 * Hindi surface forms folded onto the English token a recruitment record is
 * most likely to be titled with. This is what lets a Devanagari notice match an
 * English recruitment name without transliteration.
 */
const TOKEN_ALIASES = Object.freeze({
  // Lifecycle vocabulary (folded, then dropped as stopwords).
  "भर्ती": "recruitment",
  "विज्ञापन": "advertisement",
  "अधिसूचना": "notification",
  "सूचना": "notice",
  "परिणाम": "result",
  "परिणाम्": "result",
  "अंतिम": "final",
  "प्रवेश": "admit",
  "पत्र": "card",
  "प्रवेशपत्र": "admit",
  "कुंजी": "key",
  "संशोधन": "correction",
  "शुद्धिपत्र": "corrigendum",
  "विस्तार": "extension",
  "तिथि": "date",
  "तिथियाँ": "date",
  "तारीख": "date",
  "परीक्षा": "exam",
  "आवेदन": "application",
  "ऑनलाइन": "online",
  "नियुक्ति": "joining",
  "साक्षात्कार": "interview",
  "सत्यापन": "verification",
  "दस्तावेज": "document",
  "पद": "post",
  "रिक्ति": "vacancy",
  // Distinctive recruitment vocabulary that must survive folding.
  // "उत्तर" is left as "uttar": it means "north" far more often than "answer"
  // in recruitment titles, and answer-key detection keys on "कुंजी" instead.
  "उत्तर": "uttar",
  "आयोग": "commission",
  "लोक": "public",
  "सेवा": "service",
  "सेवाएं": "services",
  "सम्मिलित": "combined",
  "संयुक्त": "combined",
  "राज्य": "state",
  "उच्च": "upper",
  "अधीनस्थ": "subordinate",
  "पुलिस": "police",
  "आरक्षी": "constable",
  "उपनिरीक्षक": "sub-inspector",
  "शिक्षक": "teacher",
  "अध्यापक": "teacher",
  "लिपिक": "clerk",
  "समीक्षा": "review",
  "अधिकारी": "officer",
  "सहायक": "assistant",
  "कनिष्ठ": "junior",
  "वरिष्ठ": "senior",
  "स्वास्थ्य": "health",
  "रेलवे": "railway",
  "बोर्ड": "board",
  "विभाग": "department",
  "प्रदेश": "pradesh",
  "उत्तर-प्रदेश": "uttar",
  "बिहार": "bihar",
  "तकनीशियन": "technician",
  "प्रशिक्षु": "apprentice",
  // English variants folded onto one canonical form.
  examination: "exam",
  exams: "exam",
  services: "service",
  officers: "officer",
  posts: "post",
  advt: "advertisement",
  advertisment: "advertisement",
  notifications: "notification",
  constables: "constable",
  teachers: "teacher",
  "sub-inspector": "sub-inspector",
  si: "sub-inspector",
  asi: "assistant-sub-inspector"
});

/**
 * Tokens so common across boards and posts that sharing one proves nothing.
 * They still contribute to overlap scores; they just cannot pull a candidate
 * into the search on their own.
 */
const COMMON_TOKENS = new Set([
  "service",
  "commission",
  "board",
  "department",
  "public",
  "state",
  "india",
  "national",
  "central",
  "office",
  "staff",
  "selection",
  "council",
  "authority",
  "corporation",
  "assistant",
  "junior",
  "senior",
  "deputy",
  "additional",
  "general",
  "grade",
  "group",
  "class",
  "level"
]);

const YEAR_PATTERN = /\b(19|20)\d{2}\b/;
const YEAR_TOKEN = /^(19|20)\d{2}$/;

/**
 * Lowercased key that strips punctuation but keeps combining marks.
 *
 * Phase AI-2's `toComparableKey` drops Unicode marks, which is correct for
 * fingerprinting Latin text but destroys Devanagari: "प्रदेश" loses its matras
 * and virama and becomes "प र द श". Matching needs the intact word so it can be
 * looked up in the bilingual alias table.
 *
 * @param {*} value
 * @returns {string}
 */
function toMatchKey(value) {
  return toKey(value)
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fold a raw token onto its canonical comparison form.
 * @param {string} token
 * @returns {string}
 */
function foldToken(token) {
  const key = toText(token).toLowerCase().trim();
  if (!key) return "";
  return TOKEN_ALIASES[key] || key;
}

/**
 * Split text into folded comparison tokens.
 * @param {*} value
 * @returns {string[]}
 */
function tokenize(value) {
  const text = toMatchKey(value);
  if (!text) return [];
  return text
    .split(/\s+/)
    .map(foldToken)
    .filter((token) => token.length > 1 || /\d/.test(token));
}

/**
 * Tokens that identify the recruitment itself: lifecycle vocabulary, years and
 * one-character noise removed.
 * @param {*} value
 * @returns {string[]}
 */
function coreTokens(value) {
  return uniqueBy(
    tokenize(value).filter((token) => !LIFECYCLE_STOPWORDS.has(token) && !YEAR_TOKEN.test(token)),
    (token) => token
  );
}

/**
 * Core tokens that are not generic across every government body.
 * @param {string[]} tokens
 * @returns {string[]}
 */
function distinctiveTokens(tokens) {
  return (tokens || []).filter((token) => !COMMON_TOKENS.has(token));
}

/**
 * @param {string[]} a
 * @param {string[]} b
 * @returns {number} intersection over union, 0–1
 */
function jaccard(a, b) {
  const setA = new Set(a || []);
  const setB = new Set(b || []);
  if (!setA.size || !setB.size) return 0;
  let shared = 0;
  for (const token of setA) if (setB.has(token)) shared += 1;
  const union = setA.size + setB.size - shared;
  return union ? shared / union : 0;
}

/**
 * Fraction of the smaller token set that the larger one contains. Keeps a short
 * recruitment name comparable to a long notice title.
 * @param {string[]} a
 * @param {string[]} b
 * @returns {number}
 */
function containment(a, b) {
  const setA = new Set(a || []);
  const setB = new Set(b || []);
  if (!setA.size || !setB.size) return 0;
  let shared = 0;
  for (const token of setA) if (setB.has(token)) shared += 1;
  return shared / Math.min(setA.size, setB.size);
}

/**
 * @param {string[]} tokens
 * @returns {string[]} adjacent token pairs
 */
function bigrams(tokens) {
  const list = tokens || [];
  const out = [];
  for (let i = 0; i < list.length - 1; i += 1) out.push(`${list[i]} ${list[i + 1]}`);
  return out;
}

/**
 * Word-order agreement, so "review officer assistant" and "assistant review
 * officer" do not score as identical.
 * @param {string[]} a
 * @param {string[]} b
 * @returns {number}
 */
function bigramOverlap(a, b) {
  const ba = bigrams(a);
  const bb = bigrams(b);
  if (!ba.length || !bb.length) return 0;
  return containment(ba, bb);
}

/**
 * Compare two recruitment titles.
 *
 * @param {*} left
 * @param {*} right
 * @returns {{
 *   score: number,
 *   comparable: boolean,
 *   sharedTokens: string[],
 *   sharedDistinctiveTokens: string[],
 *   leftOnly: string[],
 *   rightOnly: string[],
 *   jaccard: number,
 *   containment: number,
 *   bigramOverlap: number
 * }}
 */
function titleSimilarity(left, right) {
  const a = coreTokens(left);
  const b = coreTokens(right);
  const empty = {
    score: 0,
    comparable: false,
    sharedTokens: [],
    sharedDistinctiveTokens: [],
    leftOnly: a,
    rightOnly: b,
    jaccard: 0,
    containment: 0,
    bigramOverlap: 0
  };
  if (!a.length || !b.length) return empty;

  const setB = new Set(b);
  const setA = new Set(a);
  const shared = a.filter((token) => setB.has(token));
  const jac = jaccard(a, b);
  const cont = containment(a, b);
  const bg = bigramOverlap(a, b);
  const score = round2(clamp(0.45 * jac + 0.35 * cont + 0.2 * bg));

  return {
    score,
    comparable: true,
    sharedTokens: shared,
    sharedDistinctiveTokens: distinctiveTokens(shared),
    leftOnly: a.filter((token) => !setB.has(token)),
    rightOnly: b.filter((token) => !setA.has(token)),
    jaccard: round2(jac),
    containment: round2(cont),
    bigramOverlap: round2(bg)
  };
}

/**
 * Compare two keyword lists.
 * @param {string[]} left
 * @param {string[]} right
 * @returns {{ score: number, comparable: boolean, shared: string[] }}
 */
function keywordSimilarity(left, right) {
  const a = (left || []).map((value) => toMatchKey(value)).filter(Boolean);
  const b = (right || []).map((value) => toMatchKey(value)).filter(Boolean);
  if (!a.length || !b.length) return { score: 0, comparable: false, shared: [] };
  const setB = new Set(b);
  const shared = uniqueBy(
    a.filter((keyword) => setB.has(keyword)),
    (keyword) => keyword
  );
  // Containment rather than Jaccard: a recruitment record usually stores fewer
  // keywords than a full notice yields.
  return {
    score: round2(containment(a, b)),
    comparable: true,
    shared
  };
}

/**
 * Compare two official identifiers.
 *
 * @param {*} left
 * @param {*} right
 * @returns {{ status: string, left: string, right: string, comparable: boolean }}
 */
function compareIdentifiers(left, right) {
  const a = foldIdentifier(left);
  const b = foldIdentifier(right);
  if (!a || !b) {
    return { status: FACTOR_STATUS.NOT_COMPARABLE, left: a, right: b, comparable: false };
  }
  if (a === b) return { status: FACTOR_STATUS.MATCH, left: a, right: b, comparable: true };
  // A notice often reprints the number with a part or volume suffix.
  if (a.startsWith(b) || b.startsWith(a)) {
    return { status: FACTOR_STATUS.PARTIAL, left: a, right: b, comparable: true };
  }
  return { status: FACTOR_STATUS.MISMATCH, left: a, right: b, comparable: true };
}

/**
 * Compare two organization names by comparable key, then by token containment
 * so "UPPSC" and "Uttar Pradesh Public Service Commission" can still relate
 * when a code is available on one side only.
 *
 * @param {{ code?: string, name?: string }} left
 * @param {{ code?: string, name?: string }} right
 * @returns {{ status: string, comparable: boolean, matchedOn: string|null }}
 */
function compareOrganizations(left = {}, right = {}) {
  const leftCode = toMatchKey(left.code);
  const rightCode = toMatchKey(right.code);
  if (leftCode && rightCode) {
    return {
      status: leftCode === rightCode ? FACTOR_STATUS.MATCH : FACTOR_STATUS.MISMATCH,
      comparable: true,
      matchedOn: "code"
    };
  }

  const leftName = toMatchKey(left.name);
  const rightName = toMatchKey(right.name);
  if (!leftName || !rightName) {
    return { status: FACTOR_STATUS.NOT_COMPARABLE, comparable: false, matchedOn: null };
  }
  if (leftName === rightName) {
    return { status: FACTOR_STATUS.MATCH, comparable: true, matchedOn: "name" };
  }

  const leftCore = coreTokens(leftName);
  const rightCore = coreTokens(rightName);
  const leftDistinctive = distinctiveTokens(leftCore);
  const rightDistinctive = distinctiveTokens(rightCore);

  // The identifying part of a government body's name is the part that is not
  // shared by every commission and board. "Jharkhand Staff Selection
  // Commission" and "Staff Selection Commission" agree on everything generic
  // and disagree on the only word that matters.
  if (leftDistinctive.length && rightDistinctive.length) {
    const overlap = containment(leftDistinctive, rightDistinctive);
    const agreement = jaccard(leftDistinctive, rightDistinctive);
    if (overlap >= 0.8 && agreement >= 0.5) {
      return { status: FACTOR_STATUS.MATCH, comparable: true, matchedOn: "distinctive_tokens" };
    }
    if (overlap >= 0.5) {
      return { status: FACTOR_STATUS.PARTIAL, comparable: true, matchedOn: "distinctive_tokens" };
    }
    return { status: FACTOR_STATUS.MISMATCH, comparable: true, matchedOn: "distinctive_tokens" };
  }

  // One side is generic throughout, so identity can be suggested but never
  // confirmed on prose alone.
  const overlap = containment(leftCore, rightCore);
  if (overlap >= 0.8) {
    return { status: FACTOR_STATUS.PARTIAL, comparable: true, matchedOn: "generic_tokens" };
  }
  return { status: FACTOR_STATUS.MISMATCH, comparable: true, matchedOn: "generic_tokens" };
}

/**
 * Read a four-digit recruitment year out of a value or a title.
 * @param {*} value
 * @returns {number|null}
 */
function extractYear(value) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 1900 && numeric <= 2100) return numeric;
  const match = toText(value).match(YEAR_PATTERN);
  return match ? Number(match[0]) : null;
}

/**
 * A title is ambiguous when it carries no distinctive recruitment vocabulary —
 * matching on it alone would be guesswork.
 *
 * @param {*} title
 * @returns {{ ambiguous: boolean, reason: string|null, coreTokens: string[], distinctive: string[] }}
 */
function assessTitleAmbiguity(title) {
  const text = collapse(title);
  const core = coreTokens(text);
  const distinctive = distinctiveTokens(core);
  if (!text) {
    return { ambiguous: true, reason: "no_title", coreTokens: core, distinctive };
  }
  if (core.length < 2) {
    return { ambiguous: true, reason: "too_few_core_tokens", coreTokens: core, distinctive };
  }
  if (!distinctive.length) {
    return { ambiguous: true, reason: "only_generic_tokens", coreTokens: core, distinctive };
  }
  return { ambiguous: false, reason: null, coreTokens: core, distinctive };
}

module.exports = {
  LIFECYCLE_STOPWORDS,
  TOKEN_ALIASES,
  COMMON_TOKENS,
  DEVANAGARI_IDENTIFIER_MAP,
  foldIdentifier,
  toMatchKey,
  foldToken,
  tokenize,
  coreTokens,
  distinctiveTokens,
  jaccard,
  containment,
  bigrams,
  bigramOverlap,
  titleSimilarity,
  keywordSimilarity,
  compareIdentifiers,
  compareOrganizations,
  extractYear,
  assessTitleAmbiguity,
  normalizeIdentifier
};
