"use strict";

/**
 * Phase 145 — Recruitment Capability Activation Plan (Advisory Only).
 *
 * Pure descriptive activation sequencing for future capability readiness.
 * Documents recommended activation order, dependencies, prerequisite
 * capabilities, and verification checkpoints. No activation. No execution.
 * No database access, no persistence, no runtime imports, no side effects.
 * Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_CAPABILITY_ACTIVATION_PLAN_PHASE = 145;

const RECRUITMENT_CAPABILITY_ACTIVATION_PLAN_ENTITY =
  "recruitment_capability_activation_plan";

const ACTIVATION_PLAN_SCHEMA_VERSION = "1.0.0";

const ACTIVATION_PLAN_POSTURE = Object.freeze({
  SEQUENCE_DEFINED: "SEQUENCE_DEFINED",
  PARTIAL_SEQUENCE: "PARTIAL_SEQUENCE",
  UNKNOWN: "UNKNOWN"
});

const CHECKPOINT_STATUS = Object.freeze({
  PENDING: "PENDING",
  READY: "READY",
  BLOCKED: "BLOCKED",
  UNKNOWN: "UNKNOWN"
});

const ACTIVATION_ORDER_DEFINITIONS = Object.freeze([
  Object.freeze({
    order: 1,
    capabilityId: "CAP_BOUNDARY_ISOLATION",
    label: "Runtime boundary isolation",
    description: "Confirm protected runtime boundaries before any capability work.",
    dependencies: Object.freeze([]),
    prerequisiteCapabilities: Object.freeze([])
  }),
  Object.freeze({
    order: 2,
    capabilityId: "CAP_RUNTIME_ADAPTER",
    label: "Runtime adapter interface",
    description: "Scaffold advisory runtime adapter without wiring production paths.",
    dependencies: Object.freeze(["CAP_BOUNDARY_ISOLATION"]),
    prerequisiteCapabilities: Object.freeze(["CAP_BOUNDARY_ISOLATION"])
  }),
  Object.freeze({
    order: 3,
    capabilityId: "CAP_FEATURE_FLAGS",
    label: "Feature flag infrastructure",
    description: "Define feature flag infrastructure without enabling execution.",
    dependencies: Object.freeze(["CAP_RUNTIME_ADAPTER"]),
    prerequisiteCapabilities: Object.freeze(["CAP_BOUNDARY_ISOLATION", "CAP_RUNTIME_ADAPTER"])
  }),
  Object.freeze({
    order: 4,
    capabilityId: "CAP_SHADOW_MODE",
    label: "Shadow mode observation",
    description: "Prepare read-only shadow observation sequencing.",
    dependencies: Object.freeze(["CAP_FEATURE_FLAGS"]),
    prerequisiteCapabilities: Object.freeze([
      "CAP_BOUNDARY_ISOLATION",
      "CAP_RUNTIME_ADAPTER",
      "CAP_FEATURE_FLAGS"
    ])
  }),
  Object.freeze({
    order: 5,
    capabilityId: "CAP_GOVERNANCE_GATES",
    label: "Governance review gates",
    description: "Operationalize governance gates prior to controlled coupling.",
    dependencies: Object.freeze(["CAP_SHADOW_MODE"]),
    prerequisiteCapabilities: Object.freeze([
      "CAP_BOUNDARY_ISOLATION",
      "CAP_RUNTIME_ADAPTER",
      "CAP_FEATURE_FLAGS",
      "CAP_SHADOW_MODE"
    ])
  }),
  Object.freeze({
    order: 6,
    capabilityId: "CAP_MONITORING",
    label: "Monitoring infrastructure",
    description: "Define monitoring verification before coupling attempts.",
    dependencies: Object.freeze(["CAP_GOVERNANCE_GATES"]),
    prerequisiteCapabilities: Object.freeze([
      "CAP_BOUNDARY_ISOLATION",
      "CAP_GOVERNANCE_GATES"
    ])
  }),
  Object.freeze({
    order: 7,
    capabilityId: "CAP_ROLLBACK",
    label: "Rollback planning",
    description: "Confirm rollback paths before controlled coupling planning.",
    dependencies: Object.freeze(["CAP_MONITORING"]),
    prerequisiteCapabilities: Object.freeze(["CAP_MONITORING", "CAP_FEATURE_FLAGS"])
  }),
  Object.freeze({
    order: 8,
    capabilityId: "CAP_CONTROLLED_COUPLING",
    label: "Controlled coupling strategy",
    description: "Plan controlled coupling last; never activate in this phase.",
    dependencies: Object.freeze(["CAP_ROLLBACK", "CAP_GOVERNANCE_GATES"]),
    prerequisiteCapabilities: Object.freeze([
      "CAP_BOUNDARY_ISOLATION",
      "CAP_RUNTIME_ADAPTER",
      "CAP_FEATURE_FLAGS",
      "CAP_SHADOW_MODE",
      "CAP_GOVERNANCE_GATES",
      "CAP_MONITORING",
      "CAP_ROLLBACK"
    ])
  })
]);

const VERIFICATION_CHECKPOINT_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "CHK_BOUNDARY_DOCUMENTED",
    order: 1,
    label: "Runtime boundaries documented",
    capabilityId: "CAP_BOUNDARY_ISOLATION",
    description: "Protected components and isolation guarantees are documented."
  }),
  Object.freeze({
    id: "CHK_ADAPTER_INTERFACE_DEFINED",
    order: 2,
    label: "Adapter interface defined",
    capabilityId: "CAP_RUNTIME_ADAPTER",
    description: "Runtime adapter interface methods and capabilities are defined."
  }),
  Object.freeze({
    id: "CHK_FLAGS_DEFINED_NOT_ACTIVE",
    order: 3,
    label: "Flags defined without activation",
    capabilityId: "CAP_FEATURE_FLAGS",
    description: "Feature flags exist as definitions only; execution remains disabled."
  }),
  Object.freeze({
    id: "CHK_SHADOW_READ_ONLY",
    order: 4,
    label: "Shadow mode remains read-only",
    capabilityId: "CAP_SHADOW_MODE",
    description: "Shadow observation plan remains non-mutating and non-publishing."
  }),
  Object.freeze({
    id: "CHK_GOVERNANCE_REVIEW",
    order: 5,
    label: "Governance review completed",
    capabilityId: "CAP_GOVERNANCE_GATES",
    description: "Governance checklist review gates are defined before coupling."
  }),
  Object.freeze({
    id: "CHK_MONITORING_READY",
    order: 6,
    label: "Monitoring checkpoints ready",
    capabilityId: "CAP_MONITORING",
    description: "Monitoring verification checkpoints are documented."
  }),
  Object.freeze({
    id: "CHK_ROLLBACK_VERIFIED",
    order: 7,
    label: "Rollback path verified",
    capabilityId: "CAP_ROLLBACK",
    description: "Rollback requirements and verification checkpoints are documented."
  }),
  Object.freeze({
    id: "CHK_COUPLING_NOT_ACTIVATED",
    order: 8,
    label: "Controlled coupling not activated",
    capabilityId: "CAP_CONTROLLED_COUPLING",
    description: "Controlled coupling remains planning-only with no runtime activation."
  })
]);

const RECRUITMENT_CAPABILITY_ACTIVATION_PLAN_METADATA = Object.freeze({
  phase: RECRUITMENT_CAPABILITY_ACTIVATION_PLAN_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  activationPlanOnly: true,
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
  activationEnabled: false,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144
  ])
});

const RECRUITMENT_CAPABILITY_ACTIVATION_PLAN_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_CAPABILITY_ACTIVATION_PLAN_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_CAPABILITY_ACTIVATION_PLAN_PHASE,
  description:
    "Pure descriptive capability activation sequencing without activation or execution.",
  schemaVersion: ACTIVATION_PLAN_SCHEMA_VERSION,
  metadata: RECRUITMENT_CAPABILITY_ACTIVATION_PLAN_METADATA
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "recommendedActivationOrder",
  "dependencies",
  "prerequisiteCapabilities",
  "verificationCheckpoints",
  "activationPlanPosture",
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
 * @returns {Readonly<Object>}
 */
