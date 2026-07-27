"use strict";

/**
 * Phase 137 — Recruitment Workflow Scenario Library (Advisory Only).
 *
 * Pure advisory scenario definitions for recruitment workflow simulation dry-runs.
 * No database access, no persistence, no runtime imports, no side effects.
 * No automation. Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_SCENARIO_LIBRARY_PHASE = 137;

const RECRUITMENT_WORKFLOW_SCENARIO_LIBRARY_ENTITY = "recruitment_workflow_scenario_library";

const SIMULATION_SCENARIO_IDS = Object.freeze({
  HEALTHY_WORKFLOW: "HEALTHY_WORKFLOW",
  BLOCKED_WORKFLOW: "BLOCKED_WORKFLOW",
  APPROVAL_PENDING: "APPROVAL_PENDING",
  STORAGE_READY: "STORAGE_READY",
  REGRESSION: "REGRESSION",
  RECOVERY: "RECOVERY"
});

const WORKFLOW_STATE = Object.freeze({
  DRAFT_CREATED: "DRAFT_CREATED",
  REVIEW_READY: "REVIEW_READY",
  WAITING_FOR_APPROVAL: "WAITING_FOR_APPROVAL",
  APPROVED_FOR_STORAGE: "APPROVED_FOR_STORAGE",
  STORAGE_BOUNDARY_READY: "STORAGE_BOUNDARY_READY",
  BLOCKED: "BLOCKED",
  REGRESSION_DETECTED: "REGRESSION_DETECTED",
  RECOVERY_IN_PROGRESS: "RECOVERY_IN_PROGRESS"
});

const APPROVAL_STATUS = Object.freeze({
  APPROVED: "APPROVED",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  REJECTED: "REJECTED",
  PENDING: "PENDING"
});

const INTEGRATION_STATUS = Object.freeze({
  NOT_READY: "NOT_READY",
  PARTIALLY_READY: "PARTIALLY_READY",
  READY_FOR_CONTROLLED_INTEGRATION: "READY_FOR_CONTROLLED_INTEGRATION",
  UNKNOWN: "UNKNOWN"
});

const HEALTH_STATUS = Object.freeze({
  HEALTHY: "HEALTHY",
  STABLE: "STABLE",
  AT_RISK: "AT_RISK",
  BLOCKED: "BLOCKED",
  RECOVERING: "RECOVERING",
  UNKNOWN: "UNKNOWN"
});

const RISK_LEVEL = Object.freeze({
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
  UNKNOWN: "UNKNOWN"
});

const CONSISTENCY_STATUS = Object.freeze({
  CONSISTENT: "CONSISTENT",
  INCONSISTENT: "INCONSISTENT",
  UNKNOWN: "UNKNOWN"
});

const SCENARIO_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW,
    label: "Healthy end-to-end recruitment workflow",
    description:
      "All advisory prerequisites satisfied from draft proposal through governance readiness.",
    expectedWorkflowState: WORKFLOW_STATE.STORAGE_BOUNDARY_READY,
    expectedOutcome: "SIMULATION_COMPLETE",
    tags: Object.freeze(["healthy", "complete", "advisory"])
  }),
  Object.freeze({
    id: SIMULATION_SCENARIO_IDS.BLOCKED_WORKFLOW,
    label: "Blocked recruitment workflow",
    description: "Workflow blocked due to missing context or rejected approval.",
    expectedWorkflowState: WORKFLOW_STATE.BLOCKED,
    expectedOutcome: "SIMULATION_BLOCKED",
    tags: Object.freeze(["blocked", "incomplete"])
  }),
  Object.freeze({
    id: SIMULATION_SCENARIO_IDS.APPROVAL_PENDING,
    label: "Approval pending workflow",
    description: "Draft and review package ready but approval decision is pending.",
    expectedWorkflowState: WORKFLOW_STATE.WAITING_FOR_APPROVAL,
    expectedOutcome: "SIMULATION_AWAITING_APPROVAL",
    tags: Object.freeze(["approval", "pending"])
  }),
  Object.freeze({
    id: SIMULATION_SCENARIO_IDS.STORAGE_READY,
    label: "Storage boundary ready workflow",
    description: "Approval granted and storage boundary prerequisites are satisfied.",
    expectedWorkflowState: WORKFLOW_STATE.STORAGE_BOUNDARY_READY,
    expectedOutcome: "SIMULATION_STORAGE_READY",
    tags: Object.freeze(["storage", "approved"])
  }),
  Object.freeze({
    id: SIMULATION_SCENARIO_IDS.REGRESSION,
    label: "Regression detected workflow",
    description: "Previously healthy signals degraded with inconsistent advisory outputs.",
    expectedWorkflowState: WORKFLOW_STATE.REGRESSION_DETECTED,
    expectedOutcome: "SIMULATION_REGRESSION",
    tags: Object.freeze(["regression", "degraded"])
  }),
  Object.freeze({
    id: SIMULATION_SCENARIO_IDS.RECOVERY,
    label: "Recovery in progress workflow",
    description: "Workflow recovering from blocked or regression state toward healthy posture.",
    expectedWorkflowState: WORKFLOW_STATE.RECOVERY_IN_PROGRESS,
    expectedOutcome: "SIMULATION_RECOVERY",
    tags: Object.freeze(["recovery", "improving"])
  })
]);

const RECRUITMENT_WORKFLOW_SCENARIO_LIBRARY_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_SCENARIO_LIBRARY_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_137",
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
  simulationOnly: true,
  scenarioLibraryOnly: true,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136
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
 * @param {number} recruitmentId
 * @returns {Readonly<Object>}
 */
