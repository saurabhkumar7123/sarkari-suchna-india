"use strict";

/**
 * Automation master / emergency-stop foundation (Phase 1 safety).
 *
 * Effective automation execution requires:
 *   emergencyStop !== true
 *   AND masterEnabled === true
 *   AND existing per-capability flags (crawler, worker, etc.)
 *
 * Default is dormant: masterEnabled=false, emergencyStop=false.
 *
 * Durability (single-host / shared filesystem):
 *   server/data/automation-master-control.json
 * Env overrides (force stop / force master read) remain available.
 *
 * Multi-host durable control without shared disk needs Redis/DB later —
 * see docs comment in getMasterControlState(). No schema migration in this phase.
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_STORE_PATH = path.join(__dirname, "../data/automation-master-control.json");

const TRUTHY = new Set(["1", "true", "yes", "on"]);
const FALSY = new Set(["0", "false", "no", "off", ""]);

function parseBooleanFlag(rawValue, fallback = false) {
  if (rawValue === undefined || rawValue === null) return fallback;
  const normalized = String(rawValue).trim().toLowerCase();
  if (TRUTHY.has(normalized)) return true;
  if (FALSY.has(normalized)) return false;
  return fallback;
}

const CONTROL_DEFAULTS = Object.freeze({
  masterEnabled: false,
  emergencyStop: false
});

function resolveStorePath() {
  const fromEnv = String(process.env.AUTOMATION_MASTER_CONTROL_PATH || "").trim();
  return fromEnv || DEFAULT_STORE_PATH;
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readFileControl(filePath = resolveStorePath()) {
  try {
    if (!fs.existsSync(filePath)) {
      return { ...CONTROL_DEFAULTS, source: "defaults", path: filePath };
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      masterEnabled: parsed && parsed.masterEnabled === true,
      emergencyStop: parsed && parsed.emergencyStop === true,
      updatedAt: parsed && parsed.updatedAt ? String(parsed.updatedAt) : null,
      source: "file",
      path: filePath
    };
  } catch {
    return { ...CONTROL_DEFAULTS, source: "defaults_corrupt_file", path: filePath };
  }
}

/**
 * Resolve coherent master-control state.
 * Emergency stop: file OR env AUTOMATION_EMERGENCY_STOP truthy → blocked.
 * Master enabled: file masterEnabled OR env AUTOMATION_MASTER_ENABLED —
 * both must agree for enable; either file or env false keeps dormant.
 *
 * Fail-closed: if anything unclear, master stays disabled.
 */
function getMasterControlState() {
  const file = readFileControl();
  const envMasterRaw = process.env.AUTOMATION_MASTER_ENABLED;
  const envStopRaw = process.env.AUTOMATION_EMERGENCY_STOP;

  const envEmergencyStop =
    envStopRaw !== undefined && envStopRaw !== null && String(envStopRaw).trim() !== ""
      ? parseBooleanFlag(envStopRaw, false)
      : false;

  const emergencyStop = file.emergencyStop === true || envEmergencyStop === true;

  // Master is ON only when explicitly enabled and not emergency-stopped.
  // Prefer file when present; env can also enable only if file does not force false
  // after an explicit file write. If no file, env alone can enable (still default false).
  let masterEnabled = false;
  if (!emergencyStop) {
    if (file.source === "file") {
      masterEnabled = file.masterEnabled === true;
      // Env can force OFF even if file says ON (ops kill via env without rewriting file).
      if (envMasterRaw !== undefined && envMasterRaw !== null && String(envMasterRaw).trim() !== "") {
        if (parseBooleanFlag(envMasterRaw, false) !== true) {
          masterEnabled = false;
        }
      }
    } else if (envMasterRaw !== undefined && envMasterRaw !== null && String(envMasterRaw).trim() !== "") {
      masterEnabled = parseBooleanFlag(envMasterRaw, false) === true;
    } else {
      masterEnabled = false;
    }
  }

  return Object.freeze({
    masterEnabled,
    emergencyStop,
    executionPermitted: emergencyStop !== true && masterEnabled === true,
    file,
    env: {
      AUTOMATION_MASTER_ENABLED: envMasterRaw,
      AUTOMATION_EMERGENCY_STOP: envStopRaw
    },
    note:
      "Cross-host durable kill switch without shared disk requires Redis/DB migration (deferred)."
  });
}

function isAutomationEmergencyStopped() {
  return getMasterControlState().emergencyStop === true;
}

function isAutomationMasterEnabled() {
  return getMasterControlState().masterEnabled === true;
}

/**
 * Central gate: false means no automation execution (scheduler enqueue,
 * worker processing, live monitoring fetch, telegram, auto-draft, publish).
 */
function isAutomationExecutionPermitted() {
  return getMasterControlState().executionPermitted === true;
}

/**
 * Persist control file (local/dev/operator tooling). Does not flip live process
 * clusters on other hosts. Does not enable capability flags.
 */
function writeMasterControlState(input = {}, filePath = resolveStorePath()) {
  const current = readFileControl(filePath);
  const next = {
    masterEnabled:
      input.masterEnabled !== undefined ? input.masterEnabled === true : current.masterEnabled === true,
    emergencyStop:
      input.emergencyStop !== undefined ? input.emergencyStop === true : current.emergencyStop === true,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy ? String(input.updatedBy).slice(0, 128) : "system"
  };
  ensureDir(filePath);
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
  return getMasterControlState();
}

module.exports = {
  CONTROL_DEFAULTS,
  resolveStorePath,
  getMasterControlState,
  isAutomationEmergencyStopped,
  isAutomationMasterEnabled,
  isAutomationExecutionPermitted,
  writeMasterControlState
};
