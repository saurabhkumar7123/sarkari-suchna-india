"use strict";

/**
 * Security / blocked-action + execution audit for monitoring automation.
 * Reuses automation_audit_log via auditEnterprise.repository (DB or file fallback).
 * Never records secrets, cookies, tokens, or Authorization headers.
 */

const os = require("os");
const auditEnterpriseRepository = require("../../repositories/enterprise/auditEnterprise.repository");
const logger = require("../../utils/logger");

const SECURITY_EVENT_TYPES = Object.freeze({
  BLOCKED_HTTP_METHOD: "BLOCKED_HTTP_METHOD",
  UNSAFE_REDIRECT: "UNSAFE_REDIRECT",
  UNAPPROVED_HOST: "UNAPPROVED_HOST",
  RESPONSE_TOO_LARGE: "RESPONSE_TOO_LARGE",
  AUTOMATION_KILL_SWITCH: "AUTOMATION_KILL_SWITCH",
  POLICY_REJECTION: "POLICY_REJECTION",
  UNSUPPORTED_PROTOCOL: "UNSUPPORTED_PROTOCOL",
  INVALID_URL: "INVALID_URL",
  SOURCE_DISABLED: "SOURCE_DISABLED",
  SOURCE_ENABLED: "SOURCE_ENABLED",
  CONFIG_CHANGED: "CONFIG_CHANGED",
  WORKER_FAILURE: "WORKER_FAILURE",
  SCHEDULER_FAILURE: "SCHEDULER_FAILURE",
  SELECTOR_MISS: "SELECTOR_MISS",
  DRY_RUN_EXECUTION: "DRY_RUN_EXECUTION",
  MONITORING_EXECUTION: "MONITORING_EXECUTION"
});

function sanitizeUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    parsed.username = "";
    parsed.password = "";
    return parsed.toString();
  } catch {
    return value.slice(0, 500);
  }
}

function stripSensitive(detail) {
  if (!detail || typeof detail !== "object") return detail;
  delete detail.headers;
  delete detail.authorization;
  delete detail.cookie;
  delete detail.cookies;
  delete detail.token;
  delete detail.TELEGRAM_BOT_TOKEN;
  delete detail.password;
  delete detail.passwords;
  return detail;
}

function buildProcessContext() {
  return {
    pid: process.pid,
    hostname: os.hostname(),
    role: process.env.PM2_TARGET_ENV || process.env.NODE_ENV || "unknown"
  };
}

/**
 * @param {object} input
 */
async function recordBlockedSecurityEvent(input = {}) {
  const eventType = String(input.eventType || SECURITY_EVENT_TYPES.POLICY_REJECTION).slice(0, 64);
  const detail = stripSensitive({
    result: "BLOCKED",
    websiteContacted: false,
    reason: String(input.reason || "blocked").slice(0, 500),
    requestedMethod: input.requestedMethod ? String(input.requestedMethod).toUpperCase().slice(0, 16) : null,
    requestedUrl: sanitizeUrl(input.requestedUrl),
    destinationUrl: sanitizeUrl(input.destinationUrl),
    siteId: input.siteId != null ? Number(input.siteId) : null,
    process: buildProcessContext(),
    ...(input.detail && typeof input.detail === "object" ? input.detail : {})
  });

  try {
    return await auditEnterpriseRepository.recordEvent({
      category: "errors",
      eventType,
      entityType: input.siteId != null ? "monitored_site" : "monitoring_http",
      entityId: input.siteId != null ? Number(input.siteId) : null,
      action: String(input.action || eventType).slice(0, 128),
      actor: String(input.actor || "monitoring_safety").slice(0, 128),
      status: "blocked",
      detail
    });
  } catch (err) {
    logger.warn("monitoring-security-audit: record failed", {
      eventType,
      message: err && err.message ? err.message : String(err)
    });
    return null;
  }
}

/**
 * Execution audit for allowed monitoring actions (GET completed / dry-run).
 * Never logs secrets.
 */
async function recordExecutionAudit(input = {}) {
  const eventType = String(
    input.eventType ||
      (input.dryRun ? SECURITY_EVENT_TYPES.DRY_RUN_EXECUTION : SECURITY_EVENT_TYPES.MONITORING_EXECUTION)
  ).slice(0, 64);

  const detail = stripSensitive({
    result: String(input.result || "OK").slice(0, 64),
    websiteContacted: input.websiteContacted !== false,
    reason: input.reason ? String(input.reason).slice(0, 500) : null,
    requestedMethod: input.requestedMethod
      ? String(input.requestedMethod).toUpperCase().slice(0, 16)
      : "GET",
    requestedUrl: sanitizeUrl(input.requestedUrl),
    destinationUrl: sanitizeUrl(input.destinationUrl),
    siteId: input.siteId != null ? Number(input.siteId) : null,
    sourceName: input.sourceName ? String(input.sourceName).slice(0, 255) : null,
    statusCode: input.statusCode != null ? Number(input.statusCode) : null,
    durationMs: input.durationMs != null ? Number(input.durationMs) : null,
    changeDetected: input.changeDetected === true,
    dryRun: input.dryRun === true,
    selectorStatus: input.selectorStatus || null,
    process: buildProcessContext(),
    ...(input.detail && typeof input.detail === "object" ? input.detail : {})
  });

  try {
    return await auditEnterpriseRepository.recordEvent({
      category: input.dryRun ? "dry_run" : "monitoring",
      eventType,
      entityType: input.siteId != null ? "monitored_site" : "monitoring_http",
      entityId: input.siteId != null ? Number(input.siteId) : null,
      action: String(input.action || "GET").slice(0, 128),
      actor: String(input.actor || (input.dryRun ? "monitoring_dry_run" : "monitoring_worker")).slice(
        0,
        128
      ),
      status: String(input.status || "ok").slice(0, 32),
      detail
    });
  } catch (err) {
    logger.warn("monitoring-execution-audit: record failed", {
      eventType,
      message: err && err.message ? err.message : String(err)
    });
    return null;
  }
}

/**
 * Config / control-plane change audit (enable/disable, kill switch, mode).
 */
async function recordControlAudit(input = {}) {
  const eventType = String(input.eventType || SECURITY_EVENT_TYPES.CONFIG_CHANGED).slice(0, 64);
  const detail = stripSensitive({
    result: String(input.result || "RECORDED").slice(0, 64),
    reason: input.reason ? String(input.reason).slice(0, 500) : null,
    siteId: input.siteId != null ? Number(input.siteId) : null,
    process: buildProcessContext(),
    ...(input.detail && typeof input.detail === "object" ? input.detail : {})
  });

  try {
    return await auditEnterpriseRepository.recordEvent({
      category: "controls",
      eventType,
      entityType: input.entityType || (input.siteId != null ? "monitored_site" : "automation_control"),
      entityId: input.siteId != null ? Number(input.siteId) : null,
      action: String(input.action || eventType).slice(0, 128),
      actor: String(input.actor || "automation_control_plane").slice(0, 128),
      status: String(input.status || "ok").slice(0, 32),
      detail
    });
  } catch (err) {
    logger.warn("monitoring-control-audit: record failed", {
      eventType,
      message: err && err.message ? err.message : String(err)
    });
    return null;
  }
}

module.exports = {
  SECURITY_EVENT_TYPES,
  recordBlockedSecurityEvent,
  recordExecutionAudit,
  recordControlAudit,
  sanitizeUrl
};
