"use strict";

/**
 * Phase AI-2 — Duplicate candidate fingerprint.
 *
 * Generates stable fingerprints for a normalized event so a later phase can
 * match duplicates. This module deliberately makes NO duplicate decision: it
 * only produces deterministic keys.
 */

const crypto = require("crypto");

const { FINGERPRINT_ALGORITHM } = require("./types");
const { collapse, toComparableKey } = require("./textUtils");

const HASH_ALGORITHM = "sha256";
const COMPONENT_SEPARATOR = "|";
const EMPTY_COMPONENT = "-";

/**
 * Identifiers differ only in punctuation across notices ("A-1/E-1/2026" vs
 * "A1/E1/2026"), so they are compared on alphanumerics alone.
 * @param {*} value
 * @returns {string}
 */
function normalizeIdentifier(value) {
  const text = collapse(value).toLowerCase();
  if (!text) return "";
  return text.replace(/[^a-z0-9]/g, "");
}

/**
 * @param {string} canonicalString
 * @returns {string}
 */
function hashCanonicalString(canonicalString) {
  const hash = crypto.createHash(HASH_ALGORITHM).update(canonicalString, "utf8").digest("hex");
  return `${FINGERPRINT_ALGORITHM}:${hash}`;
}

/**
 * @param {string[]} parts
 * @returns {string}
 */
function joinComponents(parts) {
  return parts.map((part) => (part && part.length ? part : EMPTY_COMPONENT)).join(COMPONENT_SEPARATOR);
}

/**
 * Build the duplicate-candidate fingerprint for a notice event.
 *
 * @param {{
 *   normalizedTitle?: string,
 *   department?: string,
 *   departmentCode?: string,
 *   advertisementNumber?: string,
 *   referenceNumber?: string,
 *   year?: number|string
 * }} input
 * @returns {{
 *   algorithm: string,
 *   fingerprint: string,
 *   canonicalString: string,
 *   components: object,
 *   presentComponents: string[],
 *   missingComponents: string[],
 *   strength: string,
 *   variants: object,
 *   duplicateDecision: null,
 *   advisoryOnly: true
 * }}
 */
function buildFingerprint(input = {}) {
  const components = {
    normalizedTitle: toComparableKey(input.normalizedTitle),
    department: toComparableKey(input.departmentCode || input.department),
    advertisementNumber: normalizeIdentifier(input.advertisementNumber),
    referenceNumber: normalizeIdentifier(input.referenceNumber),
    year: input.year ? String(input.year).trim() : ""
  };

  const order = ["normalizedTitle", "department", "advertisementNumber", "referenceNumber", "year"];
  const canonicalString = joinComponents(order.map((key) => components[key]));
  const presentComponents = order.filter((key) => components[key]);
  const missingComponents = order.filter((key) => !components[key]);

  const hasIdentifier = Boolean(components.advertisementNumber || components.referenceNumber);
  let strength = "weak";
  if (hasIdentifier && components.department && components.year) strength = "strong";
  else if (hasIdentifier || (components.department && components.normalizedTitle)) strength = "moderate";

  return {
    algorithm: FINGERPRINT_ALGORITHM,
    fingerprint: hashCanonicalString(canonicalString),
    canonicalString,
    components,
    presentComponents,
    missingComponents,
    strength,
    variants: {
      // Identifier-only key: survives title rewording between corrigenda.
      identifier: hashCanonicalString(
        joinComponents([
          components.department,
          components.advertisementNumber,
          components.referenceNumber,
          components.year
        ])
      ),
      // Title key: survives a missing / changed advertisement number.
      title: hashCanonicalString(
        joinComponents([components.normalizedTitle, components.department, components.year])
      )
    },
    // Duplicate resolution is explicitly out of scope for Phase AI-2.
    duplicateDecision: null,
    advisoryOnly: true
  };
}

module.exports = {
  HASH_ALGORITHM,
  normalizeIdentifier,
  hashCanonicalString,
  buildFingerprint
};