function deriveReadyCapabilitySet(input) {
  const ready = Object.create(null);
  if (!isPlainObject(input)) {
    return Object.freeze(ready);
  }

  const sources = [input.readyCapabilities, input.completedCapabilities, input.capabilitySignals];
  for (let s = 0; s < sources.length; s += 1) {
    const source = sources[s];
    if (Array.isArray(source)) {
      for (let i = 0; i < source.length; i += 1) {
        const item = source[i];
        if (typeof item === "string") {
          ready[item] = true;
        } else if (isPlainObject(item) && typeof item.id === "string") {
          if (item.ready === true || item.complete === true || item.satisfied === true) {
            ready[item.id] = true;
          }
        }
      }
    } else if (isPlainObject(source)) {
      const keys = Object.keys(source);
      for (let i = 0; i < keys.length; i += 1) {
        const value = source[keys[i]];
        if (
          value === true ||
          (isPlainObject(value) &&
            (value.ready === true || value.complete === true || value.satisfied === true))
        ) {
          ready[keys[i]] = true;
        }
      }
    }
  }

  return Object.freeze(ready);
}

/**
 * @param {ReadonlyArray<string>} prerequisites
 * @param {Readonly<Object>} readySet
 * @returns {boolean}
 */
function prerequisitesMet(prerequisites, readySet) {
  for (let i = 0; i < prerequisites.length; i += 1) {
    if (readySet[prerequisites[i]] !== true) {
      return false;
    }
  }
  return true;
}

