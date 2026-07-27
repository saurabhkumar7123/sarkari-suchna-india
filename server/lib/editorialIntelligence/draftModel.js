"use strict";

/**
 * Phase AI-4 — Normalize any draft-shaped input into one analysis model.
 *
 * Accepts:
 *   1. publisher / Generator text (string)
 *   2. AI-1 structured document
 *   3. object with draftText / result / publisherText / content
 *   4. PWP-ish package with data.sections or data.result
 *   5. event already carrying noticeIntelligence / recruitmentMatching
 *
 * Never mutates the input. Never publishes.
 */

const { SECTION_TYPES, SECTION_TYPE_TO_TITLE, LINK_CATEGORIES } = require("../generatorIntelligence/types");
const { INTELLIGENCE_FIELD } = require("../noticeIntelligence/normalizedEvent");
const { RECOMMENDATION_FIELD } = require("../recruitmentMatching/recommendation");
const {
  DRAFT_PROFILES,
  EVENT_TYPE_TO_PROFILE,
  PROFILE_EXPECTED_SECTIONS,
  PROFILE_EXPECTED_LINKS
} = require("./types");
const {
  parsePublisherSections,
  extractDates,
  extractFeeAmounts,
  extractAdvertisementNumber,
  extractReferenceNumber,
  extractLinksFromText,
  assessLinkHealth,
  analyzeVacancyTotals,
  detectLanguage,
  toText,
  collapse,
  toLines
} = require("./draftUtils");

const AI1_FORMAT_ID = "generator_intelligence_structured_v1";

/**
 * @param {object|string} input
 * @returns {string}
 */
function extractRawText(input) {
  if (typeof input === "string") return input;
  if (!input || typeof input !== "object") return "";

  if (typeof input.draftText === "string") return input.draftText;
  if (typeof input.publisherText === "string") return input.publisherText;
  if (typeof input.result === "string") return input.result;
  if (typeof input.content === "string") return input.content;
  if (typeof input.text === "string") return input.text;
  if (typeof input.html === "string") return input.html;

  if (input.data && typeof input.data === "object") {
    if (typeof input.data.result === "string") return input.data.result;
    if (typeof input.data.draftText === "string") return input.data.draftText;
    if (typeof input.data.publisherText === "string") return input.data.publisherText;
  }

  if (Array.isArray(input.sections)) {
    return input.sections
      .map((sec) => {
        const title = sec.generatorTitle || sec.title || "Section";
        const body = sec.originalContent || sec.content || (sec.lines || []).join("\n") || "";
        return `[Section: ${title}]\n${body}`;
      })
      .join("\n\n");
  }

  return "";
}

/**
 * Map AI-1 structured sections into the shared draft section shape.
 * @param {object} structured
 * @returns {Array<object>}
 */
function sectionsFromStructured(structured) {
  return (structured.sections || []).map((sec, idx) => ({
    order: Number.isFinite(sec.order) ? sec.order : idx,
    title: sec.title || sec.generatorTitle || "Section",
    sectionType: sec.sectionType || SECTION_TYPES.UNKNOWN,
    generatorTitle:
      sec.generatorTitle || SECTION_TYPE_TO_TITLE[sec.sectionType] || sec.title || "Section",
    isKnown: Boolean(sec.isKnownSection ?? sec.sectionType !== SECTION_TYPES.UNKNOWN),
    content: toText(sec.originalContent || (sec.lines || []).join("\n") || ""),
    lines: toLines(sec.originalContent || (sec.lines || []).join("\n") || ""),
    blocks: sec.blocks || [],
    confidence: sec.confidence
  }));
}

/**
 * Prefer explicit profile, then noticeIntelligence event type, then heuristics.
 * @param {object} options
 * @param {object|null} notice
 * @param {string} fullText
 * @returns {string}
 */
