"use strict";

/**
 * Phase AI-4 — Concise editor briefing.
 */

const { EFFORT_LEVELS, SEVERITY } = require("./types");

/**
 * @param {object} parts
 * @returns {string}
 */
function estimateEffort(parts = {}) {
  const critical =
    (parts.missingInformation?.counts?.critical || 0) +
    (parts.validationIssues?.counts?.critical || 0);
  const high =
    (parts.missingInformation?.counts?.high || 0) +
    (parts.validationIssues?.counts?.high || 0) +
    (parts.linkValidation?.broken?.length || 0);
  const medium =
    (parts.missingInformation?.counts?.medium || 0) +
    (parts.validationIssues?.counts?.medium || 0) +
    (parts.editorSuggestions?.length || 0) / 4;
  const languageHeavy = (parts.languageQuality?.issues || []).some(
    (i) => i.severity === SEVERITY.HIGH
  );

  if (critical >= 3 || (critical >= 2 && high >= 3) || languageHeavy && critical >= 1) {
    return EFFORT_LEVELS.HEAVY;
  }
  if (critical >= 1 || high >= 4) return EFFORT_LEVELS.SUBSTANTIAL;
  if (high >= 2 || medium >= 5) return EFFORT_LEVELS.MODERATE;
  if (high >= 1 || medium >= 2) return EFFORT_LEVELS.LIGHT;
  return EFFORT_LEVELS.MINIMAL;
}

/**
 * @param {object} parts
 * @returns {object}
 */
function buildEditorSummary(parts = {}) {
  const quality = parts.qualityScores || {};
  const overall = quality.overall || { score: 0, level: "VERY_LOW" };
  const missing = parts.missingInformation || { items: [], counts: {} };
  const validation = parts.validationIssues || { issues: [], counts: {} };
  const suggestions = parts.editorSuggestions || [];
  const confidence = parts.confidence || { score: 0, level: "VERY_LOW" };
  const draft = parts.draft || {};

  const criticalIssues = [
    ...(validation.issues || []).filter((i) => i.severity === SEVERITY.CRITICAL),
    ...(missing.items || []).filter((i) => i.severity === SEVERITY.CRITICAL),
    ...(parts.linkValidation?.issues || []).filter((i) => i.severity === SEVERITY.CRITICAL)
  ].map((i) => ({
    code: i.code,
    message: i.message,
    severity: i.severity
  }));

  const recommendedImprovements = suggestions.slice(0, 8).map((s) => ({
    type: s.type,
    title: s.title,
    severity: s.severity
  }));

  const missingInformation = (missing.items || []).slice(0, 12).map((i) => ({
    code: i.code,
    message: i.message,
    severity: i.severity
  }));

  const effort = estimateEffort(parts);

  const briefing = [
    `Profile: ${draft.profile || "unknown"}.`,
    `Overall quality ${overall.score}/100 (${overall.level}).`,
    criticalIssues.length
      ? `${criticalIssues.length} critical issue(s) need attention before approval.`
      : "No critical issues detected.",
    missingInformation.length
      ? `${missingInformation.length} missing-information item(s) flagged.`
      : "Expected information appears present for this profile.",
    `Estimated manual editing effort: ${effort}.`,
    `Analysis confidence: ${Math.round((confidence.score || 0) * 100)}% (${confidence.level}).`,
    "Advisory only — draft was not modified."
  ].join(" ");

  return {
    overallQuality: {
      score: overall.score,
      level: overall.level,
      explanation: overall.explanation
    },
    criticalIssues,
    recommendedImprovements,
    missingInformation,
    confidence: {
      score: confidence.score,
      level: confidence.level
    },
    estimatedManualEditingEffort: effort,
    profile: draft.profile || null,
    title: draft.title || null,
    briefing,
    advisoryOnly: true,
    appliesChanges: false
  };
}

module.exports = {
  estimateEffort,
  buildEditorSummary
};
