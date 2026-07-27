"use strict";

/**
 * Phase 92 — Recruitment Pipeline Integration Hook tests.
 * Flag OFF/ON, coordinator invocation, unchanged pipeline output,
 * advisory diagnostics, no persistence, production behavior regression.
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

const {
  PIPELINE_INTEGRATION_HOOK_PHASE,
  PIPELINE_INTEGRATION_ENTITY,
  PIPELINE_INTEGRATION_METADATA,
  PIPELINE_INTEGRATION_DESCRIPTOR,
  isWorkflowIntegrationFlagEnabled,
  attachRecruitmentPipelineDiagnostics,
  peekRecruitmentPipelineDiagnostics,
  attachRecruitmentWorkflowIntegration,
  peekRecruitmentWorkflowIntegration
} = require("../server/lib/recruitment/recruitmentPipelineIntegrationHook");

const {
  WORKFLOW_INTEGRATION_COORDINATOR_PHASE,
  WORKFLOW_INTEGRATION_FLAG_ID,
  INTEGRATION_STATES,
  coordinateRecruitmentWorkflowIntegration
} = require("../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator");

const { runRecruitmentPipeline } = require("../server/lib/recruitment/runRecruitmentPipeline");
const { peekRecruitmentCompatibility } = require("../server/lib/recruitment/recruitmentCompatibilityLayer");
const { PROCESS_RESULT_STATUS } = require("../server/lib/recruitment/detectionProcessor");
const {
  DIAGNOSTIC_STAGE_TYPES,
  createExecutionTrace,
  appendExecutionStage
} = require("../server/lib/recruitment/executionDiagnostics");

const ROOT = path.join(__dirname, "..");
const HOOK_MODULE_PATH = "server/lib/recruitment/recruitmentPipelineIntegrationHook.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";
const COMPATIBILITY_MODULE_PATH = "server/lib/recruitment/recruitmentCompatibilityLayer.js";

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

function seedOpenDiagnostics(pipelineOutcome) {
  let trace = createExecutionTrace({
    traceId: "seed-trace",
    correlationId: "seed-correlation",
    pipelineRunId: "seed-run",
    contextId: "seed-context"
  });
  const appended = appendExecutionStage(trace, {
    stageType: DIAGNOSTIC_STAGE_TYPES.CONTEXT,
    message: "Existing pipeline diagnostics",
    detail: { seeded: true }
  });
  trace = appended.trace;

  return attachRecruitmentPipelineDiagnostics(pipelineOutcome, {
    trace: {
      traceId: trace.traceId,
      status: trace.status,
      stageCount: trace.stages.length,
      architectureOnly: true,
      executed: false,
      advisory: true
    },
    fullTrace: trace,
    architectureOnly: true,
    observationOnly: true,
    source: "seed"
  });
}

function attachRecruitmentCompatibilityForTest(outcome) {
  const { attachRecruitmentCompatibility } = require("../server/lib/recruitment/recruitmentCompatibilityLayer");
  attachRecruitmentCompatibility(outcome, { notice: notice(), updateId: outcome.updateId });
}

describe("Phase 92 — recruitmentPipelineIntegrationHook", () => {
  beforeEach(() => {
    coordinateRecruitmentWorkflowIntegration.mockClear();
  });

  describe("exports", () => {
    test("phase constants and descriptor", () => {
      expect(PIPELINE_INTEGRATION_HOOK_PHASE).toBe(92);
      expect(PIPELINE_INTEGRATION_ENTITY).toBe("recruitment_pipeline_integration_hook");
      expect(PIPELINE_INTEGRATION_DESCRIPTOR.phase).toBe(92);
      expect(PIPELINE_INTEGRATION_METADATA.advisoryOnly).toBe(true);
      expect(PIPELINE_INTEGRATION_METADATA.runtimeIntegration).toBe(true);
      expect(PIPELINE_INTEGRATION_METADATA.mutatesProduction).toBe(false);
      expect(PIPELINE_INTEGRATION_METADATA.featureFlagId).toBe(
        WORKFLOW_INTEGRATION_FLAG_ID
      );
    });
  });

  describe("feature flag gate", () => {
    test("isWorkflowIntegrationFlagEnabled is false by default", () => {
      expect(isWorkflowIntegrationFlagEnabled(null)).toBe(false);
      expect(isWorkflowIntegrationFlagEnabled(undefined)).toBe(false);
      expect(isWorkflowIntegrationFlagEnabled({})).toBe(false);
      expect(isWorkflowIntegrationFlagEnabled({ workflowIntegrationEnabled: false })).toBe(
        false
      );
    });

    test("isWorkflowIntegrationFlagEnabled is true only when explicitly enabled", () => {
      expect(isWorkflowIntegrationFlagEnabled({ workflowIntegrationEnabled: true })).toBe(
        true
      );
    });
  });

  describe("flag OFF — no coordinator side effects", () => {
    test("attachRecruitmentWorkflowIntegration skips coordinator when flag is off", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: null };
      const result = attachRecruitmentWorkflowIntegration(outcome, {
        notice: notice(),
        featureFlags: { workflowIntegrationEnabled: false }
      });

      expect(result).toBeNull();
      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
      expect(peekRecruitmentWorkflowIntegration(outcome)).toBeNull();
      expect(peekRecruitmentPipelineDiagnostics(outcome)).toBeNull();
    });

    test("pipeline output is byte-for-byte equivalent when integration flag is off", () => {
      const processDetection = jest.fn().mockReturnValue(mockProcessorResult());

      const result = runRecruitmentPipeline({
        notice: notice(),
        candidateRecruitments: [candidate()],
        isEnabled: true,
        processDetection,
        updateId: 88,
        featureFlags: { workflowIntegrationEnabled: false }
      });

      expect(result).toEqual({
        skipped: false,
        result: mockProcessorResult(),
        updateId: 88
      });
      expect(peekRecruitmentWorkflowIntegration(result)).toBeNull();
    });

    test("pipeline flag-off skip path unchanged without integration flag", () => {
      const result = runRecruitmentPipeline({
        notice: notice(),
        isEnabled: false,
        updateId: 12
      });

      expect(result).toEqual({ skipped: true, reason: "flag_off", updateId: 12 });
      expect(peekRecruitmentWorkflowIntegration(result)).toBeNull();
    });
  });

  describe("flag ON — coordinator invoked once", () => {
    test("attachRecruitmentWorkflowIntegration invokes coordinator exactly once", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 42 };
      attachRecruitmentCompatibilityForTest(outcome);

      attachRecruitmentWorkflowIntegration(outcome, {
        notice: notice(),
        updateId: 42,
        featureFlags: { workflowIntegrationEnabled: true },
        traceId: "trace-92"
      });

      expect(coordinateRecruitmentWorkflowIntegration).toHaveBeenCalledTimes(1);
    });

    test("pipeline invokes coordinator once when integration flag is on", () => {
      const processDetection = jest.fn().mockReturnValue(mockProcessorResult());

      const result = runRecruitmentPipeline({
        notice: notice(),
        candidateRecruitments: [candidate()],
        isEnabled: true,
        processDetection,
        updateId: 92,
        featureFlags: { workflowIntegrationEnabled: true },
        traceId: "pipeline-trace-92"
      });

      expect(coordinateRecruitmentWorkflowIntegration).toHaveBeenCalledTimes(1);
      expect(peekRecruitmentWorkflowIntegration(result)).not.toBeNull();
      expect(peekRecruitmentWorkflowIntegration(result).integrationResult.featureEnabled).toBe(
        true
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
      expect(peekRecruitmentWorkflowIntegration(result)).not.toBeNull();
    });
  });

  describe("diagnostics advisory stage", () => {
    test("stores coordinator diagnostics when no prior pipeline diagnostics exist", () => {
      const outcome = runRecruitmentPipeline({
        notice: notice(),
        candidateRecruitments: [candidate()],
        isEnabled: true,
        featureFlags: { workflowIntegrationEnabled: true },
        updateId: 77
      });

      const diagnostics = peekRecruitmentPipelineDiagnostics(outcome);
      expect(diagnostics).not.toBeNull();
      expect(diagnostics.architectureOnly).toBe(true);
      expect(diagnostics.observationOnly).toBe(true);
      expect(diagnostics.appendedIntegrationStage).toBe(false);
      expect(diagnostics.summary).toBeDefined();
    });

    test("appends advisory integration stage when diagnostics already exist", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 99 };
      const { attachRecruitmentCompatibility } = require("../server/lib/recruitment/recruitmentCompatibilityLayer");
      attachRecruitmentCompatibility(outcome, { notice: notice(), updateId: 99 });

      const seeded = seedOpenDiagnostics(outcome);
      expect(seeded.fullTrace.stages).toHaveLength(1);

      attachRecruitmentWorkflowIntegration(outcome, {
        notice: notice(),
        updateId: 99,
        featureFlags: { workflowIntegrationEnabled: true }
      });

      const diagnostics = peekRecruitmentPipelineDiagnostics(outcome);
      expect(diagnostics.appendedIntegrationStage).toBe(true);
      expect(diagnostics.source).toBe("appended");
      expect(diagnostics.fullTrace.stages.length).toBeGreaterThan(seeded.fullTrace.stages.length);
      expect(diagnostics.fullTrace.stages[diagnostics.fullTrace.stages.length - 1].message).toMatch(
        /Workflow integration coordination/
      );
    });

    test("integration observation is advisory only", () => {
      const outcome = runRecruitmentPipeline({
        notice: notice(),
        isEnabled: true,
        featureFlags: { workflowIntegrationEnabled: true }
      });

      const observation = peekRecruitmentWorkflowIntegration(outcome);
      expect(observation.advisoryOnly).toBe(true);
      expect(observation.observationOnly).toBe(true);
      expect(observation.metadata.performsPersistence).toBe(false);
      expect(observation.integrationResult.metadata.mutatesProduction).toBe(false);
    });
  });

  describe("no persistence execution", () => {
    test("enabled integration never enables persistence", () => {
      const outcome = runRecruitmentPipeline({
        notice: notice(),
        candidateRecruitments: [candidate()],
        isEnabled: true,
        featureFlags: { workflowIntegrationEnabled: true }
      });

      const integration = peekRecruitmentWorkflowIntegration(outcome).integrationResult;
      expect(integration.metadata.persistenceEnabled).toBe(false);
      expect(integration.metadata.performsPersistence).toBe(false);
      expect(integration.metadata.sideEffects).toBe(false);
      expect(integration.integrationState.persistenceEnabled).toBe(false);
      if (integration.plannedWorkflow != null) {
        expect(integration.plannedWorkflow.executed).toBe(false);
      }
    });
  });

  describe("production behavior regression", () => {
    test("compatibility layer still attaches when integration flag is on", () => {
      const outcome = runRecruitmentPipeline({
        notice: notice(),
        isEnabled: false,
        updateId: 202,
        featureFlags: { workflowIntegrationEnabled: true }
      });

      expect(outcome).toEqual({ skipped: true, reason: "flag_off", updateId: 202 });
      expect(peekRecruitmentCompatibility(outcome)).not.toBeNull();
      expect(peekRecruitmentWorkflowIntegration(outcome)).not.toBeNull();
    });

    test("coordinator short-circuit is not invoked through pipeline when flag is off", () => {
      const integrationResult = coordinateRecruitmentWorkflowIntegration({
        featureFlags: { workflowIntegrationEnabled: false }
      });
      expect(integrationResult.integrationState.status).toBe(INTEGRATION_STATES.SHORT_CIRCUITED);

      const outcome = runRecruitmentPipeline({
        notice: notice(),
        isEnabled: true,
        featureFlags: { workflowIntegrationEnabled: false }
      });

      expect(peekRecruitmentWorkflowIntegration(outcome)).toBeNull();
    });

    test("attachRecruitmentWorkflowIntegration never throws", () => {
      expect(() =>
        attachRecruitmentWorkflowIntegration(null, { featureFlags: { workflowIntegrationEnabled: true } })
      ).not.toThrow();
      expect(() =>
        attachRecruitmentWorkflowIntegration({}, { featureFlags: { workflowIntegrationEnabled: true } })
      ).not.toThrow();
    });
  });

  describe("architecture boundaries", () => {
    test("hook module documents Phase 92 advisory constraints", () => {
      const source = read(HOOK_MODULE_PATH);

      expect(source).toMatch(/Phase 92/);
      expect(source).toMatch(/advisory-only/);
      expect(source).toMatch(/No Express/);
      expect(source).toMatch(/No database/);
      expect(source).toMatch(/coordinateRecruitmentWorkflowIntegration/);
    });

    test("hook does not import express, database drivers, or filesystem APIs", () => {
      const source = read(HOOK_MODULE_PATH);

      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2/);
      expect(source).not.toMatch(/process\.env/);
    });

    test("pipeline imports hook but not coordinator directly", () => {
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);

      expect(pipelineSource).toMatch(/recruitmentPipelineIntegrationHook/);
      expect(pipelineSource).toMatch(/attachRecruitmentWorkflowIntegration/);
      expect(pipelineSource).not.toMatch(/recruitmentWorkflowIntegrationCoordinator/);
      expect(coordinatorSource).toMatch(/WORKFLOW_INTEGRATION_COORDINATOR_PHASE = 91/);
    });

    test("coordinator is not wired into siteWorker or compatibility layer", () => {
      const workerSource = read(WORKER_MODULE_PATH);
      const compatibilitySource = read(COMPATIBILITY_MODULE_PATH);

      expect(workerSource).not.toMatch(/recruitmentWorkflowIntegrationCoordinator/);
      expect(workerSource).not.toMatch(/recruitmentPipelineIntegrationHook/);
      expect(compatibilitySource).not.toMatch(/recruitmentWorkflowIntegrationCoordinator/);
      expect(compatibilitySource).not.toMatch(/recruitmentPipelineIntegrationHook/);
      expect(compatibilitySource).toMatch(/recruitmentCompatibilityIntegrationHook/);
    });

    test("hook delegates to Phase 91 coordinator", () => {
      const source = read(HOOK_MODULE_PATH);
      expect(source).toMatch(/WORKFLOW_INTEGRATION_COORDINATOR_PHASE/);
      expect(source).toMatch(/coordinateRecruitmentWorkflowIntegration/);
      expect(PIPELINE_INTEGRATION_METADATA.coordinatorPhase).toBe(
        WORKFLOW_INTEGRATION_COORDINATOR_PHASE
      );
    });
  });
});
