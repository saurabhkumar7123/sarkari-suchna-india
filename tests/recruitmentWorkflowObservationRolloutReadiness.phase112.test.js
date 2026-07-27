"use strict";

/**
 * Phase 112 — Recruitment Workflow Observation Rollout Readiness Evaluator tests.
 * Ready observation, missing contract, incomplete observation, malformed outcome,
 * flag OFF/ON, blocker generation, determinism, immutability, no side effects,
 * no coordinator calls, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

jest.mock("../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator", () => {
  const actual = jest.requireActual(
    "../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator"
  );
  return {
    ...actual,
    coordinateRecruitmentWorkflowIntegration: jest.fn(
      actual.coordinateRecruitmentWorkflowIntegration
    )
  };
});

jest.mock("../server/lib/recruitment/recruitmentWorkflowObservationContractIntegrationHook", () => {
  const actual = jest.requireActual(
    "../server/lib/recruitment/recruitmentWorkflowObservationContractIntegrationHook"
  );
  return {
    ...actual,
    attachRecruitmentWorkflowObservationContractIntegration: jest.fn(
      actual.attachRecruitmentWorkflowObservationContractIntegration
    )
  };
});

const {
  RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_PHASE,
  RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_ENTITY,
  ROLLOUT_READINESS_STATUS,
  ROLLOUT_READINESS_BLOCKERS,
  RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_METADATA,
  EMPTY_ROLLOUT_READINESS_SUMMARY,
  evaluateRecruitmentWorkflowObservationRolloutReadiness,
  isRecruitmentWorkflowObservationRolloutReady,
  summarizeRecruitmentWorkflowObservationRolloutReadiness
} = require("../server/lib/recruitment/recruitmentWorkflowObservationRolloutReadiness");

const {
  OBSERVATION_HEALTH_CHECK_STATUS
} = require("../server/lib/recruitment/recruitmentWorkflowObservationHealthCheck");

const {
  getRecruitmentWorkflowObservationContract,
  summarizeRecruitmentWorkflowObservationContract
} = require("../server/lib/recruitment/recruitmentWorkflowObservationConsumer");

const {
  attachRecruitmentWorkflowObservationContractIntegration,
  peekRecruitmentWorkflowObservationContractIntegration
} = require("../server/lib/recruitment/recruitmentWorkflowObservationContractIntegrationHook");

const {
  attachRecruitmentWorkflowObservationContract,
  peekRecruitmentWorkflowObservationContract
} = require("../server/lib/recruitment/recruitmentWorkflowObservationContractAttachment");

const {
  attachRecruitmentWorkflowIntegration,
  peekRecruitmentWorkflowIntegration
} = require("../server/lib/recruitment/recruitmentPipelineIntegrationHook");

const {
  attachRecruitmentWorkflowDiagnostics,
  peekRecruitmentWorkflowDiagnostics
} = require("../server/lib/recruitment/recruitmentWorkflowDiagnosticsAttachment");

const {
  peekWorkflowObservation,
  recordWorkflowObservation
} = require("../server/lib/recruitment/recruitmentWorkflowObservationRegistry");

const {
  attachRecruitmentCompatibility,
  peekRecruitmentCompatibility
} = require("../server/lib/recruitment/recruitmentCompatibilityLayer");

const {
  OBSERVATION_VIEW_STATUS
} = require("../server/lib/recruitment/recruitmentWorkflowObservationView");

const { PROCESS_RESULT_STATUS } = require("../server/lib/recruitment/detectionProcessor");
const { coordinateRecruitmentWorkflowIntegration } = require(
  "../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator"
);

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowObservationRolloutReadiness.js";
const HEALTH_CHECK_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowObservationHealthCheck.js";
const CONSUMER_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowObservationConsumer.js";
const HOOK_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowObservationContractIntegrationHook.js";
const ATTACHMENT_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowObservationContractAttachment.js";
const INTEGRATION_CONTRACT_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowObservationIntegrationContract.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const COMPATIBILITY_MODULE_PATH = "server/lib/recruitment/recruitmentCompatibilityLayer.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";
const REGISTRY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowObservationRegistry.js";
const OBSERVATION_SERVICE_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowObservationService.js";

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function notice(overrides = {}) {
  return {
    title: "SSC CGL 2026 Admit Card",
    content: "Download admit card for Tier 1 Advertisement Number CGL-01/2026",
    url: "https://ssc.nic.in/admit-card-cgl-2026.pdf",
    ...overrides
  };
}

function candidate(overrides = {}) {
  return {
    id: 1,
    department: "ssc",
    post_name: "Combined Graduate Level",
    exam_name: "CGL",
    cycle_year: 2026,
    advertisement_no: "CGL-01/2026",
    ...overrides
  };
}

function mockProcessorResult() {
  return {
    status: PROCESS_RESULT_STATUS.SUCCESS,
    warnings: [],
    eventType: "admit_card",
    selectedRecruitment: candidate(),
    reviewItem: { title: notice().title, eventType: "admit_card", status: "pending" }
  };
}

function enabledInput(overrides = {}) {
  return {
    notice: notice(),
    updateId: 112,
    featureFlags: { workflowIntegrationEnabled: true },
    traceId: "phase-112-trace",
    ...overrides
  };
}

function disabledInput(overrides = {}) {
  return {
    notice: notice(),
    updateId: 112,
    featureFlags: { workflowIntegrationEnabled: false },
    traceId: "phase-112-trace",
    ...overrides
  };
}

function attachIntegratedContract(outcome, input = enabledInput()) {
  attachRecruitmentWorkflowIntegration(outcome, input);
  return attachRecruitmentWorkflowObservationContractIntegration(outcome, input);
}

function collectFrozenNodes(value, nodes = []) {
  if (value == null || typeof value !== "object") {
    return nodes;
  }
  if (Object.isFrozen(value)) {
    nodes.push(value);
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      collectFrozenNodes(value[i], nodes);
    }
    return nodes;
  }
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    collectFrozenNodes(value[keys[i]], nodes);
  }
  return nodes;
}

function assertAllFrozen(value) {
  const nodes = collectFrozenNodes(value);
  for (let i = 0; i < nodes.length; i += 1) {
    expect(Object.isFrozen(nodes[i])).toBe(true);
  }
}

describe("Phase 112 — recruitmentWorkflowObservationRolloutReadiness", () => {
  beforeEach(() => {
    coordinateRecruitmentWorkflowIntegration.mockClear();
    attachRecruitmentWorkflowObservationContractIntegration.mockClear();
  });

  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_PHASE).toBe(112);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_ENTITY).toBe(
        "recruitment_workflow_observation_rollout_readiness"
      );
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_DESCRIPTOR.phase).toBe(112);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_METADATA.rolloutReadinessOnly).toBe(
        true
      );
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_METADATA.invokesCoordinator).toBe(
        false
      );
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_METADATA.rebuildsContracts).toBe(
        false
      );
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_METADATA.pipelineWiring).toBe(
        false
      );
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_METADATA.sourcePhase).toBe(111);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_METADATA.persistenceEnabled).toBe(
        false
      );
    });
  });

  describe("ready observation", () => {
    test("reports READY when integrated contract has complete observation", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1201 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1201 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const result = evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome);

      expect(result.ready).toBe(true);
      expect(result.status).toBe(ROLLOUT_READINESS_STATUS.READY);
      expect(result.healthStatus).toBe(OBSERVATION_HEALTH_CHECK_STATUS.READY);
      expect(result.contractAvailable).toBe(true);
      expect(result.observationAvailable).toBe(true);
      expect(result.readinessReason).toBe("OBSERVATION_READY");
      expect(result.blockers).toEqual([]);
      expect(result.advisory).toBe(true);
      expect(result.architectureOnly).toBe(true);
      expect(result.executed).toBe(false);
      expect(isRecruitmentWorkflowObservationRolloutReady(result)).toBe(true);
    });

    test("projects health summary fields into rollout readiness result", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1202 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1202 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const contract = getRecruitmentWorkflowObservationContract(outcome);
      const diagnostics = contract.observation.diagnostics;
      const result = evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome);

      expect(result.lifecycle).toBe(diagnostics.lifecycle);
      expect(result.health).toBe(diagnostics.health);
      expect(result.severity).toBe(diagnostics.severity);
      expect(result.recommendation).toBe(diagnostics.recommendation);
    });

    test("summarizeRecruitmentWorkflowObservationRolloutReadiness extracts key fields", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1203 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1203 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const result = evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome);
      const summary = summarizeRecruitmentWorkflowObservationRolloutReadiness(result);

      expect(summary).toEqual({
        ready: true,
        status: ROLLOUT_READINESS_STATUS.READY,
        healthStatus: OBSERVATION_HEALTH_CHECK_STATUS.READY,
        contractAvailable: true,
        observationAvailable: true,
        blockers: [],
        readinessReason: "OBSERVATION_READY"
      });
      expect(Object.isFrozen(summary)).toBe(true);
      expect(Object.isFrozen(summary.blockers)).toBe(true);
    });
  });

  describe("missing contract", () => {
    test("reports NOT_READY when no integration contract is attached", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1204 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 1204 }));

      const result = evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome);

      expect(result.ready).toBe(false);
      expect(result.status).toBe(ROLLOUT_READINESS_STATUS.NOT_READY);
      expect(result.healthStatus).toBe(OBSERVATION_HEALTH_CHECK_STATUS.UNAVAILABLE);
      expect(result.contractAvailable).toBe(false);
      expect(result.observationAvailable).toBe(false);
      expect(result.readinessReason).toBe("CONTRACT_UNAVAILABLE");
      expect(result.blockers).toEqual([ROLLOUT_READINESS_BLOCKERS.CONTRACT_UNAVAILABLE]);
      expect(isRecruitmentWorkflowObservationRolloutReady(result)).toBe(false);
    });

    test("projects empty consumer summary when contract is unavailable", () => {
      const result = evaluateRecruitmentWorkflowObservationRolloutReadiness({ updateId: 1205 });
      const consumerSummary = summarizeRecruitmentWorkflowObservationContract({ updateId: 1205 });

      expect(result.lifecycle).toBe(consumerSummary.lifecycle);
      expect(result.health).toBe(consumerSummary.health);
      expect(result.severity).toBe(consumerSummary.severity);
      expect(result.recommendation).toBeNull();
    });
  });

  describe("incomplete observation", () => {
    test("reports NOT_READY when contract exists but observation is not READY", () => {
      const outcome = { updateId: 1206 };
      recordWorkflowObservation(outcome, {
        featureEnabled: true,
        plannedWorkflow: {
          workflowAdvisorySnapshot: { invalid: true },
          architectureOnly: true,
          advisory: true,
          executed: false
        },
        diagnostics: {}
      });
      attachRecruitmentWorkflowObservationContractIntegration(
        outcome,
        enabledInput({ updateId: 1206 })
      );

      const contract = getRecruitmentWorkflowObservationContract(outcome);
      const result = evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome);

      expect(contract).not.toBeNull();
      expect(contract.observation.observation.status).not.toBe(OBSERVATION_VIEW_STATUS.READY);
      expect(result.ready).toBe(false);
      expect(result.status).toBe(ROLLOUT_READINESS_STATUS.NOT_READY);
      expect(result.healthStatus).toBe(OBSERVATION_HEALTH_CHECK_STATUS.INCOMPLETE);
      expect(result.contractAvailable).toBe(true);
      expect(result.readinessReason).toBe("OBSERVATION_INCOMPLETE");
      expect(result.blockers).toEqual([ROLLOUT_READINESS_BLOCKERS.OBSERVATION_INCOMPLETE]);
      expect(isRecruitmentWorkflowObservationRolloutReady(result)).toBe(false);
    });
  });

  describe("malformed outcome", () => {
    test("never throws for malformed inputs", () => {
      expect(() => evaluateRecruitmentWorkflowObservationRolloutReadiness("bad")).not.toThrow();
      expect(() => evaluateRecruitmentWorkflowObservationRolloutReadiness([])).not.toThrow();
      expect(() => isRecruitmentWorkflowObservationRolloutReady(42)).not.toThrow();
      expect(() => summarizeRecruitmentWorkflowObservationRolloutReadiness(Symbol("x"))).not.toThrow();
    });

    test("reports UNKNOWN for non-object outcomes", () => {
      const result = evaluateRecruitmentWorkflowObservationRolloutReadiness(null);

      expect(result.ready).toBe(false);
      expect(result.status).toBe(ROLLOUT_READINESS_STATUS.UNKNOWN);
      expect(result.healthStatus).toBe(OBSERVATION_HEALTH_CHECK_STATUS.UNKNOWN);
      expect(result.contractAvailable).toBe(false);
      expect(result.observationAvailable).toBe(false);
      expect(result.readinessReason).toBe("MALFORMED_OUTCOME");
      expect(result.blockers).toEqual([ROLLOUT_READINESS_BLOCKERS.MALFORMED_OUTCOME]);
      expect(isRecruitmentWorkflowObservationRolloutReady(result)).toBe(false);
    });

    test("summarizeRecruitmentWorkflowObservationRolloutReadiness returns empty summary for malformed result", () => {
      expect(summarizeRecruitmentWorkflowObservationRolloutReadiness(null)).toBe(
        EMPTY_ROLLOUT_READINESS_SUMMARY
      );
      expect(summarizeRecruitmentWorkflowObservationRolloutReadiness({ status: "READY" })).toBe(
        EMPTY_ROLLOUT_READINESS_SUMMARY
      );
    });
  });

  describe("flag OFF", () => {
    test("reports NOT_READY when integration hook attach was skipped", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1207 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 1207 }));

      attachRecruitmentWorkflowObservationContractIntegration(outcome, disabledInput());

      const result = evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome);

      expect(result.ready).toBe(false);
      expect(result.status).toBe(ROLLOUT_READINESS_STATUS.NOT_READY);
      expect(result.healthStatus).toBe(OBSERVATION_HEALTH_CHECK_STATUS.UNAVAILABLE);
      expect(result.contractAvailable).toBe(false);
      expect(result.blockers).toEqual([ROLLOUT_READINESS_BLOCKERS.CONTRACT_UNAVAILABLE]);
      expect(isRecruitmentWorkflowObservationRolloutReady(result)).toBe(false);
    });

    test("does not treat Phase 107 attachment store as rollout signal", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1208 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 1208 }));

      const phase107Contract = attachRecruitmentWorkflowObservationContract(outcome);

      expect(phase107Contract).not.toBeNull();
      expect(peekRecruitmentWorkflowObservationContract(outcome)).toBe(phase107Contract);
      expect(evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome).status).toBe(
        ROLLOUT_READINESS_STATUS.NOT_READY
      );
    });
  });

  describe("flag ON", () => {
    test("reports READY after Phase 108 integration attach with complete observation", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1209 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1209 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const result = evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome);

      expect(result.ready).toBe(true);
      expect(result.status).toBe(ROLLOUT_READINESS_STATUS.READY);
      expect(result.contractAvailable).toBe(true);
      expect(isRecruitmentWorkflowObservationRolloutReady(result)).toBe(true);
    });

    test("evaluates contract attached via registry-enabled outcome", () => {
      const outcome = { updateId: 1210 };
      recordWorkflowObservation(outcome, {
        featureEnabled: true,
        plannedWorkflow: null,
        diagnostics: {}
      });

      attachRecruitmentWorkflowObservationContractIntegration(
        outcome,
        enabledInput({ updateId: 1210 })
      );

      const result = evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome);

      expect(result.contractAvailable).toBe(true);
      expect(result.status).not.toBe(ROLLOUT_READINESS_STATUS.UNKNOWN);
    });
  });

  describe("blocker generation", () => {
    test("emits CONTRACT_UNAVAILABLE blocker for unavailable health", () => {
      const result = evaluateRecruitmentWorkflowObservationRolloutReadiness({ updateId: 1211 });

      expect(result.blockers).toEqual([ROLLOUT_READINESS_BLOCKERS.CONTRACT_UNAVAILABLE]);
      expect(result.readinessReason).toBe("CONTRACT_UNAVAILABLE");
    });

    test("emits OBSERVATION_INCOMPLETE blocker for incomplete health", () => {
      const outcome = { updateId: 1212 };
      recordWorkflowObservation(outcome, {
        featureEnabled: true,
        plannedWorkflow: {
          workflowAdvisorySnapshot: { invalid: true },
          architectureOnly: true,
          advisory: true,
          executed: false
        },
        diagnostics: {}
      });
      attachRecruitmentWorkflowObservationContractIntegration(
        outcome,
        enabledInput({ updateId: 1212 })
      );

      const result = evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome);

      expect(result.blockers).toEqual([ROLLOUT_READINESS_BLOCKERS.OBSERVATION_INCOMPLETE]);
      expect(result.readinessReason).toBe("OBSERVATION_INCOMPLETE");
    });

    test("emits MALFORMED_OUTCOME blocker for malformed outcome", () => {
      const result = evaluateRecruitmentWorkflowObservationRolloutReadiness(undefined);

      expect(result.blockers).toEqual([ROLLOUT_READINESS_BLOCKERS.MALFORMED_OUTCOME]);
      expect(result.readinessReason).toBe("MALFORMED_OUTCOME");
    });

    test("READY rollout has no blockers", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1213 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1213 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const result = evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome);

      expect(result.blockers).toEqual([]);
      expect(Object.isFrozen(result.blockers)).toBe(true);
    });
  });

  describe("no side effects", () => {
    test("rollout readiness API never calls integration hook attach", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1214 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 1214 }));

      evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome);
      isRecruitmentWorkflowObservationRolloutReady(
        evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome)
      );
      summarizeRecruitmentWorkflowObservationRolloutReadiness(
        evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome)
      );

      expect(attachRecruitmentWorkflowObservationContractIntegration).not.toHaveBeenCalled();
      expect(peekRecruitmentWorkflowObservationContractIntegration(outcome)).toBeNull();
    });

    test("rollout readiness does not populate Phase 107 attachment store", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1215 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 1215 }));

      evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome);

      expect(peekRecruitmentWorkflowObservationContract(outcome)).toBeNull();
    });

    test("does not alter existing registry, hook, compatibility, or diagnostics observations", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1216 };
      attachRecruitmentCompatibility(outcome, {
        notice: notice(),
        updateId: 1216,
        featureFlags: { workflowIntegrationEnabled: false }
      });
      attachIntegratedContract(outcome, enabledInput({ updateId: 1216 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const registryBefore = peekWorkflowObservation(outcome);
      const pipelineBefore = peekRecruitmentWorkflowIntegration(outcome);
      const compatibilityBefore = peekRecruitmentCompatibility(outcome);
      const diagnosticsBefore = peekRecruitmentWorkflowDiagnostics(outcome);
      const hookBefore = peekRecruitmentWorkflowObservationContractIntegration(outcome);
      const attachmentBefore = peekRecruitmentWorkflowObservationContract(outcome);

      evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome);
      isRecruitmentWorkflowObservationRolloutReady(
        evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome)
      );

      expect(peekWorkflowObservation(outcome)).toBe(registryBefore);
      expect(peekRecruitmentWorkflowIntegration(outcome)).toBe(pipelineBefore);
      expect(peekRecruitmentCompatibility(outcome)).toBe(compatibilityBefore);
      expect(peekRecruitmentWorkflowDiagnostics(outcome)).toBe(diagnosticsBefore);
      expect(peekRecruitmentWorkflowObservationContractIntegration(outcome)).toBe(hookBefore);
      expect(peekRecruitmentWorkflowObservationContract(outcome)).toBe(attachmentBefore);
    });
  });

  describe("no coordinator calls", () => {
    test("rollout readiness API does not invoke coordinator", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1217 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1217 }));
      coordinateRecruitmentWorkflowIntegration.mockClear();

      evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome);
      isRecruitmentWorkflowObservationRolloutReady(
        evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome)
      );

      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
    });
  });

  describe("deterministic output", () => {
    test("repeated rollout readiness evaluations return deeply equal results", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1218 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1218 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const first = evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome);
      const second = evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome);
      const summaryA = summarizeRecruitmentWorkflowObservationRolloutReadiness(first);
      const summaryB = summarizeRecruitmentWorkflowObservationRolloutReadiness(second);

      expect(second).toEqual(first);
      expect(summaryB).toEqual(summaryA);
    });

    test("projected fields match health check projection only", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1219 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1219 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const consumerSummary = summarizeRecruitmentWorkflowObservationContract(outcome);
      const result = evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome);

      expect(result.lifecycle).toBe(consumerSummary.lifecycle);
      expect(result.health).toBe(consumerSummary.health);
      expect(result.severity).toBe(consumerSummary.severity);
      expect(result.recommendation).toBe(consumerSummary.recommendation);
    });
  });

  describe("immutability", () => {
    test("does not mutate the pipeline outcome object", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1220 };
      const before = JSON.stringify(outcome);

      attachIntegratedContract(outcome, enabledInput({ updateId: 1220 }));
      evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome);

      expect(JSON.stringify(outcome)).toBe(before);
      expect(outcome).not.toHaveProperty("observation");
      expect(outcome).not.toHaveProperty("contract");
      expect(outcome).not.toHaveProperty("diagnostics");
    });

    test("returns frozen rollout readiness results", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1221 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1221 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const result = evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome);
      const summary = summarizeRecruitmentWorkflowObservationRolloutReadiness(result);

      assertAllFrozen(result);
      assertAllFrozen(summary);
      expect(() => {
        result.status = "CHANGED";
      }).toThrow();
    });
  });

  describe("no persistence", () => {
    test("rollout readiness metadata declares no persistence or production mutation", () => {
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_METADATA.persistenceEnabled).toBe(
        false
      );
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_METADATA.mutatesProduction).toBe(
        false
      );
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_METADATA.pipelineWiring).toBe(
        false
      );
    });

    test("rollout readiness results remain advisory-only with no execution", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1222 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1222 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const result = evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome);

      expect(result.advisory).toBe(true);
      expect(result.architectureOnly).toBe(true);
      expect(result.executed).toBe(false);
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares pure rollout readiness constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 112");
      expect(source).toContain("evaluateRecruitmentWorkflowObservationRolloutReadiness");
      expect(source).toContain("isRecruitmentWorkflowObservationRolloutReady");
      expect(source).toContain("summarizeRecruitmentWorkflowObservationRolloutReadiness");
      expect(source).toContain("recruitmentWorkflowObservationHealthCheck");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("rolloutReadinessOnly");
      expect(source).toContain("invokesCoordinator");
      expect(source).toContain("sourcePhase: 111");
      expect(source).toContain("Never attaches");
    });

    test("module does not import express, database drivers, or filesystem APIs", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2/);
      expect(source).not.toMatch(/require\(["']https?["']\)/);
    });

    test("module reuses Phase 111 health check only", () => {
      const source = read(MODULE_PATH);
      const requireMatches = source.match(/require\(["'][^"']+["']\)/g) ?? [];

      expect(requireMatches).toEqual([
        'require("./recruitmentWorkflowObservationHealthCheck")'
      ]);
      expect(source).not.toMatch(/recruitmentWorkflowObservationConsumer/);
      expect(source).not.toMatch(/recruitmentWorkflowObservationContractIntegrationHook/);
      expect(source).not.toMatch(/recruitmentWorkflowObservationContractAttachment/);
      expect(source).not.toMatch(/recruitmentWorkflowObservationIntegrationContract/);
      expect(source).not.toMatch(/buildRecruitmentWorkflowObservationContract/);
      expect(source).not.toMatch(/recruitmentWorkflowObservationService/);
      expect(source).not.toMatch(/attachRecruitmentWorkflowObservationContractIntegration/);
      expect(source).not.toMatch(/coordinateRecruitmentWorkflowIntegration/);
    });

    test("module does not invoke coordinator, rebuild snapshots, or modify diagnostics", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/getOrCreateWorkflowObservation/);
      expect(source).not.toMatch(/buildRecruitmentWorkflowAdvisorySnapshot/);
      expect(source).not.toMatch(/attachRecruitmentWorkflowIntegration/);
      expect(source).not.toMatch(/attachRecruitmentCompatibilityIntegration/);
      expect(source).not.toMatch(/buildRecruitmentWorkflowObservationView/);
      expect(source).not.toMatch(/buildRecruitmentWorkflowObservationDiagnostics/);
      expect(source).not.toMatch(/appendExecutionStage/);
      expect(source).not.toMatch(/recordWorkflowObservation/);
    });

    test("rollout readiness module is not wired into coordinator, compatibility layer, registry, worker, observation service, Phase 107 attachment, integration contract, integration hook, consumer attach path, health check, or pipeline", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const compatibilitySource = read(COMPATIBILITY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const registrySource = read(REGISTRY_MODULE_PATH);
      const observationServiceSource = read(OBSERVATION_SERVICE_MODULE_PATH);
      const attachmentSource = read(ATTACHMENT_MODULE_PATH);
      const integrationContractSource = read(INTEGRATION_CONTRACT_MODULE_PATH);
      const hookSource = read(HOOK_MODULE_PATH);
      const consumerSource = read(CONSUMER_MODULE_PATH);
      const healthCheckSource = read(HEALTH_CHECK_MODULE_PATH);

      expect(coordinatorSource).not.toMatch(/recruitmentWorkflowObservationRolloutReadiness/);
      expect(compatibilitySource).not.toMatch(/recruitmentWorkflowObservationRolloutReadiness/);
      expect(pipelineSource).not.toMatch(/recruitmentWorkflowObservationRolloutReadiness/);
      expect(workerSource).not.toMatch(/recruitmentWorkflowObservationRolloutReadiness/);
      expect(registrySource).not.toMatch(/recruitmentWorkflowObservationRolloutReadiness/);
      expect(observationServiceSource).not.toMatch(
        /recruitmentWorkflowObservationRolloutReadiness/
      );
      expect(attachmentSource).not.toMatch(/recruitmentWorkflowObservationRolloutReadiness/);
      expect(integrationContractSource).not.toMatch(
        /recruitmentWorkflowObservationRolloutReadiness/
      );
      expect(hookSource).not.toMatch(/recruitmentWorkflowObservationRolloutReadiness/);
      expect(consumerSource).not.toMatch(/recruitmentWorkflowObservationRolloutReadiness/);
      expect(healthCheckSource).not.toMatch(/recruitmentWorkflowObservationRolloutReadiness/);
    });
  });
});
