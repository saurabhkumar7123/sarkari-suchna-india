"use strict";

/**
 * Phase 138 — Recruitment Workflow Runtime Integration Contract (Advisory Only).
 *
 * Pure advisory contract layer that standardizes future runtime integration
 * boundaries for recruitment workflow advisory modules. No database access,
 * no persistence, no runtime imports, no side effects. No automation.
 * Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_PHASE = 138;

const RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_ENTITY =
  "recruitment_workflow_runtime_integration_contract";

const CONTRACT_SCHEMA_VERSION = "1.0.0";

const CONTRACT_POSTURE = Object.freeze({
  READY_FOR_INTEGRATION_REVIEW: "READY_FOR_INTEGRATION_REVIEW",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  BLOCKED_INTEGRATION: "BLOCKED_INTEGRATION",
  UNKNOWN: "UNKNOWN"
});

const INTEGRATION_SURFACE_STATUS = Object.freeze({
  SATISFIED: "SATISFIED",
  PARTIAL: "PARTIAL",
  MISSING: "MISSING",
  BLOCKED: "BLOCKED",
  UNKNOWN: "UNKNOWN"
});

const INTEGRATION_SURFACE_IDS = Object.freeze({
  DRAFT_PIPELINE: "DRAFT_PIPELINE",
  STORAGE_BOUNDARY: "STORAGE_BOUNDARY",
  ORCHESTRATION: "ORCHESTRATION",
  TRACE_REGISTRY: "TRACE_REGISTRY",
  READINESS_REPORTING: "READINESS_REPORTING",
  SNAPSHOT_ANALYSIS: "SNAPSHOT_ANALYSIS",
  HEALTH_RISK: "HEALTH_RISK",
  INTELLIGENCE: "INTELLIGENCE",
  RECOMMENDATION_TIMELINE: "RECOMMENDATION_TIMELINE",
  CONSISTENCY: "CONSISTENCY",
  INTEGRATION_READINESS: "INTEGRATION_READINESS",
  CONTROLLED_INTEGRATION: "CONTROLLED_INTEGRATION",
  GOVERNANCE: "GOVERNANCE",
  SIMULATION: "SIMULATION"
});

const INTEGRATION_SURFACE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: INTEGRATION_SURFACE_IDS.DRAFT_PIPELINE,
    label: "Draft proposal and review pipeline advisory boundary",
    modulePhases: Object.freeze([114, 115, 116, 117]),
    requiredSignals: Object.freeze(["draftProposal", "approvalGate", "reviewPackage"])
  }),
  Object.freeze({
    id: INTEGRATION_SURFACE_IDS.STORAGE_BOUNDARY,
    label: "Storage adapter and repository contract advisory boundary",
    modulePhases: Object.freeze([118, 119]),
    requiredSignals: Object.freeze(["storageBoundary", "repositoryContract"])
  }),
  Object.freeze({
    id: INTEGRATION_SURFACE_IDS.ORCHESTRATION,
    label: "Workflow orchestration advisory boundary",
    modulePhases: Object.freeze([120]),
    requiredSignals: Object.freeze(["workflowOrchestrator"])
  }),
  Object.freeze({
    id: INTEGRATION_SURFACE_IDS.TRACE_REGISTRY,
    label: "Decision trace and capability registry advisory boundary",
    modulePhases: Object.freeze([121, 122]),
    requiredSignals: Object.freeze(["decisionTrace", "capabilityRegistry"])
  }),
  Object.freeze({
    id: INTEGRATION_SURFACE_IDS.READINESS_REPORTING,
    label: "Readiness assessment and advisory reporting boundary",
    modulePhases: Object.freeze([123, 124]),
    requiredSignals: Object.freeze(["readinessAssessment", "advisoryReport"])
  }),
  Object.freeze({
    id: INTEGRATION_SURFACE_IDS.SNAPSHOT_ANALYSIS,
    label: "Snapshot, comparison, and evolution advisory boundary",
    modulePhases: Object.freeze([125, 126, 127]),
    requiredSignals: Object.freeze(["advisorySnapshot", "snapshotComparison"])
  }),
  Object.freeze({
    id: INTEGRATION_SURFACE_IDS.HEALTH_RISK,
    label: "Health indicator and risk assessment advisory boundary",
    modulePhases: Object.freeze([128, 129]),
    requiredSignals: Object.freeze(["health", "risk"])
  }),
  Object.freeze({
    id: INTEGRATION_SURFACE_IDS.INTELLIGENCE,
    label: "Intelligence summary advisory boundary",
    modulePhases: Object.freeze([130]),
    requiredSignals: Object.freeze(["intelligenceSummary"])
  }),
  Object.freeze({
    id: INTEGRATION_SURFACE_IDS.RECOMMENDATION_TIMELINE,
    label: "Recommendation and timeline advisory boundary",
    modulePhases: Object.freeze([131, 132]),
    requiredSignals: Object.freeze(["recommendation", "timeline"])
  }),
  Object.freeze({
    id: INTEGRATION_SURFACE_IDS.CONSISTENCY,
    label: "Consistency validation advisory boundary",
    modulePhases: Object.freeze([133]),
    requiredSignals: Object.freeze(["consistencyValidation"])
  }),
  Object.freeze({
    id: INTEGRATION_SURFACE_IDS.INTEGRATION_READINESS,
    label: "Integration readiness framework advisory boundary",
    modulePhases: Object.freeze([134]),
    requiredSignals: Object.freeze(["integrationReadiness"])
  }),
  Object.freeze({
    id: INTEGRATION_SURFACE_IDS.CONTROLLED_INTEGRATION,
    label: "Controlled integration activation advisory boundary",
    modulePhases: Object.freeze([135]),
    requiredSignals: Object.freeze(["activationPlanning", "safetyChecklist"])
  }),
  Object.freeze({
    id: INTEGRATION_SURFACE_IDS.GOVERNANCE,
    label: "Integration governance advisory boundary",
    modulePhases: Object.freeze([136]),
    requiredSignals: Object.freeze(["governancePolicy", "complianceValidation"])
  }),
  Object.freeze({
    id: INTEGRATION_SURFACE_IDS.SIMULATION,
    label: "Workflow simulation advisory boundary",
    modulePhases: Object.freeze([137]),
    requiredSignals: Object.freeze(["simulation", "dryRun"])
  })
]);

const CAPABILITY_REQUIREMENT_IDS = Object.freeze({
  ADVISORY_ONLY: "ADVISORY_ONLY",
  NO_PERSISTENCE: "NO_PERSISTENCE",
  NO_RUNTIME_WIRING: "NO_RUNTIME_WIRING",
  INPUT_IMMUTABILITY: "INPUT_IMMUTABILITY",
  DETERMINISTIC_OUTPUT: "DETERMINISTIC_OUTPUT",
  DEEP_FREEZE_OUTPUT: "DEEP_FREEZE_OUTPUT"
});

const CAPABILITY_REQUIREMENT_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: CAPABILITY_REQUIREMENT_IDS.ADVISORY_ONLY,
    label: "Runtime integration must remain advisory only"
  }),
  Object.freeze({
    id: CAPABILITY_REQUIREMENT_IDS.NO_PERSISTENCE,
    label: "Runtime integration must not introduce persistence"
  }),
  Object.freeze({
    id: CAPABILITY_REQUIREMENT_IDS.NO_RUNTIME_WIRING,
    label: "Runtime integration must not wire production execution paths"
  }),
  Object.freeze({
    id: CAPABILITY_REQUIREMENT_IDS.INPUT_IMMUTABILITY,
    label: "Runtime integration must not mutate advisory inputs"
  }),
  Object.freeze({
    id: CAPABILITY_REQUIREMENT_IDS.DETERMINISTIC_OUTPUT,
    label: "Runtime integration must produce deterministic advisory outputs"
  }),
  Object.freeze({
    id: CAPABILITY_REQUIREMENT_IDS.DEEP_FREEZE_OUTPUT,
    label: "Runtime integration must deep-freeze advisory outputs"
  })
]);

const RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_138",
  descriptiveOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  integrationPersistence: false,
  automationEnabled: false,
  alertingEnabled: false,
  historyTracking: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  executed: false,
  contractOnly: true,
  integrationContractOnly: true,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136, 137
  ])
});

const RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_PHASE,
  description:
    "Pure advisory runtime integration contract standardizing future recruitment workflow integration boundaries.",
  schemaVersion: CONTRACT_SCHEMA_VERSION,
  metadata: RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_METADATA
});

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
 * @param {*} input
 * @returns {boolean}
 */
function isRecognizedContractInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  const fields = ["integrationContext", "contractVersion", "recruitmentId", "moduleSignals"];

  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    const value = input[field];
    if (value == null) {
      continue;
    }
    if (typeof value === "string" || typeof value === "number") {
      continue;
    }
    if (!isPlainObject(value)) {
      return false;
    }
  }

  return true;
}

/**
 * @param {Readonly<Object>} definition
 * @param {Readonly<Object>} context
 * @returns {string}
 */
function evaluateSurfaceStatus(definition, context) {
  const requiredSignals = definition.requiredSignals;
  let presentCount = 0;
  let blockedCount = 0;

  for (let i = 0; i < requiredSignals.length; i += 1) {
    const signalKey = requiredSignals[i];
    const signalValue = context[signalKey];

    if (!isPlainObject(signalValue)) {
      continue;
    }

    if (signalValue.blocked === true || signalValue.status === "BLOCKED") {
      blockedCount += 1;
      continue;
    }

    if (
      signalValue.ready === true ||
      signalValue.available === true ||
      signalValue.present === true ||
      signalValue.satisfied === true
    ) {
      presentCount += 1;
    }
  }

  if (blockedCount > 0) {
    return INTEGRATION_SURFACE_STATUS.BLOCKED;
  }

  if (presentCount === requiredSignals.length) {
    return INTEGRATION_SURFACE_STATUS.SATISFIED;
  }

  if (presentCount > 0) {
    return INTEGRATION_SURFACE_STATUS.PARTIAL;
  }

  return INTEGRATION_SURFACE_STATUS.MISSING;
}

