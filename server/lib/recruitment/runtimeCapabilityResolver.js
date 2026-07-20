"use strict";

/**
 * Phase 50 — Runtime Capability Resolver (read-only).
 *
 * Single abstraction responsible for resolving capability metadata. Uses the
 * Phase 49 Runtime Capability Access API exclusively. Never accesses the registry directly.
 *
 * Never clones capability objects. Preserves object identity. Never mutates
 * resolved capabilities. No caching. No lazy loading. No execution. No
 * feature enablement. No branching on capability state. No runtime behavior
 * changes. Never writes to database, files, or console. Never modifies
 * workers, adapters, pipelines, or enablement logic. Independent from runtime execution.
 */

const {
  getCapability,
  hasCapability,
  createRuntimeCapabilityAccess
} = require("./runtimeCapabilityAccess");

const RESOLVER_PHASE = 50;

/**
 * Resolve a single capability by id. Returns the existing capability object
 * or null when unknown / invalid. Does not clone; identity matches Access API.
 *
 * @param {string} capabilityId
 * @param {Object|null|undefined} [registryOrRuntime]
 * @returns {Object|null}
 */
function resolveCapability(capabilityId, registryOrRuntime) {
  return getCapability(capabilityId, registryOrRuntime);
}

/**
 * Resolve multiple capability ids in order. Unknown / invalid ids yield null
 * at the corresponding index. Does not clone entries.
 *
 * @param {Array<string>|null|undefined} capabilityIds
 * @param {Object|null|undefined} [registryOrRuntime]
 * @returns {Array<Object|null>}
 */
function resolveCapabilities(capabilityIds, registryOrRuntime) {
  if (!Array.isArray(capabilityIds)) {
    return [];
  }

  const resolved = [];
  for (let i = 0; i < capabilityIds.length; i += 1) {
    resolved.push(resolveCapability(capabilityIds[i], registryOrRuntime));
  }
  return resolved;
}

/**
 * @param {string} capabilityId
 * @param {Object|null|undefined} [registryOrRuntime]
 * @returns {boolean}
 */
function capabilityExists(capabilityId, registryOrRuntime) {
  return hasCapability(capabilityId, registryOrRuntime);
}

/**
 * Bind a read-only resolver façade to a specific registry or runtime object
 * via the Access API.
 *
 * @param {Object|null|undefined} [registryOrRuntime]
 * @returns {Readonly<{
 *   resolveCapability: function(string): Object|null,
 *   resolveCapabilities: function(Array<string>): Array<Object|null>,
 *   capabilityExists: function(string): boolean,
 *   getAccess: function(): Readonly<Object>
 * }>}
 */
function createRuntimeCapabilityResolver(registryOrRuntime) {
  const access = createRuntimeCapabilityAccess(registryOrRuntime);

  return Object.freeze({
    resolveCapability(capabilityId) {
      return access.getCapability(capabilityId);
    },
    resolveCapabilities(capabilityIds) {
      if (!Array.isArray(capabilityIds)) {
        return [];
      }
      const resolved = [];
      for (let i = 0; i < capabilityIds.length; i += 1) {
        resolved.push(access.getCapability(capabilityIds[i]));
      }
      return resolved;
    },
    capabilityExists(capabilityId) {
      return access.hasCapability(capabilityId);
    },
    getAccess() {
      return access;
    }
  });
}

module.exports = {
  RESOLVER_PHASE,
  resolveCapability,
  resolveCapabilities,
  capabilityExists,
  createRuntimeCapabilityResolver
};
