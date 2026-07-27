"use strict";

/**
 * Phase AI-4 — Structured editorial suggestions.
 * Never applies changes to the draft.
 */

const {
  SUGGESTION_TYPES,
  SEVERITY,
  SECTION_TYPES,
  SECTION_TYPE_TO_TITLE,
  MISSING_CODES
} = require("./types");
const { getSection } = require("./draftModel");
const { toLines, collapse } = require("./draftUtils");

/**
 * @param {string} type
 * @param {string} severity
 * @param {string} title
 * @param {string} detail
 * @param {object} [extra]
 * @returns {object}
 */
function suggestion(type, severity, title, detail, extra = {}) {
  return {
    type,
    severity,
    title,
    detail,
    advisoryOnly: true,
    appliesChanges: false,
    ...extra
  };
}

/**
 * @param {object} parts
 * @returns {object[]}
 */
function buildEditorSuggestions(parts = {}) {
  const draft = parts.draft;
  const missing = parts.missingInformation || { items: [] };
  const validation = parts.validationIssues || { issues: [] };
  const language = parts.languageQuality || { issues: [] };
  const links = parts.linkValidation || { issues: [], duplicates: [], broken: [] };
  const ordering = parts.sectionOrdering || {};
  const suggestions = [];

  for (const item of missing.items || []) {
    if (item.code === MISSING_CODES.MISSING_FAQ) {
      suggestions.push(
        suggestion(
          SUGGESTION_TYPES.ADD_SECTION,
          SEVERITY.LOW,
          "Add missing FAQ",
          "Add an Important Questions section covering fee, age, eligibility and how to apply.",
          { sectionType: SECTION_TYPES.FAQ, relatedCode: item.code }
        )
      );
    } else if (item.field) {
      suggestions.push(
        suggestion(SUGGESTION_TYPES.ADD_CONTENT, item.severity, item.message, item.message, {
          relatedCode: item.code,
          field: item.field,
          sectionType: item.sectionType
        })
      );
    } else if (item.sectionType) {
      suggestions.push(
        suggestion(
          SUGGESTION_TYPES.ADD_SECTION,
          item.severity,
          `Add missing ${SECTION_TYPE_TO_TITLE[item.sectionType] || item.sectionType}`,
          item.message,
          { sectionType: item.sectionType, relatedCode: item.code }
        )
      );
    } else if (item.linkCategory) {
      suggestions.push(
        suggestion(
          SUGGESTION_TYPES.FIX_LINK,
          item.severity,
          `Add ${item.linkCategory} link`,
          item.message,
          { linkCategory: item.linkCategory, relatedCode: item.code }
        )
      );
    } else {
      suggestions.push(
        suggestion(SUGGESTION_TYPES.ADD_CONTENT, item.severity, item.message, item.message, {
          relatedCode: item.code,
          field: item.field
        })
      );
    }
  }

  for (const issue of validation.issues || []) {
    if (issue.code === "DUPLICATE_DATE_ENTRIES") {
      suggestions.push(
        suggestion(
          SUGGESTION_TYPES.REMOVE_DUPLICATE_DATES,
          issue.severity,
          "Remove duplicate dates",
          issue.message,
          { relatedCode: issue.code, value: issue.value }
        )
      );
    } else if (issue.code === "FEE_VALUE_MISMATCH" || issue.code === "VACANCY_TOTAL_MISMATCH" ||
               issue.code === "ELIGIBILITY_QUALIFICATION_CONFLICT" ||
               issue.code === "REFERENCE_NUMBER_INCONSISTENT" ||
               issue.code === "ADVERTISEMENT_NUMBER_INCONSISTENT" ||
               issue.code === "DATE_MISSING_FROM_IMPORTANT_DATES") {
      suggestions.push(
        suggestion(
          SUGGESTION_TYPES.RESOLVE_INCONSISTENCY,
          issue.severity,
          "Resolve cross-section inconsistency",
          issue.message,
          { relatedCode: issue.code, sectionType: issue.sectionType }
        )
      );
    } else if (issue.code === "TERMINOLOGY_INCONSISTENT") {
      suggestions.push(
        suggestion(
          SUGGESTION_TYPES.CORRECT_TERMINOLOGY,
          issue.severity,
          "Correct inconsistent terminology",
          issue.message,
          { relatedCode: issue.code, sectionType: issue.sectionType }
        )
      );
    } else if (issue.code === "SECTION_OUT_OF_ORDER") {
      // ordering suggestion added below
    }
  }

  if (ordering.suggestion) {
    suggestions.push(ordering.suggestion);
  } else if (ordering.needsReorder) {
    suggestions.push(
      suggestion(
        SUGGESTION_TYPES.MOVE_SECTION,
        SEVERITY.LOW,
        "Move sections into preferred order",
        ordering.explanation || "Reorder sections to match the standard recruitment page flow.",
        { recommendedOrder: ordering.recommendedOrder }
      )
    );
  }

  for (const link of links.duplicates || []) {
    suggestions.push(
      suggestion(
        SUGGESTION_TYPES.REMOVE_DUPLICATE_LINK,
        SEVERITY.MEDIUM,
        "Remove duplicate link",
        `Remove duplicate URL ${link.url}`,
        { url: link.url, label: link.label }
      )
    );
  }
  for (const link of links.broken || []) {
    suggestions.push(
      suggestion(
        SUGGESTION_TYPES.FIX_LINK,
        SEVERITY.HIGH,
        "Fix broken or placeholder link",
        `Replace ${link.url || "(empty)"} (${link.reason || "invalid"}).`,
        { url: link.url, label: link.label, reason: link.reason }
      )
    );
  }

  for (const issue of language.issues || []) {
    suggestions.push(
      suggestion(
        SUGGESTION_TYPES.FIX_LANGUAGE,
        issue.severity,
        issue.message,
        issue.suggestion || issue.message,
        { relatedCode: issue.code, sectionType: issue.sectionType }
      )
    );
  }

  // Structural heuristics: vacancy as paragraph → table; long how-to → bullets
  const vacancy = getSection(draft, SECTION_TYPES.VACANCY_DETAILS);
  if (vacancy && vacancy.wordCount >= 40 && !/[,|]\s*\w+/.test(vacancy.content) && !/\n.*,.*,/.test(vacancy.content)) {
    suggestions.push(
      suggestion(
        SUGGESTION_TYPES.CONVERT_TO_TABLE,
        SEVERITY.MEDIUM,
        "Convert Vacancy Details paragraph into a table",
        "Vacancy Details reads as prose; a Post / Category / Vacancy table is clearer for editors and readers.",
        { sectionType: SECTION_TYPES.VACANCY_DETAILS }
      )
    );
  }

  const how = getSection(draft, SECTION_TYPES.HOW_TO_APPLY);
  if (how && how.wordCount >= 40) {
    const lines = toLines(how.content);
    const hasBullets = lines.some((l) => /^[\-\*•\d]+[.)]\s+/.test(l));
    if (!hasBullets && lines.length <= 3) {
      suggestions.push(
        suggestion(
          SUGGESTION_TYPES.CONVERT_TO_BULLETS,
          SEVERITY.LOW,
          "Convert How To Apply paragraph into a bullet list",
          "Break application steps into a numbered or bulleted list.",
          { sectionType: SECTION_TYPES.HOW_TO_APPLY }
        )
      );
    }
  }

  // Merge duplicate paragraphs across short info + instructions
  const short = getSection(draft, SECTION_TYPES.SHORT_INFORMATION);
  const instructions = getSection(draft, SECTION_TYPES.IMPORTANT_INSTRUCTIONS);
  if (short && instructions) {
    const shortLines = new Set(toLines(short.content).map((l) => collapse(l).toLowerCase()).filter((l) => l.length > 40));
    const dupes = toLines(instructions.content).filter((l) => shortLines.has(collapse(l).toLowerCase()));
    if (dupes.length) {
      suggestions.push(
        suggestion(
          SUGGESTION_TYPES.MERGE_PARAGRAPHS,
          SEVERITY.LOW,
          "Merge duplicate paragraphs",
          "Important Instructions repeats content already present in Short Information.",
          { examples: dupes.slice(0, 2) }
        )
      );
    }
  }

  // Clearer section titles for unknown headings that look like known sections
  for (const sec of draft.unknownSections || []) {
    if (sec.title && sec.title.length > 60) {
      suggestions.push(
        suggestion(
          SUGGESTION_TYPES.RENAME_SECTION,
          SEVERITY.LOW,
          "Recommend clearer section title",
          `Unknown section title "${sec.title.slice(0, 80)}" is long; consider a short Generator-aligned heading.`,
          { currentTitle: sec.title }
        )
      );
    }
  }

  // Stable priority: Critical > High > Medium > Low, then type
  const rank = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  suggestions.sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9));

  // Cap noise while keeping actionable set
  const seenKeys = new Set();
  const deduped = [];
  for (const s of suggestions) {
    const key = `${s.type}|${s.title}|${s.relatedCode || ""}|${s.sectionType || ""}|${s.url || ""}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    deduped.push(s);
  }

  return deduped;
}

module.exports = {
  buildEditorSuggestions
};