function resolveProfile(options, notice, fullText) {
  if (options.profile && DRAFT_PROFILES[String(options.profile).toUpperCase()]) {
    return DRAFT_PROFILES[String(options.profile).toUpperCase()];
  }
  if (options.profile && Object.values(DRAFT_PROFILES).includes(options.profile)) {
    return options.profile;
  }

  const eventType = options.eventType || (notice && notice.eventType) || null;
  if (eventType && EVENT_TYPE_TO_PROFILE[eventType]) {
    return EVENT_TYPE_TO_PROFILE[eventType];
  }

  const blob = toText(fullText).toLowerCase();
  // Event-type cues win over generic "recruitment board" wording in org names.
  if (/\badmit\s*card\b|hall\s*ticket|एडमिट/.test(blob)) return DRAFT_PROFILES.ADMIT_CARD;
  if (/\banswer\s*key\b|उत्तर\s*कुंजी/.test(blob)) return DRAFT_PROFILES.ANSWER_KEY;
  if (/\bcorrigendum\b|\bcorrection\s+notice\b|\bform\s+correction\b|ओम[रR]?|शुद्धिपत्र/.test(blob)) {
    return DRAFT_PROFILES.CORRECTION;
  }
  if (/\bextension\b|last\s*date.*extend|तिथि.*बढ़ा|extended\s+upto|date\s+extension/.test(blob)) {
    return DRAFT_PROFILES.EXTENSION;
  }
  if (/\bresult\b|merit\s*list|select\s*list|परिणाम/.test(blob)) return DRAFT_PROFILES.RESULT;
  if (/\brecruitment\b|\bvacancy\b|\badvertisement\b|भर्ती|विज्ञापन/.test(blob)) {
    return DRAFT_PROFILES.NEW_RECRUITMENT;
  }
  return DRAFT_PROFILES.UNKNOWN;
}

/**
 * Enrich each section with extracted facts used by validators.
 * @param {Array<object>} sections
 * @returns {Array<object>}
 */
function enrichSections(sections) {
  return sections.map((sec) => {
    const content = sec.content || "";
    const dates = extractDates(content);
    const fees = extractFeeAmounts(content);
    const links =
      sec.sectionType === SECTION_TYPES.IMPORTANT_LINKS
        ? extractLinksFromText(content)
        : extractLinksFromText(content).slice(0, 3);
    const vacancy =
      sec.sectionType === SECTION_TYPES.VACANCY_DETAILS || sec.sectionType === SECTION_TYPES.SHORT_INFORMATION
        ? analyzeVacancyTotals(content)
        : null;

    return {
      ...sec,
      isEmpty: !collapse(content),
      wordCount: collapse(content).split(/\s+/).filter(Boolean).length,
      dates,
      fees,
      links,
      vacancy,
      advertisementNumber: extractAdvertisementNumber(content),
      referenceNumber: extractReferenceNumber(content)
    };
  });
}

/**
 * Build the immutable-friendly draft analysis model.
 *
 * @param {object|string} input
 * @param {{
 *   profile?: string,
 *   eventType?: string,
 *   now?: Date,
 *   title?: string
 * }} [options]
 * @returns {object}
 */
