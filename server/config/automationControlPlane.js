"use strict";

/**
 * Durable automation control plane (Phase D / I).
 *
 * Shared file-backed state readable by web cluster + worker on the same host
 * (shared filesystem). Does NOT mutate only process.env.
 *
 * Modes:
 *   DORMANT  — default; no monitoring fetch / enqueue / draft / telegram / publish
 *   DRY_RUN  — approved GET + detect + record only; no telegram / publish / live arming
 *   LIVE     — requires masterEnabled + capability flags (still no auto-publish)
 *
 * Multi-host without shared disk: requires Redis/DB migration (not executed here).
 * See CONTROL_PLANE_NOTE.
 */

const fs = require("fs");
const path = require("path");
const {
  getMasterControlState,
  writeMasterControlState,
  isAutomationEmergencyStopped
} = require("./automationKillSwitch");

const DEFAULT_STORE_PATH = path.join(__dirname, "../data/automation-control-plane.json");

const AUTOMATION_MODES = Object.freeze({
  DORMANT: "DORMANT",
  DRY_RUN: "DRY_RUN",
  LIVE: "LIVE"
});

const CONTROL_PLANE_NOTE =
  "Durable via shared JSON file on this host. Multi-host without shared volume needs Redis/DB migration (deferred; not executed).";

const CAPABILITY_KEYS = Object.freeze([
  "PRODUCTION_MONITORING_ENABLED",
  "LIVE_CRAWLER_ENABLED",
  "SCHEDULER_ACTIVATION_ENABLED",
  "WORKER_ACTIVATION_ENABLED",
  "AUTO_DRAFT_ENABLED",
  "NOTIFICATION_GATEWAY_ENABLED",
  "TELEGRAM_DELIVERY_ENABLED",
  "RECRUITMENT_PIPELINE_ENABLED",
  "CRON_ACTIVATION_ENABLED"
]);

const TRUTHY = new Set(["1", "true", "yes", "on"]);
const FALSY = new Set(["0", "false", "no", "off", ""]);

// Short in-process cache to avoid hammering disk; invalidated on write.
let _cache = null;
let _cacheAt = 0;
const CACHE_TTL_MS = 500;

function parseBooleanFlag(rawValue, fallback = false) {
  if (rawValue === undefined || rawValue === null) return fallback;
  const normalized = String(rawValue).trim().toLowerCase();
  if (TRUTHY.has(normalized)) return true;
  if (FALSY.has(normalized)) return false;
  return fallback;
}

