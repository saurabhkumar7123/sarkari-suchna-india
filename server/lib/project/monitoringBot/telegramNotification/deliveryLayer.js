'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package TG-1
 * Delivery Layer (Injectable Transport Abstraction)
 *
 * No real Telegram token required.
 * No production credentials.
 * No automatic sending outside controlled execution.
 */

const { deepFreeze } = require('../governmentSourceRegistry');
const {
  formatTelegramMessage,
  TEMPLATE_KINDS,
} = require('./notificationTemplates');
const {
  createNotificationPolicy,
  resolveNotificationDecision,
} = require('./notificationPolicy');

const DELIVERY_LAYER_VERSION = 'TG1.1.0.0';

/**
 * Null transport — records intent, never sends.
 */
function createNullTransport() {
  const sent = [];
  return {
    transportId: 'NULL_TRANSPORT',
    async send(message) {
      const record = deepFreeze({
        delivered: false,
        skipped: true,
        reason: 'NULL_TRANSPORT',
        message,
        at: new Date().toISOString(),
      });
      sent.push(record);
      return record;
    },
    getSent() {
      return deepFreeze(sent.slice());
    },
  };
}

/**
 * Memory transport — stores messages for tests / controlled review.
 */
function createMemoryTransport() {
  const sent = [];
  return {
    transportId: 'MEMORY_TRANSPORT',
    async send(message) {
      const record = deepFreeze({
        delivered: true,
        skipped: false,
        reason: 'MEMORY_TRANSPORT',
        message,
        at: new Date().toISOString(),
      });
      sent.push(record);
      return record;
    },
    getSent() {
      return deepFreeze(sent.slice());
    },
  };
}

/**
 * Deliver a notification through an injectable transport.
 * Default posture: do not send unless allowDelivery === true and transport provided.
 *
 * @param {object} [input]
 */
async function deliverTelegramNotification(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const policy = createNotificationPolicy(src.policy || {});
  const decision = resolveNotificationDecision(src.context || src, policy);

  if (!decision.enabled || !decision.kind) {
    return deepFreeze({
      deliveryVersion: DELIVERY_LAYER_VERSION,
      attempted: false,
      delivered: false,
      skipped: true,
      reason: decision.reason,
      decision,
      automaticSendingDenied: true,
      productionCredentialsUsed: false,
    });
  }

  const formatted = formatTelegramMessage({
    kind: decision.kind,
    recruitmentTitle: src.recruitmentTitle || src.title,
    department: src.department,
    source: src.source || src.sourceId,
    confidence: src.confidence,
    detectionTime: src.detectionTime,
    reviewIdentifier: src.reviewIdentifier || src.candidateId,
    summary: src.summary,
    officialUrl: src.officialUrl || src.sourceUrl,
  });

  const allowDelivery = src.allowDelivery === true;
  if (!allowDelivery) {
    return deepFreeze({
      deliveryVersion: DELIVERY_LAYER_VERSION,
      attempted: false,
      delivered: false,
      skipped: true,
      reason: 'DELIVERY_NOT_EXPLICITLY_ALLOWED',
      decision,
      formatted,
      automaticSendingDenied: true,
      productionCredentialsUsed: false,
    });
  }

  const transport = src.transport || createNullTransport();
  const delivery = await transport.send(formatted);

  return deepFreeze({
    deliveryVersion: DELIVERY_LAYER_VERSION,
    attempted: true,
    delivered: delivery && delivery.delivered === true,
    skipped: !!(delivery && delivery.skipped),
    reason: (delivery && delivery.reason) || 'DELIVERED',
    decision,
    formatted,
    delivery,
    transportId: transport.transportId || 'CUSTOM_TRANSPORT',
    automaticSendingDenied: true,
    productionCredentialsUsed: false,
    realTelegramTokenRequired: false,
  });
}

module.exports = {
  DELIVERY_LAYER_VERSION,
  TEMPLATE_KINDS,
  createNullTransport,
  createMemoryTransport,
  deliverTelegramNotification,
};
