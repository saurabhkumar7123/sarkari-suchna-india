"use strict";

/**
 * CIP Stage 2E — Shared Editorial Decision Support Engine.
 *
 * Analyzes a Stage 2D Generator-ready document and assists human editors
 * with prioritized, explainable review guidance.
 *
 * Manual PDF and automation workflows use the same exported engine.
 * Never calls a model, network, or provider SDK.
 * Never publishes, modifies content, or auto-approves.
 */

const engine = require("./editorialDecisionSupportEngine");
const types = require("./decisionTypes");
const analyzer = require("./editorialAnalyzer");
const changeSummary = require("./changeSummary");
const prioritizer = require("./reviewPrioritizer");
const checklist = require("./checklistGenerator");
const decisionSupport = require("./decisionSupport");
const telegram = require("./telegramSummary");
const explainability = require("./explainability");

module.exports = {
  ENGINE_ID: engine.ENGINE_ID,
  STAGE_ID: engine.STAGE_ID,
  ENGINE_VERSION: engine.ENGINE_VERSION,
  DECISION_VERSION: engine.DECISION_VERSION,
  DECISION_SUPPORT_FORMAT_ID: types.DECISION_SUPPORT_FORMAT_ID,
  REVIEW_PRIORITIES: types.REVIEW_PRIORITIES,
  EDITORIAL_RISK_LEVELS: types.EDITORIAL_RISK_LEVELS,
  PUBLISH_READINESS_STATES: types.PUBLISH_READINESS_STATES,

  supportEditorialDecision: engine.supportEditorialDecision,
  supportFromGeneratorReadyDocument: engine.supportFromGeneratorReadyDocument,
  supportFromTransformationResult: engine.supportFromTransformationResult,

  analyzeEditorialDocument: analyzer.analyzeEditorialDocument,
  buildChangeSummary: changeSummary.buildChangeSummary,
  determineReviewPriority: prioritizer.determineReviewPriority,
  generateReviewChecklist: checklist.generateReviewChecklist,
  buildDecisionSupport: decisionSupport.buildDecisionSupport,
  buildTelegramSummary: telegram.buildTelegramSummary,
  collectKeyFindings: explainability.collectKeyFindings,
  collectSuggestedReviewAreas: explainability.collectSuggestedReviewAreas,
  deepFreeze: engine.deepFreeze
};
