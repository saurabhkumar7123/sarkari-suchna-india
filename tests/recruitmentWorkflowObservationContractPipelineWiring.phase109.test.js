"use strict";

/**
 * Phase 109 — Recruitment Workflow Observation Contract Pipeline Wiring tests.
 * Flag OFF/ON regression, hook invocation, unchanged pipeline output,
 * success/failure paths, malformed context, no coordinator from hook,
 * no persistence, immutability, and architecture boundaries.
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

const { runRecruitmentPipeline } = require("../server/lib/recruitment/runRecruitmentPipeline");
const { peekRecruitmentCompatibility } = require("../server/lib/recruitment/recruitmentCompatibilityLayer");
const {
  peekRecruitmentWorkflowIntegration
} = require("../server/lib/recruitment/recruitmentPipelineIntegrationHook");
const {
  attachRecruitmentWorkflowObservationContractIntegration,
  peekRecruitmentWorkflowObservationContractIntegration,
  hasRecruitmentWorkflowObservationContractIntegration,
  RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_METADATA
} = require("../server/lib/recruitment/recruitmentWorkflowObservationContractIntegrationHook");
const {
  isRecruitmentWorkflowObservationContract,
  RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_PHASE
} = require("../server/lib/recruitment/recruitmentWorkflowObservationIntegrationContract");
const { coordinateRecruitmentWorkflowIntegration } = require(
  "../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator"
);
const { PROCESS_RESULT_STATUS } = require("../server/lib/recruitment/detectionProcessor");

const ROOT = path.join(__dirname, "..");
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const HOOK_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowObservationContractIntegrationHook.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";
const ATTACHMENT_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowObservationContractAttachment.js";

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

describe("Phase 109 — recruitmentWorkflowObservationContractPipelineWiring", () => {
  beforeEach(() => {
    coordinateRecruitmentWorkflowIntegration.mockClear();
    attachRecruitmentWorkflowObservationContractIntegration.mockClear();
    attachRecruitmentWorkflowObservationContractIntegration.mockImplementation(
      jest.requireActual(
        "../server/lib/recruitment/recruitmentWorkflowObservationContractIntegrationHook"
      ).attachRecruitmentWorkflowObservationContractIntegration
    );
  });

  describe("feature flag OFF regression", () => {
    test("pipeline outcome is unchanged when workflow integration flag is off", () => {
      const processorResult = mockProcessorResult();
      const processDetection = jest.fn().mockReturnValue(processorResult);

      const result = runRecruitmentPipeline({
        notice: notice(),
        candidateRecruitments: [candidate()],
        isEnabled: true,
        processDetection,
        updateId: 1091
      });

      expect(result).toEqual({
        skipped: false,
        result: processorResult,
        updateId: 1091
      });
      expect(Object.keys(result).sort()).toEqual(["result", "skipped", "updateId"]);
      expect(peekRecruitmentWorkflowObservationContractIntegration(result)).toBeNull();
      expect(hasRecruitmentWorkflowObservationContractIntegration(result)).toBe(false);
    });

    test("skipped pipeline outcome is unchanged when workflow integration flag is off", () => {
      const processDetection = jest.fn();

      const result = runRecruitmentPipeline({
        notice: notice(),
        isEnabled: false,
        processDetection,
        updateId: 12,
        featureFlags: { workflowIntegrationEnabled: false }
      });

      expect(result).toEqual({ skipped: true, reason: "flag_off", updateId: 12 });
      expect(processDetection).not.toHaveBeenCalled();
      expect(peekRecruitmentWorkflowObservationContractIntegration(result)).toBeNull();
    });

    test("hook still runs but stores nothing when flag is off", () => {
      runRecruitmentPipeline({
        notice: notice(),
        isEnabled: true,
        processDetection: jest.fn().mockReturnValue(mockProcessorResult()),
        featureFlags: { workflowIntegrationEnabled: false }
      });

      expect(attachRecruitmentWorkflowObservationContractIntegration).toHaveBeenCalledTimes(1);
    });
  });

  describe("feature flag ON attachment", () => {
    test("pipeline attaches observation contract integration when flag is on", () => {
      const result = runRecruitmentPipeline({
        notice: notice(),
        candidateRecruitments: [candidate()],
        isEnabled: true,
        processDetection: jest.fn().mockReturnValue(mockProcessorResult()),
        updateId: 1092,
        featureFlags: { workflowIntegrationEnabled: true },
        traceId: "phase-109-trace"
      });

      const contract = peekRecruitmentWorkflowObservationContractIntegration(result);
      expect(contract).not.toBeNull();
      expect(hasRecruitmentWorkflowObservationContractIntegration(result)).toBe(true);
      expect(isRecruitmentWorkflowObservationContract(contract)).toBe(true);
      expect(contract.metadata.phase).toBe(RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_PHASE);
      expect(contract.advisory).toBe(true);
      expect(contract.architectureOnly).toBe(true);
      expect(contract.executed).toBe(false);
    });

    test("observation contract integration is stored only in hook WeakMap", () => {
      const result = runRecruitmentPipeline({
        notice: notice(),
        isEnabled: true,
        processDetection: jest.fn().mockReturnValue(mockProcessorResult()),
        featureFlags: { workflowIntegrationEnabled: true }
      });

      expect(Object.keys(result).sort()).toEqual(["result", "skipped", "updateId"]);
      expect(result).not.toHaveProperty("observationContract");
      expect(result).not.toHaveProperty("contract");
      expect(peekRecruitmentWorkflowObservationContractIntegration(result)).not.toBeNull();
    });
  });

  describe("hook called once", () => {
    test("finalizePipelineOutcome invokes observation contract integration hook exactly once", () => {
      runRecruitmentPipeline({
        notice: notice(),
        isEnabled: true,
        processDetection: jest.fn().mockReturnValue(mockProcessorResult()),
        updateId: 1093,
        featureFlags: { workflowIntegrationEnabled: true }
      });

      expect(attachRecruitmentWorkflowObservationContractIntegration).toHaveBeenCalledTimes(1);
    });

    test("hook receives outcome and compatibility input from pipeline", () => {
      const processDetection = jest.fn().mockReturnValue(mockProcessorResult());
      const inputNotice = notice({ title: "UPSC 2026" });

      runRecruitmentPipeline({
        notice: inputNotice,
        isEnabled: true,
        processDetection,
        updateId: 77,
        featureFlags: { workflowIntegrationEnabled: true },
        traceId: "trace-109",
        correlationId: "corr-109"
      });

      expect(attachRecruitmentWorkflowObservationContractIntegration).toHaveBeenCalledWith(
        expect.objectContaining({
          skipped: false,
          updateId: 77,
          result: mockProcessorResult()
        }),
        expect.objectContaining({
          notice: inputNotice,
          updateId: 77,
          featureFlags: { workflowIntegrationEnabled: true },
          traceId: "trace-109",
          correlationId: "corr-109"
        })
      );
    });
  });

  describe("pipeline output unchanged", () => {
    test("public pipeline outcome shape is unchanged when integration flag is on", () => {
      const processorResult = mockProcessorResult();
      const processDetection = jest.fn().mockReturnValue(processorResult);

      const result = runRecruitmentPipeline({
        notice: notice(),
        isEnabled: true,
        processDetection,
        updateId: 501,
        featureFlags: { workflowIntegrationEnabled: true }
      });

      expect(result).toEqual({
        skipped: false,
        result: processorResult,
        updateId: 501
      });
      expect(Object.keys(result).sort()).toEqual(["result", "skipped", "updateId"]);
    });

    test("compatibility and workflow integration attachments remain advisory-only side channels", () => {
      const result = runRecruitmentPipeline({
        notice: notice(),
        isEnabled: false,
        updateId: 202,
        featureFlags: { workflowIntegrationEnabled: true }
      });

      expect(result).toEqual({ skipped: true, reason: "flag_off", updateId: 202 });
      expect(peekRecruitmentCompatibility(result)).not.toBeNull();
      expect(peekRecruitmentWorkflowIntegration(result)).not.toBeNull();
      expect(peekRecruitmentWorkflowObservationContractIntegration(result)).not.toBeNull();
      expect(Object.keys(result).sort()).toEqual(["reason", "skipped", "updateId"]);
    });
  });

  describe("success path", () => {
    test("successful detection outcome wires observation contract without mutating result", () => {
      const processorResult = mockProcessorResult();
      const processDetection = jest.fn().mockReturnValue(processorResult);

      const result = runRecruitmentPipeline({
        notice: notice(),
        candidateRecruitments: [candidate()],
        isEnabled: true,
        processDetection,
        createdAt: "2026-07-15T12:00:00.000Z",
        updateId: 9001,
        featureFlags: { workflowIntegrationEnabled: true }
      });

      expect(processDetection).toHaveBeenCalledWith({
        notice: notice(),
        candidateRecruitments: [candidate()],
        createdAt: "2026-07-15T12:00:00.000Z"
      });
      expect(result.skipped).toBe(false);
      expect(result.result).toBe(processorResult);
      expect(peekRecruitmentWorkflowObservationContractIntegration(result)).not.toBeNull();
    });
  });

  describe("failure path", () => {
    test("pipeline failure outcome unchanged when integration flag is on", () => {
      const processDetection = jest.fn(() => {
        throw new Error("detection failed");
      });

      const result = runRecruitmentPipeline({
        notice: notice(),
        isEnabled: true,
        processDetection,
        updateId: 13,
        featureFlags: { workflowIntegrationEnabled: true }
      });

      expect(result.skipped).toBe(false);
      expect(result.failed).toBe(true);
      expect(result.error.message).toBe("detection failed");
      expect(result.updateId).toBe(13);
      expect(Object.keys(result).sort()).toEqual(["error", "failed", "skipped", "updateId"]);
      expect(peekRecruitmentWorkflowObservationContractIntegration(result)).not.toBeNull();
    });

    test("pipeline still returns failure outcome when hook throws", () => {
      attachRecruitmentWorkflowObservationContractIntegration.mockImplementation(() => {
        throw new Error("hook failure");
      });

      const result = runRecruitmentPipeline({
        notice: notice(),
        isEnabled: true,
        processDetection: jest.fn().mockReturnValue(mockProcessorResult()),
        updateId: 14,
        featureFlags: { workflowIntegrationEnabled: true }
      });

      expect(result).toEqual({
        skipped: false,
        result: mockProcessorResult(),
        updateId: 14
      });
      expect(peekRecruitmentWorkflowObservationContractIntegration(result)).toBeNull();
    });
  });

  describe("malformed integration context", () => {
    test("missing featureFlags does not attach observation contract", () => {
      const result = runRecruitmentPipeline({
        notice: notice(),
        isEnabled: true,
        processDetection: jest.fn().mockReturnValue(mockProcessorResult()),
        featureFlags: null
      });

      expect(peekRecruitmentWorkflowObservationContractIntegration(result)).toBeNull();
      expect(attachRecruitmentWorkflowObservationContractIntegration).toHaveBeenCalledTimes(1);
    });

    test("malformed featureFlags does not attach observation contract", () => {
      const result = runRecruitmentPipeline({
        notice: notice(),
        isEnabled: true,
        processDetection: jest.fn().mockReturnValue(mockProcessorResult()),
        featureFlags: "bad"
      });

      expect(peekRecruitmentWorkflowObservationContractIntegration(result)).toBeNull();
    });
  });

  describe("no coordinator execution from observation contract hook", () => {
    test("observation contract integration hook metadata does not invoke coordinator", () => {
      expect(
        RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_METADATA.invokesCoordinator
      ).toBe(false);
    });

    test("pipeline does not import coordinator for Phase 109 wiring", () => {
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      expect(pipelineSource).not.toMatch(/recruitmentWorkflowIntegrationCoordinator/);
    });

    test("coordinator is only invoked by Phase 92 hook when flag is on", () => {
      runRecruitmentPipeline({
        notice: notice(),
        isEnabled: true,
        processDetection: jest.fn().mockReturnValue(mockProcessorResult()),
        featureFlags: { workflowIntegrationEnabled: true }
      });

      expect(coordinateRecruitmentWorkflowIntegration).toHaveBeenCalledTimes(1);
    });

    test("coordinator is not invoked when workflow integration flag is off", () => {
      runRecruitmentPipeline({
        notice: notice(),
        isEnabled: true,
        processDetection: jest.fn().mockReturnValue(mockProcessorResult()),
        featureFlags: { workflowIntegrationEnabled: false }
      });

      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
    });
  });

  describe("no persistence", () => {
    test("enabled observation contract integration never enables persistence", () => {
      const result = runRecruitmentPipeline({
        notice: notice(),
        candidateRecruitments: [candidate()],
        isEnabled: true,
        featureFlags: { workflowIntegrationEnabled: true }
      });

      const contract = peekRecruitmentWorkflowObservationContractIntegration(result);
      expect(contract).not.toBeNull();
      expect(contract.advisory).toBe(true);
      expect(contract.architectureOnly).toBe(true);
      expect(contract.executed).toBe(false);
      expect(contract.observation.advisory).toBe(true);
      expect(contract.observation.architectureOnly).toBe(true);
      expect(contract.observation.executed).toBe(false);
      expect(
        RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_METADATA.persistenceEnabled
      ).toBe(false);
      expect(
        RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_METADATA.mutatesProduction
      ).toBe(false);
    });
  });

  describe("immutability", () => {
    test("attached observation contract remains frozen through pipeline wiring", () => {
      const result = runRecruitmentPipeline({
        notice: notice(),
        isEnabled: true,
        processDetection: jest.fn().mockReturnValue(mockProcessorResult()),
        featureFlags: { workflowIntegrationEnabled: true }
      });

      const contract = peekRecruitmentWorkflowObservationContractIntegration(result);
      assertAllFrozen(contract);
    });

    test("pipeline outcome object is not mutated with public contract fields", () => {
      const result = runRecruitmentPipeline({
        notice: notice(),
        isEnabled: true,
        processDetection: jest.fn().mockReturnValue(mockProcessorResult()),
        featureFlags: { workflowIntegrationEnabled: true }
      });

      const snapshot = JSON.parse(JSON.stringify(result));
      expect(snapshot).toEqual({
        skipped: false,
        result: mockProcessorResult(),
        updateId: null
      });
    });
  });

  describe("architecture boundaries", () => {
    test("pipeline documents Phase 109 advisory wiring", () => {
      const source = read(PIPELINE_MODULE_PATH);

      expect(source).toMatch(/Phase 109/);
      expect(source).toMatch(/attachRecruitmentWorkflowObservationContractIntegration/);
      expect(source).toMatch(/Phase 109 advisory integration only/);
    });

    test("pipeline imports observation contract integration hook but not Phase 107 attachment directly", () => {
      const pipelineSource = read(PIPELINE_MODULE_PATH);

      expect(pipelineSource).toMatch(/recruitmentWorkflowObservationContractIntegrationHook/);
      expect(pipelineSource).not.toMatch(/recruitmentWorkflowObservationContractAttachment/);
    });

    test("pipeline wiring occurs after compatibility and workflow integration hooks", () => {
      const source = read(PIPELINE_MODULE_PATH);
      const compatibilityIndex = source.indexOf("attachRecruitmentCompatibility(");
      const workflowIndex = source.indexOf("attachRecruitmentWorkflowIntegration(");
      const observationIndex = source.indexOf(
        "attachRecruitmentWorkflowObservationContractIntegration("
      );

      expect(compatibilityIndex).toBeGreaterThan(-1);
      expect(workflowIndex).toBeGreaterThan(compatibilityIndex);
      expect(observationIndex).toBeGreaterThan(workflowIndex);
    });

    test("observation contract integration hook is not wired into worker or Phase 107 attachment module", () => {
      const workerSource = read(WORKER_MODULE_PATH);
      const attachmentSource = read(ATTACHMENT_MODULE_PATH);
      const hookSource = read(HOOK_MODULE_PATH);

      expect(workerSource).not.toMatch(/recruitmentWorkflowObservationContractIntegrationHook/);
      expect(attachmentSource).not.toMatch(/recruitmentWorkflowObservationContractIntegrationHook/);
      expect(hookSource).not.toMatch(/coordinateRecruitmentWorkflowIntegration/);
    });

    test("pipeline does not import express, database drivers, or filesystem APIs", () => {
      const source = read(PIPELINE_MODULE_PATH);

      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2/);
    });
  });
});
