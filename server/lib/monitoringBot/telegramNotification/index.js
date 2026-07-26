'use strict';

/**
 * Package TG-1 — Product-side Telegram Notification facade.
 */

const path = require('path');

const frameworkPath = path.resolve(
  __dirname,
  '../../project/monitoringBot/telegramNotification/packageTG1TelegramNotificationFramework.js'
);

const framework = require(frameworkPath);

function evaluateProductTelegramNotification(input = {}) {
  const result = framework.evaluateTelegramNotificationFramework(input);
  return framework.deepFreeze({
    ...result,
    productFacade: 'TELEGRAM_NOTIFICATION',
    automaticSendingDenied: true,
    productionCredentialsDenied: true,
  });
}

module.exports = {
  PACKAGE_ID: framework.PACKAGE_ID,
  PACKAGE_CODE: framework.PACKAGE_CODE,
  TEMPLATE_KINDS: framework.TEMPLATE_KINDS,
  formatTelegramMessage: framework.formatTelegramMessage,
  buildNotificationTemplatePayload: framework.buildNotificationTemplatePayload,
  createNotificationPolicy: framework.createNotificationPolicy,
  resolveNotificationDecision: framework.resolveNotificationDecision,
  createNullTransport: framework.createNullTransport,
  createMemoryTransport: framework.createMemoryTransport,
  deliverTelegramNotification: framework.deliverTelegramNotification,
  evaluateTelegramNotificationFramework:
    framework.evaluateTelegramNotificationFramework,
  evaluateProductTelegramNotification,
  getTelegramNotificationFramework: framework.getTelegramNotificationFramework,
  getTelegramNotificationFrameworkIdentity:
    framework.getTelegramNotificationFrameworkIdentity,
};
