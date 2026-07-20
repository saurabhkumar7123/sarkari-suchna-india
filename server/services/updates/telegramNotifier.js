const axios = require("axios");
const logger = require("../../utils/logger");
const { canDeliverTelegram } = require("../../config/automationFlags");

function maskSecret(value, visible = 4) {
  const v = String(value || "");
  if (!v) return "(empty)";
  if (v.length <= visible * 2) return `${"*".repeat(Math.max(0, v.length - visible))}${v.slice(-visible)}`;
  return `${v.slice(0, visible)}...${v.slice(-visible)}`;
}

function getTelegramConfig() {
  return {
    token: String(process.env.TELEGRAM_BOT_TOKEN || "").trim(),
    chatId: String(process.env.TELEGRAM_CHAT_ID || "").trim()
  };
}

function canSendTelegram() {
  const { token, chatId } = getTelegramConfig();
  return canDeliverTelegram() && Boolean(token && chatId);
}

async function sendTelegramMessage(text) {
  const { token, chatId } = getTelegramConfig();
  if (!canDeliverTelegram()) {
    logger.warn("updates: telegram disabled by automation flags");
    return { sent: false, skipped: true, reason: "flag_disabled" };
  }
  logger.warn("updates: telegram config check", {
    tokenPresent: Boolean(token),
    chatIdPresent: Boolean(chatId),
    tokenMasked: maskSecret(token, 5),
    chatIdMasked: maskSecret(chatId, 3)
  });
  if (!token || !chatId) {
    logger.warn("updates: telegram disabled (missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID)");
    return { sent: false, skipped: true };
  }

  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text,
    disable_web_page_preview: false
  };
  logger.warn("Sending Telegram:", {
    endpoint: `https://api.telegram.org/bot${maskSecret(token, 5)}/sendMessage`,
    payload: {
      chat_id: maskSecret(chatId, 3),
      textLength: String(text || "").length
    }
  });

  try {
    const { data } = await axios.post(endpoint, payload, { timeout: 20000 });
    console.warn("Telegram response:", data);
    logger.warn("updates: telegram message sent", { ok: Boolean(data && data.ok) });
    return { sent: true };
  } catch (err) {
    const status = err && err.response ? err.response.status : null;
    const body = err && err.response ? err.response.data : null;
    const causeMessage =
      err && err.cause && err.cause.message ? err.cause.message : null;
    console.warn("Telegram error:", body || causeMessage || (err && err.message ? err.message : String(err)));
    logger.error("updates: telegram send failed", {
      status,
      code: err && err.code ? err.code : null,
      name: err && err.name ? err.name : null,
      cause: causeMessage,
      message: err && err.message ? err.message : String(err),
      body
    });
    return { sent: false, error: err };
  }
}

function buildUpdateMessage({ siteName, title, link, important = false }) {
  const safeSite = String(siteName || "Site").trim() || "Site";
  const safeTitle = String(title || "Untitled update").trim() || "Untitled update";
  const safeLink = String(link || "").trim();
  const lines = [
    important ? "🔥 Important Update" : "🔔 New Update Detected",
    `Site: ${safeSite}`,
    `Title: ${safeTitle}`,
    `Link: ${safeLink || "N/A"}`,
    "",
    "Manual check required"
  ];
  return lines.join("\n");
}

function buildHeartbeatMessage() {
  return "Bot is running";
}

function buildSelectorIssueMessage({ siteName, siteUrl, selector, reason }) {
  return [
    "⚠️ Selector Issue Detected",
    `Site: ${String(siteName || "Site")}`,
    `URL: ${String(siteUrl || "N/A")}`,
    `Selector: ${String(selector || "N/A")}`,
    `Reason: ${String(reason || "selector_miss")}`,
    "",
    "Manual check required"
  ].join("\n");
}

function buildBatchUpdateMessage(items) {
  const hasImportant = items.some((item) => Boolean(item && item.important));
  const lines = [hasImportant ? "🔥 Important Update" : "🔔 New Update Detected", ""];
  items.forEach((item, i) => {
    lines.push(`${i + 1}. Site: ${item.siteName}`);
    lines.push(`   Title: ${item.title || "Untitled update"}`);
    lines.push(`   Link: ${item.link || "N/A"}`);
    lines.push("");
  });
  lines.push("Manual check required");
  return lines.join("\n");
}

function buildDailySummaryMessage({ checked, enqueued, updatesFound, errors }) {
  const queued = enqueued != null ? enqueued : updatesFound;
  return [
    "📊 Daily Monitoring Summary",
    `Sites queued: ${checked}`,
    `Jobs enqueued: ${queued != null ? queued : 0}`,
    `Enqueue errors: ${errors}`
  ].join("\n");
}

function buildPreDisableWarningMessage({ siteName, failCount, threshold }) {
  return [
    `⚠️ Site failing repeatedly (${failCount}/${threshold})`,
    `Site: ${String(siteName || "Site")}`,
    "",
    "Manual check required"
  ].join("\n");
}

module.exports = {
  canSendTelegram,
  sendTelegramMessage,
  buildUpdateMessage,
  buildHeartbeatMessage,
  buildSelectorIssueMessage,
  buildBatchUpdateMessage,
  buildDailySummaryMessage,
  buildPreDisableWarningMessage
};
