"use strict";

const crypto = require("crypto");

/**
 * Document identity at extraction time.
 * Listing fingerprint (title+link) remains the crawler's change signal.
 * SHA-256 of PDF bytes distinguishes duplicate vs revision.
 */

function hashDocumentBytes(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function normalizeCanonicalUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return raw;
  }
}

/**
 * @param {{
 *   existingHash?: string|null,
 *   incomingHash?: string|null,
 *   existingUpdateId?: number|null,
 *   sameListing?: boolean
 * }} input
 */
function evaluateDocumentRevision(input = {}) {
  const existingHash = input.existingHash ? String(input.existingHash).toLowerCase() : null;
  const incomingHash = input.incomingHash ? String(input.incomingHash).toLowerCase() : null;
  const existingUpdateId = Number(input.existingUpdateId);
  const hasExisting = Number.isFinite(existingUpdateId) && existingUpdateId > 0;

  if (!hasExisting) {
    return Object.freeze({
      action: "new_update",
      reason: "no_existing_listing",
      reuseUpdateId: null,
      supersedesUpdateId: null
    });
  }

  if (!incomingHash) {
    return Object.freeze({
      action: "reuse_duplicate",
      reason: "existing_listing_without_incoming_hash",
      reuseUpdateId: existingUpdateId,
      supersedesUpdateId: null
    });
  }

  if (!existingHash) {
    return Object.freeze({
      action: "store_hash_on_existing",
      reason: "historical_update_missing_hash",
      reuseUpdateId: existingUpdateId,
      supersedesUpdateId: null
    });
  }

  if (existingHash === incomingHash) {
    return Object.freeze({
      action: "reuse_duplicate",
      reason: "same_document_hash",
      reuseUpdateId: existingUpdateId,
      supersedesUpdateId: null
    });
  }

  return Object.freeze({
    action: "revision_new_update",
    reason: "same_url_different_document_hash",
    reuseUpdateId: null,
    supersedesUpdateId: existingUpdateId
  });
}

module.exports = {
  hashDocumentBytes,
  normalizeCanonicalUrl,
  evaluateDocumentRevision
};
