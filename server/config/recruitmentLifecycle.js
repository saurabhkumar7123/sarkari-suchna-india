"use strict";

/**
 * Recruitment Lifecycle feature flags (Phase 1 scaffold).
 * All flags default to false. Missing or invalid env values fail safe to false.
 * Not imported by runtime until a later rollout phase enables it.
 */

const ENV_KEYS = Object.freeze({
  DATA_PRESENCE: "RECRUITMENT_LIFECYCLE_DATA_PRESENCE_ENABLED",
  READ_AWARENESS: "RECRUITMENT_LIFECYCLE_READ_AWARENESS_ENABLED",
  EDITORIAL_ATTACHMENT: "RECRUITMENT_LIFECYCLE_EDITORIAL_ATTACHMENT_ENABLED",
  MONITORING_MATCH: "RECRUITMENT_LIFECYCLE_MONITORING_MATCH_ENABLED",
  PUBLIC_LIFECYCLE: "RECRUITMENT_LIFECYCLE_PUBLIC_LIFECYCLE_ENABLED"
});

const FLAG_GROUPS = Object.freeze({
  A: {
    id: "A",
    name: "Recruitment Data Presence",
    envKey: ENV_KEYS.DATA_PRESENCE,
    getter: "isRecruitmentDataPresenceEnabled"
  },
  B: {
    id: "B",
    name: "Recruitment Read Awareness",
    envKey: ENV_KEYS.READ_AWARENESS,
    getter: "isRecruitmentReadAwarenessEnabled"
  },
  C: {
    id: "C",
    name: "Editorial Attachment",
    envKey: ENV_KEYS.EDITORIAL_ATTACHMENT,
    getter: "isRecruitmentEditorialAttachmentEnabled"
  },
  D: {
    id: "D",
    name: "Monitoring Matching",
    envKey: ENV_KEYS.MONITORING_MATCH,
    getter: "isRecruitmentMonitoringMatchEnabled"
  },
  E: {
    id: "E",
    name: "Public Lifecycle",
    envKey: ENV_KEYS.PUBLIC_LIFECYCLE,
    getter: "isRecruitmentPublicLifecycleEnabled"
  }
});

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

function readFlag(envKey) {
  return parseEnvFlag(process.env[envKey]);
}

function isRecruitmentDataPresenceEnabled() {
  return readFlag(ENV_KEYS.DATA_PRESENCE);
}

function isRecruitmentReadAwarenessEnabled() {
  return readFlag(ENV_KEYS.READ_AWARENESS);
}

function isRecruitmentEditorialAttachmentEnabled() {
  return readFlag(ENV_KEYS.EDITORIAL_ATTACHMENT);
}

function isRecruitmentMonitoringMatchEnabled() {
  return readFlag(ENV_KEYS.MONITORING_MATCH);
}

function isRecruitmentPublicLifecycleEnabled() {
  return readFlag(ENV_KEYS.PUBLIC_LIFECYCLE);
}

function getRecruitmentLifecycleFlags() {
  return {
    dataPresence: isRecruitmentDataPresenceEnabled(),
    readAwareness: isRecruitmentReadAwarenessEnabled(),
    editorialAttachment: isRecruitmentEditorialAttachmentEnabled(),
    monitoringMatch: isRecruitmentMonitoringMatchEnabled(),
    publicLifecycle: isRecruitmentPublicLifecycleEnabled()
  };
}

module.exports = {
  ENV_KEYS,
  FLAG_GROUPS,
  parseEnvFlag,
  isRecruitmentDataPresenceEnabled,
  isRecruitmentReadAwarenessEnabled,
  isRecruitmentEditorialAttachmentEnabled,
  isRecruitmentMonitoringMatchEnabled,
  isRecruitmentPublicLifecycleEnabled,
  getRecruitmentLifecycleFlags
};
