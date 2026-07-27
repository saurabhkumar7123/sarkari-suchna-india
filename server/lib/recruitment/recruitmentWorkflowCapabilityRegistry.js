"use strict";

/**
 * Phase 122 — Recruitment Workflow Capability Registry (Advisory Only).
 *
 * Pure descriptive registry cataloging advisory recruitment workflow capabilities
 * introduced in Phases 114–121. Describes capability readiness, boundaries, and
 * production connection status without filesystem scanning, runtime wiring,
 * workflow module imports, persistence, or side effects.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No auto-discovery. No workflow module imports.
 */

const RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_PHASE = 122;

const RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_ENTITY =
  "recruitment_workflow_capability_registry";

const CAPABILITY_IDS = Object.freeze({
  DRAFT_PROPOSAL: "draft_proposal",
  PERSISTENCE_BOUNDARY: "persistence_boundary",
  APPROVAL_GATE: "approval_gate",
  REVIEW_PACKAGE: "review_package",
  STORAGE_ADAPTER: "storage_adapter",
  REPOSITORY_CONTRACT: "repository_contract",
  WORKFLOW_ORCHESTRATOR: "workflow_orchestrator",
  DECISION_TRACE_MODEL: "decision_trace_model"
});

const CAPABILITY_STATUSES = Object.freeze({
  AVAILABLE: "available"
});

const CAPABILITY_MODES = Object.freeze({
  ADVISORY_ONLY: "advisory_only"
});

const CAPABILITY_CATEGORIES = Object.freeze({
  GENERATION: "generation",
  BOUNDARY: "boundary",
  GOVERNANCE: "governance",
  REVIEW: "review",
  STORAGE: "storage",
  CONTRACT: "contract",
  COORDINATION: "coordination",
  TRACE: "trace"
});

const RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  capabilityRegistryOnly: true,
  architectureOnly: true,
  advisoryOnly: true,
  registryType: "descriptive",
  runtimeConnected: false,
  runtimeIntegration: false,
  persistenceEnabled: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  performsStateTransitions: false,
  createsDrafts: false,
  publishesPages: false,
  invokesCoordinator: false,
  pipelineWiring: false,
  connectsToStorage: false,
  autoDiscovery: false,
  sourcePhases: Object.freeze([114, 115, 116, 117, 118, 119, 120, 121])
});

const RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_PHASE,
  description:
    "Pure descriptive registry cataloging advisory recruitment workflow capabilities and their production boundaries.",
  metadata: RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_METADATA
});

/**
 * Canonical capability catalog for Phases 114–121.
 * Deterministic, statically declared, and advisory only.
 *
 * @type {readonly Object[]}
 */
const CANONICAL_CAPABILITY_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: CAPABILITY_IDS.DRAFT_PROPOSAL,
    name: "Draft Proposal Engine",
    phase: 114,
    category: CAPABILITY_CATEGORIES.GENERATION,
    status: CAPABILITY_STATUSES.AVAILABLE,
    mode: CAPABILITY_MODES.ADVISORY_ONLY,
    persistenceEnabled: false,
    productionConnected: false
  }),
  Object.freeze({
    id: CAPABILITY_IDS.PERSISTENCE_BOUNDARY,
    name: "Persistence Boundary",
    phase: 115,
    category: CAPABILITY_CATEGORIES.BOUNDARY,
    status: CAPABILITY_STATUSES.AVAILABLE,
    mode: CAPABILITY_MODES.ADVISORY_ONLY,
    persistenceEnabled: false,
    productionConnected: false
  }),
  Object.freeze({
    id: CAPABILITY_IDS.APPROVAL_GATE,
    name: "Approval Gate",
    phase: 116,
    category: CAPABILITY_CATEGORIES.GOVERNANCE,
    status: CAPABILITY_STATUSES.AVAILABLE,
    mode: CAPABILITY_MODES.ADVISORY_ONLY,
    persistenceEnabled: false,
    productionConnected: false
  }),
  Object.freeze({
    id: CAPABILITY_IDS.REVIEW_PACKAGE,
    name: "Review Package",
    phase: 117,
    category: CAPABILITY_CATEGORIES.REVIEW,
    status: CAPABILITY_STATUSES.AVAILABLE,
    mode: CAPABILITY_MODES.ADVISORY_ONLY,
    persistenceEnabled: false,
    productionConnected: false
  }),
  Object.freeze({
    id: CAPABILITY_IDS.STORAGE_ADAPTER,
    name: "Storage Adapter",
    phase: 118,
    category: CAPABILITY_CATEGORIES.STORAGE,
    status: CAPABILITY_STATUSES.AVAILABLE,
    mode: CAPABILITY_MODES.ADVISORY_ONLY,
    persistenceEnabled: false,
    productionConnected: false
  }),
  Object.freeze({
    id: CAPABILITY_IDS.REPOSITORY_CONTRACT,
    name: "Repository Contract",
    phase: 119,
    category: CAPABILITY_CATEGORIES.CONTRACT,
    status: CAPABILITY_STATUSES.AVAILABLE,
    mode: CAPABILITY_MODES.ADVISORY_ONLY,
    persistenceEnabled: false,
    productionConnected: false
  }),
  Object.freeze({
    id: CAPABILITY_IDS.WORKFLOW_ORCHESTRATOR,
    name: "Recruitment Workflow Orchestrator",
    phase: 120,
    category: CAPABILITY_CATEGORIES.COORDINATION,
    status: CAPABILITY_STATUSES.AVAILABLE,
    mode: CAPABILITY_MODES.ADVISORY_ONLY,
    persistenceEnabled: false,
    productionConnected: false
  }),
  Object.freeze({
    id: CAPABILITY_IDS.DECISION_TRACE_MODEL,
    name: "Decision Trace Model",
    phase: 121,
    category: CAPABILITY_CATEGORIES.TRACE,
    status: CAPABILITY_STATUSES.AVAILABLE,
    mode: CAPABILITY_MODES.ADVISORY_ONLY,
    persistenceEnabled: false,
    productionConnected: false
  })
]);

/**
 * @param {*} value
 * @returns {*}
 */
function deepFreeze(value) {
  if (value == null || typeof value !== "object") {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      deepFreeze(value[i]);
    }
    return value;
  }
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    deepFreeze(value[keys[i]]);
  }
  return value;
}

/**
 * @returns {Readonly<Object>}
 */
function createRecruitmentWorkflowCapabilityRegistry() {
  return deepFreeze({
    capabilities: CANONICAL_CAPABILITY_DEFINITIONS.map((capability) =>
      deepFreeze({
        id: capability.id,
        name: capability.name,
        phase: capability.phase,
        category: capability.category,
        status: capability.status,
        mode: capability.mode,
        persistenceEnabled: capability.persistenceEnabled,
        productionConnected: capability.productionConnected
      })
    ),
    metadata: deepFreeze({
      advisoryOnly: true,
      registryType: "descriptive",
      runtimeConnected: false
    })
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_PHASE,
  RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_ENTITY,
  CAPABILITY_IDS,
  CAPABILITY_STATUSES,
  CAPABILITY_MODES,
  CAPABILITY_CATEGORIES,
  RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_METADATA,
  RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_DESCRIPTOR,
  CANONICAL_CAPABILITY_DEFINITIONS,
  createRecruitmentWorkflowCapabilityRegistry
};
