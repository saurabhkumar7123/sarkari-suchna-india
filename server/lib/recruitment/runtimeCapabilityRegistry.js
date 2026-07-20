"use strict";

/**
 * Phase 47 — Runtime Capability Registry (architecture only).
 *
 * Single source of truth describing architecture capabilities introduced in
 * Phases 33–46 of the Recruitment Lifecycle system.
 *
 * Descriptive metadata only. Never enables execution. Never modifies runtime
 * behavior. Never writes to database. Never writes files. Never uses console logging.
 * Never modifies workers. Never enables persistence. Never enables review queues.
 * Never calls repositories. Never starts transactions. Never enqueues queues.
 * Never imports database drivers, HTTP frameworks, queue libraries, filesystem
 * APIs, workers, or repository implementations.
 *
 * Registries are deterministic, side-effect-free, and advisory only:
 * architectureOnly is always true; enabled is always false;
 * productionReady remains false; executed remains false in metadata.
 */

const CAPABILITY_REGISTRY_PHASE = 47;

const CAPABILITY_IDS = Object.freeze({
  PERSISTENCE_POLICY: "persistence_policy",
  RUNTIME_PERSISTENCE_SERVICE: "runtime_persistence_service",
  REPOSITORY_CONTRACTS: "repository_contracts",
  MYSQL_REPOSITORY_ADAPTERS: "mysql_repository_adapters",
  EXECUTION_PIPELINE: "execution_pipeline",
  TRANSACTION_COORDINATOR: "transaction_coordinator",
  AUDIT_TRAIL: "audit_trail",
  EXECUTION_CONTEXT: "execution_context",
  PREVIEW_RUNTIME_WIRING: "preview_runtime_wiring",
  DRY_RUN_SIMULATOR: "dry_run_simulator",
  REVIEW_WORKFLOW: "review_workflow",
  PERSISTENCE_ENABLEMENT: "persistence_enablement",
  CONTROLLED_EXECUTION_ADAPTER: "controlled_execution_adapter",
  EXECUTION_DIAGNOSTICS: "execution_diagnostics"
});

const SUPPORTED_CAPABILITY_IDS = Object.freeze(
  new Set(Object.values(CAPABILITY_IDS))
);

