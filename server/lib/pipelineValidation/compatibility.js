"use strict";

/**
 * Phase AI-5 — Backward compatibility checks.
 *
 * Confirms Production Workflow / Generator / scheduler / AUTO_PUBLISH /
 * monitoring flags remain unchanged. Read-only assertions only.
 */

const { deepFreeze } = require("../noticeIntelligence/textUtils");
const {
  getAutomationFlags,
  isAutomationDormant,
  canStartMonitoringScheduler,
  canDeliverTelegram
} = require("../../config/automationFlags");
const {
  PUBLISHING_POLICY,
  assertAutoPublishDisabled
} = require("../productionWorkflow/publishingPolicy");

/**
 * Snapshot operational flags and policy gates.
 * @returns {object}
 */
function checkBackwardCompatibility() {
  const flags = getAutomationFlags();
  const publishPolicy = assertAutoPublishDisabled();

  const checks = [
    {
      id: "AUTO_PUBLISH_FALSE",
      ok: flags.AUTO_PUBLISH_ENABLED === false,
      detail: `AUTO_PUBLISH_ENABLED=${flags.AUTO_PUBLISH_ENABLED}`
    },
    {
      id: "POLICY_AUTO_PUBLISH_FALSE",
      ok: PUBLISHING_POLICY.AUTO_PUBLISH_ENABLED === false,
      detail: `PUBLISHING_POLICY.AUTO_PUBLISH_ENABLED=${PUBLISHING_POLICY.AUTO_PUBLISH_ENABLED}`
    },
    {
      id: "MANUAL_PUBLISH_ONLY",
      ok: PUBLISHING_POLICY.MANUAL_PUBLISH_ONLY === true,
      detail: `MANUAL_PUBLISH_ONLY=${PUBLISHING_POLICY.MANUAL_PUBLISH_ONLY}`
    },
    {
      id: "SCHEDULER_NOT_ACTIVATED",
      ok:
        flags.SCHEDULER_ACTIVATION_ENABLED === false &&
        canStartMonitoringScheduler() === false,
      detail: `SCHEDULER_ACTIVATION_ENABLED=${flags.SCHEDULER_ACTIVATION_ENABLED}; canStart=${canStartMonitoringScheduler()}`
    },
    {
      id: "CRON_NOT_ACTIVATED",
      ok: flags.CRON_ACTIVATION_ENABLED === false,
      detail: `CRON_ACTIVATION_ENABLED=${flags.CRON_ACTIVATION_ENABLED}`
    },
    {
      id: "TELEGRAM_DELIVERY_DISABLED",
      ok:
        flags.TELEGRAM_DELIVERY_ENABLED === false &&
        canDeliverTelegram() === false,
      detail: `TELEGRAM_DELIVERY_ENABLED=${flags.TELEGRAM_DELIVERY_ENABLED}`
    },
    {
      id: "LIVE_CRAWLER_DISABLED",
      ok: flags.LIVE_CRAWLER_ENABLED === false,
      detail: `LIVE_CRAWLER_ENABLED=${flags.LIVE_CRAWLER_ENABLED}`
    },
    {
      id: "PRODUCTION_MONITORING_DISABLED",
      ok: flags.PRODUCTION_MONITORING_ENABLED === false,
      detail: `PRODUCTION_MONITORING_ENABLED=${flags.PRODUCTION_MONITORING_ENABLED}`
    },
    {
      id: "AUTO_DRAFT_DISABLED",
      ok: flags.AUTO_DRAFT_ENABLED === false,
      detail: `AUTO_DRAFT_ENABLED=${flags.AUTO_DRAFT_ENABLED}`
    },
    {
      id: "PUBLISH_GATE_BLOCKS_AUTO",
      ok: publishPolicy.autoPublishBlocked === true,
      detail: `autoPublishBlocked=${publishPolicy.autoPublishBlocked}`
    }
  ];

  const failed = checks.filter((c) => !c.ok);

  return deepFreeze({
    advisoryOnly: true,
    allPassed: failed.length === 0,
    automationDormant: isAutomationDormant(),
    flags,
    publishingPolicy: PUBLISHING_POLICY,
    checks,
    failed: failed.map((c) => c.id),
    notes: [
      "Phase AI-5 is additive and require-only.",
      "No Production Workflow source files are modified by this phase.",
      "No Generator UI files are modified by this phase.",
      "No database schema migrations are introduced by this phase."
    ]
  });
}

module.exports = {
  checkBackwardCompatibility
};
