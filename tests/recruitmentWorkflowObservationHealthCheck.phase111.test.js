"use strict";

/**
 * Phase 111 — Recruitment Workflow Observation Health Check Library tests.
 * Valid observation health, missing contract, incomplete observation, malformed input,
 * flag OFF/ON, no side effects, no coordinator calls, determinism, immutability,
 * and architecture boundaries.
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
  RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_PHASE,
  RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_ENTITY,
  OBSERVATION_HEALTH_CHECK_STATUS,
  RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_METADATA,
  EMPTY_HEALTH_SUMMARY,
  checkRecruitmentWorkflowObservationHealth,
  hasHealthyRecruitmentWorkflowObservation,
  summarizeRecruitmentWorkflowObservationHealth
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

const { DIAGNOSTICS_SEVERITY } = require(
  "../server/lib/recruitment/recruitmentWorkflowObservationDiagnosticsAdapter"
);

const { PROCESS_RESULT_STATUS } = require("../server/lib/recruitment/detectionProcessor");
const { coordinateRecruitmentWorkflowIntegration } = require(
  "../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator"
);

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowObservationHealthCheck.js";
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
    updateId: 111,
    featureFlags: { workflowIntegrationEnabled: true },
    traceId: "phase-111-trace",
    ...overrides
  };
}

function disabledInput(overrides = {}) {
  return {
    notice: notice(),
    updateId: 111,
    featureFlags: { workflowIntegrationEnabled: false },
    traceId: "phase-111-trace",
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

describe("Phase 111 — recruitmentWorkflowObservationHealthCheck", () => {
  beforeEach(() => {
    coordinateRecruitmentWorkflowIntegration.mockClear();
    attachRecruitmentWorkflowObservationContractIntegration.mockClear();
  });

  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_PHASE).toBe(111);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_ENTITY).toBe(
        "recruitment_workflow_observation_health_check"
      );
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_DESCRIPTOR.phase).toBe(111);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_METADATA.healthCheckOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_METADATA.invokesCoordinator).toBe(false);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_METADATA.rebuildsContracts).toBe(false);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_METADATA.pipelineWiring).toBe(false);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_METADATA.sourcePhase).toBe(110);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_METADATA.persistenceEnabled).toBe(false);
    });
  });

  describe("valid observation health", () => {
    test("reports READY when integrated contract has complete observation", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1101 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1101 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const result = checkRecruitmentWorkflowObservationHealth(outcome);

      expect(result.status).toBe(OBSERVATION_HEALTH_CHECK_STATUS.READY);
      expect(result.available).toBe(true);
      expect(result.contractAvailable).toBe(true);
      expect(result.observationAvailable).toBe(true);
      expect(result.reason).toBe("OBSERVATION_READY");
      expect(result.advisory).toBe(true);
      expect(result.architectureOnly).toBe(true);
      expect(result.executed).toBe(false);
      expect(hasHealthyRecruitmentWorkflowObservation(outcome)).toBe(true);
    });

    test("projects consumer summary fields into health result", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1102 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1102 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const contract = getRecruitmentWorkflowObservationContract(outcome);
      const diagnostics = contract.observation.diagnostics;
      const result = checkRecruitmentWorkflowObservationHealth(outcome);

      expect(result.lifecycle).toBe(diagnostics.lifecycle);
      expect(result.health).toBe(diagnostics.health);
      expect(result.severity).toBe(diagnostics.severity);
      expect(result.recommendation).toBe(diagnostics.recommendation);
      expect(result.monitoringRequired).toBe(diagnostics.monitoringRequired);
      expect(result.workflowCompleted).toBe(diagnostics.workflowCompleted);
      expect(typeof result.monitoringRequired).toBe("boolean");
      expect(typeof result.workflowCompleted).toBe("boolean");
    });

    test("summarizeRecruitmentWorkflowObservationHealth extracts key fields", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1103 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1103 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const result = checkRecruitmentWorkflowObservationHealth(outcome);
      const summary = summarizeRecruitmentWorkflowObservationHealth(result);

      expect(summary).toEqual({
        status: OBSERVATION_HEALTH_CHECK_STATUS.READY,
        available: true,
        contractAvailable: true,
        observationAvailable: true,
        reason: "OBSERVATION_READY"
      });
      expect(Object.isFrozen(summary)).toBe(true);
    });
  });

  describe("missing contract", () => {
    test("reports UNAVAILABLE when no integration contract is attached", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1104 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 1104 }));

      const result = checkRecruitmentWorkflowObservationHealth(outcome);

      expect(result.status).toBe(OBSERVATION_HEALTH_CHECK_STATUS.UNAVAILABLE);
      expect(result.available).toBe(false);
      expect(result.contractAvailable).toBe(false);
      expect(result.observationAvailable).toBe(false);
      expect(result.reason).toBe("CONTRACT_UNAVAILABLE");
      expect(hasHealthyRecruitmentWorkflowObservation(outcome)).toBe(false);
    });

    test("projects empty consumer summary when contract is unavailable", () => {
      const result = checkRecruitmentWorkflowObservationHealth({ updateId: 1105 });
      const consumerSummary = summarizeRecruitmentWorkflowObservationContract({ updateId: 1105 });

      expect(result.lifecycle).toBe(consumerSummary.lifecycle);
      expect(result.health).toBe(consumerSummary.health);
      expect(result.severity).toBe(consumerSummary.severity);
      expect(result.recommendation).toBeNull();
      expect(result.monitoringRequired).toBeNull();
      expect(result.workflowCompleted).toBeNull();
    });
  });

  describe("incomplete observation", () => {
    test("reports INCOMPLETE when contract exists but observation is not READY", () => {
      const outcome = { updateId: 1106 };
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
        enabledInput({ updateId: 1106 })
      );

      const contract = getRecruitmentWorkflowObservationContract(outcome);
      const result = checkRecruitmentWorkflowObservationHealth(outcome);

      expect(contract).not.toBeNull();
      expect(contract.observation.observation.status).not.toBe(OBSERVATION_VIEW_STATUS.READY);
      expect(result.status).toBe(OBSERVATION_HEALTH_CHECK_STATUS.INCOMPLETE);
      expect(result.contractAvailable).toBe(true);
      expect(result.available).toBe(false);
      expect(result.reason).toBe("OBSERVATION_INCOMPLETE");
      expect(hasHealthyRecruitmentWorkflowObservation(outcome)).toBe(false);
    });
  });

  describe("malformed input", () => {
    test("never throws for malformed inputs", () => {
      expect(() => checkRecruitmentWorkflowObservationHealth("bad")).not.toThrow();
      expect(() => checkRecruitmentWorkflowObservationHealth([])).not.toThrow();
      expect(() => hasHealthyRecruitmentWorkflowObservation(42)).not.toThrow();
      expect(() => summarizeRecruitmentWorkflowObservationHealth(Symbol("x"))).not.toThrow();
    });

    test("reports UNKNOWN for non-object outcomes", () => {
      const result = checkRecruitmentWorkflowObservationHealth(null);

      expect(result.status).toBe(OBSERVATION_HEALTH_CHECK_STATUS.UNKNOWN);
      expect(result.available).toBe(false);
      expect(result.contractAvailable).toBe(false);
      expect(result.observationAvailable).toBe(false);
      expect(result.reason).toBe("MALFORMED_OUTCOME");
      expect(hasHealthyRecruitmentWorkflowObservation(null)).toBe(false);
    });

    test("summarizeRecruitmentWorkflowObservationHealth returns empty summary for malformed result", () => {
      expect(summarizeRecruitmentWorkflowObservationHealth(null)).toBe(EMPTY_HEALTH_SUMMARY);
      expect(summarizeRecruitmentWorkflowObservationHealth({ status: "READY" })).toBe(
        EMPTY_HEALTH_SUMMARY
      );
    });
  });

  describe("flag OFF", () => {
    test("reports UNAVAILABLE when integration hook attach was skipped", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1107 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 1107 }));

      attachRecruitmentWorkflowObservationContractIntegration(outcome, disabledInput());

      const result = checkRecruitmentWorkflowObservationHealth(outcome);

      expect(result.status).toBe(OBSERVATION_HEALTH_CHECK_STATUS.UNAVAILABLE);
      expect(result.contractAvailable).toBe(false);
      expect(hasHealthyRecruitmentWorkflowObservation(outcome)).toBe(false);
    });

    test("does not treat Phase 107 attachment store as health signal", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1108 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 1108 }));

      const phase107Contract = attachRecruitmentWorkflowObservationContract(outcome);

      expect(phase107Contract).not.toBeNull();
      expect(peekRecruitmentWorkflowObservationContract(outcome)).toBe(phase107Contract);
      expect(checkRecruitmentWorkflowObservationHealth(outcome).status).toBe(
        OBSERVATION_HEALTH_CHECK_STATUS.UNAVAILABLE
      );
    });
  });

  describe("flag ON", () => {
    test("reports READY after Phase 108 integration attach with complete observation", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1109 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1109 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const result = checkRecruitmentWorkflowObservationHealth(outcome);

      expect(result.status).toBe(OBSERVATION_HEALTH_CHECK_STATUS.READY);
      expect(result.contractAvailable).toBe(true);
      expect(hasHealthyRecruitmentWorkflowObservation(outcome)).toBe(true);
    });

    test("evaluates contract attached via registry-enabled outcome", () => {
      const outcome = { updateId: 1110 };
      recordWorkflowObservation(outcome, {
        featureEnabled: true,
        plannedWorkflow: null,
        diagnostics: {}
      });

      attachRecruitmentWorkflowObservationContractIntegration(
        outcome,
        enabledInput({ updateId: 1110 })
      );

      const result = checkRecruitmentWorkflowObservationHealth(outcome);

      expect(result.contractAvailable).toBe(true);
      expect(result.status).not.toBe(OBSERVATION_HEALTH_CHECK_STATUS.UNAVAILABLE);
    });
  });

  describe("no side effects", () => {
    test("health check API never calls integration hook attach", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1111 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 1111 }));

      checkRecruitmentWorkflowObservationHealth(outcome);
      hasHealthyRecruitmentWorkflowObservation(outcome);
      summarizeRecruitmentWorkflowObservationHealth(
        checkRecruitmentWorkflowObservationHealth(outcome)
      );

      expect(attachRecruitmentWorkflowObservationContractIntegration).not.toHaveBeenCalled();
      expect(peekRecruitmentWorkflowObservationContractIntegration(outcome)).toBeNull();
    });

    test("health check does not populate Phase 107 attachment store", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1112 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 1112 }));

      checkRecruitmentWorkflowObservationHealth(outcome);

      expect(peekRecruitmentWorkflowObservationContract(outcome)).toBeNull();
    });

    test("does not alter existing registry, hook, compatibility, or diagnostics observations", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1113 };
      attachRecruitmentCompatibility(outcome, {
        notice: notice(),
        updateId: 1113,
        featureFlags: { workflowIntegrationEnabled: false }
      });
      attachIntegratedContract(outcome, enabledInput({ updateId: 1113 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const registryBefore = peekWorkflowObservation(outcome);
      const pipelineBefore = peekRecruitmentWorkflowIntegration(outcome);
      const compatibilityBefore = peekRecruitmentCompatibility(outcome);
      const diagnosticsBefore = peekRecruitmentWorkflowDiagnostics(outcome);
      const hookBefore = peekRecruitmentWorkflowObservationContractIntegration(outcome);
      const attachmentBefore = peekRecruitmentWorkflowObservationContract(outcome);

      checkRecruitmentWorkflowObservationHealth(outcome);
      hasHealthyRecruitmentWorkflowObservation(outcome);

      expect(peekWorkflowObservation(outcome)).toBe(registryBefore);
      expect(peekRecruitmentWorkflowIntegration(outcome)).toBe(pipelineBefore);
      expect(peekRecruitmentCompatibility(outcome)).toBe(compatibilityBefore);
      expect(peekRecruitmentWorkflowDiagnostics(outcome)).toBe(diagnosticsBefore);
      expect(peekRecruitmentWorkflowObservationContractIntegration(outcome)).toBe(hookBefore);
      expect(peekRecruitmentWorkflowObservationContract(outcome)).toBe(attachmentBefore);
    });
  });

  describe("no coordinator calls", () => {
    test("health check API does not invoke coordinator", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1114 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1114 }));
      coordinateRecruitmentWorkflowIntegration.mockClear();

      checkRecruitmentWorkflowObservationHealth(outcome);
      hasHealthyRecruitmentWorkflowObservation(outcome);

      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
    });
  });

  describe("deterministic output", () => {
    test("repeated health checks return deeply equal results", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1115 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1115 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const first = checkRecruitmentWorkflowObservationHealth(outcome);
      const second = checkRecruitmentWorkflowObservationHealth(outcome);
      const summaryA = summarizeRecruitmentWorkflowObservationHealth(first);
      const summaryB = summarizeRecruitmentWorkflowObservationHealth(second);

      expect(second).toEqual(first);
      expect(summaryB).toEqual(summaryA);
    });

    test("health fields match consumer summary projection only", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1116 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1116 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const consumerSummary = summarizeRecruitmentWorkflowObservationContract(outcome);
      const result = checkRecruitmentWorkflowObservationHealth(outcome);

      expect(result.lifecycle).toBe(consumerSummary.lifecycle);
      expect(result.health).toBe(consumerSummary.health);
      expect(result.severity).toBe(consumerSummary.severity);
      expect(result.recommendation).toBe(consumerSummary.recommendation);
      expect(result.monitoringRequired).toBe(consumerSummary.monitoringRequired);
      expect(result.workflowCompleted).toBe(consumerSummary.workflowCompleted);
    });
  });

  describe("immutability", () => {
    test("does not mutate the pipeline outcome object", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1117 };
      const before = JSON.stringify(outcome);

      attachIntegratedContract(outcome, enabledInput({ updateId: 1117 }));
      checkRecruitmentWorkflowObservationHealth(outcome);

      expect(JSON.stringify(outcome)).toBe(before);
      expect(outcome).not.toHaveProperty("observation");
      expect(outcome).not.toHaveProperty("contract");
      expect(outcome).not.toHaveProperty("diagnostics");
    });

    test("returns frozen health check results", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1118 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1118 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const result = checkRecruitmentWorkflowObservationHealth(outcome);
      const summary = summarizeRecruitmentWorkflowObservationHealth(result);

      assertAllFrozen(result);
      assertAllFrozen(summary);
      expect(() => {
        result.status = "CHANGED";
      }).toThrow();
    });
  });

  describe("no persistence", () => {
    test("health check metadata declares no persistence or production mutation", () => {
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_METADATA.pipelineWiring).toBe(false);
    });

    test("health check results remain advisory-only with no execution", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 1119 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1119 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const result = checkRecruitmentWorkflowObservationHealth(outcome);

      expect(result.advisory).toBe(true);
      expect(result.architectureOnly).toBe(true);
      expect(result.executed).toBe(false);
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares pure health check constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 111");
      expect(source).toContain("checkRecruitmentWorkflowObservationHealth");
      expect(source).toContain("hasHealthyRecruitmentWorkflowObservation");
      expect(source).toContain("summarizeRecruitmentWorkflowObservationHealth");
      expect(source).toContain("recruitmentWorkflowObservationConsumer");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("healthCheckOnly");
      expect(source).toContain("invokesCoordinator");
      expect(source).toContain("sourcePhase: 110");
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

    test("module reuses Phase 110 consumer only", () => {
      const source = read(MODULE_PATH);
      const requireMatches = source.match(/require\(["'][^"']+["']\)/g) ?? [];

      expect(requireMatches).toEqual([
        'require("./recruitmentWorkflowObservationConsumer")'
      ]);
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

    test("health check module is not wired into coordinator, compatibility layer, registry, worker, observation service, Phase 107 attachment, integration contract, integration hook, consumer attach path, or pipeline", () => {
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

      expect(coordinatorSource).not.toMatch(/recruitmentWorkflowObservationHealthCheck/);
      expect(compatibilitySource).not.toMatch(/recruitmentWorkflowObservationHealthCheck/);
      expect(pipelineSource).not.toMatch(/recruitmentWorkflowObservationHealthCheck/);
      expect(workerSource).not.toMatch(/recruitmentWorkflowObservationHealthCheck/);
      expect(registrySource).not.toMatch(/recruitmentWorkflowObservationHealthCheck/);
      expect(observationServiceSource).not.toMatch(/recruitmentWorkflowObservationHealthCheck/);
      expect(attachmentSource).not.toMatch(/recruitmentWorkflowObservationHealthCheck/);
      expect(integrationContractSource).not.toMatch(/recruitmentWorkflowObservationHealthCheck/);
      expect(hookSource).not.toMatch(/recruitmentWorkflowObservationHealthCheck/);
      expect(consumerSource).not.toMatch(/recruitmentWorkflowObservationHealthCheck/);
    });
  });
});
