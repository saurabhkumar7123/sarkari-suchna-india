"use strict";

/**
 * Phase 78 — Recruitment Aggregate Resolver tests.
 * Exports, deterministic behavior, immutability, validation, helper behavior,
 * and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_AGGREGATE_RESOLVER_PHASE,
  RECRUITMENT_AGGREGATE_ENTITY,
  PRIMARY_EVENT_TYPES,
  SUPPORTED_PRIMARY_EVENT_TYPES,
  TERMINAL_EVENT_TYPES,
  SUPPORTED_TERMINAL_EVENT_TYPES,
  RECRUITMENT_AGGREGATE_DESCRIPTOR,
  RECRUITMENT_AGGREGATE_METADATA,
  VALIDATION_STATUS,
  EMPTY_RECRUITMENT_AGGREGATE,
  isPrimaryEventType,
  isTerminalEventType,
  resolveRecruitmentAggregate,
  isRecruitmentAggregate,
  validateRecruitmentAggregate,
  summarizeRecruitmentAggregate
} = require("../server/lib/recruitment/recruitmentAggregateResolver");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentAggregateResolver.js";
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

describe("Phase 78 — recruitmentAggregateResolver", () => {
  describe("exports", () => {
    test("exposes phase 78 constants and descriptor", () => {
      expect(RECRUITMENT_AGGREGATE_RESOLVER_PHASE).toBe(78);
      expect(RECRUITMENT_AGGREGATE_ENTITY).toBe("recruitment_aggregate");
      expect(RECRUITMENT_AGGREGATE_DESCRIPTOR.entity).toBe("recruitment_aggregate");
      expect(RECRUITMENT_AGGREGATE_DESCRIPTOR.phase).toBe(78);
      expect(RECRUITMENT_AGGREGATE_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_AGGREGATE_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_AGGREGATE_METADATA.queriesDatabase).toBe(false);
    });

    test("exports primary and terminal event type vocabulary", () => {
      expect(PRIMARY_EVENT_TYPES).toEqual(["notification", "short_notification"]);
      expect(SUPPORTED_PRIMARY_EVENT_TYPES.has("notification")).toBe(true);
      expect(TERMINAL_EVENT_TYPES).toEqual(["final_result", "joining"]);
      expect(SUPPORTED_TERMINAL_EVENT_TYPES.has("joining")).toBe(true);
    });

    test("exports helper functions", () => {
      expect(typeof resolveRecruitmentAggregate).toBe("function");
      expect(typeof isRecruitmentAggregate).toBe("function");
      expect(typeof validateRecruitmentAggregate).toBe("function");
      expect(typeof summarizeRecruitmentAggregate).toBe("function");
      expect(typeof isPrimaryEventType).toBe("function");
      expect(typeof isTerminalEventType).toBe("function");
    });
  });

  describe("empty input", () => {
    test("returns empty aggregate for an empty array", () => {
      const aggregate = resolveRecruitmentAggregate([]);

      expect(aggregate).toBe(EMPTY_RECRUITMENT_AGGREGATE);
      expect(aggregate.recruitmentId).toBeNull();
      expect(aggregate.primaryEvent).toBeNull();
      expect(aggregate.orderedEvents).toEqual([]);
      expect(aggregate.latestEvent).toBeNull();
      expect(aggregate.firstEvent).toBeNull();
      expect(aggregate.eventCount).toBe(0);
      expect(aggregate.eventTypesPresent).toEqual([]);
      expect(aggregate.hasPrimary).toBe(false);
      expect(aggregate.lifecycleStarted).toBe(false);
      expect(aggregate.lifecycleCompleted).toBe(false);
    });

    test("returns empty aggregate for null, undefined, and non-array input", () => {
      expect(resolveRecruitmentAggregate(null)).toBe(EMPTY_RECRUITMENT_AGGREGATE);
      expect(resolveRecruitmentAggregate(undefined)).toBe(EMPTY_RECRUITMENT_AGGREGATE);
      expect(resolveRecruitmentAggregate("not-an-array")).toBe(EMPTY_RECRUITMENT_AGGREGATE);
    });
  });

  describe("one event", () => {
    test("resolves a single primary notification event", () => {
      const event = sampleEvent();
      const aggregate = resolveRecruitmentAggregate([event]);

      expect(aggregate.recruitmentId).toBe(42);
      expect(aggregate.eventCount).toBe(1);
      expect(aggregate.firstEvent).toEqual(event);
      expect(aggregate.latestEvent).toEqual(event);
      expect(aggregate.primaryEvent).toEqual(event);
      expect(aggregate.hasPrimary).toBe(true);
      expect(aggregate.lifecycleStarted).toBe(true);
      expect(aggregate.lifecycleCompleted).toBe(false);
      expect(aggregate.eventTypesPresent).toEqual(["notification"]);
      expect(aggregate.orderedEvents).toHaveLength(1);
    });

    test("resolves a single non-primary event without primary flags", () => {
      const event = sampleEvent({
        id: 5,
        event_type: "admit_card",
        sequence_order: 50
      });
      const aggregate = resolveRecruitmentAggregate([event]);

      expect(aggregate.primaryEvent).toBeNull();
      expect(aggregate.hasPrimary).toBe(false);
      expect(aggregate.lifecycleStarted).toBe(true);
      expect(aggregate.lifecycleCompleted).toBe(false);
      expect(aggregate.eventTypesPresent).toEqual(["admit_card"]);
    });

    test("marks lifecycleCompleted for a single terminal event", () => {
      const event = sampleEvent({
        id: 9,
        event_type: "final_result",
        sequence_order: 90
      });
      const aggregate = resolveRecruitmentAggregate([event]);

      expect(aggregate.lifecycleCompleted).toBe(true);
      expect(isTerminalEventType("final_result")).toBe(true);
    });
  });

  describe("multiple ordered events", () => {
    test("orders events by sequence_order then id", () => {
      const events = [
        sampleEvent({ id: 3, event_type: "admit_card", sequence_order: 50 }),
        sampleEvent({ id: 1, event_type: "notification", sequence_order: 10 }),
        sampleEvent({ id: 2, event_type: "exam_date", sequence_order: 30 })
      ];

      const aggregate = resolveRecruitmentAggregate(events);

      expect(aggregate.orderedEvents.map((event) => event.id)).toEqual([1, 2, 3]);
      expect(aggregate.firstEvent.id).toBe(1);
      expect(aggregate.latestEvent.id).toBe(3);
      expect(aggregate.primaryEvent.id).toBe(1);
      expect(aggregate.eventTypesPresent).toEqual(["notification", "exam_date", "admit_card"]);
    });

    test("uses id as tiebreaker when sequence_order matches", () => {
      const events = [
        sampleEvent({ id: 8, event_type: "result", sequence_order: 70 }),
        sampleEvent({ id: 2, event_type: "notification", sequence_order: 10 }),
        sampleEvent({ id: 5, event_type: "answer_key", sequence_order: 10 })
      ];

      const aggregate = resolveRecruitmentAggregate(events);

      expect(aggregate.orderedEvents.map((event) => event.id)).toEqual([2, 5, 8]);
    });

    test("detects lifecycle completion when a terminal event is present", () => {
      const events = [
        sampleEvent({ id: 1, event_type: "notification", sequence_order: 10 }),
        sampleEvent({ id: 2, event_type: "joining", sequence_order: 95 })
      ];

      const aggregate = resolveRecruitmentAggregate(events);

      expect(aggregate.lifecycleCompleted).toBe(true);
      expect(aggregate.latestEvent.event_type).toBe("joining");
    });
  });

  describe("missing primary", () => {
    test("returns null primaryEvent when no primary types are present", () => {
      const events = [
        sampleEvent({ id: 1, event_type: "exam_date", sequence_order: 20 }),
        sampleEvent({ id: 2, event_type: "admit_card", sequence_order: 40 })
      ];

      const aggregate = resolveRecruitmentAggregate(events);

      expect(aggregate.primaryEvent).toBeNull();
      expect(aggregate.hasPrimary).toBe(false);
      expect(aggregate.lifecycleStarted).toBe(true);
    });
  });

  describe("duplicate event types", () => {
    test("lists each event type once in first-seen order", () => {
      const events = [
        sampleEvent({ id: 1, event_type: "notification", sequence_order: 10 }),
        sampleEvent({ id: 2, event_type: "correction", sequence_order: 15 }),
        sampleEvent({ id: 3, event_type: "notification", sequence_order: 12 }),
        sampleEvent({ id: 4, event_type: "correction", sequence_order: 16 })
      ];

      const aggregate = resolveRecruitmentAggregate(events);

      expect(aggregate.eventCount).toBe(4);
      expect(aggregate.eventTypesPresent).toEqual(["notification", "correction"]);
      expect(aggregate.primaryEvent.id).toBe(1);
    });
  });

  describe("unknown fields", () => {
    test("ignores unknown properties on events", () => {
      const events = [
        {
          ...sampleEvent(),
          unknown_field: "ignored",
          extra_metadata: { nested: true }
        }
      ];

      const aggregate = resolveRecruitmentAggregate(events);

      expect(aggregate.eventCount).toBe(1);
      expect(aggregate.orderedEvents[0].unknown_field).toBe("ignored");
      expect(aggregate.orderedEvents[0].extra_metadata).toEqual({ nested: true });
      expect(validateRecruitmentAggregate(aggregate).valid).toBe(true);
    });

    test("tolerates missing optional fields", () => {
      const events = [{ event_type: "notification" }];
      const aggregate = resolveRecruitmentAggregate(events);

      expect(aggregate.recruitmentId).toBeNull();
      expect(aggregate.hasPrimary).toBe(true);
      expect(aggregate.eventCount).toBe(1);
      expect(aggregate.orderedEvents[0]).toEqual({ event_type: "notification" });
    });
  });

  describe("missing order metadata", () => {
    test("preserves stable input order when no ordering metadata exists", () => {
      const first = { id: 11, recruitment_id: 7, event_type: "result" };
      const second = { id: 12, recruitment_id: 7, event_type: "notification" };
      const third = { id: 13, recruitment_id: 7, event_type: "admit_card" };

      const events = [first, second, third];
      const aggregate = resolveRecruitmentAggregate(events);

      expect(aggregate.orderedEvents).toEqual([first, second, third]);
      expect(aggregate.firstEvent).toEqual(first);
      expect(aggregate.latestEvent).toEqual(third);
      expect(aggregate.primaryEvent).toEqual(second);
      expect(aggregate.firstEvent).not.toBe(first);
    });

    test("does not mutate the input array when preserving order", () => {
      const events = [
        { id: 1, event_type: "notification" },
        { id: 2, event_type: "admit_card" }
      ];
      const snapshot = events.slice();

      resolveRecruitmentAggregate(events);

      expect(events).toEqual(snapshot);
    });
  });

  describe("ordering metadata variants", () => {
    test("accepts camelCase sequenceOrder", () => {
      const events = [
        { id: 2, eventType: "admit_card", sequenceOrder: 40 },
        { id: 1, eventType: "notification", sequenceOrder: 10 }
      ];

      const aggregate = resolveRecruitmentAggregate(events);

      expect(aggregate.orderedEvents.map((event) => event.id)).toEqual([1, 2]);
      expect(aggregate.hasPrimary).toBe(true);
    });

    test("accepts catalog order when sequence order is absent", () => {
      const events = [
        { id: 3, event_type: "result", order: 80 },
        { id: 1, event_type: "notification", order: 10 },
        { id: 2, event_type: "admit_card", order: 50 }
      ];

      const aggregate = resolveRecruitmentAggregate(events);

      expect(aggregate.orderedEvents.map((event) => event.id)).toEqual([1, 2, 3]);
    });

    test("prefers sequence_order over catalog order when both exist", () => {
      const events = [
        { id: 1, event_type: "notification", sequence_order: 30, order: 10 },
        { id: 2, event_type: "admit_card", sequence_order: 10, order: 50 }
      ];

      const aggregate = resolveRecruitmentAggregate(events);

      expect(aggregate.orderedEvents.map((event) => event.id)).toEqual([2, 1]);
    });

    test("treats short_notification as a primary event type", () => {
      const events = [
        { id: 2, event_type: "admit_card", sequence_order: 40 },
        { id: 1, event_type: "short_notification", sequence_order: 10 }
      ];

      const aggregate = resolveRecruitmentAggregate(events);

      expect(aggregate.primaryEvent.id).toBe(1);
      expect(isPrimaryEventType("short_notification")).toBe(true);
    });
  });

  describe("immutable output", () => {
    test("returns a deeply frozen aggregate for non-empty input", () => {
      const aggregate = resolveRecruitmentAggregate([sampleEvent()]);

      assertAllFrozen(aggregate);
      expect(() => {
        aggregate.eventCount = 99;
      }).toThrow();
      expect(() => {
        aggregate.orderedEvents.push({});
      }).toThrow();
      expect(() => {
        aggregate.eventTypesPresent.push("hack");
      }).toThrow();
    });

    test("empty aggregate remains frozen", () => {
      assertAllFrozen(EMPTY_RECRUITMENT_AGGREGATE);
    });

    test("aggregate has no circular references", () => {
      const aggregate = resolveRecruitmentAggregate([
        sampleEvent({ id: 1 }),
        sampleEvent({ id: 2, event_type: "admit_card", sequence_order: 20 })
      ]);

      expect(hasCircularReference(aggregate)).toBe(false);
    });
  });

  describe("input immutability", () => {
    test("does not mutate the input array", () => {
      const events = [
        sampleEvent({ id: 3, sequence_order: 30 }),
        sampleEvent({ id: 1, sequence_order: 10 }),
        sampleEvent({ id: 2, sequence_order: 20 })
      ];
      const before = events.map((event) => ({ ...event }));

      resolveRecruitmentAggregate(events);

      expect(events).toEqual(before);
    });

    test("does not mutate event objects in the input array", () => {
      const event = sampleEvent({ id: 99, sequence_order: 5 });
      const snapshot = { ...event };

      resolveRecruitmentAggregate([event]);

      expect(event).toEqual(snapshot);
    });

    test("returns shallow copies in orderedEvents", () => {
      const event = sampleEvent({ id: 7 });
      const aggregate = resolveRecruitmentAggregate([event]);

      expect(aggregate.orderedEvents[0]).toEqual(event);
      expect(aggregate.orderedEvents[0]).not.toBe(event);
    });
  });

  describe("deterministic behavior", () => {
    test("produces identical aggregates for identical input", () => {
      const events = [
        sampleEvent({ id: 2, event_type: "admit_card", sequence_order: 40 }),
        sampleEvent({ id: 1, event_type: "notification", sequence_order: 10 })
      ];

      const first = resolveRecruitmentAggregate(events);
      const second = resolveRecruitmentAggregate(events);

      expect(first).toEqual(second);
      expect(first.orderedEvents).not.toBe(second.orderedEvents);
    });

    test("produces identical aggregates across separate array instances", () => {
      const buildEvents = () => [
        sampleEvent({ id: 4, event_type: "result", sequence_order: 70 }),
        sampleEvent({ id: 1, event_type: "notification", sequence_order: 10 })
      ];

      expect(resolveRecruitmentAggregate(buildEvents())).toEqual(
        resolveRecruitmentAggregate(buildEvents())
      );
    });
  });

  describe("validation and summary helpers", () => {
    test("validates a resolved aggregate", () => {
      const aggregate = resolveRecruitmentAggregate([sampleEvent()]);
      const validation = validateRecruitmentAggregate(aggregate);

      expect(validation.valid).toBe(true);
      expect(validation.status).toBe(VALIDATION_STATUS.VALID);
      expect(validation.reasons).toEqual([]);
      expect(isRecruitmentAggregate(aggregate)).toBe(true);
    });

    test("rejects invalid aggregate shapes", () => {
      const validation = validateRecruitmentAggregate({ eventCount: 1 });

      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_AGGREGATE_SHAPE");
      expect(isRecruitmentAggregate({ eventCount: 1 })).toBe(false);
    });

    test("summarizes a valid aggregate", () => {
      const aggregate = resolveRecruitmentAggregate([
        sampleEvent({ id: 1, event_type: "notification", sequence_order: 10 }),
        sampleEvent({ id: 2, event_type: "final_result", sequence_order: 90 })
      ]);
      const summary = summarizeRecruitmentAggregate(aggregate);

      expect(summary.valid).toBe(true);
      expect(summary.phase).toBe(78);
      expect(summary.eventCount).toBe(2);
      expect(summary.hasPrimary).toBe(true);
      expect(summary.lifecycleStarted).toBe(true);
      expect(summary.lifecycleCompleted).toBe(true);
      expect(summary.primaryEventType).toBe("notification");
      expect(summary.latestEventType).toBe("final_result");
      expect(summary.readOnly).toBe(true);
    });

    test("summarizes invalid aggregates safely", () => {
      const summary = summarizeRecruitmentAggregate(null);

      expect(summary.valid).toBe(false);
      expect(summary.eventCount).toBe(0);
      expect(summary.readOnly).toBe(true);
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares read-only pure library constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 78");
      expect(source).toContain("Read-only");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toMatch(/resolveRecruitmentAggregate/);
    });

    test("module does not import database, express, or filesystem modules", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2/);
    });

    test("module is not wired into compatibility layer or pipeline", () => {
      const compatibilitySource = read(COMPATIBILITY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);

      expect(compatibilitySource).not.toMatch(/recruitmentAggregateResolver/);
      expect(pipelineSource).not.toMatch(/recruitmentAggregateResolver/);
    });

    test("metadata confirms no runtime integration or side effects", () => {
      expect(RECRUITMENT_AGGREGATE_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_AGGREGATE_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_AGGREGATE_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_AGGREGATE_METADATA.performsStateTransitions).toBe(false);
    });
  });
});
