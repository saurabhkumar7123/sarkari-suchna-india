"use strict";

/**
 * Phase 105 — Recruitment Workflow Observation Service tests.
 * Snapshot exists/missing, attachment exists/missing, malformed outcome,
 * determinism, immutability, summary helper, validation, architecture
 * boundaries, and no persistence.
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
  RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_PHASE,
  RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_ENTITY,
  RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_METADATA,
  EMPTY_OBSERVATION_SUMMARY,
  getRecruitmentWorkflowObservation,
  hasRecruitmentWorkflowObservation,
  summarizeRecruitmentWorkflowObservation,
  isRecruitmentWorkflowObservation
} = require("../server/lib/recruitment/recruitmentWorkflowObservationService");

const {
  getRecruitmentWorkflowSnapshot,
  hasRecruitmentWorkflowSnapshot
} = require("../server/lib/recruitment/recruitmentWorkflowSnapshotAdapter");

const {
  buildRecruitmentWorkflowObservationView,
  OBSERVATION_VIEW_STATUS,
  OBSERVATION_VIEW_HEALTH
} = require("../server/lib/recruitment/recruitmentWorkflowObservationView");

const {
  buildRecruitmentWorkflowObservationDiagnostics,
  DIAGNOSTICS_SEVERITY
} = require("../server/lib/recruitment/recruitmentWorkflowObservationDiagnosticsAdapter");

const {
  attachRecruitmentWorkflowDiagnostics,
  peekRecruitmentWorkflowDiagnostics,
  hasRecruitmentWorkflowDiagnostics
} = require("../server/lib/recruitment/recruitmentWorkflowDiagnosticsAttachment");

const {
  peekWorkflowObservation,
  recordWorkflowObservation
} = require("../server/lib/recruitment/recruitmentWorkflowObservationRegistry");

const {
  attachRecruitmentWorkflowIntegration,
  peekRecruitmentWorkflowIntegration
} = require("../server/lib/recruitment/recruitmentPipelineIntegrationHook");

const {
  attachRecruitmentCompatibilityIntegration,
  peekRecruitmentCompatibilityIntegration
} = require("../server/lib/recruitment/recruitmentCompatibilityIntegrationHook");

const {
  attachRecruitmentCompatibility,
  buildRecruitmentCompatibilityContext,
  peekRecruitmentCompatibility
} = require("../server/lib/recruitment/recruitmentCompatibilityLayer");

const { runRecruitmentPipeline } = require("../server/lib/recruitment/runRecruitmentPipeline");
const { PROCESS_RESULT_STATUS } = require("../server/lib/recruitment/detectionProcessor");
const { coordinateRecruitmentWorkflowIntegration } = require(
  "../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator"
);

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowObservationService.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const COMPATIBILITY_MODULE_PATH = "server/lib/recruitment/recruitmentCompatibilityLayer.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";
const REGISTRY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowObservationRegistry.js";
const SNAPSHOT_ADAPTER_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowSnapshotAdapter.js";
const OBSERVATION_VIEW_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowObservationView.js";
const DIAGNOSTICS_ADAPTER_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowObservationDiagnosticsAdapter.js";
const DIAGNOSTICS_ATTACHMENT_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowDiagnosticsAttachment.js";

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
    updateId: 105,
    featureFlags: { workflowIntegrationEnabled: true },
    traceId: "phase-105-trace",
    ...overrides
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

const EXPECTED_OBSERVATION_KEYS = Object.freeze([
  "snapshot",
  "observation",
  "diagnostics",
  "attachment",
  "advisory",
  "architectureOnly",
  "executed"
]);

describe("Phase 105 — recruitmentWorkflowObservationService", () => {
  beforeEach(() => {
    coordinateRecruitmentWorkflowIntegration.mockClear();
  });

  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_PHASE).toBe(105);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_ENTITY).toBe(
        "recruitment_workflow_observation_service"
      );
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_DESCRIPTOR.phase).toBe(105);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_METADATA.facadeOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_METADATA.invokesCoordinator).toBe(false);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_METADATA.sourcePhases).toEqual([
        101, 102, 103, 104
      ]);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_METADATA.persistenceEnabled).toBe(false);
    });
  });

  describe("snapshot exists", () => {
    test("composes observation bundle from pipeline integration snapshot", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 501 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 501 }));

      const bundle = getRecruitmentWorkflowObservation(outcome);
      const snapshot = getRecruitmentWorkflowSnapshot(outcome);

      expect(bundle.snapshot).toBe(snapshot);
      expect(bundle.snapshot).not.toBeNull();
      expect(hasRecruitmentWorkflowObservation(outcome)).toBe(true);
      expect(bundle.observation).toEqual(buildRecruitmentWorkflowObservationView(snapshot));
      expect(bundle.diagnostics).toEqual(
        buildRecruitmentWorkflowObservationDiagnostics(bundle.observation)
      );
      expect(bundle.advisory).toBe(true);
      expect(bundle.architectureOnly).toBe(true);
      expect(bundle.executed).toBe(false);
    });

    test("works after full pipeline run with flag enabled", () => {
      const processDetection = jest.fn().mockReturnValue(mockProcessorResult());
      const result = runRecruitmentPipeline({
        notice: notice(),
        candidateRecruitments: [candidate()],
        isEnabled: true,
        processDetection,
        updateId: 502,
        featureFlags: { workflowIntegrationEnabled: true },
        traceId: "pipeline-105"
      });

      attachRecruitmentWorkflowIntegration(result, enabledInput({ updateId: 502 }));

      const bundle = getRecruitmentWorkflowObservation(result);

      expect(bundle.snapshot).not.toBeNull();
      expect(hasRecruitmentWorkflowObservation(result)).toBe(true);
      expect(bundle.observation.status).toBe(OBSERVATION_VIEW_STATUS.READY);
    });

    test("compatibility integration path still resolves observation bundle", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 503 };
      const context = buildRecruitmentCompatibilityContext(enabledInput({ updateId: 503 }));

      attachRecruitmentCompatibilityIntegration(outcome, enabledInput({ updateId: 503 }), context);

      const bundle = getRecruitmentWorkflowObservation(outcome);

      expect(bundle.snapshot).toBe(
        peekRecruitmentCompatibilityIntegration(outcome).integrationResult.plannedWorkflow
          .workflowAdvisorySnapshot
      );
      expect(hasRecruitmentWorkflowObservation(outcome)).toBe(true);
    });
  });

  describe("snapshot missing", () => {
    test("returns null snapshot with empty projections when flag is off", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 504 };

      attachRecruitmentWorkflowIntegration(outcome, {
        notice: notice(),
        featureFlags: { workflowIntegrationEnabled: false }
      });

      const bundle = getRecruitmentWorkflowObservation(outcome);

      expect(bundle.snapshot).toBeNull();
      expect(hasRecruitmentWorkflowObservation(outcome)).toBe(false);
      expect(bundle.observation.status).toBe(OBSERVATION_VIEW_STATUS.UNKNOWN);
      expect(bundle.diagnostics.severity).toBe(DIAGNOSTICS_SEVERITY.UNKNOWN);
      expect(bundle.attachment).toBeNull();
    });

    test("returns null snapshot for unrelated outcome objects", () => {
      const bundle = getRecruitmentWorkflowObservation({});

      expect(bundle.snapshot).toBeNull();
      expect(hasRecruitmentWorkflowObservation({})).toBe(false);
      expect(hasRecruitmentWorkflowObservation(null)).toBe(false);
    });

    test("returns null snapshot when observation has no valid advisory snapshot", () => {
      const outcome = { updateId: 505 };
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

      const bundle = getRecruitmentWorkflowObservation(outcome);

      expect(bundle.snapshot).toBeNull();
      expect(hasRecruitmentWorkflowObservation(outcome)).toBe(false);
    });
  });

  describe("attachment exists", () => {
    test("includes Phase 104 attachment when previously attached", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 506 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 506 }));

      const attachment = attachRecruitmentWorkflowDiagnostics(outcome);
      const bundle = getRecruitmentWorkflowObservation(outcome);

      expect(attachment).not.toBeNull();
      expect(bundle.attachment).toBe(attachment);
      expect(bundle.attachment.observationDiagnostics).toEqual(bundle.diagnostics);
    });

    test("peek-only: service does not create attachment when none was attached", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 507 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 507 }));

      const bundle = getRecruitmentWorkflowObservation(outcome);

      expect(bundle.snapshot).not.toBeNull();
      expect(bundle.attachment).toBeNull();
      expect(hasRecruitmentWorkflowDiagnostics(outcome)).toBe(false);
      expect(peekRecruitmentWorkflowDiagnostics(outcome)).toBeNull();
    });
  });

  describe("attachment missing", () => {
    test("returns null attachment for malformed outcomes", () => {
      const bundle = getRecruitmentWorkflowObservation(null);

      expect(bundle.attachment).toBeNull();
    });

    test("returns null attachment when snapshot is unavailable", () => {
      const outcome = { updateId: 508 };
      const bundle = getRecruitmentWorkflowObservation(outcome);

      expect(bundle.attachment).toBeNull();
    });
  });

  describe("malformed outcome", () => {
    test("never throws for malformed inputs", () => {
      expect(() => getRecruitmentWorkflowObservation("bad")).not.toThrow();
      expect(() => getRecruitmentWorkflowObservation([])).not.toThrow();
      expect(() => hasRecruitmentWorkflowObservation(42)).not.toThrow();
      expect(() => summarizeRecruitmentWorkflowObservation(Symbol("x"))).not.toThrow();
      expect(() => isRecruitmentWorkflowObservation(undefined)).not.toThrow();
    });

    test("returns stable empty bundle for non-object inputs", () => {
      const bundle = getRecruitmentWorkflowObservation("bad");

      expect(bundle.snapshot).toBeNull();
      expect(bundle.observation.health).toBe(OBSERVATION_VIEW_HEALTH.UNKNOWN);
      expect(bundle.diagnostics.severity).toBe(DIAGNOSTICS_SEVERITY.UNKNOWN);
      expect(bundle.attachment).toBeNull();
    });
  });

  describe("deterministic behavior", () => {
    test("repeated reads return deeply equal bundles", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 509 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 509 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const first = getRecruitmentWorkflowObservation(outcome);
      const second = getRecruitmentWorkflowObservation(outcome);

      expect(second).toEqual(first);
      expect(second).not.toBe(first);
      expect(summarizeRecruitmentWorkflowObservation(outcome)).toEqual(
        summarizeRecruitmentWorkflowObservation(outcome)
      );
    });

    test("always exposes the stable observation key set", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 510 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 510 }));

      const bundle = getRecruitmentWorkflowObservation(outcome);

      expect(Object.keys(bundle).sort()).toEqual([...EXPECTED_OBSERVATION_KEYS].sort());
    });

    test("does not invoke coordinator during observation reads", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 511 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 511 }));
      coordinateRecruitmentWorkflowIntegration.mockClear();

      getRecruitmentWorkflowObservation(outcome);
      hasRecruitmentWorkflowObservation(outcome);
      summarizeRecruitmentWorkflowObservation(outcome);

      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
    });
  });

  describe("immutability", () => {
    test("does not mutate the pipeline outcome object", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 512 };
      const before = JSON.stringify(outcome);

      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 512 }));
      getRecruitmentWorkflowObservation(outcome);
      summarizeRecruitmentWorkflowObservation(outcome);

      expect(JSON.stringify(outcome)).toBe(before);
      expect(outcome).not.toHaveProperty("observation");
      expect(outcome).not.toHaveProperty("diagnostics");
    });

    test("freezes entire observation bundle object graph", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 513 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 513 }));

      const bundle = getRecruitmentWorkflowObservation(outcome);

      assertAllFrozen(bundle);
      expect(() => {
        bundle.advisory = false;
      }).toThrow();
    });

    test("summary helper returns frozen object", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 514 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 514 }));

      const summary = summarizeRecruitmentWorkflowObservation(outcome);

      expect(Object.isFrozen(summary)).toBe(true);
    });
  });

  describe("summary helper", () => {
    test("summarizes diagnostics fields including monitoringRequired", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 515 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 515 }));

      const bundle = getRecruitmentWorkflowObservation(outcome);
      const summary = summarizeRecruitmentWorkflowObservation(outcome);

      expect(summary).toEqual({
        lifecycle: bundle.diagnostics.lifecycle,
        health: bundle.diagnostics.health,
        recommendation: bundle.diagnostics.recommendation,
        severity: bundle.diagnostics.severity,
        monitoringRequired: bundle.diagnostics.monitoringRequired
      });
      expect(summary.lifecycle).toBe("ADMIT_CARD");
      expect(typeof summary.monitoringRequired).toBe("boolean");
    });

    test("returns UNKNOWN summary when snapshot is unavailable", () => {
      const summary = summarizeRecruitmentWorkflowObservation({});

      expect(summary).toEqual(EMPTY_OBSERVATION_SUMMARY);
      expect(Object.isFrozen(summary)).toBe(true);
    });
  });

  describe("validation", () => {
    test("accepts projected observation bundles and rejects malformed values", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 516 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 516 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const bundle = getRecruitmentWorkflowObservation(outcome);

      expect(isRecruitmentWorkflowObservation(bundle)).toBe(true);
      expect(isRecruitmentWorkflowObservation(null)).toBe(false);
      expect(isRecruitmentWorkflowObservation({ snapshot: null })).toBe(false);
      expect(
        isRecruitmentWorkflowObservation({
          ...bundle,
          advisory: false
        })
      ).toBe(false);
    });

    test("hasRecruitmentWorkflowObservation aligns with snapshot presence", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 517 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 517 }));

      expect(hasRecruitmentWorkflowObservation(outcome)).toBe(hasRecruitmentWorkflowSnapshot(outcome));
      expect(hasRecruitmentWorkflowObservation(outcome)).toBe(true);
    });
  });

  describe("backward compatibility", () => {
    test("does not alter existing registry, hook, or compatibility observations", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 518 };
      attachRecruitmentCompatibility(outcome, {
        notice: notice(),
        updateId: 518,
        featureFlags: { workflowIntegrationEnabled: false }
      });
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 518 }));

      const registryBefore = peekWorkflowObservation(outcome);
      const pipelineBefore = peekRecruitmentWorkflowIntegration(outcome);
      const compatibilityBefore = peekRecruitmentCompatibility(outcome);

      getRecruitmentWorkflowObservation(outcome);

      expect(peekWorkflowObservation(outcome)).toBe(registryBefore);
      expect(peekRecruitmentWorkflowIntegration(outcome)).toBe(pipelineBefore);
      expect(peekRecruitmentCompatibility(outcome)).toBe(compatibilityBefore);
    });
  });

  describe("no persistence", () => {
    test("service metadata declares no persistence or production mutation", () => {
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_METADATA.sideEffects).toBe(false);
    });

    test("observation bundle remains advisory-only with no execution", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 519 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 519 }));

      const bundle = getRecruitmentWorkflowObservation(outcome);

      expect(bundle.advisory).toBe(true);
      expect(bundle.architectureOnly).toBe(true);
      expect(bundle.executed).toBe(false);
      expect(bundle.diagnostics.advisory).toBe(true);
      expect(bundle.observation.executed).toBe(false);
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares pure facade constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 105");
      expect(source).toContain("getRecruitmentWorkflowObservation");
      expect(source).toContain("hasRecruitmentWorkflowObservation");
      expect(source).toContain("summarizeRecruitmentWorkflowObservation");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("facadeOnly");
      expect(source).toContain("invokesCoordinator");
    });

    test("module does not import express, database drivers, or filesystem APIs", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2/);
      expect(source).not.toMatch(/require\(["']https?["']\)/);
    });

    test("module does not import coordinator, registry, pipeline, compatibility layer, or worker", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/recruitmentWorkflowIntegrationCoordinator/);
      expect(source).not.toMatch(/recruitmentWorkflowObservationRegistry/);
      expect(source).not.toMatch(/runRecruitmentPipeline/);
      expect(source).not.toMatch(/recruitmentCompatibilityLayer/);
      expect(source).not.toMatch(/recruitmentPipelineIntegrationHook/);
      expect(source).not.toMatch(/recruitmentCompatibilityIntegrationHook/);
      expect(source).not.toMatch(/siteWorker/);
      expect(source).not.toMatch(/recruitmentWorkerObservation/);
    });

    test("module reuses Phase 101, 102, 103, and 104 adapters only", () => {
      const source = read(MODULE_PATH);

      expect(source).toMatch(/recruitmentWorkflowSnapshotAdapter/);
      expect(source).toMatch(/getRecruitmentWorkflowSnapshot/);
      expect(source).toMatch(/recruitmentWorkflowObservationView/);
      expect(source).toMatch(/buildRecruitmentWorkflowObservationView/);
      expect(source).toMatch(/recruitmentWorkflowObservationDiagnosticsAdapter/);
      expect(source).toMatch(/buildRecruitmentWorkflowObservationDiagnostics/);
      expect(source).toMatch(/recruitmentWorkflowDiagnosticsAttachment/);
      expect(source).toMatch(/peekRecruitmentWorkflowDiagnostics/);
    });

    test("module peeks attachments without invoking attach side effects", () => {
      const source = read(MODULE_PATH);

      expect(source).toMatch(/peekRecruitmentWorkflowDiagnostics/);
      expect(source).not.toMatch(/attachRecruitmentWorkflowDiagnostics/);
      expect(source).not.toMatch(/coordinateRecruitmentWorkflowIntegration/);
      expect(source).not.toMatch(/buildRecruitmentWorkflowAdvisorySnapshot/);
    });

    test("observation service is not wired into coordinator, pipeline, compatibility layer, registry, worker, or upstream adapters", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const compatibilitySource = read(COMPATIBILITY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const registrySource = read(REGISTRY_MODULE_PATH);
      const snapshotAdapterSource = read(SNAPSHOT_ADAPTER_MODULE_PATH);
      const observationViewSource = read(OBSERVATION_VIEW_MODULE_PATH);
      const diagnosticsAdapterSource = read(DIAGNOSTICS_ADAPTER_MODULE_PATH);
      const diagnosticsAttachmentSource = read(DIAGNOSTICS_ATTACHMENT_MODULE_PATH);

      expect(coordinatorSource).not.toMatch(/recruitmentWorkflowObservationService/);
      expect(compatibilitySource).not.toMatch(/recruitmentWorkflowObservationService/);
      expect(pipelineSource).not.toMatch(/recruitmentWorkflowObservationService/);
      expect(workerSource).not.toMatch(/recruitmentWorkflowObservationService/);
      expect(registrySource).not.toMatch(/recruitmentWorkflowObservationService/);
      expect(snapshotAdapterSource).not.toMatch(/recruitmentWorkflowObservationService/);
      expect(observationViewSource).not.toMatch(/recruitmentWorkflowObservationService/);
      expect(diagnosticsAdapterSource).not.toMatch(/recruitmentWorkflowObservationService/);
      expect(diagnosticsAttachmentSource).not.toMatch(/recruitmentWorkflowObservationService/);
    });
  });
});
