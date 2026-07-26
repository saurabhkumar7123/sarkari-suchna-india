"use strict";

/**
 * PWP Phase 3 — Update Package builder.
 * Determines affected / unaffected sections and explicit section actions.
 * Generator must never guess.
 */

const {
  CHANGE_TYPES
} = require("../../contentIntelligence/multiSourceCorrelation/correlationTypes");
const { PAGE_SECTIONS } = require("../recruitmentResolution/resolutionTypes");
const {
  resolveExistingSections,
  mapChangeToSection,
  planUpdateScope
} = require("../recruitmentResolution/updatePlanner");
const { SECTION_ACTIONS } = require("./integrationTypes");

function collectRemovedSections(changeSummary) {
  const removed = new Set();
  const details =
    (changeSummary && Array.isArray(changeSummary.details) && changeSummary.details) || [];
  for (const detail of details) {
    if (!detail || detail.changeType !== CHANGE_TYPES.SECTION_REMOVED) continue;
    const section =
      detail.section ||
      mapChangeToSection({
        changeType: CHANGE_TYPES.SECTION_REMOVED,
        previousValue: detail.previousValue,
        currentValue: detail.currentValue,
        section: detail.section
      });
    if (section) removed.add(section);
  }
  return removed;
}

function collectAddedSections(changeSummary, existingSet) {
  const added = new Set();
  const details =
    (changeSummary && Array.isArray(changeSummary.details) && changeSummary.details) || [];
  for (const detail of details) {
    if (!detail) continue;
    if (detail.changeType === CHANGE_TYPES.SECTION_ADDED) {
      const section =
        detail.section ||
        mapChangeToSection({
          changeType: CHANGE_TYPES.SECTION_ADDED,
          previousValue: detail.previousValue,
          currentValue: detail.currentValue,
          section: detail.section
        });
      if (section) added.add(section);
      continue;
    }
    if (detail.section && !existingSet.has(detail.section)) {
      added.add(detail.section);
    }
  }
  return added;
}

/**
 * Build an explicit Update Package from an Update Plan (+ optional page metadata).
 */
function buildUpdatePackage({
  updatePlan = null,
  existingPage = null,
  existingPageMetadata = null,
  detectedChanges = []
} = {}) {
  const page = existingPageMetadata || existingPage || null;
  const plan =
    updatePlan ||
    planUpdateScope({
      existingPage: page,
      detectedChanges
    });

  const existingSections = resolveExistingSections(page);
  const existingSet = new Set(existingSections);
  const affectedSections = Array.isArray(plan.affectedSections)
    ? plan.affectedSections.slice().sort()
    : [];
  const unaffectedSections = Array.isArray(plan.unaffectedSections)
    ? plan.unaffectedSections.slice().sort()
    : existingSections.filter((s) => !affectedSections.includes(s)).sort();

  const removedSet = collectRemovedSections(plan.changeSummary);
  const addedSet = collectAddedSections(plan.changeSummary, existingSet);

  const sectionActions = {};
  const allSections = new Set([
    ...existingSections,
    ...affectedSections,
    ...unaffectedSections,
    ...addedSet,
    ...removedSet
  ]);

  // Ensure OTHER never appears unless present in plan
  if (!allSections.has(PAGE_SECTIONS.OTHER) && !affectedSections.includes(PAGE_SECTIONS.OTHER)) {
    allSections.delete(PAGE_SECTIONS.OTHER);
  }

  for (const section of [...allSections].sort()) {
    if (removedSet.has(section)) {
      sectionActions[section] = SECTION_ACTIONS.REMOVE;
      continue;
    }
    if (addedSet.has(section) || (!existingSet.has(section) && affectedSections.includes(section))) {
      sectionActions[section] = SECTION_ACTIONS.ADD;
      continue;
    }
    if (affectedSections.includes(section)) {
      sectionActions[section] = SECTION_ACTIONS.UPDATE;
      continue;
    }
    sectionActions[section] = SECTION_ACTIONS.NO_CHANGE;
  }

  const actionEntries = Object.keys(sectionActions)
    .sort()
    .map((section) =>
      Object.freeze({
        section,
        action: sectionActions[section]
      })
    );

  return Object.freeze({
    affectedSections: Object.freeze(affectedSections.slice()),
    unaffectedSections: Object.freeze(unaffectedSections.slice()),
    sectionActions: Object.freeze({ ...sectionActions }),
    sectionActionList: Object.freeze(actionEntries),
    suggestedUpdateScope: plan.suggestedUpdateScope || "none",
    changeSummary: plan.changeSummary || null,
    rewriteContent: false,
    overwriteUnrelatedSections: false,
    sourceUpdatePlan: plan
  });
}

module.exports = {
  buildUpdatePackage,
  collectRemovedSections,
  collectAddedSections
};
