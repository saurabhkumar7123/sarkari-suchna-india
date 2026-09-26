"use strict";

/**
 * Recruitment pipeline feature flag (Phase 24).
 * Defaults to false. Missing or invalid values fail safe to false.
 * When durable control plane file exists, it is the shared source of truth
 * (same rule as other automation capabilities). Env is bootstrap fallback only.
 */

const ENV_KEY = "RECRUITMENT_PIPELINE_ENABLED";

const TRUTHY = new Set(["1", "true", "yes", "on"]);
const FALSY = new Set(["0", "false", "no", "off", ""]);

function parseEnvFlag(rawValue) {
  if (rawValue === undefined || rawValue === null) {
    return false;
  }

  const normalized = String(rawValue).trim().toLowerCase();
  if (FALSY.has(normalized)) {
    return false;
  }
  if (TRUTHY.has(normalized)) {
    return true;
  }

  return false;
}

function isRecruitmentPipelineEnabled() {
  try {
    const { getDurableCapability } = require("./automationControlPlane");
    return getDurableCapability(ENV_KEY) === true;
  } catch {
    return parseEnvFlag(process.env[ENV_KEY]);
  }
}

module.exports = {
  ENV_KEY,
  parseEnvFlag,
  isRecruitmentPipelineEnabled
};