/**
 * @param {Readonly<Object>} definition
 * @param {Readonly<Object>} readySet
 * @param {boolean} hasSignals
 * @returns {string}
 */
function resolveCheckpointStatus(definition, readySet, hasSignals) {
  if (!hasSignals) {
    return CHECKPOINT_STATUS.UNKNOWN;
  }
  if (readySet[definition.capabilityId] === true) {
    return CHECKPOINT_STATUS.READY;
  }
  let orderDef = null;
  for (let i = 0; i < ACTIVATION_ORDER_DEFINITIONS.length; i += 1) {
    if (ACTIVATION_ORDER_DEFINITIONS[i].capabilityId === definition.capabilityId) {
      orderDef = ACTIVATION_ORDER_DEFINITIONS[i];
      break;
    }
  }
  if (orderDef != null && !prerequisitesMet(orderDef.prerequisiteCapabilities, readySet)) {
    return CHECKPOINT_STATUS.BLOCKED;
  }
  return CHECKPOINT_STATUS.PENDING;
}

/**
 * @param {*} input
 * @returns {number}
 */
function calculateActivationConfidence(input) {
  if (!isPlainObject(input)) {
    return 0;
  }

  let score = 50;
  const readySet = deriveReadyCapabilitySet(input);
  const readyCount = Object.keys(readySet).length;

  if (readyCount > 0) {
    score += Math.min(40, readyCount * 5);
  } else {
    score += 20;
  }
  if (isPlainObject(input.implementationContract) || isPlainObject(input.transitionManifest)) {
    score += 10;
  }

  if (score > 100) {
    return 100;
  }
  return score;
}

/**
 * @param {number} confidence
 * @param {*} input
 * @returns {string}
 */
