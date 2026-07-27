"use strict";

/**
 * Phase AI-4 — Missing information detection.
 * Severity-tagged gaps editors should fill before review completion.
 */

const {
  SECTION_TYPES,
  SECTION_TYPE_TO_TITLE,
  MISSING_CODES,
  SEVERITY,
  LINK_CATEGORIES,
  DRAFT_PROFILES
} = require("./types");
const { getSection, hasNonEmptySection } = require("./draftModel");

/**
 * @param {string} code
 * @param {string} severity
 * @param {string} message
 * @param {object} [extra]
 * @returns {object}
 */
function missing(code, severity, message, extra = {}) {
  return {
    code,
    severity,
    message,
    advisoryOnly: true,
    ...extra
  };
}

/**
 * @param {object} draft
 * @param {string} content
 * @param {RegExp} re
 * @returns {boolean}
 */
function textHas(draft, content, re) {
  return re.test(String(content || draft.fullText || ""));
}

/**
 * @param {object} draft
 * @returns {object[]}
 */
function detectMissingDates(draft) {
  const items = [];
  const dates = getSection(draft, SECTION_TYPES.IMPORTANT_DATES);
  const blob = dates ? dates.content : draft.fullText || "";

  const isFull = draft.profile === DRAFT_PROFILES.NEW_RECRUITMENT || draft.profile === DRAFT_PROFILES.EXTENSION;

  if (isFull || draft.profile === DRAFT_PROFILES.UNKNOWN) {
    if (!textHas(draft, blob, /(?:apply|application|registration|online)\s*(?:start|begin|commence)/i) &&
        !textHas(draft, blob, /start\s*date|application\s*begin/i)) {
      items.push(
        missing(
          MISSING_CODES.MISSING_APPLICATION_START_DATE,
          SEVERITY.CRITICAL,
          "Application start date is missing.",
          { field: "application_start_date", sectionType: SECTION_TYPES.IMPORTANT_DATES }
        )
      );
    }
    if (!textHas(draft, blob, /last\s*date|closing\s*date|end\s*date|apply\s*until|upto/i)) {
      items.push(
        missing(
          MISSING_CODES.MISSING_LAST_DATE,
          SEVERITY.CRITICAL,
          "Last date / closing date is missing.",
          { field: "last_date", sectionType: SECTION_TYPES.IMPORTANT_DATES }
        )
      );
    }
  }

  if (draft.profile === DRAFT_PROFILES.NEW_RECRUITMENT) {
    const age = getSection(draft, SECTION_TYPES.AGE_LIMIT);
    const ageBlob = age ? age.content : "";
    if (age && !textHas(draft, ageBlob, /as\s*on|cut[\s-]*off\s*date|age\s*(?:as|on|calculated)/i)) {
      items.push(
        missing(
          MISSING_CODES.MISSING_AGE_CALCULATION_DATE,
          SEVERITY.HIGH,
          "Age limit section has no age calculation / as-on date.",
          { field: "age_calculation_date", sectionType: SECTION_TYPES.AGE_LIMIT }
        )
      );
    }
  }

  if (!hasNonEmptySection(draft, SECTION_TYPES.IMPORTANT_DATES) &&
      (draft.profile === DRAFT_PROFILES.NEW_RECRUITMENT ||
        draft.profile === DRAFT_PROFILES.EXTENSION ||
        draft.profile === DRAFT_PROFILES.ADMIT_CARD)) {
    items.push(
      missing(
        MISSING_CODES.MISSING_IMPORTANT_DATES,
        SEVERITY.CRITICAL,
        "Important Dates section is missing.",
        { sectionType: SECTION_TYPES.IMPORTANT_DATES }
      )
    );
  }

  return items;
}

/**
 * @param {object} draft
 * @returns {object[]}
 */
