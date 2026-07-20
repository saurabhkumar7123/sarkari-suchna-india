"use strict";

/**
 * Recruitment pipeline feature flag (Phase 24).
 * Defaults to false. Missing or invalid env values fail safe to false.
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
  return parseEnvFlag(process.env[ENV_KEY]);
}

module.exports = {
  ENV_KEY,
  parseEnvFlag,
  isRecruitmentPipelineEnabled
};