const REQUIRED_CAPABILITY_FIELDS = Object.freeze([
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

const REQUIRED_REGISTRY_FIELDS = Object.freeze([
  "phase",
  "capabilities",
  "architectureOnly",
  "advisory",
  "metadata"
]);

const CAPABILITY_VALIDATION_REASONS = Object.freeze({
  VALID: "VALID",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_FIELD: "INVALID_FIELD",
  DUPLICATE_CAPABILITY_ID: "DUPLICATE_CAPABILITY_ID",
  UNKNOWN_DEPENDENCY: "UNKNOWN_DEPENDENCY",
  SELF_DEPENDENCY: "SELF_DEPENDENCY",
  REGISTRY_NOT_ARCHITECTURE_ONLY: "REGISTRY_NOT_ARCHITECTURE_ONLY"
});

/**
 * Canonical capability catalog for Phases 33–46.
 * Status semantics (descriptive only):
 * - available: architecture module exists
 * - wired: connected into a runtime observation path (preview worker path)
 * - enabled: production/automation enablement (always false here)
 * - architectureOnly: always true
 * - productionReady: always false (architecture catalog; no live automation)
 *
 * @type {readonly Object[]}
 */
const CANONICAL_CAPABILITY_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: CAPABILITY_IDS.PERSISTENCE_POLICY,
    name: "Safe Runtime Persistence Policy",
    phase: 33,
    description:
      "Architecture-only policy that evaluates whether persistence actions would be allowed for a given runtime mode and lifecycle state.",
    available: true,
    wired: true,
    enabled: false,
    architectureOnly: true,
    productionReady: false,
    dependencies: Object.freeze([])
  }),
  Object.freeze({
    id: CAPABILITY_IDS.RUNTIME_PERSISTENCE_SERVICE,
    name: "Runtime Persistence Service",
    phase: 34,
    description:
      "Architecture-only service facade that would orchestrate persistence decisions without performing database writes.",
    available: true,
    wired: true,
    enabled: false,
    architectureOnly: true,
    productionReady: false,
    dependencies: Object.freeze([CAPABILITY_IDS.PERSISTENCE_POLICY])
  }),
  Object.freeze({
    id: CAPABILITY_IDS.REPOSITORY_CONTRACTS,
    name: "Persistence Repository Contracts",
    phase: 35,
    description:
      "Implementation-independent repository contracts for recruitment, recruitment-event, and review persistence surfaces.",
    available: true,
    wired: false,
    enabled: false,
    architectureOnly: true,
    productionReady: false,
    dependencies: Object.freeze([])
  }),
  Object.freeze({
    id: CAPABILITY_IDS.MYSQL_REPOSITORY_ADAPTERS,
    name: "MySQL Persistence Repository Adapters",
    phase: 36,
    description:
      "Architecture-only MySQL adapters that satisfy repository contracts via dependency injection; not wired into workers.",
    available: true,
    wired: false,
    enabled: false,
    architectureOnly: true,
    productionReady: false,
    dependencies: Object.freeze([CAPABILITY_IDS.REPOSITORY_CONTRACTS])
  }),
  Object.freeze({
    id: CAPABILITY_IDS.EXECUTION_PIPELINE,
    name: "Persistence Execution Pipeline",
    phase: 37,
    description:
      "Architecture-only planner that builds ordered persistence execution plans without executing steps.",
    available: true,
    wired: true,
    enabled: false,
    architectureOnly: true,
    productionReady: false,
    dependencies: Object.freeze([
      CAPABILITY_IDS.PERSISTENCE_POLICY,
      CAPABILITY_IDS.REPOSITORY_CONTRACTS
    ])
  }),
  Object.freeze({
    id: CAPABILITY_IDS.TRANSACTION_COORDINATOR,
    name: "Transaction Coordinator / Unit of Work",
    phase: 38,
    description:
      "Architecture-only unit-of-work planner that describes begin/commit/rollback boundaries without starting transactions.",
    available: true,
    wired: true,
    enabled: false,
    architectureOnly: true,
    productionReady: false,
    dependencies: Object.freeze([CAPABILITY_IDS.EXECUTION_PIPELINE])
  }),
  Object.freeze({
    id: CAPABILITY_IDS.AUDIT_TRAIL,
    name: "Audit Trail & Execution History",
    phase: 39,
    description:
      "Architecture-only audit event model for recording advisory execution history without persistence side effects.",
    available: true,
    wired: true,
    enabled: false,
    architectureOnly: true,
    productionReady: false,
    dependencies: Object.freeze([])
  }),
  Object.freeze({
    id: CAPABILITY_IDS.EXECUTION_CONTEXT,
    name: "Execution Context & Correlation Layer",
    phase: 40,
    description:
      "Architecture-only execution context carrying correlation identifiers and mode metadata across pipeline stages.",
    available: true,
    wired: true,
    enabled: false,
    architectureOnly: true,
    productionReady: false,
    dependencies: Object.freeze([])
  }),
  Object.freeze({
    id: CAPABILITY_IDS.PREVIEW_RUNTIME_WIRING,
    name: "Preview-First Runtime Wiring",
    phase: 41,
    description:
      "Observation-only wiring that connects policy, service, pipeline, transaction, audit, and context into the preview path.",
    available: true,
    wired: true,
    enabled: false,
    architectureOnly: true,
    productionReady: false,
    dependencies: Object.freeze([
      CAPABILITY_IDS.EXECUTION_CONTEXT,
      CAPABILITY_IDS.PERSISTENCE_POLICY,
      CAPABILITY_IDS.RUNTIME_PERSISTENCE_SERVICE,
      CAPABILITY_IDS.EXECUTION_PIPELINE,
      CAPABILITY_IDS.TRANSACTION_COORDINATOR,
      CAPABILITY_IDS.AUDIT_TRAIL
    ])
  }),
  Object.freeze({
    id: CAPABILITY_IDS.DRY_RUN_SIMULATOR,
    name: "Dry-Run Persistence Simulator",
    phase: 42,
    description:
      "Architecture-only simulator that describes what a live executor would do for a plan without performing I/O.",
    available: true,
    wired: false,
    enabled: false,
    architectureOnly: true,
    productionReady: false,
    dependencies: Object.freeze([
      CAPABILITY_IDS.PERSISTENCE_POLICY,
      CAPABILITY_IDS.EXECUTION_PIPELINE
    ])
  }),
  Object.freeze({
    id: CAPABILITY_IDS.REVIEW_WORKFLOW,
    name: "Review Workflow Architecture",
    phase: 43,
    description:
      "Architecture-only review workflow state machine for safe-mode review transitions without queue enqueue.",
    available: true,
    wired: false,
    enabled: false,
    architectureOnly: true,
    productionReady: false,
    dependencies: Object.freeze([])
  }),
  Object.freeze({
    id: CAPABILITY_IDS.PERSISTENCE_ENABLEMENT,
    name: "Feature Flagged Persistence Enablement",
    phase: 44,
    description:
      "Architecture-only enablement evaluator for future persistence and review-queue flags; never enables either.",
    available: true,
    wired: false,
    enabled: false,
    architectureOnly: true,
    productionReady: false,
    dependencies: Object.freeze([])
  }),
  Object.freeze({
    id: CAPABILITY_IDS.CONTROLLED_EXECUTION_ADAPTER,
    name: "Controlled Runtime Execution Adapter",
    phase: 45,
    description:
      "Architecture-only adapter that bridges enablement and plans into controlled outcomes without real execution.",
    available: true,
    wired: false,
    enabled: false,
    architectureOnly: true,
    productionReady: false,
    dependencies: Object.freeze([
      CAPABILITY_IDS.EXECUTION_CONTEXT,
      CAPABILITY_IDS.PERSISTENCE_POLICY,
      CAPABILITY_IDS.PERSISTENCE_ENABLEMENT,
      CAPABILITY_IDS.EXECUTION_PIPELINE,
      CAPABILITY_IDS.TRANSACTION_COORDINATOR
    ])
  }),
  Object.freeze({
    id: CAPABILITY_IDS.EXECUTION_DIAGNOSTICS,
    name: "Execution Diagnostics & Observability",
    phase: 46,
    description:
      "Architecture-only diagnostic trace framework for advisory observability of execution stages.",
    available: true,
    wired: false,
    enabled: false,
    architectureOnly: true,
    productionReady: false,
    dependencies: Object.freeze([])
  })
]);