function detectMissingSections(draft) {
  const items = [];
  const profile = draft.profile;

  const requireSection = (sectionType, code, severity, label) => {
    if (!hasNonEmptySection(draft, sectionType)) {
      items.push(
        missing(code, severity, `${label || SECTION_TYPE_TO_TITLE[sectionType]} is missing.`, {
          sectionType
        })
      );
    }
  };

  if (profile === DRAFT_PROFILES.NEW_RECRUITMENT) {
    requireSection(SECTION_TYPES.SHORT_INFORMATION, MISSING_CODES.MISSING_SHORT_INFORMATION, SEVERITY.HIGH);
    requireSection(SECTION_TYPES.APPLICATION_FEE, MISSING_CODES.MISSING_FEE_SECTION, SEVERITY.CRITICAL);
    requireSection(SECTION_TYPES.VACANCY_DETAILS, MISSING_CODES.MISSING_VACANCY_DETAILS, SEVERITY.CRITICAL);
    requireSection(SECTION_TYPES.ELIGIBILITY, MISSING_CODES.MISSING_ELIGIBILITY, SEVERITY.CRITICAL);
    // Qualification can satisfy eligibility expectation partially
    if (!hasNonEmptySection(draft, SECTION_TYPES.ELIGIBILITY) &&
        hasNonEmptySection(draft, SECTION_TYPES.QUALIFICATION)) {
      // remove eligibility missing if we just pushed it — qualification covers educational side
      const idx = items.findIndex((i) => i.code === MISSING_CODES.MISSING_ELIGIBILITY);
      if (idx >= 0) items.splice(idx, 1);
    }
    requireSection(SECTION_TYPES.SELECTION_PROCESS, MISSING_CODES.MISSING_SELECTION_PROCESS, SEVERITY.HIGH);
    requireSection(SECTION_TYPES.SALARY, MISSING_CODES.MISSING_SALARY, SEVERITY.MEDIUM);
    requireSection(SECTION_TYPES.HOW_TO_APPLY, MISSING_CODES.MISSING_HOW_TO_APPLY, SEVERITY.HIGH);
    requireSection(SECTION_TYPES.FAQ, MISSING_CODES.MISSING_FAQ, SEVERITY.LOW);
    requireSection(SECTION_TYPES.HELPLINE, MISSING_CODES.MISSING_HELPLINE, SEVERITY.LOW);
  }

  if (profile === DRAFT_PROFILES.EXTENSION) {
    requireSection(SECTION_TYPES.APPLICATION_FEE, MISSING_CODES.MISSING_FEE_SECTION, SEVERITY.MEDIUM);
    requireSection(SECTION_TYPES.HOW_TO_APPLY, MISSING_CODES.MISSING_HOW_TO_APPLY, SEVERITY.MEDIUM);
  }

  return items;
}

/**
 * @param {object} draft
 * @returns {object[]}
 */
function detectMissingLinks(draft) {
  const items = [];
  const categories = new Set((draft.links || []).filter((l) => !l.broken).map((l) => l.category));
  const profile = draft.profile;

  const need = (category, code, severity, label) => {
    if (!categories.has(category)) {
      items.push(
        missing(code, severity, `${label} is missing.`, {
          linkCategory: category
        })
      );
    }
  };

  if (profile === DRAFT_PROFILES.NEW_RECRUITMENT || profile === DRAFT_PROFILES.EXTENSION) {
    need(LINK_CATEGORIES.NOTIFICATION_PDF, MISSING_CODES.MISSING_OFFICIAL_NOTIFICATION_LINK, SEVERITY.HIGH, "Official notification PDF link");
    need(LINK_CATEGORIES.OFFICIAL_WEBSITE, MISSING_CODES.MISSING_OFFICIAL_WEBSITE, SEVERITY.HIGH, "Official website link");
    need(LINK_CATEGORIES.APPLY_ONLINE, MISSING_CODES.MISSING_APPLY_ONLINE_LINK, SEVERITY.HIGH, "Apply Online link");
  }
  if (profile === DRAFT_PROFILES.ADMIT_CARD) {
    need(LINK_CATEGORIES.ADMIT_CARD, MISSING_CODES.MISSING_ADMIT_CARD_LINK, SEVERITY.CRITICAL, "Admit Card link");
    need(LINK_CATEGORIES.OFFICIAL_WEBSITE, MISSING_CODES.MISSING_OFFICIAL_WEBSITE, SEVERITY.MEDIUM, "Official website link");
  }
  if (profile === DRAFT_PROFILES.RESULT) {
    need(LINK_CATEGORIES.RESULT, MISSING_CODES.MISSING_RESULT_LINK, SEVERITY.CRITICAL, "Result link");
    need(LINK_CATEGORIES.OFFICIAL_WEBSITE, MISSING_CODES.MISSING_OFFICIAL_WEBSITE, SEVERITY.MEDIUM, "Official website link");
  }
  if (profile === DRAFT_PROFILES.CORRECTION) {
    need(LINK_CATEGORIES.CORRECTION, MISSING_CODES.MISSING_CORRECTION_LINK, SEVERITY.HIGH, "Correction link");
  }
  if (profile === DRAFT_PROFILES.ANSWER_KEY) {
    need(LINK_CATEGORIES.ANSWER_KEY, MISSING_CODES.MISSING_ANSWER_KEY_LINK, SEVERITY.CRITICAL, "Answer Key link");
  }

  return items;
}

/**
 * @param {object} draft
 * @returns {{ items: object[], counts: object, explanation: string }}
 */
function detectMissingInformation(draft) {
  const items = [...detectMissingDates(draft), ...detectMissingSections(draft), ...detectMissingLinks(draft)];

  // De-dupe by code
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    if (seen.has(item.code)) continue;
    seen.add(item.code);
    unique.push(item);
  }

  const counts = {
    critical: unique.filter((i) => i.severity === SEVERITY.CRITICAL).length,
    high: unique.filter((i) => i.severity === SEVERITY.HIGH).length,
    medium: unique.filter((i) => i.severity === SEVERITY.MEDIUM).length,
    low: unique.filter((i) => i.severity === SEVERITY.LOW).length,
    total: unique.length
  };

  return {
    items: unique,
    counts,
    explanation:
      counts.total === 0
        ? "No expected information gaps detected for this draft profile."
        : `Detected ${counts.total} missing-information item(s): ${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low.`
  };
}

module.exports = {
  detectMissingInformation,
  detectMissingDates,
  detectMissingSections,
  detectMissingLinks
};