function buildAllModuleSignals(recruitmentId) {
  const signals = {};
  for (let phase = 114; phase <= 136; phase += 1) {
    signals[phase] = Object.freeze({
      phase,
      satisfied: true,
      ready: true,
      recruitmentId
    });
  }
  return deepFreeze(signals);
}

/**
 * @param {string} scenarioId
 * @returns {Readonly<Object>|null}
 */
function buildScenarioContextById(scenarioId) {
  const base = {
    recruitmentId: 137001,
    eventType: "notification",
    simulationOnly: true,
    advisoryOnly: true
  };

  switch (scenarioId) {
    case SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW:
      return deepFreeze({
        ...base,
        scenarioId,
        workflowState: WORKFLOW_STATE.STORAGE_BOUNDARY_READY,
        draftProposal: { present: true, valid: true },
        reviewPackage: { present: true, valid: true },
        approval: { status: APPROVAL_STATUS.APPROVED },
        storageBoundary: { ready: true, contractAvailable: true },
        integrationReadiness: {
          integrationStatus: INTEGRATION_STATUS.READY_FOR_CONTROLLED_INTEGRATION
        },
        consistencyValidation: { consistencyStatus: CONSISTENCY_STATUS.CONSISTENT },
        health: { healthStatus: HEALTH_STATUS.HEALTHY },
        risk: { riskLevel: RISK_LEVEL.LOW },
        moduleSignals: buildAllModuleSignals(base.recruitmentId),
        governanceReview: { complete: true, documented: true }
      });

    case SIMULATION_SCENARIO_IDS.BLOCKED_WORKFLOW:
      return deepFreeze({
        ...base,
        recruitmentId: null,
        scenarioId,
        workflowState: WORKFLOW_STATE.BLOCKED,
        draftProposal: { present: false, valid: false },
        reviewPackage: { present: false, valid: false },
        approval: { status: APPROVAL_STATUS.REJECTED },
        storageBoundary: { ready: false, contractAvailable: false },
        integrationReadiness: { integrationStatus: INTEGRATION_STATUS.NOT_READY },
        consistencyValidation: { consistencyStatus: CONSISTENCY_STATUS.INCONSISTENT },
        health: { healthStatus: HEALTH_STATUS.BLOCKED },
        risk: { riskLevel: RISK_LEVEL.CRITICAL },
        blockedReasons: Object.freeze(["MISSING_RECRUITMENT_ID", "APPROVAL_REJECTED"]),
        moduleSignals: Object.freeze({})
      });

    case SIMULATION_SCENARIO_IDS.APPROVAL_PENDING:
      return deepFreeze({
        ...base,
        scenarioId,
        workflowState: WORKFLOW_STATE.WAITING_FOR_APPROVAL,
        draftProposal: { present: true, valid: true },
        reviewPackage: { present: true, valid: true },
        approval: { status: APPROVAL_STATUS.PENDING },
        storageBoundary: { ready: false, contractAvailable: false },
        integrationReadiness: { integrationStatus: INTEGRATION_STATUS.PARTIALLY_READY },
        consistencyValidation: { consistencyStatus: CONSISTENCY_STATUS.CONSISTENT },
        health: { healthStatus: HEALTH_STATUS.STABLE },
        risk: { riskLevel: RISK_LEVEL.MEDIUM },
        moduleSignals: buildAllModuleSignals(base.recruitmentId)
      });

    case SIMULATION_SCENARIO_IDS.STORAGE_READY:
      return deepFreeze({
        ...base,
        scenarioId,
        workflowState: WORKFLOW_STATE.STORAGE_BOUNDARY_READY,
        draftProposal: { present: true, valid: true },
        reviewPackage: { present: true, valid: true },
        approval: { status: APPROVAL_STATUS.APPROVED },
        storageBoundary: { ready: true, contractAvailable: true, repositoryContract: true },
        integrationReadiness: {
          integrationStatus: INTEGRATION_STATUS.READY_FOR_CONTROLLED_INTEGRATION
        },
        consistencyValidation: { consistencyStatus: CONSISTENCY_STATUS.CONSISTENT },
        health: { healthStatus: HEALTH_STATUS.HEALTHY },
        risk: { riskLevel: RISK_LEVEL.LOW },
        moduleSignals: buildAllModuleSignals(base.recruitmentId),
        persistenceBoundary: { ready: true, advisoryOnly: true }
      });

    case SIMULATION_SCENARIO_IDS.REGRESSION:
      return deepFreeze({
        ...base,
        scenarioId,
        workflowState: WORKFLOW_STATE.REGRESSION_DETECTED,
        draftProposal: { present: true, valid: true },
        reviewPackage: { present: true, valid: true },
        approval: { status: APPROVAL_STATUS.APPROVED },
        storageBoundary: { ready: true, contractAvailable: true },
        integrationReadiness: { integrationStatus: INTEGRATION_STATUS.PARTIALLY_READY },
        consistencyValidation: { consistencyStatus: CONSISTENCY_STATUS.INCONSISTENT },
        health: { healthStatus: HEALTH_STATUS.HEALTHY },
        risk: { riskLevel: RISK_LEVEL.CRITICAL },
        regressionSignals: Object.freeze({
          previousHealth: HEALTH_STATUS.HEALTHY,
          currentHealth: HEALTH_STATUS.AT_RISK,
          degraded: true
        }),
        moduleSignals: buildAllModuleSignals(base.recruitmentId)
      });

    case SIMULATION_SCENARIO_IDS.RECOVERY:
      return deepFreeze({
        ...base,
        scenarioId,
        workflowState: WORKFLOW_STATE.RECOVERY_IN_PROGRESS,
        draftProposal: { present: true, valid: true },
        reviewPackage: { present: true, valid: true },
        approval: { status: APPROVAL_STATUS.NEEDS_REVIEW },
        storageBoundary: { ready: false, contractAvailable: true },
        integrationReadiness: { integrationStatus: INTEGRATION_STATUS.PARTIALLY_READY },
        consistencyValidation: { consistencyStatus: CONSISTENCY_STATUS.CONSISTENT },
        health: { healthStatus: HEALTH_STATUS.RECOVERING },
        risk: { riskLevel: RISK_LEVEL.MEDIUM },
        recoverySignals: Object.freeze({
          previousState: WORKFLOW_STATE.BLOCKED,
          recoveryStepsCompleted: 3,
          recoveryStepsTotal: 6
        }),
        moduleSignals: buildAllModuleSignals(base.recruitmentId)
      });

    default:
      return null;
  }
}

