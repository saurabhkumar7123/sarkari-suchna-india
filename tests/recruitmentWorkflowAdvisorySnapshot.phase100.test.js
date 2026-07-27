"use strict";

/**
 * Phase 100 — Recruitment Workflow Advisory Snapshot tests.
 * Valid snapshot, completeness, malformed input, determinism, immutability,
 * coordinator integration, feature flag OFF, backward compatibility, and no persistence.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_PHASE,
  RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_ENTITY,
  RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_VERSION,
  RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_SCHEMA_VERSION,
  RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_METADATA,
  EMPTY_WORKFLOW_ADVISORY_SNAPSHOT,
  buildRecruitmentWorkflowAdvisorySnapshot,
  isWorkflowAdvisorySnapshotResult,
  validateWorkflowAdvisorySnapshotResult,
  summarizeWorkflowAdvisorySnapshotResult
} = require("../server/lib/recruitment/recruitmentWorkflowAdvisorySnapshot");

const {
  ADVISORY_LIFECYCLE_EVENTS,
  buildRecruitmentWorkflowAdvisorySummary
} = require("../server/lib/recruitment/recruitmentWorkflowAdvisorySummary");

const {
  resolveRecruitmentLifecycleEvent
} = require("../server/lib/recruitment/recruitmentLifecycleEventResolver");

const {
  resolveRecruitmentLifecycleTransition
} = require("../server/lib/recruitment/recruitmentLifecycleTransitionResolver");

const {
  validateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowValidator");

const {
  recommendRecruitmentWorkflowAction
} = require("../server/lib/recruitment/recruitmentWorkflowRecommendationEngine");

const {
  coordinateRecruitmentWorkflowIntegration
} = require("../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator");

const { processRecruitmentDetection } = require("../server/lib/recruitment/detectionProcessor");
const { runRecruitmentPipeline } = require("../server/lib/recruitment/runRecruitmentPipeline");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisorySnapshot.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
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

function enabledCoordinatorContext(overrides = {}) {
  const processorResult = processRecruitmentDetection({
    notice: notice(),
    candidateRecruitments: [candidate()]
  });

  return {
    featureFlags: {
      workflowIntegrationEnabled: true,
      pipelineEnabled: true,
      automaticPersistenceEnabled: false,
      reviewQueueEnqueueEnabled: false
    },
    executionMode: "preview",
    processorResult: {
      ...processorResult,
      lookupSummary: okLookup(),
      selectedRecruitment: candidate()
    },
    pipelineOutcome: runRecruitmentPipeline({
      notice: notice(),
      candidateRecruitments: [candidate()],
      isEnabled: true,
      updateId: 42
    }),
    normalizedUpdate: {
      updateId: 42,
      notice: notice()
    },
    correlationId: "corr-100",
    traceId: "trace-100",
    ...overrides
  };
}

function advisoryContextForEvent(event, overrides = {}) {
  const lifecycleResolution = resolveRecruitmentLifecycleEvent({
    eventType: event === ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD ? "admit_card" : "result"
  });
  const transitionResolution = resolveRecruitmentLifecycleTransition({ lifecycleResolution });
  const workflowValidation = validateRecruitmentWorkflow({
    lifecycleResolution,
    transitionResolution
  });
  const workflowRecommendation = recommendRecruitmentWorkflowAction({
    lifecycleResolution,
    transitionResolution,
    workflowValidation
  });
  const workflowAdvisorySummary = buildRecruitmentWorkflowAdvisorySummary({
    lifecycleResolution,
    transitionResolution,
    workflowValidation,
    workflowRecommendation
  });

  return {
    lifecycleResolution,
    transitionResolution,
    workflowValidation,
    workflowRecommendation,
    workflowAdvisorySummary,
    featureFlags: {
      workflowIntegrationEnabled: true,
      pipelineEnabled: true,
      automaticPersistenceEnabled: false,
      reviewQueueEnqueueEnabled: false
    },
    generatedAt: "2026-07-15T12:00:00.000Z",
    ...overrides
  };
}

const EXPECTED_SNAPSHOT_KEYS = Object.freeze([
  "version",
  "generatedAt",
  "advisorySummary",
  "lifecycle",
  "transition",
  "validation",
  "recommendation",
  "metadata",
  "advisory",
  "architectureOnly",
  "executed"
]);

describe("Phase 100 — recruitmentWorkflowAdvisorySnapshot", () => {
  describe("exports", () => {
    test("exposes phase 100 constants and descriptor", () => {
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_PHASE).toBe(100);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_ENTITY).toBe(
        "recruitment_workflow_advisory_snapshot"
      );
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_VERSION).toBe(1);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_SCHEMA_VERSION).toBe("1.0.0");
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_DESCRIPTOR.phase).toBe(100);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_METADATA.queriesDatabase).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_METADATA.recomputesBusinessLogic).toBe(false);
    });
  });

  describe("valid snapshot", () => {
    test("assembles advisory sections from Phases 95–99 outputs", () => {
      const context = advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD);
      const snapshot = buildRecruitmentWorkflowAdvisorySnapshot(context);

      expect(isWorkflowAdvisorySnapshotResult(snapshot)).toBe(true);
      expect(snapshot.version).toBe(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_VERSION);
      expect(snapshot.generatedAt).toBe("2026-07-15T12:00:00.000Z");
      expect(snapshot.advisorySummary).toEqual(context.workflowAdvisorySummary);
      expect(snapshot.lifecycle).toEqual(context.lifecycleResolution);
      expect(snapshot.transition).toEqual(context.transitionResolution);
      expect(snapshot.validation).toEqual(context.workflowValidation);
      expect(snapshot.recommendation).toEqual(context.workflowRecommendation);
      expect(snapshot.advisory).toBe(true);
      expect(snapshot.architectureOnly).toBe(true);
      expect(snapshot.executed).toBe(false);
    });
  });

  describe("snapshot completeness", () => {
    test("marks snapshotComplete when all advisory sections are present", () => {
      const snapshot = buildRecruitmentWorkflowAdvisorySnapshot(
        advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.RESULT)
      );

      expect(snapshot.metadata.snapshotComplete).toBe(true);
      expect(snapshot.metadata.phase).toBe(100);
      expect(snapshot.metadata.schemaVersion).toBe("1.0.0");
      expect(snapshot.metadata.featureFlagState.workflowIntegrationEnabled).toBe(true);
      expect(validateWorkflowAdvisorySnapshotResult(snapshot).status).toBe("complete");
    });

    test("marks snapshotComplete false when advisory sections are missing", () => {
      const snapshot = buildRecruitmentWorkflowAdvisorySnapshot({
        lifecycleResolution: resolveRecruitmentLifecycleEvent({ eventType: "result" })
      });

      expect(snapshot.metadata.snapshotComplete).toBe(false);
      expect(snapshot.lifecycle).not.toBeNull();
      expect(snapshot.transition).toBeNull();
      expect(validateWorkflowAdvisorySnapshotResult(snapshot).status).toBe("partial");
    });
  });

  describe("malformed input", () => {
    test("returns safe defaults for null and non-object context", () => {
      const nullResult = buildRecruitmentWorkflowAdvisorySnapshot(null);
      const stringResult = buildRecruitmentWorkflowAdvisorySnapshot("bad");
      const arrayResult = buildRecruitmentWorkflowAdvisorySnapshot([]);

      expect(nullResult).toEqual(EMPTY_WORKFLOW_ADVISORY_SNAPSHOT);
      expect(stringResult.metadata.snapshotComplete).toBe(false);
      expect(arrayResult.advisorySummary).toBeNull();
    });

    test("does not throw for malformed nested fields", () => {
      expect(() =>
        buildRecruitmentWorkflowAdvisorySnapshot({
          lifecycleResolution: "bad",
          transitionResolution: [],
          workflowValidation: null,
          workflowRecommendation: 42,
          workflowAdvisorySummary: "invalid"
        })
      ).not.toThrow();
    });

    test("rejects non-advisory sections and invalid generatedAt", () => {
      const snapshot = buildRecruitmentWorkflowAdvisorySnapshot({
        lifecycleResolution: { lifecycleEvent: "RESULT", executed: true },
        generatedAt: "not-a-date"
      });

      expect(snapshot.lifecycle).toBeNull();
      expect(snapshot.generatedAt).toBeNull();
    });
  });

  describe("deterministic structure", () => {
    test("produces identical results for identical input", () => {
      const context = advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.JOINING);

      const first = buildRecruitmentWorkflowAdvisorySnapshot(context);
      const second = buildRecruitmentWorkflowAdvisorySnapshot(context);

      expect(first).toEqual(second);
      expect(first).not.toBe(second);
    });

    test("always exposes the stable snapshot key set", () => {
      const snapshot = buildRecruitmentWorkflowAdvisorySnapshot(
        advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION)
      );

      expect(Object.keys(snapshot).sort()).toEqual([...EXPECTED_SNAPSHOT_KEYS].sort());
      expect(Object.keys(snapshot.metadata).sort()).toEqual(
        ["featureFlagState", "phase", "schemaVersion", "snapshotComplete"].sort()
      );
    });
  });

  describe("immutability", () => {
    test("freezes entire advisory snapshot object graph", () => {
      const snapshot = buildRecruitmentWorkflowAdvisorySnapshot(
        advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.JOINING)
      );
      assertAllFrozen(snapshot);
      expect(hasCircularReference(snapshot)).toBe(false);
    });

    test("does not mutate input context or advisory sections", () => {
      const context = advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION);
      const before = JSON.stringify(context);

      buildRecruitmentWorkflowAdvisorySnapshot(context);

      expect(JSON.stringify(context)).toBe(before);
    });

    test("returns detached copies of advisory sections", () => {
      const context = advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD);
      const snapshot = buildRecruitmentWorkflowAdvisorySnapshot(context);

      expect(snapshot.lifecycle).not.toBe(context.lifecycleResolution);
      expect(snapshot.lifecycle).toEqual(context.lifecycleResolution);
    });

    test("empty advisory snapshot sentinel remains frozen", () => {
      assertAllFrozen(EMPTY_WORKFLOW_ADVISORY_SNAPSHOT);
    });
  });

  describe("validation helpers", () => {
    test("validates and summarizes advisory snapshot results", () => {
      const snapshot = buildRecruitmentWorkflowAdvisorySnapshot(
        advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.JOINING)
      );

      expect(isWorkflowAdvisorySnapshotResult(snapshot)).toBe(true);
      expect(summarizeWorkflowAdvisorySnapshotResult(snapshot)).toMatchObject({
        phase: 100,
        valid: true,
        snapshotComplete: true,
        version: 1,
        schemaVersion: "1.0.0"
      });
    });

    test("accepts lifecycleTransitionResolution alias for transition section", () => {
      const lifecycleResolution = resolveRecruitmentLifecycleEvent({ eventType: "result" });
      const lifecycleTransitionResolution = resolveRecruitmentLifecycleTransition({
        lifecycleResolution
      });
      const workflowValidation = validateRecruitmentWorkflow({
        lifecycleResolution,
        transitionResolution: lifecycleTransitionResolution
      });
      const workflowRecommendation = recommendRecruitmentWorkflowAction({
        lifecycleResolution,
        transitionResolution: lifecycleTransitionResolution,
        workflowValidation
      });
      const workflowAdvisorySummary = buildRecruitmentWorkflowAdvisorySummary({
        lifecycleResolution,
        transitionResolution: lifecycleTransitionResolution,
        workflowValidation,
        workflowRecommendation
      });

      const snapshot = buildRecruitmentWorkflowAdvisorySnapshot({
        lifecycleResolution,
        lifecycleTransitionResolution,
        workflowValidation,
        workflowRecommendation,
        workflowAdvisorySummary
      });

      expect(snapshot.transition).toEqual(lifecycleTransitionResolution);
      expect(snapshot.metadata.snapshotComplete).toBe(true);
    });
  });

  describe("coordinator integration", () => {
    test("plannedWorkflow includes workflowAdvisorySnapshot when flag is on", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());
      const snapshot = result.plannedWorkflow.workflowAdvisorySnapshot;

      expect(snapshot).toBeDefined();
      expect(isWorkflowAdvisorySnapshotResult(snapshot)).toBe(true);
      expect(snapshot.metadata.snapshotComplete).toBe(true);
      expect(snapshot.advisorySummary).toEqual(result.plannedWorkflow.workflowAdvisorySummary);
      expect(snapshot.lifecycle.lifecycleEvent).toBe(result.plannedWorkflow.lifecycleEvent);
      expect(snapshot.advisory).toBe(true);
      expect(snapshot.executed).toBe(false);
    });

    test("diagnostics append workflow advisory snapshot stage without replacing existing stages", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());
      const summary = result.diagnostics.summary;

      expect(summary.stageCount).toBeGreaterThanOrEqual(11);
      expect(summary.stageTypes.filter((stageType) => stageType === "review").length).toBeGreaterThanOrEqual(
        7
      );
      expect(read(COORDINATOR_MODULE_PATH)).toContain("Workflow advisory snapshot");
      expect(read(COORDINATOR_MODULE_PATH)).toContain("Workflow advisory summary");
      expect(read(COORDINATOR_MODULE_PATH)).toContain("Workflow recommendation");
    });
  });

  describe("feature flag OFF", () => {
    test("coordinator short-circuit leaves plannedWorkflow null", () => {
      const result = coordinateRecruitmentWorkflowIntegration({
        featureFlags: { workflowIntegrationEnabled: false },
        processorResult: { eventType: "admit_card" }
      });

      expect(result.plannedWorkflow).toBeNull();
      expect(result.featureEnabled).toBe(false);
    });
  });

  describe("backward compatibility", () => {
    test("plannedWorkflow retains all pre-phase-100 fields", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());
      const planned = result.plannedWorkflow;

      expect(planned.actionPlanSummary).toBeDefined();
      expect(planned.persistencePlanSummary).toBeDefined();
      expect(planned.lifecycleEvent).toBeDefined();
      expect(planned.lifecycleConfidence).toBeDefined();
      expect(planned.currentLifecycleEvent).toBeDefined();
      expect(Array.isArray(planned.nextAllowedEvents)).toBe(true);
      expect(typeof planned.workflowCompleted).toBe("boolean");
      expect(typeof planned.workflowValid).toBe("boolean");
      expect(planned.workflowCompleteness).toBeDefined();
      expect(Array.isArray(planned.detectedAnomalies)).toBe(true);
      expect(planned.recommendedAction).toBeDefined();
      expect(Array.isArray(planned.recommendedNextEvents)).toBe(true);
      expect(planned.recommendationPriority).toBeDefined();
      expect(planned.recommendationConfidence).toBeDefined();
      expect(typeof planned.monitoringRequired).toBe("boolean");
      expect(typeof planned.workflowTerminal).toBe("boolean");
      expect(planned.workflowAdvisorySummary).toBeDefined();
      expect(planned.architectureOnly).toBe(true);
      expect(planned.executed).toBe(false);
      expect(planned.advisory).toBe(true);
    });
  });

  describe("no persistence", () => {
    test("advisory snapshot is advisory-only with no execution", () => {
      const snapshot = buildRecruitmentWorkflowAdvisorySnapshot(
        advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.RESULT)
      );

      expect(snapshot.architectureOnly).toBe(true);
      expect(snapshot.advisory).toBe(true);
      expect(snapshot.executed).toBe(false);
    });

    test("coordinator integration does not enable persistence or mutations", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());

      expect(result.metadata.persistenceEnabled).toBe(false);
      expect(result.metadata.mutatesProduction).toBe(false);
      expect(result.metadata.sideEffects).toBe(false);
      expect(result.plannedWorkflow.executed).toBe(false);
      expect(result.plannedWorkflow.workflowAdvisorySnapshot.executed).toBe(false);
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares pure advisory constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 100");
      expect(source).toContain("buildRecruitmentWorkflowAdvisorySnapshot");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("advisoryOnly");
      expect(source).toContain("recomputesBusinessLogic");
    });

    test("module does not import express, database drivers, or filesystem APIs", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2/);
      expect(source).not.toMatch(/require\(["']https?["']\)/);
    });

    test("module does not import other recruitment advisory modules", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/recruitmentLifecycleEventResolver/);
      expect(source).not.toMatch(/recruitmentWorkflowAdvisorySummary/);
      expect(source).not.toMatch(/recruitmentWorkflowValidator/);
    });

    test("advisory snapshot is not wired into pipeline, compatibility layer, or siteWorker directly", () => {
      const compatibilitySource = read(COMPATIBILITY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);

      expect(compatibilitySource).not.toMatch(/recruitmentWorkflowAdvisorySnapshot/);
      expect(pipelineSource).not.toMatch(/recruitmentWorkflowAdvisorySnapshot/);
      expect(workerSource).not.toMatch(/recruitmentWorkflowAdvisorySnapshot/);
    });

    test("coordinator imports advisory snapshot for plannedWorkflow enrichment only", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);

      expect(coordinatorSource).toMatch(/recruitmentWorkflowAdvisorySnapshot/);
      expect(coordinatorSource).toMatch(/buildRecruitmentWorkflowAdvisorySnapshot/);
      expect(coordinatorSource).toMatch(/Workflow advisory snapshot/);
    });
  });
});
