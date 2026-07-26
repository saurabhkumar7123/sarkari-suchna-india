'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package TG-1
 * Telegram Notification Framework
 *
 * Controlled advisory notifications only.
 * No production credentials. No automatic sending.
 */

const { deepFreeze } = require('../governmentSourceRegistry');
const {
  NOTIFICATION_TEMPLATES_VERSION,
  TEMPLATE_KINDS,
  buildNotificationTemplatePayload,
  formatTelegramMessage,
} = require('./notificationTemplates');
const {
  NOTIFICATION_POLICY_VERSION,
  DEFAULT_POLICY,
  createNotificationPolicy,
  resolveNotificationDecision,
} = require('./notificationPolicy');
const {
  DELIVERY_LAYER_VERSION,
  createNullTransport,
  createMemoryTransport,
  deliverTelegramNotification,
} = require('./deliveryLayer');

const FRAMEWORK_VERSION = '1.0.0';
const PROGRAM_ID = 'GOVERNMENT_MONITORING_BOT';
const PACKAGE_ID = 'PACKAGE_TG1_TELEGRAM_NOTIFICATION';
const PACKAGE_NAME = 'Telegram Notification';
const PACKAGE_CODE = 'TG-1';
const STAGE_ID = 'STAGE_1_GOVERNMENT_MONITORING_BOT';

const OBJECTIVE =
  'Provide controlled Telegram notification templates, policy, and injectable delivery without production credentials or automatic sending.';

const OUT_OF_SCOPE = Object.freeze([
  'PRODUCTION_CREDENTIALS',
  'AUTOMATIC_SENDING',
  'PUBLISHING',
  'APPROVAL',
  'DATABASE_WRITES',
  'REDIS',
  'EXPRESS_ROUTES',
  'OS_CRON',
  'WORKER_ACTIVATION',
]);

const PROHIBITED = Object.freeze([
  'REAL_TELEGRAM_TOKEN_REQUIRED',
  'AUTOMATIC_PRODUCTION_SEND',
  'PUBLISH_EXECUTION',
  'GITHUB_DEPLOYMENT',
  'VPS_DEPLOYMENT',
]);

const CAPABILITIES = Object.freeze([
  'NOTIFICATION_TEMPLATES',
  'MESSAGE_FORMATTING',
  'NOTIFICATION_POLICY',
  'INJECTABLE_TRANSPORT',
  'SUCCESS_NOTIFICATION',
  'DUPLICATE_NOTIFICATION',
  'EXTRACTION_WARNING',
  'VALIDATION_WARNING',
]);

function getTelegramNotificationFrameworkIdentity() {
  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageName: PACKAGE_NAME,
    packageCode: PACKAGE_CODE,
    stageId: STAGE_ID,
  });
}

function getTelegramNotificationFramework() {
  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageName: PACKAGE_NAME,
    packageCode: PACKAGE_CODE,
    stageId: STAGE_ID,
    objective: OBJECTIVE,
    advisoryOnly: true,
    configurationDriven: true,
    versioned: true,
    deterministic: true,
    manualInvocationOnly: true,
    capabilities: CAPABILITIES.slice(),
    outOfScope: OUT_OF_SCOPE.slice(),
    prohibited: PROHIBITED.slice(),
    packageTG1Complete: true,
    safetyBoundaries: {
      automaticSendingDenied: true,
      productionCredentialsDenied: true,
      realTelegramTokenRequired: false,
      publishingDenied: true,
      approvalManualOnly: true,
      databaseWritesDenied: true,
      redisDenied: true,
      expressRoutesDenied: true,
    },
    runtimeEffects: {
      telegramAutoSent: false,
      productionCredentialsLoaded: false,
      published: false,
      databaseWritten: false,
      routesCreated: false,
    },
    packageSummary: {
      status: 'TELEGRAM_NOTIFICATION_FRAMEWORK_COMPLETE',
      nextPackage: 'FT-1',
      canNotifyOperators: true,
      canAutoSend: false,
      canPublish: false,
    },
    recommendation:
      'TG1_COMPLETE_CONTROLLED_NOTIFICATION_ONLY_NO_AUTO_SEND_NO_PRODUCTION_CREDENTIALS',
  });
}

function evaluateTelegramNotificationFramework(input = {}) {
  const policy = createNotificationPolicy(input.policy || {});
  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    packageCode: PACKAGE_CODE,
    advisoryOnly: true,
    policy,
    readyForControlledDelivery: true,
    automaticSendingDenied: true,
    effects: {
      telegramAutoSent: false,
      productionCredentialsUsed: false,
      published: false,
    },
  });
}

module.exports = {
  FRAMEWORK_VERSION,
  PROGRAM_ID,
  PACKAGE_ID,
  PACKAGE_NAME,
  PACKAGE_CODE,
  STAGE_ID,
  OBJECTIVE,
  OUT_OF_SCOPE,
  PROHIBITED,
  CAPABILITIES,
  NOTIFICATION_TEMPLATES_VERSION,
  NOTIFICATION_POLICY_VERSION,
  DELIVERY_LAYER_VERSION,
  TEMPLATE_KINDS,
  DEFAULT_POLICY,
  deepFreeze,
  buildNotificationTemplatePayload,
  formatTelegramMessage,
  createNotificationPolicy,
  resolveNotificationDecision,
  createNullTransport,
  createMemoryTransport,
  deliverTelegramNotification,
  evaluateTelegramNotificationFramework,
  getTelegramNotificationFramework,
  getTelegramNotificationFrameworkIdentity,
};
