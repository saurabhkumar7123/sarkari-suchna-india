"use strict";

/**
 * Phase 91 — Recruitment Workflow Integration Coordinator tests.
 * Feature flag short-circuit, full orchestration flow, structured result,
 * deterministic output, immutability, invalid input, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  WORKFLOW_INTEGRATION_COORDINATOR_PHASE,
  WORKFLOW_INTEGRATION_ENTITY,
  WORKFLOW_INTEGRATION_FLAG_ID,
  INTEGRATION_STATES,
  COORDINATOR_REASONS,
  DEFAULT_WORKFLOW_FEATURE_FLAGS,
  WORKFLOW_INTEGRATION_METADATA,
  WORKFLOW_INTEGRATION_DESCRIPTOR,
  coordinateRecruitmentWorkflowIntegration
} = require("../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator");

const { ELIGIBILITY_STATUS } = require("../server/lib/recruitment/recruitmentEligibility");
const { processRecruitmentDetection } = require("../server/lib/recruitment/detectionProcessor");
const { runRecruitmentPipeline } = require("../server/lib/recruitment/runRecruitmentPipeline");
const { TRACE_STATUSES } = require("../server/lib/recruitment/executionDiagnostics");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const COMPATIBILITY_MODULE_PATH = "server/lib/recruitment/recruitmentCompatibilityLayer.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
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
  nodes.push(value);
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

function okLookup(overrides = {}) {
  return {
    status: "ok",
    strategy: "advertisement_number_exact",
    candidateCount: 1,
    limitedTo: 20,
    criteria: { advertisementNo: "CGL-01/2026" },
    message: null,
    ...overrides
  };
}

function eligibleProcessorResult() {
  const processorResult = processRecruitmentDetection({
    notice: notice(),
    candidateRecruitments: [candidate()]
  });

  return {
    ...processorResult,
    lookupSummary: okLookup(),
    selectedRecruitment: candidate()
  };
}

function enabledCoordinatorContext(overrides = {}) {
  const processorResult = eligibleProcessorResult();
  const pipelineOutcome = runRecruitmentPipeline({
    notice: notice(),
    candidateRecruitments: [candidate()],
    isEnabled: true,
    updateId: 42
  });

  return {
    featureFlags: {
      workflowIntegrationEnabled: true,
      pipelineEnabled: true,
      automaticPersistenceEnabled: false,
      reviewQueueEnqueueEnabled: false
    },
    executionMode: "preview",
    processorResult,
    pipelineOutcome,
    normalizedUpdate: {
      updateId: 42,
      notice: notice()
    },
    correlationId: "corr-91",
    traceId: "trace-91",
    ...overrides
  };
}

describe("Phase 91 — recruitmentWorkflowIntegrationCoordinator", () => {
  describe("exports", () => {
    test("exposes phase 91 constants and descriptor", () => {
      expect(WORKFLOW_INTEGRATION_COORDINATOR_PHASE).toBe(91);
      expect(WORKFLOW_INTEGRATION_ENTITY).toBe("recruitment_workflow_integration_result");
      expect(WORKFLOW_INTEGRATION_FLAG_ID).toBe("RECRUITMENT_WORKFLOW_INTEGRATION_ENABLED");
      expect(WORKFLOW_INTEGRATION_DESCRIPTOR.phase).toBe(91);
      expect(WORKFLOW_INTEGRATION_METADATA.pureOrchestration).toBe(true);
      expect(WORKFLOW_INTEGRATION_METADATA.readOnly).toBe(true);
      expect(WORKFLOW_INTEGRATION_METADATA.mutatesProduction).toBe(false);
      expect(WORKFLOW_INTEGRATION_METADATA.readsEnvironmentVariables).toBe(false);
    });

    test("default workflow feature flags keep integration disabled", () => {
      expect(DEFAULT_WORKFLOW_FEATURE_FLAGS.workflowIntegrationEnabled).toBe(false);
      expect(DEFAULT_WORKFLOW_FEATURE_FLAGS.automaticPersistenceEnabled).toBe(false);
      expect(DEFAULT_WORKFLOW_FEATURE_FLAGS.reviewQueueEnqueueEnabled).toBe(false);
    });
  });

  describe("feature flag short-circuit", () => {
    test("returns safe result when workflow integration flag is off", () => {
      const result = coordinateRecruitmentWorkflowIntegration({
        featureFlags: { workflowIntegrationEnabled: false }
      });

      expect(result.featureEnabled).toBe(false);
      expect(result.workflowEligible).toBe(false);
      expect(result.plannedWorkflow).toBeNull();
      expect(result.integrationState.status).toBe(INTEGRATION_STATES.SHORT_CIRCUITED);
      expect(result.integrationState.reason).toBe(COORDINATOR_REASONS.FEATURE_DISABLED);
      expect(result.metadata.shortCircuited).toBe(true);
      expect(result.metadata.coordinationComplete).toBe(false);
      expect(result.metadata.persistenceEnabled).toBe(false);
      expect(result.metadata.sideEffects).toBe(false);
    });

    test("defaults to short-circuit when feature flag is omitted", () => {
      const result = coordinateRecruitmentWorkflowIntegration({});

      expect(result.featureEnabled).toBe(false);
      expect(result.integrationState.status).toBe(INTEGRATION_STATES.SHORT_CIRCUITED);
    });

    test("short-circuit still records blocked enablement diagnostics", () => {
      const result = coordinateRecruitmentWorkflowIntegration({
        featureFlags: { workflowIntegrationEnabled: false },
        traceId: "short-circuit-trace"
      });

      expect(result.diagnostics.trace.status).toBe(TRACE_STATUSES.FINALIZED);
      expect(result.diagnostics.trace.architectureOnly).toBe(true);
      expect(result.diagnostics.trace.executed).toBe(false);
      expect(result.diagnostics.summary.finalized).toBe(true);
    });

    test("short-circuit does not run persistence adapter orchestration", () => {
      const pipelineOutcome = runRecruitmentPipeline({
        notice: notice(),
        candidateRecruitments: [candidate()],
        isEnabled: true
      });

      const result = coordinateRecruitmentWorkflowIntegration({
        featureFlags: { workflowIntegrationEnabled: false },
        pipelineOutcome,
        processorResult: eligibleProcessorResult()
      });

      expect(result.plannedWorkflow).toBeNull();
      expect(result.capabilities.detection.totalCapabilities).toBeGreaterThan(0);
    });
  });

  describe("invalid input", () => {
    test("short-circuits safely for null and non-object context", () => {
      const nullResult = coordinateRecruitmentWorkflowIntegration(null);
      const stringResult = coordinateRecruitmentWorkflowIntegration("bad");
      const arrayResult = coordinateRecruitmentWorkflowIntegration([]);

      expect(nullResult.featureEnabled).toBe(false);
      expect(nullResult.integrationState.reason).toBe(COORDINATOR_REASONS.INVALID_CONTEXT);
      expect(stringResult.featureEnabled).toBe(false);
      expect(arrayResult.featureEnabled).toBe(false);
    });

    test("does not throw for malformed nested fields", () => {
      expect(() =>
        coordinateRecruitmentWorkflowIntegration({
          featureFlags: { workflowIntegrationEnabled: true },
          processorResult: "bad",
          pipelineOutcome: 42
        })
      ).not.toThrow();
    });
  });

  describe("full orchestration flow", () => {
    test("coordinates runtime capability detection", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());

      expect(result.featureEnabled).toBe(true);
      expect(result.capabilities.detection.totalCapabilities).toBeGreaterThan(0);
      expect(result.capabilities.detection.architectureOnly).toBe(true);
      expect(result.capabilities.detection.validationValid).toBe(true);
      expect(result.capabilities.observationOnly).toBe(true);
    });

    test("evaluates feature flags through persistence enablement", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());

      expect(result.metadata.enablementReason).toBeDefined();
      expect(result.integrationState.enablementAllowed).toBe(false);
      expect(result.metadata.executionMode).toBe("preview");
    });

    test("evaluates workflow eligibility from processor result", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());

      expect(result.workflowEligible).toBe(true);
      expect(result.integrationState.eligibilityStatus).toBe(ELIGIBILITY_STATUS.ELIGIBLE);
    });

    test("observes read-only persistence adapter without writes", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());

      expect(result.integrationState.adapterAvailable).toBe(true);
      expect(result.capabilities.detection.summary.queriesDatabase).toBeUndefined();
      expect(result.metadata.persistenceEnabled).toBe(false);
      expect(result.metadata.performsPersistence).toBe(false);
      expect(result.metadata.queriesDatabase).toBe(false);
    });

    test("builds planned workflow with action and persistence summaries", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());

      expect(result.plannedWorkflow).not.toBeNull();
      expect(result.plannedWorkflow.architectureOnly).toBe(true);
      expect(result.plannedWorkflow.executed).toBe(false);
      expect(result.plannedWorkflow.actionPlanSummary.valid).toBe(true);
      expect(result.plannedWorkflow.persistencePlanSummary.valid).toBe(true);
      expect(result.plannedWorkflow.reviewWorkflowTransition.architectureOnly).toBe(true);
      expect(result.plannedWorkflow.lifecycleEvent).toBeDefined();
      expect(result.plannedWorkflow.lifecycleConfidence).toBeDefined();
      expect(result.plannedWorkflow.resolutionReason).toBeDefined();
    });

    test("records diagnostics trace through coordination stages", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());

      expect(result.diagnostics.trace.status).toBe(TRACE_STATUSES.FINALIZED);
      expect(result.diagnostics.trace.stageCount).toBeGreaterThanOrEqual(6);
      expect(result.diagnostics.summary.finalized).toBe(true);
      expect(result.diagnostics.architectureOnly).toBe(true);
      expect(
        result.diagnostics.summary.stageTypes.filter((stageType) => stageType === "review").length
      ).toBeGreaterThanOrEqual(2);
    });

    test("reports coordinated integration state when inputs are complete", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());

      expect(result.integrationState.status).toBe(INTEGRATION_STATES.COORDINATED);
      expect(result.integrationState.reason).toBe(COORDINATOR_REASONS.COORDINATION_COMPLETE);
      expect(result.metadata.coordinationComplete).toBe(true);
      expect(result.metadata.shortCircuited).toBe(false);
    });
  });

  describe("structured result contract", () => {
    test("returns all required top-level fields", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());

      expect(result).toHaveProperty("featureEnabled");
      expect(result).toHaveProperty("workflowEligible");
      expect(result).toHaveProperty("capabilities");
      expect(result).toHaveProperty("diagnostics");
      expect(result).toHaveProperty("plannedWorkflow");
      expect(result).toHaveProperty("integrationState");
      expect(result).toHaveProperty("metadata");
    });

    test("short-circuit result preserves required fields with null planned workflow", () => {
      const result = coordinateRecruitmentWorkflowIntegration({
        featureFlags: { workflowIntegrationEnabled: false }
      });

      expect(result).toHaveProperty("featureEnabled", false);
      expect(result).toHaveProperty("workflowEligible", false);
      expect(result).toHaveProperty("capabilities");
      expect(result).toHaveProperty("diagnostics");
      expect(result).toHaveProperty("plannedWorkflow", null);
      expect(result).toHaveProperty("integrationState");
    });
  });

  describe("partial and ineligible paths", () => {
    test("reports ineligible when processor result is missing", () => {
      const result = coordinateRecruitmentWorkflowIntegration({
        featureFlags: { workflowIntegrationEnabled: true },
        pipelineOutcome: { skipped: false, updateId: 1 }
      });

      expect(result.workflowEligible).toBe(false);
      expect(result.integrationState.status).toBe(INTEGRATION_STATES.INELIGIBLE);
      expect(result.integrationState.reason).toBe(COORDINATOR_REASONS.WORKFLOW_INELIGIBLE);
    });

    test("reports partial when pipeline outcome is missing", () => {
      const result = coordinateRecruitmentWorkflowIntegration({
        featureFlags: { workflowIntegrationEnabled: true },
        processorResult: eligibleProcessorResult()
      });

      expect(result.workflowEligible).toBe(true);
      expect(result.integrationState.status).toBe(INTEGRATION_STATES.PARTIAL);
      expect(result.integrationState.adapterAvailable).toBe(false);
      expect(result.integrationState.reason).toBe(COORDINATOR_REASONS.PARTIAL_INPUT);
    });

    test("reports ineligible for invalid processor input", () => {
      const result = coordinateRecruitmentWorkflowIntegration({
        featureFlags: { workflowIntegrationEnabled: true },
        processorResult: {
          status: "invalid_input",
          matchResult: { match: false },
          lookupSummary: okLookup({ status: "failed", candidateCount: 0 })
        },
        pipelineOutcome: runRecruitmentPipeline({
          notice: notice(),
          candidateRecruitments: [candidate()],
          isEnabled: true
        })
      });

      expect(result.workflowEligible).toBe(false);
      expect(result.integrationState.status).toBe(INTEGRATION_STATES.INELIGIBLE);
    });
  });

  describe("deterministic output", () => {
    test("produces identical results for identical input", () => {
      const context = enabledCoordinatorContext();

      const first = coordinateRecruitmentWorkflowIntegration(context);
      const second = coordinateRecruitmentWorkflowIntegration(context);

      expect(first).toEqual(second);
      expect(first.capabilities).not.toBe(second.capabilities);
    });

    test("short-circuit is deterministic", () => {
      const context = { featureFlags: { workflowIntegrationEnabled: false }, traceId: "t-1" };

      const first = coordinateRecruitmentWorkflowIntegration(context);
      const second = coordinateRecruitmentWorkflowIntegration(context);

      expect(first).toEqual(second);
    });
  });

  describe("immutability", () => {
    test("freezes entire result object graph", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());

      assertAllFrozen(result);
      expect(hasCircularReference(result)).toBe(false);
    });

    test("does not mutate input context", () => {
      const context = enabledCoordinatorContext();
      const snapshot = JSON.stringify({
        featureFlags: context.featureFlags,
        executionMode: context.executionMode,
        correlationId: context.correlationId
      });

      coordinateRecruitmentWorkflowIntegration(context);

      expect(
        JSON.stringify({
          featureFlags: context.featureFlags,
          executionMode: context.executionMode,
          correlationId: context.correlationId
        })
      ).toBe(snapshot);
    });

    test("short-circuit result is deeply frozen", () => {
      const result = coordinateRecruitmentWorkflowIntegration({
        featureFlags: { workflowIntegrationEnabled: false }
      });

      assertAllFrozen(result);
    });
  });

  describe("production safety", () => {
    test("enabled coordination never enables persistence or side effects", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());

      expect(result.metadata.persistenceEnabled).toBe(false);
      expect(result.metadata.performsPersistence).toBe(false);
      expect(result.metadata.sideEffects).toBe(false);
      expect(result.metadata.mutatesProduction).toBe(false);
      expect(result.integrationState.persistenceEnabled).toBe(false);
      expect(result.integrationState.sideEffects).toBe(false);
      expect(result.plannedWorkflow.executed).toBe(false);
    });

    test("adapter observation never reports executed persistence", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());

      expect(result.integrationState.adapterAvailable).toBe(true);
      expect(result.plannedWorkflow.persistencePlanSummary.performsPersistence).toBe(false);
      expect(result.metadata.performsPersistence).toBe(false);
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares pure orchestration constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 91");
      expect(source).toContain("Pure orchestration");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("No routing");
      expect(source).toContain("coordinateRecruitmentWorkflowIntegration");
      expect(source).toContain("short-circuit");
    });

    test("module does not import express, database drivers, or filesystem APIs", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2/);
      expect(source).not.toMatch(/require\(["']https?["']\)/);
    });

    test("module is not wired into compatibility layer or siteWorker; pipeline uses hook only", () => {
      const compatibilitySource = read(COMPATIBILITY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);

      expect(compatibilitySource).not.toMatch(/recruitmentWorkflowIntegrationCoordinator/);
      expect(workerSource).not.toMatch(/recruitmentWorkflowIntegrationCoordinator/);
      expect(pipelineSource).not.toMatch(/recruitmentWorkflowIntegrationCoordinator/);
      expect(pipelineSource).toMatch(/recruitmentPipelineIntegrationHook/);
    });

    test("metadata confirms no production mutations or environment reads", () => {
      expect(WORKFLOW_INTEGRATION_METADATA.runtimeIntegration).toBe(false);
      expect(WORKFLOW_INTEGRATION_METADATA.readsEnvironmentVariables).toBe(false);
      expect(WORKFLOW_INTEGRATION_METADATA.routing).toBe(false);
      expect(WORKFLOW_INTEGRATION_METADATA.mutatesProduction).toBe(false);
      expect(WORKFLOW_INTEGRATION_METADATA.queriesDatabase).toBe(false);
    });
  });
});
