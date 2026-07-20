"use strict";

/**
 * Phase 145 — Recruitment Runtime Boundary Contract (Advisory Only).
 *
 * Pure documentation of protected runtime boundaries for future implementation.
 * Defines protected components, allowed extension points, prohibited integrations,
 * and isolation guarantees. No database access, no persistence, no runtime imports,
 * no side effects. No automation. Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_RUNTIME_BOUNDARY_CONTRACT_PHASE = 145;

const RECRUITMENT_RUNTIME_BOUNDARY_CONTRACT_ENTITY =
  "recruitment_runtime_boundary_contract";

const BOUNDARY_CONTRACT_SCHEMA_VERSION = "1.0.0";

const BOUNDARY_CONTRACT_POSTURE = Object.freeze({
  BOUNDARIES_DOCUMENTED: "BOUNDARIES_DOCUMENTED",
  PARTIAL_BOUNDARIES: "PARTIAL_BOUNDARIES",
  UNKNOWN: "UNKNOWN"
});

const ISOLATION_STATUS = Object.freeze({
  ISOLATED: "ISOLATED",
  AT_RISK: "AT_RISK",
  VIOLATED: "VIOLATED",
  UNKNOWN: "UNKNOWN"
});

const PROTECTED_COMPONENT_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "PROTECTED_ORCHESTRATOR",
    order: 1,
    component: "recruitmentWorkflowOrchestrator",
    path: "server/lib/recruitment/recruitmentWorkflowOrchestrator.js",
    protected: true,
    advisoryImportsAllowed: false,
    modificationAllowed: false,
    reason: "Orchestrator runtime behavior must remain unchanged by advisory contract layers."
  }),
  Object.freeze({
    id: "PROTECTED_COORDINATOR",
    order: 2,
    component: "recruitmentWorkflowIntegrationCoordinator",
    path: "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js",
    protected: true,
    advisoryImportsAllowed: false,
    modificationAllowed: false,
    reason: "Coordinator integration paths must remain isolated from advisory modules."
  }),
  Object.freeze({
    id: "PROTECTED_WORKER",
    order: 3,
    component: "siteWorker",
    path: "server/services/workers/siteWorker.js",
    protected: true,
    advisoryImportsAllowed: false,
    modificationAllowed: false,
    reason: "Worker execution paths must not import or execute advisory contract modules."
  }),
  Object.freeze({
    id: "PROTECTED_GATEWAY",
    order: 4,
    component: "recruitmentWorkflowAdvisoryGateway",
    path: "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js",
    protected: true,
    advisoryImportsAllowed: false,
    modificationAllowed: false,
    reason: "Gateway wiring must remain unchanged by implementation contract definitions."
  }),
  Object.freeze({
    id: "PROTECTED_PIPELINE",
    order: 5,
    component: "runRecruitmentPipeline",
    path: "server/lib/recruitment/runRecruitmentPipeline.js",
    protected: true,
    advisoryImportsAllowed: false,
    modificationAllowed: false,
    reason: "Pipeline execution must remain independent of contract-layer planning artifacts."
  })
]);

const ALLOWED_EXTENSION_POINT_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "EXT_RUNTIME_ADAPTER_INTERFACE",
    order: 1,
    label: "Runtime adapter interface scaffold",
    description: "Future adapter implementations may follow Phase 138 interface definitions.",
    requiresFuturePhase: true,
    activatesRuntime: false
  }),
  Object.freeze({
    id: "EXT_FEATURE_FLAG_DEFINITIONS",
    order: 2,
    label: "Feature flag definition documents",
    description: "Flag definitions may be planned without enabling flag execution.",
    requiresFuturePhase: true,
    activatesRuntime: false
  }),
  Object.freeze({
    id: "EXT_SHADOW_OBSERVATION_PLAN",
    order: 3,
    label: "Shadow observation planning",
    description: "Read-only shadow observation plans may be documented without coupling.",
    requiresFuturePhase: true,
    activatesRuntime: false
  }),
  Object.freeze({
    id: "EXT_GOVERNANCE_CHECKLIST_GATES",
    order: 4,
    label: "Governance checklist gate definitions",
    description: "Governance review gates may be documented as advisory checkpoints.",
    requiresFuturePhase: true,
    activatesRuntime: false
  }),
  Object.freeze({
    id: "EXT_IMPLEMENTATION_CONTRACT_VALIDATORS",
    order: 5,
    label: "Implementation contract validators",
    description: "Pure validators may evaluate future plans against readiness contracts.",
    requiresFuturePhase: false,
    activatesRuntime: false
  })
]);

const PROHIBITED_INTEGRATION_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "PROHIBIT_ORCHESTRATOR_IMPORT",
    order: 1,
    integration: "Import advisory contract modules into orchestrator",
    prohibited: true,
    severity: "CRITICAL"
  }),
  Object.freeze({
    id: "PROHIBIT_COORDINATOR_IMPORT",
    order: 2,
    integration: "Import advisory contract modules into coordinator",
    prohibited: true,
    severity: "CRITICAL"
  }),
  Object.freeze({
    id: "PROHIBIT_WORKER_IMPORT",
    order: 3,
    integration: "Import advisory contract modules into site worker",
    prohibited: true,
    severity: "CRITICAL"
  }),
  Object.freeze({
    id: "PROHIBIT_GATEWAY_IMPORT",
    order: 4,
    integration: "Import advisory contract modules into advisory gateway",
    prohibited: true,
    severity: "CRITICAL"
  }),
  Object.freeze({
    id: "PROHIBIT_PIPELINE_IMPORT",
    order: 5,
    integration: "Import advisory contract modules into recruitment pipeline",
    prohibited: true,
    severity: "CRITICAL"
  }),
  Object.freeze({
    id: "PROHIBIT_FEATURE_FLAG_ACTIVATION",
    order: 6,
    integration: "Activate feature flags from contract layer",
    prohibited: true,
    severity: "CRITICAL"
  }),
  Object.freeze({
    id: "PROHIBIT_ROLLOUT_ACTIVATION",
    order: 7,
    integration: "Activate rollout from contract layer",
    prohibited: true,
    severity: "CRITICAL"
  }),
  Object.freeze({
    id: "PROHIBIT_DB_WRITES",
    order: 8,
    integration: "Perform database writes from contract layer",
    prohibited: true,
    severity: "CRITICAL"
  }),
  Object.freeze({
    id: "PROHIBIT_FILESYSTEM_WRITES",
    order: 9,
    integration: "Perform filesystem writes from contract layer",
    prohibited: true,
    severity: "CRITICAL"
  }),
  Object.freeze({
    id: "PROHIBIT_CONTENT_PUBLISHING",
    order: 10,
    integration: "Publish content from contract layer",
    prohibited: true,
    severity: "CRITICAL"
  })
]);

const ISOLATION_GUARANTEE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "ISO_NO_RUNTIME_REQUIRE",
    order: 1,
    guarantee: "Contract modules contain no runtime module imports.",
    enforced: true
  }),
  Object.freeze({
    id: "ISO_NO_SIDE_EFFECTS",
    order: 2,
    guarantee: "Contract module functions are pure and produce no side effects.",
    enforced: true
  }),
  Object.freeze({
    id: "ISO_DEEP_FREEZE_OUTPUT",
    order: 3,
    guarantee: "Contract outputs are deep-frozen and immutable.",
    enforced: true
  }),
  Object.freeze({
    id: "ISO_NO_PRODUCTION_MUTATION",
    order: 4,
    guarantee: "Contract modules never mutate production runtime state.",
    enforced: true
  }),
  Object.freeze({
    id: "ISO_PROTECTED_COMPONENTS_UNCHANGED",
    order: 5,
    guarantee: "Protected runtime components remain unmodified by this phase.",
    enforced: true
  }),
  Object.freeze({
    id: "ISO_NO_ACTIVATION",
    order: 6,
    guarantee: "Contract layer never activates flags, rollout, or runtime wiring.",
    enforced: true
  })
]);

const RECRUITMENT_RUNTIME_BOUNDARY_CONTRACT_METADATA = Object.freeze({
  phase: RECRUITMENT_RUNTIME_BOUNDARY_CONTRACT_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  boundaryContractOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  persistent: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  performsStateTransitions: false,
  flagExecutionEnabled: false,
  rolloutActivationEnabled: false,
  runtimeWiringEnabled: false,
  executed: false,
  activatesAnything: false,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144
  ])
});

const RECRUITMENT_RUNTIME_BOUNDARY_CONTRACT_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_RUNTIME_BOUNDARY_CONTRACT_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_RUNTIME_BOUNDARY_CONTRACT_PHASE,
  description:
    "Pure runtime boundary contract documenting protected components and isolation guarantees.",
  schemaVersion: BOUNDARY_CONTRACT_SCHEMA_VERSION,
  metadata: RECRUITMENT_RUNTIME_BOUNDARY_CONTRACT_METADATA
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "protectedComponents",
  "allowedExtensionPoints",
  "prohibitedIntegrations",
  "isolationGuarantees",
  "isolationStatus",
  "boundaryContractPosture",
  "confidence",
  "generatedMetadata",
  "advisoryMetadata"
]);

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

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
 * @param {*} recruitmentId
 * @returns {string}
 */
