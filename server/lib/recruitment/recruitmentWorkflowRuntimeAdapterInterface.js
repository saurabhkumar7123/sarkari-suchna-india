"use strict";

/**
 * Phase 138 — Recruitment Workflow Runtime Adapter Interface (Advisory Only).
 *
 * Pure interface definition for future recruitment workflow runtime adapters.
 * Defines required methods and capability contracts without any implementation.
 * No database access, no persistence, no runtime imports, no side effects.
 * No automation. Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_RUNTIME_ADAPTER_INTERFACE_PHASE = 138;

const RECRUITMENT_WORKFLOW_RUNTIME_ADAPTER_INTERFACE_ENTITY =
  "recruitment_workflow_runtime_adapter_interface";

const ADAPTER_INTERFACE_VERSION = "1.0.0";

const ADAPTER_METHOD_IDS = Object.freeze({
  INITIALIZE: "INITIALIZE",
  CONNECT: "CONNECT",
  DISCONNECT: "DISCONNECT",
  OBSERVE_WORKFLOW: "OBSERVE_WORKFLOW",
  SUBMIT_ADVISORY: "SUBMIT_ADVISORY",
  VALIDATE_COMPATIBILITY: "VALIDATE_COMPATIBILITY",
  HEALTH_CHECK: "HEALTH_CHECK",
  SHUTDOWN: "SHUTDOWN"
});

const ADAPTER_METHOD_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: ADAPTER_METHOD_IDS.INITIALIZE,
    label: "Initialize advisory runtime adapter context",
    required: true,
    returnsAdvisoryOnly: true,
    mutatesProduction: false
  }),
  Object.freeze({
    id: ADAPTER_METHOD_IDS.CONNECT,
    label: "Establish advisory connection to integration contract surfaces",
    required: true,
    returnsAdvisoryOnly: true,
    mutatesProduction: false
  }),
  Object.freeze({
    id: ADAPTER_METHOD_IDS.DISCONNECT,
    label: "Release advisory connection without production side effects",
    required: true,
    returnsAdvisoryOnly: true,
    mutatesProduction: false
  }),
  Object.freeze({
    id: ADAPTER_METHOD_IDS.OBSERVE_WORKFLOW,
    label: "Observe recruitment workflow advisory signals",
    required: true,
    returnsAdvisoryOnly: true,
    mutatesProduction: false
  }),
  Object.freeze({
    id: ADAPTER_METHOD_IDS.SUBMIT_ADVISORY,
    label: "Submit advisory-only workflow recommendations",
    required: true,
    returnsAdvisoryOnly: true,
    mutatesProduction: false
  }),
  Object.freeze({
    id: ADAPTER_METHOD_IDS.VALIDATE_COMPATIBILITY,
    label: "Validate adapter compatibility against integration contract",
    required: true,
    returnsAdvisoryOnly: true,
    mutatesProduction: false
  }),
  Object.freeze({
    id: ADAPTER_METHOD_IDS.HEALTH_CHECK,
    label: "Perform advisory health inspection of adapter boundary",
    required: false,
    returnsAdvisoryOnly: true,
    mutatesProduction: false
  }),
  Object.freeze({
    id: ADAPTER_METHOD_IDS.SHUTDOWN,
    label: "Shutdown advisory adapter without persistence or execution",
    required: true,
    returnsAdvisoryOnly: true,
    mutatesProduction: false
  })
]);

const ADAPTER_CAPABILITY_IDS = Object.freeze({
  ADVISORY_ONLY: "ADVISORY_ONLY",
  INPUT_IMMUTABILITY: "INPUT_IMMUTABILITY",
  DETERMINISTIC_OUTPUT: "DETERMINISTIC_OUTPUT",
  DEEP_FREEZE_OUTPUT: "DEEP_FREEZE_OUTPUT",
  NO_PERSISTENCE: "NO_PERSISTENCE",
  NO_SCHEDULER: "NO_SCHEDULER",
  NO_WORKERS: "NO_WORKERS",
  NO_API: "NO_API",
  NO_PUBLISHING: "NO_PUBLISHING"
});

const ADAPTER_CAPABILITY_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: ADAPTER_CAPABILITY_IDS.ADVISORY_ONLY,
    label: "Adapter must operate in advisory-only mode",
    required: true
  }),
  Object.freeze({
    id: ADAPTER_CAPABILITY_IDS.INPUT_IMMUTABILITY,
    label: "Adapter must not mutate advisory inputs",
    required: true
  }),
  Object.freeze({
    id: ADAPTER_CAPABILITY_IDS.DETERMINISTIC_OUTPUT,
    label: "Adapter must produce deterministic advisory outputs",
    required: true
  }),
  Object.freeze({
    id: ADAPTER_CAPABILITY_IDS.DEEP_FREEZE_OUTPUT,
    label: "Adapter must deep-freeze advisory outputs",
    required: true
  }),
  Object.freeze({
    id: ADAPTER_CAPABILITY_IDS.NO_PERSISTENCE,
    label: "Adapter must not introduce persistence",
    required: true
  }),
  Object.freeze({
    id: ADAPTER_CAPABILITY_IDS.NO_SCHEDULER,
    label: "Adapter must not invoke schedulers",
    required: true
  }),
  Object.freeze({
    id: ADAPTER_CAPABILITY_IDS.NO_WORKERS,
    label: "Adapter must not invoke workers",
    required: true
  }),
  Object.freeze({
    id: ADAPTER_CAPABILITY_IDS.NO_API,
    label: "Adapter must not expose API endpoints",
    required: true
  }),
  Object.freeze({
    id: ADAPTER_CAPABILITY_IDS.NO_PUBLISHING,
    label: "Adapter must not publish content or pages",
    required: true
  })
]);

const RECRUITMENT_WORKFLOW_RUNTIME_ADAPTER_INTERFACE_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_RUNTIME_ADAPTER_INTERFACE_PHASE,
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
  interfaceDefinitionOnly: true,
  implementationProvided: false,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136, 137
  ])
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
 * @returns {Readonly<Object>}
 */
