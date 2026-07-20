"use strict";

/**
 * Phase 54 — Preview Runtime Capability Context.
 *
 * Builds an internal context container from Runtime Capability Awareness
 * (Phase 53) only. The context holds normalized immutable scalar references
 * derived from awareness — never re-resolves capabilities, never rebuilds
 * awareness, and never accesses the Registry, Access API, or Resolver.
 *
 * Container only. Never writes to runtime metadata, never projects into
 * worker outputs, never logs, never throws for context failures, never
 * branches runtime behavior, and never influences execution.
 *
 * Context is stored in an internal WeakMap keyed by the runtime result
 * object — never a public field.
 */

const CONTEXT_PHASE = 54;

/**
 * Internal context store keyed by the runtime result object.
 * Not enumerable, not JSON-serializable, not a public field.
 * @type {WeakMap<Object, Readonly<Object>>}
 */
const contextByRuntime = new WeakMap();

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
 * Build a frozen context container from capability awareness.
 * Contains only normalized immutable scalar references — no live capability
 * objects, no registry handles, no resolver results.
 * Returns null when context cannot be created (absent / malformed awareness).
 * Never throws. Never rebuilds awareness.
 *
 * @param {Object|null|undefined} awareness
 * @returns {Readonly<{
 *   phase: number,
 *   contextOnly: boolean,
 *   informational: boolean,
 *   capabilityId: string|null,
 *   awarenessPresent: boolean,
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
function buildRuntimeCapabilityContext(awareness) {
  try {
    if (
      !isPlainObject(awareness) ||
      awareness.awarenessOnly !== true ||
      awareness.informational !== true
    ) {
      return null;
    }

    return Object.freeze({
      phase: CONTEXT_PHASE,
      contextOnly: true,
      informational: true,
      capabilityId: normalizeString(awareness.capabilityId),
      awarenessPresent: true,
      awarenessPhase: normalizeNumber(awareness.phase),
      observationPresent: normalizeBoolean(awareness.observationPresent),
      validationPresent: normalizeBoolean(awareness.validationPresent),
      structurallyValid: normalizeBoolean(awareness.structurallyValid),
      available: normalizeBoolean(awareness.available),
      wired: normalizeBoolean(awareness.wired),
      enabled: normalizeBoolean(awareness.enabled),
      architectureOnly: normalizeBoolean(awareness.architectureOnly),
      productionReady: normalizeBoolean(awareness.productionReady),
      capabilityName: normalizeString(awareness.capabilityName),
      capabilityPhase: normalizeNumber(awareness.capabilityPhase)
    });
  } catch {
    return null;
  }
}

/**
 * Attach a context container derived from existing awareness.
 * Never mutates public runtime fields. On failure, leaves runtime unchanged.
 * Does not rebuild awareness — consumes the awareness value supplied by the caller.
 *
 * @param {Object|null|undefined} runtimeObject
 * @param {Object|null|undefined} awareness
 * @returns {Object|null|undefined} same runtime reference
 */
function attachRuntimeCapabilityContext(runtimeObject, awareness) {
  if (!isPlainObject(runtimeObject)) {
    return runtimeObject;
  }

  try {
    const context = buildRuntimeCapabilityContext(awareness);
    if (context != null) {
      contextByRuntime.set(runtimeObject, context);
    }
  } catch {
    // Optional / non-breaking: preserve existing runtime behavior.
  }

  return runtimeObject;
}

/**
 * Read the internal capability context for a runtime result, if any.
 * For architecture / tests only — not part of public advisory projections.
 *
 * @param {Object|null|undefined} runtimeObject
 * @returns {Readonly<Object>|null}
 */
function peekRuntimeCapabilityContext(runtimeObject) {
  if (!isPlainObject(runtimeObject)) {
    return null;
  }
  const context = contextByRuntime.get(runtimeObject);
  return context == null ? null : context;
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRuntimeCapabilityContext(value) {
  return (
    isPlainObject(value) &&
    value.phase === CONTEXT_PHASE &&
    value.contextOnly === true &&
    value.informational === true &&
    value.awarenessPresent === true &&
    Object.prototype.hasOwnProperty.call(value, "capabilityId")
  );
}

module.exports = {
  CONTEXT_PHASE,
  buildRuntimeCapabilityContext,
  attachRuntimeCapabilityContext,
  peekRuntimeCapabilityContext,
  isRuntimeCapabilityContext
};
