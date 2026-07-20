"use strict";

/**
 * Phase 48 — Runtime Capability Registry Integration (read-only).
 *
 * Attaches the architecture-only runtimeCapabilityRegistry to the central
 * preview runtime object so callers can observe the catalog.
 *
 * Read-only: never consumes capabilities, never branches on capability state,
 * never enables execution/persistence/review queues, never modifies workers,
 * adapters, pipelines, or enablement logic. Never writes to database, files,
 * or console. Never starts transactions or enqueues queues.
 *
 * Object identity of the shared registry is preserved across attachments.
 */

const {
  createCapabilityRegistry,
  isCapabilityRegistryArchitectureOnly
} = require("./runtimeCapabilityRegistry");

const INTEGRATION_PHASE = 48;

/**
 * Shared singleton registry instance for the runtime.
 * Created once; every attach returns this same reference.
 * @type {Readonly<Object>}
 */
const RUNTIME_CAPABILITY_REGISTRY = createCapabilityRegistry();

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Return the shared runtime capability registry (same object identity always).
 * @returns {Readonly<Object>}
 */
function getRuntimeCapabilityRegistry() {
  return RUNTIME_CAPABILITY_REGISTRY;
}

/**
 * Attach the shared capability registry to a runtime object without consuming
 * or interpreting any capability. Existing fields are preserved via shallow
 * copy; the registry reference is never cloned.
 *
 * @param {Object|null|undefined} runtimeObject
 * @returns {Object} runtime object with `capabilityRegistry` attached
 */
function attachRuntimeCapabilityRegistry(runtimeObject) {
  const base = isPlainObject(runtimeObject) ? { ...runtimeObject } : {};

  return {
    ...base,
    capabilityRegistry: RUNTIME_CAPABILITY_REGISTRY
  };
}

/**
 * Read the attached registry from a runtime object without consuming it.
 * Falls back to the shared singleton when absent.
 *
 * @param {Object|null|undefined} runtimeObject
 * @returns {Readonly<Object>}
 */
function peekAttachedCapabilityRegistry(runtimeObject) {
  if (
    isPlainObject(runtimeObject) &&
    runtimeObject.capabilityRegistry != null &&
    isPlainObject(runtimeObject.capabilityRegistry)
  ) {
    return runtimeObject.capabilityRegistry;
  }
  return RUNTIME_CAPABILITY_REGISTRY;
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isReadOnlyRegistryAttachment(value) {
  if (!isPlainObject(value)) {
    return false;
  }
  if (!Object.prototype.hasOwnProperty.call(value, "capabilityRegistry")) {
    return false;
  }
  return isCapabilityRegistryArchitectureOnly(value.capabilityRegistry);
}

module.exports = {
  INTEGRATION_PHASE,
  RUNTIME_CAPABILITY_REGISTRY,
  getRuntimeCapabilityRegistry,
  attachRuntimeCapabilityRegistry,
  peekAttachedCapabilityRegistry,
  isReadOnlyRegistryAttachment
};
