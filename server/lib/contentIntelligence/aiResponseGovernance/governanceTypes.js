"use strict";

const ENGINE_ID = "CIP_AI_RESPONSE_GOVERNANCE_ENGINE";
const STAGE_ID = "CIP_2C";
const ENGINE_VERSION = "1.0.0";
const CONTRACT_VERSION = "1.0.0";
const GOVERNED_DRAFT_FORMAT_ID = "cip_governed_ai_draft_v1";

const RISK_LEVELS = Object.freeze({
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL"
});

const RISK_RANK = Object.freeze({ LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 });

const READINESS_STATUSES = Object.freeze({
  READY: "ready",
  NEEDS_REVIEW: "needs_review",
  BLOCKED: "blocked"
});

function finding(code, severity, category, message, extra = {}) {
  const value = { code, severity, category, message };
  for (const key of Object.keys(extra).sort()) {
    if (extra[key] !== undefined) value[key] = extra[key];
  }
  return value;
}

module.exports = {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  CONTRACT_VERSION,
  GOVERNED_DRAFT_FORMAT_ID,
  RISK_LEVELS,
  RISK_RANK,
  READINESS_STATUSES,
  finding
};
