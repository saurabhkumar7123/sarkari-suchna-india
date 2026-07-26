"use strict";

/**
 * CIP Stage 2E — Editorial Decision Support types and constants.
 */

const ENGINE_ID = "CIP_EDITORIAL_DECISION_SUPPORT_ENGINE";
const STAGE_ID = "CIP_2E";
const ENGINE_VERSION = "1.0.0";
const DECISION_VERSION = "1.0.0";
const DECISION_SUPPORT_FORMAT_ID = "cip_editorial_decision_support_v1";

const REVIEW_PRIORITIES = Object.freeze({
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  URGENT: "URGENT"
});

const PRIORITY_RANK = Object.freeze({
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  URGENT: 4
});

const EDITORIAL_RISK_LEVELS = Object.freeze({
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL"
});

const RISK_RANK = Object.freeze({
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
});

const PUBLISH_READINESS_STATES = Object.freeze({
  READY: "ready",
  NEEDS_REVIEW: "needs_review",
  BLOCKED: "blocked"
});

const SEVERITIES = Object.freeze({
  ERROR: "error",
  WARNING: "warning",
  INFO: "info"
});

const SEVERITY_RANK = Object.freeze({
  info: 1,
  warning: 2,
  error: 3
});

function finding(code, severity, category, message, extra = {}) {
  const value = { code, severity, category, message };
  for (const key of Object.keys(extra).sort()) {
    if (extra[key] !== undefined) value[key] = extra[key];
  }
  return value;
}

function explanation(reason, supportingFinding, severity, affectedSection) {
  return {
    reason: String(reason || ""),
    supportingFinding: supportingFinding == null ? null : supportingFinding,
    severity: severity || SEVERITIES.INFO,
    affectedSection: affectedSection == null ? null : affectedSection
  };
}

module.exports = {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  DECISION_VERSION,
  DECISION_SUPPORT_FORMAT_ID,
  REVIEW_PRIORITIES,
  PRIORITY_RANK,
  EDITORIAL_RISK_LEVELS,
  RISK_RANK,
  PUBLISH_READINESS_STATES,
  SEVERITIES,
  SEVERITY_RANK,
  finding,
  explanation
};
