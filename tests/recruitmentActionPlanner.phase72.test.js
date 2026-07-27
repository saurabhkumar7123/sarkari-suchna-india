"use strict";

/**
 * Phase 72 — Recruitment Action Planner tests.
 * Exports, all action types, all matching categories, deterministic behavior,
 * immutability, validation, helper behavior, compatibility integration,
 * pipeline output preservation, failure isolation, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  ACTION_PLANNER_PHASE,
  ACTION_PLAN_ENTITY,
  ACTION_TYPES,
  SUPPORTED_ACTION_TYPES,
  DEFAULT_ACTION_TYPE,
  MATCH_CATEGORY_TO_ACTION,
  ACTION_TYPE_DESCRIPTOR,
  ACTION_PLAN_DESCRIPTOR,
  ACTION_PLAN_METADATA,
  VALIDATION_STATUS,
  isActionType,
  planRecruitmentAction,
  createRecruitmentActionPlan,
  validateRecruitmentActionPlan,
  summarizeRecruitmentActionPlan
} = require("../server/lib/recruitment/recruitmentActionPlanner");

const {
  MATCH_CATEGORIES,
  MATCHING_PROFILE_BY_ID
} = require("../server/lib/recruitment/recruitmentMatchingContracts");

const {
  MATCHING_ENGINE_PHASE,
  createMatchingResult,
  validateMatchingResult
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
  normalizeUpdateMetadata,
  summarizeRecruitmentActionPlan: summarizeActionPlanFromCompat
} = require("../server/lib/recruitment/recruitmentCompatibilityLayer");

const { runRecruitmentPipeline } = require("../server/lib/recruitment/runRecruitmentPipeline");
const { PROCESS_RESULT_STATUS } = require("../server/lib/recruitment/detectionProcessor");

const ROOT = path.join(__dirname, "..");
const PLANNER_MODULE_PATH = "server/lib/recruitment/recruitmentActionPlanner.js";
const COMPATIBILITY_MODULE_PATH = "server/lib/recruitment/recruitmentCompatibilityLayer.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";

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

describe("Phase 72 — recruitmentActionPlanner", () => {
  describe("exports", () => {
    test("exposes phase 72 action planner constants and descriptor", () => {
      expect(ACTION_PLANNER_PHASE).toBe(72);
      expect(ACTION_PLAN_ENTITY).toBe("recruitment_action_plan");
      expect(ACTION_PLAN_DESCRIPTOR.phase).toBe(72);
      expect(ACTION_PLAN_METADATA.actionPlanning).toBe(false);
      expect(ACTION_PLAN_METADATA.lifecycleExecution).toBe(false);
      expect(ACTION_PLAN_METADATA.persistenceEnabled).toBe(false);
      expect(ACTION_PLAN_METADATA.assignsRecruitmentIds).toBe(false);
      expect(ACTION_PLAN_METADATA.queriesDatabase).toBe(false);
    });

    test("defines all supported action types", () => {
      expect(SUPPORTED_ACTION_TYPES.size).toBe(4);
      expect(Object.values(ACTION_TYPES)).toEqual([
        "create_new_recruitment",
        "attach_existing_recruitment",
        "manual_review",
        "ignore"
      ]);
    });

    test("defines category-to-action mapping for all match categories", () => {
      expect(MATCH_CATEGORY_TO_ACTION[MATCH_CATEGORIES.EXACT_MATCH]).toBe(
        ACTION_TYPES.ATTACH_EXISTING_RECRUITMENT
      );
      expect(MATCH_CATEGORY_TO_ACTION[MATCH_CATEGORIES.STRONG_MATCH]).toBe(
        ACTION_TYPES.ATTACH_EXISTING_RECRUITMENT
      );
      expect(MATCH_CATEGORY_TO_ACTION[MATCH_CATEGORIES.PROBABLE_MATCH]).toBe(
        ACTION_TYPES.MANUAL_REVIEW
      );
      expect(MATCH_CATEGORY_TO_ACTION[MATCH_CATEGORIES.WEAK_MATCH]).toBe(
        ACTION_TYPES.MANUAL_REVIEW
      );
      expect(MATCH_CATEGORY_TO_ACTION[MATCH_CATEGORIES.MANUAL_REVIEW]).toBe(
        ACTION_TYPES.MANUAL_REVIEW
      );
      expect(MATCH_CATEGORY_TO_ACTION[MATCH_CATEGORIES.NO_MATCH]).toBe(
        ACTION_TYPES.CREATE_NEW_RECRUITMENT
      );
    });

    test("exports action type descriptors with lifecycle execution disabled", () => {
      expect(ACTION_TYPE_DESCRIPTOR.create_new_recruitment.lifecycleExecution).toBe(false);
      expect(ACTION_TYPE_DESCRIPTOR.attach_existing_recruitment.lifecycleExecution).toBe(false);
      expect(ACTION_TYPE_DESCRIPTOR.manual_review.lifecycleExecution).toBe(false);
      expect(ACTION_TYPE_DESCRIPTOR.ignore.lifecycleExecution).toBe(false);
    });

    test("exports public API functions", () => {
      expect(typeof isActionType).toBe("function");
      expect(typeof planRecruitmentAction).toBe("function");
      expect(typeof createRecruitmentActionPlan).toBe("function");
      expect(typeof validateRecruitmentActionPlan).toBe("function");
      expect(typeof summarizeRecruitmentActionPlan).toBe("function");
    });

    test("isActionType validates supported action types", () => {
      expect(isActionType(ACTION_TYPES.CREATE_NEW_RECRUITMENT)).toBe(true);
      expect(isActionType(ACTION_TYPES.ATTACH_EXISTING_RECRUITMENT)).toBe(true);
      expect(isActionType(ACTION_TYPES.MANUAL_REVIEW)).toBe(true);
      expect(isActionType(ACTION_TYPES.IGNORE)).toBe(true);
      expect(isActionType("unknown_action")).toBe(false);
      expect(isActionType(null)).toBe(false);
    });
  });

  describe("action types", () => {
    test("create_new_recruitment is advisory only", () => {
      const plan = createRecruitmentActionPlan(
        createMatchingResult(
          validIdentityResolution({
            signalObservations: Object.freeze({}),
            availableSignals: Object.freeze([]),
            recommendsManualReview: false,
            resolutionState: IDENTITY_RESOLUTION_STATES.READY_FOR_MATCHING,
            manualReviewReasons: Object.freeze([])
          })
        )
      );
      expect(plan.actionType).toBe(ACTION_TYPES.CREATE_NEW_RECRUITMENT);
      expect(plan.lifecycleExecution).toBe(false);
      expect(plan.actionPlanning).toBe(false);
    });

    test("attach_existing_recruitment is advisory only", () => {
      const matching = createMatchingResult(
        identityFromSignals({
          recruitment_title: "SSC CGL Examination 2026",
          advertisement_number: "CGL-01/2026",
          organization: "Staff Selection Commission"
        })
      );
      const plan = createRecruitmentActionPlan(matching);
      expect(plan.actionType).toBe(ACTION_TYPES.ATTACH_EXISTING_RECRUITMENT);
      expect(plan.lifecycleExecution).toBe(false);
    });

    test("manual_review action type for review categories", () => {
      const matching = createMatchingResult(createIdentityResolutionResult(null));
      const plan = createRecruitmentActionPlan(matching);
      expect(plan.actionType).toBe(ACTION_TYPES.MANUAL_REVIEW);
      expect(plan.recommendsManualReview).toBe(true);
    });

    test("ignore action type for invalid matching input", () => {
      expect(planRecruitmentAction(null)).toBe(ACTION_TYPES.IGNORE);
      expect(planRecruitmentAction({ invalid: true })).toBe(ACTION_TYPES.IGNORE);
      const plan = createRecruitmentActionPlan(null);
      expect(plan.actionType).toBe(ACTION_TYPES.IGNORE);
      expect(plan.matchingResultValid).toBe(false);
    });

    test("default action type is ignore", () => {
      expect(DEFAULT_ACTION_TYPE).toBe(ACTION_TYPES.IGNORE);
    });
  });

  describe("matching categories", () => {
    test("exact_match maps to attach_existing_recruitment", () => {
      const matching = createMatchingResult(
        identityFromSignals({
          recruitment_title: "SSC CGL 2026",
          advertisement_number: "CGL-01/2026",
          official_identifier: "NOTIF-SSC-88421"
        })
      );
      expect(matching.matchCategory).toBe(MATCH_CATEGORIES.EXACT_MATCH);
      expect(planRecruitmentAction(matching)).toBe(ACTION_TYPES.ATTACH_EXISTING_RECRUITMENT);
    });

    test("strong_match maps to attach_existing_recruitment", () => {
      const matching = createMatchingResult(
        identityFromSignals({
          recruitment_title: "RRB NTPC",
          advertisement_number: "CEN-01/2026",
          organization: "Railway Recruitment Board"
        })
      );
      expect(matching.matchCategory).toBe(MATCH_CATEGORIES.STRONG_MATCH);
      expect(planRecruitmentAction(matching)).toBe(ACTION_TYPES.ATTACH_EXISTING_RECRUITMENT);
    });

    test("probable_match maps to manual_review", () => {
      const matching = createMatchingResult(
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
      expect(matching.matchCategory).toBe(MATCH_CATEGORIES.PROBABLE_MATCH);
      expect(planRecruitmentAction(matching)).toBe(ACTION_TYPES.MANUAL_REVIEW);
    });

    test("weak_match maps to manual_review", () => {
      const matching = createMatchingResult(
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
      expect(matching.matchCategory).toBe(MATCH_CATEGORIES.WEAK_MATCH);
      expect(planRecruitmentAction(matching)).toBe(ACTION_TYPES.MANUAL_REVIEW);
    });

    test("manual_review category maps to manual_review action", () => {
      const matching = createMatchingResult(createIdentityResolutionResult(null));
      expect(matching.matchCategory).toBe(MATCH_CATEGORIES.MANUAL_REVIEW);
      expect(planRecruitmentAction(matching)).toBe(ACTION_TYPES.MANUAL_REVIEW);
    });

    test("no_match maps to create_new_recruitment", () => {
      const matching = createMatchingResult(
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
      expect(matching.matchCategory).toBe(MATCH_CATEGORIES.NO_MATCH);
      expect(planRecruitmentAction(matching)).toBe(ACTION_TYPES.CREATE_NEW_RECRUITMENT);
    });

    test("action plan preserves profile id from matching result", () => {
      const matching = createMatchingResult(
        identityFromSignals({
          recruitment_title: "SSC CGL 2026",
          advertisement_number: "CGL-01/2026",
          official_identifier: "NOTIF-SSC-88421"
        })
      );
      const plan = createRecruitmentActionPlan(matching);
      expect(plan.profileId).toBe(matching.profileId);
      expect(plan.profileId).toBe("official_identifier_exact");
    });

    test("action plan preserves review scenario for manual_review matches", () => {
      const matching = createMatchingResult(createIdentityResolutionResult(null));
      const plan = createRecruitmentActionPlan(matching);
      expect(plan.reviewScenarioId).toBe("insufficient_identity_signals");
    });

    test("short notification anchor still plans manual_review action", () => {
      const matching = createMatchingResult(
        identityFromSignals(
          { recruitment_title: "SSC short notice" },
          { noticeContent: "Short notification regarding examination schedule" }
        )
      );
      expect(matching.matchCategory).toBe(MATCH_CATEGORIES.MANUAL_REVIEW);
      expect(planRecruitmentAction(matching)).toBe(ACTION_TYPES.MANUAL_REVIEW);
    });

    test("corroborating-only weak signals plan manual_review", () => {
      const matching = createMatchingResult(
        validIdentityResolution({
          signalObservations: Object.freeze({ post_name: "Assistant" }),
          availableSignals: Object.freeze(["post_name"]),
          recommendsManualReview: false,
          resolutionState: IDENTITY_RESOLUTION_STATES.READY_FOR_MATCHING,
          manualReviewReasons: Object.freeze([])
        })
      );
      expect(matching.matchCategory).toBe(MATCH_CATEGORIES.WEAK_MATCH);
      expect(planRecruitmentAction(matching)).toBe(ACTION_TYPES.MANUAL_REVIEW);
    });
  });

  describe("planRecruitmentAction", () => {
    test("returns deterministic action for each category", () => {
      const categories = Object.values(MATCH_CATEGORIES);
      for (let i = 0; i < categories.length; i += 1) {
        const category = categories[i];
        const matching = matchingForCategory(category);
        expect(matching.matchCategory).toBe(category);
        expect(planRecruitmentAction(matching)).toBe(MATCH_CATEGORY_TO_ACTION[category]);
      }
    });

    test("never throws on invalid input", () => {
      expect(() => planRecruitmentAction(Symbol("x"))).not.toThrow();
      expect(() => planRecruitmentAction(undefined)).not.toThrow();
      expect(() => planRecruitmentAction(42)).not.toThrow();
    });

    test("returns ignore when matching result fails validation", () => {
      expect(planRecruitmentAction({ phase: 71, entity: "wrong" })).toBe(ACTION_TYPES.IGNORE);
    });

    test("is a pure function with no side effects", () => {
      const matching = createMatchingResult(
        identityFromSignals({ recruitment_title: "Pure fn", official_identifier: "id-1" })
      );
      const snapshot = JSON.stringify(matching);
      planRecruitmentAction(matching);
      expect(JSON.stringify(matching)).toBe(snapshot);
    });
  });

  describe("createRecruitmentActionPlan", () => {
    test("creates valid plan from strong match", () => {
      const matching = createMatchingResult(
        identityFromSignals({
          recruitment_title: "SSC CGL",
          advertisement_number: "A-1/2026",
          organization: "SSC"
        })
      );
      const plan = createRecruitmentActionPlan(matching);
      expect(validateRecruitmentActionPlan(plan).valid).toBe(true);
      expect(plan.phase).toBe(72);
      expect(plan.entity).toBe(ACTION_PLAN_ENTITY);
    });

    test("creates plan even when matching result is invalid", () => {
      const plan = createRecruitmentActionPlan({ bogus: true });
      expect(plan).not.toBeNull();
      expect(plan.actionType).toBe(ACTION_TYPES.IGNORE);
      expect(plan.matchingResultValid).toBe(false);
      expect(validateRecruitmentActionPlan(plan).valid).toBe(true);
    });

    test("never throws on invalid input", () => {
      expect(() => createRecruitmentActionPlan(Symbol("x"))).not.toThrow();
      expect(createRecruitmentActionPlan(undefined)).not.toBeNull();
    });

    test("embeds matching summary snapshot", () => {
      const matching = createMatchingResult(
        identityFromSignals({ recruitment_title: "Summary test" })
      );
      const plan = createRecruitmentActionPlan(matching);
      expect(plan.matchingSummary.valid).toBe(true);
      expect(plan.matchingSummary.matchCategory).toBe(matching.matchCategory);
    });

    test("includes planning rationale", () => {
      const matching = createMatchingResult(
        identityFromSignals({ recruitment_title: "Rationale test" })
      );
      const plan = createRecruitmentActionPlan(matching);
      expect(typeof plan.planningRationale).toBe("string");
      expect(plan.planningRationale.length).toBeGreaterThan(0);
      expect(plan.planningRationale).toContain("match_category=");
    });

    test("records matching engine phase reference", () => {
      const plan = createRecruitmentActionPlan(
        createMatchingResult(identityFromSignals({ recruitment_title: "Phase ref" }))
      );
      expect(plan.matchingEnginePhase).toBe(MATCHING_ENGINE_PHASE);
      expect(plan.metadata.matchingEnginePhase).toBe(MATCHING_ENGINE_PHASE);
    });

    test("does not assign recruitment IDs", () => {
      const plan = createRecruitmentActionPlan(
        createMatchingResult(
          identityFromSignals({
            recruitment_title: "No IDs",
            official_identifier: "update:1"
          })
        )
      );
      expect(plan.assignsRecruitmentIds).toBe(false);
      expect(plan).not.toHaveProperty("recruitmentId");
      expect(plan).not.toHaveProperty("selectedRecruitment");
    });

    test("does not enable persistence or database access", () => {
      const plan = createRecruitmentActionPlan(
        createMatchingResult(identityFromSignals({ recruitment_title: "No IO" }))
      );
      expect(plan.queriesDatabase).toBe(false);
      expect(plan.performsPersistence).toBe(false);
      expect(plan.persistenceEnabled).toBe(false);
    });
  });

  describe("deterministic behavior", () => {
    test("planRecruitmentAction returns identical output for identical input", () => {
      const matching = createMatchingResult(
        identityFromSignals({
          recruitment_title: "Deterministic",
          official_identifier: "update:55"
        })
      );
      expect(planRecruitmentAction(matching)).toBe(planRecruitmentAction(matching));
    });

    test("createRecruitmentActionPlan returns identical output for identical input", () => {
      const matching = createMatchingResult(
        identityFromSignals({
          recruitment_title: "Deterministic plan",
          advertisement_number: "D-1/2026",
          organization: "SSC"
        })
      );
      expect(createRecruitmentActionPlan(matching)).toEqual(
        createRecruitmentActionPlan(matching)
      );
    });

    test("action selection is stable across repeated evaluations", () => {
      const matching = createMatchingResult(
        identityFromSignals({
          recruitment_title: "SSC CGL 2026",
          advertisement_number: "CGL-01/2026",
          official_identifier: "NOTIF-SSC-88421"
        })
      );
      const actions = Array.from({ length: 5 }, () => planRecruitmentAction(matching));
      expect(new Set(actions).size).toBe(1);
      expect(actions[0]).toBe(ACTION_TYPES.ATTACH_EXISTING_RECRUITMENT);
    });

    test("category mapping is frozen and deterministic", () => {
      expect(Object.isFrozen(MATCH_CATEGORY_TO_ACTION)).toBe(true);
      expect(MATCH_CATEGORY_TO_ACTION[MATCH_CATEGORIES.EXACT_MATCH]).toBe(
        MATCH_CATEGORY_TO_ACTION[MATCH_CATEGORIES.EXACT_MATCH]
      );
    });

    test("normalized update path produces deterministic action plan", () => {
      const normalized = normalizeUpdateMetadata({
        notice: sampleNotice(),
        updateId: 77
      });
      const context = createRecruitmentContext({
        metadata: {
          observedSignals: {
            recruitment_title: normalized.notice.title,
            source_url: normalized.sourceUrl,
            official_identifier: `update:${normalized.updateId}`
          },
          noticeContent: normalized.notice.content
        }
      });
      const identity = createIdentityResolutionResult(context);
      const matching = createMatchingResult(identity);
      const first = createRecruitmentActionPlan(matching);
      const second = createRecruitmentActionPlan(matching);
      expect(first.actionType).toBe(second.actionType);
      expect(first.matchCategory).toBe(second.matchCategory);
    });
  });

  describe("immutability", () => {
    test("createRecruitmentActionPlan returns deeply frozen object", () => {
      const plan = createRecruitmentActionPlan(
        createMatchingResult(identityFromSignals({ recruitment_title: "Frozen test" }))
      );
      assertAllFrozen(plan);
    });

    test("category action mapping is frozen", () => {
      expect(Object.isFrozen(MATCH_CATEGORY_TO_ACTION)).toBe(true);
      expect(Object.isFrozen(ACTION_TYPES)).toBe(true);
      expect(Object.isFrozen(ACTION_PLAN_DESCRIPTOR)).toBe(true);
    });

    test("mutating returned plan does not affect subsequent calls", () => {
      const matching = createMatchingResult(
        identityFromSignals({
          recruitment_title: "Immutable",
          official_identifier: "update:1"
        })
      );
      const plan = createRecruitmentActionPlan(matching);
      const originalAction = plan.actionType;
      try {
        plan.actionType = "tampered";
      } catch {
        // strict mode may throw on frozen property assignment
      }
      const second = createRecruitmentActionPlan(matching);
      expect(second.actionType).toBe(originalAction);
    });

    test("validateRecruitmentActionPlan returns frozen validation result", () => {
      const plan = createRecruitmentActionPlan(
        createMatchingResult(identityFromSignals({ recruitment_title: "Validation freeze" }))
      );
      const validation = validateRecruitmentActionPlan(plan);
      expect(Object.isFrozen(validation)).toBe(true);
      expect(Object.isFrozen(validation.reasons)).toBe(true);
    });

    test("summarizeRecruitmentActionPlan returns frozen summary", () => {
      const plan = createRecruitmentActionPlan(
        createMatchingResult(identityFromSignals({ recruitment_title: "Summary freeze" }))
      );
      const summary = summarizeRecruitmentActionPlan(plan);
      expect(Object.isFrozen(summary)).toBe(true);
    });
  });

  describe("validation", () => {
    test("validateRecruitmentActionPlan accepts a valid plan", () => {
      const plan = createRecruitmentActionPlan(
        createMatchingResult(identityFromSignals({ recruitment_title: "Valid plan" }))
      );
      const validation = validateRecruitmentActionPlan(plan);
      expect(validation.valid).toBe(true);
      expect(validation.status).toBe(VALIDATION_STATUS.VALID);
      expect(validation.reasons).toEqual([]);
    });

    test("validateRecruitmentActionPlan rejects invalid shapes", () => {
      const validation = validateRecruitmentActionPlan({ phase: 72 });
      expect(validation.valid).toBe(false);
      expect(validation.reasons.length).toBeGreaterThan(0);
    });

    test("validateRecruitmentActionPlan rejects invalid phase", () => {
      const plan = createRecruitmentActionPlan(
        createMatchingResult(identityFromSignals({ recruitment_title: "Phase check" }))
      );
      const tampered = { ...plan, phase: 99 };
      expect(validateRecruitmentActionPlan(tampered).valid).toBe(false);
    });

    test("validateRecruitmentActionPlan rejects invalid action type", () => {
      const plan = createRecruitmentActionPlan(
        createMatchingResult(identityFromSignals({ recruitment_title: "Action check" }))
      );
      const tampered = { ...plan, actionType: "execute_now" };
      expect(validateRecruitmentActionPlan(tampered).valid).toBe(false);
    });

    test("validateRecruitmentActionPlan rejects execution flags enabled", () => {
      const plan = createRecruitmentActionPlan(
        createMatchingResult(identityFromSignals({ recruitment_title: "Flags check" }))
      );
      const tampered = { ...plan, lifecycleExecution: true };
      expect(validateRecruitmentActionPlan(tampered).valid).toBe(false);
    });

    test("validateRecruitmentActionPlan rejects inconsistent category and action", () => {
      const plan = createRecruitmentActionPlan(
        createMatchingResult(identityFromSignals({ recruitment_title: "Inconsistent" }))
      );
      const tampered = {
        ...plan,
        matchCategory: MATCH_CATEGORIES.EXACT_MATCH,
        actionType: ACTION_TYPES.CREATE_NEW_RECRUITMENT
      };
      expect(validateRecruitmentActionPlan(tampered).valid).toBe(false);
    });

    test("validateRecruitmentActionPlan requires ignore for invalid matching input plans", () => {
      const plan = createRecruitmentActionPlan(null);
      const tampered = { ...plan, actionType: ACTION_TYPES.MANUAL_REVIEW };
      expect(validateRecruitmentActionPlan(tampered).valid).toBe(false);
    });

    test("validateRecruitmentActionPlan never throws", () => {
      expect(() => validateRecruitmentActionPlan(Symbol("x"))).not.toThrow();
      expect(() => validateRecruitmentActionPlan(undefined)).not.toThrow();
    });

    test("invalid plan summary reports valid false", () => {
      const summary = summarizeRecruitmentActionPlan({ phase: 72 });
      expect(summary.valid).toBe(false);
      expect(summary.actionType).toBe(DEFAULT_ACTION_TYPE);
    });
  });

  describe("summarizeRecruitmentActionPlan", () => {
    test("summarizes valid plan with key fields", () => {
      const matching = createMatchingResult(
        identityFromSignals({
          recruitment_title: "Summarize",
          official_identifier: "update:2"
        })
      );
      const plan = createRecruitmentActionPlan(matching);
      const summary = summarizeRecruitmentActionPlan(plan);
      expect(summary.valid).toBe(true);
      expect(summary.actionType).toBe(plan.actionType);
      expect(summary.matchCategory).toBe(plan.matchCategory);
      expect(summary.actionPlanning).toBe(false);
      expect(summary.lifecycleExecution).toBe(false);
    });

    test("summary includes action label", () => {
      const plan = createRecruitmentActionPlan(
        createMatchingResult(identityFromSignals({ recruitment_title: "Label" }))
      );
      const summary = summarizeRecruitmentActionPlan(plan);
      expect(summary.actionLabel).toBe(plan.actionLabel);
    });

    test("summary preserves manual review flag", () => {
      const plan = createRecruitmentActionPlan(createMatchingResult(createIdentityResolutionResult(null)));
      const summary = summarizeRecruitmentActionPlan(plan);
      expect(summary.recommendsManualReview).toBe(true);
    });

    test("compatibility layer re-exports summarizeRecruitmentActionPlan", () => {
      const plan = createRecruitmentActionPlan(
        createMatchingResult(identityFromSignals({ recruitment_title: "Compat summary" }))
      );
      expect(summarizeActionPlanFromCompat(plan)).toEqual(summarizeRecruitmentActionPlan(plan));
    });
  });

  describe("failure isolation", () => {
    test("planRecruitmentAction never throws on invalid input", () => {
      expect(() => planRecruitmentAction(Symbol("x"))).not.toThrow();
      expect(planRecruitmentAction(undefined)).toBe(ACTION_TYPES.IGNORE);
    });

    test("createRecruitmentActionPlan never throws on invalid input", () => {
      expect(() => createRecruitmentActionPlan(Symbol("x"))).not.toThrow();
      expect(createRecruitmentActionPlan(undefined)).not.toBeNull();
    });

    test("invalid matching result produces ignore plan without throwing", () => {
      const plan = createRecruitmentActionPlan({ invalid: true });
      expect(plan.actionType).toBe(ACTION_TYPES.IGNORE);
      expect(validateRecruitmentActionPlan(plan).valid).toBe(true);
    });

    test("summarizeRecruitmentActionPlan never throws", () => {
      expect(() => summarizeRecruitmentActionPlan(null)).not.toThrow();
      expect(() => summarizeRecruitmentActionPlan(undefined)).not.toThrow();
    });
  });

  describe("compatibility integration", () => {
    test("attachRecruitmentCompatibility stores action plan internally", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 11 };
      attachRecruitmentCompatibility(outcome, {
        notice: sampleNotice(),
        updateId: 11
      });
      const actionPlan = peekRecruitmentActionPlan(outcome);
      expect(actionPlan).not.toBeNull();
      expect(actionPlan.phase).toBe(72);
      expect(validateRecruitmentActionPlan(actionPlan).valid).toBe(true);
    });

    test("action plan is not a public field on pipeline outcome", () => {
      const outcome = { skipped: false, updateId: 12 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 12 });
      expect(Object.prototype.hasOwnProperty.call(outcome, "actionPlan")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(outcome, "recruitmentActionPlan")).toBe(
        false
      );
    });

    test("peekRecruitmentActionPlan returns null for unrelated objects", () => {
      expect(peekRecruitmentActionPlan(null)).toBeNull();
      expect(peekRecruitmentActionPlan({})).toBeNull();
    });

    test("action plan aligns with matching result for same outcome", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 20 };
      attachRecruitmentCompatibility(outcome, {
        notice: {
          title: "SSC CGL 2026",
          content: "Staff Selection Commission Advt. No. CGL-01/2026",
          url: "https://ssc.nic.in"
        },
        updateId: 20
      });
      const matching = peekRecruitmentMatchingResult(outcome);
      const actionPlan = peekRecruitmentActionPlan(outcome);
      expect(validateMatchingResult(matching).valid).toBe(true);
      expect(actionPlan.matchCategory).toBe(matching.matchCategory);
      expect(actionPlan.actionType).toBe(planRecruitmentAction(matching));
    });

    test("compatibility attach still succeeds when action planning input is sparse", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: null };
      const attached = attachRecruitmentCompatibility(outcome, {});
      expect(attached).not.toBeNull();
      expect(peekRecruitmentCompatibility(outcome)).toBe(attached);
      const actionPlan = peekRecruitmentActionPlan(outcome);
      expect(actionPlan).not.toBeNull();
      expect(actionPlan.actionType).toBe(ACTION_TYPES.MANUAL_REVIEW);
    });

    test("matching result and action plan coexist in separate WeakMaps", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 33 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 33 });
      expect(peekRecruitmentMatchingResult(outcome)).not.toBeNull();
      expect(peekRecruitmentActionPlan(outcome)).not.toBeNull();
      expect(peekRecruitmentMatchingResult(outcome)).not.toBe(peekRecruitmentActionPlan(outcome));
    });

    test("identity resolution, matching, and action plan all attach for same outcome", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 44 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 44 });
      expect(peekRecruitmentIdentityResolution(outcome)).not.toBeNull();
      expect(peekRecruitmentMatchingResult(outcome)).not.toBeNull();
      expect(peekRecruitmentActionPlan(outcome)).not.toBeNull();
    });
  });

  describe("compatibility failure isolation", () => {
    test("attachRecruitmentCompatibility never throws when action planner fails", () => {
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
        validateRecruitmentActionPlan: () => ({ valid: false, status: "invalid", reasons: [] }),
        createRecruitmentActionPlan: () => {
          throw new Error("action planner failure");
        },
        summarizeRecruitmentActionPlan: () => ({ valid: false })
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
      expect(compat.peekRecruitmentActionPlan(outcome)).toBeNull();

      jest.dontMock("../server/lib/recruitment/recruitmentActionPlanner");
      jest.resetModules();
    });

    test("action planning failure does not remove compatibility, identity, or matching", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 5 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 5 });
      expect(peekRecruitmentCompatibility(outcome)).not.toBeNull();
      expect(peekRecruitmentIdentityResolution(outcome)).not.toBeNull();
      expect(peekRecruitmentMatchingResult(outcome)).not.toBeNull();
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

    test("pipeline attaches action plan without changing public return fields", () => {
      const result = runRecruitmentPipeline({
        notice,
        isEnabled: false,
        updateId: 88
      });
      const actionPlan = peekRecruitmentActionPlan(result);
      expect(actionPlan).not.toBeNull();
      expect(validateRecruitmentActionPlan(actionPlan).valid).toBe(true);
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
  });

  describe("circular references", () => {
    test("action plan graph has no circular references", () => {
      const plan = createRecruitmentActionPlan(
        createMatchingResult(identityFromSignals({ recruitment_title: "No cycles" }))
      );
      expect(hasCircularReference(plan)).toBe(false);
      expect(hasCircularReference(ACTION_PLAN_DESCRIPTOR)).toBe(false);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("action planner has no Express / DB / filesystem / env access", () => {
      const source = read(PLANNER_MODULE_PATH);
      expect(source).toMatch(/Phase 72/);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/require\(["'].*config\/db["']\)/);
      expect(source).not.toMatch(/process\.env/);
      expect(source).not.toMatch(/\bINSERT\s+INTO\b/i);
      expect(source).not.toMatch(/https?:\/\//);
    });

    test("action planner imports only matching engine and matching contracts", () => {
      const source = read(PLANNER_MODULE_PATH);
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual([
        "./recruitmentMatchingEngine",
        "./recruitmentMatchingContracts"
      ]);
    });

    test("action planner does not query database or assign recruitment IDs", () => {
      const source = read(PLANNER_MODULE_PATH);
      expect(source).toMatch(/actionPlanning: false/);
      expect(source).toMatch(/assignsRecruitmentIds: false/);
      expect(source).toMatch(/queriesDatabase: false/);
      expect(source).not.toMatch(/recruitmentMatcher/);
      expect(source).not.toMatch(/processRecruitmentDetection/);
      expect(source).not.toMatch(/evaluateRecruitmentEligibility/);
    });

    test("compatibility layer integrates action planner additively", () => {
      const source = read(COMPATIBILITY_MODULE_PATH);
      expect(source).toMatch(/recruitmentActionPlanner/);
      expect(source).toMatch(/createRecruitmentActionPlan/);
      expect(source).toMatch(/actionPlanByPipelineOutcome/);
      expect(source).toMatch(/peekRecruitmentActionPlan/);
    });

    test("runRecruitmentPipeline does not import action planner directly", () => {
      const source = read(PIPELINE_MODULE_PATH);
      expect(source).toMatch(/recruitmentCompatibilityLayer/);
      expect(source).not.toMatch(/recruitmentActionPlanner/);
    });

    test("siteWorker does not import action planner directly — Phase 73 observes via compatibility peek", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/recruitmentActionPlanner/);
      expect(worker).toMatch(/recruitmentWorkerObservation/);
      expect(worker).toMatch(/peekRecruitmentActionPlan/);
      expect(worker).toMatch(/observeRecruitmentActionPlan/);
    });

    test("action planner has no WeakMap — internal storage lives in compatibility layer", () => {
      const source = read(PLANNER_MODULE_PATH);
      expect(source).not.toMatch(/WeakMap/);
      expect(source).not.toMatch(/recruitmentCompatibilityLayer/);
    });
  });

  describe("helper behavior", () => {
    test("records identity confidence via matching metadata when available", () => {
      const identity = identityFromSignals({
        recruitment_title: "SSC CGL 2026",
        organization: "Staff Selection Commission",
        official_identifier: "update:42",
        source_url: "https://ssc.nic.in"
      });
      const matching = createMatchingResult(identity);
      const plan = createRecruitmentActionPlan(matching);
      expect(plan.metadata.resolutionState).toBe(matching.resolutionState);
      expect(matching.metadata.identityConfidenceLevel).toBe(CONFIDENCE_LEVELS.HIGH);
    });

    test("action label matches descriptor for planned action", () => {
      const matching = createMatchingResult(
        identityFromSignals({
          recruitment_title: "Label match",
          official_identifier: "update:9"
        })
      );
      const plan = createRecruitmentActionPlan(matching);
      expect(plan.actionLabel).toBe(
        ACTION_TYPE_DESCRIPTOR[plan.actionType].label
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

    test("anchor event short notification produces manual_review plan", () => {
      const identity = identityFromSignals(
        { recruitment_title: "SSC short notice" },
        { noticeContent: "Short notification regarding examination schedule" }
      );
      expect(identity.anchorEventId).toBe(ANCHOR_EVENT_IDS.SHORT_NOTIFICATION);
      const plan = createRecruitmentActionPlan(createMatchingResult(identity));
      expect(plan.actionType).toBe(ACTION_TYPES.MANUAL_REVIEW);
    });
  });
});
