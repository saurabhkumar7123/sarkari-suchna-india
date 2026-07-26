"use strict";

/**
 * PWP Phase 4 — Structured Diff Model for update drafts.
 * Comparison metadata only. Never rewrites content. Never generates HTML.
 */

const { SECTION_ACTIONS } = require("../generatorIntegration/integrationTypes");

function emptyDiff() {
  return Object.freeze({
    affectedSections: Object.freeze([]),
    unaffectedSections: Object.freeze([]),
    addedSections: Object.freeze([]),
    removedSections: Object.freeze([]),
    modifiedSections: Object.freeze([]),
    changeSummary: null,
    rewriteContent: false,
    generatesHtml: false
  });
}

function sectionsByAction(sectionActions, action) {
  if (!sectionActions || typeof sectionActions !== "object") return [];
  return Object.keys(sectionActions)
    .filter((section) => sectionActions[section] === action)
    .sort();
}

/**
 * Build a structured comparison from Draft Package / Update Package.
 * For non-update drafts returns empty section lists + optional changeSummary.
 */
function buildDiffModel({
  draftPackage = null,
  existingPageMetadata = null
} = {}) {
  if (!draftPackage || typeof draftPackage !== "object") {
    return emptyDiff();
  }

  const updatePackage =
    draftPackage.updatePackage ||
    (draftPackage.updatePlan &&
    draftPackage.updatePlan.sectionActions
      ? draftPackage.updatePlan
      : null) ||
    null;

  const changeSummary =
    (updatePackage && updatePackage.changeSummary) ||
    draftPackage.changeSummary ||
    null;

  if (!updatePackage) {
    return Object.freeze({
      affectedSections: Object.freeze([]),
      unaffectedSections: Object.freeze([]),
      addedSections: Object.freeze([]),
      removedSections: Object.freeze([]),
      modifiedSections: Object.freeze([]),
      changeSummary: changeSummary || null,
      pageReference: draftPackage.pageReference || null,
      existingPageId:
        (existingPageMetadata &&
          (existingPageMetadata.pageId || existingPageMetadata.id)) ||
        (draftPackage.pageReference && draftPackage.pageReference.pageId) ||
        null,
      rewriteContent: false,
      generatesHtml: false
    });
  }

  const sectionActions = updatePackage.sectionActions || {};
  const affectedSections = Array.isArray(updatePackage.affectedSections)
    ? updatePackage.affectedSections.slice().sort()
    : [];
  const unaffectedSections = Array.isArray(updatePackage.unaffectedSections)
    ? updatePackage.unaffectedSections.slice().sort()
    : [];

  return Object.freeze({
    affectedSections: Object.freeze(affectedSections),
    unaffectedSections: Object.freeze(unaffectedSections),
    addedSections: Object.freeze(sectionsByAction(sectionActions, SECTION_ACTIONS.ADD)),
    removedSections: Object.freeze(sectionsByAction(sectionActions, SECTION_ACTIONS.REMOVE)),
    modifiedSections: Object.freeze(sectionsByAction(sectionActions, SECTION_ACTIONS.UPDATE)),
    changeSummary: changeSummary || null,
    sectionActions: Object.freeze({ ...sectionActions }),
    pageReference: draftPackage.pageReference || null,
    existingPageId:
      (existingPageMetadata &&
        (existingPageMetadata.pageId || existingPageMetadata.id)) ||
      (draftPackage.pageReference && draftPackage.pageReference.pageId) ||
      null,
    rewriteContent: false,
    generatesHtml: false
  });
}

module.exports = {
  buildDiffModel,
  emptyDiff,
  sectionsByAction
};