function buildDraftModel(input, options = {}) {
  const base = input && typeof input === "object" ? input : {};
  const notice =
    (base[INTELLIGENCE_FIELD] && typeof base[INTELLIGENCE_FIELD] === "object"
      ? base[INTELLIGENCE_FIELD]
      : null) ||
    (base.formatId === "notice_intelligence_event_v1" ? base : null) ||
    options.noticeIntelligence ||
    null;

  const matching =
    (base[RECOMMENDATION_FIELD] && typeof base[RECOMMENDATION_FIELD] === "object"
      ? base[RECOMMENDATION_FIELD]
      : null) ||
    options.recruitmentMatching ||
    null;

  let structured = null;
  let sections = [];
  let source = "raw_text";

  if (base.formatId === AI1_FORMAT_ID && Array.isArray(base.sections)) {
    structured = base;
    sections = sectionsFromStructured(base);
    source = "ai1_structured";
  } else if (base.structured && base.structured.formatId === AI1_FORMAT_ID) {
    structured = base.structured;
    sections = sectionsFromStructured(base.structured);
    source = "ai1_pipeline_result";
  } else {
    const rawText = extractRawText(input);
    sections = parsePublisherSections(rawText);
    source = typeof input === "string" ? "publisher_text" : "draft_object";
  }

  sections = enrichSections(sections);
  const fullText = sections.map((s) => `${s.generatorTitle}\n${s.content}`).join("\n\n");
  const language = detectLanguage(fullText);
  const profile = resolveProfile(options, notice, fullText);

  const allLinks = [];
  const seenUrls = new Set();
  for (const sec of sections) {
    for (const link of sec.links || []) {
      const health = assessLinkHealth(link.url);
      const key = String(link.url || "").toLowerCase();
      const duplicate = seenUrls.has(key);
      if (!duplicate && key) seenUrls.add(key);
      allLinks.push({
        ...link,
        sectionType: sec.sectionType,
        sectionTitle: sec.generatorTitle,
        ...health,
        duplicate
      });
    }
  }

  // Prefer AI-1 classified links when structured is present
  if (structured && Array.isArray(structured.links) && structured.links.length) {
    for (const link of structured.links) {
      const url = link.url || link.href || "";
      const key = String(url).toLowerCase();
      if (!key || seenUrls.has(key)) continue;
      seenUrls.add(key);
      const health = assessLinkHealth(url);
      allLinks.push({
        label: link.label || link.category || "Link",
        url,
        category: link.category || LINK_CATEGORIES.OTHER,
        sectionType: SECTION_TYPES.IMPORTANT_LINKS,
        sectionTitle: "Important Links",
        duplicateOf: null,
        duplicate: false,
        ...health
      });
    }
  }

  const advertisementNumbers = sections
    .map((s) => s.advertisementNumber)
    .filter(Boolean);
  const referenceNumbers = sections.map((s) => s.referenceNumber).filter(Boolean);

  const byType = {};
  for (const sec of sections) {
    if (!byType[sec.sectionType]) byType[sec.sectionType] = [];
    byType[sec.sectionType].push(sec);
  }

  const title =
    options.title ||
    (structured && structured.metadata && structured.metadata.title) ||
    base.title ||
    (notice && (notice.normalizedTitle || notice.sourceTitle)) ||
    (sections[0] && sections[0].lines[0]) ||
    null;

  return {
    source,
    profile,
    title: title ? collapse(String(title)).slice(0, 220) : null,
    language: language.language,
    languageStats: language.stats,
    fullText,
    sections,
    byType,
    links: allLinks,
    expectedSections: PROFILE_EXPECTED_SECTIONS[profile] || PROFILE_EXPECTED_SECTIONS[DRAFT_PROFILES.UNKNOWN],
    expectedLinks: PROFILE_EXPECTED_LINKS[profile] || PROFILE_EXPECTED_LINKS[DRAFT_PROFILES.UNKNOWN],
    advertisementNumbers,
    referenceNumbers,
    noticeIntelligence: notice,
    recruitmentMatching: matching,
    eventType: options.eventType || (notice && notice.eventType) || null,
    structured,
    unknownSections: sections.filter((s) => s.sectionType === SECTION_TYPES.UNKNOWN)
  };
}

/**
 * @param {object} draft
 * @param {string} sectionType
 * @returns {object|null}
 */
function getSection(draft, sectionType) {
  const list = draft.byType && draft.byType[sectionType];
  return list && list.length ? list[0] : null;
}

/**
 * @param {object} draft
 * @param {string} sectionType
 * @returns {boolean}
 */
function hasNonEmptySection(draft, sectionType) {
  const list = draft.byType && draft.byType[sectionType];
  if (!list || !list.length) return false;
  return list.some((s) => !s.isEmpty);
}

module.exports = {
  AI1_FORMAT_ID,
  extractRawText,
  sectionsFromStructured,
  resolveProfile,
  enrichSections,
  buildDraftModel,
  getSection,
  hasNonEmptySection
};
