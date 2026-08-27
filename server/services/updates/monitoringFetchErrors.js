"use strict";

/**
 * Classifies monitoring fetch failures so 429/auth/timeouts are not
 * treated identically to "site unavailable."
 */

function classifyMonitoringHttpError(err) {
  if (!err) {
    return { kind: "unknown", status: 0, retryable: true, rateLimited: false };
  }

  const status = Number(
    (err.response && err.response.status) ||
      err.status ||
      err.statusCode ||
      0
  );
  const code = String(err.code || "");
  const message = String(err.message || "");

  if (status === 429) {
    return {
      kind: "rate_limited",
      status: 429,
      retryable: true,
      rateLimited: true,
      retryAfter: err.response && err.response.headers ? err.response.headers["retry-after"] : null
    };
  }
  if (status === 401 || status === 403) {
    return {
      kind: "access_denied",
      status,
      retryable: false,
      rateLimited: false
    };
  }
  if (status === 408) {
    return { kind: "timeout", status: 408, retryable: true, rateLimited: false };
  }
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return { kind: "upstream_error", status, retryable: true, rateLimited: false };
  }
  if (
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT" ||
    /timeout/i.test(message)
  ) {
    return { kind: "timeout", status: 0, retryable: true, rateLimited: false };
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return { kind: "dns_error", status: 0, retryable: true, rateLimited: false };
  }
  if (status >= 400 && status < 500) {
    return { kind: "http_client_error", status, retryable: false, rateLimited: false };
  }
  if (status >= 500) {
    return { kind: "upstream_error", status, retryable: true, rateLimited: false };
  }
  return { kind: "network_error", status: 0, retryable: true, rateLimited: false, code };
}

function createMonitoringFetchError(classification, cause) {
  const err = new Error(
    `monitoring_fetch_${classification.kind}${classification.status ? `_${classification.status}` : ""}`
  );
  err.code = "MONITORING_FETCH_ERROR";
  err.classification = classification;
  err.cause = cause;
  err.statusCode = classification.status || undefined;
  return err;
}

module.exports = {
  classifyMonitoringHttpError,
  createMonitoringFetchError
};
