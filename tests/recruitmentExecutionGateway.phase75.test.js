"use strict";

/**
 * Phase 75 — Recruitment Execution Gateway (Feature-Gated) tests.
 * Exports, all execution decisions, deterministic behavior, validation,
 * immutability, helper behavior, compatibility integration, pipeline output
 * preservation, failure isolation, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  EXECUTION_GATEWAY_PHASE,
  EXECUTION_DECISION_ENTITY,
  EXECUTION_DECISIONS,
  SUPPORTED_EXECUTION_DECISIONS,
  DEFAULT_EXECUTION_DECISION,
  PERSISTENCE_OPERATION_TO_EXECUTION_DECISION,
  DECISION_DESCRIPTOR,
  EXECUTION_DECISION_DESCRIPTOR,
  EXECUTION_DECISION_METADATA,
  VALIDATION_STATUS,
  isExecutionDecision,
  evaluateExecutionEligibility,
  createExecutionDecision,
  validateExecutionDecision,
  summarizeExecutionDecision
} = require("../server/lib/recruitment/recruitmentExecutionGateway");

const {
  PERSISTENCE_COORDINATOR_PHASE,
  PERSISTENCE_PLAN_ENTITY,
  PERSISTENCE_OPERATIONS,
  createPersistencePlan,
  validatePersistencePlan
} = require("../server/lib/recruitment/recruitmentPersistenceCoordinator");

const {
  ACTION_PLANNER_PHASE,
  ACTION_PLAN_ENTITY,
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
  summarizeExecutionDecision: summarizeExecutionFromCompat
} = require("../server/lib/recruitment/recruitmentCompatibilityLayer");

const {
  observeRecruitmentActionPlan,
  OBSERVATION_STATES
} = require("../server/lib/recruitment/recruitmentWorkerObservation");

const { runRecruitmentPipeline } = require("../server/lib/recruitment/runRecruitmentPipeline");
const { PROCESS_RESULT_STATUS } = require("../server/lib/recruitment/detectionProcessor");

const ROOT = path.join(__dirname, "..");
const GATEWAY_MODULE_PATH = "server/lib/recruitment/recruitmentExecutionGateway.js";
const COMPATIBILITY_MODULE_PATH = "server/lib/recruitment/recruitmentCompatibilityLayer.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentPersistenceCoordinator.js";

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

function executionGatewayFailureMock() {
  return {
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
  };
}

describe("Phase 75 — recruitmentExecutionGateway", () => {
  describe("exports", () => {
    test("exposes phase 75 execution gateway constants and descriptor", () => {
      expect(EXECUTION_GATEWAY_PHASE).toBe(75);
      expect(EXECUTION_DECISION_ENTITY).toBe("recruitment_execution_decision");
      expect(EXECUTION_DECISION_DESCRIPTOR.phase).toBe(75);
      expect(EXECUTION_DECISION_METADATA.executionAllowed).toBe(false);
      expect(EXECUTION_DECISION_METADATA.dryRun).toBe(true);
      expect(EXECUTION_DECISION_METADATA.persistenceExecution).toBe(false);
      expect(EXECUTION_DECISION_METADATA.featureGated).toBe(true);
    });

    test("defines all supported execution decisions", () => {
      expect(SUPPORTED_EXECUTION_DECISIONS.size).toBe(4);
      expect(Object.values(EXECUTION_DECISIONS)).toEqual([
        "allowed",
        "blocked",
        "dry_run",
        "manual_review"
      ]);
    });

    test("defines persistence-operation-to-decision mapping", () => {
      expect(
        PERSISTENCE_OPERATION_TO_EXECUTION_DECISION[PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT]
      ).toBe(EXECUTION_DECISIONS.DRY_RUN);
      expect(
        PERSISTENCE_OPERATION_TO_EXECUTION_DECISION[PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT]
      ).toBe(EXECUTION_DECISIONS.DRY_RUN);
      expect(
        PERSISTENCE_OPERATION_TO_EXECUTION_DECISION[PERSISTENCE_OPERATIONS.MANUAL_REVIEW]
      ).toBe(EXECUTION_DECISIONS.MANUAL_REVIEW);
      expect(PERSISTENCE_OPERATION_TO_EXECUTION_DECISION[PERSISTENCE_OPERATIONS.SKIP]).toBe(
        EXECUTION_DECISIONS.BLOCKED
      );
      expect(PERSISTENCE_OPERATION_TO_EXECUTION_DECISION[PERSISTENCE_OPERATIONS.NONE]).toBe(
        EXECUTION_DECISIONS.BLOCKED
      );
    });

    test("exports decision descriptors with execution disabled", () => {
      expect(DECISION_DESCRIPTOR.dry_run.executionAllowed).toBe(false);
      expect(DECISION_DESCRIPTOR.blocked.executionAllowed).toBe(false);
      expect(DECISION_DESCRIPTOR.manual_review.executionAllowed).toBe(false);
      expect(DECISION_DESCRIPTOR.allowed.executionAllowed).toBe(false);
      expect(DECISION_DESCRIPTOR.dry_run.dryRun).toBe(true);
      expect(DECISION_DESCRIPTOR.dry_run.performsPersistence).toBe(false);
    });

    test("exports public API functions", () => {
      expect(typeof isExecutionDecision).toBe("function");
      expect(typeof evaluateExecutionEligibility).toBe("function");
      expect(typeof createExecutionDecision).toBe("function");
      expect(typeof validateExecutionDecision).toBe("function");
      expect(typeof summarizeExecutionDecision).toBe("function");
    });

    test("isExecutionDecision validates supported decisions", () => {
      expect(isExecutionDecision(EXECUTION_DECISIONS.ALLOWED)).toBe(true);
      expect(isExecutionDecision(EXECUTION_DECISIONS.BLOCKED)).toBe(true);
      expect(isExecutionDecision(EXECUTION_DECISIONS.DRY_RUN)).toBe(true);
      expect(isExecutionDecision(EXECUTION_DECISIONS.MANUAL_REVIEW)).toBe(true);
      expect(isExecutionDecision("unknown_decision")).toBe(false);
      expect(isExecutionDecision(null)).toBe(false);
    });

    test("default execution decision is blocked", () => {
      expect(DEFAULT_EXECUTION_DECISION).toBe(EXECUTION_DECISIONS.BLOCKED);
    });
  });

  describe("execution decisions", () => {
    test("create_recruitment persistence maps to dry_run decision", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.NO_MATCH);
      expect(decision.executionDecision).toBe(EXECUTION_DECISIONS.DRY_RUN);
      expect(decision.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT);
      expect(decision.actionType).toBe(ACTION_TYPES.CREATE_NEW_RECRUITMENT);
      expect(decision.executionAllowed).toBe(false);
      expect(decision.dryRun).toBe(true);
    });

    test("attach_recruitment persistence maps to dry_run decision for exact match", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(decision.executionDecision).toBe(EXECUTION_DECISIONS.DRY_RUN);
      expect(decision.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT);
      expect(decision.actionType).toBe(ACTION_TYPES.ATTACH_EXISTING_RECRUITMENT);
    });

    test("attach_recruitment persistence maps to dry_run for strong match", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.STRONG_MATCH);
      expect(decision.executionDecision).toBe(EXECUTION_DECISIONS.DRY_RUN);
      expect(decision.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT);
    });

    test("manual_review persistence maps to manual_review decision", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.MANUAL_REVIEW);
      expect(decision.executionDecision).toBe(EXECUTION_DECISIONS.MANUAL_REVIEW);
      expect(decision.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.MANUAL_REVIEW);
      expect(decision.actionType).toBe(ACTION_TYPES.MANUAL_REVIEW);
    });

    test("skip persistence operation maps to blocked decision", () => {
      const actionPlan = createRecruitmentActionPlan(matchingForCategory(MATCH_CATEGORIES.WEAK_MATCH));
      const tampered = { ...actionPlan, actionType: "unmapped_action_type" };
      const plan = createPersistencePlan(tampered);
      expect(plan.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.SKIP);
      const decision = createExecutionDecision(plan);
      expect(decision.executionDecision).toBe(EXECUTION_DECISIONS.BLOCKED);
    });

    test("none persistence operation maps to blocked decision", () => {
      const actionPlan = createRecruitmentActionPlan({ invalid: true });
      const plan = createPersistencePlan(actionPlan);
      expect(plan.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.NONE);
      const decision = createExecutionDecision(plan);
      expect(decision.executionDecision).toBe(EXECUTION_DECISIONS.BLOCKED);
    });

    test("probable match yields manual_review via manual_review persistence", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.PROBABLE_MATCH);
      expect(decision.executionDecision).toBe(EXECUTION_DECISIONS.MANUAL_REVIEW);
      expect(decision.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.MANUAL_REVIEW);
    });

    test("weak match yields manual_review via manual_review persistence", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.WEAK_MATCH);
      expect(decision.executionDecision).toBe(EXECUTION_DECISIONS.MANUAL_REVIEW);
      expect(decision.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.MANUAL_REVIEW);
    });

    test("all valid decisions keep executionAllowed false", () => {
      const categories = Object.values(MATCH_CATEGORIES);
      for (let i = 0; i < categories.length; i += 1) {
        const decision = executionDecisionForCategory(categories[i]);
        expect(decision.executionAllowed).toBe(false);
      }
    });

    test("all valid decisions keep dryRun true", () => {
      const categories = Object.values(MATCH_CATEGORIES);
      for (let i = 0; i < categories.length; i += 1) {
        const decision = executionDecisionForCategory(categories[i]);
        expect(decision.dryRun).toBe(true);
      }
    });

    test("all valid decisions keep performsPersistence false", () => {
      const categories = Object.values(MATCH_CATEGORIES);
      for (let i = 0; i < categories.length; i += 1) {
        const decision = executionDecisionForCategory(categories[i]);
        expect(decision.performsPersistence).toBe(false);
        expect(decision.persistenceExecution).toBe(false);
      }
    });
  });

  describe("deterministic behavior", () => {
    test("evaluateExecutionEligibility is deterministic for same input", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const first = evaluateExecutionEligibility(plan);
      const second = evaluateExecutionEligibility(plan);
      expect(first).toBe(second);
      expect(first).toBe(EXECUTION_DECISIONS.DRY_RUN);
    });

    test("createExecutionDecision is deterministic for same input", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.NO_MATCH);
      const first = createExecutionDecision(plan);
      const second = createExecutionDecision(plan);
      expect(first.executionDecision).toBe(second.executionDecision);
      expect(first.persistenceOperation).toBe(second.persistenceOperation);
      expect(first.eligibilityRationale).toBe(second.eligibilityRationale);
    });

    test("evaluateExecutionEligibility returns blocked for null input", () => {
      expect(evaluateExecutionEligibility(null)).toBe(EXECUTION_DECISIONS.BLOCKED);
      expect(evaluateExecutionEligibility(undefined)).toBe(EXECUTION_DECISIONS.BLOCKED);
    });

    test("evaluateExecutionEligibility returns blocked for non-object input", () => {
      expect(evaluateExecutionEligibility("string")).toBe(EXECUTION_DECISIONS.BLOCKED);
      expect(evaluateExecutionEligibility(42)).toBe(EXECUTION_DECISIONS.BLOCKED);
    });

    test("evaluateExecutionEligibility returns blocked for missing operation", () => {
      expect(evaluateExecutionEligibility({ phase: 74 })).toBe(EXECUTION_DECISIONS.BLOCKED);
    });

    test("evaluateExecutionEligibility returns blocked for unknown operation", () => {
      expect(
        evaluateExecutionEligibility({ persistenceOperation: "unknown_operation" })
      ).toBe(EXECUTION_DECISIONS.BLOCKED);
    });

    test("evaluate matches createExecutionDecision decision field", () => {
      const categories = Object.values(MATCH_CATEGORIES);
      for (let i = 0; i < categories.length; i += 1) {
        const plan = persistencePlanForCategory(categories[i]);
        const decision = createExecutionDecision(plan);
        expect(evaluateExecutionEligibility(plan)).toBe(decision.executionDecision);
      }
    });

    test("evaluateExecutionEligibility never throws", () => {
      expect(() => evaluateExecutionEligibility(Symbol("x"))).not.toThrow();
      expect(() => evaluateExecutionEligibility(() => {})).not.toThrow();
    });

    test("createExecutionDecision never throws", () => {
      expect(() => createExecutionDecision(Symbol("x"))).not.toThrow();
      expect(() => createExecutionDecision(() => {})).not.toThrow();
    });
  });

  describe("validation", () => {
    test("valid execution decision passes validation", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const validation = validateExecutionDecision(decision);
      expect(validation.valid).toBe(true);
      expect(validation.status).toBe(VALIDATION_STATUS.VALID);
      expect(validation.reasons).toEqual([]);
    });

    test("invalid shape fails validation", () => {
      const validation = validateExecutionDecision(null);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_DECISION_SHAPE");
    });

    test("wrong phase fails validation", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...decision, phase: 74 };
      const validation = validateExecutionDecision(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_PHASE");
    });

    test("wrong entity fails validation", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...decision, entity: "wrong_entity" };
      const validation = validateExecutionDecision(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_ENTITY");
    });

    test("executionAllowed true fails validation", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...decision, executionAllowed: true };
      const validation = validateExecutionDecision(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("EXECUTION_ALLOWED_MUST_BE_FALSE");
    });

    test("dryRun false fails validation", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...decision, dryRun: false };
      const validation = validateExecutionDecision(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("DRY_RUN_MUST_BE_TRUE");
    });

    test("featureGated false fails validation", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...decision, featureGated: false };
      const validation = validateExecutionDecision(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("FEATURE_GATED_MUST_BE_TRUE");
    });

    test("persistenceExecution true fails validation", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...decision, persistenceExecution: true };
      const validation = validateExecutionDecision(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("EXECUTION_FLAGS_MUST_BE_FALSE");
    });

    test("inconsistent decision and operation fails validation", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = {
        ...decision,
        executionDecision: EXECUTION_DECISIONS.BLOCKED
      };
      const validation = validateExecutionDecision(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("DECISION_INCONSISTENT_WITH_PERSISTENCE_OPERATION");
    });

    test("dry_run with wrong operation fails validation", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = {
        ...decision,
        executionDecision: EXECUTION_DECISIONS.DRY_RUN,
        persistenceOperation: PERSISTENCE_OPERATIONS.MANUAL_REVIEW
      };
      const validation = validateExecutionDecision(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("DRY_RUN_OPERATION_MISMATCH");
    });

    test("manual_review with wrong operation fails validation", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.MANUAL_REVIEW);
      const tampered = {
        ...decision,
        persistenceOperation: PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT
      };
      const validation = validateExecutionDecision(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("MANUAL_REVIEW_OPERATION_MISMATCH");
    });

    test("blocked with wrong operation fails validation", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.NO_MATCH);
      const tampered = {
        ...decision,
        executionDecision: EXECUTION_DECISIONS.BLOCKED,
        persistenceOperation: PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT
      };
      const validation = validateExecutionDecision(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("BLOCKED_OPERATION_MISMATCH");
    });

    test("missing eligibility rationale fails validation", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...decision, eligibilityRationale: "" };
      const validation = validateExecutionDecision(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("MISSING_ELIGIBILITY_RATIONALE");
    });

    test("invalid persistence coordinator phase fails validation", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...decision, persistenceCoordinatorPhase: 72 };
      const validation = validateExecutionDecision(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_PERSISTENCE_COORDINATOR_PHASE");
    });

    test("validateExecutionDecision never throws", () => {
      expect(() => validateExecutionDecision(Symbol("x"))).not.toThrow();
    });
  });

  describe("immutability", () => {
    test("createExecutionDecision returns deeply frozen object", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      assertAllFrozen(decision);
    });

    test("createExecutionDecision metadata is frozen", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.NO_MATCH);
      expect(Object.isFrozen(decision.metadata)).toBe(true);
    });

    test("createExecutionDecision planValidation is frozen", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.STRONG_MATCH);
      expect(Object.isFrozen(decision.planValidation)).toBe(true);
      expect(Object.isFrozen(decision.planValidation.reasons)).toBe(true);
    });

    test("operation decision mapping reference is frozen", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.PROBABLE_MATCH);
      expect(decision.operationDecisionMapping).toBe(
        PERSISTENCE_OPERATION_TO_EXECUTION_DECISION
      );
      expect(Object.isFrozen(decision.operationDecisionMapping)).toBe(true);
    });

    test("decision has no circular references", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(hasCircularReference(decision)).toBe(false);
    });

    test("summarizeExecutionDecision returns frozen summary", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const summary = summarizeExecutionDecision(decision);
      expect(Object.isFrozen(summary)).toBe(true);
    });

    test("invalid decision summary is frozen", () => {
      const summary = summarizeExecutionDecision(null);
      expect(Object.isFrozen(summary)).toBe(true);
      expect(summary.valid).toBe(false);
    });
  });

  describe("helper behavior", () => {
    test("records persistence coordinator phase in metadata", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(decision.metadata.persistenceCoordinatorPhase).toBe(PERSISTENCE_COORDINATOR_PHASE);
      expect(decision.persistenceCoordinatorPhase).toBe(PERSISTENCE_COORDINATOR_PHASE);
    });

    test("records persistence plan entity reference", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.NO_MATCH);
      expect(decision.persistencePlanEntity).toBe(PERSISTENCE_PLAN_ENTITY);
    });

    test("decision label matches descriptor for mapped decision", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.NO_MATCH);
      expect(decision.decisionLabel).toBe(
        DECISION_DESCRIPTOR[decision.executionDecision].label
      );
    });

    test("eligibility rationale includes persistence operation", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(decision.eligibilityRationale).toContain("attach_recruitment");
    });

    test("matching profile catalog remains accessible for cross-phase alignment", () => {
      expect(MATCHING_PROFILE_BY_ID.official_identifier_exact.category).toBe(
        MATCH_CATEGORIES.EXACT_MATCH
      );
      expect(MATCHING_PROFILE_BY_ID.no_shared_identity_signals.category).toBe(
        MATCH_CATEGORIES.NO_MATCH
      );
    });

    test("anchor event short notification produces manual_review execution decision", () => {
      const identity = identityFromSignals(
        { recruitment_title: "SSC short notice" },
        { noticeContent: "Short notification regarding examination schedule" }
      );
      expect(identity.anchorEventId).toBe(ANCHOR_EVENT_IDS.SHORT_NOTIFICATION);
      const plan = createPersistencePlan(
        createRecruitmentActionPlan(createMatchingResult(identity))
      );
      const decision = createExecutionDecision(plan);
      expect(decision.executionDecision).toBe(EXECUTION_DECISIONS.MANUAL_REVIEW);
    });

    test("high confidence identity flows through to execution decision profile", () => {
      const identity = identityFromSignals({
        recruitment_title: "SSC CGL 2026",
        organization: "Staff Selection Commission",
        official_identifier: "update:42",
        source_url: "https://ssc.nic.in"
      });
      const matching = createMatchingResult(identity);
      const decision = createExecutionDecision(
        createPersistencePlan(createRecruitmentActionPlan(matching))
      );
      expect(matching.metadata.identityConfidenceLevel).toBe(CONFIDENCE_LEVELS.HIGH);
      expect(decision.profileId).toBe(matching.profileId);
    });

    test("decision validation embeds persistence plan validation result", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.STRONG_MATCH);
      expect(decision.planValidation.valid).toBe(true);
      expect(Array.isArray(decision.planValidation.reasons)).toBe(true);
    });

    test("createExecutionDecision sets createReason from persistence plan validity", () => {
      const validDecision = executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(validDecision.metadata.createReason).toBe("persistence_plan");
      const invalidDecision = createExecutionDecision({ garbage: true });
      expect(invalidDecision.metadata.createReason).toBe("invalid_persistence_plan");
    });

    test("summarizeExecutionDecision never throws", () => {
      expect(() => summarizeExecutionDecision(null)).not.toThrow();
      expect(() => summarizeExecutionDecision(undefined)).not.toThrow();
    });

    test("summarizeExecutionDecision for valid decision includes key fields", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const summary = summarizeExecutionDecision(decision);
      expect(summary.valid).toBe(true);
      expect(summary.executionDecision).toBe(EXECUTION_DECISIONS.DRY_RUN);
      expect(summary.executionAllowed).toBe(false);
      expect(summary.dryRun).toBe(true);
    });

    test("records action planner phase via persistence plan summary", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(decision.metadata.actionPlanValid).toBe(true);
      expect(decision.persistencePlanSummary.valid).toBe(true);
    });

    test("records action plan entity via persistence plan chain", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.NO_MATCH);
      expect(decision.actionType).toBe(ACTION_TYPES.CREATE_NEW_RECRUITMENT);
      expect(decision.persistencePlanEntity).toBe(PERSISTENCE_PLAN_ENTITY);
    });

    test("blocked decision descriptor documents feature-gated block path", () => {
      expect(DECISION_DESCRIPTOR.blocked.dryRun).toBe(true);
      expect(DECISION_DESCRIPTOR.blocked.label).toBe("Blocked");
    });
  });

  describe("compatibility integration", () => {
    test("attachRecruitmentCompatibility stores execution decision internally", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 75 };
      attachRecruitmentCompatibility(outcome, {
        notice: sampleNotice(),
        updateId: 75
      });
      const executionDecision = peekRecruitmentExecutionDecision(outcome);
      expect(executionDecision).not.toBeNull();
      expect(executionDecision.phase).toBe(75);
      expect(validateExecutionDecision(executionDecision).valid).toBe(true);
    });

    test("execution decision is not a public field on pipeline outcome", () => {
      const outcome = { skipped: false, updateId: 76 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 76 });
      expect(Object.prototype.hasOwnProperty.call(outcome, "executionDecision")).toBe(false);
      expect(
        Object.prototype.hasOwnProperty.call(outcome, "recruitmentExecutionDecision")
      ).toBe(false);
    });

    test("peekRecruitmentExecutionDecision returns null for unrelated objects", () => {
      expect(peekRecruitmentExecutionDecision(null)).toBeNull();
      expect(peekRecruitmentExecutionDecision({})).toBeNull();
    });

    test("execution decision aligns with persistence plan for same outcome", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 77 };
      attachRecruitmentCompatibility(outcome, {
        notice: {
          title: "SSC CGL 2026",
          content: "Staff Selection Commission Advt. No. CGL-01/2026",
          url: "https://ssc.nic.in"
        },
        updateId: 77
      });
      const persistencePlan = peekRecruitmentPersistencePlan(outcome);
      const executionDecision = peekRecruitmentExecutionDecision(outcome);
      expect(validatePersistencePlan(persistencePlan).valid).toBe(true);
      expect(executionDecision.executionDecision).toBe(
        evaluateExecutionEligibility(persistencePlan)
      );
      expect(executionDecision.persistenceOperation).toBe(persistencePlan.persistenceOperation);
    });

    test("persistence plan and execution decision coexist in separate WeakMaps", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 78 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 78 });
      expect(peekRecruitmentPersistencePlan(outcome)).not.toBeNull();
      expect(peekRecruitmentExecutionDecision(outcome)).not.toBeNull();
      expect(peekRecruitmentPersistencePlan(outcome)).not.toBe(
        peekRecruitmentExecutionDecision(outcome)
      );
    });

    test("full chain attaches compatibility through execution decision", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 79 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 79 });
      expect(peekRecruitmentCompatibility(outcome)).not.toBeNull();
      expect(peekRecruitmentIdentityResolution(outcome)).not.toBeNull();
      expect(peekRecruitmentMatchingResult(outcome)).not.toBeNull();
      expect(peekRecruitmentActionPlan(outcome)).not.toBeNull();
      expect(peekRecruitmentPersistencePlan(outcome)).not.toBeNull();
      expect(peekRecruitmentExecutionDecision(outcome)).not.toBeNull();
    });

    test("compatibility attach still succeeds when execution gateway input is sparse", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: null };
      const attached = attachRecruitmentCompatibility(outcome, {});
      expect(attached).not.toBeNull();
      const executionDecision = peekRecruitmentExecutionDecision(outcome);
      expect(executionDecision).not.toBeNull();
      expect(executionDecision.executionDecision).toBe(EXECUTION_DECISIONS.MANUAL_REVIEW);
    });

    test("compatibility layer re-exports summarizeExecutionDecision", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(summarizeExecutionFromCompat(decision)).toEqual(
        summarizeExecutionDecision(decision)
      );
    });
  });

  describe("compatibility failure isolation", () => {
    test("attachRecruitmentCompatibility never throws when execution gateway fails", () => {
      jest.resetModules();
      jest.doMock("../server/lib/recruitment/recruitmentExecutionGateway", () =>
        executionGatewayFailureMock()
      );

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
      expect(compat.peekRecruitmentExecutionDecision(outcome)).toBeNull();

      jest.dontMock("../server/lib/recruitment/recruitmentExecutionGateway");
      jest.resetModules();
    });

    test("execution gateway failure does not remove persistence plan", () => {
      jest.resetModules();
      jest.doMock("../server/lib/recruitment/recruitmentExecutionGateway", () =>
        executionGatewayFailureMock()
      );

      const compat = require("../server/lib/recruitment/recruitmentCompatibilityLayer");
      const outcome = { skipped: true, reason: "flag_off", updateId: 3 };

      compat.attachRecruitmentCompatibility(outcome, {
        notice: sampleNotice(),
        updateId: 3
      });

      expect(compat.peekRecruitmentPersistencePlan(outcome)).not.toBeNull();
      expect(compat.peekRecruitmentExecutionDecision(outcome)).toBeNull();

      jest.dontMock("../server/lib/recruitment/recruitmentExecutionGateway");
      jest.resetModules();
    });

    test("persistence coordinator failure leaves execution decision absent without breaking attach", () => {
      jest.resetModules();
      jest.doMock("../server/lib/recruitment/recruitmentPersistenceCoordinator", () => ({
        PERSISTENCE_COORDINATOR_PHASE: 74,
        PERSISTENCE_PLAN_ENTITY: "recruitment_persistence_plan",
        PERSISTENCE_OPERATIONS: {
          CREATE_RECRUITMENT: "create_recruitment",
          ATTACH_RECRUITMENT: "attach_recruitment",
          MANUAL_REVIEW: "manual_review",
          SKIP: "skip",
          NONE: "none"
        },
        DEFAULT_PERSISTENCE_OPERATION: "none",
        validatePersistencePlan: () => ({ valid: false, status: "invalid", reasons: [] }),
        summarizePersistencePlan: () => ({ valid: false }),
        createPersistencePlan: () => {
          throw new Error("persistence coordinator failure");
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

      expect(compat.peekRecruitmentPersistencePlan(outcome)).toBeNull();
      expect(compat.peekRecruitmentExecutionDecision(outcome)).toBeNull();

      jest.dontMock("../server/lib/recruitment/recruitmentPersistenceCoordinator");
      jest.resetModules();
    });
  });

  describe("worker observation compatibility", () => {
    test("worker observation path coexists with execution decision", () => {
      const outcome = runRecruitmentPipeline({
        notice: sampleNotice(),
        candidateRecruitments: [],
        isEnabled: true,
        updateId: 7501
      });
      const actionPlan = peekRecruitmentActionPlan(outcome);
      const executionDecision = peekRecruitmentExecutionDecision(outcome);
      const observation = observeRecruitmentActionPlan(actionPlan);
      expect(observation.observationState).not.toBe(OBSERVATION_STATES.NOT_AVAILABLE);
      expect(executionDecision).not.toBeNull();
      expect(executionDecision.actionType).toBe(actionPlan.actionType);
    });

    test("deferred observation aligns with dry_run execution for create_recruitment", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.NO_MATCH);
      const observation = observeRecruitmentActionPlan(
        actionPlanForCategory(MATCH_CATEGORIES.NO_MATCH)
      );
      expect(observation.observationState).toBe(OBSERVATION_STATES.DEFERRED);
      expect(decision.executionDecision).toBe(EXECUTION_DECISIONS.DRY_RUN);
      expect(decision.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT);
    });

    test("planned observation aligns with dry_run execution for attach_recruitment", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const observation = observeRecruitmentActionPlan(
        actionPlanForCategory(MATCH_CATEGORIES.EXACT_MATCH)
      );
      expect(observation.observationState).toBe(OBSERVATION_STATES.PLANNED);
      expect(decision.executionDecision).toBe(EXECUTION_DECISIONS.DRY_RUN);
      expect(decision.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT);
    });

    test("manual_review observation aligns with manual_review execution", () => {
      const decision = executionDecisionForCategory(MATCH_CATEGORIES.MANUAL_REVIEW);
      const observation = observeRecruitmentActionPlan(
        actionPlanForCategory(MATCH_CATEGORIES.MANUAL_REVIEW)
      );
      expect(observation.observationState).toBe(OBSERVATION_STATES.MANUAL_REVIEW);
      expect(decision.executionDecision).toBe(EXECUTION_DECISIONS.MANUAL_REVIEW);
    });

    test("ignored observation aligns with blocked execution for invalid input", () => {
      const actionPlan = createRecruitmentActionPlan({ invalid: true });
      const plan = createPersistencePlan(actionPlan);
      const decision = createExecutionDecision(plan);
      const observation = observeRecruitmentActionPlan(actionPlan);
      expect(observation.observationState).toBe(OBSERVATION_STATES.IGNORED);
      expect(decision.executionDecision).toBe(EXECUTION_DECISIONS.BLOCKED);
    });

    test("observation does not require execution decision peek", () => {
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

    test("pipeline attaches execution decision without changing public return fields", () => {
      const result = runRecruitmentPipeline({
        notice,
        isEnabled: false,
        updateId: 88
      });
      const executionDecision = peekRecruitmentExecutionDecision(result);
      expect(executionDecision).not.toBeNull();
      expect(validateExecutionDecision(executionDecision).valid).toBe(true);
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

    test("pipeline outcome keys unchanged after execution decision attach", () => {
      const outcome = runRecruitmentPipeline({
        notice,
        candidateRecruitments: [],
        isEnabled: true,
        updateId: 7502
      });
      const keysBefore = Object.keys(outcome).sort();
      peekRecruitmentExecutionDecision(outcome);
      expect(Object.keys(outcome).sort()).toEqual(keysBefore);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("execution gateway documents Phase 75", () => {
      const source = read(GATEWAY_MODULE_PATH);
      expect(source).toMatch(/Phase 75/);
    });

    test("execution gateway has no Express / DB / filesystem / env access", () => {
      const source = read(GATEWAY_MODULE_PATH);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/require\(["'].*config\/db["']\)/);
      expect(source).not.toMatch(/process\.env/);
      expect(source).not.toMatch(/\bINSERT\s+INTO\b/i);
      expect(source).not.toMatch(/https?:\/\//);
    });

    test("execution gateway imports only persistence coordinator", () => {
      const source = read(GATEWAY_MODULE_PATH);
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual(["./recruitmentPersistenceCoordinator"]);
    });

    test("execution gateway does not query database or assign recruitment IDs", () => {
      const source = read(GATEWAY_MODULE_PATH);
      expect(source).toMatch(/executionAllowed: false/);
      expect(source).toMatch(/dryRun: true/);
      expect(source).toMatch(/persistenceExecution: false/);
      expect(source).toMatch(/assignsRecruitmentIds: false/);
      expect(source).toMatch(/queriesDatabase: false/);
      expect(source).not.toMatch(/recruitmentMatcher/);
      expect(source).not.toMatch(/processRecruitmentDetection/);
      expect(source).not.toMatch(/mysqlPersistenceRepositoryAdapters/);
    });

    test("compatibility layer integrates execution gateway additively", () => {
      const source = read(COMPATIBILITY_MODULE_PATH);
      expect(source).toMatch(/recruitmentExecutionGateway/);
      expect(source).toMatch(/createExecutionDecision/);
      expect(source).toMatch(/executionDecisionByPipelineOutcome/);
      expect(source).toMatch(/peekRecruitmentExecutionDecision/);
    });

    test("runRecruitmentPipeline does not import execution gateway directly", () => {
      const source = read(PIPELINE_MODULE_PATH);
      expect(source).toMatch(/recruitmentCompatibilityLayer/);
      expect(source).not.toMatch(/recruitmentExecutionGateway/);
    });

    test("siteWorker does not import execution gateway directly", () => {
      const worker = read(WORKER_MODULE_PATH);
      expect(worker).not.toMatch(/recruitmentExecutionGateway/);
      expect(worker).not.toMatch(/peekRecruitmentExecutionDecision/);
      expect(worker).toMatch(/recruitmentWorkerObservation/);
      expect(worker).toMatch(/peekRecruitmentActionPlan/);
    });

    test("execution gateway has no WeakMap — internal storage lives in compatibility layer", () => {
      const source = read(GATEWAY_MODULE_PATH);
      expect(source).not.toMatch(/WeakMap/);
      expect(source).not.toMatch(/recruitmentCompatibilityLayer/);
    });

    test("persistence coordinator does not import execution gateway", () => {
      const source = read(COORDINATOR_MODULE_PATH);
      expect(source).not.toMatch(/recruitmentExecutionGateway/);
    });
  });
});