/**
 * @typedef {Object} RuntimeCapability
 * @property {string} id
 * @property {string} name
 * @property {number} phase
 * @property {string} description
 * @property {boolean} available
 * @property {boolean} wired
 * @property {boolean} enabled
 * @property {boolean} architectureOnly
 * @property {boolean} productionReady
 * @property {string[]} dependencies
 */

/**
 * @typedef {Object} CapabilityRegistry
 * @property {number} phase
 * @property {RuntimeCapability[]} capabilities
 * @property {boolean} architectureOnly
 * @property {boolean} advisory
 * @property {Object} metadata
 */

/**
 * @typedef {Object} CapabilityRegistryValidationResult
 * @property {boolean} valid
 * @property {string[]} errors
 * @property {string[]} reasons
 */

/**
 * @typedef {Object} CapabilityRegistrySummary
 * @property {number} phase
 * @property {number} totalCapabilities
 * @property {number} availableCount
 * @property {number} wiredCount
 * @property {number} enabledCount
 * @property {number} architectureOnlyCount
 * @property {number} productionReadyCount
 * @property {string[]} capabilityIds
 * @property {number[]} phases
 * @property {boolean} architectureOnly
 * @property {boolean} advisory
 * @property {boolean} executed
 * @property {boolean} sideEffects
 * @property {boolean} persistenceEnabled
 * @property {string} reason
 * @property {string[]} reasons
 */

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function sortReasons(reasons) {
  return [...new Set(reasons)].sort((a, b) => a.localeCompare(b));
}

