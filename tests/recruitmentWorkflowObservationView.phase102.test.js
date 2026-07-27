"use strict";

/**
 * Phase 102 — Recruitment Workflow Observation View tests.
 * Complete, incomplete, unknown, and malformed snapshots, determinism,
 * immutability, summary helper, validation helper, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_WORKFLOW_OBSERVATION_VIEW_PHASE,
  RECRUITMENT_WORKFLOW_OBSERVATION_VIEW_ENTITY,
  OBSERVATION_VIEW_STATUS,
  OBSERVATION_VIEW_HEALTH,
  RECRUITMENT_WORKFLOW_OBSERVATION_VIEW_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_OBSERVATION_VIEW_METADATA,
  EMPTY_WORKFLOW_OBSERVATION_VIEW,
  buildRecruitmentWorkflowObservationView,
  isRecruitmentWorkflowObservationView,
  summarizeRecruitmentWorkflowObservationView
} = require("../server/lib/recruitment/recruitmentWorkflowObservationView");

const {
  buildRecruitmentWorkflowAdvisorySnapshot,
  isWorkflowAdvisorySnapshotResult
} = require("../server/lib/recruitment/recruitmentWorkflowAdvisorySnapshot");

const {
  ADVISORY_LIFECYCLE_EVENTS,
  OVERALL_HEALTH,
  RECOMMENDED_ACTIONS,
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

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowObservationView.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const COMPATIBILITY_MODULE_PATH = "server/lib/recruitment/recruitmentCompatibilityLayer.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";
const REGISTRY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowObservationRegistry.js";

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
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

function buildSnapshotFromContext(context) {
  return buildRecruitmentWorkflowAdvisorySnapshot(context);
}

const EXPECTED_VIEW_KEYS = Object.freeze([
  "status",
  "lifecycle",
  "health",
  "recommendation",
  "monitoring",
  "completeness",
  "generatedAt",
  "schemaVersion",
  "advisory",
  "architectureOnly",
  "executed"
]);

describe("Phase 102 — recruitmentWorkflowObservationView", () => {
  describe("exports", () => {
    test("exposes phase 102 constants and descriptor", () => {
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_VIEW_PHASE).toBe(102);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_VIEW_ENTITY).toBe(
        "recruitment_workflow_observation_view"
      );
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_VIEW_DESCRIPTOR.phase).toBe(102);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_VIEW_METADATA.projectionOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_VIEW_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_VIEW_METADATA.rebuildsSnapshots).toBe(false);
      expect(OBSERVATION_VIEW_STATUS.READY).toBe("READY");
      expect(OBSERVATION_VIEW_HEALTH.CRITICAL).toBe("CRITICAL");
    });
  });

  describe("complete snapshot", () => {
    test("projects monitoring fields from a complete advisory snapshot", () => {
      const snapshot = buildSnapshotFromContext(
        advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD)
      );
      const view = buildRecruitmentWorkflowObservationView(snapshot);

      expect(isRecruitmentWorkflowObservationView(view)).toBe(true);
      expect(view.status).toBe(OBSERVATION_VIEW_STATUS.READY);
      expect(view.lifecycle).toBe(ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD);
      expect(view.health).toBe(OVERALL_HEALTH.HEALTHY);
      expect(view.recommendation).toBe(RECOMMENDED_ACTIONS.MONITOR);
      expect(view.monitoring.required).toBe(true);
      expect(view.monitoring.workflowCompleted).toBe(false);
      expect(view.completeness).toBe(true);
      expect(view.generatedAt).toBe("2026-07-15T12:00:00.000Z");
      expect(view.schemaVersion).toBe("1.0.0");
      expect(view.advisory).toBe(true);
      expect(view.architectureOnly).toBe(true);
      expect(view.executed).toBe(false);
    });
  });

  describe("incomplete snapshot", () => {
    test("marks status INCOMPLETE when advisory sections are missing", () => {
      const snapshot = buildSnapshotFromContext({
        lifecycleResolution: resolveRecruitmentLifecycleEvent({ eventType: "result" })
      });
      const view = buildRecruitmentWorkflowObservationView(snapshot);

      expect(isWorkflowAdvisorySnapshotResult(snapshot)).toBe(true);
      expect(snapshot.metadata.snapshotComplete).toBe(false);
      expect(view.status).toBe(OBSERVATION_VIEW_STATUS.INCOMPLETE);
      expect(view.completeness).toBe(false);
      expect(view.lifecycle).toBe(OBSERVATION_VIEW_HEALTH.UNKNOWN);
      expect(view.health).toBe(OBSERVATION_VIEW_HEALTH.UNKNOWN);
      expect(view.recommendation).toBeNull();
      expect(view.monitoring.required).toBeNull();
      expect(view.monitoring.workflowCompleted).toBeNull();
      expect(view.generatedAt).toBeNull();
      expect(view.schemaVersion).toBe("1.0.0");
    });
  });

  describe("unknown snapshot", () => {
    test("projects UNKNOWN lifecycle and health from unknown workflow advisory summary", () => {
      const lifecycleResolution = {
        lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.UNKNOWN,
        lifecycleConfidence: "none",
        advisory: true,
        architectureOnly: true,
        executed: false
      };
      const transitionResolution = resolveRecruitmentLifecycleTransition({});
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
      const snapshot = buildSnapshotFromContext({
        lifecycleResolution,
        transitionResolution,
        workflowValidation,
        workflowRecommendation,
        workflowAdvisorySummary
      });
      const view = buildRecruitmentWorkflowObservationView(snapshot);

      expect(snapshot.metadata.snapshotComplete).toBe(true);
      expect(view.status).toBe(OBSERVATION_VIEW_STATUS.READY);
      expect(view.lifecycle).toBe(ADVISORY_LIFECYCLE_EVENTS.UNKNOWN);
      expect(view.health).toBe(OVERALL_HEALTH.UNKNOWN);
      expect(view.completeness).toBe(true);
    });
  });

  describe("malformed snapshot", () => {
    test("returns safe UNKNOWN view for null and invalid snapshot shapes", () => {
      const nullView = buildRecruitmentWorkflowObservationView(null);
      const stringView = buildRecruitmentWorkflowObservationView("bad");
      const invalidView = buildRecruitmentWorkflowObservationView({
        version: 99,
        advisory: true,
        architectureOnly: true,
        executed: false
      });

      expect(nullView).toEqual(EMPTY_WORKFLOW_OBSERVATION_VIEW);
      expect(stringView.status).toBe(OBSERVATION_VIEW_STATUS.UNKNOWN);
      expect(invalidView.status).toBe(OBSERVATION_VIEW_STATUS.UNKNOWN);
      expect(invalidView.completeness).toBe(false);
      expect(invalidView.health).toBe(OBSERVATION_VIEW_HEALTH.UNKNOWN);
    });

    test("does not throw for malformed snapshot input", () => {
      expect(() => buildRecruitmentWorkflowObservationView(undefined)).not.toThrow();
      expect(() => buildRecruitmentWorkflowObservationView([])).not.toThrow();
    });
  });

  describe("deterministic structure", () => {
    test("produces identical results for identical snapshot input", () => {
      const snapshot = buildSnapshotFromContext(
        advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.RESULT)
      );

      const first = buildRecruitmentWorkflowObservationView(snapshot);
      const second = buildRecruitmentWorkflowObservationView(snapshot);

      expect(first).toEqual(second);
      expect(first).not.toBe(second);
    });

    test("always exposes the stable observation view key set", () => {
      const snapshot = buildSnapshotFromContext(
        advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.JOINING)
      );
      const view = buildRecruitmentWorkflowObservationView(snapshot);

      expect(Object.keys(view).sort()).toEqual([...EXPECTED_VIEW_KEYS].sort());
      expect(Object.keys(view.monitoring).sort()).toEqual(
        ["required", "workflowCompleted"].sort()
      );
    });
  });

  describe("immutability", () => {
    test("freezes entire observation view object graph", () => {
      const snapshot = buildSnapshotFromContext(
        advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION)
      );
      const view = buildRecruitmentWorkflowObservationView(snapshot);

      assertAllFrozen(view);
    });

    test("does not mutate input snapshot", () => {
      const snapshot = buildSnapshotFromContext(
        advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD)
      );
      const before = JSON.stringify(snapshot);

      buildRecruitmentWorkflowObservationView(snapshot);

      expect(JSON.stringify(snapshot)).toBe(before);
    });

    test("empty observation view sentinel remains frozen", () => {
      assertAllFrozen(EMPTY_WORKFLOW_OBSERVATION_VIEW);
    });
  });

  describe("summary helper", () => {
    test("summarizes a valid observation view", () => {
      const snapshot = buildSnapshotFromContext(
        advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD)
      );
      const view = buildRecruitmentWorkflowObservationView(snapshot);
      const summary = summarizeRecruitmentWorkflowObservationView(view);

      expect(summary).toEqual({
        status: OBSERVATION_VIEW_STATUS.READY,
        lifecycle: ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD,
        health: OVERALL_HEALTH.HEALTHY,
        recommendation: RECOMMENDED_ACTIONS.MONITOR
      });
      expect(Object.isFrozen(summary)).toBe(true);
    });

    test("returns UNKNOWN summary for invalid view input", () => {
      expect(summarizeRecruitmentWorkflowObservationView(null)).toEqual({
        status: OBSERVATION_VIEW_STATUS.UNKNOWN,
        lifecycle: OBSERVATION_VIEW_HEALTH.UNKNOWN,
        health: OBSERVATION_VIEW_HEALTH.UNKNOWN,
        recommendation: null
      });
    });
  });

  describe("validation helper", () => {
    test("accepts projected observation views and rejects malformed values", () => {
      const view = buildRecruitmentWorkflowObservationView(
        buildSnapshotFromContext(advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.RESULT))
      );

      expect(isRecruitmentWorkflowObservationView(view)).toBe(true);
      expect(isRecruitmentWorkflowObservationView(null)).toBe(false);
      expect(isRecruitmentWorkflowObservationView({ status: "READY" })).toBe(false);
      expect(
        isRecruitmentWorkflowObservationView({
          ...view,
          health: "BAD"
        })
      ).toBe(false);
    });
  });

  describe("no persistence", () => {
    test("observation view remains advisory-only with no execution", () => {
      const view = buildRecruitmentWorkflowObservationView(
        buildSnapshotFromContext(advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.RESULT))
      );

      expect(view.advisory).toBe(true);
      expect(view.architectureOnly).toBe(true);
      expect(view.executed).toBe(false);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_VIEW_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_VIEW_METADATA.sideEffects).toBe(false);
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares pure projection constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 102");
      expect(source).toContain("buildRecruitmentWorkflowObservationView");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("projectionOnly");
      expect(source).toContain("rebuildsSnapshots");
    });

    test("module does not import express, database drivers, or filesystem APIs", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2/);
      expect(source).not.toMatch(/require\(["']https?["']\)/);
    });

    test("module does not rebuild snapshots, read the registry, or invoke the coordinator", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/buildRecruitmentWorkflowAdvisorySnapshot/);
      expect(source).not.toMatch(/coordinateRecruitmentWorkflowIntegration/);
      expect(source).not.toMatch(/recruitmentWorkflowObservationRegistry/);
      expect(source).not.toMatch(/peekWorkflowObservation/);
      expect(source).not.toMatch(/runRecruitmentPipeline/);
      expect(source).not.toMatch(/recruitmentPipelineIntegrationHook/);
    });

    test("module validates snapshots via isWorkflowAdvisorySnapshotResult only", () => {
      const source = read(MODULE_PATH);

      expect(source).toMatch(/isWorkflowAdvisorySnapshotResult/);
      expect(source).not.toMatch(/recruitmentWorkflowAdvisorySummary/);
      expect(source).not.toMatch(/recruitmentWorkflowValidator/);
      expect(source).not.toMatch(/recruitmentLifecycleEventResolver/);
    });

    test("observation view is not wired into coordinator, pipeline, compatibility layer, registry, or worker", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const compatibilitySource = read(COMPATIBILITY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const registrySource = read(REGISTRY_MODULE_PATH);

      expect(coordinatorSource).not.toMatch(/recruitmentWorkflowObservationView/);
      expect(compatibilitySource).not.toMatch(/recruitmentWorkflowObservationView/);
      expect(pipelineSource).not.toMatch(/recruitmentWorkflowObservationView/);
      expect(workerSource).not.toMatch(/recruitmentWorkflowObservationView/);
      expect(registrySource).not.toMatch(/recruitmentWorkflowObservationView/);
    });
  });
});
