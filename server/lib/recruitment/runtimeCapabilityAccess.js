"use strict";

/**
 * Phase 49 — Runtime Capability Access API (read-only).
 *
 * Stable read-only abstraction over the attached runtime capability registry
 * so future phases never access registry internals directly.
 *
 * Wraps the shared registry exposed by Phase 48 integration. Never duplicates
 * the registry. Never clones capability objects. Preserves object identity.
 * Never mutates the registry. No caching. No lazy loading. No execution.
 * No feature enablement. No branching on capability state. No runtime
 * behavior changes. Never writes to database, files, or console. Never
 * modifies workers, adapters, pipelines, or enablement logic.
 */

const {
  getRuntimeCapabilityRegistry,
  peekAttachedCapabilityRegistry
} = require("./runtimeCapabilityRegistryIntegration");

const ACCESS_PHASE = 49;

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
  if (value == null || value === "") {
    return null;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === "" ? null : normalized;
}

/**
 * Resolve the registry to wrap. Prefer an explicit registry, then a runtime
 * object's attached registry, then the shared Phase 48 singleton.
 *
 * @param {Object|null|undefined} registryOrRuntime
 * @returns {Readonly<Object>}
 */
function resolveAccessRegistry(registryOrRuntime) {
  if (
    isPlainObject(registryOrRuntime) &&
    Array.isArray(registryOrRuntime.capabilities)
  ) {
    return registryOrRuntime;
  }
  if (registryOrRuntime != null && isPlainObject(registryOrRuntime)) {
    return peekAttachedCapabilityRegistry(registryOrRuntime);
  }
  return getRuntimeCapabilityRegistry();
}

/**
 * Return the existing capability object for `id`, or null.
 * Does not clone; identity matches the registry entry.
 *
 * @param {string} capabilityId
 * @param {Object|null|undefined} [registryOrRuntime]
 * @returns {Object|null}
 */
function getCapability(capabilityId, registryOrRuntime) {
  const registry = resolveAccessRegistry(registryOrRuntime);
  const normalized = normalizeCapabilityId(capabilityId);
  if (normalized == null) {
    return null;
  }

  const capabilities = registry.capabilities;
  for (let i = 0; i < capabilities.length; i += 1) {
    const capability = capabilities[i];
    if (normalizeCapabilityId(capability.id) === normalized) {
      return capability;
    }
  }
  return null;
}

/**
 * @param {string} capabilityId
 * @param {Object|null|undefined} [registryOrRuntime]
 * @returns {boolean}
 */
function hasCapability(capabilityId, registryOrRuntime) {
  return getCapability(capabilityId, registryOrRuntime) != null;
}

/**
 * Return the registry's existing capabilities array (same reference).
 * Does not clone entries.
 *
 * @param {Object|null|undefined} [registryOrRuntime]
 * @returns {ReadonlyArray<Object>}
 */
function listCapabilities(registryOrRuntime) {
  return resolveAccessRegistry(registryOrRuntime).capabilities;
}

/**
 * Return the registry instance wrapped by this access API.
 *
 * @param {Object|null|undefined} [registryOrRuntime]
 * @returns {Readonly<Object>}
 */
function getAccessRegistry(registryOrRuntime) {
  return resolveAccessRegistry(registryOrRuntime);
}

/**
 * Bind a read-only access façade to a specific registry or runtime object.
 *
 * @param {Object|null|undefined} [registryOrRuntime]
 * @returns {Readonly<{
 *   getCapability: function(string): Object|null,
 *   hasCapability: function(string): boolean,
 *   listCapabilities: function(): ReadonlyArray<Object>,
 *   getRegistry: function(): Readonly<Object>
 * }>}
 */
function createRuntimeCapabilityAccess(registryOrRuntime) {
  const registry = resolveAccessRegistry(registryOrRuntime);

  return Object.freeze({
    getCapability(capabilityId) {
      return getCapability(capabilityId, registry);
    },
    hasCapability(capabilityId) {
      return hasCapability(capabilityId, registry);
    },
    listCapabilities() {
      return listCapabilities(registry);
    },
    getRegistry() {
      return registry;
    }
  });
}

module.exports = {
  ACCESS_PHASE,
  getCapability,
  hasCapability,
  listCapabilities,
  getAccessRegistry,
  createRuntimeCapabilityAccess
};
