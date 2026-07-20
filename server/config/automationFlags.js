"use strict";

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
  AUTOMATION_SOURCE_MUTATIONS_ENABLED: true
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
  return parseBooleanFlag(process.env[name], FLAG_DEFAULTS[name] === true);
}

function getAutomationFlags() {
  const flags = {};
  for (const name of Object.keys(FLAG_DEFAULTS)) {
    flags[name] = getFlag(name);
  }
  return Object.freeze(flags);
}

function isAutomationDormant() {
  const flags = getAutomationFlags();
  return (
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

function canStartMonitoringScheduler() {
  const flags = getAutomationFlags();
  return flags.PRODUCTION_MONITORING_ENABLED && flags.SCHEDULER_ACTIVATION_ENABLED && flags.LIVE_CRAWLER_ENABLED;
}

function canRunAutomationWorkers() {
  const flags = getAutomationFlags();
  return flags.PRODUCTION_MONITORING_ENABLED && flags.WORKER_ACTIVATION_ENABLED && flags.LIVE_CRAWLER_ENABLED;
}

function canDeliverTelegram() {
  const flags = getAutomationFlags();
  return flags.NOTIFICATION_GATEWAY_ENABLED && flags.TELEGRAM_DELIVERY_ENABLED;
}

function canRunProductionPipeline() {
  const flags = getAutomationFlags();
  return (
    flags.RECRUITMENT_PIPELINE_ENABLED &&
    flags.PRODUCTION_MONITORING_ENABLED &&
    flags.WORKER_ACTIVATION_ENABLED &&
    flags.LIVE_CRAWLER_ENABLED
  );
}

function canAutoDraft() {
  const flags = getAutomationFlags();
  return flags.AUTO_DRAFT_ENABLED && canRunProductionPipeline();
}

function isAutoPublishBlocked() {
  return getAutomationFlags().AUTO_PUBLISH_ENABLED !== true;
}

module.exports = {
  FLAG_DEFAULTS,
  parseBooleanFlag,
  getFlag,
  getAutomationFlags,
  isAutomationDormant,
  canStartMonitoringScheduler,
  canRunAutomationWorkers,
  canDeliverTelegram,
  canRunProductionPipeline,
  canAutoDraft,
  isAutoPublishBlocked
};