function resolveStorePath() {
  const fromEnv = String(process.env.AUTOMATION_CONTROL_PLANE_PATH || "").trim();
  return fromEnv || DEFAULT_STORE_PATH;
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function buildDefaultPlane() {
  const capabilities = {};
  for (const key of CAPABILITY_KEYS) {
    capabilities[key] = false;
  }
  return {
    version: 1,
    mode: AUTOMATION_MODES.DORMANT,
    capabilities,
    updatedAt: null,
    updatedBy: null
  };
}

function normalizeMode(raw) {
  const value = String(raw || "")
    .trim()
    .toUpperCase();
  if (value === AUTOMATION_MODES.DRY_RUN) return AUTOMATION_MODES.DRY_RUN;
  if (value === AUTOMATION_MODES.LIVE) return AUTOMATION_MODES.LIVE;
  return AUTOMATION_MODES.DORMANT;
}

function normalizeCapabilities(input) {
  const out = {};
  for (const key of CAPABILITY_KEYS) {
    out[key] = input && input[key] === true;
  }
  // Auto-publish never stored as enabled in durable plane.
  out.AUTO_PUBLISH_ENABLED = false;
  return out;
}

function invalidateCache() {
  _cache = null;
  _cacheAt = 0;
}

function readControlPlaneRaw(filePath = resolveStorePath()) {
  try {
    if (!fs.existsSync(filePath)) {
      return { ...buildDefaultPlane(), source: "defaults", path: filePath };
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      version: 1,
      mode: normalizeMode(parsed && parsed.mode),
      capabilities: normalizeCapabilities(parsed && parsed.capabilities),
      updatedAt: parsed && parsed.updatedAt ? String(parsed.updatedAt) : null,
      updatedBy: parsed && parsed.updatedBy ? String(parsed.updatedBy).slice(0, 128) : null,
      source: "file",
      path: filePath
    };
  } catch {
    return { ...buildDefaultPlane(), source: "defaults_corrupt_file", path: filePath };
  }
}

function readControlPlane(options = {}) {
  const now = Date.now();
  if (!options.force && _cache && now - _cacheAt < CACHE_TTL_MS) {
    return _cache;
  }
  const plane = readControlPlaneRaw();
  _cache = Object.freeze({
    ...plane,
    capabilities: Object.freeze({ ...plane.capabilities })
  });
  _cacheAt = now;
  return _cache;
}

function writeControlPlane(input = {}, filePath = resolveStorePath()) {
  const current = readControlPlaneRaw(filePath);
  const nextCapabilities = normalizeCapabilities({
    ...current.capabilities,
    ...(input.capabilities && typeof input.capabilities === "object" ? input.capabilities : {})
  });

  // Map convenience boolean inputs used by ACC.
  const flagMap = {
    productionMonitoringEnabled: "PRODUCTION_MONITORING_ENABLED",
    liveCrawlerEnabled: "LIVE_CRAWLER_ENABLED",
    schedulerEnabled: "SCHEDULER_ACTIVATION_ENABLED",
    workerEnabled: "WORKER_ACTIVATION_ENABLED",
    autoDraftEnabled: "AUTO_DRAFT_ENABLED",
    notificationGatewayEnabled: "NOTIFICATION_GATEWAY_ENABLED",
    telegramEnabled: "TELEGRAM_DELIVERY_ENABLED",
    recruitmentPipelineEnabled: "RECRUITMENT_PIPELINE_ENABLED",
    cronEnabled: "CRON_ACTIVATION_ENABLED"
  };
  for (const [inputKey, flagKey] of Object.entries(flagMap)) {
    if (input[inputKey] === true) nextCapabilities[flagKey] = true;
    if (input[inputKey] === false) nextCapabilities[flagKey] = false;
  }

  let mode = current.mode;
  if (input.mode !== undefined) {
    mode = normalizeMode(input.mode);
  } else if (input.dryRunEnabled === true) {
    mode = AUTOMATION_MODES.DRY_RUN;
  } else if (input.dryRunEnabled === false && current.mode === AUTOMATION_MODES.DRY_RUN) {
    mode = AUTOMATION_MODES.DORMANT;
  }

  // LIVE is never an ordinary write. Only explicit promoteToLive (allowLivePromotion)
  // after master arming may set LIVE. Accidental mode: "LIVE" fails closed to DORMANT.
  if (mode === AUTOMATION_MODES.LIVE && input.allowLivePromotion !== true) {
    mode = AUTOMATION_MODES.DORMANT;
  }

  // LIVE mode cannot be entered solely via capability flips while emergency-stopped.
  if (isAutomationEmergencyStopped()) {
    if (mode === AUTOMATION_MODES.LIVE) mode = AUTOMATION_MODES.DORMANT;
  }

  // Auto-publish hard lock.
  nextCapabilities.AUTO_PUBLISH_ENABLED = false;

  const next = {
    version: 1,
    mode,
    capabilities: nextCapabilities,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy ? String(input.updatedBy).slice(0, 128) : "system"
  };

  ensureDir(filePath);
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
  invalidateCache();

  // Mirror into process.env for this process so existing readers stay consistent.
  for (const key of CAPABILITY_KEYS) {
    process.env[key] = nextCapabilities[key] ? "true" : "false";
  }
  process.env.AUTO_PUBLISH_ENABLED = "false";
  process.env.AUTOMATION_MODE = mode;

  return getControlPlaneSnapshot();
}

/**
 * Resolve durable capability.
 * When control-plane file exists, it is the shared source of truth across processes.
 * Env values from .env must not silently override an operator durable write.
 * Ops force-OFF: set AUTOMATION_FORCE_DISABLE_<FLAG>=1 (or emergency stop / master off).
 * AUTO_PUBLISH is never enabled via this plane.
 */
function getDurableCapability(flagName) {
  const key = String(flagName || "").trim();
  if (!key || key === "AUTO_PUBLISH_ENABLED") return false;

  const forceDisableRaw = process.env[`AUTOMATION_FORCE_DISABLE_${key}`];
  if (
    forceDisableRaw !== undefined &&
    forceDisableRaw !== null &&
    String(forceDisableRaw).trim() !== "" &&
    parseBooleanFlag(forceDisableRaw, false) === true
  ) {
    return false;
  }

  const plane = readControlPlane();
  if (plane.source === "file") {
    return plane.capabilities && plane.capabilities[key] === true;
  }

  const envRaw = process.env[key];
  if (envRaw !== undefined && envRaw !== null && String(envRaw).trim() !== "") {
    return parseBooleanFlag(envRaw, false) === true;
  }
  return false;
}

function getAutomationMode() {
  if (isAutomationEmergencyStopped()) return AUTOMATION_MODES.DORMANT;
  const plane = readControlPlane();
  // Durable file is source of truth across processes (mirrors getDurableCapability).
  // Env AUTOMATION_MODE is a bootstrap fallback only when no durable file exists.
  if (plane.source === "file") {
    return plane.mode || AUTOMATION_MODES.DORMANT;
  }
  const envMode = process.env.AUTOMATION_MODE;
  if (envMode !== undefined && envMode !== null && String(envMode).trim() !== "") {
    return normalizeMode(envMode);
  }
  return plane.mode || AUTOMATION_MODES.DORMANT;
}

function isDryRunMode() {
  return getAutomationMode() === AUTOMATION_MODES.DRY_RUN && !isAutomationEmergencyStopped();
}

function isLiveMode() {
  const master = getMasterControlState();
  return (
    getAutomationMode() === AUTOMATION_MODES.LIVE &&
    master.executionPermitted === true &&
    !master.emergencyStop
  );
}

/**
 * Monitoring HTTP / enqueue permission:
 * - emergency stop → never
 * - DRY_RUN → allowed (read-only path)
 * - LIVE + master → allowed
 * - else blocked
 */
function isMonitoringFetchPermitted() {
  if (isAutomationEmergencyStopped()) return false;
  if (isDryRunMode()) return true;
  const master = getMasterControlState();
  return master.executionPermitted === true;
}

function canDeliverExternalNotifications() {
  // Dry-run and dormant never send Telegram / external notifications.
  if (isDryRunMode()) return false;
  if (isAutomationEmergencyStopped()) return false;
  return getMasterControlState().executionPermitted === true;
}

function getControlPlaneSnapshot() {
  const master = getMasterControlState();
  const plane = readControlPlane({ force: true });
  const mode = getAutomationMode();
  return Object.freeze({
    mode,
    dryRun: mode === AUTOMATION_MODES.DRY_RUN,
    live: mode === AUTOMATION_MODES.LIVE && master.executionPermitted === true,
    dormant: mode === AUTOMATION_MODES.DORMANT || master.emergencyStop === true,
    masterEnabled: master.masterEnabled === true,
    emergencyStop: master.emergencyStop === true,
    executionPermitted: master.executionPermitted === true,
    monitoringFetchPermitted: isMonitoringFetchPermitted(),
    externalNotificationsPermitted: canDeliverExternalNotifications(),
    autoPublishBlocked: true,
    capabilities: plane.capabilities,
    updatedAt: plane.updatedAt,
    updatedBy: plane.updatedBy,
    source: plane.source,
    path: plane.path,
    masterPath: master.file && master.file.path,
    note: CONTROL_PLANE_NOTE
  });
}

/**
 * Emergency stop — durable. Stops scheduler/worker/fetch/draft/telegram/publish paths.
 */
function engageEmergencyStop(input = {}) {
  writeMasterControlState({
    emergencyStop: true,
    masterEnabled: false,
    updatedBy: input.updatedBy || "emergency_stop"
  });
  writeControlPlane({
    mode: AUTOMATION_MODES.DORMANT,
    updatedBy: input.updatedBy || "emergency_stop"
  });
  process.env.AUTOMATION_EMERGENCY_STOP = "true";
  process.env.AUTOMATION_MASTER_ENABLED = "false";
  return getControlPlaneSnapshot();
}

function clearEmergencyStop(input = {}) {
  writeMasterControlState({
    emergencyStop: false,
    updatedBy: input.updatedBy || "clear_emergency_stop"
  });
  if (process.env.AUTOMATION_EMERGENCY_STOP !== undefined) {
    process.env.AUTOMATION_EMERGENCY_STOP = "false";
  }
  return getControlPlaneSnapshot();
}

function setMasterEnabled(enabled, input = {}) {
  if (enabled === true && isAutomationEmergencyStopped()) {
    const err = new Error("Cannot enable master while emergency stop is active");
    err.statusCode = 409;
    throw err;
  }
  writeMasterControlState({
    masterEnabled: enabled === true,
    updatedBy: input.updatedBy || "master_toggle"
  });
  process.env.AUTOMATION_MASTER_ENABLED = enabled === true ? "true" : "false";
  if (enabled === true && input.promoteToLive === true) {
    writeControlPlane({
      mode: AUTOMATION_MODES.LIVE,
      allowLivePromotion: true,
      updatedBy: input.updatedBy || "master_toggle"
    });
  }
  if (enabled !== true) {
    const plane = readControlPlane();
    if (plane.mode === AUTOMATION_MODES.LIVE) {
      writeControlPlane({ mode: AUTOMATION_MODES.DORMANT, updatedBy: input.updatedBy || "master_toggle" });
    }
  }
  return getControlPlaneSnapshot();
}

function setDryRunMode(enabled, input = {}) {
  if (isAutomationEmergencyStopped()) {
    const err = new Error("Cannot enable dry-run while emergency stop is active");
    err.statusCode = 409;
    throw err;
  }
  return writeControlPlane({
    mode: enabled === true ? AUTOMATION_MODES.DRY_RUN : AUTOMATION_MODES.DORMANT,
    updatedBy: input.updatedBy || "dry_run_toggle"
  });
}

module.exports = {
  AUTOMATION_MODES,
  CAPABILITY_KEYS,
  CONTROL_PLANE_NOTE,
  resolveStorePath,
  readControlPlane,
  writeControlPlane,
  getDurableCapability,
  getAutomationMode,
  isDryRunMode,
  isLiveMode,
  isMonitoringFetchPermitted,
  canDeliverExternalNotifications,
  getControlPlaneSnapshot,
  engageEmergencyStop,
  clearEmergencyStop,
  setMasterEnabled,
  setDryRunMode,
  invalidateCache
};
