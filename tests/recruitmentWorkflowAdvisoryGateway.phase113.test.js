"use strict";

/**
 * Phase 113 — Recruitment Workflow Advisory Gateway tests.
 * Complete ready outcome, missing snapshot/contract/observation, health unavailable,
 * rollout not ready, malformed outcome, determinism, immutability, no side effects,
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
  RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_PHASE,
  RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_ENTITY,
  GATEWAY_RECOMMENDATION_ACTION,
  RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_METADATA,
  EMPTY_GATEWAY_SUMMARY,
  getRecruitmentWorkflowAdvisoryGateway,
  isRecruitmentWorkflowAdvisoryGateway,
  summarizeRecruitmentWorkflowAdvisoryGateway
} = require("../server/lib/recruitment/recruitmentWorkflowAdvisoryGateway");

const {
  OBSERVATION_HEALTH_CHECK_STATUS
} = require("../server/lib/recruitment/recruitmentWorkflowObservationHealthCheck");

const {
  ROLLOUT_READINESS_STATUS
} = require("../server/lib/recruitment/recruitmentWorkflowObservationRolloutReadiness");

const {
  getRecruitmentWorkflowSnapshot,
  hasRecruitmentWorkflowSnapshot
} = require("../server/lib/recruitment/recruitmentWorkflowSnapshotAdapter");

const {
  getRecruitmentWorkflowObservation,
  isRecruitmentWorkflowObservation
} = require("../server/lib/recruitment/recruitmentWorkflowObservationService");

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
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js";
const SNAPSHOT_ADAPTER_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowSnapshotAdapter.js";
const OBSERVATION_SERVICE_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowObservationService.js";
const CONSUMER_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowObservationConsumer.js";
const HEALTH_CHECK_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowObservationHealthCheck.js";
const ROLLOUT_READINESS_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowObservationRolloutReadiness.js";
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
    updateId: 113,
    featureFlags: { workflowIntegrationEnabled: true },
    traceId: "phase-113-trace",
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

const EXPECTED_GATEWAY_KEYS = Object.freeze([
  "available",
  "snapshot",
  "observation",
  "contract",
  "health",
  "rolloutReadiness",
  "recommendation",
  "metadata"
]);

describe("Phase 113 — recruitmentWorkflowAdvisoryGateway", () => {
  beforeEach(() => {
    coordinateRecruitmentWorkflowIntegration.mockClear();
    attachRecruitmentWorkflowObservationContractIntegration.mockClear();
  });

  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_PHASE).toBe(113);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_ENTITY).toBe(
        "recruitment_workflow_advisory_gateway"
      );
      expect(RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_DESCRIPTOR.phase).toBe(113);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_METADATA.gatewayOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_METADATA.invokesCoordinator).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_METADATA.rebuildsContracts).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_METADATA.pipelineWiring).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_METADATA.sourcePhases).toEqual([
        101, 105, 110, 111, 112
      ]);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_METADATA.persistenceEnabled).toBe(false);
    });
  });

  describe("complete Phase 112 ready outcome", () => {
    test("aggregates all advisory layers for a ready outcome", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1301 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1301 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const gateway = getRecruitmentWorkflowAdvisoryGateway(outcome);

      expect(Object.keys(gateway).sort()).toEqual([...EXPECTED_GATEWAY_KEYS].sort());
      expect(gateway.available).toBe(true);
      expect(gateway.snapshot).not.toBeNull();
      expect(gateway.observation).not.toBeNull();
      expect(isRecruitmentWorkflowObservation(gateway.observation)).toBe(true);
      expect(gateway.contract).not.toBeNull();
      expect(gateway.health).not.toBeNull();
      expect(gateway.health.status).toBe(OBSERVATION_HEALTH_CHECK_STATUS.READY);
      expect(gateway.rolloutReadiness).not.toBeNull();
      expect(gateway.rolloutReadiness.status).toBe(ROLLOUT_READINESS_STATUS.READY);
      expect(gateway.metadata).toEqual({
        phase: 113,
        advisory: true,
        architectureOnly: true,
        executed: false
      });
      expect(isRecruitmentWorkflowAdvisoryGateway(gateway)).toBe(true);
    });

    test("maps READY rollout readiness to READY_FOR_CONTROLLED_INTEGRATION action", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1302 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1302 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const gateway = getRecruitmentWorkflowAdvisoryGateway(outcome);
      const contract = getRecruitmentWorkflowObservationContract(outcome);
      const diagnostics = contract.observation.diagnostics;

      expect(gateway.recommendation.action).toBe(
        GATEWAY_RECOMMENDATION_ACTION.READY_FOR_CONTROLLED_INTEGRATION
      );
      expect(gateway.recommendation.lifecycle).toBe(diagnostics.lifecycle);
      expect(gateway.recommendation.health).toBe(diagnostics.health);
      expect(gateway.recommendation.monitoringRequired).toBe(diagnostics.monitoringRequired);
      expect(gateway.recommendation.workflowCompleted).toBe(diagnostics.workflowCompleted);
    });

    test("summarizeRecruitmentWorkflowAdvisoryGateway extracts key fields", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1303 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1303 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const gateway = getRecruitmentWorkflowAdvisoryGateway(outcome);
      const summary = summarizeRecruitmentWorkflowAdvisoryGateway(gateway);

      expect(summary.available).toBe(true);
      expect(summary.action).toBe(GATEWAY_RECOMMENDATION_ACTION.READY_FOR_CONTROLLED_INTEGRATION);
      expect(summary.rolloutStatus).toBe(ROLLOUT_READINESS_STATUS.READY);
      expect(summary.healthStatus).toBe(OBSERVATION_HEALTH_CHECK_STATUS.READY);
      expect(summary.contractAvailable).toBe(true);
      expect(summary.observationAvailable).toBe(true);
      expect(Object.isFrozen(summary)).toBe(true);
    });

    test("composed layers match individual phase outputs without recomputation", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1304 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1304 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const gateway = getRecruitmentWorkflowAdvisoryGateway(outcome);

      expect(gateway.snapshot).toBe(getRecruitmentWorkflowSnapshot(outcome));
      expect(gateway.observation).toEqual(getRecruitmentWorkflowObservation(outcome));
      expect(gateway.contract).toBe(getRecruitmentWorkflowObservationContract(outcome));
    });
  });

  describe("missing snapshot", () => {
    test("returns null snapshot when no advisory snapshot is present", () => {
      const outcome = { updateId: 1305 };
      recordWorkflowObservation(outcome, {
        featureEnabled: true,
        plannedWorkflow: null,
        diagnostics: {}
      });
      attachRecruitmentWorkflowObservationContractIntegration(
        outcome,
        enabledInput({ updateId: 1305 })
      );

      const gateway = getRecruitmentWorkflowAdvisoryGateway(outcome);

      expect(hasRecruitmentWorkflowSnapshot(outcome)).toBe(false);
      expect(gateway.snapshot).toBeNull();
      expect(gateway.contract).not.toBeNull();
      expect(gateway.available).toBe(false);
      expect(gateway.recommendation.action).toBe(GATEWAY_RECOMMENDATION_ACTION.REVIEW_REQUIRED);
      expect(isRecruitmentWorkflowAdvisoryGateway(gateway)).toBe(true);
    });
  });

  describe("missing contract", () => {
    test("returns null contract when integration contract is not attached", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1306 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 1306 }));

      const gateway = getRecruitmentWorkflowAdvisoryGateway(outcome);

      expect(gateway.contract).toBeNull();
      expect(gateway.health.status).toBe(OBSERVATION_HEALTH_CHECK_STATUS.UNAVAILABLE);
      expect(gateway.rolloutReadiness.status).toBe(ROLLOUT_READINESS_STATUS.NOT_READY);
      expect(gateway.available).toBe(false);
      expect(gateway.recommendation.action).toBe(GATEWAY_RECOMMENDATION_ACTION.REVIEW_REQUIRED);
    });

    test("projects empty consumer summary fields into recommendation when contract unavailable", () => {
      const gateway = getRecruitmentWorkflowAdvisoryGateway({ updateId: 1307 });
      const consumerSummary = summarizeRecruitmentWorkflowObservationContract({ updateId: 1307 });

      expect(gateway.recommendation.lifecycle).toBe(consumerSummary.lifecycle);
      expect(gateway.recommendation.health).toBe(consumerSummary.health);
      expect(gateway.recommendation.monitoringRequired).toBeNull();
      expect(gateway.recommendation.workflowCompleted).toBeNull();
    });
  });

  describe("missing observation", () => {
    test("reports unavailable advisory when contract exists but observation is incomplete", () => {
      const outcome = { updateId: 1308 };
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
        enabledInput({ updateId: 1308 })
      );

      const gateway = getRecruitmentWorkflowAdvisoryGateway(outcome);
      const contract = getRecruitmentWorkflowObservationContract(outcome);

      expect(contract).not.toBeNull();
      expect(contract.observation.observation.status).not.toBe(OBSERVATION_VIEW_STATUS.READY);
      expect(gateway.available).toBe(false);
      expect(gateway.health.status).toBe(OBSERVATION_HEALTH_CHECK_STATUS.INCOMPLETE);
      expect(gateway.rolloutReadiness.status).toBe(ROLLOUT_READINESS_STATUS.NOT_READY);
      expect(gateway.recommendation.action).toBe(GATEWAY_RECOMMENDATION_ACTION.REVIEW_REQUIRED);
    });
  });

  describe("health unavailable", () => {
    test("returns health UNAVAILABLE when contract is missing", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1309 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 1309 }));

      const gateway = getRecruitmentWorkflowAdvisoryGateway(outcome);

      expect(gateway.health).not.toBeNull();
      expect(gateway.health.status).toBe(OBSERVATION_HEALTH_CHECK_STATUS.UNAVAILABLE);
      expect(gateway.health.contractAvailable).toBe(false);
      expect(gateway.available).toBe(false);
    });
  });

  describe("rollout not ready", () => {
    test("maps NOT_READY rollout to REVIEW_REQUIRED action", () => {
      const outcome = { updateId: 1310 };
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
        enabledInput({ updateId: 1310 })
      );

      const gateway = getRecruitmentWorkflowAdvisoryGateway(outcome);

      expect(gateway.rolloutReadiness.ready).toBe(false);
      expect(gateway.rolloutReadiness.status).toBe(ROLLOUT_READINESS_STATUS.NOT_READY);
      expect(gateway.recommendation.action).toBe(GATEWAY_RECOMMENDATION_ACTION.REVIEW_REQUIRED);
    });
  });

  describe("malformed outcome", () => {
    test("never throws for malformed inputs", () => {
      expect(() => getRecruitmentWorkflowAdvisoryGateway("bad")).not.toThrow();
      expect(() => getRecruitmentWorkflowAdvisoryGateway([])).not.toThrow();
      expect(() => isRecruitmentWorkflowAdvisoryGateway(42)).not.toThrow();
      expect(() => summarizeRecruitmentWorkflowAdvisoryGateway(Symbol("x"))).not.toThrow();
    });

    test("returns safe defaults for non-object outcomes", () => {
      const gateway = getRecruitmentWorkflowAdvisoryGateway(null);

      expect(gateway.available).toBe(false);
      expect(gateway.snapshot).toBeNull();
      expect(gateway.observation).toBeNull();
      expect(gateway.contract).toBeNull();
      expect(gateway.health).toBeNull();
      expect(gateway.rolloutReadiness).toBeNull();
      expect(gateway.recommendation.action).toBe(GATEWAY_RECOMMENDATION_ACTION.INSUFFICIENT_DATA);
      expect(gateway.recommendation.lifecycle).toBe("UNKNOWN");
      expect(gateway.recommendation.health).toBe("UNKNOWN");
      expect(gateway.metadata.phase).toBe(113);
      expect(isRecruitmentWorkflowAdvisoryGateway(gateway)).toBe(true);
    });

    test("summarizeRecruitmentWorkflowAdvisoryGateway returns empty summary for malformed gateway", () => {
      expect(summarizeRecruitmentWorkflowAdvisoryGateway(null)).toBe(EMPTY_GATEWAY_SUMMARY);
      expect(summarizeRecruitmentWorkflowAdvisoryGateway({ available: true })).toBe(
        EMPTY_GATEWAY_SUMMARY
      );
    });

    test("maps UNKNOWN rollout to INSUFFICIENT_DATA action", () => {
      const gateway = getRecruitmentWorkflowAdvisoryGateway(undefined);

      expect(gateway.recommendation.action).toBe(GATEWAY_RECOMMENDATION_ACTION.INSUFFICIENT_DATA);
    });
  });

  describe("deterministic output", () => {
    test("repeated gateway calls return deeply equal results", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1311 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1311 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const first = getRecruitmentWorkflowAdvisoryGateway(outcome);
      const second = getRecruitmentWorkflowAdvisoryGateway(outcome);
      const summaryA = summarizeRecruitmentWorkflowAdvisoryGateway(first);
      const summaryB = summarizeRecruitmentWorkflowAdvisoryGateway(second);

      expect(second).toEqual(first);
      expect(summaryB).toEqual(summaryA);
    });

    test("recommendation fields match health projection only", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1312 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1312 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const consumerSummary = summarizeRecruitmentWorkflowObservationContract(outcome);
      const gateway = getRecruitmentWorkflowAdvisoryGateway(outcome);

      expect(gateway.recommendation.lifecycle).toBe(consumerSummary.lifecycle);
      expect(gateway.recommendation.health).toBe(consumerSummary.health);
    });
  });

  describe("repeated calls", () => {
    test("multiple gateway invocations do not change outcome state", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1313 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1313 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      getRecruitmentWorkflowAdvisoryGateway(outcome);
      getRecruitmentWorkflowAdvisoryGateway(outcome);
      getRecruitmentWorkflowAdvisoryGateway(outcome);

      expect(peekRecruitmentWorkflowObservationContractIntegration(outcome)).not.toBeNull();
      expect(hasRecruitmentWorkflowSnapshot(outcome)).toBe(true);
    });
  });

  describe("deep immutability", () => {
    test("returns deeply frozen gateway results", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1314 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1314 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const gateway = getRecruitmentWorkflowAdvisoryGateway(outcome);
      const summary = summarizeRecruitmentWorkflowAdvisoryGateway(gateway);

      assertAllFrozen(gateway);
      assertAllFrozen(summary);
      expect(Object.isFrozen(gateway.metadata)).toBe(true);
      expect(Object.isFrozen(gateway.recommendation)).toBe(true);
      expect(() => {
        gateway.available = false;
      }).toThrow();
    });
  });

  describe("no mutation of input", () => {
    test("does not mutate the pipeline outcome object", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1315 };
      const before = JSON.stringify(outcome);

      attachIntegratedContract(outcome, enabledInput({ updateId: 1315 }));
      getRecruitmentWorkflowAdvisoryGateway(outcome);

      expect(JSON.stringify(outcome)).toBe(before);
      expect(outcome).not.toHaveProperty("advisoryGateway");
    });
  });

  describe("no coordinator invocation", () => {
    test("gateway API does not invoke coordinator", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1316 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1316 }));
      coordinateRecruitmentWorkflowIntegration.mockClear();

      getRecruitmentWorkflowAdvisoryGateway(outcome);
      isRecruitmentWorkflowAdvisoryGateway(getRecruitmentWorkflowAdvisoryGateway(outcome));

      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
    });
  });

  describe("no attachment side effects", () => {
    test("gateway API never calls integration hook attach", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1317 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 1317 }));

      getRecruitmentWorkflowAdvisoryGateway(outcome);
      summarizeRecruitmentWorkflowAdvisoryGateway(getRecruitmentWorkflowAdvisoryGateway(outcome));

      expect(attachRecruitmentWorkflowObservationContractIntegration).not.toHaveBeenCalled();
      expect(peekRecruitmentWorkflowObservationContractIntegration(outcome)).toBeNull();
    });

    test("gateway does not populate Phase 107 attachment store", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1318 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 1318 }));

      getRecruitmentWorkflowAdvisoryGateway(outcome);

      expect(peekRecruitmentWorkflowObservationContract(outcome)).toBeNull();
    });

    test("does not alter existing registry, hook, compatibility, or diagnostics observations", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1319 };
      attachRecruitmentCompatibility(outcome, {
        notice: notice(),
        updateId: 1319,
        featureFlags: { workflowIntegrationEnabled: false }
      });
      attachIntegratedContract(outcome, enabledInput({ updateId: 1319 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const registryBefore = peekWorkflowObservation(outcome);
      const pipelineBefore = peekRecruitmentWorkflowIntegration(outcome);
      const compatibilityBefore = peekRecruitmentCompatibility(outcome);
      const diagnosticsBefore = peekRecruitmentWorkflowDiagnostics(outcome);
      const hookBefore = peekRecruitmentWorkflowObservationContractIntegration(outcome);
      const attachmentBefore = peekRecruitmentWorkflowObservationContract(outcome);

      getRecruitmentWorkflowAdvisoryGateway(outcome);
      isRecruitmentWorkflowAdvisoryGateway(getRecruitmentWorkflowAdvisoryGateway(outcome));

      expect(peekWorkflowObservation(outcome)).toBe(registryBefore);
      expect(peekRecruitmentWorkflowIntegration(outcome)).toBe(pipelineBefore);
      expect(peekRecruitmentCompatibility(outcome)).toBe(compatibilityBefore);
      expect(peekRecruitmentWorkflowDiagnostics(outcome)).toBe(diagnosticsBefore);
      expect(peekRecruitmentWorkflowObservationContractIntegration(outcome)).toBe(hookBefore);
      expect(peekRecruitmentWorkflowObservationContract(outcome)).toBe(attachmentBefore);
    });
  });

  describe("architecture boundary checks", () => {
    test("module source declares pure advisory gateway constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 113");
      expect(source).toContain("getRecruitmentWorkflowAdvisoryGateway");
      expect(source).toContain("isRecruitmentWorkflowAdvisoryGateway");
      expect(source).toContain("summarizeRecruitmentWorkflowAdvisoryGateway");
      expect(source).toContain("recruitmentWorkflowSnapshotAdapter");
      expect(source).toContain("recruitmentWorkflowObservationService");
      expect(source).toContain("recruitmentWorkflowObservationConsumer");
      expect(source).toContain("recruitmentWorkflowObservationHealthCheck");
      expect(source).toContain("recruitmentWorkflowObservationRolloutReadiness");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("gatewayOnly");
      expect(source).toContain("invokesCoordinator");
      expect(source).toContain("sourcePhases");
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

    test("module composes Phase 101, 105, 110, 111, and 112 only", () => {
      const source = read(MODULE_PATH);
      const requireMatches = source.match(/require\(["']\.\/[^"']+["']\)/g) ?? [];

      expect(requireMatches).toEqual([
        'require("./recruitmentWorkflowSnapshotAdapter")',
        'require("./recruitmentWorkflowObservationService")',
        'require("./recruitmentWorkflowObservationConsumer")',
        'require("./recruitmentWorkflowObservationHealthCheck")',
        'require("./recruitmentWorkflowObservationRolloutReadiness")'
      ]);
      expect(source).not.toMatch(/recruitmentWorkflowIntegrationCoordinator/);
      expect(source).not.toMatch(/recruitmentWorkflowObservationContractIntegrationHook/);
      expect(source).not.toMatch(/recruitmentWorkflowObservationContractAttachment/);
      expect(source).not.toMatch(/attachRecruitmentWorkflowObservationContractIntegration/);
      expect(source).not.toMatch(/coordinateRecruitmentWorkflowIntegration/);
      expect(source).not.toMatch(/buildRecruitmentWorkflowAdvisorySnapshot/);
      expect(source).not.toMatch(/recordWorkflowObservation/);
    });

    test("module does not invoke coordinator, rebuild snapshots, or modify diagnostics", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/getOrCreateWorkflowObservation/);
      expect(source).not.toMatch(/attachRecruitmentWorkflowIntegration/);
      expect(source).not.toMatch(/attachRecruitmentCompatibilityIntegration/);
      expect(source).not.toMatch(/appendExecutionStage/);
      expect(source).not.toMatch(/attachRecruitmentWorkflowDiagnostics/);
      expect(source).not.toMatch(/attachRecruitmentWorkflowObservationContract/);
    });

    test("advisory gateway module is not wired into coordinator, compatibility layer, registry, worker, observation service, rollout readiness, health check, consumer, integration hook, or pipeline", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const compatibilitySource = read(COMPATIBILITY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const registrySource = read(REGISTRY_MODULE_PATH);
      const observationServiceSource = read(OBSERVATION_SERVICE_MODULE_PATH);
      const rolloutReadinessSource = read(ROLLOUT_READINESS_MODULE_PATH);
      const healthCheckSource = read(HEALTH_CHECK_MODULE_PATH);
      const consumerSource = read(CONSUMER_MODULE_PATH);
      const hookSource = read(HOOK_MODULE_PATH);
      const snapshotAdapterSource = read(SNAPSHOT_ADAPTER_MODULE_PATH);

      expect(coordinatorSource).not.toMatch(/recruitmentWorkflowAdvisoryGateway/);
      expect(compatibilitySource).not.toMatch(/recruitmentWorkflowAdvisoryGateway/);
      expect(pipelineSource).not.toMatch(/recruitmentWorkflowAdvisoryGateway/);
      expect(workerSource).not.toMatch(/recruitmentWorkflowAdvisoryGateway/);
      expect(registrySource).not.toMatch(/recruitmentWorkflowAdvisoryGateway/);
      expect(observationServiceSource).not.toMatch(/recruitmentWorkflowAdvisoryGateway/);
      expect(rolloutReadinessSource).not.toMatch(/recruitmentWorkflowAdvisoryGateway/);
      expect(healthCheckSource).not.toMatch(/recruitmentWorkflowAdvisoryGateway/);
      expect(consumerSource).not.toMatch(/recruitmentWorkflowAdvisoryGateway/);
      expect(hookSource).not.toMatch(/recruitmentWorkflowAdvisoryGateway/);
      expect(snapshotAdapterSource).not.toMatch(/recruitmentWorkflowAdvisoryGateway/);
    });

    test("gateway metadata declares no persistence or production mutation", () => {
      expect(RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_METADATA.pipelineWiring).toBe(false);
    });
  });
});