function normalizeCapabilityId(value) {
  if (value == null || value === "") {
    return null;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === "" ? null : normalized;
}

function cloneStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

function buildRegistryMetadata(extra) {
  return {
    phase: CAPABILITY_REGISTRY_PHASE,
    sideEffects: false,
    architectureOnly: true,
    advisory: true,
    executed: false,
    persistenceEnabled: false,
    automationEnabled: false,
    queueEnqueueEnabled: false,
    repositoriesInvoked: false,
    transactionBegun: false,
    transactionCommitted: false,
    transactionRolledBack: false,
    consoleLogging: false,
    fileWrites: false,
    databaseWrites: false,
    ...(isPlainObject(extra) ? { ...extra } : {}),
    phase: CAPABILITY_REGISTRY_PHASE,
    sideEffects: false,
    architectureOnly: true,
    advisory: true,
    executed: false,
    persistenceEnabled: false,
    automationEnabled: false,
    queueEnqueueEnabled: false,
    repositoriesInvoked: false,
    transactionBegun: false,
    transactionCommitted: false,
    transactionRolledBack: false,
    consoleLogging: false,
    fileWrites: false,
    databaseWrites: false
  };
}

/**
 * @param {Object} definition
 * @returns {RuntimeCapability}
 */
function cloneCapability(definition) {
  return {
    id: String(definition.id),
    name: String(definition.name),
    phase: Number(definition.phase),
    description: String(definition.description),
    available: definition.available === true,
    wired: definition.wired === true,
    enabled: false,
    architectureOnly: true,
    productionReady: false,
    dependencies: cloneStringArray(definition.dependencies).sort()
  };
}

/**
 * @param {Object} definition
 * @returns {RuntimeCapability}
 */
function freezeCapability(definition) {
  const cloned = cloneCapability(definition);
  return Object.freeze({
    ...cloned,
    dependencies: Object.freeze(cloned.dependencies)
  });
}

/**
 * @param {Object[]|null|undefined} definitions
 * @returns {RuntimeCapability[]}
 */
function buildCapabilities(definitions) {
  const source =
    Array.isArray(definitions) && definitions.length > 0
      ? definitions
      : CANONICAL_CAPABILITY_DEFINITIONS;

  return source
    .map((item) => freezeCapability(item))
    .sort((a, b) => {
      if (a.phase !== b.phase) {
        return a.phase - b.phase;
      }
      return a.id.localeCompare(b.id);
    });
}

/**
 * Create a deterministic, architecture-only capability registry.
 * Custom `capabilities` may be supplied for validation testing only;
 * safety flags (enabled / productionReady / architectureOnly) are forced.
 *
 * @param {Object} [options]
 * @param {Object[]} [options.capabilities]
 * @param {Object} [options.metadata]
 * @returns {CapabilityRegistry}
 */
function createCapabilityRegistry(options) {
  const source = isPlainObject(options) ? options : {};
  const capabilities = Object.freeze(buildCapabilities(source.capabilities));

  return Object.freeze({
    phase: CAPABILITY_REGISTRY_PHASE,
    capabilities,
    architectureOnly: true,
    advisory: true,
    metadata: Object.freeze(buildRegistryMetadata(source.metadata))
  });
}

/**
 * Resolve a registry: use provided registry or create the canonical one.
 * @param {CapabilityRegistry|null|undefined} registry
 * @returns {CapabilityRegistry}
 */
function resolveRegistry(registry) {
  if (registry != null && isPlainObject(registry) && Array.isArray(registry.capabilities)) {
    return registry;
  }
  return createCapabilityRegistry();
}

/**
 * @param {CapabilityRegistry|null|undefined} registry
 * @returns {RuntimeCapability[]}
 */
function listCapabilities(registry) {
  const resolved = resolveRegistry(registry);
  return resolved.capabilities.map((capability) => cloneCapability(capability));
}

/**
 * @param {CapabilityRegistry|string|null|undefined} registryOrId
 * @param {string} [capabilityId]
 * @returns {RuntimeCapability|null}
 */
function getCapability(registryOrId, capabilityId) {
  let registry;
  let id;

  if (typeof registryOrId === "string" && capabilityId === undefined) {
    registry = createCapabilityRegistry();
    id = registryOrId;
  } else {
    registry = resolveRegistry(registryOrId);
    id = capabilityId;
  }

  const normalized = normalizeCapabilityId(id);
  if (normalized == null) {
    return null;
  }

  const found = registry.capabilities.find(
    (capability) => normalizeCapabilityId(capability.id) === normalized
  );
  return found ? cloneCapability(found) : null;
}

/**
 * @param {CapabilityRegistry|string|null|undefined} registryOrId
 * @param {string} [capabilityId]
 * @returns {boolean}
 */
function hasCapability(registryOrId, capabilityId) {
  return getCapability(registryOrId, capabilityId) != null;
}

/**
 * @param {CapabilityRegistry|string|null|undefined} registryOrId
 * @param {string} [capabilityId]
 * @returns {boolean}
 */
function isCapabilityAvailable(registryOrId, capabilityId) {
  const capability = getCapability(registryOrId, capabilityId);
  return capability != null && capability.available === true;
}

/**
 * @param {CapabilityRegistry|string|null|undefined} registryOrId
 * @param {string} [capabilityId]
 * @returns {boolean}
 */
function isCapabilityWired(registryOrId, capabilityId) {
  const capability = getCapability(registryOrId, capabilityId);
  return capability != null && capability.wired === true;
}

/**
 * @param {CapabilityRegistry|string|null|undefined} registryOrId
 * @param {string} [capabilityId]
 * @returns {boolean}
 */
function isProductionReady(registryOrId, capabilityId) {
  const capability = getCapability(registryOrId, capabilityId);
  return capability != null && capability.productionReady === true;
}

/**
 * @param {Object|null|undefined} capability
 * @param {Set<string>} knownIds
 * @returns {{ errors: string[], reasons: string[] }}
 */
function validateCapabilityShape(capability, knownIds) {
  const errors = [];
  const reasons = [];

  if (!isPlainObject(capability)) {
    return {
      errors: ["capability must be a plain object"],
      reasons: [CAPABILITY_VALIDATION_REASONS.INVALID_INPUT]
    };
  }

  for (let i = 0; i < REQUIRED_CAPABILITY_FIELDS.length; i += 1) {
    const field = REQUIRED_CAPABILITY_FIELDS[i];
    if (!Object.prototype.hasOwnProperty.call(capability, field)) {
      errors.push(`missing required capability field: ${field}`);
      reasons.push(CAPABILITY_VALIDATION_REASONS.MISSING_REQUIRED_FIELD);
    }
  }

  if (typeof capability.id !== "string" || capability.id.trim() === "") {
    errors.push("capability.id must be a non-empty string");
    reasons.push(CAPABILITY_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (typeof capability.name !== "string" || capability.name.trim() === "") {
    errors.push("capability.name must be a non-empty string");
    reasons.push(CAPABILITY_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (
    typeof capability.phase !== "number" ||
    !Number.isFinite(capability.phase) ||
    capability.phase < 1
  ) {
    errors.push("capability.phase must be a positive number");
    reasons.push(CAPABILITY_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (typeof capability.description !== "string") {
    errors.push("capability.description must be a string");
    reasons.push(CAPABILITY_VALIDATION_REASONS.INVALID_FIELD);
  }

  for (const boolField of [
    "available",
    "wired",
    "enabled",
    "architectureOnly",
    "productionReady"
  ]) {
    if (typeof capability[boolField] !== "boolean") {
      errors.push(`capability.${boolField} must be a boolean`);
      reasons.push(CAPABILITY_VALIDATION_REASONS.INVALID_FIELD);
    }
  }

  if (capability.architectureOnly !== true) {
    errors.push("capability.architectureOnly must be true");
    reasons.push(CAPABILITY_VALIDATION_REASONS.REGISTRY_NOT_ARCHITECTURE_ONLY);
  }

  if (capability.enabled === true) {
    errors.push("capability.enabled must be false in architecture registry");
    reasons.push(CAPABILITY_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (capability.productionReady === true) {
    errors.push(
      "capability.productionReady must be false in architecture registry"
    );
    reasons.push(CAPABILITY_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (!Array.isArray(capability.dependencies)) {
    errors.push("capability.dependencies must be an array");
    reasons.push(CAPABILITY_VALIDATION_REASONS.INVALID_FIELD);
  } else {
    const id = normalizeCapabilityId(capability.id);
    for (let i = 0; i < capability.dependencies.length; i += 1) {
      const dep = capability.dependencies[i];
      if (typeof dep !== "string" || dep.trim() === "") {
        errors.push(`capability.dependencies[${i}] must be a non-empty string`);
        reasons.push(CAPABILITY_VALIDATION_REASONS.INVALID_FIELD);
        continue;
      }
      const depId = normalizeCapabilityId(dep);
      if (depId === id) {
        errors.push(`capability ${id} cannot depend on itself`);
        reasons.push(CAPABILITY_VALIDATION_REASONS.SELF_DEPENDENCY);
      }
      if (knownIds && !knownIds.has(depId)) {
        errors.push(`unknown dependency '${dep}' on capability '${id}'`);
        reasons.push(CAPABILITY_VALIDATION_REASONS.UNKNOWN_DEPENDENCY);
      }
    }
  }

  return { errors, reasons };
}

/**
 * Validate a capability registry for shape, duplicates, and dependency integrity.
 *
 * @param {CapabilityRegistry|null|undefined} registry
 * @returns {CapabilityRegistryValidationResult}
 */
function validateCapabilityRegistry(registry) {
  if (!isPlainObject(registry)) {
    return {
      valid: false,
      errors: ["registry must be a plain object"],
      reasons: sortReasons([CAPABILITY_VALIDATION_REASONS.INVALID_INPUT])
    };
  }

  const errors = [];
  const reasons = [];

  for (let i = 0; i < REQUIRED_REGISTRY_FIELDS.length; i += 1) {
    const field = REQUIRED_REGISTRY_FIELDS[i];
    if (!Object.prototype.hasOwnProperty.call(registry, field)) {
      errors.push(`missing required registry field: ${field}`);
      reasons.push(CAPABILITY_VALIDATION_REASONS.MISSING_REQUIRED_FIELD);
    }
  }

  if (registry.architectureOnly !== true) {
    errors.push("registry.architectureOnly must be true");
    reasons.push(CAPABILITY_VALIDATION_REASONS.REGISTRY_NOT_ARCHITECTURE_ONLY);
  }

  if (registry.advisory !== true) {
    errors.push("registry.advisory must be true");
    reasons.push(CAPABILITY_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (registry.phase !== CAPABILITY_REGISTRY_PHASE) {
    errors.push(`registry.phase must be ${CAPABILITY_REGISTRY_PHASE}`);
    reasons.push(CAPABILITY_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (!isPlainObject(registry.metadata)) {
    errors.push("registry.metadata must be a plain object");
    reasons.push(CAPABILITY_VALIDATION_REASONS.INVALID_FIELD);
  } else {
    if (registry.metadata.architectureOnly !== true) {
      errors.push("registry.metadata.architectureOnly must be true");
      reasons.push(CAPABILITY_VALIDATION_REASONS.REGISTRY_NOT_ARCHITECTURE_ONLY);
    }
    if (registry.metadata.executed !== false) {
      errors.push("registry.metadata.executed must be false");
      reasons.push(CAPABILITY_VALIDATION_REASONS.INVALID_FIELD);
    }
    if (registry.metadata.persistenceEnabled !== false) {
      errors.push("registry.metadata.persistenceEnabled must be false");
      reasons.push(CAPABILITY_VALIDATION_REASONS.INVALID_FIELD);
    }
    if (registry.metadata.sideEffects !== false) {
      errors.push("registry.metadata.sideEffects must be false");
      reasons.push(CAPABILITY_VALIDATION_REASONS.INVALID_FIELD);
    }
  }

  if (!Array.isArray(registry.capabilities)) {
    errors.push("registry.capabilities must be an array");
    reasons.push(CAPABILITY_VALIDATION_REASONS.INVALID_FIELD);
    return {
      valid: false,
      errors,
      reasons: sortReasons(reasons)
    };
  }

  const knownIds = new Set();
  const seenIds = new Set();

  for (let i = 0; i < registry.capabilities.length; i += 1) {
    const capability = registry.capabilities[i];
    if (isPlainObject(capability) && typeof capability.id === "string") {
      knownIds.add(normalizeCapabilityId(capability.id));
    }
  }

  for (let i = 0; i < registry.capabilities.length; i += 1) {
    const capability = registry.capabilities[i];
    const shape = validateCapabilityShape(capability, knownIds);
    for (let e = 0; e < shape.errors.length; e += 1) {
      errors.push(`capabilities[${i}]: ${shape.errors[e]}`);
    }
    for (let r = 0; r < shape.reasons.length; r += 1) {
      reasons.push(shape.reasons[r]);
    }

    if (isPlainObject(capability) && typeof capability.id === "string") {
      const id = normalizeCapabilityId(capability.id);
      if (seenIds.has(id)) {
        errors.push(`duplicate capability id: ${id}`);
        reasons.push(CAPABILITY_VALIDATION_REASONS.DUPLICATE_CAPABILITY_ID);
      } else {
        seenIds.add(id);
      }
    }
  }

  const uniqueReasons = sortReasons(reasons);
  return {
    valid: errors.length === 0,
    errors,
    reasons:
      errors.length === 0
        ? sortReasons([CAPABILITY_VALIDATION_REASONS.VALID])
        : uniqueReasons.filter((r) => r !== CAPABILITY_VALIDATION_REASONS.VALID)
  };
}

/**
 * @param {CapabilityRegistry|null|undefined} registry
 * @returns {CapabilityRegistrySummary}
 */
function summarizeCapabilityRegistry(registry) {
  const resolved = resolveRegistry(registry);
  const capabilities = Array.isArray(resolved.capabilities)
    ? resolved.capabilities
    : [];

  let availableCount = 0;
  let wiredCount = 0;
  let enabledCount = 0;
  let architectureOnlyCount = 0;
  let productionReadyCount = 0;
  const capabilityIds = [];
  const phases = [];

  for (let i = 0; i < capabilities.length; i += 1) {
    const capability = capabilities[i];
    if (!isPlainObject(capability)) {
      continue;
    }
    if (capability.available === true) {
      availableCount += 1;
    }
    if (capability.wired === true) {
      wiredCount += 1;
    }
    if (capability.enabled === true) {
      enabledCount += 1;
    }
    if (capability.architectureOnly === true) {
      architectureOnlyCount += 1;
    }
    if (capability.productionReady === true) {
      productionReadyCount += 1;
    }
    if (typeof capability.id === "string") {
      capabilityIds.push(capability.id);
    }
    if (typeof capability.phase === "number" && Number.isFinite(capability.phase)) {
      phases.push(capability.phase);
    }
  }

  capabilityIds.sort((a, b) => a.localeCompare(b));
  const uniquePhases = [...new Set(phases)].sort((a, b) => a - b);

  return Object.freeze({
    phase: CAPABILITY_REGISTRY_PHASE,
    totalCapabilities: capabilities.length,
    availableCount,
    wiredCount,
    enabledCount,
    architectureOnlyCount,
    productionReadyCount,
    capabilityIds: Object.freeze(capabilityIds),
    phases: Object.freeze(uniquePhases),
    architectureOnly: true,
    advisory: true,
    executed: false,
    sideEffects: false,
    persistenceEnabled: false,
    reason: "ARCHITECTURE_ONLY_REGISTRY",
    reasons: Object.freeze(["ARCHITECTURE_ONLY_REGISTRY"])
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isSupportedCapabilityId(value) {
  const normalized = normalizeCapabilityId(value);
  return normalized != null && SUPPORTED_CAPABILITY_IDS.has(normalized);
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isCapabilityRegistryArchitectureOnly(value) {
  if (!isPlainObject(value)) {
    return false;
  }
  if (value.architectureOnly !== true) {
    return false;
  }
  if (value.advisory !== true) {
    return false;
  }
  if (value.phase !== CAPABILITY_REGISTRY_PHASE) {
    return false;
  }
  if (!isPlainObject(value.metadata)) {
    return false;
  }
  if (value.metadata.phase !== CAPABILITY_REGISTRY_PHASE) {
    return false;
  }
  if (value.metadata.sideEffects !== false) {
    return false;
  }
  if (value.metadata.persistenceEnabled !== false) {
    return false;
  }
  if (value.metadata.executed !== false) {
    return false;
  }
  if (value.metadata.consoleLogging !== false) {
    return false;
  }
  if (value.metadata.fileWrites !== false) {
    return false;
  }
  if (value.metadata.databaseWrites !== false) {
    return false;
  }
  if (!Array.isArray(value.capabilities)) {
    return false;
  }
  for (let i = 0; i < value.capabilities.length; i += 1) {
    const capability = value.capabilities[i];
    if (!isPlainObject(capability)) {
      return false;
    }
    if (capability.architectureOnly !== true) {
      return false;
    }
    if (capability.enabled !== false) {
      return false;
    }
    if (capability.productionReady !== false) {
      return false;
    }
  }
  return true;
}

module.exports = {
  CAPABILITY_REGISTRY_PHASE,
  CAPABILITY_IDS,
  SUPPORTED_CAPABILITY_IDS,
  REQUIRED_CAPABILITY_FIELDS,
  REQUIRED_REGISTRY_FIELDS,
  CAPABILITY_VALIDATION_REASONS,
  CANONICAL_CAPABILITY_DEFINITIONS,
  createCapabilityRegistry,
  listCapabilities,
  getCapability,
  hasCapability,
  isCapabilityAvailable,
  isCapabilityWired,
  isProductionReady,
  validateCapabilityRegistry,
  summarizeCapabilityRegistry,
  isSupportedCapabilityId,
  isCapabilityRegistryArchitectureOnly
};
