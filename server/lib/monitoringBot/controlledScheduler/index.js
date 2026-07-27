'use strict';

/**
 * Package MB-5 — Product-side Controlled Scheduler facade.
 *
 * Thin composition layer over MB-5 + TG-1 + RW-1 combined package.
 * Controlled advisory workflow only.
 * Scheduler disabled by default. No publishing. No automatic approval.
 */

const path = require('path');

const frameworkPath = path.resolve(
  __dirname,
  '../../project/monitoringBot/controlledScheduler/packageMB5ControlledSchedulerFramework.js'
);

const framework = require(frameworkPath);

/**
 * Evaluate product-side controlled scheduler framework.
 * @param {object} [input]
 */
function evaluateProductControlledScheduler(input = {}) {
  const result = framework.evaluateControlledSchedulerFramework(input);

  return framework.deepFreeze({
    ...result,
    productReuse: {
      mb1GovernmentSourceRegistry: true,
      mb2WebsiteChangeDetection: true,
      mb3RecruitmentExtraction: true,
      mb4PipelineIntegration: true,
      tg1TelegramNotification: true,
      rw1ReviewQueueWiring: true,
      program5ReviewWorkflow: true,
      programs1to5Complete: true,
    },
  });
}

/**
 * Run a product-side controlled advisory cycle (explicit invocation).
 * @param {object} [input]
 */
async function runProductControlledAdvisoryCycle(input = {}) {
  const result = await framework.runControlledAdvisoryCycle(input);

  return framework.deepFreeze({
    ...result,
    productFacade: 'CONTROLLED_SCHEDULER',
    publishingDenied: true,
    automaticApprovalDenied: true,
    schedulerBackgroundDenied: true,
  });
}

/**
 * Create a product-side controlled scheduler (disabled by default).
 * @param {object} [options]
 */
function createProductControlledScheduler(options = {}) {
  return framework.createControlledScheduler(options);
}

module.exports = {
  PACKAGE_ID: framework.PACKAGE_ID,
  PACKAGE_CODE: framework.PACKAGE_CODE,
  PROGRAM_ID: framework.PROGRAM_ID,
  COMBINED_PACKAGE: framework.COMBINED_PACKAGE,
  DIAGNOSTIC_CODES: framework.DIAGNOSTIC_CODES,
  EXTENSION_POINTS: framework.EXTENSION_POINTS,
  TEMPLATE_KINDS: framework.TEMPLATE_KINDS,
  createControlledScheduler: framework.createControlledScheduler,
  createProductControlledScheduler,
  coordinateSourceExecution: framework.coordinateSourceExecution,
  runControlledAdvisoryCycle: framework.runControlledAdvisoryCycle,
  runProductControlledAdvisoryCycle,
  createExecutionResult: framework.createExecutionResult,
  createNotificationPolicy: framework.createNotificationPolicy,
  formatTelegramMessage: framework.formatTelegramMessage,
  createNullTransport: framework.createNullTransport,
  createMemoryTransport: framework.createMemoryTransport,
  deliverTelegramNotification: framework.deliverTelegramNotification,
  createOperatorReviewObject: framework.createOperatorReviewObject,
  generateReviewDiagnostics: framework.generateReviewDiagnostics,
  wireAdvisoryCandidateToReviewQueue:
    framework.wireAdvisoryCandidateToReviewQueue,
  evaluateControlledSchedulerFramework:
    framework.evaluateControlledSchedulerFramework,
  evaluateProductControlledScheduler,
  getControlledSchedulerFramework: framework.getControlledSchedulerFramework,
  getControlledSchedulerFrameworkIdentity:
    framework.getControlledSchedulerFrameworkIdentity,
  getTelegramNotificationFramework: framework.getTelegramNotificationFramework,
  getReviewQueueWiringFramework: framework.getReviewQueueWiringFramework,
};
