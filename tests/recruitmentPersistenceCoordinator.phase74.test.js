"use strict";

/**
 * Phase 74 — Recruitment Persistence Coordinator (Dry-Run Mode) tests.
 * Exports, all persistence operations, deterministic behavior, validation,
 * immutability, helper behavior, compatibility integration, worker observation
 * compatibility, pipeline output preservation, failure isolation, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  PERSISTENCE_COORDINATOR_PHASE,
  PERSISTENCE_PLAN_ENTITY,
  PERSISTENCE_OPERATIONS,
  SUPPORTED_PERSISTENCE_OPERATIONS,
  DEFAULT_PERSISTENCE_OPERATION,
  ACTION_TYPE_TO_PERSISTENCE_OPERATION,
  OPERATION_DESCRIPTOR,
  PERSISTENCE_PLAN_DESCRIPTOR,
  PERSISTENCE_PLAN_METADATA,
  VALIDATION_STATUS,
  isPersistenceOperation,
  planRecruitmentPersistence,
  createPersistencePlan,
  validatePersistencePlan,
  summarizePersistencePlan
} = require("../server/lib/recruitment/recruitmentPersistenceCoordinator");

const {
  ACTION_PLANNER_PHASE,
  ACTION_PLAN_ENTITY,
  ACTION_TYPES,
  createRecruitmentActionPlan,
  validateRecruitmentActionPlan
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
  summarizePersistencePlan: summarizePersistenceFromCompat
} = require("../server/lib/recruitment/recruitmentCompatibilityLayer");

const {
  observeRecruitmentActionPlan,
  OBSERVATION_STATES
} = require("../server/lib/recruitment/recruitmentWorkerObservation");

const { runRecruitmentPipeline } = require("../server/lib/recruitment/runRecruitmentPipeline");
const { PROCESS_RESULT_STATUS } = require("../server/lib/recruitment/detectionProcessor");

const ROOT = path.join(__dirname, "..");
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentPersistenceCoordinator.js";
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

describe("Phase 74 — recruitmentPersistenceCoordinator", () => {
  describe("exports", () => {
    test("exposes phase 74 persistence coordinator constants and descriptor", () => {
      expect(PERSISTENCE_COORDINATOR_PHASE).toBe(74);
      expect(PERSISTENCE_PLAN_ENTITY).toBe("recruitment_persistence_plan");
      expect(PERSISTENCE_PLAN_DESCRIPTOR.phase).toBe(74);
      expect(PERSISTENCE_PLAN_METADATA.dryRunOnly).toBe(true);
      expect(PERSISTENCE_PLAN_METADATA.persistenceEnabled).toBe(false);
      expect(PERSISTENCE_PLAN_METADATA.performsPersistence).toBe(false);
      expect(PERSISTENCE_PLAN_METADATA.assignsRecruitmentIds).toBe(false);
      expect(PERSISTENCE_PLAN_METADATA.queriesDatabase).toBe(false);
    });

    test("defines all supported persistence operations", () => {
      expect(SUPPORTED_PERSISTENCE_OPERATIONS.size).toBe(5);
      expect(Object.values(PERSISTENCE_OPERATIONS)).toEqual([
        "create_recruitment",
        "attach_recruitment",
        "manual_review",
        "skip",
        "none"
      ]);
    });

    test("defines action-to-operation mapping for all action types", () => {
      expect(ACTION_TYPE_TO_PERSISTENCE_OPERATION[ACTION_TYPES.ATTACH_EXISTING_RECRUITMENT]).toBe(
        PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT
      );
      expect(ACTION_TYPE_TO_PERSISTENCE_OPERATION[ACTION_TYPES.CREATE_NEW_RECRUITMENT]).toBe(
        PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT
      );
      expect(ACTION_TYPE_TO_PERSISTENCE_OPERATION[ACTION_TYPES.MANUAL_REVIEW]).toBe(
        PERSISTENCE_OPERATIONS.MANUAL_REVIEW
      );
      expect(ACTION_TYPE_TO_PERSISTENCE_OPERATION[ACTION_TYPES.IGNORE]).toBe(
        PERSISTENCE_OPERATIONS.NONE
      );
    });

    test("exports operation descriptors with persistence disabled", () => {
      expect(OPERATION_DESCRIPTOR.create_recruitment.performsPersistence).toBe(false);
      expect(OPERATION_DESCRIPTOR.attach_recruitment.performsPersistence).toBe(false);
      expect(OPERATION_DESCRIPTOR.manual_review.performsPersistence).toBe(false);
      expect(OPERATION_DESCRIPTOR.skip.performsPersistence).toBe(false);
      expect(OPERATION_DESCRIPTOR.none.performsPersistence).toBe(false);
      expect(OPERATION_DESCRIPTOR.create_recruitment.dryRunOnly).toBe(true);
    });

    test("exports public API functions", () => {
      expect(typeof isPersistenceOperation).toBe("function");
      expect(typeof planRecruitmentPersistence).toBe("function");
      expect(typeof createPersistencePlan).toBe("function");
      expect(typeof validatePersistencePlan).toBe("function");
      expect(typeof summarizePersistencePlan).toBe("function");
    });

    test("isPersistenceOperation validates supported operations", () => {
      expect(isPersistenceOperation(PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT)).toBe(true);
      expect(isPersistenceOperation(PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT)).toBe(true);
      expect(isPersistenceOperation(PERSISTENCE_OPERATIONS.MANUAL_REVIEW)).toBe(true);
      expect(isPersistenceOperation(PERSISTENCE_OPERATIONS.SKIP)).toBe(true);
      expect(isPersistenceOperation(PERSISTENCE_OPERATIONS.NONE)).toBe(true);
      expect(isPersistenceOperation("unknown_operation")).toBe(false);
      expect(isPersistenceOperation(null)).toBe(false);
    });

    test("default persistence operation is none", () => {
      expect(DEFAULT_PERSISTENCE_OPERATION).toBe(PERSISTENCE_OPERATIONS.NONE);
    });
  });

  describe("persistence operations", () => {
    test("attach_recruitment maps from attach_existing_recruitment action", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(plan.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT);
      expect(plan.actionType).toBe(ACTION_TYPES.ATTACH_EXISTING_RECRUITMENT);
      expect(plan.performsPersistence).toBe(false);
    });

    test("attach_recruitment for strong match category", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.STRONG_MATCH);
      expect(plan.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT);
    });

    test("create_recruitment maps from create_new_recruitment action", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.NO_MATCH);
      expect(plan.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT);
      expect(plan.actionType).toBe(ACTION_TYPES.CREATE_NEW_RECRUITMENT);
      expect(plan.dryRunOnly).toBe(true);
    });

    test("manual_review maps from manual_review action for probable match", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.PROBABLE_MATCH);
      expect(plan.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.MANUAL_REVIEW);
      expect(plan.actionType).toBe(ACTION_TYPES.MANUAL_REVIEW);
    });

    test("manual_review maps from manual_review action for weak match", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.WEAK_MATCH);
      expect(plan.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.MANUAL_REVIEW);
    });

    test("manual_review maps from manual_review category", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.MANUAL_REVIEW);
      expect(plan.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.MANUAL_REVIEW);
      expect(plan.recommendsManualReview).toBe(true);
    });

    test("none maps from ignore action for invalid matching input", () => {
      const actionPlan = createRecruitmentActionPlan({ invalid: true });
      expect(actionPlan.actionType).toBe(ACTION_TYPES.IGNORE);
      const plan = createPersistencePlan(actionPlan);
      expect(plan.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.NONE);
    });

    test("skip maps from unmapped action type on invalid plan", () => {
      const tampered = {
        ...actionPlanForCategory(MATCH_CATEGORIES.EXACT_MATCH),
        actionType: "unmapped_action_type"
      };
      expect(planRecruitmentPersistence(tampered)).toBe(PERSISTENCE_OPERATIONS.SKIP);
    });

    test("all operations remain dry-run only", () => {
      const categories = Object.values(MATCH_CATEGORIES);
      for (let i = 0; i < categories.length; i += 1) {
        const plan = persistencePlanForCategory(categories[i]);
        expect(plan.dryRunOnly).toBe(true);
        expect(plan.performsPersistence).toBe(false);
        expect(plan.persistenceEnabled).toBe(false);
      }
    });
  });

  describe("deterministic behavior", () => {
    test("planRecruitmentPersistence is deterministic for same action plan", () => {
      const actionPlan = actionPlanForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const first = planRecruitmentPersistence(actionPlan);
      const second = planRecruitmentPersistence(actionPlan);
      expect(first).toBe(second);
      expect(first).toBe(PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT);
    });

    test("createPersistencePlan is deterministic for same action plan", () => {
      const actionPlan = actionPlanForCategory(MATCH_CATEGORIES.NO_MATCH);
      const first = createPersistencePlan(actionPlan);
      const second = createPersistencePlan(actionPlan);
      expect(first.persistenceOperation).toBe(second.persistenceOperation);
      expect(first.actionType).toBe(second.actionType);
      expect(first.planningRationale).toBe(second.planningRationale);
    });

    test("each match category produces stable persistence operation", () => {
      const expected = {
        [MATCH_CATEGORIES.EXACT_MATCH]: PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT,
        [MATCH_CATEGORIES.STRONG_MATCH]: PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT,
        [MATCH_CATEGORIES.PROBABLE_MATCH]: PERSISTENCE_OPERATIONS.MANUAL_REVIEW,
        [MATCH_CATEGORIES.WEAK_MATCH]: PERSISTENCE_OPERATIONS.MANUAL_REVIEW,
        [MATCH_CATEGORIES.MANUAL_REVIEW]: PERSISTENCE_OPERATIONS.MANUAL_REVIEW,
        [MATCH_CATEGORIES.NO_MATCH]: PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT
      };
      const categories = Object.keys(expected);
      for (let i = 0; i < categories.length; i += 1) {
        const category = categories[i];
        const actionPlan = actionPlanForCategory(category);
        expect(planRecruitmentPersistence(actionPlan)).toBe(expected[category]);
      }
    });

    test("null action plan always maps to none", () => {
      expect(planRecruitmentPersistence(null)).toBe(PERSISTENCE_OPERATIONS.NONE);
      expect(planRecruitmentPersistence(undefined)).toBe(PERSISTENCE_OPERATIONS.NONE);
    });

    test("ignore action type always maps to none regardless of validation", () => {
      const ignorePlan = createRecruitmentActionPlan({ invalid: true });
      expect(ignorePlan.actionType).toBe(ACTION_TYPES.IGNORE);
      expect(planRecruitmentPersistence(ignorePlan)).toBe(PERSISTENCE_OPERATIONS.NONE);
    });

    test("planning rationale includes action type", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(plan.planningRationale).toMatch(/action_type=attach_existing_recruitment/);
    });
  });

  describe("validation", () => {
    test("valid persistence plan passes validation", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const validation = validatePersistencePlan(plan);
      expect(validation.valid).toBe(true);
      expect(validation.status).toBe(VALIDATION_STATUS.VALID);
      expect(validation.reasons).toEqual([]);
    });

    test("invalid plan shape fails validation", () => {
      const validation = validatePersistencePlan(null);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_PLAN_SHAPE");
    });

    test("wrong phase fails validation", () => {
      const plan = { ...persistencePlanForCategory(MATCH_CATEGORIES.NO_MATCH), phase: 1 };
      const validation = validatePersistencePlan(plan);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_PHASE");
    });

    test("wrong entity fails validation", () => {
      const plan = {
        ...persistencePlanForCategory(MATCH_CATEGORIES.NO_MATCH),
        entity: "wrong_entity"
      };
      const validation = validatePersistencePlan(plan);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_ENTITY");
    });

    test("invalid persistence operation fails validation", () => {
      const plan = {
        ...persistencePlanForCategory(MATCH_CATEGORIES.NO_MATCH),
        persistenceOperation: "bogus"
      };
      const validation = validatePersistencePlan(plan);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_PERSISTENCE_OPERATION");
    });

    test("dryRunOnly must be true", () => {
      const plan = { ...persistencePlanForCategory(MATCH_CATEGORIES.NO_MATCH), dryRunOnly: false };
      const validation = validatePersistencePlan(plan);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("DRY_RUN_ONLY_MUST_BE_TRUE");
    });

    test("execution flags must be false", () => {
      const plan = {
        ...persistencePlanForCategory(MATCH_CATEGORIES.NO_MATCH),
        performsPersistence: true
      };
      const validation = validatePersistencePlan(plan);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("EXECUTION_FLAGS_MUST_BE_FALSE");
    });

    test("side effect flags must be false", () => {
      const plan = {
        ...persistencePlanForCategory(MATCH_CATEGORIES.NO_MATCH),
        persistenceEnabled: true
      };
      const validation = validatePersistencePlan(plan);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("SIDE_EFFECT_FLAGS_MUST_BE_FALSE");
    });

    test("operation inconsistent with action type fails validation", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const tampered = { ...plan, persistenceOperation: PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT };
      const validation = validatePersistencePlan(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("OPERATION_INCONSISTENT_WITH_ACTION_TYPE");
    });

    test("ignore action plan must map to none operation", () => {
      const actionPlan = createRecruitmentActionPlan({ invalid: true });
      const plan = createPersistencePlan(actionPlan);
      expect(validatePersistencePlan(plan).valid).toBe(true);
      expect(plan.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.NONE);
    });

    test("attach operation requires attach action type", () => {
      const plan = {
        ...persistencePlanForCategory(MATCH_CATEGORIES.NO_MATCH),
        persistenceOperation: PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT,
        actionType: ACTION_TYPES.CREATE_NEW_RECRUITMENT
      };
      const validation = validatePersistencePlan(plan);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("ATTACH_OPERATION_ACTION_TYPE_MISMATCH");
    });

    test("create operation requires create action type", () => {
      const plan = {
        ...persistencePlanForCategory(MATCH_CATEGORIES.EXACT_MATCH),
        persistenceOperation: PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT
      };
      const validation = validatePersistencePlan(plan);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("CREATE_OPERATION_ACTION_TYPE_MISMATCH");
    });

    test("manual_review operation requires manual_review action type", () => {
      const plan = {
        ...persistencePlanForCategory(MATCH_CATEGORIES.EXACT_MATCH),
        persistenceOperation: PERSISTENCE_OPERATIONS.MANUAL_REVIEW
      };
      const validation = validatePersistencePlan(plan);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("MANUAL_REVIEW_OPERATION_ACTION_TYPE_MISMATCH");
    });
  });

  describe("summarizePersistencePlan", () => {
    test("valid plan summary includes operation and flags", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const summary = summarizePersistencePlan(plan);
      expect(summary.valid).toBe(true);
      expect(summary.persistenceOperation).toBe(plan.persistenceOperation);
      expect(summary.dryRunOnly).toBe(true);
      expect(summary.performsPersistence).toBe(false);
    });

    test("invalid plan summary returns safe defaults", () => {
      const summary = summarizePersistencePlan(null);
      expect(summary.valid).toBe(false);
      expect(summary.persistenceOperation).toBe(DEFAULT_PERSISTENCE_OPERATION);
      expect(summary.performsPersistence).toBe(false);
    });

    test("summary includes operation label", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.NO_MATCH);
      const summary = summarizePersistencePlan(plan);
      expect(summary.operationLabel).toBe(plan.operationLabel);
    });

    test("summary preserves manual review flag", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.MANUAL_REVIEW);
      const summary = summarizePersistencePlan(plan);
      expect(summary.recommendsManualReview).toBe(true);
    });

    test("compatibility layer re-exports summarizePersistencePlan", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.STRONG_MATCH);
      expect(summarizePersistenceFromCompat(plan)).toEqual(summarizePersistencePlan(plan));
    });
  });

  describe("immutability", () => {
    test("persistence plan graph is fully frozen", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      assertAllFrozen(plan);
    });

    test("persistence plan cannot mutate nested metadata", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.NO_MATCH);
      expect(() => {
        plan.metadata.createReason = "tamper";
      }).toThrow();
    });

    test("persistence plan cannot mutate action plan summary", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.NO_MATCH);
      expect(() => {
        plan.actionPlanSummary.actionType = "tamper";
      }).toThrow();
    });

    test("descriptor and metadata remain frozen", () => {
      assertAllFrozen(PERSISTENCE_PLAN_DESCRIPTOR);
      assertAllFrozen(PERSISTENCE_PLAN_METADATA);
    });

    test("action operation mapping is frozen", () => {
      expect(Object.isFrozen(ACTION_TYPE_TO_PERSISTENCE_OPERATION)).toBe(true);
    });

    test("persistence plan has no circular references", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.PROBABLE_MATCH);
      expect(hasCircularReference(plan)).toBe(false);
      expect(hasCircularReference(PERSISTENCE_PLAN_DESCRIPTOR)).toBe(false);
    });
  });

  describe("failure isolation", () => {
    test("planRecruitmentPersistence never throws on invalid input", () => {
      expect(() => planRecruitmentPersistence(Symbol("x"))).not.toThrow();
      expect(planRecruitmentPersistence(undefined)).toBe(PERSISTENCE_OPERATIONS.NONE);
    });

    test("createPersistencePlan never throws on invalid input", () => {
      expect(() => createPersistencePlan(Symbol("x"))).not.toThrow();
      expect(createPersistencePlan(undefined)).not.toBeNull();
    });

    test("invalid action plan produces none persistence plan without throwing", () => {
      const plan = createPersistencePlan({ garbage: true });
      expect(plan.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.NONE);
      expect(validatePersistencePlan(plan).valid).toBe(true);
    });

    test("summarizePersistencePlan never throws", () => {
      expect(() => summarizePersistencePlan(null)).not.toThrow();
      expect(() => summarizePersistencePlan(undefined)).not.toThrow();
    });

    test("validatePersistencePlan never throws", () => {
      expect(() => validatePersistencePlan(Symbol("x"))).not.toThrow();
    });
  });

  describe("compatibility integration", () => {
    test("attachRecruitmentCompatibility stores persistence plan internally", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 74 };
      attachRecruitmentCompatibility(outcome, {
        notice: sampleNotice(),
        updateId: 74
      });
      const persistencePlan = peekRecruitmentPersistencePlan(outcome);
      expect(persistencePlan).not.toBeNull();
      expect(persistencePlan.phase).toBe(74);
      expect(validatePersistencePlan(persistencePlan).valid).toBe(true);
    });

    test("persistence plan is not a public field on pipeline outcome", () => {
      const outcome = { skipped: false, updateId: 75 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 75 });
      expect(Object.prototype.hasOwnProperty.call(outcome, "persistencePlan")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(outcome, "recruitmentPersistencePlan")).toBe(
        false
      );
    });

    test("peekRecruitmentPersistencePlan returns null for unrelated objects", () => {
      expect(peekRecruitmentPersistencePlan(null)).toBeNull();
      expect(peekRecruitmentPersistencePlan({})).toBeNull();
    });

    test("persistence plan aligns with action plan for same outcome", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 76 };
      attachRecruitmentCompatibility(outcome, {
        notice: {
          title: "SSC CGL 2026",
          content: "Staff Selection Commission Advt. No. CGL-01/2026",
          url: "https://ssc.nic.in"
        },
        updateId: 76
      });
      const actionPlan = peekRecruitmentActionPlan(outcome);
      const persistencePlan = peekRecruitmentPersistencePlan(outcome);
      expect(validateRecruitmentActionPlan(actionPlan).valid).toBe(true);
      expect(persistencePlan.persistenceOperation).toBe(
        planRecruitmentPersistence(actionPlan)
      );
      expect(persistencePlan.actionType).toBe(actionPlan.actionType);
    });

    test("action plan and persistence plan coexist in separate WeakMaps", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 77 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 77 });
      expect(peekRecruitmentActionPlan(outcome)).not.toBeNull();
      expect(peekRecruitmentPersistencePlan(outcome)).not.toBeNull();
      expect(peekRecruitmentActionPlan(outcome)).not.toBe(peekRecruitmentPersistencePlan(outcome));
    });

    test("identity, matching, action, and persistence all attach for same outcome", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 78 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 78 });
      expect(peekRecruitmentCompatibility(outcome)).not.toBeNull();
      expect(peekRecruitmentIdentityResolution(outcome)).not.toBeNull();
      expect(peekRecruitmentMatchingResult(outcome)).not.toBeNull();
      expect(peekRecruitmentActionPlan(outcome)).not.toBeNull();
      expect(peekRecruitmentPersistencePlan(outcome)).not.toBeNull();
    });

    test("compatibility attach still succeeds when persistence coordinator input is sparse", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: null };
      const attached = attachRecruitmentCompatibility(outcome, {});
      expect(attached).not.toBeNull();
      const persistencePlan = peekRecruitmentPersistencePlan(outcome);
      expect(persistencePlan).not.toBeNull();
      expect(persistencePlan.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.MANUAL_REVIEW);
    });
  });

  describe("compatibility failure isolation", () => {
    test("attachRecruitmentCompatibility never throws when persistence coordinator fails", () => {
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
        createPersistencePlan: () => {
          throw new Error("persistence coordinator failure");
        },
        summarizePersistencePlan: () => ({ valid: false })
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
      expect(compat.peekRecruitmentPersistencePlan(outcome)).toBeNull();
      expect(compat.peekRecruitmentExecutionDecision(outcome)).toBeNull();

      jest.dontMock("../server/lib/recruitment/recruitmentPersistenceCoordinator");
      jest.resetModules();
    });

    test("persistence planning failure does not remove compatibility chain", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 5 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 5 });
      expect(peekRecruitmentCompatibility(outcome)).not.toBeNull();
      expect(peekRecruitmentIdentityResolution(outcome)).not.toBeNull();
      expect(peekRecruitmentMatchingResult(outcome)).not.toBeNull();
      expect(peekRecruitmentActionPlan(outcome)).not.toBeNull();
    });

    test("action planner failure leaves persistence plan absent without breaking attach", () => {
      jest.resetModules();
      jest.doMock("../server/lib/recruitment/recruitmentActionPlanner", () => ({
        ACTION_PLANNER_PHASE: 72,
        ACTION_PLAN_ENTITY: "recruitment_action_plan",
        ACTION_TYPES: {
          CREATE_NEW_RECRUITMENT: "create_new_recruitment",
          ATTACH_EXISTING_RECRUITMENT: "attach_existing_recruitment",
          MANUAL_REVIEW: "manual_review",
          IGNORE: "ignore"
        },
        createRecruitmentActionPlan: () => {
          throw new Error("action planner failure");
        },
        summarizeRecruitmentActionPlan: () => ({ valid: false })
      }));

      const compat = require("../server/lib/recruitment/recruitmentCompatibilityLayer");
      const outcome = { skipped: true, reason: "flag_off", updateId: 2 };

      expect(() =>
        compat.attachRecruitmentCompatibility(outcome, {
          notice: sampleNotice(),
          updateId: 2
        })
      ).not.toThrow();

      expect(compat.peekRecruitmentActionPlan(outcome)).toBeNull();
      expect(compat.peekRecruitmentPersistencePlan(outcome)).toBeNull();
      expect(compat.peekRecruitmentExecutionDecision(outcome)).toBeNull();

      jest.dontMock("../server/lib/recruitment/recruitmentActionPlanner");
      jest.resetModules();
    });
  });

  describe("worker observation compatibility", () => {
    test("worker observation path coexists with persistence plan", () => {
      const outcome = runRecruitmentPipeline({
        notice: sampleNotice(),
        candidateRecruitments: [],
        isEnabled: true,
        updateId: 7401
      });
      const actionPlan = peekRecruitmentActionPlan(outcome);
      const persistencePlan = peekRecruitmentPersistencePlan(outcome);
      const observation = observeRecruitmentActionPlan(actionPlan);
      expect(observation.observationState).not.toBe(OBSERVATION_STATES.NOT_AVAILABLE);
      expect(persistencePlan).not.toBeNull();
      expect(persistencePlan.actionType).toBe(actionPlan.actionType);
    });

    test("deferred observation state aligns with create_recruitment persistence", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.NO_MATCH);
      const observation = observeRecruitmentActionPlan(actionPlanForCategory(MATCH_CATEGORIES.NO_MATCH));
      expect(observation.observationState).toBe(OBSERVATION_STATES.DEFERRED);
      expect(plan.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT);
    });

    test("planned observation state aligns with attach_recruitment persistence", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      const observation = observeRecruitmentActionPlan(actionPlanForCategory(MATCH_CATEGORIES.EXACT_MATCH));
      expect(observation.observationState).toBe(OBSERVATION_STATES.PLANNED);
      expect(plan.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT);
    });

    test("manual_review observation aligns with manual_review persistence", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.MANUAL_REVIEW);
      const observation = observeRecruitmentActionPlan(actionPlanForCategory(MATCH_CATEGORIES.MANUAL_REVIEW));
      expect(observation.observationState).toBe(OBSERVATION_STATES.MANUAL_REVIEW);
      expect(plan.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.MANUAL_REVIEW);
    });

    test("ignored observation aligns with none persistence for invalid input", () => {
      const actionPlan = createRecruitmentActionPlan({ invalid: true });
      const plan = createPersistencePlan(actionPlan);
      const observation = observeRecruitmentActionPlan(actionPlan);
      expect(observation.observationState).toBe(OBSERVATION_STATES.IGNORED);
      expect(plan.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.NONE);
    });

    test("observation does not require persistence plan peek", () => {
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

    test("pipeline attaches persistence plan without changing public return fields", () => {
      const result = runRecruitmentPipeline({
        notice,
        isEnabled: false,
        updateId: 88
      });
      const persistencePlan = peekRecruitmentPersistencePlan(result);
      expect(persistencePlan).not.toBeNull();
      expect(validatePersistencePlan(persistencePlan).valid).toBe(true);
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

    test("pipeline outcome keys unchanged after persistence attach", () => {
      const outcome = runRecruitmentPipeline({
        notice,
        candidateRecruitments: [],
        isEnabled: true,
        updateId: 7402
      });
      const keysBefore = Object.keys(outcome).sort();
      peekRecruitmentPersistencePlan(outcome);
      expect(Object.keys(outcome).sort()).toEqual(keysBefore);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("persistence coordinator documents Phase 74", () => {
      const source = read(COORDINATOR_MODULE_PATH);
      expect(source).toMatch(/Phase 74/);
    });

    test("persistence coordinator has no Express / DB / filesystem / env access", () => {
      const source = read(COORDINATOR_MODULE_PATH);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/require\(["'].*config\/db["']\)/);
      expect(source).not.toMatch(/process\.env/);
      expect(source).not.toMatch(/\bINSERT\s+INTO\b/i);
      expect(source).not.toMatch(/https?:\/\//);
    });

    test("persistence coordinator imports only action planner", () => {
      const source = read(COORDINATOR_MODULE_PATH);
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual(["./recruitmentActionPlanner"]);
    });

    test("persistence coordinator does not query database or assign recruitment IDs", () => {
      const source = read(COORDINATOR_MODULE_PATH);
      expect(source).toMatch(/persistencePlanning: false/);
      expect(source).toMatch(/assignsRecruitmentIds: false/);
      expect(source).toMatch(/queriesDatabase: false/);
      expect(source).not.toMatch(/recruitmentMatcher/);
      expect(source).not.toMatch(/processRecruitmentDetection/);
      expect(source).not.toMatch(/mysqlPersistenceRepositoryAdapters/);
    });

    test("compatibility layer integrates persistence coordinator and execution gateway additively", () => {
      const source = read(COMPATIBILITY_MODULE_PATH);
      expect(source).toMatch(/recruitmentPersistenceCoordinator/);
      expect(source).toMatch(/createPersistencePlan/);
      expect(source).toMatch(/persistencePlanByPipelineOutcome/);
      expect(source).toMatch(/peekRecruitmentPersistencePlan/);
      expect(source).toMatch(/recruitmentExecutionGateway/);
      expect(source).toMatch(/createExecutionDecision/);
      expect(source).toMatch(/executionDecisionByPipelineOutcome/);
      expect(source).toMatch(/peekRecruitmentExecutionDecision/);
    });

    test("runRecruitmentPipeline does not import persistence coordinator directly", () => {
      const source = read(PIPELINE_MODULE_PATH);
      expect(source).toMatch(/recruitmentCompatibilityLayer/);
      expect(source).not.toMatch(/recruitmentPersistenceCoordinator/);
    });

    test("siteWorker does not import persistence coordinator directly", () => {
      const worker = read(WORKER_MODULE_PATH);
      expect(worker).not.toMatch(/recruitmentPersistenceCoordinator/);
      expect(worker).not.toMatch(/peekRecruitmentPersistencePlan/);
      expect(worker).toMatch(/recruitmentWorkerObservation/);
      expect(worker).toMatch(/peekRecruitmentActionPlan/);
    });

    test("persistence coordinator has no WeakMap — internal storage lives in compatibility layer", () => {
      const source = read(COORDINATOR_MODULE_PATH);
      expect(source).not.toMatch(/WeakMap/);
      expect(source).not.toMatch(/recruitmentCompatibilityLayer/);
    });
  });

  describe("helper behavior", () => {
    test("records action planner phase in metadata", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(plan.metadata.actionPlannerPhase).toBe(ACTION_PLANNER_PHASE);
      expect(plan.actionPlannerPhase).toBe(ACTION_PLANNER_PHASE);
    });

    test("records action plan entity reference", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.NO_MATCH);
      expect(plan.actionPlanEntity).toBe(ACTION_PLAN_ENTITY);
    });

    test("operation label matches descriptor for planned operation", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.NO_MATCH);
      expect(plan.operationLabel).toBe(
        OPERATION_DESCRIPTOR[plan.persistenceOperation].label
      );
    });

    test("matching profile catalog remains accessible for cross-phase alignment", () => {
      expect(MATCHING_PROFILE_BY_ID.official_identifier_exact.category).toBe(
        MATCH_CATEGORIES.EXACT_MATCH
      );
      expect(MATCHING_PROFILE_BY_ID.no_shared_identity_signals.category).toBe(
        MATCH_CATEGORIES.NO_MATCH
      );
    });

    test("anchor event short notification produces manual_review persistence", () => {
      const identity = identityFromSignals(
        { recruitment_title: "SSC short notice" },
        { noticeContent: "Short notification regarding examination schedule" }
      );
      expect(identity.anchorEventId).toBe(ANCHOR_EVENT_IDS.SHORT_NOTIFICATION);
      const actionPlan = createRecruitmentActionPlan(createMatchingResult(identity));
      const plan = createPersistencePlan(actionPlan);
      expect(plan.persistenceOperation).toBe(PERSISTENCE_OPERATIONS.MANUAL_REVIEW);
    });

    test("high confidence identity flows through to persistence plan profile", () => {
      const identity = identityFromSignals({
        recruitment_title: "SSC CGL 2026",
        organization: "Staff Selection Commission",
        official_identifier: "update:42",
        source_url: "https://ssc.nic.in"
      });
      const matching = createMatchingResult(identity);
      const plan = createPersistencePlan(createRecruitmentActionPlan(matching));
      expect(matching.metadata.identityConfidenceLevel).toBe(CONFIDENCE_LEVELS.HIGH);
      expect(plan.profileId).toBe(matching.profileId);
    });

    test("plan validation embeds action plan validation result", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.STRONG_MATCH);
      expect(plan.planValidation.valid).toBe(true);
      expect(Array.isArray(plan.planValidation.reasons)).toBe(true);
    });

    test("createPersistencePlan sets createReason from action plan validity", () => {
      const validPlan = persistencePlanForCategory(MATCH_CATEGORIES.EXACT_MATCH);
      expect(validPlan.metadata.createReason).toBe("action_plan");
      const invalidPlan = createPersistencePlan({ garbage: true });
      expect(invalidPlan.metadata.createReason).toBe("invalid_action_plan");
    });

    test("persistence plan references frozen action operation mapping", () => {
      const plan = persistencePlanForCategory(MATCH_CATEGORIES.PROBABLE_MATCH);
      expect(plan.actionOperationMapping).toBe(ACTION_TYPE_TO_PERSISTENCE_OPERATION);
      expect(Object.isFrozen(plan.actionOperationMapping)).toBe(true);
    });

    test("skip operation descriptor documents dry-run skip path", () => {
      expect(OPERATION_DESCRIPTOR.skip.dryRunOnly).toBe(true);
      expect(OPERATION_DESCRIPTOR.skip.label).toBe("Skip");
    });
  });
});
