"use strict";

/**
 * Phase 110 — Recruitment Workflow Observation Consumer API tests.
 * Contract exists/missing, flag OFF/ON, no attachment side effects,
 * no coordinator calls, malformed outcome, determinism, immutability,
 * WeakMap read-only behavior, and architecture boundaries.
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
  RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_PHASE,
  RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_ENTITY,
  RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_METADATA,
  EMPTY_CONSUMER_SUMMARY,
  getRecruitmentWorkflowObservationContract,
  hasRecruitmentWorkflowObservationContract,
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
  RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_PHASE,
  EXPECTED_CONTRACT_KEYS,
  buildRecruitmentWorkflowObservationContract,
  isRecruitmentWorkflowObservationContract
} = require("../server/lib/recruitment/recruitmentWorkflowObservationIntegrationContract");

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
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowObservationConsumer.js";
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
    updateId: 110,
    featureFlags: { workflowIntegrationEnabled: true },
    traceId: "phase-110-trace",
    ...overrides
  };
}

function disabledInput(overrides = {}) {
  return {
    notice: notice(),
    updateId: 110,
    featureFlags: { workflowIntegrationEnabled: false },
    traceId: "phase-110-trace",
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

describe("Phase 110 — recruitmentWorkflowObservationConsumer", () => {
  beforeEach(() => {
    coordinateRecruitmentWorkflowIntegration.mockClear();
    attachRecruitmentWorkflowObservationContractIntegration.mockClear();
  });

  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_PHASE).toBe(110);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_ENTITY).toBe(
        "recruitment_workflow_observation_consumer"
      );
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_DESCRIPTOR.phase).toBe(110);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_METADATA.consumerOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_METADATA.invokesCoordinator).toBe(false);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_METADATA.rebuildsContracts).toBe(false);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_METADATA.pipelineWiring).toBe(false);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_METADATA.sourcePhase).toBe(108);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_METADATA.persistenceEnabled).toBe(false);
    });
  });

  describe("contract missing", () => {
    test("returns null and false when no integration contract is attached", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 901 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 901 }));

      expect(getRecruitmentWorkflowObservationContract(outcome)).toBeNull();
      expect(hasRecruitmentWorkflowObservationContract(outcome)).toBe(false);
      expect(summarizeRecruitmentWorkflowObservationContract(outcome)).toBe(EMPTY_CONSUMER_SUMMARY);
    });

    test("returns empty summary fields when contract is unavailable", () => {
      const summary = summarizeRecruitmentWorkflowObservationContract({ updateId: 902 });

      expect(summary).toEqual({
        lifecycle: "UNKNOWN",
        health: "UNKNOWN",
        severity: DIAGNOSTICS_SEVERITY.UNKNOWN,
        recommendation: null,
        monitoringRequired: null,
        workflowCompleted: null
      });
      expect(Object.isFrozen(summary)).toBe(true);
    });
  });

  describe("contract exists", () => {
    test("returns attached Phase 106 contract from Phase 108 hook store", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 903 };
      const contract = attachIntegratedContract(outcome, enabledInput({ updateId: 903 }));

      expect(getRecruitmentWorkflowObservationContract(outcome)).toBe(contract);
      expect(hasRecruitmentWorkflowObservationContract(outcome)).toBe(true);
      expect(isRecruitmentWorkflowObservationContract(contract)).toBe(true);
      expect(contract.metadata.phase).toBe(RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_PHASE);
      expect(Object.keys(contract).sort()).toEqual([...EXPECTED_CONTRACT_KEYS].sort());
    });

    test("summarizes diagnostics fields from attached contract without recomputation", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 904 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 904 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const contract = getRecruitmentWorkflowObservationContract(outcome);
      const diagnostics = contract.observation.diagnostics;
      const summary = summarizeRecruitmentWorkflowObservationContract(outcome);

      expect(summary).toEqual({
        lifecycle: diagnostics.lifecycle,
        health: diagnostics.health,
        severity: diagnostics.severity,
        recommendation: diagnostics.recommendation,
        monitoringRequired: diagnostics.monitoringRequired,
        workflowCompleted: diagnostics.workflowCompleted
      });
      expect(typeof summary.monitoringRequired).toBe("boolean");
      expect(typeof summary.workflowCompleted).toBe("boolean");
    });
  });

  describe("flag OFF", () => {
    test("consumer sees no contract when integration hook attach was skipped", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 905 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 905 }));

      attachRecruitmentWorkflowObservationContractIntegration(outcome, disabledInput());

      expect(getRecruitmentWorkflowObservationContract(outcome)).toBeNull();
      expect(hasRecruitmentWorkflowObservationContract(outcome)).toBe(false);
      expect(summarizeRecruitmentWorkflowObservationContract(outcome)).toBe(EMPTY_CONSUMER_SUMMARY);
    });

    test("consumer does not read Phase 107 attachment store directly", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 906 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 906 }));

      const phase107Contract = attachRecruitmentWorkflowObservationContract(outcome);

      expect(phase107Contract).not.toBeNull();
      expect(peekRecruitmentWorkflowObservationContract(outcome)).toBe(phase107Contract);
      expect(getRecruitmentWorkflowObservationContract(outcome)).toBeNull();
      expect(hasRecruitmentWorkflowObservationContract(outcome)).toBe(false);
    });
  });

  describe("flag ON", () => {
    test("consumer reads contract after Phase 108 integration attach", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 907 };
      const contract = attachIntegratedContract(outcome, enabledInput({ updateId: 907 }));

      expect(getRecruitmentWorkflowObservationContract(outcome)).toBe(contract);
      expect(hasRecruitmentWorkflowObservationContract(outcome)).toBe(true);
    });

    test("wraps complete observation bundle from integrated attach path", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 908 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 908 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const expectedContract = buildRecruitmentWorkflowObservationContract(outcome);
      attachRecruitmentWorkflowObservationContractIntegration(
        outcome,
        enabledInput({ updateId: 908 })
      );
      const consumed = getRecruitmentWorkflowObservationContract(outcome);

      expect(consumed).toEqual(expectedContract);
      expect(consumed.observation.snapshot).not.toBeNull();
      expect(consumed.observation.attachment).not.toBeNull();
      expect(consumed.observation.observation.status).toBe(OBSERVATION_VIEW_STATUS.READY);
    });

    test("consumer reads contract attached via registry-enabled outcome", () => {
      const outcome = { updateId: 909 };
      recordWorkflowObservation(outcome, {
        featureEnabled: true,
        plannedWorkflow: null,
        diagnostics: {}
      });

      attachRecruitmentWorkflowObservationContractIntegration(
        outcome,
        enabledInput({ updateId: 909 })
      );

      expect(getRecruitmentWorkflowObservationContract(outcome)).not.toBeNull();
      expect(hasRecruitmentWorkflowObservationContract(outcome)).toBe(true);
    });
  });

  describe("no attachment side effects", () => {
    test("consumer API never calls integration hook attach", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 910 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 910 }));

      getRecruitmentWorkflowObservationContract(outcome);
      hasRecruitmentWorkflowObservationContract(outcome);
      summarizeRecruitmentWorkflowObservationContract(outcome);

      expect(attachRecruitmentWorkflowObservationContractIntegration).not.toHaveBeenCalled();
      expect(peekRecruitmentWorkflowObservationContractIntegration(outcome)).toBeNull();
    });

    test("consumer API does not populate Phase 107 attachment store", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 911 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 911 }));

      getRecruitmentWorkflowObservationContract(outcome);
      hasRecruitmentWorkflowObservationContract(outcome);
      summarizeRecruitmentWorkflowObservationContract(outcome);

      expect(peekRecruitmentWorkflowObservationContract(outcome)).toBeNull();
    });

    test("does not alter existing registry, hook, compatibility, or diagnostics observations", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 912 };
      attachRecruitmentCompatibility(outcome, {
        notice: notice(),
        updateId: 912,
        featureFlags: { workflowIntegrationEnabled: false }
      });
      attachIntegratedContract(outcome, enabledInput({ updateId: 912 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const registryBefore = peekWorkflowObservation(outcome);
      const pipelineBefore = peekRecruitmentWorkflowIntegration(outcome);
      const compatibilityBefore = peekRecruitmentCompatibility(outcome);
      const diagnosticsBefore = peekRecruitmentWorkflowDiagnostics(outcome);
      const hookBefore = peekRecruitmentWorkflowObservationContractIntegration(outcome);
      const attachmentBefore = peekRecruitmentWorkflowObservationContract(outcome);

      getRecruitmentWorkflowObservationContract(outcome);
      hasRecruitmentWorkflowObservationContract(outcome);
      summarizeRecruitmentWorkflowObservationContract(outcome);

      expect(peekWorkflowObservation(outcome)).toBe(registryBefore);
      expect(peekRecruitmentWorkflowIntegration(outcome)).toBe(pipelineBefore);
      expect(peekRecruitmentCompatibility(outcome)).toBe(compatibilityBefore);
      expect(peekRecruitmentWorkflowDiagnostics(outcome)).toBe(diagnosticsBefore);
      expect(peekRecruitmentWorkflowObservationContractIntegration(outcome)).toBe(hookBefore);
      expect(peekRecruitmentWorkflowObservationContract(outcome)).toBe(attachmentBefore);
    });
  });

  describe("no coordinator calls", () => {
    test("consumer API does not invoke coordinator", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 913 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 913 }));
      coordinateRecruitmentWorkflowIntegration.mockClear();

      getRecruitmentWorkflowObservationContract(outcome);
      hasRecruitmentWorkflowObservationContract(outcome);
      summarizeRecruitmentWorkflowObservationContract(outcome);

      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
    });
  });

  describe("malformed outcome", () => {
    test("never throws for malformed inputs", () => {
      expect(() => getRecruitmentWorkflowObservationContract("bad")).not.toThrow();
      expect(() => getRecruitmentWorkflowObservationContract([])).not.toThrow();
      expect(() => hasRecruitmentWorkflowObservationContract(42)).not.toThrow();
      expect(() => summarizeRecruitmentWorkflowObservationContract(Symbol("x"))).not.toThrow();
    });

    test("returns null, false, and empty summary for non-object outcomes", () => {
      expect(getRecruitmentWorkflowObservationContract(null)).toBeNull();
      expect(getRecruitmentWorkflowObservationContract(undefined)).toBeNull();
      expect(getRecruitmentWorkflowObservationContract("bad")).toBeNull();
      expect(hasRecruitmentWorkflowObservationContract(null)).toBe(false);
      expect(summarizeRecruitmentWorkflowObservationContract(null)).toBe(EMPTY_CONSUMER_SUMMARY);
    });
  });

  describe("deterministic output", () => {
    test("repeated reads return the same contract reference and summary", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 914 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 914 }));

      const first = getRecruitmentWorkflowObservationContract(outcome);
      const second = getRecruitmentWorkflowObservationContract(outcome);
      const summaryA = summarizeRecruitmentWorkflowObservationContract(outcome);
      const summaryB = summarizeRecruitmentWorkflowObservationContract(outcome);

      expect(second).toBe(first);
      expect(summaryB).toEqual(summaryA);
    });

    test("summary matches stored diagnostics projection only", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 915 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 915 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const contract = getRecruitmentWorkflowObservationContract(outcome);
      const diagnostics = contract.observation.diagnostics;

      expect(summarizeRecruitmentWorkflowObservationContract(outcome)).toEqual({
        lifecycle: diagnostics.lifecycle,
        health: diagnostics.health,
        severity: diagnostics.severity,
        recommendation: diagnostics.recommendation,
        monitoringRequired: diagnostics.monitoringRequired,
        workflowCompleted: diagnostics.workflowCompleted
      });
    });
  });

  describe("immutability", () => {
    test("does not mutate the pipeline outcome object", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 916 };
      const before = JSON.stringify(outcome);

      attachIntegratedContract(outcome, enabledInput({ updateId: 916 }));
      getRecruitmentWorkflowObservationContract(outcome);
      summarizeRecruitmentWorkflowObservationContract(outcome);

      expect(JSON.stringify(outcome)).toBe(before);
      expect(outcome).not.toHaveProperty("observation");
      expect(outcome).not.toHaveProperty("contract");
      expect(outcome).not.toHaveProperty("diagnostics");
    });

    test("returns frozen summary objects", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 917 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 917 }));

      const summary = summarizeRecruitmentWorkflowObservationContract(outcome);

      assertAllFrozen(summary);
      expect(() => {
        summary.lifecycle = "CHANGED";
      }).toThrow();
    });

    test("returned contract remains the frozen integrated object graph", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 918 };
      attachIntegratedContract(outcome, enabledInput({ updateId: 918 }));

      const contract = getRecruitmentWorkflowObservationContract(outcome);

      assertAllFrozen(contract);
      expect(() => {
        contract.advisory = false;
      }).toThrow();
    });
  });

  describe("WeakMap read-only behavior", () => {
    test("isolates consumed contracts per outcome object", () => {
      const outcomeA = { skipped: false, result: mockProcessorResult(), updateId: 919 };
      const outcomeB = { skipped: false, result: mockProcessorResult(), updateId: 920 };

      attachIntegratedContract(outcomeA, enabledInput({ updateId: 919 }));
      attachIntegratedContract(outcomeB, enabledInput({ updateId: 920 }));

      expect(getRecruitmentWorkflowObservationContract(outcomeA)).not.toBeNull();
      expect(getRecruitmentWorkflowObservationContract(outcomeB)).not.toBeNull();
      expect(getRecruitmentWorkflowObservationContract(outcomeA)).not.toBe(
        getRecruitmentWorkflowObservationContract(outcomeB)
      );
    });

    test("peek returns null until integration attach populates hook WeakMap", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 921 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 921 }));

      expect(getRecruitmentWorkflowObservationContract(outcome)).toBeNull();

      const contract = attachRecruitmentWorkflowObservationContractIntegration(
        outcome,
        enabledInput({ updateId: 921 })
      );

      expect(getRecruitmentWorkflowObservationContract(outcome)).toBe(contract);
    });
  });

  describe("no persistence", () => {
    test("consumer metadata declares no persistence or production mutation", () => {
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_METADATA.pipelineWiring).toBe(false);
    });

    test("consumed contract remains advisory-only with no execution", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 922 };
      const contract = attachIntegratedContract(outcome, enabledInput({ updateId: 922 }));

      expect(contract.advisory).toBe(true);
      expect(contract.architectureOnly).toBe(true);
      expect(contract.executed).toBe(false);
      expect(contract.observation.advisory).toBe(true);
      expect(contract.observation.architectureOnly).toBe(true);
      expect(contract.observation.executed).toBe(false);
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares pure consumer constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 110");
      expect(source).toContain("getRecruitmentWorkflowObservationContract");
      expect(source).toContain("hasRecruitmentWorkflowObservationContract");
      expect(source).toContain("summarizeRecruitmentWorkflowObservationContract");
      expect(source).toContain("peekRecruitmentWorkflowObservationContractIntegration");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("consumerOnly");
      expect(source).toContain("invokesCoordinator");
      expect(source).toContain("sourcePhase: 108");
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

    test("module reuses Phase 108 peek integration hook only", () => {
      const source = read(MODULE_PATH);

      expect(source).toMatch(/recruitmentWorkflowObservationContractIntegrationHook/);
      expect(source).toMatch(/peekRecruitmentWorkflowObservationContractIntegration/);
      expect(source).not.toMatch(/attachRecruitmentWorkflowObservationContractIntegration/);
      expect(source).not.toMatch(/recruitmentWorkflowObservationContractAttachment/);
      expect(source).not.toMatch(/recruitmentWorkflowObservationIntegrationContract/);
      expect(source).not.toMatch(/buildRecruitmentWorkflowObservationContract/);
      expect(source).not.toMatch(/recruitmentWorkflowObservationService/);
      expect(source).not.toMatch(/getRecruitmentWorkflowObservation\(/);
      expect(source).not.toMatch(/recruitmentWorkflowObservationView/);
      expect(source).not.toMatch(/recruitmentWorkflowObservationDiagnosticsAdapter/);
      expect(source).not.toMatch(/recruitmentWorkflowDiagnosticsAttachment/);
      expect(source).not.toMatch(/attachRecruitmentWorkflowDiagnostics/);
    });

    test("module does not invoke coordinator, rebuild snapshots, or modify diagnostics", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/coordinateRecruitmentWorkflowIntegration/);
      expect(source).not.toMatch(/getOrCreateWorkflowObservation/);
      expect(source).not.toMatch(/buildRecruitmentWorkflowAdvisorySnapshot/);
      expect(source).not.toMatch(/attachRecruitmentWorkflowIntegration/);
      expect(source).not.toMatch(/attachRecruitmentCompatibilityIntegration/);
      expect(source).not.toMatch(/buildRecruitmentWorkflowObservationView/);
      expect(source).not.toMatch(/buildRecruitmentWorkflowObservationDiagnostics/);
      expect(source).not.toMatch(/appendExecutionStage/);
      expect(source).not.toMatch(/recordWorkflowObservation/);
    });

    test("consumer module is not wired into coordinator, compatibility layer, registry, worker, observation service, Phase 107 attachment, integration contract, integration hook attach path, or pipeline", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const compatibilitySource = read(COMPATIBILITY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const registrySource = read(REGISTRY_MODULE_PATH);
      const observationServiceSource = read(OBSERVATION_SERVICE_MODULE_PATH);
      const attachmentSource = read(ATTACHMENT_MODULE_PATH);
      const integrationContractSource = read(INTEGRATION_CONTRACT_MODULE_PATH);
      const hookSource = read(HOOK_MODULE_PATH);

      expect(coordinatorSource).not.toMatch(/recruitmentWorkflowObservationConsumer/);
      expect(compatibilitySource).not.toMatch(/recruitmentWorkflowObservationConsumer/);
      expect(pipelineSource).not.toMatch(/recruitmentWorkflowObservationConsumer/);
      expect(workerSource).not.toMatch(/recruitmentWorkflowObservationConsumer/);
      expect(registrySource).not.toMatch(/recruitmentWorkflowObservationConsumer/);
      expect(observationServiceSource).not.toMatch(/recruitmentWorkflowObservationConsumer/);
      expect(attachmentSource).not.toMatch(/recruitmentWorkflowObservationConsumer/);
      expect(integrationContractSource).not.toMatch(/recruitmentWorkflowObservationConsumer/);
      expect(hookSource).not.toMatch(/recruitmentWorkflowObservationConsumer/);
    });
  });
});
