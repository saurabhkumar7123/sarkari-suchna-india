'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-5
 * Immutable Execution Result Summary
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const EXECUTION_RESULT_VERSION = 'MB5.1.0.0';

/**
 * Create an immutable execution summary.
 * @param {object} [input]
 */
function createExecutionResult(input = {}) {
  const src = input && typeof input === 'object' ? input : {};

  const started =
    typeof src.started === 'string' && src.started.trim()
      ? src.started.trim()
      : new Date().toISOString();
  const finished =
    typeof src.finished === 'string' && src.finished.trim()
      ? src.finished.trim()
      : new Date().toISOString();

  const startedMs = Date.parse(started);
  const finishedMs = Date.parse(finished);
  const durationMs =
    typeof src.durationMs === 'number' && Number.isFinite(src.durationMs)
      ? Math.max(0, Math.floor(src.durationMs))
      : Number.isFinite(startedMs) && Number.isFinite(finishedMs)
        ? Math.max(0, finishedMs - startedMs)
        : 0;

  const errors = Array.isArray(src.errors)
    ? src.errors.map((error) =>
        error && typeof error === 'object'
          ? { ...error }
          : { message: String(error) }
      )
    : [];
  const warnings = Array.isArray(src.warnings)
    ? src.warnings.map((warning) =>
        warning && typeof warning === 'object'
          ? { ...warning }
          : { message: String(warning) }
      )
    : [];

  return deepFreeze({
    resultVersion: EXECUTION_RESULT_VERSION,
    immutable: true,
    advisoryOnly: true,
    publishingDenied: true,
    automaticApprovalDenied: true,

    executionId:
      typeof src.executionId === 'string' && src.executionId.trim()
        ? src.executionId.trim()
        : null,
    source:
      typeof src.source === 'string' && src.source.trim()
        ? src.source.trim()
        : src.sourceId || null,
    sourceId:
      typeof src.sourceId === 'string' && src.sourceId.trim()
        ? src.sourceId.trim()
        : src.source || null,
    started,
    finished,
    durationMs,
    status:
      typeof src.status === 'string' && src.status.trim()
        ? src.status.trim()
        : errors.length
          ? 'FAILED'
          : 'COMPLETED',
    cancelled: src.cancelled === true,
    timedOut: src.timedOut === true,

    detectionResult: src.detectionResult != null ? src.detectionResult : null,
    extractionResult: src.extractionResult != null ? src.extractionResult : null,
    pipelineResult: src.pipelineResult != null ? src.pipelineResult : null,
    notificationResult:
      src.notificationResult != null ? src.notificationResult : null,
    reviewResult: src.reviewResult != null ? src.reviewResult : null,

    errors,
    warnings,
    diagnostics:
      src.diagnostics && typeof src.diagnostics === 'object'
        ? src.diagnostics
        : {},

    effects: deepFreeze({
      published: false,
      approved: false,
      databaseWritten: false,
      redisUsed: false,
      cronInstalled: false,
      osServiceStarted: false,
      expressRouteActivated: false,
      automaticRetry: false,
      telegramAutoSent: false,
      ...(src.effects && typeof src.effects === 'object'
        ? Object.fromEntries(
            Object.entries(src.effects).filter(
              ([key]) => key !== 'published' && key !== 'approved'
            )
          )
        : {}),
    }),
  });
}

module.exports = {
  EXECUTION_RESULT_VERSION,
  createExecutionResult,
};
