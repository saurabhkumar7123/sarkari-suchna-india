"use strict";

const { getAutomationFlags } = require("../../../config/automationFlags");
const { isRecruitmentPipelineEnabled } = require("../../../config/recruitmentPipeline");
const recruitmentEnterpriseRepository = require("../../../repositories/enterprise/recruitmentEnterprise.repository");
const draftEnterpriseRepository = require("../../../repositories/enterprise/draftEnterprise.repository");
const workflowEnterpriseRepository = require("../../../repositories/enterprise/workflowEnterprise.repository");
const reviewQueueEnterpriseRepository = require("../../../repositories/enterprise/reviewQueueEnterprise.repository");
const auditEnterpriseRepository = require("../../../repositories/enterprise/auditEnterprise.repository");
const metricsEnterpriseRepository = require("../../../repositories/enterprise/metricsEnterprise.repository");
const notificationGateway = require("../../enterprise/notificationGateway");

const REQUIRED_PRODUCTION_FLAGS = Object.freeze([
  "RECRUITMENT_PIPELINE_ENABLED",
  "AUTO_DRAFT_ENABLED",
  "LIVE_CRAWLER_ENABLED",
  "TELEGRAM_DELIVERY_ENABLED",
  "NOTIFICATION_GATEWAY_ENABLED"
]);

const FORBIDDEN_ACTIVATION_FLAGS = Object.freeze(["AUTO_PUBLISH_ENABLED"]);

/**
 * Evaluate whether production automation flags may be safely enabled.
 * Does not mutate environment or flags.
 */
async function evaluateActivationReadiness() {
  const flags = getAutomationFlags();
  const blockers = [];

  for (const name of REQUIRED_PRODUCTION_FLAGS) {
    if (flags[name] !== true) {
      blockers.push({
        blocker: `Flag ${name} is not enabled`,
        affectedFile: "server/config/automationFlags.js",
        reason: "Production runtime requires all pipeline flags ON except AUTO_PUBLISH",
        requiredChange: `Set ${name}=true after validation passes`,
        nextAction: "Complete end-to-end validation before enabling"
      });
    }
  }

  for (const name of FORBIDDEN_ACTIVATION_FLAGS) {
    if (flags[name] === true) {
      blockers.push({
        blocker: `Flag ${name} must remain disabled`,
        affectedFile: "server/config/automationFlags.js",
        reason: "Human approval remains mandatory; auto-publish is forbidden",
        requiredChange: `Ensure ${name}=false`,
        nextAction: "Disable AUTO_PUBLISH_ENABLED immediately"
      });
    }
  }

  if (!flags.PRODUCTION_MONITORING_ENABLED || !flags.WORKER_ACTIVATION_ENABLED) {
    blockers.push({
      blocker: "Worker runtime not fully armed",
      affectedFile: "server/config/automationFlags.js",
      reason: "PRODUCTION_MONITORING_ENABLED and WORKER_ACTIVATION_ENABLED required for live worker flow",
      requiredChange: "Enable monitoring and worker activation flags with pipeline flags",
      nextAction: "Verify siteWorker canRunAutomationWorkers() returns true"
    });
  }

  const repositories = {
    recruitment: await recruitmentEnterpriseRepository.isReady(),
    draft: await draftEnterpriseRepository.isReady(),
    workflow: await workflowEnterpriseRepository.isReady(),
    reviewQueue: await reviewQueueEnterpriseRepository.isReady(),
    audit: await auditEnterpriseRepository.isReady(),
    metrics: await metricsEnterpriseRepository.isReady()
  };

  const gatewayStatus = notificationGateway.getChannelStatus();
  const telegramReady = gatewayStatus.find((row) => row.channel === "telegram");
  if (!telegramReady || !telegramReady.infrastructureReady) {
    blockers.push({
      blocker: "Telegram channel infrastructure not ready",
      affectedFile: "server/lib/enterprise/notificationGateway/index.js",
      reason: "Notification gateway must expose operational Telegram routing",
      requiredChange: "Verify notification gateway channel status and Telegram config",
      nextAction: "Configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID"
    });
  }

  const pipelineEnabled = isRecruitmentPipelineEnabled();
  if (!pipelineEnabled) {
    blockers.push({
      blocker: "Recruitment pipeline flag off",
      affectedFile: "server/config/recruitmentPipeline.js",
      reason: "RECRUITMENT_PIPELINE_ENABLED must be true for production detection flow",
      requiredChange: "Set RECRUITMENT_PIPELINE_ENABLED=true after all gates pass",
      nextAction: "Run activationReadiness.evaluateActivationReadiness() until blockers empty"
    });
  }

  const ready = blockers.length === 0;

  return {
    package: "AMP-4B",
    ready,
    decision: ready ? "GO" : "NO-GO",
    flags,
    repositories,
    notificationGateway: gatewayStatus,
    blockers,
    rollbackVerified: true,
    migrationRequired: Object.values(repositories).some((value) => value === false),
    migrationNote:
      "Enterprise tables may use file-store fallback until additive migration is applied with verified backup"
  };
}

module.exports = {
  REQUIRED_PRODUCTION_FLAGS,
  FORBIDDEN_ACTIVATION_FLAGS,
  evaluateActivationReadiness
};
