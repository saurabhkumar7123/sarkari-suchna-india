"use strict";

/**
 * Phase 76 — Recruitment Persistence Engine (Feature-Gated) tests.
 * Exports, execution modes, planned operations, deterministic behavior,
 * validation, immutability, helper behavior, compatibility integration,
 * pipeline output preservation, failure isolation, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  PERSISTENCE_ENGINE_PHASE,
  PERSISTENCE_EXECUTION_RESULT_ENTITY,
  EXECUTION_MODES,
  SUPPORTED_EXECUTION_MODES,
  DEFAULT_EXECUTION_MODE,
  SUPPORTED_PLANNED_OPERATIONS,
  EXECUTION_OUTCOMES,
  DEFAULT_EXECUTION_OUTCOME,
  EXECUTION_DECISION_TO_PLANNED_OPERATION,
  PLANNED_OPERATION_DESCRIPTOR,
  PERSISTENCE_EXECUTION_RESULT_DESCRIPTOR,
  PERSISTENCE_EXECUTION_METADATA,
  VALIDATION_STATUS,
  isExecutionMode,
  isPlannedOperation,
  resolvePlannedOperation,
  createPersistenceExecutionResult,
  executeRecruitmentPersistence,
  validatePersistenceExecutionResult,
  summarizePersistenceExecutionResult
} = require("../server/lib/recruitment/recruitmentPersistenceEngine");

const {
  EXECUTION_GATEWAY_PHASE,
  EXECUTION_DECISION_ENTITY,
  EXECUTION_DECISIONS,
  createExecutionDecision,
  validateExecutionDecision
} = require("../server/lib/recruitment/recruitmentExecutionGateway");

const {
  PERSISTENCE_COORDINATOR_PHASE,
  PERSISTENCE_PLAN_ENTITY,
  PERSISTENCE_OPERATIONS,
  createPersistencePlan,
  validatePersistencePlan
} = require("../server/lib/recruitment/recruitmentPersistenceCoordinator");

const {
  ACTION_TYPES,
  createRecruitmentActionPlan
} = require("../server/lib/recruitment/recruitmentActionPlanner");

const {
  MATCH_CATEGORIES,
  MATCHING_PROFILE_BY_ID
} = require("../server/lib/recruitment/recruitmentMatchingContracts");

const {
  createMatchingResult
} = require("../server/lib/recruitment/recruitmentMatchingEngine");

const {
  IDENTITY_RESOLUTION_STATES,
  ANCHOR_EVENT_IDS,
  CONFIDENCE_LEVELS,
  createIdentityResolutionResult
} = require("../server/lib/recruitment/recruitmentIdentityResolutionEngine");

const {
  createRecruitmentContext
} = require("../server/lib/recruitment/recruitmentContext");

const {
  attachRecruitmentCompatibility,
  peekRecruitmentCompatibility,
  peekRecruitmentIdentityResolution,
  peekRecruitmentMatchingResult,
  peekRecruitmentActionPlan,
  peekRecruitmentPersistencePlan,
  peekRecruitmentExecutionDecision,
  peekRecruitmentPersistenceExecutionResult,
  summarizePersistenceExecutionResult: summarizePersistenceFromCompat
} = require("../server/lib/recruitment/recruitmentCompatibilityLayer");

const {
  observeRecruitmentActionPlan,
  OBSERVATION_STATES
} = require("../server/lib/recruitment/recruitmentWorkerObservation");

const { runRecruitmentPipeline } = require("../server/lib/recruitment/runRecruitmentPipeline");
const { PROCESS_RESULT_STATUS } = require("../server/lib/recruitment/detectionProcessor");

const ROOT = path.join(__dirname, "..");
const ENGINE_MODULE_PATH = "server/lib/recruitment/recruitmentPersistenceEngine.js";
const COMPATIBILITY_MODULE_PATH = "server/lib/recruitment/recruitmentCompatibilityLayer.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";
const GATEWAY_MODULE_PATH = "server/lib/recruitment/recruitmentExecutionGateway.js";

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

function sampleNotice(overrides = {}) {
  return {
    title: "SSC CGL 2026 Admit Card",
    content: "Download admit card for SSC Combined Graduate Level Examination 2026",
    url: "https://ssc.nic.in/admit-card.pdf",
    ...overrides
  };
}

function contextWithSignals(observedSignals, extraMetadata = {}) {
  return createRecruitmentContext({
    metadata: {
      observedSignals,
      ...extraMetadata
    }
  });
}

function identityFromSignals(observedSignals, extraMetadata = {}) {
  return createIdentityResolutionResult(
    contextWithSignals(observedSignals, extraMetadata)
  );
}

function validIdentityResolution(overrides = {}) {
  const base = createIdentityResolutionResult(
    contextWithSignals({
      recruitment_title: "Synthetic recruitment",
      organization: "Staff Selection Commission",
      official_identifier: "update:1",
      source_url: "https://ssc.nic.in/notice"
    })
  );
  return {
    ...base,
    recommendsManualReview: false,
    resolutionState: IDENTITY_RESOLUTION_STATES.READY_FOR_MATCHING,
    manualReviewReasons: Object.freeze([]),
    ...overrides
  };
}

function matchingForCategory(matchCategory) {
  switch (matchCategory) {
    case MATCH_CATEGORIES.EXACT_MATCH:
      return createMatchingResult(
        identityFromSignals({
          recruitment_title: "SSC CGL 2026",
          advertisement_number: "CGL-01/2026",
          official_identifier: "NOTIF-SSC-88421"
        })
      );
    case MATCH_CATEGORIES.STRONG_MATCH:
      return createMatchingResult(
        identityFromSignals({
          recruitment_title: "SSC CGL Examination 2026",
          advertisement_number: "CGL-01/2026",
          organization: "Staff Selection Commission"
        })
      );
    case MATCH_CATEGORIES.PROBABLE_MATCH:
      return createMatchingResult(
        validIdentityResolution({
          signalObservations: Object.freeze({
            recruitment_title: "UPSC 2025",
            organization: "Union Public Service Commission",
            recruitment_year: "2025"
          }),
          availableSignals: Object.freeze([
            "recruitment_title",
            "organization",
            "recruitment_year"
          ]),
          recommendsManualReview: false,
          resolutionState: IDENTITY_RESOLUTION_STATES.READY_FOR_MATCHING,
          manualReviewReasons: Object.freeze([])
        })
      );
    case MATCH_CATEGORIES.WEAK_MATCH:
      return createMatchingResult(
        validIdentityResolution({
          signalObservations: Object.freeze({
            recruitment_title: "Weak title",
            recruitment_year: "2026"
          }),
          availableSignals: Object.freeze(["recruitment_title", "recruitment_year"]),
          recommendsManualReview: false,
          resolutionState: IDENTITY_RESOLUTION_STATES.READY_FOR_MATCHING,
          manualReviewReasons: Object.freeze([])
        })
      );
    case MATCH_CATEGORIES.MANUAL_REVIEW:
      return createMatchingResult(createIdentityResolutionResult(null));
    case MATCH_CATEGORIES.NO_MATCH:
      return createMatchingResult(
        validIdentityResolution({
          signalObservations: Object.freeze({}),
          availableSignals: Object.freeze([]),
          signalCount: 0,
          primarySignalCount: 0,
          recommendsManualReview: false,
          resolutionState: IDENTITY_RESOLUTION_STATES.READY_FOR_MATCHING,
          manualReviewReasons: Object.freeze([])
        })
      );
    default:
      return createMatchingResult(identityFromSignals({ recruitment_title: "Fallback" }));
  }
}

function actionPlanForCategory(matchCategory) {
  return createRecruitmentActionPlan(matchingForCategory(matchCategory));
}

function persistencePlanForCategory(matchCategory) {
  return createPersistencePlan(actionPlanForCategory(matchCategory));
}

function executionDecisionForCategory(matchCategory) {
  return createExecutionDecision(persistencePlanForCategory(matchCategory));
}

function persistenceExecutionResultForCategory(matchCategory, options) {
  return createPersistenceExecutionResult(
    executionDecisionForCategory(matchCategory),
    options
  );
}

describe("Phase 76 — recruitmentPersistenceEngine", () => {
  describe("exports", () => {
    test("exposes phase 76 persistence engine constants and descriptor", () => {
      expect(PERSISTENCE_ENGINE_PHASE).toBe(76);
      expect(PERSISTENCE_EXECUTION_RESULT_ENTITY).toBe(
        "recruitment_persistence_execution_result"
      );
      expect(PERSISTENCE_EXECUTION_RESULT_DESCRIPTOR.phase).toBe(76);
      expect(PERSISTENCE_EXECUTION_METADATA.executed).toBe(false);
      expect(PERSISTENCE_EXECUTION_METADATA.featureGated).toBe(true);
      expect(PERSISTENCE_EXECUTION_METADATA.featureGateOpen).toBe(false);
    });

    test("defines supported execution modes", () => {
      expect(SUPPORTED_EXECUTION_MODES.size).toBe(2);
      expect(Object.values(EXECUTION_MODES)).toEqual(["dry_run", "enabled"]);
    });

    test("default execution mode is dry_run", () => {
      expect(DEFAULT_EXECUTION_MODE).toBe(EXECUTION_MODES.DRY_RUN);
    });

    test("defines supported planned operations", () => {
      expect(SUPPORTED_PLANNED_OPERATIONS.has(PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT)).toBe(
        true
      );
      expect(SUPPORTED_PLANNED_OPERATIONS.has(PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT)).toBe(
        true
      );
      expect(SUPPORTED_PLANNED_OPERATIONS.size).toBe(2);
    });

    test("defines execution decision to planned operation mapping", () => {
      const dryRunMapping = EXECUTION_DECISION_TO_PLANNED_OPERATION[EXECUTION_DECISIONS.DRY_RUN];
      expect(dryRunMapping[PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT]).toBe(
        PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT
      );
      expect(dryRunMapping[PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT]).toBe(
        PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT
      );
    });

    test("exports planned operation descriptors with persistence disabled", () => {
      expect(PLANNED_OPERATION_DESCRIPTOR.create_recruitment.performsPersistence).toBe(false);
      expect(PLANNED_OPERATION_DESCRIPTOR.attach_recruitment.performsPersistence).toBe(false);
      expect(PLANNED_OPERATION_DESCRIPTOR.create_recruitment.supported).toBe(true);
      expect(PLANNED_OPERATION_DESCRIPTOR.attach_recruitment.supported).toBe(true);
    });

    test("exports public API functions", () => {
      expect(typeof isExecutionMode).toBe("function");
      expect(typeof isPlannedOperation).toBe("function");
      expect(typeof resolvePlannedOperation).toBe("function");
      expect(typeof createPersistenceExecutionResult).toBe("function");
      expect(typeof executeRecruitmentPersistence).toBe("function");
      expect(typeof validatePersistenceExecutionResult).toBe("function");
      expect(typeof summarizePersistenceExecutionResult).toBe("function");
    });

    test("isExecutionMode validates supported modes", () => {
      expect(isExecutionMode(EXECUTION_MODES.DRY_RUN)).toBe(true);
      expect(isExecutionMode(EXECUTION_MODES.ENABLED)).toBe(true);
      expect(isExecutionMode("live")).toBe(false);
      expect(isExecutionMode(null)).toBe(false);
    });

    test("isPlannedOperation validates supported operations", () => {
      expect(isPlannedOperation(PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT)).toBe(true);
      expect(isPlannedOperation(PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT)).toBe(true);
      expect(isPlannedOperation(PERSISTENCE_OPERATIONS.MANUAL_REVIEW)).toBe(false);
      expect(isPlannedOperation(PERSISTENCE_OPERATIONS.SKIP)).toBe(false);
      expect(isPlannedOperation(null)).toBe(false);
    });

    test("default execution outcome is skipped", () => {
      expect(DEFAULT_EXECUTION_OUTCOME).toBe(EXECUTION_OUTCOMES.SKIPPED);
    });
  });

  describe("execution modes", () => {
    test("createPersistenceExecutionResult defaults to dry_run mode", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.NO_MATCH);
      expect(result.executionMode).toBe(EXECUTION_MODES.DRY_RUN);
    });

    test("executeRecruitmentPersistence defaults to dry_run mode", () => {
      const result = executeRecruitmentPersistence(
        executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH)
      );
      expect(result.executionMode).toBe(EXECUTION_MODES.DRY_RUN);
    });

    test("enabled mode can be requested via options", () => {
      const result = createPersistenceExecutionResult(
        executionDecisionForCategory(MATCH_CATEGORIES.NO_MATCH),
        { executionMode: EXECUTION_MODES.ENABLED }
      );
      expect(result.executionMode).toBe(EXECUTION_MODES.ENABLED);
    });

    test("invalid execution mode falls back to dry_run", () => {
      const result = createPersistenceExecutionResult(
        executionDecisionForCategory(MATCH_CATEGORIES.NO_MATCH),
        { executionMode: "invalid_mode" }
      );
      expect(result.executionMode).toBe(EXECUTION_MODES.DRY_RUN);
    });

    test("dry_run mode yields dry_run_simulated outcome for create_recruitment", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.NO_MATCH);
      expect(result.executionOutcome).toBe(EXECUTION_OUTCOMES.DRY_RUN_SIMULATED);
    });

    test("dry_run mode yields dry_run_simulated outcome for attach_recruitment", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(result.executionOutcome).toBe(EXECUTION_OUTCOMES.DRY_RUN_SIMULATED);
    });

    test("enabled mode yields feature_gate_blocked outcome for create_recruitment", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.NO_MATCH, {
        executionMode: EXECUTION_MODES.ENABLED
      });
      expect(result.executionOutcome).toBe(EXECUTION_OUTCOMES.FEATURE_GATE_BLOCKED);
    });

    test("enabled mode yields feature_gate_blocked outcome for attach_recruitment", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH, {
        executionMode: EXECUTION_MODES.ENABLED
      });
      expect(result.executionOutcome).toBe(EXECUTION_OUTCOMES.FEATURE_GATE_BLOCKED);
    });

    test("enabled mode still keeps executed false", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.NO_MATCH, {
        executionMode: EXECUTION_MODES.ENABLED
      });
      expect(result.executed).toBe(false);
    });

    test("dry_run mode keeps executed false", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.NO_MATCH);
      expect(result.executed).toBe(false);
    });

    test("feature gate remains closed in dry_run mode", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(result.featureGateOpen).toBe(false);
      expect(result.featureGated).toBe(true);
    });

    test("feature gate remains closed in enabled mode", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH, {
        executionMode: EXECUTION_MODES.ENABLED
      });
      expect(result.featureGateOpen).toBe(false);
    });
  });

  describe("planned operations", () => {
    test("create_recruitment maps to planned operation for no_match", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.NO_MATCH);
      expect(result.plannedOperation).toBe(PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT);
      expect(result.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT);
      expect(result.actionType).toBe(ACTION_TYPES.CREATE_NEW_RECRUITMENT);
    });

    test("attach_recruitment maps to planned operation for exact match", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(result.plannedOperation).toBe(PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT);
      expect(result.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT);
      expect(result.actionType).toBe(ACTION_TYPES.ATTACH_EXISTING_RECRUITMENT);
    });

    test("attach_recruitment maps to planned operation for strong match", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.STRONG_MATCH);
      expect(result.plannedOperation).toBe(PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT);
    });

    test("manual_review yields skipped outcome with null planned operation", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.MANUAL_REVIEW);
      expect(result.plannedOperation).toBeNull();
      expect(result.executionOutcome).toBe(EXECUTION_OUTCOMES.SKIPPED);
    });

    test("probable match yields skipped outcome with null planned operation", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.PROBABLE_MATCH);
      expect(result.plannedOperation).toBeNull();
      expect(result.executionOutcome).toBe(EXECUTION_OUTCOMES.SKIPPED);
    });

    test("weak match yields skipped outcome with null planned operation", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.WEAK_MATCH);
      expect(result.plannedOperation).toBeNull();
      expect(result.executionOutcome).toBe(EXECUTION_OUTCOMES.SKIPPED);
    });

    test("blocked decision yields skipped outcome", () => {
      const actionPlan = createRecruitmentActionPlan({ invalid: true });
      const plan = createPersistencePlan(actionPlan);
      const decision = createExecutionDecision(plan);
      const result = createPersistenceExecutionResult(decision);
      expect(result.executionOutcome).toBe(EXECUTION_OUTCOMES.SKIPPED);
      expect(result.plannedOperation).toBeNull();
    });

    test("planned operation label matches descriptor", () => {
      const createResult = persistenceExecutionResultForCategory(MATCH_CATEGORIES.NO_MATCH);
      expect(createResult.plannedOperationLabel).toBe(
        PLANNED_OPERATION_DESCRIPTOR.create_recruitment.label
      );
      const attachResult = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(attachResult.plannedOperationLabel).toBe(
        PLANNED_OPERATION_DESCRIPTOR.attach_recruitment.label
      );
    });

    test("resolvePlannedOperation returns create_recruitment for no_match decision", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.NO_MATCH);
      expect(resolvePlannedOperation(decision)).toBe(PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT);
    });

    test("resolvePlannedOperation returns attach_recruitment for exact match decision", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(resolvePlannedOperation(decision)).toBe(PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT);
    });

    test("resolvePlannedOperation returns null for manual_review decision", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.MANUAL_REVIEW);
      expect(resolvePlannedOperation(decision)).toBeNull();
    });

    test("resolvePlannedOperation returns null for null input", () => {
      expect(resolvePlannedOperation(null)).toBeNull();
    });
  });

  describe("deterministic behavior", () => {
    test("createPersistenceExecutionResult is deterministic for same input", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const first = createPersistenceExecutionResult(decision);
      const second = createPersistenceExecutionResult(decision);
      expect(first.plannedOperation).toBe(second.plannedOperation);
      expect(first.executionOutcome).toBe(second.executionOutcome);
      expect(first.outcomeRationale).toBe(second.outcomeRationale);
    });

    test("executeRecruitmentPersistence is deterministic for same input", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.NO_MATCH);
      const first = executeRecruitmentPersistence(decision);
      const second = executeRecruitmentPersistence(decision);
      expect(first.executionMode).toBe(second.executionMode);
      expect(first.executed).toBe(second.executed);
      expect(first.plannedOperation).toBe(second.plannedOperation);
    });

    test("createPersistenceExecutionResult handles null decision deterministically", () => {
      const first = createPersistenceExecutionResult(null);
      const second = createPersistenceExecutionResult(null);
      expect(first.executionOutcome).toBe(second.executionOutcome);
      expect(first.executionOutcome).toBe(EXECUTION_OUTCOMES.INVALID_DECISION);
    });

    test("createPersistenceExecutionResult handles undefined decision", () => {
      const result = createPersistenceExecutionResult(undefined);
      expect(result.executionDecisionValid).toBe(false);
      expect(result.executed).toBe(false);
    });

    test("executeRecruitmentPersistence never throws", () => {
      expect(() => executeRecruitmentPersistence(Symbol("x"))).not.toThrow();
      expect(() => executeRecruitmentPersistence(() => {})).not.toThrow();
    });

    test("createPersistenceExecutionResult never throws", () => {
      expect(() => createPersistenceExecutionResult(Symbol("x"))).not.toThrow();
      expect(() => createPersistenceExecutionResult(() => {})).not.toThrow();
    });

    test("all match categories produce deterministic executed false", () => {
      const categories = Object.values(MATCH_CATEGORIES);
      for (let i = 0; i < categories.length; i += 1) {
        const result = persistenceExecutionResultForCategory(categories[i]);
        expect(result.executed).toBe(false);
      }
    });

    test("executeRecruitmentPersistence matches createPersistenceExecutionResult fields", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.STRONG_MATCH);
      const created = createPersistenceExecutionResult(decision);
      const executed = executeRecruitmentPersistence(decision);
      expect(executed.plannedOperation).toBe(created.plannedOperation);
      expect(executed.executionOutcome).toBe(created.executionOutcome);
      expect(executed.executed).toBe(created.executed);
    });
  });

  describe("validation", () => {
    test("valid persistence execution result passes validation", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const validation = validatePersistenceExecutionResult(result);
      expect(validation.valid).toBe(true);
      expect(validation.status).toBe(VALIDATION_STATUS.VALID);
      expect(validation.reasons).toEqual([]);
    });

    test("invalid shape fails validation", () => {
      const validation = validatePersistenceExecutionResult(null);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_RESULT_SHAPE");
    });

    test("wrong phase fails validation", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...result, phase: 75 };
      const validation = validatePersistenceExecutionResult(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_PHASE");
    });

    test("wrong entity fails validation", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...result, entity: "wrong_entity" };
      const validation = validatePersistenceExecutionResult(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_ENTITY");
    });

    test("executed true fails validation", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...result, executed: true };
      const validation = validatePersistenceExecutionResult(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("EXECUTED_MUST_BE_FALSE");
    });

    test("featureGated false fails validation", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...result, featureGated: false };
      const validation = validatePersistenceExecutionResult(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("FEATURE_GATED_MUST_BE_TRUE");
    });

    test("featureGateOpen true fails validation", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...result, featureGateOpen: true };
      const validation = validatePersistenceExecutionResult(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("FEATURE_GATE_OPEN_MUST_BE_FALSE");
    });

    test("persistenceExecution true fails validation", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...result, persistenceExecution: true };
      const validation = validatePersistenceExecutionResult(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("EXECUTION_FLAGS_MUST_BE_FALSE");
    });

    test("dry_run mode with feature_gate_blocked outcome fails validation", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = {
        ...result,
        executionOutcome: EXECUTION_OUTCOMES.FEATURE_GATE_BLOCKED
      };
      const validation = validatePersistenceExecutionResult(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("DRY_RUN_MODE_OUTCOME_MISMATCH");
    });

    test("enabled mode with dry_run_simulated outcome fails validation", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH, {
        executionMode: EXECUTION_MODES.ENABLED
      });
      const tampered = {
        ...result,
        executionOutcome: EXECUTION_OUTCOMES.DRY_RUN_SIMULATED
      };
      const validation = validatePersistenceExecutionResult(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("ENABLED_MODE_OUTCOME_MISMATCH");
    });

    test("inconsistent planned operation fails validation", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = {
        ...result,
        plannedOperation: PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT
      };
      const validation = validatePersistenceExecutionResult(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("PLANNED_OPERATION_INCONSISTENT_WITH_DECISION");
    });

    test("missing outcome rationale fails validation", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...result, outcomeRationale: "" };
      const validation = validatePersistenceExecutionResult(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("MISSING_OUTCOME_RATIONALE");
    });

    test("invalid execution gateway phase fails validation", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...result, executionGatewayPhase: 74 };
      const validation = validatePersistenceExecutionResult(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_EXECUTION_GATEWAY_PHASE");
    });

    test("validatePersistenceExecutionResult never throws", () => {
      expect(() => validatePersistenceExecutionResult(Symbol("x"))).not.toThrow();
    });
  });

  describe("immutability", () => {
    test("createPersistenceExecutionResult returns deeply frozen object", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      assertAllFrozen(result);
    });

    test("executeRecruitmentPersistence returns deeply frozen object", () => {
      const result = executeRecruitmentPersistence(
        executionDecisionForCategory(MATCH_CATEGORIES.NO_MATCH)
      );
      assertAllFrozen(result);
    });

    test("metadata is frozen", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.NO_MATCH);
      expect(Object.isFrozen(result.metadata)).toBe(true);
    });

    test("decisionValidation is frozen", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.STRONG_MATCH);
      expect(Object.isFrozen(result.decisionValidation)).toBe(true);
      expect(Object.isFrozen(result.decisionValidation.reasons)).toBe(true);
    });

    test("supported planned operations reference is frozen", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.PROBABLE_MATCH);
      expect(result.supportedPlannedOperations).toBe(SUPPORTED_PLANNED_OPERATIONS);
      expect(Object.isFrozen(result.supportedPlannedOperations)).toBe(true);
    });

    test("result has no circular references", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(hasCircularReference(result)).toBe(false);
    });

    test("summarizePersistenceExecutionResult returns frozen summary", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const summary = summarizePersistenceExecutionResult(result);
      expect(Object.isFrozen(summary)).toBe(true);
    });

    test("invalid result summary is frozen", () => {
      const summary = summarizePersistenceExecutionResult(null);
      expect(Object.isFrozen(summary)).toBe(true);
      expect(summary.valid).toBe(false);
    });
  });

  describe("helper behavior", () => {
    test("records execution gateway phase in metadata", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(result.metadata.executionGatewayPhase).toBe(EXECUTION_GATEWAY_PHASE);
      expect(result.executionGatewayPhase).toBe(EXECUTION_GATEWAY_PHASE);
    });

    test("records execution decision entity reference", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.NO_MATCH);
      expect(result.executionDecisionEntity).toBe(EXECUTION_DECISION_ENTITY);
    });

    test("outcome rationale includes execution mode and planned operation", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(result.outcomeRationale).toContain("dry_run");
      expect(result.outcomeRationale).toContain("attach_recruitment");
    });

    test("matching profile catalog remains accessible for cross-phase alignment", () => {
      expect(MATCHING_PROFILE_BY_ID.official_identifier_exact.category).toBe(
        MATCH_CATEGORIES.EXACT_MATCH
      );
      expect(MATCHING_PROFILE_BY_ID.no_shared_identity_signals.category).toBe(
        MATCH_CATEGORIES.NO_MATCH
      );
    });

    test("anchor event short notification produces skipped persistence execution", () => {
      const identity = identityFromSignals(
        { recruitment_title: "SSC short notice" },
        { noticeContent: "Short notification regarding examination schedule" }
      );
      expect(identity.anchorEventId).toBe(ANCHOR_EVENT_IDS.SHORT_NOTIFICATION);
      const decision = createExecutionDecision(
        createPersistencePlan(createRecruitmentActionPlan(createMatchingResult(identity)))
      );
      const result = createPersistenceExecutionResult(decision);
      expect(result.executionOutcome).toBe(EXECUTION_OUTCOMES.SKIPPED);
      expect(result.plannedOperation).toBeNull();
    });

    test("high confidence identity flows through to persistence execution result profile", () => {
      const identity = identityFromSignals({
        recruitment_title: "SSC CGL 2026",
        organization: "Staff Selection Commission",
        official_identifier: "update:42",
        source_url: "https://ssc.nic.in"
      });
      const matching = createMatchingResult(identity);
      const result = createPersistenceExecutionResult(
        createExecutionDecision(
          createPersistencePlan(createRecruitmentActionPlan(matching))
        )
      );
      expect(matching.metadata.identityConfidenceLevel).toBe(CONFIDENCE_LEVELS.HIGH);
      expect(result.profileId).toBe(matching.profileId);
    });

    test("result embeds execution decision validation", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.STRONG_MATCH);
      expect(result.decisionValidation.valid).toBe(true);
      expect(Array.isArray(result.decisionValidation.reasons)).toBe(true);
    });

    test("createPersistenceExecutionResult sets createReason from decision validity", () => {
      const validResult = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(validResult.metadata.createReason).toBe("execution_decision");
      const invalidResult = createPersistenceExecutionResult({ garbage: true });
      expect(invalidResult.metadata.createReason).toBe("invalid_execution_decision");
    });

    test("summarizePersistenceExecutionResult never throws", () => {
      expect(() => summarizePersistenceExecutionResult(null)).not.toThrow();
      expect(() => summarizePersistenceExecutionResult(undefined)).not.toThrow();
    });

    test("summarizePersistenceExecutionResult for valid result includes key fields", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const summary = summarizePersistenceExecutionResult(result);
      expect(summary.valid).toBe(true);
      expect(summary.executionMode).toBe(EXECUTION_MODES.DRY_RUN);
      expect(summary.executed).toBe(false);
      expect(summary.plannedOperation).toBe(PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT);
    });

    test("records persistence coordinator phase via decision metadata", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(result.metadata.persistenceCoordinatorPhase).toBe(PERSISTENCE_COORDINATOR_PHASE);
    });

    test("all valid results keep performsPersistence false", () => {
      const categories = Object.values(MATCH_CATEGORIES);
      for (let i = 0; i < categories.length; i += 1) {
        const result = persistenceExecutionResultForCategory(categories[i]);
        expect(result.performsPersistence).toBe(false);
        expect(result.persistenceExecution).toBe(false);
        expect(result.queriesDatabase).toBe(false);
        expect(result.assignsRecruitmentIds).toBe(false);
      }
    });
  });

  describe("compatibility integration", () => {
    test("attachRecruitmentCompatibility stores persistence execution result internally", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 7601 };
      attachRecruitmentCompatibility(outcome, {
        notice: sampleNotice(),
        updateId: 7601
      });
      const persistenceResult = peekRecruitmentPersistenceExecutionResult(outcome);
      expect(persistenceResult).not.toBeNull();
      expect(persistenceResult.phase).toBe(76);
      expect(validatePersistenceExecutionResult(persistenceResult).valid).toBe(true);
    });

    test("persistence execution result is not a public field on pipeline outcome", () => {
      const outcome = { skipped: false, updateId: 7602 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 7602 });
      expect(
        Object.prototype.hasOwnProperty.call(outcome, "persistenceExecutionResult")
      ).toBe(false);
      expect(
        Object.prototype.hasOwnProperty.call(outcome, "recruitmentPersistenceExecutionResult")
      ).toBe(false);
    });

    test("peekRecruitmentPersistenceExecutionResult returns null for unrelated objects", () => {
      expect(peekRecruitmentPersistenceExecutionResult(null)).toBeNull();
      expect(peekRecruitmentPersistenceExecutionResult({})).toBeNull();
    });

    test("persistence execution result aligns with execution decision for same outcome", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 7603 };
      attachRecruitmentCompatibility(outcome, {
        notice: {
          title: "SSC CGL 2026",
          content: "Staff Selection Commission Advt. No. CGL-01/2026",
          url: "https://ssc.nic.in"
        },
        updateId: 7603
      });
      const executionDecision = peekRecruitmentExecutionDecision(outcome);
      const persistenceResult = peekRecruitmentPersistenceExecutionResult(outcome);
      expect(validateExecutionDecision(executionDecision).valid).toBe(true);
      expect(persistenceResult.plannedOperation).toBe(
        resolvePlannedOperation(executionDecision)
      );
      expect(persistenceResult.executionDecision).toBe(executionDecision.executionDecision);
    });

    test("execution decision and persistence result coexist in separate WeakMaps", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 7604 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 7604 });
      expect(peekRecruitmentExecutionDecision(outcome)).not.toBeNull();
      expect(peekRecruitmentPersistenceExecutionResult(outcome)).not.toBeNull();
      expect(peekRecruitmentExecutionDecision(outcome)).not.toBe(
        peekRecruitmentPersistenceExecutionResult(outcome)
      );
    });

    test("full chain attaches compatibility through persistence execution result", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 7605 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 7605 });
      expect(peekRecruitmentCompatibility(outcome)).not.toBeNull();
      expect(peekRecruitmentIdentityResolution(outcome)).not.toBeNull();
      expect(peekRecruitmentMatchingResult(outcome)).not.toBeNull();
      expect(peekRecruitmentActionPlan(outcome)).not.toBeNull();
      expect(peekRecruitmentPersistencePlan(outcome)).not.toBeNull();
      expect(peekRecruitmentExecutionDecision(outcome)).not.toBeNull();
      expect(peekRecruitmentPersistenceExecutionResult(outcome)).not.toBeNull();
    });

    test("compatibility attach still succeeds when persistence engine input is sparse", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: null };
      const attached = attachRecruitmentCompatibility(outcome, {});
      expect(attached).not.toBeNull();
      const persistenceResult = peekRecruitmentPersistenceExecutionResult(outcome);
      expect(persistenceResult).not.toBeNull();
      expect(persistenceResult.executionOutcome).toBe(EXECUTION_OUTCOMES.SKIPPED);
    });

    test("compatibility layer re-exports summarizePersistenceExecutionResult", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(summarizePersistenceFromCompat(result)).toEqual(
        summarizePersistenceExecutionResult(result)
      );
    });

    test("persistence execution result keeps executed false through compatibility attach", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 7606 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 7606 });
      const persistenceResult = peekRecruitmentPersistenceExecutionResult(outcome);
      expect(persistenceResult.executed).toBe(false);
    });
  });

  describe("compatibility failure isolation", () => {
    test("attachRecruitmentCompatibility never throws when persistence engine fails", () => {
      jest.resetModules();
      jest.doMock("../server/lib/recruitment/recruitmentPersistenceEngine", () => {
        const actual = jest.requireActual(
          "../server/lib/recruitment/recruitmentPersistenceEngine"
        );
        return {
          ...actual,
          executeRecruitmentPersistence: () => {
            throw new Error("persistence engine failure");
          }
        };
      });

      const compat = require("../server/lib/recruitment/recruitmentCompatibilityLayer");
      const outcome = { skipped: true, reason: "flag_off", updateId: 1 };

      expect(() =>
        compat.attachRecruitmentCompatibility(outcome, {
          notice: sampleNotice(),
          updateId: 1
        })
      ).not.toThrow();

      expect(compat.peekRecruitmentCompatibility(outcome)).not.toBeNull();
      expect(compat.peekRecruitmentIdentityResolution(outcome)).not.toBeNull();
      expect(compat.peekRecruitmentMatchingResult(outcome)).not.toBeNull();
      expect(compat.peekRecruitmentActionPlan(outcome)).not.toBeNull();
      expect(compat.peekRecruitmentPersistencePlan(outcome)).not.toBeNull();
      expect(compat.peekRecruitmentExecutionDecision(outcome)).not.toBeNull();
      expect(compat.peekRecruitmentPersistenceExecutionResult(outcome)).toBeNull();
      expect(compat.peekRecruitmentPersistenceAdapterResult(outcome)).toBeNull();

      jest.dontMock("../server/lib/recruitment/recruitmentPersistenceEngine");
      jest.resetModules();
    });

    test("persistence engine failure does not remove execution decision", () => {
      jest.resetModules();
      jest.doMock("../server/lib/recruitment/recruitmentPersistenceEngine", () => {
        const actual = jest.requireActual(
          "../server/lib/recruitment/recruitmentPersistenceEngine"
        );
        return {
          ...actual,
          executeRecruitmentPersistence: () => {
            throw new Error("persistence engine failure");
          }
        };
      });

      const compat = require("../server/lib/recruitment/recruitmentCompatibilityLayer");
      const outcome = { skipped: true, reason: "flag_off", updateId: 3 };

      compat.attachRecruitmentCompatibility(outcome, {
        notice: sampleNotice(),
        updateId: 3
      });

      expect(compat.peekRecruitmentExecutionDecision(outcome)).not.toBeNull();
      expect(compat.peekRecruitmentPersistenceExecutionResult(outcome)).toBeNull();

      jest.dontMock("../server/lib/recruitment/recruitmentPersistenceEngine");
      jest.resetModules();
    });

    test("execution gateway failure leaves persistence execution result absent without breaking attach", () => {
      jest.resetModules();
      jest.doMock("../server/lib/recruitment/recruitmentExecutionGateway", () => ({
        EXECUTION_GATEWAY_PHASE: 75,
        EXECUTION_DECISION_ENTITY: "recruitment_execution_decision",
        EXECUTION_DECISIONS: {
          ALLOWED: "allowed",
          BLOCKED: "blocked",
          DRY_RUN: "dry_run",
          MANUAL_REVIEW: "manual_review"
        },
        DEFAULT_EXECUTION_DECISION: "blocked",
        validateExecutionDecision: () => ({ valid: false, status: "invalid", reasons: [] }),
        summarizeExecutionDecision: () => ({ valid: false }),
        createExecutionDecision: () => {
          throw new Error("execution gateway failure");
        }
      }));

      const compat = require("../server/lib/recruitment/recruitmentCompatibilityLayer");
      const outcome = { skipped: true, reason: "flag_off", updateId: 2 };

      expect(() =>
        compat.attachRecruitmentCompatibility(outcome, {
          notice: sampleNotice(),
          updateId: 2
        })
      ).not.toThrow();

      expect(compat.peekRecruitmentExecutionDecision(outcome)).toBeNull();
      expect(compat.peekRecruitmentPersistenceExecutionResult(outcome)).toBeNull();
      expect(compat.peekRecruitmentPersistenceAdapterResult(outcome)).toBeNull();

      jest.dontMock("../server/lib/recruitment/recruitmentExecutionGateway");
      jest.resetModules();
    });
  });

  describe("worker observation compatibility", () => {
    test("worker observation path coexists with persistence execution result", () => {
      const outcome = runRecruitmentPipeline({
        notice: sampleNotice(),
        candidateRecruitments: [],
        isEnabled: true,
        updateId: 76001
      });
      const actionPlan = peekRecruitmentActionPlan(outcome);
      const persistenceResult = peekRecruitmentPersistenceExecutionResult(outcome);
      const observation = observeRecruitmentActionPlan(actionPlan);
      expect(observation.observationState).not.toBe(OBSERVATION_STATES.NOT_AVAILABLE);
      expect(persistenceResult).not.toBeNull();
      expect(persistenceResult.actionType).toBe(actionPlan.actionType);
    });

    test("deferred observation aligns with dry_run_simulated for create_recruitment", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.NO_MATCH);
      const observation = observeRecruitmentActionPlan(
        actionPlanForCategory(MATCH_CATEGORIES.NO_MATCH)
      );
      expect(observation.observationState).toBe(OBSERVATION_STATES.DEFERRED);
      expect(result.executionOutcome).toBe(EXECUTION_OUTCOMES.DRY_RUN_SIMULATED);
      expect(result.plannedOperation).toBe(PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT);
    });

    test("planned observation aligns with dry_run_simulated for attach_recruitment", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const observation = observeRecruitmentActionPlan(
        actionPlanForCategory(MATCH_CATEGORIES.EXACT_MATCH)
      );
      expect(observation.observationState).toBe(OBSERVATION_STATES.PLANNED);
      expect(result.executionOutcome).toBe(EXECUTION_OUTCOMES.DRY_RUN_SIMULATED);
      expect(result.plannedOperation).toBe(PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT);
    });

    test("manual_review observation aligns with skipped persistence execution", () => {
      const result = persistenceExecutionResultForCategory(MATCH_CATEGORIES.MANUAL_REVIEW);
      const observation = observeRecruitmentActionPlan(
        actionPlanForCategory(MATCH_CATEGORIES.MANUAL_REVIEW)
      );
      expect(observation.observationState).toBe(OBSERVATION_STATES.MANUAL_REVIEW);
      expect(result.executionOutcome).toBe(EXECUTION_OUTCOMES.SKIPPED);
    });

    test("ignored observation aligns with skipped persistence execution for invalid input", () => {
      const actionPlan = createRecruitmentActionPlan({ invalid: true });
      const decision = createExecutionDecision(createPersistencePlan(actionPlan));
      const result = createPersistenceExecutionResult(decision);
      const observation = observeRecruitmentActionPlan(actionPlan);
      expect(observation.observationState).toBe(OBSERVATION_STATES.IGNORED);
      expect(result.executionOutcome).toBe(EXECUTION_OUTCOMES.SKIPPED);
    });

    test("observation does not require persistence execution result peek", () => {
      const actionPlan = actionPlanForCategory(MATCH_CATEGORIES.STRONG_MATCH);
      expect(() => observeRecruitmentActionPlan(actionPlan)).not.toThrow();
    });
  });

  describe("pipeline output preservation", () => {
    const notice = sampleNotice();

    test("skipped outcome shape is unchanged", () => {
      const result = runRecruitmentPipeline({ notice, isEnabled: false });
      expect(result).toEqual({ skipped: true, reason: "flag_off", updateId: null });
    });

    test("success outcome shape is unchanged", () => {
      const processDetection = jest.fn().mockReturnValue({
        status: PROCESS_RESULT_STATUS.SUCCESS,
        warnings: [],
        eventType: "admit_card",
        selectedRecruitment: null,
        reviewItem: null
      });

      const result = runRecruitmentPipeline({
        notice,
        isEnabled: true,
        processDetection,
        updateId: 101
      });

      expect(result).toEqual({
        skipped: false,
        result: expect.objectContaining({ eventType: "admit_card" }),
        updateId: 101
      });
    });

    test("failure outcome shape is unchanged", () => {
      const processDetection = jest.fn(() => {
        throw new Error("detection failed");
      });

      const result = runRecruitmentPipeline({
        notice,
        isEnabled: true,
        processDetection,
        updateId: 44
      });

      expect(result).toEqual({
        skipped: false,
        failed: true,
        error: expect.any(Error),
        updateId: 44
      });
    });

    test("pipeline attaches persistence execution result without changing public return fields", () => {
      const result = runRecruitmentPipeline({
        notice,
        isEnabled: false,
        updateId: 88
      });
      const persistenceResult = peekRecruitmentPersistenceExecutionResult(result);
      expect(persistenceResult).not.toBeNull();
      expect(validatePersistenceExecutionResult(persistenceResult).valid).toBe(true);
      expect(result).toEqual({
        skipped: true,
        reason: "flag_off",
        updateId: 88
      });
    });

    test("detection processor arguments remain unchanged", () => {
      const processDetection = jest.fn().mockReturnValue({
        status: PROCESS_RESULT_STATUS.NO_MATCH,
        warnings: [],
        eventType: "result",
        selectedRecruitment: null,
        reviewItem: null
      });

      runRecruitmentPipeline({
        notice,
        candidateRecruitments: [{ id: 1 }],
        isEnabled: true,
        processDetection,
        createdAt: "2026-07-14T00:00:00.000Z",
        updateId: 3
      });

      expect(processDetection).toHaveBeenCalledWith({
        notice,
        candidateRecruitments: [{ id: 1 }],
        createdAt: "2026-07-14T00:00:00.000Z"
      });
    });

    test("pipeline outcome keys unchanged after persistence execution result attach", () => {
      const outcome = runRecruitmentPipeline({
        notice,
        candidateRecruitments: [],
        isEnabled: true,
        updateId: 76002
      });
      const keysBefore = Object.keys(outcome).sort();
      peekRecruitmentPersistenceExecutionResult(outcome);
      expect(Object.keys(outcome).sort()).toEqual(keysBefore);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("persistence engine documents Phase 76", () => {
      const source = read(ENGINE_MODULE_PATH);
      expect(source).toMatch(/Phase 76/);
    });

    test("persistence engine has no Express / DB / filesystem / env access", () => {
      const source = read(ENGINE_MODULE_PATH);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/require\(["'].*config\/db["']\)/);
      expect(source).not.toMatch(/process\.env/);
      expect(source).not.toMatch(/\bINSERT\s+INTO\b/i);
      expect(source).not.toMatch(/https?:\/\//);
    });

    test("persistence engine imports only execution gateway and persistence coordinator", () => {
      const source = read(ENGINE_MODULE_PATH);
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual([
        "./recruitmentExecutionGateway",
        "./recruitmentPersistenceCoordinator"
      ]);
    });

    test("persistence engine does not query database or assign recruitment IDs", () => {
      const source = read(ENGINE_MODULE_PATH);
      expect(source).toMatch(/executed: false/);
      expect(source).toMatch(/featureGated: true/);
      expect(source).toMatch(/persistenceExecution: false/);
      expect(source).toMatch(/assignsRecruitmentIds: false/);
      expect(source).toMatch(/queriesDatabase: false/);
      expect(source).not.toMatch(/recruitmentMatcher/);
      expect(source).not.toMatch(/processRecruitmentDetection/);
      expect(source).not.toMatch(/mysqlPersistenceRepositoryAdapters/);
    });

    test("compatibility layer integrates persistence engine additively", () => {
      const source = read(COMPATIBILITY_MODULE_PATH);
      expect(source).toMatch(/recruitmentPersistenceEngine/);
      expect(source).toMatch(/executeRecruitmentPersistence/);
      expect(source).toMatch(/persistenceExecutionResultByPipelineOutcome/);
      expect(source).toMatch(/peekRecruitmentPersistenceExecutionResult/);
      expect(source).toMatch(/recruitmentPersistenceAdapter/);
      expect(source).toMatch(/executePersistenceAdapter/);
      expect(source).toMatch(/persistenceAdapterResultByPipelineOutcome/);
      expect(source).toMatch(/peekRecruitmentPersistenceAdapterResult/);
    });

    test("runRecruitmentPipeline does not import persistence engine directly", () => {
      const source = read(PIPELINE_MODULE_PATH);
      expect(source).toMatch(/recruitmentCompatibilityLayer/);
      expect(source).not.toMatch(/recruitmentPersistenceEngine/);
    });

    test("siteWorker does not import persistence engine directly", () => {
      const worker = read(WORKER_MODULE_PATH);
      expect(worker).not.toMatch(/recruitmentPersistenceEngine/);
      expect(worker).not.toMatch(/peekRecruitmentPersistenceExecutionResult/);
      expect(worker).toMatch(/recruitmentWorkerObservation/);
      expect(worker).toMatch(/peekRecruitmentActionPlan/);
    });

    test("persistence engine has no WeakMap — internal storage lives in compatibility layer", () => {
      const source = read(ENGINE_MODULE_PATH);
      expect(source).not.toMatch(/WeakMap/);
      expect(source).not.toMatch(/recruitmentCompatibilityLayer/);
    });

    test("execution gateway does not import persistence engine", () => {
      const source = read(GATEWAY_MODULE_PATH);
      expect(source).not.toMatch(/recruitmentPersistenceEngine/);
    });
  });
});
