"use strict";

/**
 * PWP Phase 2 — Update planning for existing pages.
 * Determines affected / unaffected sections from Stage 3D detectedChanges.
 * Never rewrites content.
 */

const {
  CHANGE_TYPES
} = require("../../contentIntelligence/multiSourceCorrelation/correlationTypes");
const { PAGE_SECTIONS } = require("./resolutionTypes");
const { identityKey } = require("../../contentIntelligence/multiSourceCorrelation/correlationUtils");

const CHANGE_TYPE_TO_SECTION = Object.freeze({
  [CHANGE_TYPES.IMPORTANT_DATE]: PAGE_SECTIONS.IMPORTANT_DATES,
  [CHANGE_TYPES.VACANCY_COUNT]: PAGE_SECTIONS.VACANCY_DETAILS,
  [CHANGE_TYPES.ELIGIBILITY]: PAGE_SECTIONS.ELIGIBILITY,
  [CHANGE_TYPES.APPLICATION_FEE]: PAGE_SECTIONS.APPLICATION_FEE,
  [CHANGE_TYPES.EXAM_SCHEDULE]: PAGE_SECTIONS.EXAM_SCHEDULE,
  [CHANGE_TYPES.OFFICIAL_LINK]: PAGE_SECTIONS.IMPORTANT_LINKS,
  [CHANGE_TYPES.NOTIFICATION_VERSION]: PAGE_SECTIONS.NOTIFICATION_VERSION,
  [CHANGE_TYPES.DOCUMENT_REVISION]: PAGE_SECTIONS.NOTIFICATION_VERSION,
  [CHANGE_TYPES.SECTION_ADDED]: PAGE_SECTIONS.OTHER,
  [CHANGE_TYPES.SECTION_REMOVED]: PAGE_SECTIONS.OTHER
});

const SECTION_HEADING_MAP = Object.freeze({
  short_information: PAGE_SECTIONS.SHORT_INFORMATION,
  "short information": PAGE_SECTIONS.SHORT_INFORMATION,
  important_dates: PAGE_SECTIONS.IMPORTANT_DATES,
  "important dates": PAGE_SECTIONS.IMPORTANT_DATES,
  application_fee: PAGE_SECTIONS.APPLICATION_FEE,
  "application fee": PAGE_SECTIONS.APPLICATION_FEE,
  vacancy_details: PAGE_SECTIONS.VACANCY_DETAILS,
  "vacancy details": PAGE_SECTIONS.VACANCY_DETAILS,
  eligibility: PAGE_SECTIONS.ELIGIBILITY,
  how_to_apply: PAGE_SECTIONS.HOW_TO_APPLY,
  "how to apply": PAGE_SECTIONS.HOW_TO_APPLY,
  important_links: PAGE_SECTIONS.IMPORTANT_LINKS,
  "important links": PAGE_SECTIONS.IMPORTANT_LINKS,
  exam_schedule: PAGE_SECTIONS.EXAM_SCHEDULE,
  "exam schedule": PAGE_SECTIONS.EXAM_SCHEDULE
});

function normalizeSectionKey(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (Object.values(PAGE_SECTIONS).includes(raw)) return raw;
  const keyed = identityKey(raw);
  if (keyed && SECTION_HEADING_MAP[keyed]) return SECTION_HEADING_MAP[keyed];
  if (SECTION_HEADING_MAP[raw.toLowerCase()]) return SECTION_HEADING_MAP[raw.toLowerCase()];
  return PAGE_SECTIONS.OTHER;
}

function resolveExistingSections(existingPage) {
  if (!existingPage || typeof existingPage !== "object") return [];
  const raw = existingPage.sections || existingPage.pageSections || [];
  if (!Array.isArray(raw) || raw.length === 0) {
    return Object.values(PAGE_SECTIONS).filter((s) => s !== PAGE_SECTIONS.OTHER);
  }
  const normalized = [];
  for (const item of raw) {
    const key =
      typeof item === "string"
        ? normalizeSectionKey(item)
        : normalizeSectionKey(item && (item.key || item.id || item.name || item.heading));
    if (key && !normalized.includes(key)) normalized.push(key);
  }
  return normalized;
}

function mapChangeToSection(change) {
  if (!change || typeof change !== "object") return PAGE_SECTIONS.OTHER;
  if (change.changeType === CHANGE_TYPES.SECTION_ADDED || change.changeType === CHANGE_TYPES.SECTION_REMOVED) {
    return normalizeSectionKey(change.currentValue || change.previousValue) || PAGE_SECTIONS.OTHER;
  }
  if (CHANGE_TYPE_TO_SECTION[change.changeType]) {
    return CHANGE_TYPE_TO_SECTION[change.changeType];
  }
  if (change.section) return normalizeSectionKey(change.section);
  if (change.field && String(change.field).startsWith("importantDates.")) {
    return PAGE_SECTIONS.IMPORTANT_DATES;
  }
  return PAGE_SECTIONS.OTHER;
}

/**
 * Build an update plan for an existing page.
 * Affected sections only — never marks unrelated sections for rewrite.
 */
function planUpdateScope({
  existingPage = null,
  detectedChanges = [],
  correlation = null
} = {}) {
  const existingSections = resolveExistingSections(existingPage);
  const changes = Array.isArray(detectedChanges)
    ? detectedChanges.slice()
    : correlation && Array.isArray(correlation.detectedChanges)
      ? correlation.detectedChanges.slice()
      : [];

  const affectedSet = new Set();
  const changeSummaries = [];

  for (const change of changes) {
    const section = mapChangeToSection(change);
    affectedSet.add(section);
    changeSummaries.push({
      changeType: change.changeType || null,
      field: change.field || null,
      section,
      previousValue: change.previousValue == null ? null : String(change.previousValue),
      currentValue: change.currentValue == null ? null : String(change.currentValue),
      previousDocumentId: change.previousDocumentId || null,
      currentDocumentId: change.currentDocumentId || null
    });
  }

  const affectedSections = [...affectedSet].sort();
  const unaffectedSections = existingSections
    .filter((section) => !affectedSet.has(section))
    .sort();

  let suggestedUpdateScope = "none";
  if (affectedSections.length === 0) {
    suggestedUpdateScope = changes.length === 0 ? "full_review" : "none";
  } else if (
    existingSections.length > 0 &&
    affectedSections.length >= existingSections.length &&
    unaffectedSections.length === 0
  ) {
    suggestedUpdateScope = "all_sections";
  } else {
    suggestedUpdateScope = "affected_sections_only";
  }

  const changeSummary = {
    changeCount: changeSummaries.length,
    affectedSectionCount: affectedSections.length,
    unaffectedSectionCount: unaffectedSections.length,
    changeTypes: [...new Set(changeSummaries.map((c) => c.changeType).filter(Boolean))].sort(),
    details: changeSummaries
  };

  return Object.freeze({
    affectedSections: Object.freeze(affectedSections.slice()),
    unaffectedSections: Object.freeze(unaffectedSections.slice()),
    suggestedUpdateScope,
    changeSummary: Object.freeze({
      ...changeSummary,
      changeTypes: Object.freeze(changeSummary.changeTypes.slice()),
      details: Object.freeze(changeSummaries.map((d) => Object.freeze({ ...d })))
    }),
    rewriteContent: false,
    overwriteUnrelatedSections: false
  });
}

module.exports = {
  CHANGE_TYPE_TO_SECTION,
  SECTION_HEADING_MAP,
  normalizeSectionKey,
  resolveExistingSections,
  mapChangeToSection,
  planUpdateScope
};
