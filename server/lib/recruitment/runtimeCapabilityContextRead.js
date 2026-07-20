"use strict";

/**
 * Phase 55 — Preview Runtime Capability Context Read.
 *
 * Performs the first internal read of the Preview Runtime Capability Context
 * (Phase 54) during preview runtime initialization. The read consumes the
 * existing context via peek only — never modifies the context, never rebuilds
 * it, never recreates awareness, and never re-resolves capabilities.
 *
 * Read-only and informational. Never accesses the Registry, Access API, or
 * Resolver. Never writes to runtime metadata, never projects into worker
 * outputs, never logs, never throws for read failures, never branches runtime
 * behavior, and never influences execution.
 *
 * Read result is stored in an internal WeakMap keyed by the runtime result
 * object — never a public field.
 */

const { peekRuntimeCapabilityContext } = require("./runtimeCapabilityContext");

const READ_PHASE = 55;

/**
 * Internal context-read store keyed by the runtime result object.
 * Not enumerable, not JSON-serializable, not a public field.
 * @type {WeakMap<Object, Readonly<Object>>}
 */
const contextReadByRuntime = new WeakMap();

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
 * Build a frozen read snapshot from an existing capability context.
 * Contains only normalized immutable scalar references — no live context
 * objects, no registry handles, no resolver results.
 * Returns null when context is absent or malformed.
 * Never throws. Never modifies the supplied context.
 *
 * @param {Object|null|undefined} context
 * @returns {Readonly<{
 *   phase: number,
 *   readOnly: boolean,
 *   informational: boolean,
 *   contextPresent: boolean,
 *   contextPhase: number|null,
 *   capabilityId: string|null,
 *   awarenessPresent: boolean|null,
 *   awarenessPhase: number|null,
 *   observationPresent: boolean|null,
 *   validationPresent: boolean|null,
 *   structurallyValid: boolean|null,
 *   available: boolean|null,
 *   wired: boolean|null,
 *   enabled: boolean|null,
 *   architectureOnly: boolean|null,
 *   productionReady: boolean|null,
 *   capabilityName: string|null,
 *   capabilityPhase: number|null
 * }>|null}
 */
function buildRuntimeCapabilityContextRead(context) {
  try {
    if (
      !isPlainObject(context) ||
      context.contextOnly !== true ||
      context.informational !== true ||
      context.awarenessPresent !== true
    ) {
      return null;
    }

    return Object.freeze({
      phase: READ_PHASE,
      readOnly: true,
      informational: true,
      contextPresent: true,
      contextPhase: normalizeNumber(context.phase),
      capabilityId: normalizeString(context.capabilityId),
      awarenessPresent: normalizeBoolean(context.awarenessPresent),
      awarenessPhase: normalizeNumber(context.awarenessPhase),
      observationPresent: normalizeBoolean(context.observationPresent),
      validationPresent: normalizeBoolean(context.validationPresent),
      structurallyValid: normalizeBoolean(context.structurallyValid),
      available: normalizeBoolean(context.available),
      wired: normalizeBoolean(context.wired),
      enabled: normalizeBoolean(context.enabled),
      architectureOnly: normalizeBoolean(context.architectureOnly),
      productionReady: normalizeBoolean(context.productionReady),
      capabilityName: normalizeString(context.capabilityName),
      capabilityPhase: normalizeNumber(context.capabilityPhase)
    });
  } catch {
    return null;
  }
}

/**
 * Read the internal capability context once and store an informational snapshot.
 * Never mutates public runtime fields or the stored context. On failure, leaves
 * runtime unchanged. Does not rebuild context or awareness.
 *
 * @param {Object|null|undefined} runtimeObject
 * @returns {Object|null|undefined} same runtime reference
 */
function readRuntimeCapabilityContext(runtimeObject) {
  if (!isPlainObject(runtimeObject)) {
    return runtimeObject;
  }

  try {
    const context = peekRuntimeCapabilityContext(runtimeObject);
    const read = buildRuntimeCapabilityContextRead(context);
    if (read != null) {
      contextReadByRuntime.set(runtimeObject, read);
    }
  } catch {
    // Optional / non-breaking: preserve existing runtime behavior.
  }

  return runtimeObject;
}

/**
 * Read the internal context-read snapshot for a runtime result, if any.
 * For architecture / tests only — not part of public advisory projections.
 *
 * @param {Object|null|undefined} runtimeObject
 * @returns {Readonly<Object>|null}
 */
function peekRuntimeCapabilityContextRead(runtimeObject) {
  if (!isPlainObject(runtimeObject)) {
    return null;
  }
  const read = contextReadByRuntime.get(runtimeObject);
  return read == null ? null : read;
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRuntimeCapabilityContextRead(value) {
  return (
    isPlainObject(value) &&
    value.phase === READ_PHASE &&
    value.readOnly === true &&
    value.informational === true &&
    typeof value.contextPresent === "boolean"
  );
}

module.exports = {
  READ_PHASE,
  buildRuntimeCapabilityContextRead,
  readRuntimeCapabilityContext,
  peekRuntimeCapabilityContextRead,
  isRuntimeCapabilityContextRead
};
