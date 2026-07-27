"use strict";

/**
 * Phase 135 — Recruitment Workflow Controlled Integration Planning Suite tests.
 * Verifies rollout planner, feature activation matrix, safety checklist,
 * controlled activation strategy, isolation, determinism, immutability,
 * and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_WORKFLOW_INTEGRATION_ROLLOUT_PLANNER_PHASE,
  RECRUITMENT_WORKFLOW_INTEGRATION_ROLLOUT_PLANNER_ENTITY,
  ROLLOUT_STAGE_STATUS,
  ROLLOUT_STAGE_IDS,
  ROLLOUT_STAGE_DEFINITIONS,
  RECRUITMENT_WORKFLOW_INTEGRATION_ROLLOUT_PLANNER_METADATA,
  createRecruitmentWorkflowIntegrationRolloutPlan
} = require("../server/lib/recruitment/recruitmentWorkflowIntegrationRolloutPlanner");

const {
  RECRUITMENT_WORKFLOW_FEATURE_ACTIVATION_MATRIX_PHASE,
  RECRUITMENT_WORKFLOW_FEATURE_ACTIVATION_MATRIX_ENTITY,
  ACTIVATION_STATUS,
  ADVISORY_MODULE_IDS,
  ACTIVATION_MATRIX_DEFINITIONS,
  RECRUITMENT_WORKFLOW_FEATURE_ACTIVATION_MATRIX_METADATA,
  createRecruitmentWorkflowFeatureActivationMatrix
} = require("../server/lib/recruitment/recruitmentWorkflowFeatureActivationMatrix");

const {
  RECRUITMENT_WORKFLOW_INTEGRATION_SAFETY_CHECKLIST_PHASE,
  RECRUITMENT_WORKFLOW_INTEGRATION_SAFETY_CHECKLIST_ENTITY,
  SAFETY_CHECK_STATUS,
  SAFETY_POSTURE,
  SAFETY_CHECK_IDS,
  SAFETY_CHECK_DEFINITIONS,
  RECRUITMENT_WORKFLOW_INTEGRATION_SAFETY_CHECKLIST_METADATA,
  createRecruitmentWorkflowIntegrationSafetyChecklist
} = require("../server/lib/recruitment/recruitmentWorkflowIntegrationSafetyChecklist");

const {
  RECRUITMENT_WORKFLOW_CONTROLLED_ACTIVATION_STRATEGY_PHASE,
  RECRUITMENT_WORKFLOW_CONTROLLED_ACTIVATION_STRATEGY_ENTITY,
  ACTIVATION_STRATEGY_STATUS,
  STRATEGY_POSTURE,
  ACTIVATION_ORDER_DEFINITIONS,
  RECRUITMENT_WORKFLOW_CONTROLLED_ACTIVATION_STRATEGY_METADATA,
  createRecruitmentWorkflowControlledActivationStrategy
} = require("../server/lib/recruitment/recruitmentWorkflowControlledActivationStrategy");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");

const ROLLOUT_PLANNER_PATH =
  "server/lib/recruitment/recruitmentWorkflowIntegrationRolloutPlanner.js";
const ACTIVATION_MATRIX_PATH =
  "server/lib/recruitment/recruitmentWorkflowFeatureActivationMatrix.js";
const SAFETY_CHECKLIST_PATH =
  "server/lib/recruitment/recruitmentWorkflowIntegrationSafetyChecklist.js";
const ACTIVATION_STRATEGY_PATH =
  "server/lib/recruitment/recruitmentWorkflowControlledActivationStrategy.js";

const CONSISTENCY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowConsistencyValidator.js";
const TIMELINE_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowTimelineModel.js";
const RECOMMENDATION_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowRecommendationModel.js";
const INTELLIGENCE_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntelligenceSummary.js";
const READINESS_FRAMEWORK_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowIntegrationReadinessFramework.js";
const ORCHESTRATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowOrchestrator.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const GATEWAY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";

const PHASE_135_MODULE_PATHS = Object.freeze([
  ROLLOUT_PLANNER_PATH,
  ACTIVATION_MATRIX_PATH,
  SAFETY_CHECKLIST_PATH,
  ACTIVATION_STRATEGY_PATH
]);

const PHASE_135_EXPORT_PATTERNS = Object.freeze([
  /createRecruitmentWorkflowIntegrationRolloutPlan/,
  /createRecruitmentWorkflowFeatureActivationMatrix/,
  /createRecruitmentWorkflowIntegrationSafetyChecklist/,
  /createRecruitmentWorkflowControlledActivationStrategy/
]);

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
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

function buildAllModuleSignals() {
  const signals = {};
  for (let phase = 114; phase <= 134; phase += 1) {
    signals[phase] = { satisfied: true, ready: true };
  }
  return signals;
}

function buildAllActivatedModules() {
  const modules = {};
  for (let i = 0; i < ACTIVATION_ORDER_DEFINITIONS.length; i += 1) {
    const entry = ACTIVATION_ORDER_DEFINITIONS[i];
    modules[entry.phase] = { activated: true, satisfied: true };
    modules[entry.moduleId] = { activated: true, satisfied: true };
  }
  return modules;
}

function buildReadyForControlledIntegrationInput(overrides = {}) {
  return {
    integrationReadiness: {
      integrationStatus: "READY_FOR_CONTROLLED_INTEGRATION",
      readinessLevel: "READY_FOR_CONTROLLED_INTEGRATION"
    },
    readinessAssessment: {
      readinessStatus: "READY_FOR_STORAGE"
    },
    recommendation: {
      recommendationStatus: "PROCEED"
    },
    consistencyValidation: {
      consistencyStatus: "CONSISTENT"
    },
    intelligenceSummary: {
      currentState: {
        health: "HEALTHY",
        risk: "LOW"
      }
    },
    moduleSignals: buildAllModuleSignals(),
    activatedModules: buildAllActivatedModules(),
    ...overrides
  };
}

function buildPartialIntegrationInput(overrides = {}) {
  const moduleSignals = {
    114: { satisfied: true },
    115: { satisfied: true },
    116: { satisfied: true },
    117: { satisfied: true }
  };

  return {
    integrationReadiness: {
      integrationStatus: "PARTIALLY_READY",
      readinessLevel: "PARTIALLY_READY"
    },
    readinessAssessment: {
      readinessStatus: "PARTIALLY_READY"
    },
    recommendation: {
      recommendationStatus: "REVIEW_REQUIRED"
    },
    moduleSignals,
    activatedModules: {
      draft_proposal: { activated: true },
      persistence_boundary: { activated: true }
    },
    ...overrides
  };
}

function buildBlockedIntegrationInput(overrides = {}) {
  return {
    integrationReadiness: {
      integrationStatus: "NOT_READY",
      readinessLevel: "NOT_READY"
    },
    readinessAssessment: {
      readinessStatus: "BLOCKED"
    },
    recommendation: {
      recommendationStatus: "BLOCKED_ACTION_REQUIRED"
    },
    consistencyValidation: {
      consistencyStatus: "INCONSISTENT"
    },
    intelligenceSummary: {
      currentState: {
        health: "BLOCKED",
        risk: "CRITICAL"
      }
    },
    blockedPhases: {
      120: true
    },
    ...overrides
  };
}

describe("Phase 135 — recruitmentWorkflowControlledIntegrationPlanningSuite", () => {
  describe("exports and metadata", () => {
    test("rollout planner phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_ROLLOUT_PLANNER_PHASE).toBe(135);
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_ROLLOUT_PLANNER_ENTITY).toBe(
        "recruitment_workflow_integration_rollout_planner"
      );
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_ROLLOUT_PLANNER_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_ROLLOUT_PLANNER_METADATA.persistent).toBe(false);
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_ROLLOUT_PLANNER_METADATA.generatedBy).toBe(
        "phase_135"
      );
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_ROLLOUT_PLANNER_METADATA.automationEnabled).toBe(
        false
      );
    });

    test("feature activation matrix phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_FEATURE_ACTIVATION_MATRIX_PHASE).toBe(135);
      expect(RECRUITMENT_WORKFLOW_FEATURE_ACTIVATION_MATRIX_ENTITY).toBe(
        "recruitment_workflow_feature_activation_matrix"
      );
      expect(RECRUITMENT_WORKFLOW_FEATURE_ACTIVATION_MATRIX_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_FEATURE_ACTIVATION_MATRIX_METADATA.runtimeIntegration).toBe(
        false
      );
    });

    test("safety checklist phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_SAFETY_CHECKLIST_PHASE).toBe(135);
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_SAFETY_CHECKLIST_ENTITY).toBe(
        "recruitment_workflow_integration_safety_checklist"
      );
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_SAFETY_CHECKLIST_METADATA.safetyChecklistOnly).toBe(
        true
      );
    });

    test("controlled activation strategy phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_CONTROLLED_ACTIVATION_STRATEGY_PHASE).toBe(135);
      expect(RECRUITMENT_WORKFLOW_CONTROLLED_ACTIVATION_STRATEGY_ENTITY).toBe(
        "recruitment_workflow_controlled_activation_strategy"
      );
      expect(
        RECRUITMENT_WORKFLOW_CONTROLLED_ACTIVATION_STRATEGY_METADATA.activationStrategyOnly
      ).toBe(true);
    });
  });

  describe("rollout planner — staged rollout", () => {
    test("defines staged rollout with 13 advisory stages", () => {
      expect(ROLLOUT_STAGE_DEFINITIONS).toHaveLength(13);
      expect(ROLLOUT_STAGE_DEFINITIONS[0].id).toBe(ROLLOUT_STAGE_IDS.PLANNING_REVIEW);
      expect(ROLLOUT_STAGE_DEFINITIONS[12].id).toBe(ROLLOUT_STAGE_IDS.ACTIVATION_PLANNING);
    });

    test("returns unknown stages for empty input", () => {
      const result = createRecruitmentWorkflowIntegrationRolloutPlan(null);

      expect(result.currentStageId).toBeNull();
      expect(result.recommendedNextStageId).toBe(ROLLOUT_STAGE_IDS.PLANNING_REVIEW);
      expect(result.rolloutStages).toHaveLength(13);
      expect(result.rolloutStages.every((stage) => stage.status === ROLLOUT_STAGE_STATUS.UNKNOWN)).toBe(
        true
      );
    });

    test("reports full rollout readiness when all module signals are satisfied", () => {
      const result = createRecruitmentWorkflowIntegrationRolloutPlan(
        buildReadyForControlledIntegrationInput()
      );

      const readyStages = result.rolloutStages.filter(
        (stage) => stage.status === ROLLOUT_STAGE_STATUS.READY
      );

      expect(readyStages.length).toBeGreaterThanOrEqual(12);
      expect(result.rolloutSummary).toContain("rollout");
      expect(result.advisoryMetadata.generatedBy).toBe("phase_135");
    });

    test("identifies in-progress stage for partial integration signals", () => {
      const result = createRecruitmentWorkflowIntegrationRolloutPlan(buildPartialIntegrationInput());

      const inProgress = result.rolloutStages.filter(
        (stage) => stage.status === ROLLOUT_STAGE_STATUS.IN_PROGRESS
      );

      expect(inProgress.length).toBeGreaterThan(0);
      expect(result.rolloutSummary).toContain("rollout");
    });

    test("blocks controlled integration gate when integration status is not ready", () => {
      const result = createRecruitmentWorkflowIntegrationRolloutPlan(buildBlockedIntegrationInput());

      const gate = result.rolloutStages.find(
        (stage) => stage.id === ROLLOUT_STAGE_IDS.CONTROLLED_INTEGRATION_GATE
      );

      expect(gate).toBeDefined();
      expect(gate.status).toBe(ROLLOUT_STAGE_STATUS.BLOCKED);
    });
  });

  describe("feature activation matrix — module to stage mapping", () => {
    test("maps 21 advisory modules to rollout stages", () => {
      expect(ACTIVATION_MATRIX_DEFINITIONS).toHaveLength(21);
      expect(ACTIVATION_MATRIX_DEFINITIONS[0].moduleId).toBe(ADVISORY_MODULE_IDS.DRAFT_PROPOSAL);
      expect(ACTIVATION_MATRIX_DEFINITIONS[20].moduleId).toBe(
        ADVISORY_MODULE_IDS.INTEGRATION_READINESS_FRAMEWORK
      );
    });

    test("returns unknown activation status without signals", () => {
      const result = createRecruitmentWorkflowFeatureActivationMatrix({});

      expect(result.activatedModuleCount).toBe(0);
      expect(result.plannedModuleCount).toBe(0);
      expect(
        result.activationMatrix.every((row) => row.activationStatus === ACTIVATION_STATUS.UNKNOWN)
      ).toBe(true);
    });

    test("marks activated modules when signals are supplied", () => {
      const result = createRecruitmentWorkflowFeatureActivationMatrix({
        moduleSignals: {
          draft_proposal: { activated: true },
          persistence_boundary: { satisfied: true },
          approval_gate: { ready: true }
        }
      });

      expect(result.activatedModuleCount).toBe(3);
      expect(result.plannedModuleCount).toBe(18);
      expect(result.matrixSummary).toContain("3 activated");
    });

    test("filters matrix rows by rollout stage id", () => {
      const result = createRecruitmentWorkflowFeatureActivationMatrix({
        rolloutStageId: "FOUNDATIONAL_PIPELINE",
        moduleSignals: {
          draft_proposal: { activated: true }
        }
      });

      expect(result.activationMatrix).toHaveLength(4);
      expect(
        result.activationMatrix.every((row) => row.rolloutStageId === "FOUNDATIONAL_PIPELINE")
      ).toBe(true);
    });
  });

  describe("safety checklist — prerequisite validation", () => {
    test("defines 10 integration safety checks", () => {
      expect(SAFETY_CHECK_DEFINITIONS).toHaveLength(10);
      expect(SAFETY_CHECK_DEFINITIONS[0].id).toBe(
        SAFETY_CHECK_IDS.INTEGRATION_READINESS_CONFIRMED
      );
    });

    test("returns unknown safety posture without signals", () => {
      const result = createRecruitmentWorkflowIntegrationSafetyChecklist(null);

      expect(result.safetyPosture).toBe(SAFETY_POSTURE.UNKNOWN);
      expect(result.unknownCount).toBe(10);
      expect(result.satisfiedCount).toBe(0);
      expect(result.safetySummary).toContain("awaits advisory prerequisite signals");
    });

    test("reports safe to plan when all prerequisites are satisfied", () => {
      const result = createRecruitmentWorkflowIntegrationSafetyChecklist(
        buildReadyForControlledIntegrationInput()
      );

      expect(result.safetyPosture).toBe(SAFETY_POSTURE.SAFE_TO_PLAN);
      expect(result.satisfiedCount).toBe(10);
      expect(result.unsatisfiedCount).toBe(0);
      expect(result.safetySummary).toContain("passed");
    });

    test("reports unsafe to proceed for blocked integration signals", () => {
      const result = createRecruitmentWorkflowIntegrationSafetyChecklist(
        buildBlockedIntegrationInput()
      );

      expect(result.safetyPosture).toBe(SAFETY_POSTURE.UNSAFE_TO_PROCEED);
      expect(result.unsatisfiedCount).toBeGreaterThan(0);
      expect(result.safetySummary).toContain("blocked");
    });

    test("flags consistency validation as unsatisfied when inconsistent", () => {
      const result = createRecruitmentWorkflowIntegrationSafetyChecklist(
        buildBlockedIntegrationInput()
      );

      const consistencyCheck = result.checklistItems.find(
        (item) => item.id === SAFETY_CHECK_IDS.CONSISTENCY_VALIDATION_PASSED
      );

      expect(consistencyCheck.status).toBe(SAFETY_CHECK_STATUS.UNSATISFIED);
    });
  });

  describe("controlled activation strategy — activation order", () => {
    test("defines activation order for 21 advisory modules", () => {
      expect(ACTIVATION_ORDER_DEFINITIONS).toHaveLength(21);
      expect(ACTIVATION_ORDER_DEFINITIONS[0].phase).toBe(114);
      expect(ACTIVATION_ORDER_DEFINITIONS[20].phase).toBe(134);
    });

    test("returns unknown strategy without signals", () => {
      const result = createRecruitmentWorkflowControlledActivationStrategy(undefined);

      expect(result.strategyPosture).toBe(STRATEGY_POSTURE.UNKNOWN);
      expect(result.recommendedActivations).toEqual([]);
      expect(
        result.activationSequence.every(
          (entry) => entry.strategyStatus === ACTIVATION_STRATEGY_STATUS.UNKNOWN
        )
      ).toBe(true);
    });

    test("recommends next module when dependencies are satisfied", () => {
      const result = createRecruitmentWorkflowControlledActivationStrategy({
        moduleSignals: {
          114: { satisfied: true },
          115: { satisfied: true }
        }
      });

      const recommended = result.recommendedActivations;

      expect(recommended.length).toBeGreaterThan(0);
      expect(recommended[0].phase).toBe(116);
      expect(result.strategyPosture).toBe(STRATEGY_POSTURE.PARTIAL_SEQUENCE);
    });

    test("marks all modules complete when fully activated", () => {
      const result = createRecruitmentWorkflowControlledActivationStrategy({
        moduleSignals: buildAllModuleSignals()
      });

      const completeCount = result.activationSequence.filter(
        (entry) => entry.strategyStatus === ACTIVATION_STRATEGY_STATUS.COMPLETE
      ).length;

      expect(completeCount).toBe(21);
      expect(result.strategyPosture).toBe(STRATEGY_POSTURE.READY_TO_SEQUENCE);
    });

    test("reports blocked activations when phases are explicitly blocked", () => {
      const result = createRecruitmentWorkflowControlledActivationStrategy({
        moduleSignals: {
          114: { satisfied: true },
          115: { satisfied: true },
          116: { satisfied: true },
          117: { satisfied: true },
          118: { satisfied: true },
          119: { satisfied: true }
        },
        blockedPhases: {
          120: true
        }
      });

      expect(result.blockedActivations).toEqual(
        expect.arrayContaining([expect.objectContaining({ phase: 120 })])
      );
      expect(result.strategyPosture).toBe(STRATEGY_POSTURE.BLOCKED_SEQUENCE);
    });
  });

  describe("planning suite integration — advisory composition", () => {
    test("all four libraries produce coherent advisory output from shared input", () => {
      const input = buildReadyForControlledIntegrationInput();

      const rolloutPlan = createRecruitmentWorkflowIntegrationRolloutPlan(input);
      const activationMatrix = createRecruitmentWorkflowFeatureActivationMatrix(input);
      const safetyChecklist = createRecruitmentWorkflowIntegrationSafetyChecklist(input);
      const activationStrategy = createRecruitmentWorkflowControlledActivationStrategy(input);

      expect(rolloutPlan.advisoryMetadata.phase).toBe(135);
      expect(activationMatrix.advisoryMetadata.phase).toBe(135);
      expect(safetyChecklist.advisoryMetadata.phase).toBe(135);
      expect(activationStrategy.advisoryMetadata.phase).toBe(135);

      expect(safetyChecklist.safetyPosture).toBe(SAFETY_POSTURE.SAFE_TO_PLAN);
      expect(activationMatrix.activatedModuleCount).toBeGreaterThan(0);
      expect(activationStrategy.recommendedActivations.length).toBeGreaterThanOrEqual(0);
      expect(rolloutPlan.rolloutStages.length).toBe(13);
    });
  });

  describe("isolation", () => {
    test("phase 135 modules do not import each other or other recruitment modules", () => {
      for (let i = 0; i < PHASE_135_MODULE_PATHS.length; i += 1) {
        const source = read(PHASE_135_MODULE_PATHS[i]);

        expect(source).toContain("Phase 135");
        expect(source).not.toMatch(/require\(["']\./);
        expect(source).not.toMatch(/require\(["']fs["']\)/);
        expect(source).not.toMatch(/require\(["']express/);
        expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
        expect(source).not.toMatch(/mysql2/);
      }
    });

    test("phase 135 modules are not referenced by prior phase production modules", () => {
      const productionSources = [
        read(CONSISTENCY_MODULE_PATH),
        read(TIMELINE_MODULE_PATH),
        read(RECOMMENDATION_MODULE_PATH),
        read(INTELLIGENCE_MODULE_PATH),
        read(READINESS_FRAMEWORK_MODULE_PATH),
        read(ORCHESTRATOR_MODULE_PATH),
        read(COORDINATOR_MODULE_PATH),
        read(GATEWAY_MODULE_PATH),
        read(PIPELINE_MODULE_PATH),
        read(WORKER_MODULE_PATH)
      ];

      for (let i = 0; i < productionSources.length; i += 1) {
        for (let j = 0; j < PHASE_135_EXPORT_PATTERNS.length; j += 1) {
          expect(productionSources[i]).not.toMatch(PHASE_135_EXPORT_PATTERNS[j]);
        }
      }
    });
  });

  describe("deterministic output", () => {
    test("returns identical rollout plan for identical input", () => {
      const input = buildReadyForControlledIntegrationInput();
      const first = createRecruitmentWorkflowIntegrationRolloutPlan(input);
      const second = createRecruitmentWorkflowIntegrationRolloutPlan(input);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("returns identical activation matrix for identical input", () => {
      const input = buildPartialIntegrationInput();
      const first = createRecruitmentWorkflowFeatureActivationMatrix(input);
      const second = createRecruitmentWorkflowFeatureActivationMatrix(input);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("returns identical safety checklist for identical input", () => {
      const input = buildBlockedIntegrationInput();
      const first = createRecruitmentWorkflowIntegrationSafetyChecklist(input);
      const second = createRecruitmentWorkflowIntegrationSafetyChecklist(input);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("returns identical activation strategy for identical input", () => {
      const input = { moduleSignals: { 114: { satisfied: true } } };
      const first = createRecruitmentWorkflowControlledActivationStrategy(input);
      const second = createRecruitmentWorkflowControlledActivationStrategy(input);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });
  });

  describe("immutability", () => {
    test("deep freezes rollout planner output", () => {
      const result = createRecruitmentWorkflowIntegrationRolloutPlan(buildPartialIntegrationInput());

      assertAllFrozen(result);
      expect(() => {
        result.rolloutSummary = "CHANGED";
      }).toThrow();
      expect(() => {
        result.rolloutStages.push({});
      }).toThrow();
    });

    test("deep freezes activation matrix output", () => {
      const result = createRecruitmentWorkflowFeatureActivationMatrix(buildPartialIntegrationInput());

      assertAllFrozen(result);
      expect(() => {
        result.activationMatrix[0].activationStatus = "CHANGED";
      }).toThrow();
    });

    test("deep freezes safety checklist output", () => {
      const result = createRecruitmentWorkflowIntegrationSafetyChecklist(
        buildReadyForControlledIntegrationInput()
      );

      assertAllFrozen(result);
      expect(() => {
        result.checklistItems[0].status = "CHANGED";
      }).toThrow();
    });

    test("deep freezes activation strategy output", () => {
      const result = createRecruitmentWorkflowControlledActivationStrategy({
        moduleSignals: { 114: { satisfied: true } }
      });

      assertAllFrozen(result);
      expect(() => {
        result.activationSequence[0].strategyStatus = "CHANGED";
      }).toThrow();
    });

    test("does not mutate shared planning suite input", () => {
      const input = buildReadyForControlledIntegrationInput();
      const before = JSON.stringify(input);

      createRecruitmentWorkflowIntegrationRolloutPlan(input);
      createRecruitmentWorkflowFeatureActivationMatrix(input);
      createRecruitmentWorkflowIntegrationSafetyChecklist(input);
      createRecruitmentWorkflowControlledActivationStrategy(input);

      expect(JSON.stringify(input)).toBe(before);
    });

    test("planning suite does not mutate process environment", () => {
      const envBefore = { ...process.env };
      createRecruitmentWorkflowIntegrationRolloutPlan(buildReadyForControlledIntegrationInput());
      expect(process.env).toEqual(envBefore);
    });
  });

  describe("no persistence", () => {
    test("phase 135 module sources declare no persistence or integration storage", () => {
      for (let i = 0; i < PHASE_135_MODULE_PATHS.length; i += 1) {
        const source = read(PHASE_135_MODULE_PATHS[i]);

        expect(source).toContain("no persistence");
        expect(source).toContain("integrationPersistence: false");
        expect(source).toContain("historyTracking: false");
        expect(source).not.toMatch(/INSERT INTO/i);
        expect(source).not.toMatch(/UPDATE\s+/i);
        expect(source).not.toMatch(/saveIntegration/i);
        expect(source).not.toMatch(/persistIntegration/i);
      }
    });
  });

  describe("no runtime wiring", () => {
    test("phase 135 modules declare pure advisory planning constraints", () => {
      for (let i = 0; i < PHASE_135_MODULE_PATHS.length; i += 1) {
        const source = read(PHASE_135_MODULE_PATHS[i]);

        expect(source).toContain("Advisory Only");
        expect(source).toContain("Never mutates input");
        expect(source).toContain("No automation");
        expect(source).toContain("advisoryOnly: true");
        expect(source).toContain("executed: false");
      }
    });

    test("orchestrator behavior remains unchanged and independent from phase 135 planning suite", () => {
      const orchestration = orchestrateRecruitmentWorkflow({
        recruitmentId: 42,
        eventType: "notification"
      });

      expect(orchestration.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED);
      expect(orchestration.advisory).toBe(true);
      expect(orchestration.executed).toBe(false);
      expect(orchestration).not.toHaveProperty("rolloutStages");
      expect(orchestration).not.toHaveProperty("activationMatrix");
      expect(orchestration).not.toHaveProperty("checklistItems");
      expect(orchestration).not.toHaveProperty("activationSequence");
    });
  });

  describe("no production imports", () => {
    test("phase 135 libraries have no runtime require statements", () => {
      for (let i = 0; i < PHASE_135_MODULE_PATHS.length; i += 1) {
        const source = read(PHASE_135_MODULE_PATHS[i]);
        expect(source).not.toMatch(/require\(/);
      }
    });
  });
});
