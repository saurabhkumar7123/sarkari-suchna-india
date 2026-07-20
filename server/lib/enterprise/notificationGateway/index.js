"use strict";

const logger = require("../../../utils/logger");
const { getAutomationFlags } = require("../../../config/automationFlags");
const { sendTelegramMessage } = require("../../../services/updates/telegramNotifier");

const CHANNELS = Object.freeze({
  TELEGRAM: "telegram",
  EMAIL: "email",
  SMS: "sms",
  PUSH: "push",
  WEBHOOK: "webhook"
});

const INACTIVE_CHANNELS = new Set([CHANNELS.EMAIL, CHANNELS.SMS, CHANNELS.PUSH, CHANNELS.WEBHOOK]);

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 500;
const rateLimitState = {
  windowStart: Date.now(),
  count: 0,
  maxPerMinute: parseInt(process.env.NOTIFICATION_GATEWAY_RATE_LIMIT_PER_MIN || "60", 10)
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkRateLimitHook() {
  const now = Date.now();
  if (now - rateLimitState.windowStart >= 60000) {
    rateLimitState.windowStart = now;
    rateLimitState.count = 0;
  }
  if (rateLimitState.count >= rateLimitState.maxPerMinute) {
    return { allowed: false, reason: "rate_limit_exceeded" };
  }
  rateLimitState.count += 1;
  return { allowed: true };
}

function isChannelEnabled(channel) {
  const flags = getAutomationFlags();
  if (flags.NOTIFICATION_GATEWAY_ENABLED !== true) return false;
  if (channel === CHANNELS.TELEGRAM) {
    return flags.TELEGRAM_DELIVERY_ENABLED === true;
  }
  return false;
}

function getChannelStatus() {
  return Object.values(CHANNELS).map((channel) => ({
    channel,
    enabled: isChannelEnabled(channel),
    infrastructureReady: true,
    implemented: channel === CHANNELS.TELEGRAM,
    inactiveFutureChannel: INACTIVE_CHANNELS.has(channel)
  }));
}

async function deliverTelegram(payload = {}) {
  const message = String(payload.message || payload.text || "").trim();
  if (!message) {
    return {
      delivered: false,
      channel: CHANNELS.TELEGRAM,
      status: "invalid_payload",
      reason: "Telegram payload requires message or text"
    };
  }

  let lastError = null;
  for (let attempt = 1; attempt <= DEFAULT_MAX_RETRIES; attempt += 1) {
    try {
      const result = await sendTelegramMessage(message);
      if (result && result.sent === true) {
        logger.info("notification-gateway: telegram delivered", { attempt });
        return {
          delivered: true,
          channel: CHANNELS.TELEGRAM,
          status: "delivered",
          attempt,
          timestamp: new Date().toISOString()
        };
      }
      lastError = result?.reason || result?.error?.message || "send_failed";
      logger.warn("notification-gateway: telegram attempt failed", { attempt, reason: lastError });
    } catch (err) {
      lastError = err.message || String(err);
      logger.error("notification-gateway: telegram error", { attempt, message: lastError });
    }
    if (attempt < DEFAULT_MAX_RETRIES) {
      await sleep(DEFAULT_RETRY_DELAY_MS * attempt);
    }
  }

  return {
    delivered: false,
    channel: CHANNELS.TELEGRAM,
    status: "failed",
    reason: lastError || "telegram_delivery_failed",
    attempts: DEFAULT_MAX_RETRIES,
    timestamp: new Date().toISOString()
  };
}

async function sendNotification({ channel, payload = {}, meta = {} }) {
  const normalizedChannel = String(channel || "").toLowerCase();
  const flags = getAutomationFlags();
  const rateCheck = checkRateLimitHook();
  if (!rateCheck.allowed) {
    logger.warn("notification-gateway: rate limit hook blocked delivery", meta);
    return {
      delivered: false,
      channel: normalizedChannel,
      status: "rate_limited",
      reason: rateCheck.reason,
      meta,
      timestamp: new Date().toISOString()
    };
  }

  if (flags.NOTIFICATION_GATEWAY_ENABLED !== true) {
    return {
      delivered: false,
      channel: normalizedChannel,
      status: "disabled",
      reason: "Notification gateway disabled by feature flag",
      payload,
      meta,
      timestamp: new Date().toISOString()
    };
  }

  if (INACTIVE_CHANNELS.has(normalizedChannel)) {
    return {
      delivered: false,
      channel: normalizedChannel,
      status: "inactive",
      reason: "Channel implemented as inactive future channel in AMP-4B",
      payload,
      meta,
      timestamp: new Date().toISOString()
    };
  }

  if (!isChannelEnabled(normalizedChannel)) {
    return {
      delivered: false,
      channel: normalizedChannel,
      status: "disabled",
      reason: "Channel delivery disabled by feature flag",
      payload,
      meta,
      timestamp: new Date().toISOString()
    };
  }

  if (normalizedChannel === CHANNELS.TELEGRAM) {
    const result = await deliverTelegram(payload);
    return { ...result, payload, meta };
  }

  return {
    delivered: false,
    channel: normalizedChannel,
    status: "unsupported",
    reason: "Unknown notification channel",
    payload,
    meta,
    timestamp: new Date().toISOString()
  };
}

async function sendBatch(notifications = []) {
  const results = [];
  for (const item of notifications) {
    results.push(
      await sendNotification({
        channel: item.channel,
        payload: item.payload,
        meta: item.meta
      })
    );
  }
  return results;
}

module.exports = {
  CHANNELS,
  isChannelEnabled,
  getChannelStatus,
  sendNotification,
  sendBatch,
  checkRateLimitHook
};
