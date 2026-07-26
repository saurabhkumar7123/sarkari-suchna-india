"use strict";

/**
 * CIP Stage 2E — Decision support assembly.
 * Advisory only: never decides publish.
 */

const { collectKeyFindings, collectSuggestedReviewAreas, buildDecisionExplanation } = require("./explainability");

function buildDecisionSupport({
  analysis,
  changeSummary,
  priorityResult,
  checklist
}) {
  const publishReadiness = analysis.publishReadiness || {
    status: "needs_review",
    ready: false,
    reason: "Review required."
  };
  const editorialRisk = analysis.editorialRisk || { overall: "LOW", findings: [] };
  const keyFindings = collectKeyFindings(analysis);
  const suggestedReviewAreas = collectSuggestedReviewAreas(analysis, changeSummary, checklist);
  const explanation = buildDecisionExplanation(priorityResult, analysis, publishReadiness);

  const decisionSummary = [
    `Document type: ${analysis.documentTypeLabel || analysis.documentType}`,
    `Review priority: ${priorityResult.priority}`,
    `Publish readiness (advisory): ${publishReadiness.status}`,
    `Editorial risk: ${editorialRisk.overall}`,
    `Key findings: ${keyFindings.length}`,
    `Checklist items: ${checklist.length}`,
    "Manual approval mandatory. No auto-publish."
  ].join(" | ");

  return {
    reviewPriority: priorityResult.priority,
    publishReadiness: {
      status: publishReadiness.status,
      ready: false, // Stage 2E never asserts publish-ready for automated action
      advisoryReady: Boolean(publishReadiness.ready),
      reason: publishReadiness.reason,
      humanApprovalMandatory: true,
      autoPublish: false,
      autoApprove: false
    },
    editorialRisk: {
      overall: editorialRisk.overall,
      findings: editorialRisk.findings || []
    },
    keyFindings,
    suggestedReviewAreas,
    reviewChecklist: checklist,
    decisionSummary,
    explanation,
    changeSummary,
    constraints: {
      publishes: false,
      modifiesContent: false,
      autoApproves: false,
      usesAi: false,
      usesNetwork: false
    }
  };
}

module.exports = { buildDecisionSupport };
