"use strict";

/**
 * Phase 93 — Recruitment Compatibility Integration Hook tests.
 * Flag OFF/ON, coordinator invocation, unchanged compatibility output,
 * advisory diagnostics append, no persistence, backward compatibility.
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
  COMPATIBILITY_INTEGRATION_HOOK_PHASE,
  COMPATIBILITY_INTEGRATION_ENTITY,
  COMPATIBILITY_INTEGRATION_METADATA,
  COMPATIBILITY_INTEGRATION_DESCRIPTOR,
  isWorkflowIntegrationFlagEnabled,
  attachRecruitmentCompatibilityDiagnostics,
  peekRecruitmentCompatibilityDiagnostics,
  attachRecruitmentCompatibilityIntegration,
  peekRecruitmentCompatibilityIntegration
} = require("../server/lib/recruitment/recruitmentCompatibilityIntegrationHook");

const {
  WORKFLOW_INTEGRATION_COORDINATOR_PHASE,
  WORKFLOW_INTEGRATION_FLAG_ID,
  INTEGRATION_STATES,
  coordinateRecruitmentWorkflowIntegration
} = require("../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator");

const {
  attachRecruitmentCompatibility,
  peekRecruitmentCompatibility,
  summarizeRecruitmentCompatibility,
  buildRecruitmentCompatibilityContext
} = require("../server/lib/recruitment/recruitmentCompatibilityLayer");

const { runRecruitmentPipeline } = require("../server/lib/recruitment/runRecruitmentPipeline");
const { peekRecruitmentWorkflowIntegration } = require("../server/lib/recruitment/recruitmentPipelineIntegrationHook");
const { PROCESS_RESULT_STATUS } = require("../server/lib/recruitment/detectionProcessor");
const {
  DIAGNOSTIC_STAGE_TYPES,
  createExecutionTrace,
  appendExecutionStage
} = require("../server/lib/recruitment/executionDiagnostics");

const ROOT = path.join(__dirname, "..");
const HOOK_MODULE_PATH = "server/lib/recruitment/recruitmentCompatibilityIntegrationHook.js";
const COMPATIBILITY_MODULE_PATH = "server/lib/recruitment/recruitmentCompatibilityLayer.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";

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

function hasCircularReference(value, seen = new WeakSet(), stack = new WeakSet()) {
  if (value == null || typeof value !== "object") {
    return false;
  }
  if (stack.has(value)) {
    return true;
  }
  if (seen.has(value)) {
    return false;
  }
  seen.add(value);
  stack.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      if (hasCircularReference(value[i], seen, stack)) {
        return true;
      }
    }
    stack.delete(value);
    return false;
  }
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    if (hasCircularReference(value[keys[i]], seen, stack)) {
      return true;
    }
  }
  stack.delete(value);
  return false;
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
  expect(nodes.length).toBeGreaterThan(0);
  for (let i = 0; i < nodes.length; i += 1) {
    expect(Object.isFrozen(nodes[i])).toBe(true);
  }
}

function seedCompatibilityDiagnostics(pipelineOutcome) {
  let trace = createExecutionTrace({
    traceId: "compat-seed-trace",
    correlationId: "compat-seed-correlation",
    pipelineRunId: "compat-seed-run",
    contextId: "compat-seed-context"
  });
  const appended = appendExecutionStage(trace, {
    stageType: DIAGNOSTIC_STAGE_TYPES.CONTEXT,
    message: "Existing compatibility diagnostics",
    detail: { seeded: true }
  });
  trace = appended.trace;

  return attachRecruitmentCompatibilityDiagnostics(pipelineOutcome, {
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

describe("Phase 93 — recruitmentCompatibilityIntegrationHook", () => {
  beforeEach(() => {
    coordinateRecruitmentWorkflowIntegration.mockClear();
  });

  describe("exports", () => {
    test("phase constants and descriptor", () => {
      expect(COMPATIBILITY_INTEGRATION_HOOK_PHASE).toBe(93);
      expect(COMPATIBILITY_INTEGRATION_ENTITY).toBe(
        "recruitment_compatibility_integration_hook"
      );
      expect(COMPATIBILITY_INTEGRATION_DESCRIPTOR.phase).toBe(93);
      expect(COMPATIBILITY_INTEGRATION_METADATA.advisoryOnly).toBe(true);
      expect(COMPATIBILITY_INTEGRATION_METADATA.runtimeIntegration).toBe(true);
      expect(COMPATIBILITY_INTEGRATION_METADATA.mutatesProduction).toBe(false);
      expect(COMPATIBILITY_INTEGRATION_METADATA.featureFlagId).toBe(
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
    test("attachRecruitmentCompatibilityIntegration skips coordinator when flag is off", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: null };
      const context = buildRecruitmentCompatibilityContext({ notice: notice() });

      const result = attachRecruitmentCompatibilityIntegration(
        outcome,
        { notice: notice(), featureFlags: { workflowIntegrationEnabled: false } },
        context
      );

      expect(result).toBeNull();
      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
      expect(peekRecruitmentCompatibilityIntegration(outcome)).toBeNull();
      expect(peekRecruitmentCompatibilityDiagnostics(outcome)).toBeNull();
    });

    test("attachRecruitmentCompatibility produces unchanged compatibility when flag is off", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 11 };
      const beforeKeys = Object.keys(outcome).sort();

      attachRecruitmentCompatibility(outcome, {
        notice: notice(),
        updateId: 11,
        featureFlags: { workflowIntegrationEnabled: false }
      });

      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
      expect(peekRecruitmentCompatibilityIntegration(outcome)).toBeNull();
      expect(Object.keys(outcome).sort()).toEqual(beforeKeys);
      expect(peekRecruitmentCompatibility(outcome)).not.toBeNull();
    });

    test("pipeline flag-off path unchanged without integration flag", () => {
      const result = runRecruitmentPipeline({
        notice: notice(),
        isEnabled: false,
        updateId: 12
      });

      expect(result).toEqual({ skipped: true, reason: "flag_off", updateId: 12 });
      expect(peekRecruitmentCompatibilityIntegration(result)).toBeNull();
      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
    });
  });

  describe("flag ON — coordinator invoked exactly once", () => {
    test("attachRecruitmentCompatibilityIntegration invokes coordinator exactly once", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 42 };
      const context = buildRecruitmentCompatibilityContext({ notice: notice(), updateId: 42 });
      attachRecruitmentCompatibility(outcome, {
        notice: notice(),
        updateId: 42,
        featureFlags: { workflowIntegrationEnabled: false }
      });
      coordinateRecruitmentWorkflowIntegration.mockClear();

      attachRecruitmentCompatibilityIntegration(outcome, {
        notice: notice(),
        updateId: 42,
        featureFlags: { workflowIntegrationEnabled: true },
        traceId: "trace-93"
      }, context);

      expect(coordinateRecruitmentWorkflowIntegration).toHaveBeenCalledTimes(1);
    });

    test("attachRecruitmentCompatibility invokes coordinator once when flag is on", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 93 };

      attachRecruitmentCompatibility(outcome, {
        notice: notice(),
        updateId: 93,
        featureFlags: { workflowIntegrationEnabled: true },
        traceId: "compat-trace-93"
      });

      expect(coordinateRecruitmentWorkflowIntegration).toHaveBeenCalledTimes(1);
      expect(peekRecruitmentCompatibilityIntegration(outcome)).not.toBeNull();
      expect(peekRecruitmentCompatibilityIntegration(outcome).integrationResult.featureEnabled).toBe(
        true
      );
    });
  });

  describe("compatibility output unchanged", () => {
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

    test("compatibility context summary unchanged when integration flag is on", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 7 };
      attachRecruitmentCompatibility(outcome, {
        notice: notice(),
        updateId: 7,
        featureFlags: { workflowIntegrationEnabled: true }
      });

      const context = peekRecruitmentCompatibility(outcome);
      expect(summarizeRecruitmentCompatibility(context)).toEqual(
        summarizeRecruitmentCompatibility(
          buildRecruitmentCompatibilityContext({ notice: notice(), updateId: 7 })
        )
      );
    });
  });

  describe("diagnostics append", () => {
    test("stores coordinator diagnostics when no prior compatibility diagnostics exist", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 77 };
      attachRecruitmentCompatibility(outcome, {
        notice: notice(),
        updateId: 77,
        featureFlags: { workflowIntegrationEnabled: true }
      });

      const diagnostics = peekRecruitmentCompatibilityDiagnostics(outcome);
      expect(diagnostics).not.toBeNull();
      expect(diagnostics.architectureOnly).toBe(true);
      expect(diagnostics.observationOnly).toBe(true);
      expect(diagnostics.appendedIntegrationStage).toBe(false);
      expect(diagnostics.summary).toBeDefined();
    });

    test("appends advisory integration stage when compatibility diagnostics already exist", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 99 };
      attachRecruitmentCompatibility(outcome, {
        notice: notice(),
        updateId: 99,
        featureFlags: { workflowIntegrationEnabled: false }
      });

      const seeded = seedCompatibilityDiagnostics(outcome);
      expect(seeded.fullTrace.stages).toHaveLength(1);
      coordinateRecruitmentWorkflowIntegration.mockClear();

      attachRecruitmentCompatibilityIntegration(outcome, {
        notice: notice(),
        updateId: 99,
        featureFlags: { workflowIntegrationEnabled: true }
      }, peekRecruitmentCompatibility(outcome));

      const diagnostics = peekRecruitmentCompatibilityDiagnostics(outcome);
      expect(diagnostics.appendedIntegrationStage).toBe(true);
      expect(diagnostics.source).toBe("appended");
      expect(diagnostics.fullTrace.stages.length).toBeGreaterThan(seeded.fullTrace.stages.length);
      expect(
        diagnostics.fullTrace.stages[diagnostics.fullTrace.stages.length - 1].message
      ).toMatch(/Compatibility workflow integration coordination/);
    });

    test("integration observation is advisory only", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 1 };
      attachRecruitmentCompatibility(outcome, {
        notice: notice(),
        featureFlags: { workflowIntegrationEnabled: true }
      });

      const observation = peekRecruitmentCompatibilityIntegration(outcome);
      expect(observation.advisoryOnly).toBe(true);
      expect(observation.observationOnly).toBe(true);
      expect(observation.metadata.performsPersistence).toBe(false);
      expect(observation.integrationResult.metadata.mutatesProduction).toBe(false);
    });
  });

  describe("no persistence execution", () => {
    test("enabled integration never enables persistence", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 2 };
      attachRecruitmentCompatibility(outcome, {
        notice: notice(),
        featureFlags: { workflowIntegrationEnabled: true }
      });

      const integration = peekRecruitmentCompatibilityIntegration(outcome).integrationResult;
      expect(integration.metadata.persistenceEnabled).toBe(false);
      expect(integration.metadata.performsPersistence).toBe(false);
      expect(integration.metadata.sideEffects).toBe(false);
      expect(integration.integrationState.persistenceEnabled).toBe(false);
      if (integration.plannedWorkflow != null) {
        expect(integration.plannedWorkflow.executed).toBe(false);
      }
    });
  });

  describe("backward compatibility", () => {
    test("peekRecruitmentCompatibility contract unchanged when flag is off", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 202 };
      attachRecruitmentCompatibility(outcome, { notice: notice(), updateId: 202 });

      const context = peekRecruitmentCompatibility(outcome);
      expect(context.phase).toBe(69);
      expect(context.compatibilityOnly).toBe(true);
      expect(context.persistenceEnabled).toBe(false);
      expect(peekRecruitmentCompatibilityIntegration(outcome)).toBeNull();
    });

    test("coordinator short-circuit is not invoked through compatibility when flag is off", () => {
      const integrationResult = coordinateRecruitmentWorkflowIntegration({
        featureFlags: { workflowIntegrationEnabled: false }
      });
      expect(integrationResult.integrationState.status).toBe(INTEGRATION_STATES.SHORT_CIRCUITED);

      const outcome = { skipped: true, reason: "flag_off", updateId: 3 };
      attachRecruitmentCompatibility(outcome, {
        notice: notice(),
        featureFlags: { workflowIntegrationEnabled: false }
      });

      expect(peekRecruitmentCompatibilityIntegration(outcome)).toBeNull();
    });

    test("attachRecruitmentCompatibilityIntegration never throws", () => {
      expect(() =>
        attachRecruitmentCompatibilityIntegration(null, {
          featureFlags: { workflowIntegrationEnabled: true }
        })
      ).not.toThrow();
      expect(() =>
        attachRecruitmentCompatibilityIntegration({}, {
          featureFlags: { workflowIntegrationEnabled: true }
        })
      ).not.toThrow();
    });
  });

  describe("worker untouched and pipeline unaffected", () => {
    test("siteWorker does not import compatibility integration hook", () => {
      const workerSource = read(WORKER_MODULE_PATH);
      expect(workerSource).not.toMatch(/recruitmentCompatibilityIntegrationHook/);
      expect(workerSource).not.toMatch(/recruitmentWorkflowIntegrationCoordinator/);
    });

    test("pipeline module structure unchanged", () => {
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      expect(pipelineSource).toMatch(/attachRecruitmentCompatibility/);
      expect(pipelineSource).toMatch(/attachRecruitmentWorkflowIntegration/);
      expect(pipelineSource).not.toMatch(/recruitmentCompatibilityIntegrationHook/);
      expect(pipelineSource).not.toMatch(/recruitmentWorkflowIntegrationCoordinator/);
    });

    test("pipeline public outcome unchanged when flag is off", () => {
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
      expect(peekRecruitmentCompatibilityIntegration(result)).toBeNull();
    });
  });

  describe("deterministic output and immutability", () => {
    test("deterministic integration observation for identical input", () => {
      const input = {
        notice: notice(),
        updateId: 55,
        featureFlags: { workflowIntegrationEnabled: true },
        traceId: "deterministic-93"
      };

      const outcomeA = { skipped: true, reason: "flag_off", updateId: 55 };
      const outcomeB = { skipped: true, reason: "flag_off", updateId: 55 };

      attachRecruitmentCompatibility(outcomeA, input);
      attachRecruitmentCompatibility(outcomeB, input);

      const obsA = peekRecruitmentCompatibilityIntegration(outcomeA);
      const obsB = peekRecruitmentCompatibilityIntegration(outcomeB);

      expect(obsA.integrationResult.integrationState.status).toBe(
        obsB.integrationResult.integrationState.status
      );
      expect(obsA.integrationResult.featureEnabled).toBe(obsB.integrationResult.featureEnabled);
    });

    test("stored integration observation is deeply frozen", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 4 };
      attachRecruitmentCompatibility(outcome, {
        notice: notice(),
        featureFlags: { workflowIntegrationEnabled: true }
      });

      const observation = peekRecruitmentCompatibilityIntegration(outcome);
      assertAllFrozen(observation);
      expect(hasCircularReference(observation)).toBe(false);
    });

    test("input objects remain unchanged after attach", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 5 };
      const input = {
        notice: notice(),
        updateId: 5,
        featureFlags: { workflowIntegrationEnabled: true }
      };
      const outcomeSnapshot = JSON.parse(JSON.stringify(outcome));
      const inputSnapshot = JSON.parse(JSON.stringify(input));

      attachRecruitmentCompatibility(outcome, input);

      expect(outcome).toEqual(outcomeSnapshot);
      expect(input).toEqual(inputSnapshot);
    });
  });

  describe("architecture boundaries", () => {
    test("hook module documents Phase 93 advisory constraints", () => {
      const source = read(HOOK_MODULE_PATH);

      expect(source).toMatch(/Phase 93/);
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

    test("compatibility layer imports hook but not coordinator directly", () => {
      const compatibilitySource = read(COMPATIBILITY_MODULE_PATH);

      expect(compatibilitySource).toMatch(/recruitmentCompatibilityIntegrationHook/);
      expect(compatibilitySource).toMatch(/attachRecruitmentCompatibilityIntegration/);
      expect(compatibilitySource).not.toMatch(/recruitmentWorkflowIntegrationCoordinator/);
      expect(compatibilitySource).not.toMatch(/coordinateRecruitmentWorkflowIntegration/);
    });

    test("hook delegates to Phase 91 coordinator", () => {
      expect(COMPATIBILITY_INTEGRATION_METADATA.coordinatorPhase).toBe(
        WORKFLOW_INTEGRATION_COORDINATOR_PHASE
      );
      const source = read(HOOK_MODULE_PATH);
      expect(source).toMatch(/WORKFLOW_INTEGRATION_COORDINATOR_PHASE/);
      expect(source).toMatch(/coordinateRecruitmentWorkflowIntegration/);
    });

    test("compatibility and pipeline integration observations use separate WeakMap stores", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 6 };
      attachRecruitmentCompatibility(outcome, {
        notice: notice(),
        featureFlags: { workflowIntegrationEnabled: true }
      });

      const { attachRecruitmentWorkflowIntegration } = require("../server/lib/recruitment/recruitmentPipelineIntegrationHook");
      attachRecruitmentWorkflowIntegration(outcome, {
        notice: notice(),
        featureFlags: { workflowIntegrationEnabled: true }
      });

      expect(peekRecruitmentCompatibilityIntegration(outcome)).not.toBeNull();
      expect(peekRecruitmentWorkflowIntegration(outcome)).not.toBeNull();
      expect(peekRecruitmentCompatibilityIntegration(outcome)).not.toBe(
        peekRecruitmentWorkflowIntegration(outcome)
      );
    });
  });
});
