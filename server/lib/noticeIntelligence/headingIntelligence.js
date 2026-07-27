"use strict";

/**
 * Phase AI-2 — Heading intelligence.
 *
 * Detects headings from HTML and PDF/text notices in English, Hindi and mixed
 * Hindi-English, repairs headings broken across lines, understands numbered and
 * nested headings, and normalizes everything into canonical section names.
 * Unknown headings are preserved rather than dropped.
 */

const { SECTION_HEADING_MAP } = require("../generatorIntelligence/types");
const {
  CANONICAL_SECTIONS,
  CANONICAL_SECTION_LABELS,
  AI1_SECTION_TYPE_TO_CANONICAL
} = require("./types");
const { collapse, detectLanguage, round2, toKey, toText, uniqueBy } = require("./textUtils");

const MAX_HEADING_LENGTH = 90;

/**
 * Devanagari is expressed as a script property escape rather than a code point
 * range so composed patterns stay valid for matras and other combining marks.
 */
const DEVANAGARI = "\\p{Script=Devanagari}";
const LETTER_CLASS = `[A-Za-z${DEVANAGARI}]`;

/** Canonical section → recognised heading spellings (English + Hindi). */
const SECTION_ALIASES = Object.freeze({
  [CANONICAL_SECTIONS.NOTICE_HEADER]: [
    "notice",
    "public notice",
    "important notice",
    "general notice",
    "notice board",
    "सूचना",
    "महत्वपूर्ण सूचना",
    "सार्वजनिक सूचना",
    "विज्ञप्ति"
  ],
  [CANONICAL_SECTIONS.SHORT_INFORMATION]: [
    "short information",
    "short info",
    "brief information",
    "introduction",
    "overview",
    "about the post",
    "about the recruitment",
    "संक्षिप्त विवरण",
    "परिचय"
  ],
  [CANONICAL_SECTIONS.IMPORTANT_DATES]: [
    "important dates",
    "important date",
    "key dates",
    "schedule",
    "time schedule",
    "tentative schedule",
    "exam schedule",
    "examination schedule",
    "important schedule",
    "महत्वपूर्ण तिथियाँ",
    "महत्वपूर्ण तिथियां",
    "महत्वपूर्ण तिथि",
    "महत्वपूर्ण दिनांक",
    "आवेदन तिथि",
    "समय सारणी",
    "कार्यक्रम"
  ],
  [CANONICAL_SECTIONS.APPLICATION_FEE]: [
    "application fee",
    "application fees",
    "examination fee",
    "exam fee",
    "registration fee",
    "fee details",
    "fee",
    "शुल्क",
    "आवेदन शुल्क",
    "परीक्षा शुल्क"
  ],
  [CANONICAL_SECTIONS.AGE_LIMIT]: [
    "age limit",
    "age criteria",
    "age relaxation",
    "age limit and relaxation",
    "आयु",
    "आयु सीमा",
    "आयु में छूट"
  ],
  [CANONICAL_SECTIONS.VACANCY_DETAILS]: [
    "vacancy details",
    "vacancy",
    "vacancies",
    "number of posts",
    "no of posts",
    "post details",
    "post wise vacancy",
    "category wise vacancy",
    "distribution of posts",
    "रिक्ति",
    "रिक्तियां",
    "रिक्तियाँ",
    "पद विवरण",
    "पदों का विवरण",
    "पदों की संख्या"
  ],
  [CANONICAL_SECTIONS.RESERVATION]: [
    "reservation",
    "reservation details",
    "category wise reservation",
    "horizontal reservation",
    "आरक्षण",
    "आरक्षण विवरण"
  ],
  [CANONICAL_SECTIONS.ELIGIBILITY]: [
    "eligibility",
    "eligibility criteria",
    "eligibility conditions",
    "who can apply",
    "पात्रता",
    "पात्रता मानदंड",
    "अर्हता"
  ],
  [CANONICAL_SECTIONS.QUALIFICATION]: [
    "qualification",
    "qualifications",
    "educational qualification",
    "essential qualification",
    "desirable qualification",
    "academic qualification",
    "शैक्षणिक योग्यता",
    "शैक्षिक योग्यता",
    "योग्यता"
  ],
  [CANONICAL_SECTIONS.SELECTION_PROCESS]: [
    "selection process",
    "selection procedure",
    "mode of selection",
    "method of selection",
    "stages of selection",
    "चयन प्रक्रिया",
    "चयन प्रणाली"
  ],
  [CANONICAL_SECTIONS.EXAM_PATTERN]: [
    "exam pattern",
    "examination pattern",
    "scheme of examination",
    "scheme of exam",
    "pattern of examination",
    "परीक्षा पैटर्न",
    "परीक्षा योजना",
    "परीक्षा प्रारूप"
  ],
  [CANONICAL_SECTIONS.EXAM_CENTRE]: [
    "exam centre",
    "exam center",
    "examination centre",
    "examination center",
    "exam city",
    "examination city",
    "test city",
    "centre of examination",
    "city intimation",
    "परीक्षा केंद्र",
    "परीक्षा केन्द्र",
    "परीक्षा शहर"
  ],
  [CANONICAL_SECTIONS.SYLLABUS]: ["syllabus", "course content", "detailed syllabus", "पाठ्यक्रम"],
  [CANONICAL_SECTIONS.HOW_TO_APPLY]: [
    "how to apply",
    "how to apply online",
    "application procedure",
    "procedure to apply",
    "steps to apply",
    "mode of application",
    "आवेदन कैसे करें",
    "आवेदन प्रक्रिया",
    "आवेदन करने की प्रक्रिया"
  ],
  [CANONICAL_SECTIONS.SALARY]: [
    "salary",
    "pay",
    "pay scale",
    "pay matrix",
    "pay level",
    "remuneration",
    "emoluments",
    "वेतन",
    "वेतनमान",
    "पारिश्रमिक"
  ],
  [CANONICAL_SECTIONS.IMPORTANT_LINKS]: [
    "important links",
    "useful links",
    "links",
    "related links",
    "महत्वपूर्ण लिंक",
    "उपयोगी लिंक"
  ],
  [CANONICAL_SECTIONS.DOWNLOADS]: [
    "downloads",
    "download",
    "attachments",
    "enclosures",
    "डाउनलोड",
    "संलग्नक"
  ],
  [CANONICAL_SECTIONS.INSTRUCTIONS]: [
    "instructions",
    "important instructions",
    "general instructions",
    "instructions to candidates",
    "निर्देश",
    "महत्वपूर्ण निर्देश",
    "सामान्य निर्देश"
  ],
  [CANONICAL_SECTIONS.GENERAL_CONDITIONS]: [
    "general conditions",
    "terms and conditions",
    "conditions",
    "other conditions",
    "सामान्य शर्तें",
    "शर्तें",
    "अन्य शर्तें"
  ],
  [CANONICAL_SECTIONS.CONTACT]: [
    "contact",
    "contact us",
    "contact details",
    "helpline",
    "help line",
    "help desk",
    "grievance",
    "query",
    "संपर्क",
    "संपर्क सूत्र",
    "हेल्पलाइन"
  ],
  [CANONICAL_SECTIONS.FAQ]: [
    "faq",
    "faqs",
    "frequently asked questions",
    "important questions",
    "अक्सर पूछे जाने वाले प्रश्न"
  ],
  [CANONICAL_SECTIONS.ANNEXURE]: [
    "annexure",
    "appendix",
    "enclosure",
    "परिशिष्ट",
    "अनुलग्नक"
  ],
  [CANONICAL_SECTIONS.CORRIGENDUM_DETAILS]: [
    "corrigendum",
    "corrigendum details",
    "addendum",
    "amendment",
    "corrections",
    "शुद्धि पत्र",
    "शुद्धिपत्र",
    "संशोधन"
  ],
  [CANONICAL_SECTIONS.RESULT_DETAILS]: [
    "result",
    "results",
    "result details",
    "merit list",
    "select list",
    "cut off",
    "cut-off marks",
    "परिणाम",
    "परिणाम विवरण",
    "मेरिट सूची",
    "कट ऑफ"
  ],
  [CANONICAL_SECTIONS.ADMIT_CARD_DETAILS]: [
    "admit card",
    "admit cards",
    "hall ticket",
    "call letter",
    "e-admit card",
    "प्रवेश पत्र",
    "एडमिट कार्ड"
  ],
  [CANONICAL_SECTIONS.ANSWER_KEY_DETAILS]: [
    "answer key",
    "answer keys",
    "final answer key",
    "provisional answer key",
    "उत्तर कुंजी",
    "आदर्श उत्तर"
  ],
  [CANONICAL_SECTIONS.COUNSELLING]: [
    "counselling",
    "counseling",
    "document verification",
    "dv schedule",
    "document verification schedule",
    "काउंसलिंग",
    "दस्तावेज़ सत्यापन",
    "दस्तावेज सत्यापन"
  ]
});

