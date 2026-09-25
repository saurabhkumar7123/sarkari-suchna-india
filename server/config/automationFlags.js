"use strict";

const {
  isAutomationExecutionPermitted,
  isAutomationMasterEnabled
} = require("./automationKillSwitch");
const {
  getDurableCapability,
  isDryRunMode,
  canDeliverExternalNotifications,
  getAutomationMode,
  AUTOMATION_MODES
} = require("./automationControlPlane");

const FLAG_DEFAULTS = Object.freeze({
  RECRUITMENT_PIPELINE_ENABLED: false,
  AUTO_DRAFT_ENABLED: false,
  AUTO_PUBLISH_ENABLED: false,
  TELEGRAM_DELIVERY_ENABLED: false,
  LIVE_CRAWLER_ENABLED: false,
  NOTIFICATION_GATEWAY_ENABLED: false,
  PRODUCTION_MONITORING_ENABLED: false,
  SCHEDULER_ACTIVATION_ENABLED: false,
  WORKER_ACTIVATION_ENABLED: false,
  CRON_ACTIVATION_ENABLED: false,
  AUTOMATION_SOURCE_MUTATIONS_ENABLED: true,
  // Master arming switch — default OFF. Capability flags alone must not run automation.
  AUTOMATION_MASTER_ENABLED: false
});

const TRUTHY = new Set(["1", "true", "yes", "on"]);
const FALSY = new Set(["0", "false", "no", "off", ""]);

function parseBooleanFlag(rawValue, fallback = false) {
  if (rawValue === undefined || rawValue === null) {
    return fallback;
  }
  const normalized = String(rawValue).trim().toLowerCase();
  if (TRUTHY.has(normalized)) return true;
  if (FALSY.has(normalized)) return false;
  return fallback;
}

function getFlag(name) {
  if (name === "AUTO_PUBLISH_ENABLED") {
    return false;
  }
  if (name === "AUTOMATION_MASTER_ENABLED") {
    return isAutomationMasterEnabled() === true;
  }
  if (name === "AUTOMATION_SOURCE_MUTATIONS_ENABLED") {
    return parseBooleanFlag(
      process.env.AUTOMATION_SOURCE_MUTATIONS_ENABLED,
      FLAG_DEFAULTS.AUTOMATION_SOURCE_MUTATIONS_ENABLED === true
    );
  }

  // Durable control plane (file) + env; env false forces OFF.
  try {
    return getDurableCapability(name) === true;
  } catch {
    return parseBooleanFlag(process.env[name], FLAG_DEFAULTS[name] === true);
  }
}

function getAutomationFlags() {
  const flags = {};
  for (const name of Object.keys(FLAG_DEFAULTS)) {
    flags[name] = getFlag(name);
  }
  flags.AUTOMATION_MASTER_ENABLED = isAutomationMasterEnabled() === true;
  flags.AUTO_PUBLISH_ENABLED = false;
  return Object.freeze(flags);
}

function isAutomationDormant() {
  const flags = getAutomationFlags();
  const mode = getAutomationMode();
  const masterOff = isAutomationExecutionPermitted() !== true;
  const dryRun = mode === AUTOMATION_MODES.DRY_RUN;
  return (
    masterOff &&
    !dryRun &&
    flags.RECRUITMENT_PIPELINE_ENABLED === false &&
    flags.AUTO_DRAFT_ENABLED === false &&
    flags.AUTO_PUBLISH_ENABLED === false &&
    flags.TELEGRAM_DELIVERY_ENABLED === false &&
    flags.LIVE_CRAWLER_ENABLED === false &&
    flags.NOTIFICATION_GATEWAY_ENABLED === false &&
    flags.PRODUCTION_MONITORING_ENABLED === false &&
    flags.SCHEDULER_ACTIVATION_ENABLED === false &&
    flags.WORKER_ACTIVATION_ENABLED === false &&
    flags.CRON_ACTIVATION_ENABLED === false
  );
}

function canStartSchedulerProcess() {
  if (isDryRunMode()) {
    // Dry-run may run a controlled scheduler loop without LIVE arming.
    return true;
  }
  if (!isAutomationExecutionPermitted()) return false;
  const flags = getAutomationFlags();
  return flags.PRODUCTION_MONITORING_ENABLED === true && flags.SCHEDULER_ACTIVATION_ENABLED === true;
}

function canStartMonitoringScheduler() {
  if (isDryRunMode()) return true;
  if (!isAutomationExecutionPermitted()) return false;
  const flags = getAutomationFlags();
  return canStartSchedulerProcess() && flags.LIVE_CRAWLER_ENABLED === true;
}

function canEnqueueLiveCrawlerJobs() {
  // Dry-run uses dedicated dry-run runner — not live crawler enqueue.
  if (isDryRunMode()) return false;
  if (!isAutomationExecutionPermitted()) return false;
  return getAutomationFlags().LIVE_CRAWLER_ENABLED === true && canStartMonitoringScheduler();
}

function canRunAutomationWorkers() {
  if (isDryRunMode()) {
    // Dry-run worker path is the dry-run runner, not full production workers.
    return true;
  }
  if (!isAutomationExecutionPermitted()) return false;
  const flags = getAutomationFlags();
  return flags.PRODUCTION_MONITORING_ENABLED && flags.WORKER_ACTIVATION_ENABLED && flags.LIVE_CRAWLER_ENABLED;
}

function canDeliverTelegram() {
  if (!canDeliverExternalNotifications()) return false;
  if (!isAutomationExecutionPermitted()) return false;
  const flags = getAutomationFlags();
  return flags.NOTIFICATION_GATEWAY_ENABLED && flags.TELEGRAM_DELIVERY_ENABLED;
}

function canRunProductionPipeline() {
  if (isDryRunMode()) return false;
  if (!isAutomationExecutionPermitted()) return false;
  const flags = getAutomationFlags();
  return (
    flags.RECRUITMENT_PIPELINE_ENABLED &&
    flags.PRODUCTION_MONITORING_ENABLED &&
    flags.WORKER_ACTIVATION_ENABLED &&
    flags.LIVE_CRAWLER_ENABLED
  );
}

function canAutoDraft() {
  if (isDryRunMode()) return false;
  if (!isAutomationExecutionPermitted()) return false;
  const flags = getAutomationFlags();
  return flags.AUTO_DRAFT_ENABLED && canRunProductionPipeline();
}

function isAutoPublishBlocked() {
  // Always blocked unless explicitly enabled AND master permits (master stays OFF by default).
  // Hard lock: durable plane never stores AUTO_PUBLISH_ENABLED=true.
  return true;
}

module.exports = {
  FLAG_DEFAULTS,
  parseBooleanFlag,
  getFlag,
  getAutomationFlags,
  isAutomationDormant,
  canStartSchedulerProcess,
  canStartMonitoringScheduler,
  canEnqueueLiveCrawlerJobs,
  canRunAutomationWorkers,
  canDeliverTelegram,
  canRunProductionPipeline,
  canAutoDraft,
  isAutoPublishBlocked,
  isAutomationExecutionPermitted,
  isDryRunMode
};