/**
 * @param {string} scenarioId
 * @returns {Readonly<Object>|null}
 */
function getRecruitmentWorkflowScenario(scenarioId) {
  if (typeof scenarioId !== "string") {
    return null;
  }

  for (let i = 0; i < SCENARIO_DEFINITIONS.length; i += 1) {
    if (SCENARIO_DEFINITIONS[i].id === scenarioId) {
      return deepFreeze({
        ...SCENARIO_DEFINITIONS[i],
        context: buildScenarioContextById(scenarioId)
      });
    }
  }

  return null;
}

/**
 * @returns {Readonly<Array>}
 */
function listRecruitmentWorkflowScenarios() {
  const scenarios = SCENARIO_DEFINITIONS.map((definition) =>
    Object.freeze({
      id: definition.id,
      label: definition.label,
      description: definition.description,
      expectedWorkflowState: definition.expectedWorkflowState,
      expectedOutcome: definition.expectedOutcome,
      tags: definition.tags
    })
  );

  return deepFreeze(scenarios);
}

/**
 * @param {string} scenarioId
 * @returns {Readonly<Object>}
 */
function buildRecruitmentWorkflowScenarioContext(scenarioId) {
  const context = buildScenarioContextById(scenarioId);

  if (context == null) {
    return deepFreeze({
      scenarioId: null,
      recognized: false,
      workflowState: WORKFLOW_STATE.BLOCKED,
      simulationOnly: true,
      advisoryOnly: true,
      scenarioSummary: "Unrecognized scenario identifier; simulation context unavailable."
    });
  }

  return deepFreeze({
    ...context,
    recognized: true,
    scenarioSummary: `Advisory simulation context prepared for scenario ${scenarioId}.`
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_SCENARIO_LIBRARY_PHASE,
  RECRUITMENT_WORKFLOW_SCENARIO_LIBRARY_ENTITY,
  SIMULATION_SCENARIO_IDS,
  WORKFLOW_STATE,
  APPROVAL_STATUS,
  INTEGRATION_STATUS,
  HEALTH_STATUS,
  RISK_LEVEL,
  CONSISTENCY_STATUS,
  SCENARIO_DEFINITIONS,
  RECRUITMENT_WORKFLOW_SCENARIO_LIBRARY_METADATA,
  getRecruitmentWorkflowScenario,
  listRecruitmentWorkflowScenarios,
  buildRecruitmentWorkflowScenarioContext
};
