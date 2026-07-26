"use strict";

const CAPABILITY_KEYS = Object.freeze([
  "supportsStructuredOutput",
  "supportsLongContext",
  "supportsToolCalling",
  "supportsReasoning",
  "supportsVision",
  "supportsStreaming"
]);

function buildCapabilityProfile(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const profile = {
    id: source.id == null ? null : String(source.id),
    description: source.description == null ? null : String(source.description)
  };
  for (const key of CAPABILITY_KEYS) {
    profile[key] = typeof source[key] === "boolean" ? source[key] : null;
  }
  profile.descriptiveOnly = true;
  profile.providerIntegrated = false;
  return profile;
}

module.exports = { CAPABILITY_KEYS, buildCapabilityProfile };
