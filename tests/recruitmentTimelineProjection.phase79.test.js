"use strict";

/**
 * Phase 79 — Recruitment Timeline Projection Layer tests.
 * Exports, lifecycle projection, immutability, validation, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_TIMELINE_PROJECTION_PHASE,
  RECRUITMENT_TIMELINE_PROJECTION_ENTITY,
  COMMON_LIFECYCLE_EVENT_TYPES,
  SUPPORTED_COMMON_LIFECYCLE_EVENT_TYPES,
  RECRUITMENT_TIMELINE_PROJECTION_DESCRIPTOR,
  RECRUITMENT_TIMELINE_PROJECTION_METADATA,
  VALIDATION_STATUS,
  EMPTY_RECRUITMENT_TIMELINE_PROJECTION,
  isCommonLifecycleEventType,
  isRecruitmentAggregateShape,
  createRecruitmentTimelineProjection,
  isRecruitmentTimelineProjection,
  validateRecruitmentTimelineProjection,
  summarizeRecruitmentTimelineProjection
} = require("../server/lib/recruitment/recruitmentTimelineProjection");

const { resolveRecruitmentAggregate } = require("../server/lib/recruitment/recruitmentAggregateResolver");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentTimelineProjection.js";
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

function buildAggregate(events) {
  return resolveRecruitmentAggregate(events);
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

describe("Phase 79 — recruitmentTimelineProjection", () => {
  describe("exports", () => {
    test("exposes phase 79 constants and descriptor", () => {
      expect(RECRUITMENT_TIMELINE_PROJECTION_PHASE).toBe(79);
      expect(RECRUITMENT_TIMELINE_PROJECTION_ENTITY).toBe("recruitment_timeline_projection");
      expect(RECRUITMENT_TIMELINE_PROJECTION_DESCRIPTOR.entity).toBe(
        "recruitment_timeline_projection"
      );
      expect(RECRUITMENT_TIMELINE_PROJECTION_DESCRIPTOR.phase).toBe(79);
      expect(RECRUITMENT_TIMELINE_PROJECTION_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_TIMELINE_PROJECTION_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_TIMELINE_PROJECTION_METADATA.performsStateTransitions).toBe(false);
      expect(RECRUITMENT_TIMELINE_PROJECTION_METADATA.marksRecruitmentIncomplete).toBe(false);
    });

    test("exports common lifecycle event type vocabulary", () => {
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
      expect(SUPPORTED_COMMON_LIFECYCLE_EVENT_TYPES.has("exam")).toBe(true);
      expect(isCommonLifecycleEventType("joining")).toBe(true);
      expect(isCommonLifecycleEventType("exam_date")).toBe(false);
    });

    test("exports helper functions", () => {
      expect(typeof createRecruitmentTimelineProjection).toBe("function");
      expect(typeof isRecruitmentTimelineProjection).toBe("function");
      expect(typeof validateRecruitmentTimelineProjection).toBe("function");
      expect(typeof summarizeRecruitmentTimelineProjection).toBe("function");
      expect(typeof isRecruitmentAggregateShape).toBe("function");
      expect(typeof isCommonLifecycleEventType).toBe("function");
    });
  });

  describe("empty aggregate", () => {
    test("returns empty projection for an empty aggregate", () => {
      const aggregate = buildAggregate([]);
      const projection = createRecruitmentTimelineProjection(aggregate);

      expect(projection).toBe(EMPTY_RECRUITMENT_TIMELINE_PROJECTION);
      expect(projection.recruitmentId).toBeNull();
      expect(projection.timelineEvents).toEqual([]);
      expect(projection.availableEventTypes).toEqual([]);
      expect(projection.missingCommonEvents).toEqual(COMMON_LIFECYCLE_EVENT_TYPES);
      expect(projection.totalTimelineEvents).toBe(0);
      expect(projection.firstTimelineEvent).toBeNull();
      expect(projection.latestTimelineEvent).toBeNull();
    });
  });

  describe("complete lifecycle", () => {
    test("projects all common lifecycle events with no missing types", () => {
      const aggregate = buildAggregate(buildCompleteLifecycleEvents());
      const projection = createRecruitmentTimelineProjection(aggregate);

      expect(projection.recruitmentId).toBe(42);
      expect(projection.totalTimelineEvents).toBe(11);
      expect(projection.availableEventTypes).toEqual(COMMON_LIFECYCLE_EVENT_TYPES);
      expect(projection.missingCommonEvents).toEqual([]);
      expect(projection.timelineEvents).toHaveLength(11);
      expect(projection.firstTimelineEvent.eventType).toBe("short_notification");
      expect(projection.latestTimelineEvent.eventType).toBe("joining");
    });

    test("timeline entries include required fields in aggregate order", () => {
      const aggregate = buildAggregate(buildCompleteLifecycleEvents());
      const projection = createRecruitmentTimelineProjection(aggregate);

      projection.timelineEvents.forEach((entry, index) => {
        expect(entry).toEqual(
          expect.objectContaining({
            eventType: COMMON_LIFECYCLE_EVENT_TYPES[index],
            eventOrder: index + 1,
            position: index,
            sourceEvent: aggregate.orderedEvents[index]
          })
        );
      });
    });
  });

  describe("partial lifecycle", () => {
    test("lists only absent common event types as missing", () => {
      const events = [
        sampleEvent({ id: 1, event_type: "notification", sequence_order: 10 }),
        sampleEvent({ id: 2, event_type: "admit_card", sequence_order: 30 }),
        sampleEvent({ id: 3, event_type: "result", sequence_order: 60 })
      ];
      const aggregate = buildAggregate(events);
      const projection = createRecruitmentTimelineProjection(aggregate);

      expect(projection.availableEventTypes).toEqual(["notification", "admit_card", "result"]);
      expect(projection.missingCommonEvents).toEqual([
        "short_notification",
        "application_start",
        "application_end",
        "correction",
        "exam",
        "answer_key",
        "final_result",
        "joining"
      ]);
      expect(projection.totalTimelineEvents).toBe(3);
    });

    test("does not mark recruitment incomplete or imply required events", () => {
      const aggregate = buildAggregate([
        sampleEvent({ id: 1, event_type: "notification", sequence_order: 10 })
      ]);
      const projection = createRecruitmentTimelineProjection(aggregate);

      expect(projection.missingCommonEvents.length).toBeGreaterThan(0);
      expect(projection).not.toHaveProperty("incomplete");
      expect(projection).not.toHaveProperty("lifecycleCompleted");
      expect(RECRUITMENT_TIMELINE_PROJECTION_METADATA.marksRecruitmentIncomplete).toBe(false);
    });
  });

  describe("unknown event types", () => {
    test("includes unknown event types in the timeline", () => {
      const events = [
        sampleEvent({ id: 1, event_type: "notification", sequence_order: 10 }),
        sampleEvent({ id: 2, event_type: "exam_date", sequence_order: 20 }),
        sampleEvent({ id: 3, event_type: "city_intimation", sequence_order: 25 })
      ];
      const aggregate = buildAggregate(events);
      const projection = createRecruitmentTimelineProjection(aggregate);

      expect(projection.timelineEvents.map((entry) => entry.eventType)).toEqual([
        "notification",
        "exam_date",
        "city_intimation"
      ]);
      expect(projection.availableEventTypes).toEqual([
        "notification",
        "exam_date",
        "city_intimation"
      ]);
      expect(projection.missingCommonEvents).toContain("exam");
    });

    test("ignores unknown fields on source events", () => {
      const events = [
        {
          ...sampleEvent({ id: 1, event_type: "notification", sequence_order: 10 }),
          unknown_field: "ignored",
          extra_metadata: { nested: true }
        }
      ];
      const aggregate = buildAggregate(events);
      const projection = createRecruitmentTimelineProjection(aggregate);

      expect(projection.totalTimelineEvents).toBe(1);
      expect(projection.timelineEvents[0].sourceEvent.unknown_field).toBe("ignored");
      expect(projection.timelineEvents[0].sourceEvent.extra_metadata).toEqual({ nested: true });
    });
  });

  describe("ordering preservation", () => {
    test("preserves aggregate orderedEvents sequence", () => {
      const events = [
        sampleEvent({ id: 3, event_type: "admit_card", sequence_order: 50 }),
        sampleEvent({ id: 1, event_type: "notification", sequence_order: 10 }),
        sampleEvent({ id: 2, event_type: "result", sequence_order: 70 })
      ];
      const aggregate = buildAggregate(events);
      const projection = createRecruitmentTimelineProjection(aggregate);

      expect(projection.timelineEvents.map((entry) => entry.sourceEvent.id)).toEqual([1, 3, 2]);
      expect(projection.firstTimelineEvent.sourceEvent.id).toBe(1);
      expect(projection.latestTimelineEvent.sourceEvent.id).toBe(2);
    });

    test("assigns sequential eventOrder and position from aggregate order", () => {
      const aggregate = buildAggregate([
        sampleEvent({ id: 1, event_type: "notification", sequence_order: 10 }),
        sampleEvent({ id: 2, event_type: "admit_card", sequence_order: 40 }),
        sampleEvent({ id: 3, event_type: "result", sequence_order: 70 })
      ]);
      const projection = createRecruitmentTimelineProjection(aggregate);

      expect(projection.timelineEvents.map((entry) => entry.eventOrder)).toEqual([1, 2, 3]);
      expect(projection.timelineEvents.map((entry) => entry.position)).toEqual([0, 1, 2]);
    });
  });

  describe("missing event detection", () => {
    test("reports missing common events in canonical order", () => {
      const aggregate = buildAggregate([
        sampleEvent({ id: 1, event_type: "joining", sequence_order: 90 }),
        sampleEvent({ id: 2, event_type: "notification", sequence_order: 10 })
      ]);
      const projection = createRecruitmentTimelineProjection(aggregate);

      expect(projection.missingCommonEvents).toEqual([
        "short_notification",
        "application_start",
        "application_end",
        "correction",
        "admit_card",
        "exam",
        "answer_key",
        "result",
        "final_result"
      ]);
    });

    test("deduplicates available event types by first appearance", () => {
      const aggregate = buildAggregate([
        sampleEvent({ id: 1, event_type: "notification", sequence_order: 10 }),
        sampleEvent({ id: 2, event_type: "correction", sequence_order: 15 }),
        sampleEvent({ id: 3, event_type: "notification", sequence_order: 12 }),
        sampleEvent({ id: 4, event_type: "correction", sequence_order: 16 })
      ]);
      const projection = createRecruitmentTimelineProjection(aggregate);

      expect(projection.availableEventTypes).toEqual(["notification", "correction"]);
      expect(projection.totalTimelineEvents).toBe(4);
    });
  });

  describe("immutable output", () => {
    test("returns a deeply frozen projection for non-empty input", () => {
      const aggregate = buildAggregate([sampleEvent()]);
      const projection = createRecruitmentTimelineProjection(aggregate);

      assertAllFrozen(projection);
      expect(() => {
        projection.totalTimelineEvents = 99;
      }).toThrow();
      expect(() => {
        projection.timelineEvents.push({});
      }).toThrow();
      expect(() => {
        projection.missingCommonEvents.push("hack");
      }).toThrow();
    });

    test("empty projection remains frozen", () => {
      assertAllFrozen(EMPTY_RECRUITMENT_TIMELINE_PROJECTION);
    });

    test("projection has no circular references", () => {
      const aggregate = buildAggregate([
        sampleEvent({ id: 1 }),
        sampleEvent({ id: 2, event_type: "admit_card", sequence_order: 20 })
      ]);
      const projection = createRecruitmentTimelineProjection(aggregate);

      expect(hasCircularReference(projection)).toBe(false);
    });
  });

  describe("input immutability", () => {
    test("does not mutate the aggregate object", () => {
      const aggregate = buildAggregate([
        sampleEvent({ id: 1, sequence_order: 10 }),
        sampleEvent({ id: 2, event_type: "admit_card", sequence_order: 40 })
      ]);
      const snapshot = JSON.parse(JSON.stringify(aggregate));

      createRecruitmentTimelineProjection(aggregate);

      expect(aggregate.recruitmentId).toBe(snapshot.recruitmentId);
      expect(aggregate.eventCount).toBe(snapshot.eventCount);
      expect(aggregate.orderedEvents.map((event) => event.id)).toEqual(
        snapshot.orderedEvents.map((event) => event.id)
      );
    });

    test("does not mutate events within the aggregate", () => {
      const events = [
        sampleEvent({ id: 1, sequence_order: 10 }),
        sampleEvent({ id: 2, event_type: "admit_card", sequence_order: 40 })
      ];
      const aggregate = buildAggregate(events);
      const eventSnapshots = aggregate.orderedEvents.map((event) => ({ ...event }));

      createRecruitmentTimelineProjection(aggregate);

      aggregate.orderedEvents.forEach((event, index) => {
        expect(event).toEqual(eventSnapshots[index]);
      });
    });

    test("references aggregate source events without replacing them", () => {
      const aggregate = buildAggregate([sampleEvent({ id: 7 })]);
      const projection = createRecruitmentTimelineProjection(aggregate);

      expect(projection.timelineEvents[0].sourceEvent).toBe(aggregate.orderedEvents[0]);
    });
  });

  describe("deterministic behavior", () => {
    test("produces identical projections for identical aggregate input", () => {
      const aggregate = buildAggregate([
        sampleEvent({ id: 2, event_type: "admit_card", sequence_order: 40 }),
        sampleEvent({ id: 1, event_type: "notification", sequence_order: 10 })
      ]);

      const first = createRecruitmentTimelineProjection(aggregate);
      const second = createRecruitmentTimelineProjection(aggregate);

      expect(first).toEqual(second);
      expect(first.timelineEvents).not.toBe(second.timelineEvents);
    });

    test("produces identical projections across separate aggregate instances", () => {
      const buildInput = () =>
        buildAggregate([
          sampleEvent({ id: 4, event_type: "result", sequence_order: 70 }),
          sampleEvent({ id: 1, event_type: "notification", sequence_order: 10 })
        ]);

      expect(createRecruitmentTimelineProjection(buildInput())).toEqual(
        createRecruitmentTimelineProjection(buildInput())
      );
    });
  });

  describe("invalid input handling", () => {
    test("returns empty projection for null, undefined, and non-object input", () => {
      expect(createRecruitmentTimelineProjection(null)).toBe(EMPTY_RECRUITMENT_TIMELINE_PROJECTION);
      expect(createRecruitmentTimelineProjection(undefined)).toBe(
        EMPTY_RECRUITMENT_TIMELINE_PROJECTION
      );
      expect(createRecruitmentTimelineProjection("not-an-aggregate")).toBe(
        EMPTY_RECRUITMENT_TIMELINE_PROJECTION
      );
    });

    test("returns empty projection for malformed aggregate shapes", () => {
      expect(createRecruitmentTimelineProjection({ eventCount: 1 })).toBe(
        EMPTY_RECRUITMENT_TIMELINE_PROJECTION
      );
      expect(createRecruitmentTimelineProjection({ orderedEvents: [], eventCount: 1 })).toBe(
        EMPTY_RECRUITMENT_TIMELINE_PROJECTION
      );
      expect(isRecruitmentAggregateShape({ eventCount: 1 })).toBe(false);
    });

    test("tolerates events with missing event type", () => {
      const aggregate = buildAggregate([{ id: 1, recruitment_id: 5, sequence_order: 10 }]);
      const projection = createRecruitmentTimelineProjection(aggregate);

      expect(projection.totalTimelineEvents).toBe(1);
      expect(projection.timelineEvents[0].eventType).toBeNull();
      expect(projection.availableEventTypes).toEqual([]);
    });
  });

  describe("validation and summary helpers", () => {
    test("validates a projected timeline", () => {
      const aggregate = buildAggregate([sampleEvent()]);
      const projection = createRecruitmentTimelineProjection(aggregate);
      const validation = validateRecruitmentTimelineProjection(projection);

      expect(validation.valid).toBe(true);
      expect(validation.status).toBe(VALIDATION_STATUS.VALID);
      expect(validation.reasons).toEqual([]);
      expect(isRecruitmentTimelineProjection(projection)).toBe(true);
    });

    test("rejects invalid projection shapes", () => {
      const validation = validateRecruitmentTimelineProjection({ totalTimelineEvents: 1 });

      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_PROJECTION_SHAPE");
      expect(isRecruitmentTimelineProjection({ totalTimelineEvents: 1 })).toBe(false);
    });

    test("summarizes a valid projection", () => {
      const aggregate = buildAggregate([
        sampleEvent({ id: 1, event_type: "notification", sequence_order: 10 }),
        sampleEvent({ id: 2, event_type: "final_result", sequence_order: 90 })
      ]);
      const projection = createRecruitmentTimelineProjection(aggregate);
      const summary = summarizeRecruitmentTimelineProjection(projection);

      expect(summary.valid).toBe(true);
      expect(summary.phase).toBe(79);
      expect(summary.totalTimelineEvents).toBe(2);
      expect(summary.availableEventTypeCount).toBe(2);
      expect(summary.missingCommonEventCount).toBeGreaterThan(0);
      expect(summary.firstEventType).toBe("notification");
      expect(summary.latestEventType).toBe("final_result");
      expect(summary.readOnly).toBe(true);
    });

    test("summarizes invalid projections safely", () => {
      const summary = summarizeRecruitmentTimelineProjection(null);

      expect(summary.valid).toBe(false);
      expect(summary.totalTimelineEvents).toBe(0);
      expect(summary.readOnly).toBe(true);
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares read-only pure library constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 79");
      expect(source).toContain("Read-only");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toMatch(/createRecruitmentTimelineProjection/);
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

      expect(compatibilitySource).not.toMatch(/recruitmentTimelineProjection/);
      expect(pipelineSource).not.toMatch(/recruitmentTimelineProjection/);
    });

    test("metadata confirms no runtime integration or side effects", () => {
      expect(RECRUITMENT_TIMELINE_PROJECTION_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_TIMELINE_PROJECTION_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_TIMELINE_PROJECTION_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_TIMELINE_PROJECTION_METADATA.performsStateTransitions).toBe(false);
    });
  });
});
