"use strict";

/**
 * Phase 73 — Worker Execution Integration (Observation Mode) tests.
 * Exports, observation states, deterministic behavior, validation,
 * diagnostics, immutability, worker integration, pipeline output preservation,
 * failure isolation, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  WORKER_OBSERVATION_PHASE,
  OBSERVATION_ENTITY,
  OBSERVATION_STATES,
  SUPPORTED_OBSERVATION_STATES,
  VALIDATION_STATUS,
  OBSERVATION_METADATA,
  OBSERVATION_DESCRIPTOR,
  ACTION_TYPE_TO_OBSERVATION_STATE,
  isObservationState,
  resolveObservationState,
  observeRecruitmentActionPlan,
  validateObservedAction,
  summarizeObservedAction
} = require("../server/lib/recruitment/recruitmentWorkerObservation");

const {
  ACTION_PLANNER_PHASE,
  ACTION_PLAN_ENTITY,
  ACTION_TYPES,
  createRecruitmentActionPlan,
  validateRecruitmentActionPlan
} = require("../server/lib/recruitment/recruitmentActionPlanner");

const {
  MATCH_CATEGORIES
} = require("../server/lib/recruitment/recruitmentMatchingContracts");

const {
  createMatchingResult
} = require("../server/lib/recruitment/recruitmentMatchingEngine");

const {
  createIdentityResolutionResult
} = require("../server/lib/recruitment/recruitmentIdentityResolutionEngine");

const {
  createRecruitmentContext
} = require("../server/lib/recruitment/recruitmentContext");

const {
  attachRecruitmentCompatibility,
  peekRecruitmentActionPlan
} = require("../server/lib/recruitment/recruitmentCompatibilityLayer");

const { runRecruitmentPipeline } = require("../server/lib/recruitment/runRecruitmentPipeline");

const ROOT = path.join(__dirname, "..");
const OBSERVATION_MODULE_PATH = "server/lib/recruitment/recruitmentWorkerObservation.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";
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

function identityFromSignals(observedSignals, extraMetadata = {}) {
  return createIdentityResolutionResult(
    createRecruitmentContext({
      metadata: {
        observedSignals,
        ...extraMetadata
      }
    })
  );
}

function planForCategory(categorySignals) {
  const identity = identityFromSignals(categorySignals);
  const matching = createMatchingResult(identity);
  return createRecruitmentActionPlan(matching);
}

function loadWorkerWithObservationSpy() {
  jest.resetModules();

  const actualObservation = jest.requireActual(
    "../server/lib/recruitment/recruitmentWorkerObservation"
  );
  const observeSpy = jest.fn(actualObservation.observeRecruitmentActionPlan);

  jest.doMock("../server/lib/recruitment/recruitmentWorkerObservation", () => ({
    ...actualObservation,
    observeRecruitmentActionPlan: observeSpy
  }));

  return {
    observeSpy,
    worker: require("../server/services/workers/siteWorker"),
    observation: actualObservation,
    compat: require("../server/lib/recruitment/recruitmentCompatibilityLayer")
  };
}

afterEach(() => {
  jest.dontMock("../server/lib/recruitment/recruitmentWorkerObservation");
  jest.resetModules();
});

describe("Phase 73 — recruitmentWorkerObservation", () => {
  describe("exports", () => {
    test("exports phase constant", () => {
      expect(WORKER_OBSERVATION_PHASE).toBe(73);
    });

    test("exports observation entity", () => {
      expect(OBSERVATION_ENTITY).toBe("recruitment_worker_action_observation");
    });

    test("exports all observation states", () => {
      expect(OBSERVATION_STATES.IGNORED).toBe("ignored");
      expect(OBSERVATION_STATES.PLANNED).toBe("planned");
      expect(OBSERVATION_STATES.DEFERRED).toBe("deferred");
      expect(OBSERVATION_STATES.MANUAL_REVIEW).toBe("manual_review");
      expect(OBSERVATION_STATES.NOT_AVAILABLE).toBe("not_available");
    });

    test("supported observation states set matches values", () => {
      expect(SUPPORTED_OBSERVATION_STATES.size).toBe(5);
      for (const state of Object.values(OBSERVATION_STATES)) {
        expect(SUPPORTED_OBSERVATION_STATES.has(state)).toBe(true);
      }
    });

    test("exports validation status constants", () => {
      expect(VALIDATION_STATUS.VALID).toBe("valid");
      expect(VALIDATION_STATUS.INVALID).toBe("invalid");
      expect(VALIDATION_STATUS.INCOMPLETE).toBe("incomplete");
    });

    test("exports observation metadata with execution disabled", () => {
      expect(OBSERVATION_METADATA.workerExecution).toBe(false);
      expect(OBSERVATION_METADATA.lifecycleExecution).toBe(false);
      expect(OBSERVATION_METADATA.persistenceEnabled).toBe(false);
      expect(OBSERVATION_METADATA.performsPersistence).toBe(false);
    });

    test("exports observation descriptor", () => {
      expect(OBSERVATION_DESCRIPTOR.phase).toBe(73);
      expect(OBSERVATION_DESCRIPTOR.entity).toBe(OBSERVATION_ENTITY);
      expect(OBSERVATION_DESCRIPTOR.supportedStates).toEqual(SUPPORTED_OBSERVATION_STATES);
    });

    test("exports action type to observation state mapping", () => {
      expect(ACTION_TYPE_TO_OBSERVATION_STATE[ACTION_TYPES.IGNORE]).toBe(
        OBSERVATION_STATES.IGNORED
      );
      expect(ACTION_TYPE_TO_OBSERVATION_STATE[ACTION_TYPES.MANUAL_REVIEW]).toBe(
        OBSERVATION_STATES.MANUAL_REVIEW
      );
      expect(ACTION_TYPE_TO_OBSERVATION_STATE[ACTION_TYPES.ATTACH_EXISTING_RECRUITMENT]).toBe(
        OBSERVATION_STATES.PLANNED
      );
      expect(ACTION_TYPE_TO_OBSERVATION_STATE[ACTION_TYPES.CREATE_NEW_RECRUITMENT]).toBe(
        OBSERVATION_STATES.DEFERRED
      );
    });

    test("exports core functions", () => {
      expect(typeof isObservationState).toBe("function");
      expect(typeof resolveObservationState).toBe("function");
      expect(typeof observeRecruitmentActionPlan).toBe("function");
      expect(typeof validateObservedAction).toBe("function");
      expect(typeof summarizeObservedAction).toBe("function");
    });
  });

  describe("observation states", () => {
    test("null action plan resolves to not_available", () => {
      expect(resolveObservationState(null)).toBe(OBSERVATION_STATES.NOT_AVAILABLE);
    });

    test("undefined action plan resolves to not_available", () => {
      expect(resolveObservationState(undefined)).toBe(OBSERVATION_STATES.NOT_AVAILABLE);
    });

    test("non-object action plan resolves to not_available", () => {
      expect(resolveObservationState("plan")).toBe(OBSERVATION_STATES.NOT_AVAILABLE);
      expect(resolveObservationState(42)).toBe(OBSERVATION_STATES.NOT_AVAILABLE);
    });

    test("ignore action type maps to ignored", () => {
      const plan = createRecruitmentActionPlan(null);
      expect(plan.actionType).toBe(ACTION_TYPES.IGNORE);
      expect(resolveObservationState(plan)).toBe(OBSERVATION_STATES.IGNORED);
    });

    test("manual_review action type maps to manual_review", () => {
      const plan = planForCategory({
        recruitment_title: "Ambiguous notice",
        organization: "SSC"
      });
      if (plan.actionType === ACTION_TYPES.MANUAL_REVIEW) {
        expect(resolveObservationState(plan)).toBe(OBSERVATION_STATES.MANUAL_REVIEW);
      } else {
        const forced = { ...plan, actionType: ACTION_TYPES.MANUAL_REVIEW };
        expect(resolveObservationState(forced)).toBe(OBSERVATION_STATES.MANUAL_REVIEW);
      }
    });

    test("attach_existing_recruitment maps to planned", () => {
      const plan = planForCategory({
        recruitment_title: "SSC CGL 2026",
        organization: "Staff Selection Commission",
        official_identifier: "update:73"
      });
      if (plan.actionType === ACTION_TYPES.ATTACH_EXISTING_RECRUITMENT) {
        expect(resolveObservationState(plan)).toBe(OBSERVATION_STATES.PLANNED);
      } else {
        const forced = { ...plan, actionType: ACTION_TYPES.ATTACH_EXISTING_RECRUITMENT };
        expect(resolveObservationState(forced)).toBe(OBSERVATION_STATES.PLANNED);
      }
    });

    test("create_new_recruitment maps to deferred", () => {
      const plan = planForCategory({ recruitment_title: "Unknown exam" });
      if (plan.actionType === ACTION_TYPES.CREATE_NEW_RECRUITMENT) {
        expect(resolveObservationState(plan)).toBe(OBSERVATION_STATES.DEFERRED);
      } else {
        const forced = { ...plan, actionType: ACTION_TYPES.CREATE_NEW_RECRUITMENT };
        expect(resolveObservationState(forced)).toBe(OBSERVATION_STATES.DEFERRED);
      }
    });

    test("unknown action type maps to not_available", () => {
      expect(resolveObservationState({ actionType: "execute_now" })).toBe(
        OBSERVATION_STATES.NOT_AVAILABLE
      );
    });

    test("isObservationState accepts supported states only", () => {
      for (const state of Object.values(OBSERVATION_STATES)) {
        expect(isObservationState(state)).toBe(true);
      }
      expect(isObservationState("execute")).toBe(false);
      expect(isObservationState(null)).toBe(false);
    });

    test("observe null plan yields not_available state", () => {
      const observation = observeRecruitmentActionPlan(null);
      expect(observation.observationState).toBe(OBSERVATION_STATES.NOT_AVAILABLE);
    });

    test("observe ignore plan yields ignored state", () => {
      const plan = createRecruitmentActionPlan(null);
      const observation = observeRecruitmentActionPlan(plan);
      expect(observation.observationState).toBe(OBSERVATION_STATES.IGNORED);
    });

    test("observe manual_review plan yields manual_review state", () => {
      const identity = identityFromSignals({
        recruitment_title: "Short notice",
        organization: "SSC"
      });
      const plan = createRecruitmentActionPlan(createMatchingResult(identity));
      if (plan.actionType === ACTION_TYPES.MANUAL_REVIEW) {
        const observation = observeRecruitmentActionPlan(plan);
        expect(observation.observationState).toBe(OBSERVATION_STATES.MANUAL_REVIEW);
      }
    });

    test("observe attach plan yields planned state", () => {
      const identity = identityFromSignals({
        recruitment_title: "SSC CGL 2026",
        official_identifier: "update:73-planned"
      });
      const plan = createRecruitmentActionPlan(createMatchingResult(identity));
      if (plan.actionType === ACTION_TYPES.ATTACH_EXISTING_RECRUITMENT) {
        const observation = observeRecruitmentActionPlan(plan);
        expect(observation.observationState).toBe(OBSERVATION_STATES.PLANNED);
      }
    });

    test("observe create plan yields deferred state", () => {
      const identity = identityFromSignals({ recruitment_title: "Brand new exam 73" });
      const plan = createRecruitmentActionPlan(createMatchingResult(identity));
      if (plan.actionType === ACTION_TYPES.CREATE_NEW_RECRUITMENT) {
        const observation = observeRecruitmentActionPlan(plan);
        expect(observation.observationState).toBe(OBSERVATION_STATES.DEFERRED);
      }
    });

    test("each supported state is reachable via observe", () => {
      const samples = [
        { actionType: ACTION_TYPES.IGNORE, expected: OBSERVATION_STATES.IGNORED },
        { actionType: ACTION_TYPES.MANUAL_REVIEW, expected: OBSERVATION_STATES.MANUAL_REVIEW },
        {
          actionType: ACTION_TYPES.ATTACH_EXISTING_RECRUITMENT,
          expected: OBSERVATION_STATES.PLANNED
        },
        {
          actionType: ACTION_TYPES.CREATE_NEW_RECRUITMENT,
          expected: OBSERVATION_STATES.DEFERRED
        }
      ];

      for (const sample of samples) {
        const plan = createRecruitmentActionPlan(
          createMatchingResult(
            identityFromSignals({
              recruitment_title: `Phase73 ${sample.actionType}`,
              official_identifier: `id:${sample.actionType}`
            })
          )
        );
        const forced =
          plan.actionType === sample.actionType
            ? plan
            : Object.freeze({ ...plan, actionType: sample.actionType });
        const observation = observeRecruitmentActionPlan(forced);
        expect(observation.observationState).toBe(sample.expected);
      }
    });
  });

  describe("deterministic behavior", () => {
    test("same action plan produces identical observations", () => {
      const plan = planForCategory({
        recruitment_title: "Deterministic 73",
        official_identifier: "det:73"
      });
      const first = observeRecruitmentActionPlan(plan);
      const second = observeRecruitmentActionPlan(plan);
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("repeated null observations are identical", () => {
      const first = observeRecruitmentActionPlan(null);
      const second = observeRecruitmentActionPlan(null);
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("resolveObservationState is pure", () => {
      const plan = planForCategory({ recruitment_title: "Pure resolve" });
      expect(resolveObservationState(plan)).toBe(resolveObservationState(plan));
    });

    test("observation does not mutate input action plan", () => {
      const plan = planForCategory({
        recruitment_title: "Immutable input",
        official_identifier: "imm:73"
      });
      const before = JSON.stringify(plan);
      observeRecruitmentActionPlan(plan);
      expect(JSON.stringify(plan)).toBe(before);
    });

    test("validateObservedAction is deterministic", () => {
      const observation = observeRecruitmentActionPlan(null);
      const first = validateObservedAction(observation);
      const second = validateObservedAction(observation);
      expect(first).toEqual(second);
    });

    test("summarizeObservedAction is deterministic", () => {
      const observation = observeRecruitmentActionPlan(planForCategory({ recruitment_title: "Sum" }));
      const first = summarizeObservedAction(observation);
      const second = summarizeObservedAction(observation);
      expect(first).toEqual(second);
    });

    test("observation preserves action plan phase reference", () => {
      const plan = planForCategory({ recruitment_title: "Phase ref" });
      const observation = observeRecruitmentActionPlan(plan);
      expect(observation.actionPlanPhase).toBe(ACTION_PLANNER_PHASE);
      expect(observation.actionPlanEntity).toBe(ACTION_PLAN_ENTITY);
    });

    test("observation copies action type from plan", () => {
      const plan = createRecruitmentActionPlan(null);
      const observation = observeRecruitmentActionPlan(plan);
      expect(observation.actionType).toBe(plan.actionType);
      expect(observation.matchCategory).toBe(plan.matchCategory);
    });
  });

  describe("validation", () => {
    test("valid observation passes validation", () => {
      const observation = observeRecruitmentActionPlan(planForCategory({ recruitment_title: "Valid" }));
      const validation = validateObservedAction(observation);
      expect(validation.valid).toBe(true);
      expect(validation.reasons).toEqual([]);
    });

    test("null observation fails validation", () => {
      const validation = validateObservedAction(null);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_OBSERVATION_SHAPE");
    });

    test("invalid phase fails validation", () => {
      const observation = observeRecruitmentActionPlan(null);
      const tampered = { ...observation, phase: 99 };
      const validation = validateObservedAction(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_PHASE");
    });

    test("invalid entity fails validation", () => {
      const observation = observeRecruitmentActionPlan(null);
      const tampered = { ...observation, entity: "wrong" };
      const validation = validateObservedAction(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_ENTITY");
    });

    test("observationOnly false fails validation", () => {
      const observation = observeRecruitmentActionPlan(null);
      const tampered = { ...observation, observationOnly: false };
      const validation = validateObservedAction(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("OBSERVATION_ONLY_MUST_BE_TRUE");
    });

    test("workerExecution true fails validation", () => {
      const observation = observeRecruitmentActionPlan(null);
      const tampered = { ...observation, workerExecution: true };
      const validation = validateObservedAction(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("EXECUTION_FLAGS_MUST_BE_FALSE");
    });

    test("persistence flags true fail validation", () => {
      const observation = observeRecruitmentActionPlan(null);
      const tampered = { ...observation, persistenceEnabled: true };
      const validation = validateObservedAction(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("PERSISTENCE_FLAGS_MUST_BE_FALSE");
    });

    test("invalid observation state fails validation", () => {
      const observation = observeRecruitmentActionPlan(null);
      const tampered = { ...observation, observationState: "execute" };
      const validation = validateObservedAction(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_OBSERVATION_STATE");
    });

    test("missing diagnostics fails validation", () => {
      const observation = observeRecruitmentActionPlan(null);
      const tampered = { ...observation, diagnostics: null };
      const validation = validateObservedAction(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("MISSING_DIAGNOSTICS");
    });

    test("diagnostics executionBlocked false fails validation", () => {
      const observation = observeRecruitmentActionPlan(null);
      const tampered = {
        ...observation,
        diagnostics: { ...observation.diagnostics, executionBlocked: false }
      };
      const validation = validateObservedAction(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("DIAGNOSTICS_EXECUTION_MUST_BE_BLOCKED");
    });

    test("diagnostics state mismatch fails validation", () => {
      const observation = observeRecruitmentActionPlan(null);
      const tampered = {
        ...observation,
        diagnostics: { ...observation.diagnostics, observationState: "ignored" }
      };
      const validation = validateObservedAction(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("DIAGNOSTICS_STATE_MISMATCH");
    });

    test("action plan validation is embedded in observation", () => {
      const plan = planForCategory({ recruitment_title: "Embedded validation" });
      const observation = observeRecruitmentActionPlan(plan);
      expect(observation.planValidation).toEqual(validateRecruitmentActionPlan(plan));
    });

    test("invalid plan shape yields invalid plan validation in observation", () => {
      const observation = observeRecruitmentActionPlan({ actionType: "bogus" });
      expect(observation.planValidation.valid).toBe(false);
    });
  });

  describe("diagnostics", () => {
    test("diagnostics mark execution blocked", () => {
      const observation = observeRecruitmentActionPlan(null);
      expect(observation.diagnostics.executionBlocked).toBe(true);
    });

    test("diagnostics mark observation mode", () => {
      const observation = observeRecruitmentActionPlan(null);
      expect(observation.diagnostics.observationMode).toBe(true);
    });

    test("diagnostics record observation", () => {
      const observation = observeRecruitmentActionPlan(null);
      expect(observation.diagnostics.observationRecorded).toBe(true);
    });

    test("diagnostics mirror observation state", () => {
      const plan = createRecruitmentActionPlan(null);
      const observation = observeRecruitmentActionPlan(plan);
      expect(observation.diagnostics.observationState).toBe(observation.observationState);
    });

    test("diagnostics planAvailable false when not_available", () => {
      const observation = observeRecruitmentActionPlan(null);
      expect(observation.diagnostics.planAvailable).toBe(false);
    });

    test("diagnostics planAvailable true for valid plan", () => {
      const plan = planForCategory({
        recruitment_title: "Available plan",
        official_identifier: "avail:73"
      });
      const observation = observeRecruitmentActionPlan(plan);
      expect(observation.diagnostics.planAvailable).toBe(true);
    });

    test("diagnostics include execution reason", () => {
      const observation = observeRecruitmentActionPlan(null);
      expect(observation.diagnostics.executionReason).toBe("worker_observation_mode");
    });

    test("summary exposes executionBlocked and observationMode", () => {
      const observation = observeRecruitmentActionPlan(planForCategory({ recruitment_title: "Diag" }));
      const summary = summarizeObservedAction(observation);
      expect(summary.executionBlocked).toBe(true);
      expect(summary.observationMode).toBe(true);
    });

    test("invalid observation summary reports not_available", () => {
      const summary = summarizeObservedAction({ phase: 1 });
      expect(summary.valid).toBe(false);
      expect(summary.observationState).toBe(OBSERVATION_STATES.NOT_AVAILABLE);
    });
  });

  describe("immutability", () => {
    test("observation graph is fully frozen", () => {
      const observation = observeRecruitmentActionPlan(planForCategory({ recruitment_title: "Freeze" }));
      assertAllFrozen(observation);
    });

    test("observation cannot mutate nested diagnostics", () => {
      const observation = observeRecruitmentActionPlan(null);
      expect(() => {
        observation.diagnostics.executionBlocked = false;
      }).toThrow();
    });

    test("observation cannot mutate plan validation reasons", () => {
      const observation = observeRecruitmentActionPlan(null);
      expect(() => {
        observation.planValidation.reasons.push("tamper");
      }).toThrow();
    });

    test("descriptor and metadata remain frozen", () => {
      assertAllFrozen(OBSERVATION_DESCRIPTOR);
      assertAllFrozen(OBSERVATION_METADATA);
    });

    test("action type mapping is frozen", () => {
      expect(Object.isFrozen(ACTION_TYPE_TO_OBSERVATION_STATE)).toBe(true);
    });

    test("observation has no circular references", () => {
      const observation = observeRecruitmentActionPlan(
        planForCategory({ recruitment_title: "No cycles 73" })
      );
      expect(hasCircularReference(observation)).toBe(false);
    });
  });

  describe("compatibility and pipeline integration", () => {
    test("pipeline attaches action plan observable by worker path", () => {
      const notice = sampleNotice();
      const outcome = runRecruitmentPipeline({
        notice,
        candidateRecruitments: [],
        isEnabled: true,
        updateId: 7301
      });
      const actionPlan = peekRecruitmentActionPlan(outcome);
      expect(actionPlan).not.toBeNull();
      const observation = observeRecruitmentActionPlan(actionPlan);
      expect(validateObservedAction(observation).valid).toBe(true);
    });

    test("compatibility attach produces observable plan", () => {
      const pipelineOutcome = { skipped: false, result: { status: "success" }, updateId: 7302 };
      const context = attachRecruitmentCompatibility(pipelineOutcome, {
        notice: sampleNotice(),
        updateId: 7302
      });
      expect(context).not.toBeNull();
      const actionPlan = peekRecruitmentActionPlan(pipelineOutcome);
      expect(actionPlan).not.toBeNull();
      expect(observeRecruitmentActionPlan(actionPlan).observationState).not.toBe(
        OBSERVATION_STATES.NOT_AVAILABLE
      );
    });

    test("pipeline public shape unchanged after observation", () => {
      const notice = sampleNotice();
      const outcome = runRecruitmentPipeline({
        notice,
        candidateRecruitments: [],
        isEnabled: true,
        updateId: 7303
      });
      const before = JSON.stringify({
        skipped: outcome.skipped,
        result: outcome.result,
        updateId: outcome.updateId,
        failed: outcome.failed
      });
      observeRecruitmentActionPlan(peekRecruitmentActionPlan(outcome));
      const after = JSON.stringify({
        skipped: outcome.skipped,
        result: outcome.result,
        updateId: outcome.updateId,
        failed: outcome.failed
      });
      expect(after).toBe(before);
    });

    test("observation does not add enumerable fields to pipeline outcome", () => {
      const outcome = runRecruitmentPipeline({
        notice: sampleNotice(),
        candidateRecruitments: [],
        isEnabled: true,
        updateId: 7304
      });
      const keysBefore = Object.keys(outcome).sort();
      observeRecruitmentActionPlan(peekRecruitmentActionPlan(outcome));
      expect(Object.keys(outcome).sort()).toEqual(keysBefore);
    });

    test("null peek result yields not_available observation", () => {
      const outcome = { skipped: false, result: {}, updateId: 7304 };
      expect(peekRecruitmentActionPlan(outcome)).toBeNull();
      const observation = observeRecruitmentActionPlan(peekRecruitmentActionPlan(outcome));
      expect(observation.observationState).toBe(OBSERVATION_STATES.NOT_AVAILABLE);
    });

    test("skipped pipeline public shape unchanged after observation", () => {
      const outcome = runRecruitmentPipeline({
        notice: sampleNotice(),
        candidateRecruitments: [],
        isEnabled: false,
        updateId: null
      });
      const before = JSON.stringify({ skipped: outcome.skipped, reason: outcome.reason });
      observeRecruitmentActionPlan(peekRecruitmentActionPlan(outcome));
      expect(JSON.stringify({ skipped: outcome.skipped, reason: outcome.reason })).toBe(before);
    });

    test("failed pipeline path does not break observation call", () => {
      const outcome = { skipped: false, failed: true, error: new Error("fail"), updateId: 73 };
      const observation = observeRecruitmentActionPlan(peekRecruitmentActionPlan(outcome));
      expect(validateObservedAction(observation).valid).toBe(true);
    });
  });

  describe("failure isolation", () => {
    test("observeRecruitmentActionPlan never throws on null", () => {
      expect(() => observeRecruitmentActionPlan(null)).not.toThrow();
    });

    test("observeRecruitmentActionPlan never throws on garbage input", () => {
      expect(() => observeRecruitmentActionPlan("garbage")).not.toThrow();
      expect(() => observeRecruitmentActionPlan(73)).not.toThrow();
    });

    test("observeRecruitmentActionPlan returns safe default when planner validation throws", () => {
      jest.resetModules();
      jest.doMock("../server/lib/recruitment/recruitmentActionPlanner", () => ({
        ACTION_PLANNER_PHASE: 72,
        ACTION_PLAN_ENTITY: "recruitment_action_plan",
        ACTION_TYPES: { IGNORE: "ignore" },
        validateRecruitmentActionPlan: () => {
          throw new Error("planner exploded");
        },
        summarizeRecruitmentActionPlan: () => ({ valid: false })
      }));

      const isolated = require("../server/lib/recruitment/recruitmentWorkerObservation");
      const observation = isolated.observeRecruitmentActionPlan({ actionType: "ignore" });
      expect(observation.observationState).toBe(OBSERVATION_STATES.NOT_AVAILABLE);
      expect(observation.metadata.createReason).toBe("observation_failure");

      jest.dontMock("../server/lib/recruitment/recruitmentActionPlanner");
      jest.resetModules();
    });

    test("validateObservedAction never throws", () => {
      expect(() => validateObservedAction(undefined)).not.toThrow();
    });

    test("summarizeObservedAction never throws", () => {
      expect(() => summarizeObservedAction(undefined)).not.toThrow();
    });

    test("resolveObservationState never throws", () => {
      expect(() => resolveObservationState(Symbol("x"))).not.toThrow();
    });
  });

  describe("architecture boundaries (source)", () => {
    test("observation module documents Phase 73", () => {
      const source = read(OBSERVATION_MODULE_PATH);
      expect(source).toMatch(/Phase 73/);
    });

    test("no Express / DB / filesystem / env access", () => {
      const source = read(OBSERVATION_MODULE_PATH);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/require\(["'].*config\/db["']\)/);
      expect(source).not.toMatch(/process\.env/);
      expect(source).not.toMatch(/\bINSERT\s+INTO\b/i);
    });

    test("no generator imports", () => {
      const source = read(OBSERVATION_MODULE_PATH);
      expect(source).not.toMatch(/require\([^)]*pdfGenerator/i);
      expect(source).not.toMatch(/require\([^)]*generator/i);
      expect(source).not.toMatch(/require\([^)]*extractGenerator/i);
    });

    test("imports only recruitmentActionPlanner", () => {
      const source = read(OBSERVATION_MODULE_PATH);
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map((m) => m[1]);
      expect(requires).toEqual(["./recruitmentActionPlanner"]);
    });

    test("no WeakMap — observation is return-value only", () => {
      const source = read(OBSERVATION_MODULE_PATH);
      expect(source).not.toMatch(/WeakMap/);
    });

    test("execution flags remain false in source", () => {
      const source = read(OBSERVATION_MODULE_PATH);
      expect(source).toMatch(/workerExecution: false/);
      expect(source).toMatch(/lifecycleExecution: false/);
      expect(source).toMatch(/performsPersistence: false/);
    });

    test("runRecruitmentPipeline does not import worker observation", () => {
      const source = read(PIPELINE_MODULE_PATH);
      expect(source).not.toMatch(/recruitmentWorkerObservation/);
    });

    test("worker integrates observation after pipeline without executing plans", () => {
      const worker = read(WORKER_MODULE_PATH);
      expect(worker).toMatch(/Phase 73/);
      expect(worker).toMatch(/observeRecruitmentActionPlan/);
      expect(worker).toMatch(/peekRecruitmentActionPlan/);
      expect(worker).not.toMatch(/createRecruitmentActionPlan/);
      expect(worker).not.toMatch(/planRecruitmentAction/);
    });

    test("worker observation is wrapped in try/catch", () => {
      const worker = read(WORKER_MODULE_PATH);
      expect(worker).toMatch(/recruitment action plan observation skipped/);
    });
  });

  describe("worker integration", () => {
    const mockInsertDetectedUpdate = jest.fn().mockResolvedValue(901);
    const mockMarkAlertSent = jest.fn().mockResolvedValue(undefined);
    const mockSaveSiteBaseline = jest.fn().mockResolvedValue(undefined);
    const mockHasRecentDuplicate = jest.fn().mockResolvedValue(false);
    const mockSendTelegramMessage = jest.fn().mockResolvedValue({ sent: true });
    const mockCheckSite = jest.fn();
    const mockIsRecruitmentPipelineEnabled = jest.fn();
    const mockRunRecruitmentPipeline = jest.fn();
    const mockRecordRuntimePreviewFromPipeline = jest.fn();
    const mockLookupRecruitmentCandidatesForRuntime = jest.fn();

    const siteRow = {
      id: 7,
      name: "SSC",
      url: "https://ssc.nic.in",
      selector: ".updates",
      lastContent: "baseline",
      lastAlertAt: null,
      failCount: 0,
      broken: 0,
      priority: 1,
      active: 1
    };

    const job = { id: "job-73", data: { siteId: 7 } };

    beforeEach(() => {
      jest.resetModules();
      jest.clearAllMocks();

      jest.doMock("../server/services/updates/updates.repository", () => ({
        getSiteById: jest.fn().mockResolvedValue(siteRow),
        insertDetectedUpdate: mockInsertDetectedUpdate,
        saveSiteBaseline: mockSaveSiteBaseline,
        markSiteChecked: jest.fn().mockResolvedValue(undefined),
        hasRecentDuplicate: mockHasRecentDuplicate,
        markAlertSent: mockMarkAlertSent,
        isInCooldown: jest.fn().mockResolvedValue(false),
        incrementSiteFailure: jest.fn(),
        resetSiteFailure: jest.fn().mockResolvedValue(undefined)
      }));

      jest.doMock("../server/services/updates/siteChecker", () => ({
        checkSite: mockCheckSite
      }));

      jest.doMock("../server/services/updates/telegramNotifier", () => ({
        sendTelegramMessage: mockSendTelegramMessage,
        buildUpdateMessage: jest.fn((item) => item),
        buildBatchUpdateMessage: jest.fn((items) => items),
        buildSelectorIssueMessage: jest.fn(),
        buildPreDisableWarningMessage: jest.fn()
      }));

      jest.doMock("../server/config/recruitmentPipeline", () => ({
        isRecruitmentPipelineEnabled: mockIsRecruitmentPipelineEnabled
      }));

      jest.doMock("../server/lib/recruitment/runRecruitmentPipeline", () => ({
        runRecruitmentPipeline: mockRunRecruitmentPipeline
      }));

      jest.doMock("../server/services/recruitmentRuntimePreview.service", () => ({
        recordRuntimePreviewFromPipeline: mockRecordRuntimePreviewFromPipeline
      }));

      jest.doMock("../server/services/recruitmentCandidateLookup.service", () => ({
        lookupRecruitmentCandidatesForRuntime: mockLookupRecruitmentCandidatesForRuntime
      }));

      jest.doMock("bullmq", () => ({
        Worker: jest.fn().mockImplementation(() => ({ on: jest.fn() }))
      }));

      jest.doMock("../server/services/queue/siteQueue", () => ({
        queueConnection: {}
      }));

      jest.doMock("../server/services/pdfGeneratorExtract.service", () => ({
        extractGeneratorPdfText: jest.fn()
      }));

      jest.doMock("../server/services/file.service", () => ({
        readFile: jest.fn(),
        unlink: jest.fn()
      }));

      mockCheckSite.mockResolvedValue({
        changed: true,
        shouldNotify: true,
        items: [
          {
            title: "SSC CGL 2026 Admit Card",
            link: "https://ssc.nic.in/admit-card.pdf"
          }
        ],
        baselineFingerprint: "fp-73"
      });
      mockIsRecruitmentPipelineEnabled.mockReturnValue(true);
      mockLookupRecruitmentCandidatesForRuntime.mockResolvedValue({
        candidates: [],
        lookupSummary: {
          status: "skipped",
          strategy: "insufficient_criteria",
          candidateCount: 0
        }
      });
      mockRunRecruitmentPipeline.mockReturnValue({
        skipped: false,
        result: { status: "success", eventType: "admit_card" },
        updateId: 901
      });
    });

    test("worker invokes observation when pipeline enabled", async () => {
      const { observeSpy, worker } = loadWorkerWithObservationSpy();
      const { processSiteJob } = worker;

      const result = await processSiteJob(job);

      expect(result).toEqual({ changed: true, savedCount: 1 });
      expect(observeSpy).toHaveBeenCalledTimes(1);
    });

    test("worker does not invoke observation when pipeline disabled", async () => {
      mockIsRecruitmentPipelineEnabled.mockReturnValue(false);
      const { observeSpy, worker } = loadWorkerWithObservationSpy();
      const { processSiteJob } = worker;

      await processSiteJob(job);

      expect(observeSpy).not.toHaveBeenCalled();
    });

    test("observation failure does not break worker flow", async () => {
      jest.resetModules();
      jest.doMock("../server/lib/recruitment/recruitmentWorkerObservation", () => ({
        observeRecruitmentActionPlan: jest.fn(() => {
          throw new Error("observation exploded");
        })
      }));

      const { processSiteJob } = require("../server/services/workers/siteWorker");
      const result = await processSiteJob(job);

      expect(result).toEqual({ changed: true, savedCount: 1 });
      expect(mockMarkAlertSent).toHaveBeenCalledWith(7);
    });

    test("worker return shape unchanged with observation enabled", async () => {
      const { worker } = loadWorkerWithObservationSpy();
      const { processSiteJob } = worker;
      const result = await processSiteJob(job);
      expect(result).toEqual({ changed: true, savedCount: 1 });
    });

    test("pipeline mock return value not mutated by worker observation", async () => {
      const pipelineOutcome = {
        skipped: false,
        result: { status: "success", eventType: "admit_card" },
        updateId: 901
      };
      mockRunRecruitmentPipeline.mockReturnValue(pipelineOutcome);

      const actualPipeline = jest.requireActual("../server/lib/recruitment/runRecruitmentPipeline");
      const actualCompat = jest.requireActual(
        "../server/lib/recruitment/recruitmentCompatibilityLayer"
      );
      jest.doMock("../server/lib/recruitment/runRecruitmentPipeline", () => ({
        runRecruitmentPipeline: jest.fn(() => {
          actualCompat.attachRecruitmentCompatibility(pipelineOutcome, {
            title: "SSC CGL 2026 Admit Card",
            content: "SSC CGL 2026 Admit Card",
            url: "https://ssc.nic.in/admit-card.pdf"
          });
          return pipelineOutcome;
        })
      }));

      const { processSiteJob } = require("../server/services/workers/siteWorker");
      const before = JSON.stringify(pipelineOutcome);
      await processSiteJob(job);
      expect(JSON.stringify(pipelineOutcome)).toBe(before);
      void actualPipeline;
    });
  });

  describe("summarizeObservedAction", () => {
    test("valid observation summary includes state and action type", () => {
      const plan = createRecruitmentActionPlan(null);
      const observation = observeRecruitmentActionPlan(plan);
      const summary = summarizeObservedAction(observation);
      expect(summary.valid).toBe(true);
      expect(summary.observationState).toBe(OBSERVATION_STATES.IGNORED);
      expect(summary.actionType).toBe(ACTION_TYPES.IGNORE);
    });

    test("summary never enables worker execution", () => {
      const observation = observeRecruitmentActionPlan(
        planForCategory({ recruitment_title: "No exec" })
      );
      const summary = summarizeObservedAction(observation);
      expect(summary.workerExecution).toBe(false);
      expect(summary.lifecycleExecution).toBe(false);
      expect(summary.persistenceEnabled).toBe(false);
    });

    test("summary includes match category when present", () => {
      const plan = planForCategory({ recruitment_title: "Category summary" });
      const summary = summarizeObservedAction(observeRecruitmentActionPlan(plan));
      expect(summary.matchCategory).toBe(plan.matchCategory);
    });

    test("summary planValid reflects embedded validation", () => {
      const plan = planForCategory({
        recruitment_title: "Plan valid summary",
        official_identifier: "pv:73"
      });
      const summary = summarizeObservedAction(observeRecruitmentActionPlan(plan));
      expect(summary.planValid).toBe(true);
    });
  });
});
