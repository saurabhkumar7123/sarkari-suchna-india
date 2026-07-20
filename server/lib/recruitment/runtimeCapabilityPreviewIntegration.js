"use strict";

/**
 * Phase 56 — Preview Runtime Capability Integration Hook.
 *
 * Single future integration point for capability-aware preview features during
 * preview runtime initialization. Invoked immediately after the Phase 55
 * context read with the runtime object and the internal context-read snapshot.
 *
 * Phase 57 — first official capability consumer (observation-only). Consumes
 * the Phase 55 context-read snapshot by inspecting its shape and normalizing
 * local references only. Never modifies the snapshot, never rebuilds it,
 * never branches on snapshot values, never enables or disables features, and
 * never mutates runtime state, metadata, or worker outputs.
 *
 * Gracefully handles missing context read (null / undefined). Never throws
 * for hook failures, never logs, never influences execution, and never
 * projects into worker outputs.
 */

const INTEGRATION_PHASE = 56;
const CONSUMER_PHASE = 57;
const CONTEXT_READ_PHASE = 55;

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
 * Verify the Phase 55 context-read snapshot shape without branching on
 * capability state values.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isRuntimeCapabilityContextReadShape(value) {
  return (
    isPlainObject(value) &&
    value.phase === CONTEXT_READ_PHASE &&
    value.readOnly === true &&
    value.informational === true &&
    typeof value.contextPresent === "boolean"
  );
}

/**
 * Build a frozen local normalized reference from a verified context-read
 * snapshot. Never mutates the supplied snapshot.
 *
 * @param {Object} contextRead verified Phase 55 read snapshot
 * @returns {Readonly<Object>}
 */
function normalizeConsumedContextReadSnapshot(contextRead) {
  return Object.freeze({
    phase: CONTEXT_READ_PHASE,
    readOnly: true,
    informational: true,
    contextPresent: normalizeBoolean(contextRead.contextPresent),
    contextPhase: normalizeNumber(contextRead.contextPhase),
    capabilityId: normalizeString(contextRead.capabilityId),
    awarenessPresent: normalizeBoolean(contextRead.awarenessPresent),
    awarenessPhase: normalizeNumber(contextRead.awarenessPhase),
    observationPresent: normalizeBoolean(contextRead.observationPresent),
    validationPresent: normalizeBoolean(contextRead.validationPresent),
    structurallyValid: normalizeBoolean(contextRead.structurallyValid),
    available: normalizeBoolean(contextRead.available),
    wired: normalizeBoolean(contextRead.wired),
    enabled: normalizeBoolean(contextRead.enabled),
    architectureOnly: normalizeBoolean(contextRead.architectureOnly),
    productionReady: normalizeBoolean(contextRead.productionReady),
    capabilityName: normalizeString(contextRead.capabilityName),
    capabilityPhase: normalizeNumber(contextRead.capabilityPhase)
  });
}

/**
 * Observation-only consumption of the Phase 55 context-read snapshot.
 * Inspects shape, verifies expected markers, and normalizes local references.
 * Returns null when the snapshot is absent or malformed. Never modifies the
 * supplied snapshot. Never throws.
 *
 * @param {Readonly<Object>|null|undefined} contextRead internal Phase 55 read
 * @returns {Readonly<Object>|null} frozen local normalized reference or null
 */
function consumePreviewRuntimeCapabilityContextRead(contextRead) {
  try {
    if (!isRuntimeCapabilityContextReadShape(contextRead)) {
      return null;
    }

    return normalizeConsumedContextReadSnapshot(contextRead);
  } catch {
    return null;
  }
}

/**
 * Preview runtime capability integration hook.
 * Receives the runtime initialization result and the Phase 55 context-read
 * snapshot for capability-aware preview integration.
 *
 * @param {Object|null|undefined} runtimeObject
 * @param {Readonly<Object>|null|undefined} contextRead internal Phase 55 read
 * @returns {Object|null|undefined} same runtime reference
 */
function invokePreviewRuntimeCapabilityIntegration(runtimeObject, contextRead) {
  if (!isPlainObject(runtimeObject)) {
    return runtimeObject;
  }

  try {
    consumePreviewRuntimeCapabilityContextRead(contextRead);
  } catch {
    // Optional / non-breaking: preserve existing runtime behavior.
  }

  return runtimeObject;
}

module.exports = {
  INTEGRATION_PHASE,
  CONSUMER_PHASE,
  CONTEXT_READ_PHASE,
  consumePreviewRuntimeCapabilityContextRead,
  isRuntimeCapabilityContextReadShape,
  invokePreviewRuntimeCapabilityIntegration
};