const ALIAS_LOOKUP = (() => {
  const map = new Map();
  for (const [section, aliases] of Object.entries(SECTION_ALIASES)) {
    for (const alias of aliases) {
      const key = toKey(alias);
      if (key && !map.has(key)) map.set(key, section);
    }
  }
  return map;
})();

/** Longest-first so "final answer key" wins over "answer key" when embedded. */
const ALIAS_KEYS_BY_LENGTH = Array.from(ALIAS_LOOKUP.keys()).sort((a, b) => b.length - a.length);

/**
 * Numbering prefixes, most specific first. A multi-level number ("3.1") is
 * self-evidently a numbering prefix, so its trailing separator is optional; a
 * bare number needs one, otherwise "2026 Recruitment" would look numbered.
 */
const NUMBERING_PATTERNS = Object.freeze([
  /^\s*\(?\s*(\d+(?:\.\d+)+)\s*\)?\s*[.):\-–—]?\s+/,
  /^\s*\(?\s*(\d{1,3})\s*\)?\s*[.):\-–—]\s+/,
  /^\s*\(?\s*([०-९]+(?:\.[०-९]+)*)\s*\)?\s*[.):\-–—]?\s+/,
  /^\s*\(\s*([ivxlcdm]{1,7})\s*\)\s*[.:\-–—]?\s+/i,
  /^\s*([ivxlcdm]{1,7})\s*[.)]\s+/i,
  /^\s*\(\s*([a-z])\s*\)\s*/i
]);
const NUMBER_ONLY_PATTERN = /^\s*\(?\s*\d+(?:\.\d+)*\s*\)?\s*[.):]?\s*$/;
const SENTENCE_TAIL = /[.।!?]\s*$/;
const CURRENCY = /(₹|rs\.?)\s*[\d,]/i;
const DATE_VALUE = /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/;
const WORD_ONLY_LINE = new RegExp(`^${LETTER_CLASS}[A-Za-z${DEVANAGARI}\\s/-]*$`, "u");
const HYPHEN_TAIL = new RegExp(`${LETTER_CLASS}-$`, "u");
const LOWER_CONTINUATION = new RegExp(`^[a-z${DEVANAGARI}]`, "u");
const CONTAINS_LETTER = new RegExp(LETTER_CLASS, "u");

