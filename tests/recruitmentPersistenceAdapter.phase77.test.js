"use strict";

/**
 * Phase 77 — Recruitment Persistence Adapter (Execution Boundary) tests.
 * Exports, adapter states, deterministic behavior, validation, immutability,
 * helper behavior, compatibility integration, pipeline output preservation,
 * failure isolation, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  PERSISTENCE_ADAPTER_PHASE,
  PERSISTENCE_ADAPTER_RESULT_ENTITY,
  ADAPTER_STATES,
  SUPPORTED_ADAPTER_STATES,
  DEFAULT_ADAPTER_STATE,
  EXECUTION_OUTCOME_TO_ADAPTER_STATE,
  PERSISTENCE_ADAPTER_RESULT_DESCRIPTOR,
  PERSISTENCE_ADAPTER_METADATA,
  VALIDATION_STATUS,
  isAdapterState,
  resolveAdapterState,
  createPersistenceAdapterResult,
  executePersistenceAdapter,
  validatePersistenceAdapterResult,
  summarizePersistenceAdapterResult
} = require("../server/lib/recruitment/recruitmentPersistenceAdapter");

const {
  PERSISTENCE_ENGINE_PHASE,
  EXECUTION_MODES,
  EXECUTION_OUTCOMES,
  createPersistenceExecutionResult,
  executeRecruitmentPersistence,
  validatePersistenceExecutionResult
} = require("../server/lib/recruitment/recruitmentPersistenceEngine");

const {
  EXECUTION_DECISIONS,
  createExecutionDecision
} = require("../server/lib/recruitment/recruitmentExecutionGateway");

const {
  PERSISTENCE_OPERATIONS,
  createPersistencePlan
} = require("../server/lib/recruitment/recruitmentPersistenceCoordinator");

const {
  ACTION_TYPES,
  createRecruitmentActionPlan
} = require("../server/lib/recruitment/recruitmentActionPlanner");

const {
  MATCH_CATEGORIES
} = require("../server/lib/recruitment/recruitmentMatchingContracts");

const {
  createMatchingResult
} = require("../server/lib/recruitment/recruitmentMatchingEngine");

const {
  IDENTITY_RESOLUTION_STATES,
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
  peekRecruitmentPersistenceAdapterResult,
  summarizePersistenceAdapterResult: summarizeAdapterFromCompat
} = require("../server/lib/recruitment/recruitmentCompatibilityLayer");

const {
  observeRecruitmentActionPlan,
  OBSERVATION_STATES
} = require("../server/lib/recruitment/recruitmentWorkerObservation");

const { runRecruitmentPipeline } = require("../server/lib/recruitment/runRecruitmentPipeline");
const { PROCESS_RESULT_STATUS } = require("../server/lib/recruitment/detectionProcessor");

const ROOT = path.join(__dirname, "..");
const ADAPTER_MODULE_PATH = "server/lib/recruitment/recruitmentPersistenceAdapter.js";
const COMPATIBILITY_MODULE_PATH = "server/lib/recruitment/recruitmentCompatibilityLayer.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";
const ENGINE_MODULE_PATH = "server/lib/recruitment/recruitmentPersistenceEngine.js";

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

function persistenceAdapterResultForCategory(matchCategory, options) {
  return createPersistenceAdapterResult(
    persistenceExecutionResultForCategory(matchCategory, options)
  );
}

describe("Phase 77 — recruitmentPersistenceAdapter", () => {
  describe("exports", () => {
    test("exposes phase 77 persistence adapter constants and descriptor", () => {
      expect(PERSISTENCE_ADAPTER_PHASE).toBe(77);
      expect(PERSISTENCE_ADAPTER_RESULT_ENTITY).toBe("recruitment_persistence_adapter_result");
      expect(PERSISTENCE_ADAPTER_RESULT_DESCRIPTOR.phase).toBe(77);
      expect(PERSISTENCE_ADAPTER_METADATA.connected).toBe(false);
      expect(PERSISTENCE_ADAPTER_METADATA.executed).toBe(false);
    });

    test("defines supported adapter states", () => {
      expect(SUPPORTED_ADAPTER_STATES.size).toBe(4);
      expect(Object.values(ADAPTER_STATES)).toEqual([
        "not_connected",
        "dry_run",
        "blocked",
        "executed"
      ]);
    });

    test("default adapter state is not_connected", () => {
      expect(DEFAULT_ADAPTER_STATE).toBe(ADAPTER_STATES.NOT_CONNECTED);
    });

    test("defines execution outcome to adapter state mapping", () => {
      expect(EXECUTION_OUTCOME_TO_ADAPTER_STATE[EXECUTION_OUTCOMES.DRY_RUN_SIMULATED]).toBe(
        ADAPTER_STATES.DRY_RUN
      );
      expect(EXECUTION_OUTCOME_TO_ADAPTER_STATE[EXECUTION_OUTCOMES.FEATURE_GATE_BLOCKED]).toBe(
        ADAPTER_STATES.BLOCKED
      );
      expect(EXECUTION_OUTCOME_TO_ADAPTER_STATE[EXECUTION_OUTCOMES.SKIPPED]).toBe(
        ADAPTER_STATES.BLOCKED
      );
      expect(EXECUTION_OUTCOME_TO_ADAPTER_STATE[EXECUTION_OUTCOMES.INVALID_DECISION]).toBe(
        ADAPTER_STATES.NOT_CONNECTED
      );
      expect(EXECUTION_OUTCOME_TO_ADAPTER_STATE[EXECUTION_OUTCOMES.UNSUPPORTED_OPERATION]).toBe(
        ADAPTER_STATES.BLOCKED
      );
    });

    test("exports public API functions", () => {
      expect(typeof isAdapterState).toBe("function");
      expect(typeof resolveAdapterState).toBe("function");
      expect(typeof createPersistenceAdapterResult).toBe("function");
      expect(typeof executePersistenceAdapter).toBe("function");
      expect(typeof validatePersistenceAdapterResult).toBe("function");
      expect(typeof summarizePersistenceAdapterResult).toBe("function");
    });

    test("isAdapterState validates supported states", () => {
      expect(isAdapterState(ADAPTER_STATES.DRY_RUN)).toBe(true);
      expect(isAdapterState(ADAPTER_STATES.BLOCKED)).toBe(true);
      expect(isAdapterState(ADAPTER_STATES.NOT_CONNECTED)).toBe(true);
      expect(isAdapterState(ADAPTER_STATES.EXECUTED)).toBe(true);
      expect(isAdapterState("live")).toBe(false);
      expect(isAdapterState(null)).toBe(false);
    });

    test("descriptor references persistence engine phase", () => {
      expect(PERSISTENCE_ADAPTER_RESULT_DESCRIPTOR.metadata.persistenceEnginePhase).toBe(76);
    });
  });

  describe("adapter states", () => {
    test("dry_run_simulated maps to dry_run adapter state for no_match", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.NO_MATCH);
      expect(result.executionOutcome).toBe(EXECUTION_OUTCOMES.DRY_RUN_SIMULATED);
      expect(result.adapterState).toBe(ADAPTER_STATES.DRY_RUN);
    });

    test("dry_run_simulated maps to dry_run adapter state for exact match", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(result.executionOutcome).toBe(EXECUTION_OUTCOMES.DRY_RUN_SIMULATED);
      expect(result.adapterState).toBe(ADAPTER_STATES.DRY_RUN);
    });

    test("dry_run_simulated maps to dry_run adapter state for strong match", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.STRONG_MATCH);
      expect(result.adapterState).toBe(ADAPTER_STATES.DRY_RUN);
    });

    test("feature_gate_blocked maps to blocked adapter state", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.NO_MATCH, {
        executionMode: EXECUTION_MODES.ENABLED
      });
      expect(result.executionOutcome).toBe(EXECUTION_OUTCOMES.FEATURE_GATE_BLOCKED);
      expect(result.adapterState).toBe(ADAPTER_STATES.BLOCKED);
    });

    test("skipped maps to blocked adapter state for manual_review", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.MANUAL_REVIEW);
      expect(result.executionOutcome).toBe(EXECUTION_OUTCOMES.SKIPPED);
      expect(result.adapterState).toBe(ADAPTER_STATES.BLOCKED);
    });

    test("skipped maps to blocked adapter state for probable match", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.PROBABLE_MATCH);
      expect(result.adapterState).toBe(ADAPTER_STATES.BLOCKED);
    });

    test("skipped maps to blocked adapter state for weak match", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.WEAK_MATCH);
      expect(result.adapterState).toBe(ADAPTER_STATES.BLOCKED);
    });

    test("invalid_decision maps to not_connected adapter state", () => {
      const executionResult = createPersistenceExecutionResult({ garbage: true });
      const result = createPersistenceAdapterResult(executionResult);
      expect(result.executionOutcome).toBe(EXECUTION_OUTCOMES.INVALID_DECISION);
      expect(result.adapterState).toBe(ADAPTER_STATES.NOT_CONNECTED);
    });

    test("null execution result maps to not_connected adapter state", () => {
      const result = createPersistenceAdapterResult(null);
      expect(result.adapterState).toBe(ADAPTER_STATES.NOT_CONNECTED);
      expect(result.executionResultValid).toBe(false);
    });

    test("connected defaults to false for all adapter states", () => {
      const categories = Object.values(MATCH_CATEGORIES);
      for (let i = 0; i < categories.length; i += 1) {
        const result = persistenceAdapterResultForCategory(categories[i]);
        expect(result.connected).toBe(false);
      }
    });

    test("executed boolean remains false for all adapter states", () => {
      const categories = Object.values(MATCH_CATEGORIES);
      for (let i = 0; i < categories.length; i += 1) {
        const result = persistenceAdapterResultForCategory(categories[i]);
        expect(result.executed).toBe(false);
      }
    });

    test("executed adapter state is never assigned in phase 77", () => {
      const categories = Object.values(MATCH_CATEGORIES);
      for (let i = 0; i < categories.length; i += 1) {
        const result = persistenceAdapterResultForCategory(categories[i]);
        expect(result.adapterState).not.toBe(ADAPTER_STATES.EXECUTED);
      }
    });

    test("adapter rationale includes adapter state", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(result.adapterRationale).toContain("adapter_state=dry_run");
      expect(result.adapterRationale).toContain("execution_outcome=dry_run_simulated");
    });

    test("blocked adapter rationale references blocked state", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.MANUAL_REVIEW);
      expect(result.adapterRationale).toContain("adapter_state=blocked");
    });

    test("not_connected adapter rationale references not_connected state", () => {
      const result = createPersistenceAdapterResult(null);
      expect(result.adapterRationale).toContain("adapter_state=not_connected");
    });

    test("resolveAdapterState returns dry_run for dry_run_simulated outcome", () => {
      const state = resolveAdapterState(
        { executionOutcome: EXECUTION_OUTCOMES.DRY_RUN_SIMULATED },
        { valid: true }
      );
      expect(state).toBe(ADAPTER_STATES.DRY_RUN);
    });

    test("resolveAdapterState returns blocked for feature_gate_blocked outcome", () => {
      const state = resolveAdapterState(
        { executionOutcome: EXECUTION_OUTCOMES.FEATURE_GATE_BLOCKED },
        { valid: true }
      );
      expect(state).toBe(ADAPTER_STATES.BLOCKED);
    });

    test("resolveAdapterState returns blocked for skipped outcome", () => {
      const state = resolveAdapterState(
        { executionOutcome: EXECUTION_OUTCOMES.SKIPPED },
        { valid: true }
      );
      expect(state).toBe(ADAPTER_STATES.BLOCKED);
    });

    test("resolveAdapterState returns not_connected for invalid validation", () => {
      const state = resolveAdapterState(
        { executionOutcome: EXECUTION_OUTCOMES.DRY_RUN_SIMULATED },
        { valid: false }
      );
      expect(state).toBe(ADAPTER_STATES.NOT_CONNECTED);
    });

    test("resolveAdapterState returns not_connected for null execution result", () => {
      const state = resolveAdapterState(null, { valid: true });
      expect(state).toBe(ADAPTER_STATES.NOT_CONNECTED);
    });

    test("unsupported_operation maps to blocked adapter state via mapping", () => {
      expect(EXECUTION_OUTCOME_TO_ADAPTER_STATE[EXECUTION_OUTCOMES.UNSUPPORTED_OPERATION]).toBe(
        ADAPTER_STATES.BLOCKED
      );
      const state = resolveAdapterState(
        { executionOutcome: EXECUTION_OUTCOMES.UNSUPPORTED_OPERATION },
        { valid: true }
      );
      expect(state).toBe(ADAPTER_STATES.BLOCKED);
    });

    test("enabled mode blocked outcome maps to blocked adapter state", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH, {
        executionMode: EXECUTION_MODES.ENABLED
      });
      expect(result.adapterState).toBe(ADAPTER_STATES.BLOCKED);
    });
  });

  describe("deterministic behavior", () => {
    test("createPersistenceAdapterResult is deterministic for same input", () => {
      const executionResult = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const first = createPersistenceAdapterResult(executionResult);
      const second = createPersistenceAdapterResult(executionResult);
      expect(first.adapterState).toBe(second.adapterState);
      expect(first.executionOutcome).toBe(second.executionOutcome);
      expect(first.adapterRationale).toBe(second.adapterRationale);
    });

    test("executePersistenceAdapter is deterministic for same input", () => {
      const executionResult = persistenceExecutionResultForCategory(MATCH_CATEGORIES.NO_MATCH);
      const first = executePersistenceAdapter(executionResult);
      const second = executePersistenceAdapter(executionResult);
      expect(first.adapterState).toBe(second.adapterState);
      expect(first.connected).toBe(second.connected);
      expect(first.executed).toBe(second.executed);
    });

    test("createPersistenceAdapterResult handles null execution result deterministically", () => {
      const first = createPersistenceAdapterResult(null);
      const second = createPersistenceAdapterResult(null);
      expect(first.adapterState).toBe(second.adapterState);
      expect(first.adapterState).toBe(ADAPTER_STATES.NOT_CONNECTED);
    });

    test("createPersistenceAdapterResult handles undefined execution result", () => {
      const result = createPersistenceAdapterResult(undefined);
      expect(result.executionResultValid).toBe(false);
      expect(result.connected).toBe(false);
      expect(result.executed).toBe(false);
    });

    test("executePersistenceAdapter never throws", () => {
      expect(() => executePersistenceAdapter(Symbol("x"))).not.toThrow();
      expect(() => executePersistenceAdapter(() => {})).not.toThrow();
    });

    test("createPersistenceAdapterResult never throws", () => {
      expect(() => createPersistenceAdapterResult(Symbol("x"))).not.toThrow();
      expect(() => createPersistenceAdapterResult(() => {})).not.toThrow();
    });

    test("executePersistenceAdapter matches createPersistenceAdapterResult fields", () => {
      const executionResult = persistenceExecutionResultForCategory(MATCH_CATEGORIES.STRONG_MATCH);
      const created = createPersistenceAdapterResult(executionResult);
      const executed = executePersistenceAdapter(executionResult);
      expect(executed.adapterState).toBe(created.adapterState);
      expect(executed.executionOutcome).toBe(created.executionOutcome);
      expect(executed.connected).toBe(created.connected);
      expect(executed.executed).toBe(created.executed);
    });

    test("all match categories produce deterministic connected false", () => {
      const categories = Object.values(MATCH_CATEGORIES);
      for (let i = 0; i < categories.length; i += 1) {
        const result = persistenceAdapterResultForCategory(categories[i]);
        expect(result.connected).toBe(false);
      }
    });

    test("resolveAdapterState is deterministic", () => {
      const executionResult = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const validation = validatePersistenceExecutionResult(executionResult);
      const first = resolveAdapterState(executionResult, validation);
      const second = resolveAdapterState(executionResult, validation);
      expect(first).toBe(second);
    });
  });

  describe("validation", () => {
    test("valid persistence adapter result passes validation", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const validation = validatePersistenceAdapterResult(result);
      expect(validation.valid).toBe(true);
      expect(validation.status).toBe(VALIDATION_STATUS.VALID);
      expect(validation.reasons).toEqual([]);
    });

    test("invalid shape fails validation", () => {
      const validation = validatePersistenceAdapterResult(null);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_RESULT_SHAPE");
    });

    test("wrong phase fails validation", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...result, phase: 76 };
      const validation = validatePersistenceAdapterResult(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_PHASE");
    });

    test("wrong entity fails validation", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...result, entity: "wrong_entity" };
      const validation = validatePersistenceAdapterResult(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_ENTITY");
    });

    test("connected true fails validation", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...result, connected: true };
      const validation = validatePersistenceAdapterResult(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("CONNECTED_MUST_BE_FALSE");
    });

    test("executed true fails validation", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...result, executed: true };
      const validation = validatePersistenceAdapterResult(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("EXECUTED_MUST_BE_FALSE");
    });

    test("executed adapter state fails validation in phase 77", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...result, adapterState: ADAPTER_STATES.EXECUTED };
      const validation = validatePersistenceAdapterResult(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("EXECUTED_ADAPTER_STATE_NOT_SUPPORTED_IN_PHASE_77");
    });

    test("persistenceExecution true fails validation", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...result, persistenceExecution: true };
      const validation = validatePersistenceAdapterResult(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("EXECUTION_FLAGS_MUST_BE_FALSE");
    });

    test("adapter state inconsistent with execution outcome fails validation", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...result, adapterState: ADAPTER_STATES.BLOCKED };
      const validation = validatePersistenceAdapterResult(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("ADAPTER_STATE_INCONSISTENT_WITH_EXECUTION_OUTCOME");
    });

    test("invalid execution result valid flag requires not_connected", () => {
      const result = createPersistenceAdapterResult(null);
      const tampered = { ...result, adapterState: ADAPTER_STATES.DRY_RUN };
      const validation = validatePersistenceAdapterResult(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_RESULT_REQUIRES_NOT_CONNECTED");
    });

    test("missing adapter rationale fails validation", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...result, adapterRationale: "" };
      const validation = validatePersistenceAdapterResult(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("MISSING_ADAPTER_RATIONALE");
    });

    test("validatePersistenceAdapterResult never throws", () => {
      expect(() => validatePersistenceAdapterResult(Symbol("x"))).not.toThrow();
      expect(() => validatePersistenceAdapterResult(() => {})).not.toThrow();
    });

    test("sideEffects true fails validation", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...result, sideEffects: true };
      const validation = validatePersistenceAdapterResult(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("SIDE_EFFECT_FLAGS_MUST_BE_FALSE");
    });

    test("persistenceEnabled true fails validation", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...result, persistenceEnabled: true };
      const validation = validatePersistenceAdapterResult(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("SIDE_EFFECT_FLAGS_MUST_BE_FALSE");
    });

    test("invalid persistence engine phase fails validation", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...result, persistenceEnginePhase: 75 };
      const validation = validatePersistenceAdapterResult(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_PERSISTENCE_ENGINE_PHASE");
    });
  });

  describe("immutability", () => {
    test("createPersistenceAdapterResult returns deeply frozen result", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      assertAllFrozen(result);
    });

    test("executePersistenceAdapter returns deeply frozen result", () => {
      const result = executePersistenceAdapter(
        persistenceExecutionResultForCategory(MATCH_CATEGORIES.NO_MATCH)
      );
      assertAllFrozen(result);
    });

    test("adapter result has no circular references", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.STRONG_MATCH);
      expect(hasCircularReference(result)).toBe(false);
    });

    test("metadata is frozen", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(Object.isFrozen(result.metadata)).toBe(true);
    });

    test("executionResultValidation is frozen", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(Object.isFrozen(result.executionResultValidation)).toBe(true);
      expect(Object.isFrozen(result.executionResultValidation.reasons)).toBe(true);
    });

    test("executionSummary is frozen", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(Object.isFrozen(result.executionSummary)).toBe(true);
    });

    test("supportedAdapterStates is frozen set reference", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(result.supportedAdapterStates).toBe(SUPPORTED_ADAPTER_STATES);
    });
  });

  describe("helper behavior", () => {
    test("result embeds execution result validation", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.STRONG_MATCH);
      expect(result.executionResultValidation.valid).toBe(true);
      expect(Array.isArray(result.executionResultValidation.reasons)).toBe(true);
    });

    test("result embeds execution summary from phase 76", () => {
      const executionResult = persistenceExecutionResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const result = createPersistenceAdapterResult(executionResult);
      expect(result.executionSummary.valid).toBe(true);
      expect(result.executionSummary.plannedOperation).toBe(
        executionResult.plannedOperation
      );
    });

    test("createPersistenceAdapterResult sets createReason from execution result validity", () => {
      const validResult = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(validResult.metadata.createReason).toBe("persistence_execution_result");
      const invalidResult = createPersistenceAdapterResult(null);
      expect(invalidResult.metadata.createReason).toBe("invalid_persistence_execution_result");
    });

    test("summarizePersistenceAdapterResult never throws", () => {
      expect(() => summarizePersistenceAdapterResult(null)).not.toThrow();
      expect(() => summarizePersistenceAdapterResult(undefined)).not.toThrow();
    });

    test("summarizePersistenceAdapterResult for valid result includes key fields", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const summary = summarizePersistenceAdapterResult(result);
      expect(summary.valid).toBe(true);
      expect(summary.connected).toBe(false);
      expect(summary.executed).toBe(false);
      expect(summary.adapterState).toBe(ADAPTER_STATES.DRY_RUN);
      expect(summary.plannedOperation).toBe(PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT);
    });

    test("summarizePersistenceAdapterResult for invalid result returns safe defaults", () => {
      const summary = summarizePersistenceAdapterResult(null);
      expect(summary.valid).toBe(false);
      expect(summary.connected).toBe(false);
      expect(summary.executed).toBe(false);
      expect(summary.adapterState).toBe(ADAPTER_STATES.NOT_CONNECTED);
    });

    test("records persistence engine phase via metadata", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(result.metadata.persistenceEnginePhase).toBe(PERSISTENCE_ENGINE_PHASE);
      expect(result.persistenceEnginePhase).toBe(PERSISTENCE_ENGINE_PHASE);
    });

    test("all valid results keep performsPersistence false", () => {
      const categories = Object.values(MATCH_CATEGORIES);
      for (let i = 0; i < categories.length; i += 1) {
        const result = persistenceAdapterResultForCategory(categories[i]);
        expect(result.performsPersistence).toBe(false);
        expect(result.persistenceExecution).toBe(false);
        expect(result.queriesDatabase).toBe(false);
        expect(result.assignsRecruitmentIds).toBe(false);
      }
    });

    test("dry_run adapter preserves planned operation from execution result", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.NO_MATCH);
      expect(result.plannedOperation).toBe(PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT);
      expect(result.actionType).toBe(ACTION_TYPES.CREATE_NEW_RECRUITMENT);
    });

    test("blocked adapter preserves action type from execution result", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.MANUAL_REVIEW);
      expect(result.actionType).toBe(ACTION_TYPES.MANUAL_REVIEW);
      expect(result.plannedOperation).toBeNull();
    });
  });

  describe("compatibility integration", () => {
    test("attachRecruitmentCompatibility stores persistence adapter result internally", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 7701 };
      attachRecruitmentCompatibility(outcome, {
        notice: sampleNotice(),
        updateId: 7701
      });
      const adapterResult = peekRecruitmentPersistenceAdapterResult(outcome);
      expect(adapterResult).not.toBeNull();
      expect(adapterResult.phase).toBe(77);
      expect(validatePersistenceAdapterResult(adapterResult).valid).toBe(true);
    });

    test("persistence adapter result is not a public field on pipeline outcome", () => {
      const outcome = { skipped: false, updateId: 7702 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 7702 });
      expect(
        Object.prototype.hasOwnProperty.call(outcome, "persistenceAdapterResult")
      ).toBe(false);
      expect(
        Object.prototype.hasOwnProperty.call(outcome, "recruitmentPersistenceAdapterResult")
      ).toBe(false);
    });

    test("peekRecruitmentPersistenceAdapterResult returns null for unrelated objects", () => {
      expect(peekRecruitmentPersistenceAdapterResult(null)).toBeNull();
      expect(peekRecruitmentPersistenceAdapterResult({})).toBeNull();
    });

    test("persistence adapter result aligns with persistence execution result for same outcome", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 7703 };
      attachRecruitmentCompatibility(outcome, {
        notice: {
          title: "SSC CGL 2026",
          content: "Staff Selection Commission Advt. No. CGL-01/2026",
          url: "https://ssc.nic.in"
        },
        updateId: 7703
      });
      const persistenceResult = peekRecruitmentPersistenceExecutionResult(outcome);
      const adapterResult = peekRecruitmentPersistenceAdapterResult(outcome);
      expect(validatePersistenceExecutionResult(persistenceResult).valid).toBe(true);
      expect(adapterResult.executionOutcome).toBe(persistenceResult.executionOutcome);
      expect(adapterResult.plannedOperation).toBe(persistenceResult.plannedOperation);
    });

    test("persistence execution result and adapter result coexist in separate WeakMaps", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 7704 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 7704 });
      expect(peekRecruitmentPersistenceExecutionResult(outcome)).not.toBeNull();
      expect(peekRecruitmentPersistenceAdapterResult(outcome)).not.toBeNull();
      expect(peekRecruitmentPersistenceExecutionResult(outcome)).not.toBe(
        peekRecruitmentPersistenceAdapterResult(outcome)
      );
    });

    test("full chain attaches compatibility through persistence adapter result", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 7705 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 7705 });
      expect(peekRecruitmentCompatibility(outcome)).not.toBeNull();
      expect(peekRecruitmentIdentityResolution(outcome)).not.toBeNull();
      expect(peekRecruitmentMatchingResult(outcome)).not.toBeNull();
      expect(peekRecruitmentActionPlan(outcome)).not.toBeNull();
      expect(peekRecruitmentPersistencePlan(outcome)).not.toBeNull();
      expect(peekRecruitmentExecutionDecision(outcome)).not.toBeNull();
      expect(peekRecruitmentPersistenceExecutionResult(outcome)).not.toBeNull();
      expect(peekRecruitmentPersistenceAdapterResult(outcome)).not.toBeNull();
    });

    test("compatibility attach still succeeds when adapter input is sparse", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: null };
      const attached = attachRecruitmentCompatibility(outcome, {});
      expect(attached).not.toBeNull();
      const adapterResult = peekRecruitmentPersistenceAdapterResult(outcome);
      expect(adapterResult).not.toBeNull();
      expect(adapterResult.adapterState).toBe(ADAPTER_STATES.BLOCKED);
    });

    test("compatibility layer re-exports summarizePersistenceAdapterResult", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(summarizeAdapterFromCompat(result)).toEqual(
        summarizePersistenceAdapterResult(result)
      );
    });

    test("persistence adapter result keeps connected and executed false through compatibility attach", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 7706 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 7706 });
      const adapterResult = peekRecruitmentPersistenceAdapterResult(outcome);
      expect(adapterResult.connected).toBe(false);
      expect(adapterResult.executed).toBe(false);
    });
  });

  describe("compatibility failure isolation", () => {
    test("attachRecruitmentCompatibility never throws when persistence adapter fails", () => {
      jest.resetModules();
      jest.doMock("../server/lib/recruitment/recruitmentPersistenceAdapter", () => ({
        executePersistenceAdapter: () => {
          throw new Error("persistence adapter failure");
        },
        summarizePersistenceAdapterResult: () => ({ valid: false })
      }));

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
      expect(compat.peekRecruitmentPersistenceExecutionResult(outcome)).not.toBeNull();
      expect(compat.peekRecruitmentPersistenceAdapterResult(outcome)).toBeNull();

      jest.dontMock("../server/lib/recruitment/recruitmentPersistenceAdapter");
      jest.resetModules();
    });

    test("persistence adapter failure does not remove persistence execution result", () => {
      jest.resetModules();
      jest.doMock("../server/lib/recruitment/recruitmentPersistenceAdapter", () => ({
        executePersistenceAdapter: () => {
          throw new Error("persistence adapter failure");
        },
        summarizePersistenceAdapterResult: () => ({ valid: false })
      }));

      const compat = require("../server/lib/recruitment/recruitmentCompatibilityLayer");
      const outcome = { skipped: true, reason: "flag_off", updateId: 3 };

      compat.attachRecruitmentCompatibility(outcome, {
        notice: sampleNotice(),
        updateId: 3
      });

      expect(compat.peekRecruitmentPersistenceExecutionResult(outcome)).not.toBeNull();
      expect(compat.peekRecruitmentPersistenceAdapterResult(outcome)).toBeNull();

      jest.dontMock("../server/lib/recruitment/recruitmentPersistenceAdapter");
      jest.resetModules();
    });

    test("persistence engine failure leaves persistence adapter result absent without breaking attach", () => {
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
      const outcome = { skipped: true, reason: "flag_off", updateId: 2 };

      expect(() =>
        compat.attachRecruitmentCompatibility(outcome, {
          notice: sampleNotice(),
          updateId: 2
        })
      ).not.toThrow();

      expect(compat.peekRecruitmentPersistenceExecutionResult(outcome)).toBeNull();
      expect(compat.peekRecruitmentPersistenceAdapterResult(outcome)).toBeNull();

      jest.dontMock("../server/lib/recruitment/recruitmentPersistenceEngine");
      jest.resetModules();
    });
  });

  describe("worker observation compatibility", () => {
    test("worker observation path coexists with persistence adapter result", () => {
      const outcome = runRecruitmentPipeline({
        notice: sampleNotice(),
        candidateRecruitments: [],
        isEnabled: true,
        updateId: 77001
      });
      const actionPlan = peekRecruitmentActionPlan(outcome);
      const adapterResult = peekRecruitmentPersistenceAdapterResult(outcome);
      const observation = observeRecruitmentActionPlan(actionPlan);
      expect(observation.observationState).not.toBe(OBSERVATION_STATES.NOT_AVAILABLE);
      expect(adapterResult).not.toBeNull();
      expect(adapterResult.actionType).toBe(actionPlan.actionType);
    });

    test("deferred observation aligns with dry_run adapter for create_recruitment", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.NO_MATCH);
      const observation = observeRecruitmentActionPlan(
        actionPlanForCategory(MATCH_CATEGORIES.NO_MATCH)
      );
      expect(observation.observationState).toBe(OBSERVATION_STATES.DEFERRED);
      expect(result.adapterState).toBe(ADAPTER_STATES.DRY_RUN);
      expect(result.plannedOperation).toBe(PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT);
    });

    test("planned observation aligns with dry_run adapter for attach_recruitment", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const observation = observeRecruitmentActionPlan(
        actionPlanForCategory(MATCH_CATEGORIES.EXACT_MATCH)
      );
      expect(observation.observationState).toBe(OBSERVATION_STATES.PLANNED);
      expect(result.adapterState).toBe(ADAPTER_STATES.DRY_RUN);
      expect(result.plannedOperation).toBe(PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT);
    });

    test("manual_review observation aligns with blocked adapter", () => {
      const result = persistenceAdapterResultForCategory(MATCH_CATEGORIES.MANUAL_REVIEW);
      const observation = observeRecruitmentActionPlan(
        actionPlanForCategory(MATCH_CATEGORIES.MANUAL_REVIEW)
      );
      expect(observation.observationState).toBe(OBSERVATION_STATES.MANUAL_REVIEW);
      expect(result.adapterState).toBe(ADAPTER_STATES.BLOCKED);
    });

    test("ignored observation aligns with blocked adapter for invalid input", () => {
      const actionPlan = createRecruitmentActionPlan({ invalid: true });
      const decision = createExecutionDecision(createPersistencePlan(actionPlan));
      const executionResult = createPersistenceExecutionResult(decision);
      const result = createPersistenceAdapterResult(executionResult);
      const observation = observeRecruitmentActionPlan(actionPlan);
      expect(observation.observationState).toBe(OBSERVATION_STATES.IGNORED);
      expect(result.adapterState).toBe(ADAPTER_STATES.BLOCKED);
    });

    test("observation does not require persistence adapter result peek", () => {
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

    test("pipeline attaches persistence adapter result without changing public return fields", () => {
      const result = runRecruitmentPipeline({
        notice,
        isEnabled: false,
        updateId: 88
      });
      const adapterResult = peekRecruitmentPersistenceAdapterResult(result);
      expect(adapterResult).not.toBeNull();
      expect(validatePersistenceAdapterResult(adapterResult).valid).toBe(true);
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

    test("pipeline outcome keys unchanged after persistence adapter result attach", () => {
      const outcome = runRecruitmentPipeline({
        notice,
        candidateRecruitments: [],
        isEnabled: true,
        updateId: 77002
      });
      const keysBefore = Object.keys(outcome).sort();
      peekRecruitmentPersistenceAdapterResult(outcome);
      expect(Object.keys(outcome).sort()).toEqual(keysBefore);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("persistence adapter documents Phase 77", () => {
      const source = read(ADAPTER_MODULE_PATH);
      expect(source).toMatch(/Phase 77/);
    });

    test("persistence adapter has no Express / DB / filesystem / env access", () => {
      const source = read(ADAPTER_MODULE_PATH);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/require\(["'].*config\/db["']\)/);
      expect(source).not.toMatch(/process\.env/);
      expect(source).not.toMatch(/\bINSERT\s+INTO\b/i);
      expect(source).not.toMatch(/https?:\/\//);
    });

    test("persistence adapter imports only persistence engine", () => {
      const source = read(ADAPTER_MODULE_PATH);
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual(["./recruitmentPersistenceEngine"]);
    });

    test("persistence adapter does not query database or assign recruitment IDs", () => {
      const source = read(ADAPTER_MODULE_PATH);
      expect(source).toMatch(/connected: false/);
      expect(source).toMatch(/executed: false/);
      expect(source).toMatch(/persistenceExecution: false/);
      expect(source).toMatch(/assignsRecruitmentIds: false/);
      expect(source).toMatch(/queriesDatabase: false/);
      expect(source).not.toMatch(/recruitmentMatcher/);
      expect(source).not.toMatch(/processRecruitmentDetection/);
      expect(source).not.toMatch(/mysqlPersistenceRepositoryAdapters/);
    });

    test("compatibility layer integrates persistence adapter additively", () => {
      const source = read(COMPATIBILITY_MODULE_PATH);
      expect(source).toMatch(/recruitmentPersistenceAdapter/);
      expect(source).toMatch(/executePersistenceAdapter/);
      expect(source).toMatch(/persistenceAdapterResultByPipelineOutcome/);
      expect(source).toMatch(/peekRecruitmentPersistenceAdapterResult/);
    });

    test("runRecruitmentPipeline does not import persistence adapter directly", () => {
      const source = read(PIPELINE_MODULE_PATH);
      expect(source).toMatch(/recruitmentCompatibilityLayer/);
      expect(source).not.toMatch(/recruitmentPersistenceAdapter/);
    });

    test("siteWorker does not import persistence adapter directly", () => {
      const worker = read(WORKER_MODULE_PATH);
      expect(worker).not.toMatch(/recruitmentPersistenceAdapter/);
      expect(worker).not.toMatch(/peekRecruitmentPersistenceAdapterResult/);
      expect(worker).toMatch(/recruitmentWorkerObservation/);
      expect(worker).toMatch(/peekRecruitmentActionPlan/);
    });

    test("persistence adapter has no WeakMap — internal storage lives in compatibility layer", () => {
      const source = read(ADAPTER_MODULE_PATH);
      expect(source).not.toMatch(/WeakMap/);
      expect(source).not.toMatch(/recruitmentCompatibilityLayer/);
    });

    test("persistence engine does not import persistence adapter", () => {
      const source = read(ENGINE_MODULE_PATH);
      expect(source).not.toMatch(/recruitmentPersistenceAdapter/);
    });
  });
});
