"use strict";

/**
 * Phase 81 — Recruitment Lifecycle State Evaluator tests.
 * Evaluation rules, immutability, determinism, invalid input, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_LIFECYCLE_STATE_EVALUATOR_PHASE,
  RECRUITMENT_LIFECYCLE_STATE_EVALUATION_ENTITY,
  COMMON_LIFECYCLE_EVENT_TYPES,
  SUPPORTED_COMMON_LIFECYCLE_EVENT_TYPES,
  LIFECYCLE_STATE_ORDERS,
  SUPPORTED_LIFECYCLE_STATES,
  CONFIDENCE_LEVELS,
  LIFECYCLE_STATE_EVALUATION_RULE_IDS,
  LIFECYCLE_STATE_EVALUATION_RULES,
  RECRUITMENT_LIFECYCLE_STATE_EVALUATION_DESCRIPTOR,
  RECRUITMENT_LIFECYCLE_STATE_EVALUATION_METADATA,
  EMPTY_RECRUITMENT_LIFECYCLE_STATE_EVALUATION,
  isCommonLifecycleEventType,
  isValidLifecycleState,
  isRecruitmentTimelineProjection,
  hasTimelineEventType,
  hasLifecycleCompletionIndicators,
  evaluateRecruitmentLifecycleState,
  isRecruitmentLifecycleStateEvaluation,
  validateRecruitmentLifecycleStateEvaluation,
  summarizeRecruitmentLifecycleStateEvaluation
} = require("../server/lib/recruitment/recruitmentLifecycleStateEvaluator");

const { createRecruitmentTimelineProjection } = require("../server/lib/recruitment/recruitmentTimelineProjection");
const { resolveRecruitmentAggregate } = require("../server/lib/recruitment/recruitmentAggregateResolver");
const { RECRUITMENT_LIFECYCLE_STATES } = require("../server/lib/recruitment/recruitmentLifecycleStateDescriptor");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentLifecycleStateEvaluator.js";
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

function sampleEvent(overrides = {}) {
  return {
    id: 1,
    recruitment_id: 42,
    event_type: "notification",
    sequence_order: 10,
    status: "active",
    ...overrides
  };
}

function buildProjection(events) {
  return createRecruitmentTimelineProjection(resolveRecruitmentAggregate(events));
}

function buildCompleteLifecycleEvents() {
  return [
    sampleEvent({ id: 1, event_type: "short_notification", sequence_order: 5 }),
    sampleEvent({ id: 2, event_type: "notification", sequence_order: 10 }),
    sampleEvent({ id: 3, event_type: "application_start", sequence_order: 15 }),
    sampleEvent({ id: 4, event_type: "application_end", sequence_order: 20 }),
    sampleEvent({ id: 5, event_type: "correction", sequence_order: 25 }),
    sampleEvent({ id: 6, event_type: "admit_card", sequence_order: 30 }),
    sampleEvent({ id: 7, event_type: "exam", sequence_order: 40 }),
    sampleEvent({ id: 8, event_type: "answer_key", sequence_order: 50 }),
    sampleEvent({ id: 9, event_type: "result", sequence_order: 60 }),
    sampleEvent({ id: 10, event_type: "final_result", sequence_order: 70 }),
    sampleEvent({ id: 11, event_type: "joining", sequence_order: 80 })
  ];
}

function evaluateEvents(events) {
  return evaluateRecruitmentLifecycleState(buildProjection(events));
}

describe("Phase 81 — recruitmentLifecycleStateEvaluator", () => {
  describe("exports", () => {
    test("exposes phase 81 constants and descriptor", () => {
      expect(RECRUITMENT_LIFECYCLE_STATE_EVALUATOR_PHASE).toBe(81);
      expect(RECRUITMENT_LIFECYCLE_STATE_EVALUATION_ENTITY).toBe(
        "recruitment_lifecycle_state_evaluation"
      );
      expect(RECRUITMENT_LIFECYCLE_STATE_EVALUATION_DESCRIPTOR.entity).toBe(
        "recruitment_lifecycle_state_evaluation"
      );
      expect(RECRUITMENT_LIFECYCLE_STATE_EVALUATION_DESCRIPTOR.phase).toBe(81);
      expect(RECRUITMENT_LIFECYCLE_STATE_EVALUATION_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_LIFECYCLE_STATE_EVALUATION_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_LIFECYCLE_STATE_EVALUATION_METADATA.performsStateTransitions).toBe(false);
      expect(RECRUITMENT_LIFECYCLE_STATE_EVALUATION_METADATA.infersStateFromEvents).toBe(true);
    });

    test("exports descriptive evaluation rules aligned with lifecycle vocabulary", () => {
      expect(LIFECYCLE_STATE_EVALUATION_RULES).toHaveLength(10);
      expect(LIFECYCLE_STATE_EVALUATION_RULE_IDS.COMPLETED).toBe("COMPLETED");
      expect(SUPPORTED_LIFECYCLE_STATES.has("JOINING_STAGE")).toBe(true);
      expect(SUPPORTED_COMMON_LIFECYCLE_EVENT_TYPES.has("notification")).toBe(true);
      expect(COMMON_LIFECYCLE_EVENT_TYPES).toEqual([
        "short_notification",
        "notification",
        "application_start",
        "application_end",
        "correction",
        "admit_card",
        "exam",
        "answer_key",
        "result",
        "final_result",
        "joining"
      ]);
    });

    test("exports helper functions", () => {
      expect(typeof evaluateRecruitmentLifecycleState).toBe("function");
      expect(typeof hasTimelineEventType).toBe("function");
      expect(typeof hasLifecycleCompletionIndicators).toBe("function");
      expect(typeof isRecruitmentLifecycleStateEvaluation).toBe("function");
      expect(typeof validateRecruitmentLifecycleStateEvaluation).toBe("function");
      expect(typeof summarizeRecruitmentLifecycleStateEvaluation).toBe("function");
    });
  });

  describe("lifecycle state evaluation", () => {
    test("empty timeline suggests DISCOVERED", () => {
      const projection = buildProjection([]);
      const evaluation = evaluateRecruitmentLifecycleState(projection);

      expect(evaluation.suggestedState).toBe("DISCOVERED");
      expect(evaluation.matchedRules.map((rule) => rule.id)).toEqual([
        LIFECYCLE_STATE_EVALUATION_RULE_IDS.NO_TIMELINE_EVENTS
      ]);
      expect(evaluation.evaluatedEventTypes).toEqual([]);
      expect(evaluation.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
      expect(evaluation.recruitmentId).toBeNull();
    });

    test("notification only suggests NOTIFICATION_AVAILABLE", () => {
      const evaluation = evaluateEvents([sampleEvent({ event_type: "notification" })]);

      expect(evaluation.suggestedState).toBe("NOTIFICATION_AVAILABLE");
      expect(evaluation.matchedRules.map((rule) => rule.suggestedState)).toContain(
        "NOTIFICATION_AVAILABLE"
      );
      expect(evaluation.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });

    test("short notification only suggests NOTIFICATION_AVAILABLE", () => {
      const evaluation = evaluateEvents([
        sampleEvent({ event_type: "short_notification", sequence_order: 5 })
      ]);

      expect(evaluation.suggestedState).toBe("NOTIFICATION_AVAILABLE");
      expect(evaluation.matchedRules.map((rule) => rule.id)).toContain(
        LIFECYCLE_STATE_EVALUATION_RULE_IDS.NOTIFICATION_AVAILABLE
      );
    });

    test("application start without application end suggests APPLICATION_OPEN", () => {
      const evaluation = evaluateEvents([
        sampleEvent({ id: 1, event_type: "notification", sequence_order: 10 }),
        sampleEvent({ id: 2, event_type: "application_start", sequence_order: 20 })
      ]);

      expect(evaluation.suggestedState).toBe("APPLICATION_OPEN");
      expect(evaluation.matchedRules.map((rule) => rule.id)).toContain(
        LIFECYCLE_STATE_EVALUATION_RULE_IDS.APPLICATION_OPEN
      );
      expect(evaluation.matchedRules.map((rule) => rule.id)).toContain(
        LIFECYCLE_STATE_EVALUATION_RULE_IDS.NOTIFICATION_AVAILABLE
      );
      expect(evaluation.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
    });

    test("application end with correction suggests CORRECTION_WINDOW", () => {
      const evaluation = evaluateEvents([
        sampleEvent({ id: 1, event_type: "application_end", sequence_order: 20 }),
        sampleEvent({ id: 2, event_type: "correction", sequence_order: 25 })
      ]);

      expect(evaluation.suggestedState).toBe("CORRECTION_WINDOW");
      expect(evaluation.matchedRules.map((rule) => rule.id)).toContain(
        LIFECYCLE_STATE_EVALUATION_RULE_IDS.CORRECTION_WINDOW
      );
    });

    test("admit card suggests EXAM_STAGE", () => {
      const evaluation = evaluateEvents([
        sampleEvent({ id: 1, event_type: "admit_card", sequence_order: 30 })
      ]);

      expect(evaluation.suggestedState).toBe("EXAM_STAGE");
      expect(evaluation.matchedRules.map((rule) => rule.id)).toContain(
        LIFECYCLE_STATE_EVALUATION_RULE_IDS.EXAM_STAGE
      );
    });

    test("exam suggests EXAM_STAGE", () => {
      const evaluation = evaluateEvents([
        sampleEvent({ id: 1, event_type: "exam", sequence_order: 40 })
      ]);

      expect(evaluation.suggestedState).toBe("EXAM_STAGE");
    });

    test("answer key suggests ANSWER_KEY_STAGE", () => {
      const evaluation = evaluateEvents([
        sampleEvent({ id: 1, event_type: "answer_key", sequence_order: 50 })
      ]);

      expect(evaluation.suggestedState).toBe("ANSWER_KEY_STAGE");
      expect(evaluation.matchedRules.map((rule) => rule.id)).toContain(
        LIFECYCLE_STATE_EVALUATION_RULE_IDS.ANSWER_KEY_STAGE
      );
    });

    test("result without final result suggests RESULT_STAGE", () => {
      const evaluation = evaluateEvents([
        sampleEvent({ id: 1, event_type: "result", sequence_order: 60 })
      ]);

      expect(evaluation.suggestedState).toBe("RESULT_STAGE");
      expect(evaluation.matchedRules.map((rule) => rule.id)).toContain(
        LIFECYCLE_STATE_EVALUATION_RULE_IDS.RESULT_STAGE
      );
    });

    test("final result without joining suggests FINAL_RESULT_STAGE", () => {
      const evaluation = evaluateEvents([
        sampleEvent({ id: 1, event_type: "final_result", sequence_order: 70 })
      ]);

      expect(evaluation.suggestedState).toBe("FINAL_RESULT_STAGE");
      expect(evaluation.matchedRules.map((rule) => rule.id)).toContain(
        LIFECYCLE_STATE_EVALUATION_RULE_IDS.FINAL_RESULT_STAGE
      );
    });

    test("joining alone suggests JOINING_STAGE", () => {
      const evaluation = evaluateEvents([
        sampleEvent({ id: 1, event_type: "joining", sequence_order: 80 })
      ]);

      expect(evaluation.suggestedState).toBe("JOINING_STAGE");
      expect(evaluation.matchedRules.map((rule) => rule.id)).toContain(
        LIFECYCLE_STATE_EVALUATION_RULE_IDS.JOINING_STAGE
      );
      expect(evaluation.matchedRules.map((rule) => rule.id)).not.toContain(
        LIFECYCLE_STATE_EVALUATION_RULE_IDS.COMPLETED
      );
      expect(hasLifecycleCompletionIndicators(buildProjection([sampleEvent({ event_type: "joining" })]))).toBe(
        false
      );
    });

    test("completed lifecycle suggests COMPLETED", () => {
      const evaluation = evaluateEvents(buildCompleteLifecycleEvents());

      expect(evaluation.suggestedState).toBe("COMPLETED");
      expect(evaluation.matchedRules.map((rule) => rule.id)).toContain(
        LIFECYCLE_STATE_EVALUATION_RULE_IDS.COMPLETED
      );
      expect(evaluation.matchedRules.map((rule) => rule.id)).toContain(
        LIFECYCLE_STATE_EVALUATION_RULE_IDS.JOINING_STAGE
      );
      expect(evaluation.evaluationMetadata.hasCompletionIndicators).toBe(true);
      expect(evaluation.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
    });

    test("accepts wrapped input with lifecycle state descriptors", () => {
      const projection = buildProjection([sampleEvent({ event_type: "notification" })]);
      const evaluation = evaluateRecruitmentLifecycleState({
        timelineProjection: projection,
        lifecycleStateDescriptors: RECRUITMENT_LIFECYCLE_STATES
      });

      expect(evaluation.suggestedState).toBe("NOTIFICATION_AVAILABLE");
      expect(isRecruitmentLifecycleStateEvaluation(evaluation)).toBe(true);
    });

    test("selects highest-order matched rule as suggested state", () => {
      const evaluation = evaluateEvents([
        sampleEvent({ id: 1, event_type: "notification", sequence_order: 10 }),
        sampleEvent({ id: 2, event_type: "answer_key", sequence_order: 50 })
      ]);

      expect(evaluation.suggestedState).toBe("ANSWER_KEY_STAGE");
      expect(LIFECYCLE_STATE_ORDERS[evaluation.suggestedState]).toBeGreaterThan(
        LIFECYCLE_STATE_ORDERS.NOTIFICATION_AVAILABLE
      );
    });
  });

  describe("unknown events", () => {
    test("records unknown event types and lowers confidence", () => {
      const evaluation = evaluateEvents([
        sampleEvent({ id: 1, event_type: "custom_milestone", sequence_order: 10 })
      ]);

      expect(evaluation.evaluationMetadata.unknownEventTypes).toEqual(["custom_milestone"]);
      expect(evaluation.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
      expect(evaluation.suggestedState).toBe("DISCOVERED");
    });

    test("records missing event type entries as unknown", () => {
      const projection = buildProjection([
        { id: 1, recruitment_id: 42, sequence_order: 10 }
      ]);
      const evaluation = evaluateRecruitmentLifecycleState(projection);

      expect(evaluation.evaluationMetadata.unknownEventTypes).toEqual([null]);
      expect(evaluation.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
    });
  });

  describe("helper functions", () => {
    test("hasTimelineEventType checks available event types", () => {
      const projection = buildProjection([sampleEvent({ event_type: "notification" })]);

      expect(hasTimelineEventType(projection, "notification")).toBe(true);
      expect(hasTimelineEventType(projection, "exam")).toBe(false);
      expect(isCommonLifecycleEventType("notification")).toBe(true);
      expect(isValidLifecycleState("EXAM_STAGE")).toBe(true);
      expect(isRecruitmentTimelineProjection(projection)).toBe(true);
    });

    test("validate and summarize evaluation helpers", () => {
      const evaluation = evaluateEvents([sampleEvent({ event_type: "notification" })]);
      const validation = validateRecruitmentLifecycleStateEvaluation(evaluation);
      const summary = summarizeRecruitmentLifecycleStateEvaluation(evaluation);

      expect(validation.valid).toBe(true);
      expect(validation.reasons).toEqual([]);
      expect(summary.valid).toBe(true);
      expect(summary.phase).toBe(81);
      expect(summary.suggestedState).toBe("NOTIFICATION_AVAILABLE");
      expect(summary.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
      expect(summary.performsStateTransitions).toBe(false);
    });

    test("summarize invalid evaluation safely", () => {
      const summary = summarizeRecruitmentLifecycleStateEvaluation(null);

      expect(summary.valid).toBe(false);
      expect(summary.suggestedState).toBeNull();
      expect(summary.confidence).toBe(CONFIDENCE_LEVELS.UNKNOWN);
    });
  });

  describe("immutability", () => {
    test("returns frozen evaluation objects", () => {
      const evaluation = evaluateEvents([sampleEvent({ event_type: "notification" })]);

      assertAllFrozen(evaluation);
      expect(hasCircularReference(evaluation)).toBe(false);
    });

    test("does not mutate timeline projection input", () => {
      const projection = buildProjection([
        sampleEvent({ id: 1, event_type: "notification", sequence_order: 10 })
      ]);
      const snapshot = {
        recruitmentId: projection.recruitmentId,
        availableEventTypes: projection.availableEventTypes.slice(),
        totalTimelineEvents: projection.totalTimelineEvents
      };

      evaluateRecruitmentLifecycleState(projection);

      expect(projection.recruitmentId).toBe(snapshot.recruitmentId);
      expect(projection.availableEventTypes).toEqual(snapshot.availableEventTypes);
      expect(projection.totalTimelineEvents).toBe(snapshot.totalTimelineEvents);
    });

    test("returned evaluation arrays are frozen against mutation", () => {
      const projection = buildProjection([sampleEvent({ event_type: "notification" })]);
      const evaluation = evaluateRecruitmentLifecycleState(projection);

      expect(Object.isFrozen(evaluation.matchedRules)).toBe(true);
      expect(() => {
        evaluation.matchedRules.push({ id: "bogus" });
      }).toThrow();

      const fresh = evaluateRecruitmentLifecycleState(projection);
      expect(fresh.matchedRules).toHaveLength(1);
      expect(fresh.suggestedState).toBe("NOTIFICATION_AVAILABLE");
    });
  });

  describe("deterministic behavior", () => {
    test("produces identical evaluations for identical projection input", () => {
      const projection = buildProjection([
        sampleEvent({ id: 2, event_type: "result", sequence_order: 60 }),
        sampleEvent({ id: 1, event_type: "notification", sequence_order: 10 })
      ]);

      const first = evaluateRecruitmentLifecycleState(projection);
      const second = evaluateRecruitmentLifecycleState(projection);

      expect(first).toEqual(second);
      expect(first.matchedRules).not.toBe(second.matchedRules);
    });

    test("produces identical evaluations across separate projection instances", () => {
      const buildInput = () =>
        buildProjection([
          sampleEvent({ id: 4, event_type: "answer_key", sequence_order: 50 }),
          sampleEvent({ id: 1, event_type: "notification", sequence_order: 10 })
        ]);

      expect(evaluateRecruitmentLifecycleState(buildInput())).toEqual(
        evaluateRecruitmentLifecycleState(buildInput())
      );
    });
  });

  describe("invalid input handling", () => {
    test("returns empty evaluation for null, undefined, and non-object input", () => {
      expect(evaluateRecruitmentLifecycleState(null)).toBe(
        EMPTY_RECRUITMENT_LIFECYCLE_STATE_EVALUATION
      );
      expect(evaluateRecruitmentLifecycleState(undefined)).toBe(
        EMPTY_RECRUITMENT_LIFECYCLE_STATE_EVALUATION
      );
      expect(evaluateRecruitmentLifecycleState("not-a-projection")).toBe(
        EMPTY_RECRUITMENT_LIFECYCLE_STATE_EVALUATION
      );
    });

    test("returns empty evaluation for malformed projection shapes", () => {
      expect(evaluateRecruitmentLifecycleState({ totalTimelineEvents: 1 })).toBe(
        EMPTY_RECRUITMENT_LIFECYCLE_STATE_EVALUATION
      );
      expect(evaluateRecruitmentLifecycleState({ timelineEvents: [], totalTimelineEvents: 1 })).toBe(
        EMPTY_RECRUITMENT_LIFECYCLE_STATE_EVALUATION
      );
    });

    test("never throws on invalid input", () => {
      expect(() => evaluateRecruitmentLifecycleState(Symbol("x"))).not.toThrow();
      expect(evaluateRecruitmentLifecycleState(Symbol("x")).confidence).toBe(CONFIDENCE_LEVELS.UNKNOWN);
    });

    test("rejects invalid evaluation shapes in validation helper", () => {
      const validation = validateRecruitmentLifecycleStateEvaluation({ confidence: "high" });

      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_EVALUATION_SHAPE");
      expect(isRecruitmentLifecycleStateEvaluation({ confidence: "high" })).toBe(false);
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares read-only pure library constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 81");
      expect(source).toContain("Read-only");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toMatch(/evaluateRecruitmentLifecycleState/);
      expect(source).toContain("not a state machine");
    });

    test("module does not import database, express, or filesystem modules", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2/);
      expect(source).not.toMatch(/require\(["']\.\//);
    });

    test("module is not wired into compatibility layer or pipeline", () => {
      const compatibilitySource = read(COMPATIBILITY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);

      expect(compatibilitySource).not.toMatch(/recruitmentLifecycleStateEvaluator/);
      expect(pipelineSource).not.toMatch(/recruitmentLifecycleStateEvaluator/);
    });

    test("metadata confirms no runtime integration or side effects", () => {
      expect(RECRUITMENT_LIFECYCLE_STATE_EVALUATION_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_LIFECYCLE_STATE_EVALUATION_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_LIFECYCLE_STATE_EVALUATION_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_LIFECYCLE_STATE_EVALUATION_METADATA.performsStateTransitions).toBe(false);
    });
  });
});