function getRecruitmentWorkflowRuntimeAdapterInterface() {
  return deepFreeze({
    entity: RECRUITMENT_WORKFLOW_RUNTIME_ADAPTER_INTERFACE_ENTITY,
    phase: RECRUITMENT_WORKFLOW_RUNTIME_ADAPTER_INTERFACE_PHASE,
    interfaceVersion: ADAPTER_INTERFACE_VERSION,
    description:
      "Advisory-only runtime adapter interface for future recruitment workflow integration.",
    methods: ADAPTER_METHOD_DEFINITIONS,
    capabilities: ADAPTER_CAPABILITY_DEFINITIONS,
    requiredMethodCount: ADAPTER_METHOD_DEFINITIONS.filter((item) => item.required).length,
    requiredCapabilityCount: ADAPTER_CAPABILITY_DEFINITIONS.filter((item) => item.required).length,
    implementationProvided: false,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_138",
      phase: RECRUITMENT_WORKFLOW_RUNTIME_ADAPTER_INTERFACE_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      interfaceDefinitionOnly: true,
      implementationProvided: false
    })
  });
}

/**
 * Advisory conformance check against the interface definition.
 * Does not invoke or validate actual implementations.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentWorkflowRuntimeAdapterInterface(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    value.entity !== RECRUITMENT_WORKFLOW_RUNTIME_ADAPTER_INTERFACE_ENTITY ||
    value.phase !== RECRUITMENT_WORKFLOW_RUNTIME_ADAPTER_INTERFACE_PHASE ||
    value.interfaceVersion !== ADAPTER_INTERFACE_VERSION ||
    !Array.isArray(value.methods) ||
    !Array.isArray(value.capabilities) ||
    value.implementationProvided !== false
  ) {
    return false;
  }

  const requiredMethodIds = ADAPTER_METHOD_DEFINITIONS.filter((item) => item.required).map(
    (item) => item.id
  );
  const methodIds = value.methods.map((item) => item.id);

  for (let i = 0; i < requiredMethodIds.length; i += 1) {
    if (!methodIds.includes(requiredMethodIds[i])) {
      return false;
    }
  }

  return value.advisoryMetadata?.interfaceDefinitionOnly === true;
}

/**
 * Advisory check whether a capability declaration satisfies interface requirements.
 *
 * @param {Object|null|undefined} declaredCapabilities
 * @returns {Readonly<Object>}
 */
function assessAdapterCapabilityConformance(declaredCapabilities) {
  const capabilities = isPlainObject(declaredCapabilities) ? declaredCapabilities : {};
  const assessments = [];
  let satisfiedCount = 0;
  let missingCount = 0;

  for (let i = 0; i < ADAPTER_CAPABILITY_DEFINITIONS.length; i += 1) {
    const definition = ADAPTER_CAPABILITY_DEFINITIONS[i];
    const declared = capabilities[definition.id];
    const satisfied = declared === true;

    if (satisfied) {
      satisfiedCount += 1;
    } else if (definition.required) {
      missingCount += 1;
    }

    assessments.push(
      deepFreeze({
        id: definition.id,
        label: definition.label,
        required: definition.required,
        declared: declared === true,
        satisfied
      })
    );
  }

  return deepFreeze({
    assessments: Object.freeze(assessments),
    satisfiedCount,
    missingCount,
    requiredCount: ADAPTER_CAPABILITY_DEFINITIONS.filter((item) => item.required).length,
    conformancePosture:
      missingCount === 0
        ? "CONFORMANT"
        : satisfiedCount > 0
          ? "PARTIALLY_CONFORMANT"
          : "NON_CONFORMANT",
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_138",
      phase: RECRUITMENT_WORKFLOW_RUNTIME_ADAPTER_INTERFACE_PHASE,
      executed: false,
      interfaceDefinitionOnly: true,
      implementationProvided: false
    })
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_RUNTIME_ADAPTER_INTERFACE_PHASE,
  RECRUITMENT_WORKFLOW_RUNTIME_ADAPTER_INTERFACE_ENTITY,
  ADAPTER_INTERFACE_VERSION,
  ADAPTER_METHOD_IDS,
  ADAPTER_METHOD_DEFINITIONS,
  ADAPTER_CAPABILITY_IDS,
  ADAPTER_CAPABILITY_DEFINITIONS,
  RECRUITMENT_WORKFLOW_RUNTIME_ADAPTER_INTERFACE_METADATA,
  getRecruitmentWorkflowRuntimeAdapterInterface,
  isRecruitmentWorkflowRuntimeAdapterInterface,
  assessAdapterCapabilityConformance
};
