"use strict";

/**
 * PWP Phase 1 — In-memory audit trail (no DB / no schema changes).
 */

function createAuditTrail({ workflowId, startedAt } = {}) {
  return {
    workflowId: workflowId || null,
    startedAt: startedAt || new Date().toISOString(),
    finishedAt: null,
    durationMs: null,
    executedStages: [],
    skippedStages: [],
    timeline: [],
    warnings: [],
    errors: [],
    finalState: null
  };
}

function logTransition(audit, entry = {}) {
  const record = {
    at: entry.at || new Date().toISOString(),
    fromState: entry.fromState || null,
    toState: entry.toState || null,
    stageId: entry.stageId || null,
    status: entry.status || null,
    message: entry.message || null,
    durationMs: entry.durationMs != null ? entry.durationMs : null
  };
  audit.timeline.push(record);
  return record;
}

function recordStageExecution(audit, stageId, result, meta = {}) {
  const warnings = (result && result.warnings) || [];
  const errors = (result && result.errors) || [];
  audit.executedStages.push({
    stageId,
    status: result && result.status,
    at: meta.at || new Date().toISOString(),
    durationMs: meta.durationMs != null ? meta.durationMs : null
  });
  for (const warning of warnings) {
    audit.warnings.push({ stageId, warning });
  }
  for (const error of errors) {
    audit.errors.push({ stageId, error });
  }
}

function recordSkippedStage(audit, stageId, reason) {
  audit.skippedStages.push({ stageId, reason: reason || "downstream_halted" });
}

function finalizeAuditTrail(audit, finalState, finishedAt = new Date().toISOString()) {
  audit.finishedAt = finishedAt;
  audit.finalState = finalState;
  const start = Date.parse(audit.startedAt);
  const end = Date.parse(finishedAt);
  audit.durationMs =
    Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : null;
  return audit;
}

function buildWorkflowReport(audit, extras = {}) {
  return {
    workflowId: audit.workflowId,
    executionTimeline: audit.timeline.slice(),
    executedStages: audit.executedStages.slice(),
    skippedStages: audit.skippedStages.slice(),
    durationMs: audit.durationMs,
    warnings: audit.warnings.slice(),
    errors: audit.errors.slice(),
    finalState: audit.finalState,
    startedAt: audit.startedAt,
    finishedAt: audit.finishedAt,
    ...extras
  };
}

module.exports = {
  createAuditTrail,
  logTransition,
  recordStageExecution,
  recordSkippedStage,
  finalizeAuditTrail,
  buildWorkflowReport
};