function resolveRecruitmentId(recruitmentId) {
  if (recruitmentId == null || recruitmentId === "") {
    return "UNKNOWN";
  }
  return String(recruitmentId);
}

/**
 * @param {*} input
 * @returns {ReadonlyArray<string>}
 */
function extractReportedViolations(input) {
  if (!isPlainObject(input)) {
    return Object.freeze([]);
  }
  const raw = input.boundaryViolations || input.violations || input.reportedViolations;
  if (!Array.isArray(raw)) {
    return Object.freeze([]);
  }
  const result = [];
  const seen = Object.create(null);
  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    let id = null;
    if (typeof item === "string") {
      id = item;
    } else if (isPlainObject(item) && typeof item.id === "string") {
      id = item.id;
    }
    if (id != null && seen[id] !== true) {
      seen[id] = true;
      result.push(id);
    }
  }
  result.sort();
  return Object.freeze(result);
}

/**
 * @param {*} input
 * @returns {number}
 */
function calculateBoundaryConfidence(input) {
  if (!isPlainObject(input)) {
    return 0;
  }

  let score = 55;
  const violations = extractReportedViolations(input);

  if (violations.length === 0) {
    score += 25;
  } else {
    score -= Math.min(40, violations.length * 10);
  }

  if (
    isPlainObject(input.transitionManifest) ||
    isPlainObject(input.implementationContract) ||
    input.acknowledgeBoundaries === true
  ) {
    score += 15;
  }

  if (score < 0) {
    return 0;
  }
  if (score > 100) {
    return 100;
  }
  return score;
}