/**
 * @param {Readonly<Object>} context
 * @returns {Readonly<Array>}
 */
function buildIntegrationSurfaces(context) {
  const surfaces = [];

  for (let i = 0; i < INTEGRATION_SURFACE_DEFINITIONS.length; i += 1) {
    const definition = INTEGRATION_SURFACE_DEFINITIONS[i];
    const status = evaluateSurfaceStatus(definition, context);

    surfaces.push(
      deepFreeze({
        id: definition.id,
        label: definition.label,
        status,
        modulePhases: definition.modulePhases,
        requiredSignals: definition.requiredSignals
      })
    );
  }

  return Object.freeze(surfaces);
}

/**
 * @param {Readonly<Array>} surfaces
 * @returns {string}
 */
function resolveContractPosture(surfaces) {
  let satisfiedCount = 0;
  let blockedCount = 0;
  let partialCount = 0;
  let missingCount = 0;

  for (let i = 0; i < surfaces.length; i += 1) {
    const status = surfaces[i].status;

    if (status === INTEGRATION_SURFACE_STATUS.SATISFIED) {
      satisfiedCount += 1;
    } else if (status === INTEGRATION_SURFACE_STATUS.BLOCKED) {
      blockedCount += 1;
    } else if (status === INTEGRATION_SURFACE_STATUS.PARTIAL) {
      partialCount += 1;
    } else if (status === INTEGRATION_SURFACE_STATUS.MISSING) {
      missingCount += 1;
    }
  }

  if (blockedCount > 0) {
    return CONTRACT_POSTURE.BLOCKED_INTEGRATION;
  }

  if (satisfiedCount === surfaces.length) {
    return CONTRACT_POSTURE.READY_FOR_INTEGRATION_REVIEW;
  }

  if (satisfiedCount > 0 || partialCount > 0) {
    return CONTRACT_POSTURE.REVIEW_REQUIRED;
  }

  if (missingCount === surfaces.length) {
    return CONTRACT_POSTURE.UNKNOWN;
  }

  return CONTRACT_POSTURE.REVIEW_REQUIRED;
}

/**
 * @param {Readonly<Object>} context
 * @returns {Readonly<Array>}
 */
function buildCapabilityRequirements(context) {
  const requirements = [];

  for (let i = 0; i < CAPABILITY_REQUIREMENT_DEFINITIONS.length; i += 1) {
    const definition = CAPABILITY_REQUIREMENT_DEFINITIONS[i];
    let enforced = true;

    if (definition.id === CAPABILITY_REQUIREMENT_IDS.ADVISORY_ONLY) {
      enforced = context.advisoryOnly !== false;
    }

    requirements.push(
      deepFreeze({
        id: definition.id,
        label: definition.label,
        enforced
      })
    );
  }

  return Object.freeze(requirements);
}

/**
 * @param {*} recruitmentId
 * @returns {string|null}
 */
function resolveRecruitmentId(recruitmentId) {
  if (recruitmentId == null) {
    return null;
  }
  return String(recruitmentId);
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildContractResult(params) {
  return deepFreeze({
    contractId: params.contractId,
    recruitmentId: params.recruitmentId,
    contractVersion: params.contractVersion,
    contractPosture: params.contractPosture,
    integrationSurfaces: params.integrationSurfaces,
    capabilityRequirements: params.capabilityRequirements,
    satisfiedSurfaceCount: params.satisfiedSurfaceCount,
    partialSurfaceCount: params.partialSurfaceCount,
    missingSurfaceCount: params.missingSurfaceCount,
    blockedSurfaceCount: params.blockedSurfaceCount,
    contractSummary: params.contractSummary,
    recognized: params.recognized,
    descriptor: RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_DESCRIPTOR,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_138",
      phase: RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      contractOnly: true,
      integrationContractOnly: true
    })
  });
}

/**
 * @param {Readonly<Array>} surfaces
 * @param {string} contractPosture
 * @returns {string}
 */
