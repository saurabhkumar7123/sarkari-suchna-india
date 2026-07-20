"use strict";

/**
 * Phase 52 — Runtime Capability Validation (observation-safe).
 *
 * Structurally validates an observed / resolved capability object. Operates
 * only on the capability value supplied by the caller (typically Phase 51
 * observation). Never accesses the capability registry, Access API, or
 * Resolver. Never writes to runtime metadata, never logs, never throws for
 * validation failures, and never influences runtime branching or execution.
 *
 * Informational only. Independent from workers, adapters, pipelines, and
 * enablement.
 */

const VALIDATION_PHASE = 52;

/**
 * Structural fields expected on a capability identity object.
 * Hard-coded so this module never imports the registry.
 * @type {readonly string[]}
 */
const REQUIRED_STRUCTURAL_FIELDS = Object.freeze([
  "id",
  "name",
  "phase",
  "description",
  "available",
  "wired",
  "enabled",
  "architectureOnly",
  "productionReady",
  "dependencies"
]);

const VALIDATION_REASONS = Object.freeze({
  VALID: "VALID",
  MISSING_CAPABILITY: "MISSING_CAPABILITY",
  INVALID_CAPABILITY: "INVALID_CAPABILITY",
  MISSING_IDENTIFIER: "MISSING_IDENTIFIER",
  IDENTIFIER_MISMATCH: "IDENTIFIER_MISMATCH",
  MISSING_METADATA: "MISSING_METADATA",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  VALIDATION_ERROR: "VALIDATION_ERROR"
});

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {*} value
 * @returns {string|null}
 */
function normalizeCapabilityId(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed === "" ? null : trimmed;
}

/**
 * Build a frozen, normalized validation result. Always returns a result shape;
 * never throws to the caller.
 *
 * @param {{
 *   valid: boolean,
 *   expectedCapabilityId?: string|null,
 *   capabilityId?: string|null,
 *   errors?: string[],
 *   reasons?: string[]
 * }} parts
 * @returns {Readonly<{
 *   phase: number,
 *   validationOnly: boolean,
 *   informational: boolean,
 *   valid: boolean,
 *   expectedCapabilityId: string|null,
 *   capabilityId: string|null,
 *   errors: readonly string[],
 *   reasons: readonly string[]
 * }>}
 */
function normalizeValidationResult(parts) {
  const errors = Array.isArray(parts.errors) ? parts.errors.slice() : [];
  const reasons = Array.isArray(parts.reasons) ? parts.reasons.slice() : [];
  const valid = parts.valid === true && errors.length === 0;

  if (valid && reasons.length === 0) {
    reasons.push(VALIDATION_REASONS.VALID);
  }

  return Object.freeze({
    phase: VALIDATION_PHASE,
    validationOnly: true,
    informational: true,
    valid,
    expectedCapabilityId:
      typeof parts.expectedCapabilityId === "string"
        ? parts.expectedCapabilityId
        : parts.expectedCapabilityId == null
          ? null
          : String(parts.expectedCapabilityId),
    capabilityId:
      typeof parts.capabilityId === "string"
        ? parts.capabilityId
        : parts.capabilityId == null
          ? null
          : String(parts.capabilityId),
    errors: Object.freeze(errors),
    reasons: Object.freeze(reasons)
  });
}

/**
 * Structurally validate an observed capability.
 * Checks existence, expected identifier, metadata object presence, and
 * required field definitions only — no business-logic enforcement.
 *
 * Never throws. Unexpected internal failures yield an invalid informational
 * result.
 *
 * @param {Object|null|undefined} capability
 * @param {string|null|undefined} [expectedCapabilityId]
 * @returns {Readonly<{
 *   phase: number,
 *   validationOnly: boolean,
 *   informational: boolean,
 *   valid: boolean,
 *   expectedCapabilityId: string|null,
 *   capabilityId: string|null,
 *   errors: readonly string[],
 *   reasons: readonly string[]
 * }>}
 */
function validateObservedCapability(capability, expectedCapabilityId) {
  const expectedId =
    expectedCapabilityId == null ? null : String(expectedCapabilityId);

  try {
    const errors = [];
    const reasons = [];

    if (capability == null) {
      return normalizeValidationResult({
        valid: false,
        expectedCapabilityId: expectedId,
        capabilityId: null,
        errors: ["capability does not exist"],
        reasons: [VALIDATION_REASONS.MISSING_CAPABILITY]
      });
    }

    if (!isPlainObject(capability)) {
      return normalizeValidationResult({
        valid: false,
        expectedCapabilityId: expectedId,
        capabilityId: null,
        errors: ["capability metadata must be a plain object"],
        reasons: [
          VALIDATION_REASONS.INVALID_CAPABILITY,
          VALIDATION_REASONS.MISSING_METADATA
        ]
      });
    }

    // Capability identity object is the structural "metadata" container.
    // Presence of a plain object satisfies the metadata-object expectation;
    // missing required fields are reported separately below.

    const actualIdRaw =
      Object.prototype.hasOwnProperty.call(capability, "id") &&
      typeof capability.id === "string"
        ? capability.id
        : null;
    const actualNormalized = normalizeCapabilityId(actualIdRaw);
    const expectedNormalized = normalizeCapabilityId(expectedId);

    if (actualIdRaw == null || actualNormalized == null) {
      errors.push("expected capability identifier is missing");
      reasons.push(VALIDATION_REASONS.MISSING_IDENTIFIER);
    } else if (
      expectedNormalized != null &&
      actualNormalized !== expectedNormalized
    ) {
      errors.push(
        `capability identifier mismatch: expected "${expectedId}", got "${actualIdRaw}"`
      );
      reasons.push(VALIDATION_REASONS.IDENTIFIER_MISMATCH);
    }

    for (let i = 0; i < REQUIRED_STRUCTURAL_FIELDS.length; i += 1) {
      const field = REQUIRED_STRUCTURAL_FIELDS[i];
      if (!Object.prototype.hasOwnProperty.call(capability, field)) {
        errors.push(`missing required capability field: ${field}`);
        reasons.push(VALIDATION_REASONS.MISSING_REQUIRED_FIELD);
      } else if (capability[field] === undefined) {
        errors.push(`required capability field is undefined: ${field}`);
        reasons.push(VALIDATION_REASONS.MISSING_REQUIRED_FIELD);
      }
    }

    return normalizeValidationResult({
      valid: errors.length === 0,
      expectedCapabilityId: expectedId,
      capabilityId: actualIdRaw,
      errors,
      reasons
    });
  } catch {
    return normalizeValidationResult({
      valid: false,
      expectedCapabilityId: expectedId,
      capabilityId: null,
      errors: ["capability validation failed unexpectedly"],
      reasons: [VALIDATION_REASONS.VALIDATION_ERROR]
    });
  }
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRuntimeCapabilityValidationResult(value) {
  return (
    isPlainObject(value) &&
    value.phase === VALIDATION_PHASE &&
    value.validationOnly === true &&
    value.informational === true &&
    typeof value.valid === "boolean" &&
    Object.prototype.hasOwnProperty.call(value, "expectedCapabilityId") &&
    Object.prototype.hasOwnProperty.call(value, "capabilityId") &&
    Array.isArray(value.errors) &&
    Array.isArray(value.reasons)
  );
}

module.exports = {
  VALIDATION_PHASE,
  REQUIRED_STRUCTURAL_FIELDS,
  VALIDATION_REASONS,
  validateObservedCapability,
  normalizeValidationResult,
  isRuntimeCapabilityValidationResult
};