/**
 * @param {ReadonlyArray<string>} violations
 * @param {number} confidence
 * @param {*} input
 * @returns {string}
 */
function resolveIsolationStatus(violations, confidence, input) {
  if (!isPlainObject(input)) {
    return ISOLATION_STATUS.UNKNOWN;
  }
  if (violations.length > 0) {
    return ISOLATION_STATUS.VIOLATED;
  }
  if (confidence >= 70) {
    return ISOLATION_STATUS.ISOLATED;
  }
  if (confidence >= 40) {
    return ISOLATION_STATUS.AT_RISK;
  }
  return ISOLATION_STATUS.UNKNOWN;
}

/**
 * @param {string} isolationStatus
 * @param {number} confidence
 * @param {*} input
 * @returns {string}
 */
function resolveBoundaryContractPosture(isolationStatus, confidence, input) {
  if (!isPlainObject(input)) {
    return BOUNDARY_CONTRACT_POSTURE.UNKNOWN;
  }
  if (isolationStatus === ISOLATION_STATUS.ISOLATED && confidence >= 70) {
    return BOUNDARY_CONTRACT_POSTURE.BOUNDARIES_DOCUMENTED;
  }
  if (confidence >= 40) {
    return BOUNDARY_CONTRACT_POSTURE.PARTIAL_BOUNDARIES;
  }
  return BOUNDARY_CONTRACT_POSTURE.UNKNOWN;
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function buildRecruitmentRuntimeBoundaryContract(input) {
  const hasInput = isPlainObject(input);
  const safeInput = hasInput ? input : {};
  const recruitmentId = resolveRecruitmentId(safeInput.recruitmentId);
  const violations = extractReportedViolations(input);
  const confidence = calculateBoundaryConfidence(input);
  const isolationStatus = resolveIsolationStatus(violations, confidence, input);
  const boundaryContractPosture = resolveBoundaryContractPosture(
    isolationStatus,
    confidence,
    input
  );

  return deepFreeze({
    recruitmentId,
    protectedComponents: PROTECTED_COMPONENT_DEFINITIONS,
    allowedExtensionPoints: ALLOWED_EXTENSION_POINT_DEFINITIONS,
    prohibitedIntegrations: PROHIBITED_INTEGRATION_DEFINITIONS,
    isolationGuarantees: ISOLATION_GUARANTEE_DEFINITIONS,
    isolationStatus,
    boundaryContractPosture,
    confidence,
    generatedMetadata: Object.freeze({
      generatedAt: "deterministic",
      generatedBy: "phase_145",
      schemaVersion: BOUNDARY_CONTRACT_SCHEMA_VERSION,
      deterministic: true,
      phase: RECRUITMENT_RUNTIME_BOUNDARY_CONTRACT_PHASE,
      advisoryOnly: true,
      runtimeImpact: "none",
      boundaryContractOnly: true,
      reportedViolationCount: violations.length
    }),
    advisoryMetadata: Object.freeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_145",
      phase: RECRUITMENT_RUNTIME_BOUNDARY_CONTRACT_PHASE,
      boundaryContractOnly: true,
      executed: false,
      runtimeIntegration: false,
      persistenceEnabled: false,
      sideEffects: false,
      mutatesInput: false,
      mutatesProduction: false,
      flagExecutionEnabled: false,
      rolloutActivationEnabled: false,
      runtimeWiringEnabled: false,
      activatesAnything: false
    })
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentRuntimeBoundaryContract(value) {
  if (!isPlainObject(value)) {
    return false;
  }
  for (let i = 0; i < EXPECTED_RESULT_KEYS.length; i += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, EXPECTED_RESULT_KEYS[i])) {
      return false;
    }
  }
  if (value.advisoryMetadata == null || value.advisoryMetadata.advisoryOnly !== true) {
    return false;
  }
  if (value.advisoryMetadata.executed !== false) {
    return false;
  }
  if (!Object.isFrozen(value)) {
    return false;
  }
  return true;
}

module.exports = {
  RECRUITMENT_RUNTIME_BOUNDARY_CONTRACT_PHASE,
  RECRUITMENT_RUNTIME_BOUNDARY_CONTRACT_ENTITY,
  BOUNDARY_CONTRACT_SCHEMA_VERSION,
  BOUNDARY_CONTRACT_POSTURE,
  ISOLATION_STATUS,
  PROTECTED_COMPONENT_DEFINITIONS,
  ALLOWED_EXTENSION_POINT_DEFINITIONS,
  PROHIBITED_INTEGRATION_DEFINITIONS,
  ISOLATION_GUARANTEE_DEFINITIONS,
  RECRUITMENT_RUNTIME_BOUNDARY_CONTRACT_METADATA,
  RECRUITMENT_RUNTIME_BOUNDARY_CONTRACT_DESCRIPTOR,
  EXPECTED_RESULT_KEYS,
  buildRecruitmentRuntimeBoundaryContract,
  isRecruitmentRuntimeBoundaryContract
};