function buildContractSummaryText(surfaces, contractPosture) {
  if (contractPosture === CONTRACT_POSTURE.UNKNOWN) {
    return "Recruitment workflow runtime integration contract could not be determined";
  }

  if (contractPosture === CONTRACT_POSTURE.READY_FOR_INTEGRATION_REVIEW) {
    return `Recruitment workflow runtime integration contract ready for advisory review across ${surfaces.length} integration surfaces`;
  }

  if (contractPosture === CONTRACT_POSTURE.BLOCKED_INTEGRATION) {
    return "Recruitment workflow runtime integration contract blocked by advisory surface signals";
  }

  return "Recruitment workflow runtime integration contract requires advisory review before runtime coupling";
}

/**
 * Create recruitment workflow runtime integration contract from supplied context.
 * Pure: no I/O, no mutation of inputs, no persistence, no runtime coupling.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentWorkflowRuntimeIntegrationContract(input) {
  if (!isRecognizedContractInput(input)) {
    const emptySurfaces = buildIntegrationSurfaces({});

    return buildContractResult({
      contractId: null,
      recruitmentId: null,
      contractVersion: CONTRACT_SCHEMA_VERSION,
      contractPosture: CONTRACT_POSTURE.UNKNOWN,
      integrationSurfaces: emptySurfaces,
      capabilityRequirements: buildCapabilityRequirements({}),
      satisfiedSurfaceCount: 0,
      partialSurfaceCount: 0,
      missingSurfaceCount: emptySurfaces.length,
      blockedSurfaceCount: 0,
      contractSummary: buildContractSummaryText(emptySurfaces, CONTRACT_POSTURE.UNKNOWN),
      recognized: false
    });
  }

  const context = isPlainObject(input.integrationContext) ? input.integrationContext : input;
  const contractVersion =
    typeof input.contractVersion === "string" ? input.contractVersion : CONTRACT_SCHEMA_VERSION;
  const recruitmentId = resolveRecruitmentId(input.recruitmentId);
  const integrationSurfaces = buildIntegrationSurfaces(context);
  const contractPosture = resolveContractPosture(integrationSurfaces);
  const capabilityRequirements = buildCapabilityRequirements(context);

  let satisfiedSurfaceCount = 0;
  let partialSurfaceCount = 0;
  let missingSurfaceCount = 0;
  let blockedSurfaceCount = 0;

  for (let i = 0; i < integrationSurfaces.length; i += 1) {
    const status = integrationSurfaces[i].status;

    if (status === INTEGRATION_SURFACE_STATUS.SATISFIED) {
      satisfiedSurfaceCount += 1;
    } else if (status === INTEGRATION_SURFACE_STATUS.PARTIAL) {
      partialSurfaceCount += 1;
    } else if (status === INTEGRATION_SURFACE_STATUS.MISSING) {
      missingSurfaceCount += 1;
    } else if (status === INTEGRATION_SURFACE_STATUS.BLOCKED) {
      blockedSurfaceCount += 1;
    }
  }

  const contractId =
    recruitmentId != null
      ? `rwric-${recruitmentId}-${contractVersion}`
      : `rwric-unknown-${contractVersion}`;

  return buildContractResult({
    contractId,
    recruitmentId,
    contractVersion,
    contractPosture,
    integrationSurfaces,
    capabilityRequirements,
    satisfiedSurfaceCount,
    partialSurfaceCount,
    missingSurfaceCount,
    blockedSurfaceCount,
    contractSummary: buildContractSummaryText(integrationSurfaces, contractPosture),
    recognized: true
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentWorkflowRuntimeIntegrationContract(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    typeof value.contractVersion !== "string" ||
    typeof value.contractPosture !== "string" ||
    !Array.isArray(value.integrationSurfaces) ||
    !Array.isArray(value.capabilityRequirements) ||
    value.advisoryMetadata?.phase !== RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_PHASE
  ) {
    return false;
  }

  return (
    value.advisory === undefined &&
    value.executed === undefined &&
    value.advisoryMetadata.executed === false &&
    value.advisoryMetadata.advisoryOnly === true
  );
}

module.exports = {
  RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_PHASE,
  RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_ENTITY,
  CONTRACT_SCHEMA_VERSION,
  CONTRACT_POSTURE,
  INTEGRATION_SURFACE_STATUS,
  INTEGRATION_SURFACE_IDS,
  INTEGRATION_SURFACE_DEFINITIONS,
  CAPABILITY_REQUIREMENT_IDS,
  CAPABILITY_REQUIREMENT_DEFINITIONS,
  RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_METADATA,
  RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_DESCRIPTOR,
  createRecruitmentWorkflowRuntimeIntegrationContract,
  isRecruitmentWorkflowRuntimeIntegrationContract
};