/**
 * Split a numbering prefix off a heading and report its nesting depth.
 * @param {string} raw
 * @returns {{ numbering: string|null, depth: number, rest: string }}
 */
function parseNumbering(raw) {
  const text = collapse(raw);
  for (const pattern of NUMBERING_PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;
    const numbering = collapse(match[1]);
    const rest = collapse(text.slice(match[0].length));
    if (!numbering || !rest) continue;
    const depth = /^[\d०-९]/.test(numbering) ? numbering.split(".").length : 2;
    return { numbering, depth, rest };
  }
  return { numbering: null, depth: 0, rest: text };
}

/**
 * Strip decoration so a heading can be compared against the alias table.
 * @param {string} raw
 * @returns {string}
 */
function cleanHeadingText(raw) {
  return collapse(raw)
    .replace(/^\[\s*section\s*:\s*/i, "")
    .replace(/\]\s*$/, "")
    .replace(/^[*•\-–—>]+\s*/, "")
    .replace(/^["'“”‘’]+/, "")
    .replace(/["'“”‘’]+$/, "")
    .replace(/[:：\-–—*|]+\s*$/, "")
    .replace(/\s*[:：]\s*$/, "")
    .trim();
}

/**
 * Candidate spellings for one heading: the whole string plus each side of a
 * bilingual separator ("Important Dates / महत्वपूर्ण तिथियाँ").
 * @param {string} cleaned
 * @returns {string[]}
 */
function bilingualVariants(cleaned) {
  const parts = cleaned
    .split(/\s*[/|]\s*|\s+[–—]\s+/)
    .map((part) => collapse(part))
    .filter(Boolean);
  return uniqueBy([cleaned, ...parts], (value) => toKey(value));
}

/**
 * Resolve a raw heading string to a canonical section name.
 * Unknown headings keep their original text and are still returned.
 *
 * @param {string} raw
 * @returns {{
 *   raw: string,
 *   normalizedText: string,
 *   canonicalSection: string,
 *   canonicalLabel: string|null,
 *   isKnownSection: boolean,
 *   matchStrategy: string,
 *   matchedAlias: string|null,
 *   numbering: string|null,
 *   numberingDepth: number,
 *   language: string,
 *   confidence: number
 * }}
 */
function normalizeHeading(raw) {
  const original = collapse(raw);
  const { numbering, depth, rest } = parseNumbering(original);
  const cleaned = cleanHeadingText(rest);
  const variants = bilingualVariants(cleaned);

  const base = {
    raw: original,
    normalizedText: cleaned || original,
    numbering,
    numberingDepth: depth,
    language: detectLanguage(original).language
  };

  for (const variant of variants) {
    const key = toKey(variant);
    if (ALIAS_LOOKUP.has(key)) {
      const section = ALIAS_LOOKUP.get(key);
      return {
        ...base,
        canonicalSection: section,
        canonicalLabel: CANONICAL_SECTION_LABELS[section] || null,
        isKnownSection: true,
        matchStrategy: variant === cleaned ? "alias_exact" : "alias_bilingual",
        matchedAlias: key,
        confidence: variant === cleaned ? 0.95 : 0.9
      };
    }
  }

  // Phase AI-1 generator heading map keeps this layer aligned with the Generator.
  for (const variant of variants) {
    const key = toKey(variant);
    const ai1Type = SECTION_HEADING_MAP[key];
    const section = ai1Type ? AI1_SECTION_TYPE_TO_CANONICAL[ai1Type] : null;
    if (section && section !== CANONICAL_SECTIONS.UNKNOWN) {
      return {
        ...base,
        canonicalSection: section,
        canonicalLabel: CANONICAL_SECTION_LABELS[section] || null,
        isKnownSection: true,
        matchStrategy: "generator_intelligence_map",
        matchedAlias: key,
        confidence: 0.85
      };
    }
  }

  // Decorated headings such as "A. Important Dates for Candidates".
  const haystack = toKey(cleaned);
  if (haystack) {
    for (const alias of ALIAS_KEYS_BY_LENGTH) {
      if (alias.length < 5) continue;
      if (!haystack.includes(alias)) continue;
      const section = ALIAS_LOOKUP.get(alias);
      return {
        ...base,
        canonicalSection: section,
        canonicalLabel: CANONICAL_SECTION_LABELS[section] || null,
        isKnownSection: true,
        matchStrategy: "alias_contains",
        matchedAlias: alias,
        confidence: round2(Math.max(0.6, 0.85 - (haystack.length - alias.length) / 120))
      };
    }
  }

  return {
    ...base,
    canonicalSection: CANONICAL_SECTIONS.UNKNOWN,
    canonicalLabel: null,
    isKnownSection: false,
    matchStrategy: "unmatched",
    matchedAlias: null,
    confidence: 0.4
  };
}

/**
 * A line that could be one half of a heading wrapped onto two lines: short,
 * word-only, and carrying no value punctuation.
 * @param {string} line
 * @returns {boolean}
 */
function isWrapCandidate(line) {
  const text = collapse(line);
  if (!text || text.length > 30) return false;
  if (/[:：=|]/.test(text)) return false;
  if (/\d/.test(text)) return false;
  if (SENTENCE_TAIL.test(text) || CURRENCY.test(text)) return false;
  if (/https?:\/\//i.test(text)) return false;
  return WORD_ONLY_LINE.test(text);
}

/**
 * Rejoin headings that PDF extraction split across lines.
 * @param {string[]} lines
 * @returns {{ lines: string[], repairs: Array<object> }}
 */
function repairBrokenHeadings(lines) {
  const input = Array.isArray(lines) ? lines.map((line) => collapse(line)) : [];
  const out = [];
  const repairs = [];

  for (let index = 0; index < input.length; index += 1) {
    const current = input[index];
    const next = input[index + 1];
    if (!current) continue;
    if (!next) {
      out.push(current);
      continue;
    }

    // Numbering stranded on its own line: "3." then "Important Dates".
    if (NUMBER_ONLY_PATTERN.test(current) && next.length <= MAX_HEADING_LENGTH) {
      const merged = `${current.replace(/\s+$/, "")} ${next}`.replace(/\s+/g, " ").trim();
      out.push(merged);
      repairs.push({ reason: "orphan_numbering", from: [current, next], to: merged });
      index += 1;
      continue;
    }

    // Hyphenated split: "Corrigen-" / "dum Notice".
    if (HYPHEN_TAIL.test(current) && LOWER_CONTINUATION.test(next)) {
      const merged = `${current.slice(0, -1)}${next}`;
      out.push(merged);
      repairs.push({ reason: "hyphen_split", from: [current, next], to: merged });
      index += 1;
      continue;
    }

    // Two short word-only fragments that become an exact heading once joined.
    // Content lines are excluded conservatively: a merge that swallows a value
    // row would silently destroy notice data.
    if (isWrapCandidate(current) && isWrapCandidate(next) && !normalizeHeading(current).isKnownSection) {
      const merged = `${current} ${next}`;
      const mergedMatch = normalizeHeading(merged);
      if (
        merged.length <= 60 &&
        (mergedMatch.matchStrategy === "alias_exact" || mergedMatch.matchStrategy === "alias_bilingual")
      ) {
        out.push(merged);
        repairs.push({ reason: "wrapped_heading", from: [current, next], to: merged });
        index += 1;
        continue;
      }
    }

    out.push(current);
  }

  return { lines: out, repairs };
}

const TITLE_CASE_CONNECTORS = new Set(["of", "for", "and", "to", "the", "in", "on", "cum", "&"]);

/**
 * @param {string} text
 * @param {number} wordCount
 * @returns {boolean}
 */
function isTitleCaseHeading(text, wordCount) {
  if (wordCount < 2 || wordCount > 5 || text.length > 50) return false;
  if (/\d/.test(text)) return false;
  const words = text.split(/\s+/);
  return words.every(
    (word) => TITLE_CASE_CONNECTORS.has(word.toLowerCase()) || /^[A-Z][A-Za-z.'-]*$/.test(word)
  );
}

/**
 * Decide whether a plain-text line is acting as a heading.
 * @param {string} line
 * @returns {{ isHeading: boolean, reason: string, baseConfidence: number }}
 */
function classifyHeadingLine(line) {
  const text = collapse(line);
  const reject = { isHeading: false, reason: "not_heading", baseConfidence: 0 };
  if (!text || text.length > MAX_HEADING_LENGTH) return reject;
  if (/https?:\/\/|www\./i.test(text)) return reject;
  if (CURRENCY.test(text)) return reject;
  if (DATE_VALUE.test(text) && /[:：]/.test(text)) return reject;
  if (/^(q|a|question|answer)\s*[:：]/i.test(text)) return reject;

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (SENTENCE_TAIL.test(text) && wordCount > 8) return reject;

  const normalized = normalizeHeading(text);
  if (normalized.isKnownSection && normalized.matchStrategy !== "alias_contains") {
    return { isHeading: true, reason: "known_section", baseConfidence: 0.9 };
  }
  if (normalized.numbering && wordCount <= 12 && CONTAINS_LETTER.test(normalized.normalizedText)) {
    return { isHeading: true, reason: "numbered", baseConfidence: 0.7 };
  }
  if (/[:：]$/.test(text) && wordCount <= 8) {
    return { isHeading: true, reason: "colon_terminated", baseConfidence: 0.65 };
  }
  if (/^[A-Z][A-Z\s/&()-]{5,}$/.test(text) && !/\d{4}/.test(text)) {
    return { isHeading: true, reason: "upper_case", baseConfidence: 0.6 };
  }
  if (normalized.isKnownSection) {
    return { isHeading: true, reason: "known_section_embedded", baseConfidence: 0.6 };
  }
  // Short Title Case runs are the usual shape of a board's own custom section
  // heading. They only ever become *unknown* headings, so a false positive adds
  // a preserved label rather than corrupting a canonical section.
  if (isTitleCaseHeading(text, wordCount)) {
    return { isHeading: true, reason: "title_case", baseConfidence: 0.5 };
  }
  return reject;
}

/**
 * Assign nesting levels and build a parent/child tree.
 * @param {Array<object>} headings
 * @returns {Array<object>}
 */
function buildHeadingTree(headings) {
  const nodes = headings.map((heading, index) => ({
    index,
    text: heading.normalizedText,
    canonicalSection: heading.canonicalSection,
    level: heading.level,
    children: []
  }));
  const roots = [];
  const stack = [];

  for (const node of nodes) {
    while (stack.length && stack[stack.length - 1].level >= node.level) stack.pop();
    if (stack.length) {
      stack[stack.length - 1].children.push(node);
    } else {
      roots.push(node);
    }
    stack.push(node);
  }
  return roots;
}

/**
 * Detect and normalize every heading in a notice.
 *
 * @param {{ htmlHeadings?: Array<object>, lines?: string[], text?: string }} analysis
 * @returns {{
 *   headings: Array<object>,
 *   tree: Array<object>,
 *   canonicalSections: string[],
 *   knownHeadingCount: number,
 *   unknownHeadings: Array<object>,
 *   repairs: Array<object>,
 *   repairedLines: string[]
 * }}
 */
function detectHeadings(analysis = {}) {
  const htmlHeadings = Array.isArray(analysis.htmlHeadings) ? analysis.htmlHeadings : [];
  const sourceLines = Array.isArray(analysis.lines)
    ? analysis.lines
    : toText(analysis.text)
        .split(/\r?\n/)
        .map((line) => collapse(line))
        .filter(Boolean);

  const { lines: repairedLines, repairs } = repairBrokenHeadings(sourceLines);
  const detected = [];

  for (const htmlHeading of htmlHeadings) {
    const normalized = normalizeHeading(htmlHeading.text);
    detected.push({
      ...normalized,
      level: normalized.numberingDepth || htmlHeading.level || 3,
      origin: htmlHeading.source || "html",
      detectionReason: "html_tag",
      confidence: round2(Math.min(0.98, normalized.confidence + 0.03)),
      lineIndex: null
    });
  }

  repairedLines.forEach((line, lineIndex) => {
    const verdict = classifyHeadingLine(line);
    if (!verdict.isHeading) return;
    const normalized = normalizeHeading(line);
    const level = normalized.numberingDepth || (normalized.isKnownSection ? 2 : 3);
    detected.push({
      ...normalized,
      level,
      origin: "text",
      detectionReason: verdict.reason,
      confidence: round2(Math.max(verdict.baseConfidence, normalized.confidence * 0.95)),
      lineIndex
    });
  });

  const headings = uniqueBy(
    detected,
    (heading) => `${heading.canonicalSection}|${toKey(heading.normalizedText)}`
  ).map((heading, order) => ({ ...heading, order }));

  const knownHeadings = headings.filter((heading) => heading.isKnownSection);

  return {
    headings,
    tree: buildHeadingTree(headings),
    canonicalSections: uniqueBy(
      knownHeadings.map((heading) => heading.canonicalSection),
      (section) => section
    ),
    knownHeadingCount: knownHeadings.length,
    unknownHeadings: headings
      .filter((heading) => !heading.isKnownSection)
      .map((heading) => ({
        text: heading.normalizedText,
        raw: heading.raw,
        level: heading.level,
        detectionReason: heading.detectionReason
      })),
    repairs,
    repairedLines
  };
}

module.exports = {
  SECTION_ALIASES,
  parseNumbering,
  cleanHeadingText,
  bilingualVariants,
  normalizeHeading,
  repairBrokenHeadings,
  classifyHeadingLine,
  isWrapCandidate,
  isTitleCaseHeading,
  buildHeadingTree,
  detectHeadings
};