function resolveActivationPlanPosture(confidence, input) {
  if (!isPlainObject(input)) {
    return ACTIVATION_PLAN_POSTURE.UNKNOWN;
  }
  if (confidence >= 70) {
    return ACTIVATION_PLAN_POSTURE.SEQUENCE_DEFINED;
  }
  if (confidence >= 40) {
    return ACTIVATION_PLAN_POSTURE.PARTIAL_SEQUENCE;
  }
  return ACTIVATION_PLAN_POSTURE.UNKNOWN;
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function buildRecruitmentCapabilityActivationPlan(input) {
  const hasInput = isPlainObject(input);
  const safeInput = hasInput ? input : {};
  const recruitmentId = resolveRecruitmentId(safeInput.recruitmentId);
  const readySet = deriveReadyCapabilitySet(input);
  const hasSignals =
    hasInput &&
    (safeInput.readyCapabilities != null ||
      safeInput.completedCapabilities != null ||
      safeInput.capabilitySignals != null);
  const confidence = calculateActivationConfidence(input);
  const activationPlanPosture = resolveActivationPlanPosture(confidence, input);

  const recommendedActivationOrder = ACTIVATION_ORDER_DEFINITIONS.map(function mapOrder(def) {
    return Object.freeze({
      order: def.order,
      capabilityId: def.capabilityId,
      label: def.label,
      description: def.description,
      dependencies: def.dependencies,
      prerequisiteCapabilities: def.prerequisiteCapabilities,
      ready: readySet[def.capabilityId] === true,
      activated: false
    });
  });

  const dependencies = ACTIVATION_ORDER_DEFINITIONS.map(function mapDeps(def) {
    return Object.freeze({
      capabilityId: def.capabilityId,
      dependsOn: def.dependencies,
      order: def.order
    });
  });

  const prerequisiteCapabilities = ACTIVATION_ORDER_DEFINITIONS.map(function mapPrereq(def) {
    return Object.freeze({
      capabilityId: def.capabilityId,
      prerequisites: def.prerequisiteCapabilities,
      prerequisitesSatisfied: hasSignals
        ? prerequisitesMet(def.prerequisiteCapabilities, readySet)
        : false
    });
  });

  const verificationCheckpoints = VERIFICATION_CHECKPOINT_DEFINITIONS.map(function mapChk(def) {
    return Object.freeze({
      id: def.id,
      order: def.order,
      label: def.label,
      capabilityId: def.capabilityId,
      description: def.description,
      status: resolveCheckpointStatus(def, readySet, hasSignals),
      activated: false
    });
  });

  return deepFreeze({
    recruitmentId,
    recommendedActivationOrder: Object.freeze(recommendedActivationOrder),
    dependencies: Object.freeze(dependencies),
    prerequisiteCapabilities: Object.freeze(prerequisiteCapabilities),
    verificationCheckpoints: Object.freeze(verificationCheckpoints),
    activationPlanPosture,
    confidence,
    generatedMetadata: Object.freeze({
      generatedAt: "deterministic",
      generatedBy: "phase_145",
      schemaVersion: ACTIVATION_PLAN_SCHEMA_VERSION,
      deterministic: true,
      phase: RECRUITMENT_CAPABILITY_ACTIVATION_PLAN_PHASE,
      advisoryOnly: true,
      runtimeImpact: "none",
      activationPlanOnly: true,
      activationEnabled: false
    }),
    advisoryMetadata: Object.freeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_145",
      phase: RECRUITMENT_CAPABILITY_ACTIVATION_PLAN_PHASE,
      activationPlanOnly: true,
      executed: false,
      activated: false,
      activationEnabled: false,
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
function isRecruitmentCapabilityActivationPlan(value) {
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
  if (value.advisoryMetadata.activatesAnything !== false) {
    return false;
  }
  if (!Object.isFrozen(value)) {
    return false;
  }
  return true;
}

module.exports = {
  RECRUITMENT_CAPABILITY_ACTIVATION_PLAN_PHASE,
  RECRUITMENT_CAPABILITY_ACTIVATION_PLAN_ENTITY,
  ACTIVATION_PLAN_SCHEMA_VERSION,
  ACTIVATION_PLAN_POSTURE,
  CHECKPOINT_STATUS,
  ACTIVATION_ORDER_DEFINITIONS,
  VERIFICATION_CHECKPOINT_DEFINITIONS,
  RECRUITMENT_CAPABILITY_ACTIVATION_PLAN_METADATA,
  RECRUITMENT_CAPABILITY_ACTIVATION_PLAN_DESCRIPTOR,
  EXPECTED_RESULT_KEYS,
  buildRecruitmentCapabilityActivationPlan,
  isRecruitmentCapabilityActivationPlan
};
