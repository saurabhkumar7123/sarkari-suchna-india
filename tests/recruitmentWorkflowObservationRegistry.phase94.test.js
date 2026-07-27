"use strict";

/**
 * Phase 94 — Recruitment Workflow Observation Registry tests.
 * Coordinator deduplication, registry reuse, WeakMap behavior,
 * diagnostics, immutability, backward compatibility.
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
  WORKFLOW_OBSERVATION_REGISTRY_PHASE,
  WORKFLOW_OBSERVATION_REGISTRY_ENTITY,
  WORKFLOW_OBSERVATION_REGISTRY_METADATA,
  peekWorkflowObservation,
  hasWorkflowObservation,
  recordWorkflowObservation,
  peekWorkflowDiagnostics,
  recordWorkflowDiagnostics,
  peekCoordinatorExecutionState,
  getOrCreateWorkflowObservation
} = require("../server/lib/recruitment/recruitmentWorkflowObservationRegistry");

const {
  attachRecruitmentWorkflowIntegration,
  peekRecruitmentWorkflowIntegration,
  peekRecruitmentPipelineDiagnostics
} = require("../server/lib/recruitment/recruitmentPipelineIntegrationHook");

const {
  attachRecruitmentCompatibilityIntegration,
  peekRecruitmentCompatibilityIntegration,
  peekRecruitmentCompatibilityDiagnostics
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
const REGISTRY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowObservationRegistry.js";
const PIPELINE_HOOK_PATH = "server/lib/recruitment/recruitmentPipelineIntegrationHook.js";
const COMPATIBILITY_HOOK_PATH =
  "server/lib/recruitment/recruitmentCompatibilityIntegrationHook.js";

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
    updateId: 94,
    featureFlags: { workflowIntegrationEnabled: true },
    traceId: "phase-94-trace",
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

describe("Phase 94 — recruitmentWorkflowObservationRegistry", () => {
  beforeEach(() => {
    coordinateRecruitmentWorkflowIntegration.mockClear();
  });

  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(WORKFLOW_OBSERVATION_REGISTRY_PHASE).toBe(94);
      expect(WORKFLOW_OBSERVATION_REGISTRY_ENTITY).toBe(
        "recruitment_workflow_observation_registry"
      );
      expect(WORKFLOW_OBSERVATION_REGISTRY_METADATA.observationOnly).toBe(true);
      expect(WORKFLOW_OBSERVATION_REGISTRY_METADATA.persistenceEnabled).toBe(false);
    });
  });

  describe("registry helpers", () => {
    test("record and peek workflow observation", () => {
      const outcome = { updateId: 1 };
      const observation = Object.freeze({ featureEnabled: true });

      recordWorkflowObservation(outcome, observation);
      expect(hasWorkflowObservation(outcome)).toBe(true);
      expect(peekWorkflowObservation(outcome)).toEqual(observation);
    });

    test("record and peek workflow diagnostics", () => {
      const outcome = { updateId: 2 };
      const diagnostics = { summary: { stageCount: 1 } };

      recordWorkflowDiagnostics(outcome, diagnostics);
      const stored = peekWorkflowDiagnostics(outcome);
      expect(stored.summary).toEqual({ stageCount: 1 });
      expect(stored.architectureOnly).toBe(true);
      expect(stored.observationOnly).toBe(true);
    });

    test("getOrCreateWorkflowObservation invokes factory only once", () => {
      const outcome = { updateId: 3 };
      const factory = jest.fn(() => ({ featureEnabled: true, diagnostics: { source: "coordinator" } }));

      const first = getOrCreateWorkflowObservation(outcome, factory);
      const second = getOrCreateWorkflowObservation(outcome, factory);

      expect(factory).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
      expect(peekCoordinatorExecutionState(outcome).executed).toBe(true);
      expect(peekWorkflowDiagnostics(outcome)).not.toBeNull();
    });

    test("getOrCreateWorkflowObservation returns null for invalid outcome", () => {
      expect(getOrCreateWorkflowObservation(null, () => ({}))).toBeNull();
      expect(getOrCreateWorkflowObservation("bad", () => ({}))).toBeNull();
    });

    test("stored observations are deeply frozen", () => {
      const outcome = { updateId: 4 };
      getOrCreateWorkflowObservation(outcome, () => ({
        featureEnabled: true,
        diagnostics: { summary: { stageCount: 2 } }
      }));

      const nodes = collectFrozenNodes(peekWorkflowObservation(outcome));
      expect(nodes.length).toBeGreaterThan(0);
      for (let i = 0; i < nodes.length; i += 1) {
        expect(Object.isFrozen(nodes[i])).toBe(true);
      }
    });
  });

  describe("WeakMap isolation", () => {
    test("distinct outcomes receive independent registry entries", () => {
      const outcomeA = { updateId: 10 };
      const outcomeB = { updateId: 11 };

      getOrCreateWorkflowObservation(outcomeA, () => ({ featureEnabled: true, diagnostics: {} }));
      expect(hasWorkflowObservation(outcomeA)).toBe(true);
      expect(hasWorkflowObservation(outcomeB)).toBe(false);

      getOrCreateWorkflowObservation(outcomeB, () => ({
        featureEnabled: false,
        diagnostics: {}
      }));
      expect(peekWorkflowObservation(outcomeA).featureEnabled).toBe(true);
      expect(peekWorkflowObservation(outcomeB).featureEnabled).toBe(false);
    });
  });

  describe("coordinator executes once — compatibility first, pipeline second", () => {
    test("full pipeline run invokes coordinator exactly once", () => {
      const processDetection = jest.fn().mockReturnValue(mockProcessorResult());

      const result = runRecruitmentPipeline({
        notice: notice(),
        candidateRecruitments: [candidate()],
        isEnabled: true,
        processDetection,
        updateId: 94,
        featureFlags: { workflowIntegrationEnabled: true },
        traceId: "pipeline-94"
      });

      expect(coordinateRecruitmentWorkflowIntegration).toHaveBeenCalledTimes(1);
      expect(peekWorkflowObservation(result)).not.toBeNull();
      expect(peekRecruitmentCompatibilityIntegration(result)).not.toBeNull();
      expect(peekRecruitmentWorkflowIntegration(result)).not.toBeNull();
      expect(peekRecruitmentCompatibilityIntegration(result).integrationResult).toBe(
        peekWorkflowObservation(result)
      );
      expect(peekRecruitmentWorkflowIntegration(result).integrationResult).toBe(
        peekWorkflowObservation(result)
      );
    });

    test("manual compatibility then pipeline attach reuses registry observation", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 20 };
      const context = buildRecruitmentCompatibilityContext(enabledInput({ updateId: 20 }));

      attachRecruitmentCompatibilityIntegration(outcome, enabledInput({ updateId: 20 }), context);
      expect(coordinateRecruitmentWorkflowIntegration).toHaveBeenCalledTimes(1);

      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 20 }));
      expect(coordinateRecruitmentWorkflowIntegration).toHaveBeenCalledTimes(1);
      expect(peekWorkflowObservation(outcome)).toBe(
        peekRecruitmentCompatibilityIntegration(outcome).integrationResult
      );
    });
  });

  describe("coordinator executes once — pipeline first, compatibility second", () => {
    test("pipeline hook then compatibility hook reuses registry observation", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 21 };
      attachRecruitmentCompatibility(outcome, {
        notice: notice(),
        updateId: 21,
        featureFlags: { workflowIntegrationEnabled: false }
      });
      coordinateRecruitmentWorkflowIntegration.mockClear();

      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 21 }));
      expect(coordinateRecruitmentWorkflowIntegration).toHaveBeenCalledTimes(1);

      attachRecruitmentCompatibilityIntegration(
        outcome,
        enabledInput({ updateId: 21 }),
        peekRecruitmentCompatibility(outcome)
      );
      expect(coordinateRecruitmentWorkflowIntegration).toHaveBeenCalledTimes(1);
      expect(peekRecruitmentWorkflowIntegration(outcome).integrationResult).toBe(
        peekRecruitmentCompatibilityIntegration(outcome).integrationResult
      );
    });
  });

  describe("flag OFF — registry remains empty", () => {
    test("hooks do not populate registry when flag is off", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 30 };

      attachRecruitmentCompatibility(outcome, {
        notice: notice(),
        featureFlags: { workflowIntegrationEnabled: false }
      });
      attachRecruitmentWorkflowIntegration(outcome, {
        notice: notice(),
        featureFlags: { workflowIntegrationEnabled: false }
      });

      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
      expect(hasWorkflowObservation(outcome)).toBe(false);
      expect(peekWorkflowDiagnostics(outcome)).toBeNull();
      expect(peekCoordinatorExecutionState(outcome)).toBeNull();
    });
  });

  describe("diagnostics reuse", () => {
    test("registry stores coordinator diagnostics on first execution", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 40 };
      attachRecruitmentCompatibility(outcome, enabledInput({ updateId: 40 }));

      const registryDiagnostics = peekWorkflowDiagnostics(outcome);
      expect(registryDiagnostics).not.toBeNull();
      expect(registryDiagnostics.summary).toBeDefined();
    });

    test("hook-specific diagnostics remain separate while sharing integration result", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 41 };
      attachRecruitmentCompatibility(outcome, enabledInput({ updateId: 41 }));

      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 41 }));

      expect(peekRecruitmentCompatibilityDiagnostics(outcome)).not.toBeNull();
      expect(peekRecruitmentPipelineDiagnostics(outcome)).not.toBeNull();
      expect(peekRecruitmentCompatibilityDiagnostics(outcome)).not.toBe(
        peekRecruitmentPipelineDiagnostics(outcome)
      );
    });
  });

  describe("no persistence", () => {
    test("registry observation never enables persistence", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 50 };
      attachRecruitmentCompatibility(outcome, enabledInput({ updateId: 50 }));

      const observation = peekWorkflowObservation(outcome);
      expect(observation.metadata.persistenceEnabled).toBe(false);
      expect(observation.metadata.performsPersistence).toBe(false);
      expect(observation.metadata.sideEffects).toBe(false);
      expect(observation.integrationState.persistenceEnabled).toBe(false);
    });
  });

  describe("deterministic output", () => {
    test("identical inputs produce identical registry observations", () => {
      const input = enabledInput({ updateId: 60, traceId: "deterministic-94" });
      const outcomeA = { skipped: true, reason: "flag_off", updateId: 60 };
      const outcomeB = { skipped: true, reason: "flag_off", updateId: 60 };

      attachRecruitmentCompatibility(outcomeA, input);
      attachRecruitmentCompatibility(outcomeB, input);

      expect(peekWorkflowObservation(outcomeA).integrationState.status).toBe(
        peekWorkflowObservation(outcomeB).integrationState.status
      );
      expect(peekWorkflowObservation(outcomeA).featureEnabled).toBe(
        peekWorkflowObservation(outcomeB).featureEnabled
      );
    });
  });

  describe("backward compatibility", () => {
    test("hook peek APIs unchanged when flag is off", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 70 };
      attachRecruitmentCompatibility(outcome, { notice: notice(), updateId: 70 });

      expect(peekRecruitmentCompatibilityIntegration(outcome)).toBeNull();
      expect(peekRecruitmentWorkflowIntegration(outcome)).toBeNull();
    });

    test("pipeline public outcome unchanged with flag on", () => {
      const processorResult = mockProcessorResult();
      const processDetection = jest.fn().mockReturnValue(processorResult);

      const result = runRecruitmentPipeline({
        notice: notice(),
        isEnabled: true,
        processDetection,
        updateId: 71,
        featureFlags: { workflowIntegrationEnabled: true }
      });

      expect(result).toEqual({
        skipped: false,
        result: processorResult,
        updateId: 71
      });
      expect(Object.keys(result).sort()).toEqual(["result", "skipped", "updateId"]);
    });

    test("hook observations remain in separate WeakMap stores", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 72 };
      attachRecruitmentCompatibility(outcome, enabledInput({ updateId: 72 }));
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 72 }));

      expect(peekRecruitmentCompatibilityIntegration(outcome)).not.toBe(
        peekRecruitmentWorkflowIntegration(outcome)
      );
    });
  });

  describe("architecture boundaries", () => {
    test("registry module documents Phase 94 constraints", () => {
      const source = read(REGISTRY_MODULE_PATH);

      expect(source).toMatch(/Phase 94/);
      expect(source).toMatch(/WeakMap/);
      expect(source).toMatch(/No Express/);
      expect(source).toMatch(/No database/);
      expect(source).toMatch(/getOrCreateWorkflowObservation/);
    });

    test("registry uses WeakMap only for storage", () => {
      const source = read(REGISTRY_MODULE_PATH);

      expect(source).toMatch(/new WeakMap\(\)/);
      expect(source).not.toMatch(/process\.env/);
      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/require\(["']express/);
    });

    test("hooks delegate coordinator invocation through registry", () => {
      const pipelineSource = read(PIPELINE_HOOK_PATH);
      const compatibilitySource = read(COMPATIBILITY_HOOK_PATH);

      expect(pipelineSource).toMatch(/recruitmentWorkflowObservationRegistry/);
      expect(pipelineSource).toMatch(/getOrCreateWorkflowObservation/);
      expect(compatibilitySource).toMatch(/recruitmentWorkflowObservationRegistry/);
      expect(compatibilitySource).toMatch(/getOrCreateWorkflowObservation/);
    });
  });
});
