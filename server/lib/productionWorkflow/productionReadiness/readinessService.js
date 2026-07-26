"use strict";

/**
 * PWP Phase 5 — Shared, read-only production readiness service.
 */

const {
  READINESS_SERVICE_ID,
  READINESS_SERVICE_VERSION,
  PHASE,
  REPORT_FORMAT_ID,
  READINESS_LEVELS,
  HEALTH_LEVELS,
  STAGE_HEALTH
} = require("./readinessTypes");
const { buildProductionReadinessManifest } = require("./readinessManifest");
const { validateProductionManifest } = require("./validation");
const {
  buildWorkflowDiagnostics,
  buildObservabilitySummary
} = require("./observability");

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function uniqueFindings(entries) {
  const seen = new Set();
  const result = [];
  for (const entry of entries) {
    const key =
      entry && typeof entry === "object"
        ? JSON.stringify(entry)
        : String(entry);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(entry);
    }
  }
  return result;
}

function resolveReadinessLevel({ validation, diagnostics, warnings, errors }) {
  if (
    validation.blocked ||
    diagnostics.some((stage) => stage.status === STAGE_HEALTH.BLOCKED)
  ) {
    return READINESS_LEVELS.BLOCKED;
  }
  if (
    errors.length > 0 ||
    diagnostics.some((stage) =>
      [STAGE_HEALTH.FAILED, STAGE_HEALTH.MISSING].includes(stage.status)
    )
  ) {
    return READINESS_LEVELS.NOT_READY;
  }
  if (
    warnings.length > 0 ||
    diagnostics.some((stage) =>
      [STAGE_HEALTH.WARNING, STAGE_HEALTH.SKIPPED].includes(stage.status)
    )
  ) {
    return READINESS_LEVELS.READY_WITH_WARNINGS;
  }
  return READINESS_LEVELS.READY;
}

function healthFromReadiness(readinessLevel) {
  if (readinessLevel === READINESS_LEVELS.READY) return HEALTH_LEVELS.HEALTHY;
  if (readinessLevel === READINESS_LEVELS.READY_WITH_WARNINGS) {
    return HEALTH_LEVELS.DEGRADED;
  }
  if (readinessLevel === READINESS_LEVELS.BLOCKED) return HEALTH_LEVELS.BLOCKED;
  return HEALTH_LEVELS.UNHEALTHY;
}

/**
 * Evaluate static wiring and, optionally, an existing workflow result.
 * It performs no workflow, database, network, generator, editorial, or publish action.
 *
 * @param {object} [options]
 * @param {object} [options.manifestOverrides] deterministic test/operator overrides
 * @param {object} [options.execution] existing workflow result or report to summarize
 * @returns {Readonly<object>} immutable readiness report
 */
function evaluateProductionReadiness({ manifestOverrides = {}, execution = null } = {}) {
  const manifest = buildProductionReadinessManifest(manifestOverrides);
  const validation = validateProductionManifest(manifest);
  const diagnostics = buildWorkflowDiagnostics({
    manifest,
    validation,
    execution
  });
  const observability = buildObservabilitySummary({
    diagnostics,
    validation,
    execution
  });
  const diagnosticWarnings = diagnostics.flatMap((stage) =>
    [
      ...stage.warnings.map((warning) => ({ stageId: stage.stageId, warning })),
      ...(stage.status === STAGE_HEALTH.SKIPPED
        ? [
            {
              stageId: stage.stageId,
              warning: {
                code: "STAGE_SKIPPED",
                message: stage.skippedReason || "Stage was skipped."
              }
            }
          ]
        : [])
    ]
  );
  const diagnosticErrors = diagnostics.flatMap((stage) =>
    stage.errors.map((error) => ({ stageId: stage.stageId, error }))
  );
  const warnings = uniqueFindings([...validation.warnings, ...diagnosticWarnings]);
  const errors = uniqueFindings([...validation.errors, ...diagnosticErrors]);
  const readinessLevel = resolveReadinessLevel({
    validation,
    diagnostics,
    warnings,
    errors
  });
  const overallHealth = healthFromReadiness(readinessLevel);

  const health = {
    overallHealth,
    stageHealth: diagnostics.map((stage) => ({
      stageId: stage.stageId,
      stageName: stage.stageName,
      status: stage.status
    })),
    warnings,
    errors,
    blockedStages: diagnostics
      .filter((stage) =>
        [STAGE_HEALTH.BLOCKED, STAGE_HEALTH.FAILED, STAGE_HEALTH.MISSING].includes(stage.status)
      )
      .map((stage) => stage.stageId),
    readyStages: diagnostics
      .filter((stage) =>
        [STAGE_HEALTH.READY, STAGE_HEALTH.WARNING].includes(stage.status)
      )
      .map((stage) => stage.stageId)
  };

  const report = {
    formatId: REPORT_FORMAT_ID,
    serviceId: READINESS_SERVICE_ID,
    serviceVersion: READINESS_SERVICE_VERSION,
    phase: PHASE,
    readinessLevel,
    ready:
      readinessLevel === READINESS_LEVELS.READY ||
      readinessLevel === READINESS_LEVELS.READY_WITH_WARNINGS,
    overallHealth,
    health,
    diagnostics,
    observability,
    validation,
    productionGates: {
      autoPublishEnabled: manifest.gates.autoPublishEnabled,
      autoPublishBlocked: manifest.gates.autoPublishBlocked,
      manualPublishOnly: manifest.gates.manualPublishOnly,
      manualApprovalRequired: manifest.gates.manualApprovalRequired,
      noBypassPath: manifest.gates.noBypassPath
    },
    effects: {
      readOnly: true,
      executesWorkflow: false,
      modifiesRuntime: false,
      usesNetwork: false,
      usesDatabase: false,
      usesAi: false,
      invokesGenerator: false,
      invokesEditorialActions: false,
      sendsTelegram: false,
      publishes: false
    }
  };

  return deepFreeze(report);
}

module.exports = {
  deepFreeze,
  resolveReadinessLevel,
  evaluateProductionReadiness
};
