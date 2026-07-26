"use strict";

/**
 * PWP Phase 5 — Production readiness taxonomy.
 * Deterministic, read-only constants only.
 */

const READINESS_SERVICE_ID = "PWP_PRODUCTION_READINESS_SERVICE";
const READINESS_SERVICE_VERSION = "1.0.0";
const PHASE = "PHASE_5";
const REPORT_FORMAT_ID = "pwp_production_readiness_report_v1";

const READINESS_LEVELS = Object.freeze({
  READY: "READY",
  READY_WITH_WARNINGS: "READY_WITH_WARNINGS",
  NOT_READY: "NOT_READY",
  BLOCKED: "BLOCKED"
});

const HEALTH_LEVELS = Object.freeze({
  HEALTHY: "HEALTHY",
  DEGRADED: "DEGRADED",
  UNHEALTHY: "UNHEALTHY",
  BLOCKED: "BLOCKED"
});

const STAGE_HEALTH = Object.freeze({
  READY: "READY",
  WARNING: "WARNING",
  FAILED: "FAILED",
  BLOCKED: "BLOCKED",
  MISSING: "MISSING",
  SKIPPED: "SKIPPED"
});

const CHECK_SEVERITY = Object.freeze({
  WARNING: "WARNING",
  ERROR: "ERROR",
  BLOCKING: "BLOCKING"
});

module.exports = {
  READINESS_SERVICE_ID,
  READINESS_SERVICE_VERSION,
  PHASE,
  REPORT_FORMAT_ID,
  READINESS_LEVELS,
  HEALTH_LEVELS,
  STAGE_HEALTH,
  CHECK_SEVERITY
};
