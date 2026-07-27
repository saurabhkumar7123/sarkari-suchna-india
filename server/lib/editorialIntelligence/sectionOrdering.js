"use strict";

/**
 * Phase AI-4 — Section ordering recommendations.
 * Never reorders automatically — advice only.
 */

const { PREFERRED_SECTION_ORDER, SECTION_TYPE_TO_TITLE, VALIDATION_CODES, SEVERITY, SUGGESTION_TYPES } = require("./types");

/**
 * @param {object} draft
 * @returns {{
 *   currentOrder: Array<object>,
 *   recommendedOrder: Array<object>,
 *   needsReorder: boolean,
 *   displacements: Array<object>,
 *   issues: object[],
 *   suggestion: object|null,
 *   explanation: string
 * }}
 */
function recommendSectionOrder(draft) {
  const known = (draft.sections || []).filter((s) => s.sectionType !== "unknown");
  const unknown = (draft.sections || []).filter((s) => s.sectionType === "unknown");

  const currentOrder = (draft.sections || []).map((s) => ({
    order: s.order,
    sectionType: s.sectionType,
    title: s.generatorTitle || SECTION_TYPE_TO_TITLE[s.sectionType] || s.title
  }));

  const preferredIndex = new Map(PREFERRED_SECTION_ORDER.map((t, i) => [t, i]));

  const sortedKnown = [...known].sort((a, b) => {
    const ai = preferredIndex.has(a.sectionType) ? preferredIndex.get(a.sectionType) : 1000;
    const bi = preferredIndex.has(b.sectionType) ? preferredIndex.get(b.sectionType) : 1000;
    if (ai !== bi) return ai - bi;
    return a.order - b.order;
  });

  const recommendedOrder = [...sortedKnown, ...unknown].map((s, idx) => ({
    order: idx,
    sectionType: s.sectionType,
    title: s.generatorTitle || SECTION_TYPE_TO_TITLE[s.sectionType] || s.title,
    preservedUnknown: s.sectionType === "unknown"
  }));

  const displacements = [];
  for (let i = 0; i < known.length; i++) {
    const currentType = known[i].sectionType;
    const recommendedIdx = sortedKnown.findIndex((s) => s === known[i] || s.sectionType === currentType && s.order === known[i].order);
    // Compare sequence of types
  }

  const currentTypes = known.map((s) => s.sectionType);
  const recommendedTypes = sortedKnown.map((s) => s.sectionType);
  let needsReorder = false;
  for (let i = 0; i < currentTypes.length; i++) {
    if (currentTypes[i] !== recommendedTypes[i]) {
      needsReorder = true;
      displacements.push({
        sectionType: currentTypes[i],
        title: SECTION_TYPE_TO_TITLE[currentTypes[i]] || currentTypes[i],
        currentIndex: i,
        recommendedIndex: recommendedTypes.indexOf(currentTypes[i])
      });
    }
  }

  // Collapse duplicate displacement entries for same type
  const seen = new Set();
  const uniqueDisplacements = [];
  for (const d of displacements) {
    if (seen.has(d.sectionType)) continue;
    seen.add(d.sectionType);
    uniqueDisplacements.push(d);
  }

  const issues = [];
  if (needsReorder && uniqueDisplacements.length) {
    issues.push({
      code: VALIDATION_CODES.SECTION_OUT_OF_ORDER,
      severity: SEVERITY.LOW,
      message: `Section order differs from preferred Generator order (${uniqueDisplacements.length} displacement(s)).`,
      displacements: uniqueDisplacements,
      advisoryOnly: true
    });
  }

  const suggestion = needsReorder
    ? {
        type: SUGGESTION_TYPES.REORDER_SECTIONS,
        severity: SEVERITY.LOW,
        title: "Recommend preferred section order",
        detail:
          "Consider reordering sections to match the standard recruitment page flow. Unknown sections stay preserved at the end of their relative positions.",
        recommendedOrder,
        appliesChanges: false,
        advisoryOnly: true
      }
    : null;

  return {
    currentOrder,
    recommendedOrder,
    needsReorder,
    displacements: uniqueDisplacements,
    issues,
    suggestion,
    explanation: needsReorder
      ? `Recommended a different section order (${uniqueDisplacements.length} section(s) displaced). No automatic reorder applied.`
      : "Current section order matches the preferred Generator flow (or has no known sections to compare)."
  };
}

module.exports = {
  recommendSectionOrder
};
