"use strict";

/**
 * Phase 53 — Preview Runtime Capability Awareness.
 *
 * Builds normalized internal awareness state from a validated capability
 * observation (Phase 51 + Phase 52). Operates only on the observation value
 * supplied by the caller. Never accesses the capability registry, Access API,
 * or Resolver. Never re-resolves capabilities. Never writes to runtime
 * metadata, never projects into worker outputs, never logs, never throws for
 * awareness failures, and never influences runtime branching or execution.
 *
 * Informational only. Awareness is stored in an internal WeakMap keyed by the
 * runtime result object — never a public field.
 */

const AWARENESS_PHASE = 53;

/**
 * Internal awareness store keyed by the runtime result object.
 * Not enumerable, not JSON-serializable, not a public field.
 * @type {WeakMap<Object, Readonly<Object>>}
 */
const awarenessByRuntime = new WeakMap();

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {*} value
 * @returns {boolean|null}
 */
function normalizeBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

/**
 * @param {*} value
 * @returns {string|null}
 */
function normalizeString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * @param {*} value
 * @returns {number|null}
 */
function normalizeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Build a frozen, normalized awareness state from a validated observation.
 * Returns null when awareness cannot be created (absent / malformed observation).
 * Never throws.
 *
 * @param {Object|null|undefined} observation
 * @returns {Readonly<{
 *   phase: number,
 *   awarenessOnly: boolean,
 *   informational: boolean,
 *   capabilityId: string|null,
 *   observationPresent: boolean,
 *   observationPhase: number|null,
 *   validationPresent: boolean,
 *   structurallyValid: boolean,
 *   available: boolean|null,
 *   wired: boolean|null,
 *   enabled: boolean|null,
 *   architectureOnly: boolean|null,
 *   productionReady: boolean|null,
 *   capabilityName: string|null,
 *   capabilityPhase: number|null
 * }>|null}
 */
function buildRuntimeCapabilityAwareness(observation) {
  try {
    if (!isPlainObject(observation) || observation.observationOnly !== true) {
      return null;
    }

    const capability = isPlainObject(observation.capability)
      ? observation.capability
      : null;
    const validation = isPlainObject(observation.validation)
      ? observation.validation
      : null;

    const capabilityId =
      normalizeString(observation.capabilityId) ??
      (capability != null ? normalizeString(capability.id) : null);

    return Object.freeze({
      phase: AWARENESS_PHASE,
      awarenessOnly: true,
      informational: true,
      capabilityId,
      observationPresent: true,
      observationPhase: normalizeNumber(observation.phase),
      validationPresent: validation != null,
      structurallyValid: validation != null && validation.valid === true,
      available: capability != null ? normalizeBoolean(capability.available) : null,
      wired: capability != null ? normalizeBoolean(capability.wired) : null,
      enabled: capability != null ? normalizeBoolean(capability.enabled) : null,
      architectureOnly:
        capability != null ? normalizeBoolean(capability.architectureOnly) : null,
      productionReady:
        capability != null ? normalizeBoolean(capability.productionReady) : null,
      capabilityName:
        capability != null ? normalizeString(capability.name) : null,
      capabilityPhase:
        capability != null ? normalizeNumber(capability.phase) : null
    });
  } catch {
    return null;
  }
}

/**
 * Attach normalized awareness derived from a validated observation.
 * Never mutates public runtime fields. On failure, leaves runtime unchanged.
 * Returns the attached awareness (or null) so callers can consume the same
 * awareness value without rebuilding it.
 *
 * @param {Object|null|undefined} runtimeObject
 * @param {Object|null|undefined} observation
 * @returns {Readonly<Object>|null} attached awareness, or null
 */
function attachRuntimeCapabilityAwareness(runtimeObject, observation) {
  if (!isPlainObject(runtimeObject)) {
    return null;
  }

  try {
    const awareness = buildRuntimeCapabilityAwareness(observation);
    if (awareness != null) {
      awarenessByRuntime.set(runtimeObject, awareness);
      return awareness;
    }
  } catch {
    // Optional / non-breaking: preserve existing runtime behavior.
  }

  return null;
}

/**
 * Read the internal capability awareness for a runtime result, if any.
 * For architecture / tests only — not part of public advisory projections.
 *
 * @param {Object|null|undefined} runtimeObject
 * @returns {Readonly<Object>|null}
 */
function peekRuntimeCapabilityAwareness(runtimeObject) {
  if (!isPlainObject(runtimeObject)) {
    return null;
  }
  const awareness = awarenessByRuntime.get(runtimeObject);
  return awareness == null ? null : awareness;
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRuntimeCapabilityAwareness(value) {
  return (
    isPlainObject(value) &&
    value.phase === AWARENESS_PHASE &&
    value.awarenessOnly === true &&
    value.informational === true &&
    typeof value.observationPresent === "boolean" &&
    typeof value.validationPresent === "boolean" &&
    typeof value.structurallyValid === "boolean" &&
    Object.prototype.hasOwnProperty.call(value, "capabilityId")
  );
}

module.exports = {
  AWARENESS_PHASE,
  buildRuntimeCapabilityAwareness,
  attachRuntimeCapabilityAwareness,
  peekRuntimeCapabilityAwareness,
  isRuntimeCapabilityAwareness
};
