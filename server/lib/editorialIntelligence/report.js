"use strict";

/**
 * Phase AI-4 — Namespaced editorialIntelligence report object.
 *
 * Additive only: attach under one key. Production Workflow behaviour is
 * unchanged because every original field keeps its original value.
 */

const { deepFreeze } = require("../noticeIntelligence/textUtils");
const { ENGINE_VERSION, FORMAT_ID, PHASE } = require("./types");

/** Key used to attach AI-4 output. */
const EDITORIAL_FIELD = "editorialIntelligence";

/**
 * Assemble the frozen advisory report.
 * @param {object} parts
 * @returns {object}
 */
function buildEditorialReport(parts = {}) {
  const draft = parts.draft || {};

  const report = {
    formatId: FORMAT_ID,
    engineVersion: ENGINE_VERSION,
    phase: PHASE,
    advisoryOnly: true,
    appliesChanges: false,
    generatedAt: parts.generatedAt || new Date().toISOString(),

    profile: draft.profile || null,
    title: draft.title || null,
    eventType: draft.eventType || null,
    language: draft.language || null,
    draftSource: draft.source || null,

    qualityScores: parts.qualityScores || null,
    validationIssues: parts.validationIssues || null,
    missingInformation: parts.missingInformation || null,
    editorSuggestions: parts.editorSuggestions || [],
    editorSummary: parts.editorSummary || null,
    confidence: parts.confidence || null,

    languageQuality: parts.languageQuality || null,
    linkValidation: parts.linkValidation || null,
    sectionOrdering: parts.sectionOrdering
      ? {
          needsReorder: parts.sectionOrdering.needsReorder,
          currentOrder: parts.sectionOrdering.currentOrder,
          recommendedOrder: parts.sectionOrdering.recommendedOrder,
          displacements: parts.sectionOrdering.displacements,
          explanation: parts.sectionOrdering.explanation
        }
      : null,
    completeness: parts.completeness || null,

    unknownSectionsPreserved: (draft.unknownSections || []).map((s) => ({
      title: s.title || s.generatorTitle,
      order: s.order
    }))
  };

  return deepFreeze(report);
}

/**
 * Attach editorial intelligence without altering the original object.
 * @param {object} original
 * @param {object} report
 * @returns {object}
 */
function attachEditorialIntelligence(original, report) {
  const base = original && typeof original === "object" ? original : {};
  return {
    ...base,
    [EDITORIAL_FIELD]: report || null
  };
}

/**
 * @param {object} target
 * @returns {object|null}
 */
function readEditorialIntelligence(target) {
  if (!target || typeof target !== "object") return null;
  const value = target[EDITORIAL_FIELD];
  return value && typeof value === "object" ? value : null;
}

module.exports = {
  EDITORIAL_FIELD,
  buildEditorialReport,
  attachEditorialIntelligence,
  readEditorialIntelligence
};
