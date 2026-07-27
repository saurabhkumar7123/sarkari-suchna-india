"use strict";

/**
 * Phase 103 — Recruitment Workflow Observation Diagnostics Adapter tests.
 * Healthy, warning, critical, incomplete, and malformed views, determinism,
 * immutability, summary helper, validation helper, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_WORKFLOW_OBSERVATION_DIAGNOSTICS_ADAPTER_PHASE,
  RECRUITMENT_WORKFLOW_OBSERVATION_DIAGNOSTICS_ADAPTER_ENTITY,
  DIAGNOSTICS_SEVERITY,
  RECRUITMENT_WORKFLOW_OBSERVATION_DIAGNOSTICS_ADAPTER_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_OBSERVATION_DIAGNOSTICS_ADAPTER_METADATA,
  EMPTY_WORKFLOW_OBSERVATION_DIAGNOSTICS,
  buildRecruitmentWorkflowObservationDiagnostics,
  isRecruitmentWorkflowObservationDiagnostics,
  summarizeRecruitmentWorkflowObservationDiagnostics
} = require("../server/lib/recruitment/recruitmentWorkflowObservationDiagnosticsAdapter");

const {
  OBSERVATION_VIEW_STATUS,
  OBSERVATION_VIEW_HEALTH,
  buildRecruitmentWorkflowObservationView
} = require("../server/lib/recruitment/recruitmentWorkflowObservationView");

const {
  buildRecruitmentWorkflowAdvisorySnapshot
} = require("../server/lib/recruitment/recruitmentWorkflowAdvisorySnapshot");

const {
  ADVISORY_LIFECYCLE_EVENTS,
  OVERALL_HEALTH,
  RECOMMENDED_ACTIONS,
  ANOMALY_TYPES,
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
const MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowObservationDiagnosticsAdapter.js";
const COORDINATOR_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const COMPATIBILITY_MODULE_PATH = "server/lib/recruitment/recruitmentCompatibilityLayer.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";
const REGISTRY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowObservationRegistry.js";
const SNAPSHOT_ADAPTER_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowSnapshotAdapter.js";

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

function buildViewFromContext(context) {
  return buildRecruitmentWorkflowObservationView(
    buildRecruitmentWorkflowAdvisorySnapshot(context)
  );
}

function buildWarningView() {
  const baseContext = advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD);
  const workflowValidation = {
    workflowValid: false,
    validationConfidence: "low",
    validationReason: "ANOMALIES_DETECTED",
    detectedAnomalies: Object.freeze([
      Object.freeze({
        type: ANOMALY_TYPES.DUPLICATE_LIFECYCLE_EVENT,
        event: ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD
      })
    ]),
    advisory: true,
    architectureOnly: true,
    executed: false
  };
  const workflowRecommendation = recommendRecruitmentWorkflowAction({
    lifecycleResolution: baseContext.lifecycleResolution,
    transitionResolution: baseContext.transitionResolution,
    workflowValidation
  });

  return buildViewFromContext({
    ...baseContext,
    workflowValidation,
    workflowRecommendation,
    workflowAdvisorySummary: buildRecruitmentWorkflowAdvisorySummary({
      lifecycleResolution: baseContext.lifecycleResolution,
      transitionResolution: baseContext.transitionResolution,
      workflowValidation,
      workflowRecommendation
    })
  });
}

function buildCriticalView() {
  const lifecycleResolution = resolveRecruitmentLifecycleEvent({ eventType: "result" });
  const transitionResolution = resolveRecruitmentLifecycleTransition({ lifecycleResolution });
  const workflowValidation = validateRecruitmentWorkflow({
    lifecycleResolution,
    transitionResolution,
    workflowContext: {
      observedLifecycleEvents: [
        ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION,
        ADVISORY_LIFECYCLE_EVENTS.RESULT
      ]
    }
  });
  const workflowRecommendation = recommendRecruitmentWorkflowAction({
    lifecycleResolution,
    transitionResolution,
    workflowValidation
  });

  return buildViewFromContext({
    ...advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.RESULT),
    lifecycleResolution,
    transitionResolution,
    workflowValidation,
    workflowRecommendation,
    workflowAdvisorySummary: buildRecruitmentWorkflowAdvisorySummary({
      lifecycleResolution,
      transitionResolution,
      workflowValidation,
      workflowRecommendation
    })
  });
}

const EXPECTED_DIAGNOSTICS_KEYS = Object.freeze([
  "status",
  "severity",
  "lifecycle",
  "health",
  "recommendation",
  "monitoringRequired",
  "workflowCompleted",
  "snapshotComplete",
  "generatedAt",
  "schemaVersion",
  "advisory",
  "architectureOnly",
  "executed"
]);

describe("Phase 103 — recruitmentWorkflowObservationDiagnosticsAdapter", () => {
  describe("exports", () => {
    test("exposes phase 103 constants and descriptor", () => {
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_DIAGNOSTICS_ADAPTER_PHASE).toBe(103);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_DIAGNOSTICS_ADAPTER_ENTITY).toBe(
        "recruitment_workflow_observation_diagnostics_adapter"
      );
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_DIAGNOSTICS_ADAPTER_DESCRIPTOR.phase).toBe(103);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_DIAGNOSTICS_ADAPTER_METADATA.diagnosticsOnly).toBe(
        true
      );
      expect(
        RECRUITMENT_WORKFLOW_OBSERVATION_DIAGNOSTICS_ADAPTER_METADATA.rebuildsObservationViews
      ).toBe(false);
      expect(DIAGNOSTICS_SEVERITY.INFO).toBe("INFO");
      expect(DIAGNOSTICS_SEVERITY.ERROR).toBe("ERROR");
    });
  });

  describe("healthy payload", () => {
    test("maps READY + HEALTHY observation view to INFO severity", () => {
      const view = buildViewFromContext(
        advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD)
      );
      const diagnostics = buildRecruitmentWorkflowObservationDiagnostics(view);

      expect(isRecruitmentWorkflowObservationDiagnostics(diagnostics)).toBe(true);
      expect(diagnostics.status).toBe(OBSERVATION_VIEW_STATUS.READY);
      expect(diagnostics.severity).toBe(DIAGNOSTICS_SEVERITY.INFO);
      expect(diagnostics.lifecycle).toBe(ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD);
      expect(diagnostics.health).toBe(OVERALL_HEALTH.HEALTHY);
      expect(diagnostics.recommendation).toBe(RECOMMENDED_ACTIONS.MONITOR);
      expect(diagnostics.monitoringRequired).toBe(true);
      expect(diagnostics.workflowCompleted).toBe(false);
      expect(diagnostics.snapshotComplete).toBe(true);
      expect(diagnostics.generatedAt).toBe("2026-07-15T12:00:00.000Z");
      expect(diagnostics.schemaVersion).toBe("1.0.0");
      expect(diagnostics.advisory).toBe(true);
      expect(diagnostics.architectureOnly).toBe(true);
      expect(diagnostics.executed).toBe(false);
    });
  });

  describe("warning payload", () => {
    test("maps READY + WARNING observation view to WARNING severity", () => {
      const view = buildWarningView();
      const diagnostics = buildRecruitmentWorkflowObservationDiagnostics(view);

      expect(view.status).toBe(OBSERVATION_VIEW_STATUS.READY);
      expect(view.health).toBe(OVERALL_HEALTH.WARNING);
      expect(diagnostics.severity).toBe(DIAGNOSTICS_SEVERITY.WARNING);
      expect(diagnostics.status).toBe(OBSERVATION_VIEW_STATUS.READY);
      expect(diagnostics.health).toBe(OVERALL_HEALTH.WARNING);
      expect(diagnostics.snapshotComplete).toBe(true);
    });
  });

  describe("critical payload", () => {
    test("maps READY + CRITICAL observation view to ERROR severity", () => {
      const view = buildCriticalView();
      const diagnostics = buildRecruitmentWorkflowObservationDiagnostics(view);

      expect(view.status).toBe(OBSERVATION_VIEW_STATUS.READY);
      expect(view.health).toBe(OVERALL_HEALTH.CRITICAL);
      expect(diagnostics.severity).toBe(DIAGNOSTICS_SEVERITY.ERROR);
      expect(diagnostics.status).toBe(OBSERVATION_VIEW_STATUS.READY);
      expect(diagnostics.health).toBe(OVERALL_HEALTH.CRITICAL);
      expect(diagnostics.snapshotComplete).toBe(true);
    });
  });

  describe("incomplete payload", () => {
    test("maps INCOMPLETE observation view to UNKNOWN severity", () => {
      const view = buildViewFromContext({
        lifecycleResolution: resolveRecruitmentLifecycleEvent({ eventType: "result" })
      });
      const diagnostics = buildRecruitmentWorkflowObservationDiagnostics(view);

      expect(view.status).toBe(OBSERVATION_VIEW_STATUS.INCOMPLETE);
      expect(diagnostics.status).toBe(OBSERVATION_VIEW_STATUS.INCOMPLETE);
      expect(diagnostics.severity).toBe(DIAGNOSTICS_SEVERITY.UNKNOWN);
      expect(diagnostics.snapshotComplete).toBe(false);
      expect(diagnostics.lifecycle).toBe(OBSERVATION_VIEW_HEALTH.UNKNOWN);
      expect(diagnostics.health).toBe(OBSERVATION_VIEW_HEALTH.UNKNOWN);
      expect(diagnostics.recommendation).toBeNull();
      expect(diagnostics.monitoringRequired).toBeNull();
      expect(diagnostics.workflowCompleted).toBeNull();
    });
  });

  describe("malformed view", () => {
    test("returns safe UNKNOWN diagnostics for null and invalid view shapes", () => {
      const nullDiagnostics = buildRecruitmentWorkflowObservationDiagnostics(null);
      const stringDiagnostics = buildRecruitmentWorkflowObservationDiagnostics("bad");
      const invalidDiagnostics = buildRecruitmentWorkflowObservationDiagnostics({
        status: "READY",
        health: "HEALTHY"
      });

      expect(nullDiagnostics).toEqual(EMPTY_WORKFLOW_OBSERVATION_DIAGNOSTICS);
      expect(stringDiagnostics.status).toBe(OBSERVATION_VIEW_STATUS.UNKNOWN);
      expect(stringDiagnostics.severity).toBe(DIAGNOSTICS_SEVERITY.UNKNOWN);
      expect(invalidDiagnostics.severity).toBe(DIAGNOSTICS_SEVERITY.UNKNOWN);
      expect(invalidDiagnostics.snapshotComplete).toBe(false);
      expect(invalidDiagnostics.health).toBe(OBSERVATION_VIEW_HEALTH.UNKNOWN);
    });

    test("does not throw for malformed view input", () => {
      expect(() => buildRecruitmentWorkflowObservationDiagnostics(undefined)).not.toThrow();
      expect(() => buildRecruitmentWorkflowObservationDiagnostics([])).not.toThrow();
    });
  });

  describe("deterministic output", () => {
    test("produces identical results for identical observation view input", () => {
      const view = buildViewFromContext(
        advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.RESULT)
      );

      const first = buildRecruitmentWorkflowObservationDiagnostics(view);
      const second = buildRecruitmentWorkflowObservationDiagnostics(view);

      expect(first).toEqual(second);
      expect(first).not.toBe(second);
    });

    test("always exposes the stable diagnostics key set", () => {
      const view = buildViewFromContext(
        advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.JOINING)
      );
      const diagnostics = buildRecruitmentWorkflowObservationDiagnostics(view);

      expect(Object.keys(diagnostics).sort()).toEqual([...EXPECTED_DIAGNOSTICS_KEYS].sort());
    });
  });

  describe("immutability", () => {
    test("freezes entire diagnostics object graph", () => {
      const view = buildViewFromContext(
        advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION)
      );
      const diagnostics = buildRecruitmentWorkflowObservationDiagnostics(view);

      assertAllFrozen(diagnostics);
    });

    test("does not mutate input observation view", () => {
      const view = buildViewFromContext(
        advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD)
      );
      const before = JSON.stringify(view);

      buildRecruitmentWorkflowObservationDiagnostics(view);

      expect(JSON.stringify(view)).toBe(before);
    });

    test("empty diagnostics sentinel remains frozen", () => {
      assertAllFrozen(EMPTY_WORKFLOW_OBSERVATION_DIAGNOSTICS);
    });
  });

  describe("summary helper", () => {
    test("summarizes a valid diagnostics payload", () => {
      const view = buildViewFromContext(
        advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD)
      );
      const diagnostics = buildRecruitmentWorkflowObservationDiagnostics(view);
      const summary = summarizeRecruitmentWorkflowObservationDiagnostics(diagnostics);

      expect(summary).toEqual({
        severity: DIAGNOSTICS_SEVERITY.INFO,
        lifecycle: ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD,
        health: OVERALL_HEALTH.HEALTHY,
        recommendation: RECOMMENDED_ACTIONS.MONITOR
      });
      expect(Object.isFrozen(summary)).toBe(true);
    });

    test("returns UNKNOWN summary for invalid diagnostics input", () => {
      expect(summarizeRecruitmentWorkflowObservationDiagnostics(null)).toEqual({
        severity: DIAGNOSTICS_SEVERITY.UNKNOWN,
        lifecycle: OBSERVATION_VIEW_HEALTH.UNKNOWN,
        health: OBSERVATION_VIEW_HEALTH.UNKNOWN,
        recommendation: null
      });
    });
  });

  describe("validation helper", () => {
    test("accepts projected diagnostics payloads and rejects malformed values", () => {
      const diagnostics = buildRecruitmentWorkflowObservationDiagnostics(
        buildViewFromContext(advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.RESULT))
      );

      expect(isRecruitmentWorkflowObservationDiagnostics(diagnostics)).toBe(true);
      expect(isRecruitmentWorkflowObservationDiagnostics(null)).toBe(false);
      expect(isRecruitmentWorkflowObservationDiagnostics({ severity: "INFO" })).toBe(false);
      expect(
        isRecruitmentWorkflowObservationDiagnostics({
          ...diagnostics,
          severity: "BAD"
        })
      ).toBe(false);
    });
  });

  describe("no persistence", () => {
    test("diagnostics payload remains advisory-only with no execution", () => {
      const diagnostics = buildRecruitmentWorkflowObservationDiagnostics(
        buildViewFromContext(advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.RESULT))
      );

      expect(diagnostics.advisory).toBe(true);
      expect(diagnostics.architectureOnly).toBe(true);
      expect(diagnostics.executed).toBe(false);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_DIAGNOSTICS_ADAPTER_METADATA.persistenceEnabled).toBe(
        false
      );
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_DIAGNOSTICS_ADAPTER_METADATA.sideEffects).toBe(false);
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares pure diagnostics projection constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 103");
      expect(source).toContain("buildRecruitmentWorkflowObservationDiagnostics");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("diagnosticsOnly");
      expect(source).toContain("rebuildsObservationViews");
    });

    test("module does not import express, database drivers, or filesystem APIs", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2/);
      expect(source).not.toMatch(/require\(["']https?["']\)/);
    });

    test("module does not import coordinator, registry, snapshot adapter, pipeline, or compatibility layer", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/recruitmentWorkflowIntegrationCoordinator/);
      expect(source).not.toMatch(/recruitmentWorkflowObservationRegistry/);
      expect(source).not.toMatch(/recruitmentWorkflowSnapshotAdapter/);
      expect(source).not.toMatch(/runRecruitmentPipeline/);
      expect(source).not.toMatch(/recruitmentCompatibilityLayer/);
      expect(source).not.toMatch(/recruitmentPipelineIntegrationHook/);
      expect(source).not.toMatch(/recruitmentCompatibilityIntegrationHook/);
    });

    test("module does not rebuild observation views or snapshots", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/buildRecruitmentWorkflowObservationView/);
      expect(source).not.toMatch(/buildRecruitmentWorkflowAdvisorySnapshot/);
      expect(source).not.toMatch(/recruitmentWorkflowAdvisorySummary/);
      expect(source).not.toMatch(/recruitmentWorkflowValidator/);
      expect(source).not.toMatch(/recruitmentLifecycleEventResolver/);
    });

    test("module validates observation views via isRecruitmentWorkflowObservationView only", () => {
      const source = read(MODULE_PATH);

      expect(source).toMatch(/isRecruitmentWorkflowObservationView/);
      expect(source).toMatch(/recruitmentWorkflowObservationView/);
    });

    test("diagnostics adapter is not wired into coordinator, pipeline, compatibility layer, registry, worker, or snapshot adapter", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const compatibilitySource = read(COMPATIBILITY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const registrySource = read(REGISTRY_MODULE_PATH);
      const snapshotAdapterSource = read(SNAPSHOT_ADAPTER_MODULE_PATH);

      expect(coordinatorSource).not.toMatch(/recruitmentWorkflowObservationDiagnosticsAdapter/);
      expect(compatibilitySource).not.toMatch(/recruitmentWorkflowObservationDiagnosticsAdapter/);
      expect(pipelineSource).not.toMatch(/recruitmentWorkflowObservationDiagnosticsAdapter/);
      expect(workerSource).not.toMatch(/recruitmentWorkflowObservationDiagnosticsAdapter/);
      expect(registrySource).not.toMatch(/recruitmentWorkflowObservationDiagnosticsAdapter/);
      expect(snapshotAdapterSource).not.toMatch(
        /recruitmentWorkflowObservationDiagnosticsAdapter/
      );
    });
  });
});
