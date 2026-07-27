"use strict";

/**
 * Phase 104 — Recruitment Workflow Advisory Diagnostics Attachment tests.
 * Flag OFF/ON, snapshot available/missing, malformed outcome, determinism,
 * immutability, WeakMap storage, backward compatibility, and no persistence.
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
  RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_PHASE,
  RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_ENTITY,
  RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_METADATA,
  attachRecruitmentWorkflowDiagnostics,
  peekRecruitmentWorkflowDiagnostics,
  hasRecruitmentWorkflowDiagnostics
} = require("../server/lib/recruitment/recruitmentWorkflowDiagnosticsAttachment");

const {
  isRecruitmentWorkflowObservationDiagnostics,
  DIAGNOSTICS_SEVERITY
} = require("../server/lib/recruitment/recruitmentWorkflowObservationDiagnosticsAdapter");

const {
  OBSERVATION_VIEW_STATUS
} = require("../server/lib/recruitment/recruitmentWorkflowObservationView");

const {
  getRecruitmentWorkflowSnapshot,
  hasRecruitmentWorkflowSnapshot
} = require("../server/lib/recruitment/recruitmentWorkflowSnapshotAdapter");

const {
  peekWorkflowObservation,
  recordWorkflowObservation
} = require("../server/lib/recruitment/recruitmentWorkflowObservationRegistry");

const {
  attachRecruitmentWorkflowIntegration,
  attachRecruitmentPipelineDiagnostics,
  peekRecruitmentWorkflowIntegration,
  peekRecruitmentPipelineDiagnostics
} = require("../server/lib/recruitment/recruitmentPipelineIntegrationHook");

const {
  DIAGNOSTIC_STAGE_TYPES,
  createExecutionTrace,
  appendExecutionStage
} = require("../server/lib/recruitment/executionDiagnostics");

const {
  attachRecruitmentCompatibility,
  peekRecruitmentCompatibility
} = require("../server/lib/recruitment/recruitmentCompatibilityLayer");

const {
  attachRecruitmentCompatibilityIntegration,
  peekRecruitmentCompatibilityIntegration,
  peekRecruitmentCompatibilityDiagnostics
} = require("../server/lib/recruitment/recruitmentCompatibilityIntegrationHook");

const { runRecruitmentPipeline } = require("../server/lib/recruitment/runRecruitmentPipeline");
const { PROCESS_RESULT_STATUS } = require("../server/lib/recruitment/detectionProcessor");
const { coordinateRecruitmentWorkflowIntegration } = require(
  "../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator"
);

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowDiagnosticsAttachment.js";
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
    updateId: 201,
    featureFlags: { workflowIntegrationEnabled: true },
    traceId: "phase-104-trace",
    ...overrides
  };
}

function seedOpenDiagnostics(pipelineOutcome) {
  let trace = createExecutionTrace({
    traceId: "seed-trace-104",
    correlationId: "seed-correlation-104",
    pipelineRunId: "seed-run-104",
    contextId: "seed-context-104"
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

const EXPECTED_ATTACHMENT_KEYS = Object.freeze([
  "observationDiagnostics",
  "diagnostics",
  "executionDiagnostics",
  "metadata",
  "source"
]);

describe("Phase 104 — recruitmentWorkflowDiagnosticsAttachment", () => {
  beforeEach(() => {
    coordinateRecruitmentWorkflowIntegration.mockClear();
  });

  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_PHASE).toBe(104);
      expect(RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_ENTITY).toBe(
        "recruitment_workflow_diagnostics_attachment"
      );
      expect(RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_DESCRIPTOR.phase).toBe(104);
      expect(RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_METADATA.attachmentOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_METADATA.invokesCoordinator).toBe(false);
      expect(RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_METADATA.rebuildsSnapshots).toBe(false);
      expect(RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_METADATA.persistenceEnabled).toBe(false);
    });
  });

  describe("flag OFF", () => {
    test("returns null when workflow integration flag is disabled", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 301 };

      attachRecruitmentWorkflowIntegration(outcome, {
        notice: notice(),
        featureFlags: { workflowIntegrationEnabled: false }
      });

      expect(attachRecruitmentWorkflowDiagnostics(outcome)).toBeNull();
      expect(peekRecruitmentWorkflowDiagnostics(outcome)).toBeNull();
      expect(hasRecruitmentWorkflowDiagnostics(outcome)).toBe(false);
      expect(hasRecruitmentWorkflowSnapshot(outcome)).toBe(false);
    });

    test("does not invoke coordinator when flag is off", () => {
      const outcome = { skipped: true, updateId: 302 };

      attachRecruitmentWorkflowDiagnostics(outcome);

      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
    });
  });

  describe("flag ON", () => {
    test("attaches observation diagnostics when integration is enabled", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 303 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 303 }));

      const attachment = attachRecruitmentWorkflowDiagnostics(outcome);

      expect(attachment).not.toBeNull();
      expect(hasRecruitmentWorkflowDiagnostics(outcome)).toBe(true);
      expect(peekRecruitmentWorkflowDiagnostics(outcome)).toBe(attachment);
      expect(isRecruitmentWorkflowObservationDiagnostics(attachment.observationDiagnostics)).toBe(
        true
      );
      expect(attachment.diagnostics).toBe(attachment.observationDiagnostics);
      expect(attachment.source).toBe("phase_103_projection");
      expect(attachment.metadata.phase).toBe(104);
      expect(attachment.metadata.workflowIntegrationEnabled).toBe(true);
      expect(attachment.metadata.sourcePhases).toEqual([101, 102, 103]);
    });

    test("maps healthy advisory snapshot to INFO severity diagnostics", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 304 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 304 }));

      const attachment = attachRecruitmentWorkflowDiagnostics(outcome);

      expect(attachment.observationDiagnostics.severity).toBe(DIAGNOSTICS_SEVERITY.INFO);
      expect(attachment.observationDiagnostics.status).toBe(OBSERVATION_VIEW_STATUS.READY);
      expect(attachment.observationDiagnostics.advisory).toBe(true);
      expect(attachment.observationDiagnostics.executed).toBe(false);
    });
  });

  describe("snapshot available", () => {
    test("builds attachment from pipeline integration snapshot", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 305 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 305 }));

      const snapshot = getRecruitmentWorkflowSnapshot(outcome);
      const attachment = attachRecruitmentWorkflowDiagnostics(outcome);

      expect(snapshot).not.toBeNull();
      expect(attachment).not.toBeNull();
      expect(attachment.observationDiagnostics.snapshotComplete).toBe(
        snapshot.metadata.snapshotComplete
      );
    });

    test("additively extends execution diagnostics trace when an open fullTrace exists", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 306 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 306 }));

      const seeded = seedOpenDiagnostics(outcome);
      const stageCountBefore = seeded.fullTrace.stages.length;
      const pipelineDiagnosticsBefore = peekRecruitmentPipelineDiagnostics(outcome);

      const attachment = attachRecruitmentWorkflowDiagnostics(outcome);
      const pipelineDiagnosticsAfter = peekRecruitmentPipelineDiagnostics(outcome);

      expect(attachment.executionDiagnostics.appendedObservationDiagnosticsStage).toBe(true);
      expect(attachment.executionDiagnostics.fullTrace.stages.length).toBe(stageCountBefore + 1);
      expect(pipelineDiagnosticsAfter.fullTrace.stages.length).toBe(stageCountBefore);
      expect(pipelineDiagnosticsAfter).toBe(pipelineDiagnosticsBefore);
    });

    test("stores projection-only execution extension when no prior fullTrace exists", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 3061 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 3061 }));

      const attachment = attachRecruitmentWorkflowDiagnostics(outcome);

      expect(attachment.executionDiagnostics.appendedObservationDiagnosticsStage).toBe(false);
      expect(attachment.executionDiagnostics.source).toBe("phase_103_projection");
      expect(attachment.executionDiagnostics.observationDiagnostics).toBeDefined();
    });

    test("works after full pipeline run with flag enabled", () => {
      const processDetection = jest.fn().mockReturnValue(mockProcessorResult());
      const result = runRecruitmentPipeline({
        notice: notice(),
        candidateRecruitments: [candidate()],
        isEnabled: true,
        processDetection,
        updateId: 307,
        featureFlags: { workflowIntegrationEnabled: true },
        traceId: "pipeline-104"
      });

      attachRecruitmentWorkflowIntegration(result, enabledInput({ updateId: 307 }));

      const attachment = attachRecruitmentWorkflowDiagnostics(result);

      expect(attachment).not.toBeNull();
      expect(hasRecruitmentWorkflowDiagnostics(result)).toBe(true);
    });
  });

  describe("snapshot missing", () => {
    test("returns null for unrelated outcome objects", () => {
      expect(attachRecruitmentWorkflowDiagnostics(null)).toBeNull();
      expect(attachRecruitmentWorkflowDiagnostics(undefined)).toBeNull();
      expect(attachRecruitmentWorkflowDiagnostics({})).toBeNull();
      expect(hasRecruitmentWorkflowDiagnostics(null)).toBe(false);
    });

    test("returns null when observation has no valid advisory snapshot", () => {
      const outcome = { updateId: 308 };
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

      expect(attachRecruitmentWorkflowDiagnostics(outcome)).toBeNull();
      expect(hasRecruitmentWorkflowDiagnostics(outcome)).toBe(false);
    });

    test("returns null when plannedWorkflow is absent despite featureEnabled", () => {
      const outcome = { updateId: 309 };
      recordWorkflowObservation(outcome, {
        featureEnabled: true,
        plannedWorkflow: null,
        diagnostics: {}
      });

      expect(attachRecruitmentWorkflowDiagnostics(outcome)).toBeNull();
    });
  });

  describe("malformed outcome", () => {
    test("never throws for malformed inputs", () => {
      expect(() => attachRecruitmentWorkflowDiagnostics("bad")).not.toThrow();
      expect(() => attachRecruitmentWorkflowDiagnostics([])).not.toThrow();
      expect(() => peekRecruitmentWorkflowDiagnostics(42)).not.toThrow();
      expect(() => hasRecruitmentWorkflowDiagnostics(Symbol("x"))).not.toThrow();
    });

    test("returns null when featureEnabled is false even with registry observation", () => {
      const outcome = { updateId: 310 };
      recordWorkflowObservation(outcome, {
        featureEnabled: false,
        plannedWorkflow: null,
        diagnostics: {}
      });

      expect(attachRecruitmentWorkflowDiagnostics(outcome)).toBeNull();
    });
  });

  describe("deterministic behavior", () => {
    test("repeated attach returns the same cached attachment reference", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 311 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 311 }));

      const first = attachRecruitmentWorkflowDiagnostics(outcome);
      const second = attachRecruitmentWorkflowDiagnostics(outcome);
      const third = peekRecruitmentWorkflowDiagnostics(outcome);

      expect(second).toBe(first);
      expect(third).toBe(first);
      expect(coordinateRecruitmentWorkflowIntegration).toHaveBeenCalledTimes(1);
    });

    test("always exposes the stable attachment key set", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 312 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 312 }));

      const attachment = attachRecruitmentWorkflowDiagnostics(outcome);

      expect(Object.keys(attachment).sort()).toEqual([...EXPECTED_ATTACHMENT_KEYS].sort());
    });
  });

  describe("immutability", () => {
    test("does not mutate the pipeline outcome object", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 313 };
      const before = JSON.stringify(outcome);

      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 313 }));
      attachRecruitmentWorkflowDiagnostics(outcome);
      peekRecruitmentWorkflowDiagnostics(outcome);

      expect(JSON.stringify(outcome)).toBe(before);
      expect(outcome).not.toHaveProperty("observationDiagnostics");
      expect(outcome).not.toHaveProperty("workflowDiagnostics");
    });

    test("freezes entire attachment object graph", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 314 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 314 }));

      const attachment = attachRecruitmentWorkflowDiagnostics(outcome);

      assertAllFrozen(attachment);
      expect(() => {
        attachment.source = "mutated";
      }).toThrow();
    });
  });

  describe("WeakMap storage", () => {
    test("isolates attachments per outcome object", () => {
      const outcomeA = { skipped: false, result: mockProcessorResult(), updateId: 315 };
      const outcomeB = { skipped: false, result: mockProcessorResult(), updateId: 316 };

      attachRecruitmentWorkflowIntegration(outcomeA, enabledInput({ updateId: 315 }));
      attachRecruitmentWorkflowDiagnostics(outcomeA);

      expect(hasRecruitmentWorkflowDiagnostics(outcomeA)).toBe(true);
      expect(hasRecruitmentWorkflowDiagnostics(outcomeB)).toBe(false);
      expect(peekRecruitmentWorkflowDiagnostics(outcomeB)).toBeNull();
    });

    test("peek returns null until attach is called", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 317 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 317 }));

      expect(peekRecruitmentWorkflowDiagnostics(outcome)).toBeNull();

      const attachment = attachRecruitmentWorkflowDiagnostics(outcome);

      expect(peekRecruitmentWorkflowDiagnostics(outcome)).toBe(attachment);
    });
  });

  describe("backward compatibility", () => {
    test("does not alter existing registry, hook, or compatibility observations", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 318 };
      attachRecruitmentCompatibility(outcome, {
        notice: notice(),
        updateId: 318,
        featureFlags: { workflowIntegrationEnabled: false }
      });
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 318 }));

      const registryBefore = peekWorkflowObservation(outcome);
      const pipelineBefore = peekRecruitmentWorkflowIntegration(outcome);
      const compatibilityBefore = peekRecruitmentCompatibility(outcome);
      const pipelineDiagnosticsBefore = peekRecruitmentPipelineDiagnostics(outcome);

      attachRecruitmentWorkflowDiagnostics(outcome);

      expect(peekWorkflowObservation(outcome)).toBe(registryBefore);
      expect(peekRecruitmentWorkflowIntegration(outcome)).toBe(pipelineBefore);
      expect(peekRecruitmentCompatibility(outcome)).toBe(compatibilityBefore);
      expect(peekRecruitmentPipelineDiagnostics(outcome)).toBe(pipelineDiagnosticsBefore);
    });

    test("compatibility integration path still supports diagnostics attachment", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 319 };
      const { buildRecruitmentCompatibilityContext } = require(
        "../server/lib/recruitment/recruitmentCompatibilityLayer"
      );
      const context = buildRecruitmentCompatibilityContext(enabledInput({ updateId: 319 }));

      attachRecruitmentCompatibilityIntegration(outcome, enabledInput({ updateId: 319 }), context);

      const attachment = attachRecruitmentWorkflowDiagnostics(outcome);

      expect(attachment).not.toBeNull();
      expect(getRecruitmentWorkflowSnapshot(outcome)).toBe(
        peekRecruitmentCompatibilityIntegration(outcome).integrationResult.plannedWorkflow
          .workflowAdvisorySnapshot
      );
    });

    test("existing compatibility diagnostics remain unchanged after attach", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 320 };
      const { buildRecruitmentCompatibilityContext } = require(
        "../server/lib/recruitment/recruitmentCompatibilityLayer"
      );
      const context = buildRecruitmentCompatibilityContext(enabledInput({ updateId: 320 }));

      attachRecruitmentCompatibilityIntegration(outcome, enabledInput({ updateId: 320 }), context);

      const compatibilityDiagnosticsBefore = peekRecruitmentCompatibilityDiagnostics(outcome);

      attachRecruitmentWorkflowDiagnostics(outcome);

      expect(peekRecruitmentCompatibilityDiagnostics(outcome)).toBe(
        compatibilityDiagnosticsBefore
      );
    });
  });

  describe("no persistence", () => {
    test("attachment metadata declares no persistence or production mutation", () => {
      expect(RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_METADATA.sideEffects).toBe(false);
    });

    test("attached diagnostics remain advisory-only with no execution", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 321 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 321 }));

      const attachment = attachRecruitmentWorkflowDiagnostics(outcome);

      expect(attachment.observationDiagnostics.advisory).toBe(true);
      expect(attachment.observationDiagnostics.architectureOnly).toBe(true);
      expect(attachment.observationDiagnostics.executed).toBe(false);
      expect(attachment.metadata.advisoryOnly).toBe(true);
      expect(attachment.executionDiagnostics.advisoryOnly).toBe(true);
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares pure attachment constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 104");
      expect(source).toContain("attachRecruitmentWorkflowDiagnostics");
      expect(source).toContain("peekRecruitmentWorkflowDiagnostics");
      expect(source).toContain("hasRecruitmentWorkflowDiagnostics");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("attachmentOnly");
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

    test("module does not invoke coordinator or rebuild snapshots", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/coordinateRecruitmentWorkflowIntegration/);
      expect(source).not.toMatch(/getOrCreateWorkflowObservation/);
      expect(source).not.toMatch(/buildRecruitmentWorkflowAdvisorySnapshot/);
      expect(source).not.toMatch(/attachRecruitmentWorkflowIntegration/);
      expect(source).not.toMatch(/attachRecruitmentCompatibilityIntegration/);
    });

    test("module reuses Phase 101, 102, and 103 adapters only", () => {
      const source = read(MODULE_PATH);

      expect(source).toMatch(/recruitmentWorkflowSnapshotAdapter/);
      expect(source).toMatch(/getRecruitmentWorkflowSnapshot/);
      expect(source).toMatch(/recruitmentWorkflowObservationView/);
      expect(source).toMatch(/buildRecruitmentWorkflowObservationView/);
      expect(source).toMatch(/recruitmentWorkflowObservationDiagnosticsAdapter/);
      expect(source).toMatch(/buildRecruitmentWorkflowObservationDiagnostics/);
    });

    test("module peeks existing execution diagnostics without mutating hook WeakMaps", () => {
      const source = read(MODULE_PATH);

      expect(source).toMatch(/peekRecruitmentPipelineDiagnostics/);
      expect(source).toMatch(/peekRecruitmentCompatibilityDiagnostics/);
      expect(source).toMatch(/peekWorkflowDiagnostics/);
      expect(source).not.toMatch(/attachRecruitmentPipelineDiagnostics/);
      expect(source).not.toMatch(/attachRecruitmentCompatibilityDiagnostics/);
      expect(source).not.toMatch(/recordWorkflowDiagnostics/);
    });

    test("attachment module is not wired into coordinator, pipeline, compatibility layer, registry, worker, or upstream adapters", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const compatibilitySource = read(COMPATIBILITY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const registrySource = read(REGISTRY_MODULE_PATH);
      const snapshotAdapterSource = read(SNAPSHOT_ADAPTER_MODULE_PATH);
      const observationViewSource = read(OBSERVATION_VIEW_MODULE_PATH);
      const diagnosticsAdapterSource = read(DIAGNOSTICS_ADAPTER_MODULE_PATH);

      expect(coordinatorSource).not.toMatch(/recruitmentWorkflowDiagnosticsAttachment/);
      expect(compatibilitySource).not.toMatch(/recruitmentWorkflowDiagnosticsAttachment/);
      expect(pipelineSource).not.toMatch(/recruitmentWorkflowDiagnosticsAttachment/);
      expect(workerSource).not.toMatch(/recruitmentWorkflowDiagnosticsAttachment/);
      expect(registrySource).not.toMatch(/recruitmentWorkflowDiagnosticsAttachment/);
      expect(snapshotAdapterSource).not.toMatch(/recruitmentWorkflowDiagnosticsAttachment/);
      expect(observationViewSource).not.toMatch(/recruitmentWorkflowDiagnosticsAttachment/);
      expect(diagnosticsAdapterSource).not.toMatch(/recruitmentWorkflowDiagnosticsAttachment/);
    });
  });
});
