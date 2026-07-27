"use strict";

/**
 * Phase 63 — Recruitment Domain Model tests.
 * Pure descriptive foundation: exports, immutability, lifecycle integrity,
 * shape consistency, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  DOMAIN_MODEL_PHASE,
  RECRUITMENT,
  RECRUITMENT_EVENT,
  RECRUITMENT_LIFECYCLE_STATES,
  DEFAULT_RECRUITMENT_LIFECYCLE_STATE,
  PUBLICATION_STATES,
  SUPPORTED_PUBLICATION_STATES,
  DEFAULT_PUBLICATION_STATE,
  PUBLICATION_STATE_CONCEPT,
  LIFECYCLE_EVENT_TYPES,
  SUPPORTED_LIFECYCLE_EVENT_TYPES,
  LIFECYCLE_EVENTS,
  LIFECYCLE_EVENT_BY_ID,
  LIFECYCLE_EVENT_BY_TYPE,
  LIFECYCLE_STAGE_GROUPS,
  RECRUITMENT_EVENT_STATUSES,
  DEFAULT_RECRUITMENT_EVENT_STATUS,
  PRIMARY_EVENT_CONCEPT,
  TERMINAL_EVENT_CONCEPT,
  DOMAIN_MODEL_METADATA,
  isRecruitmentShape,
  isRecruitmentEventShape,
  isLifecycleEventType,
  isPrimaryEventType,
  isTerminalEventType,
  isPublicationState,
  getLifecycleEventDescriptor,
  getLifecycleEventDescriptorByType,
  listLifecycleEventsInOrder,
  summarizeRecruitmentDomainModel
} = require("../server/lib/recruitment/recruitmentDomainModel");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentDomainModel.js";

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

describe("Phase 63 — recruitmentDomainModel", () => {
  describe("exports", () => {
    test("exposes phase 63 domain model constants and descriptors", () => {
      expect(DOMAIN_MODEL_PHASE).toBe(63);
      expect(RECRUITMENT.entity).toBe("recruitment");
      expect(RECRUITMENT_EVENT.entity).toBe("recruitment_event");
      expect(PRIMARY_EVENT_CONCEPT.id).toBe("primary_event");
      expect(TERMINAL_EVENT_CONCEPT.id).toBe("terminal_event");
      expect(PUBLICATION_STATE_CONCEPT.id).toBe("publication_state");
      expect(DOMAIN_MODEL_METADATA.descriptiveOnly).toBe(true);
      expect(DOMAIN_MODEL_METADATA.runtimeIntegration).toBe(false);
    });

    test("lifecycle event types align with existing recruitment event service enum", () => {
      expect(LIFECYCLE_EVENT_TYPES).toEqual([
        "notification",
        "short_notification",
        "correction",
        "exam_date",
        "city_intimation",
        "admit_card",
        "answer_key",
        "objection",
        "result",
        "final_result",
        "dv",
        "medical",
        "joining"
      ]);
      expect(SUPPORTED_LIFECYCLE_EVENT_TYPES.size).toBe(
        LIFECYCLE_EVENT_TYPES.length
      );
    });

    test("recruitment lifecycle states align with persistence schema", () => {
      expect(RECRUITMENT_LIFECYCLE_STATES).toEqual([
        "announced",
        "open",
        "exam_scheduled",
        "post_exam",
        "results",
        "closed"
      ]);
      expect(DEFAULT_RECRUITMENT_LIFECYCLE_STATE).toBe("announced");
      expect(RECRUITMENT.defaultLifecycleState).toBe("announced");
    });

    test("publication states expose a complete frozen vocabulary", () => {
      expect(PUBLICATION_STATES).toEqual({
        DRAFT: "draft",
        PENDING_REVIEW: "pending_review",
        PUBLISHED: "published",
        UNPUBLISHED: "unpublished",
        ARCHIVED: "archived"
      });
      expect(DEFAULT_PUBLICATION_STATE).toBe("draft");
      expect(PUBLICATION_STATE_CONCEPT.defaultState).toBe("draft");
      expect(SUPPORTED_PUBLICATION_STATES.size).toBe(5);
    });

    test("summarizeRecruitmentDomainModel returns frozen advisory summary", () => {
      const summary = summarizeRecruitmentDomainModel();
      expect(summary).toEqual({
        phase: 63,
        recruitmentEntity: "recruitment",
        recruitmentEventEntity: "recruitment_event",
        lifecycleEventCount: LIFECYCLE_EVENTS.length,
        lifecycleEventTypeCount: LIFECYCLE_EVENT_TYPES.length,
        lifecycleStageGroupCount: Object.keys(LIFECYCLE_STAGE_GROUPS).length,
        publicationStateCount: 5,
        primaryEventType: "notification",
        terminalEventTypes: TERMINAL_EVENT_CONCEPT.terminalEventTypes,
        descriptiveOnly: true,
        architectureOnly: true,
        runtimeIntegration: false,
        persistenceEnabled: false,
        sideEffects: false
      });
      expect(Object.isFrozen(summary)).toBe(true);
    });
  });

  describe("immutability", () => {
    test("top-level exported constants are frozen", () => {
      expect(Object.isFrozen(RECRUITMENT)).toBe(true);
      expect(Object.isFrozen(RECRUITMENT_EVENT)).toBe(true);
      expect(Object.isFrozen(LIFECYCLE_EVENTS)).toBe(true);
      expect(Object.isFrozen(LIFECYCLE_EVENT_TYPES)).toBe(true);
      expect(Object.isFrozen(PRIMARY_EVENT_CONCEPT)).toBe(true);
      expect(Object.isFrozen(TERMINAL_EVENT_CONCEPT)).toBe(true);
      expect(Object.isFrozen(PUBLICATION_STATE_CONCEPT)).toBe(true);
      expect(Object.isFrozen(DOMAIN_MODEL_METADATA)).toBe(true);
    });

    test("nested descriptor graph is deeply frozen", () => {
      assertAllFrozen(RECRUITMENT);
      assertAllFrozen(RECRUITMENT_EVENT);
      assertAllFrozen(LIFECYCLE_EVENTS);
      assertAllFrozen(PRIMARY_EVENT_CONCEPT);
      assertAllFrozen(TERMINAL_EVENT_CONCEPT);
      assertAllFrozen(PUBLICATION_STATE_CONCEPT);
    });

    test("mutation attempts on lifecycle catalog do not change exports", () => {
      const before = [...LIFECYCLE_EVENT_TYPES];
      expect(() => {
        LIFECYCLE_EVENTS.push({});
      }).toThrow();
      expect(() => {
        LIFECYCLE_EVENT_TYPES.push("application");
      }).toThrow();
      expect([...LIFECYCLE_EVENT_TYPES]).toEqual(before);
    });

    test("mutation attempts on concept objects are rejected", () => {
      expect(() => {
        PRIMARY_EVENT_CONCEPT.primaryEventType = "result";
      }).toThrow();
      expect(() => {
        TERMINAL_EVENT_CONCEPT.terminalEventTypes.push("notification");
      }).toThrow();
      expect(PRIMARY_EVENT_CONCEPT.primaryEventType).toBe("notification");
      expect(TERMINAL_EVENT_CONCEPT.terminalEventTypes).toEqual([
        "final_result",
        "joining"
      ]);
    });
  });

  describe("lifecycle uniqueness", () => {
    test("lifecycle catalog ids are unique", () => {
      const ids = LIFECYCLE_EVENTS.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    test("persisted lifecycle event types appear at most once in the catalog", () => {
      const persistedTypes = LIFECYCLE_EVENTS.filter(
        (item) => item.eventType != null
      ).map((item) => item.eventType);
      expect(new Set(persistedTypes).size).toBe(persistedTypes.length);
      expect(persistedTypes.sort()).toEqual([...LIFECYCLE_EVENT_TYPES].sort());
    });

    test("lifecycle orders are strictly increasing for catalog sequence", () => {
      const orders = LIFECYCLE_EVENTS.map((item) => item.order);
      for (let i = 1; i < orders.length; i += 1) {
        expect(orders[i]).toBeGreaterThan(orders[i - 1]);
      }
    });

    test("lookup maps reference the same frozen descriptors", () => {
      for (const descriptor of LIFECYCLE_EVENTS) {
        expect(LIFECYCLE_EVENT_BY_ID[descriptor.id]).toBe(descriptor);
        if (descriptor.eventType != null) {
          expect(LIFECYCLE_EVENT_BY_TYPE[descriptor.eventType]).toBe(descriptor);
        }
      }
    });

    test("listLifecycleEventsInOrder returns the canonical frozen catalog", () => {
      expect(listLifecycleEventsInOrder()).toBe(LIFECYCLE_EVENTS);
    });
  });

  describe("object consistency", () => {
    test("recruitment descriptor required fields match field metadata", () => {
      expect(RECRUITMENT.requiredFields).toEqual([
        "title",
        "slug",
        "lifecycle_state"
      ]);
      expect(listRequiredFieldNames(RECRUITMENT)).toEqual(
        [...RECRUITMENT.requiredFields].sort()
      );
      expect(RECRUITMENT.fields.lifecycle_state.allowedValues).toBe(
        RECRUITMENT_LIFECYCLE_STATES
      );
    });

    test("recruitment event descriptor required fields match field metadata", () => {
      expect(RECRUITMENT_EVENT.requiredFields).toEqual([
        "recruitment_id",
        "event_type"
      ]);
      expect(listRequiredFieldNames(RECRUITMENT_EVENT)).toEqual(
        [...RECRUITMENT_EVENT.requiredFields].sort()
      );
      expect(RECRUITMENT_EVENT.fields.event_type.allowedValues).toBe(
        LIFECYCLE_EVENT_TYPES
      );
      expect(RECRUITMENT_EVENT.eventStatuses).toBe(RECRUITMENT_EVENT_STATUSES);
      expect(RECRUITMENT_EVENT.defaultEventStatus).toBe(
        DEFAULT_RECRUITMENT_EVENT_STATUS
      );
    });

    test("primary and terminal concepts are wired into recruitment event descriptor", () => {
      expect(RECRUITMENT_EVENT.primaryEventConcept).toBe(PRIMARY_EVENT_CONCEPT);
      expect(RECRUITMENT_EVENT.terminalEventConcept).toBe(TERMINAL_EVENT_CONCEPT);
      expect(RECRUITMENT_EVENT.publicationConcept).toBe(PUBLICATION_STATE_CONCEPT);
      expect(RECRUITMENT.publicationConcept).toBe(PUBLICATION_STATE_CONCEPT);
    });

    test("isRecruitmentShape accepts valid minimal and full shapes", () => {
      expect(
        isRecruitmentShape({
          title: "SSC CGL 2026",
          slug: "ssc-cgl-2026",
          lifecycle_state: "open"
        })
      ).toBe(true);
      expect(
        isRecruitmentShape({
          id: 1,
          title: "SSC CGL 2026",
          slug: "ssc-cgl-2026",
          department: "SSC",
          post_name: "Combined Graduate Level",
          advertisement_no: "CGL-01/2026",
          cycle_year: 2026,
          lifecycle_state: "open",
          publication_state: "published",
          created_at: "2026-07-15T00:00:00.000Z",
          updated_at: "2026-07-15T00:00:00.000Z"
        })
      ).toBe(true);
      expect(
        isRecruitmentShape({
          title: "SSC CGL 2026",
          slug: "ssc-cgl-2026",
          lifecycle_state: "invalid"
        })
      ).toBe(false);
      expect(isRecruitmentShape(null)).toBe(false);
    });

    test("isRecruitmentEventShape accepts valid minimal and full shapes", () => {
      expect(
        isRecruitmentEventShape({
          recruitment_id: 10,
          event_type: "admit_card"
        })
      ).toBe(true);
      expect(
        isRecruitmentEventShape({
          id: 99,
          recruitment_id: 10,
          event_type: "result",
          sequence_order: 3,
          status: "active",
          publication_state: "published",
          created_at: "2026-07-15T00:00:00.000Z",
          updated_at: "2026-07-15T00:00:00.000Z"
        })
      ).toBe(true);
      expect(
        isRecruitmentEventShape({
          recruitment_id: 10,
          event_type: "unknown"
        })
      ).toBe(false);
      expect(isRecruitmentEventShape({ event_type: "result" })).toBe(false);
    });
  });

  describe("circular references", () => {
    test("exported descriptor graph has no circular references", () => {
      expect(hasCircularReference(RECRUITMENT)).toBe(false);
      expect(hasCircularReference(RECRUITMENT_EVENT)).toBe(false);
      expect(hasCircularReference(LIFECYCLE_EVENTS)).toBe(false);
      expect(hasCircularReference(PRIMARY_EVENT_CONCEPT)).toBe(false);
      expect(hasCircularReference(TERMINAL_EVENT_CONCEPT)).toBe(false);
      expect(hasCircularReference(PUBLICATION_STATE_CONCEPT)).toBe(false);
    });

    test("lookup maps do not introduce cycles", () => {
      expect(hasCircularReference(LIFECYCLE_EVENT_BY_ID)).toBe(false);
      expect(hasCircularReference(LIFECYCLE_EVENT_BY_TYPE)).toBe(false);
    });
  });

  describe("descriptive integrity", () => {
    test("lifecycle catalog covers common recruitment stages including application", () => {
      const labels = LIFECYCLE_EVENTS.map((item) => item.label);
      expect(labels).toEqual(
        expect.arrayContaining([
          "Notification",
          "Application Period",
          "Correction / Corrigendum",
          "Exam Date",
          "Admit Card",
          "Answer Key",
          "Result",
          "Final Result"
        ])
      );
      expect(getLifecycleEventDescriptor("application_window")).toEqual(
        expect.objectContaining({
          conceptual: true,
          stageGroup: LIFECYCLE_STAGE_GROUPS.APPLICATION
        })
      );
    });

    test("primary and terminal event helpers classify expected types only", () => {
      expect(isPrimaryEventType("notification")).toBe(true);
      expect(isPrimaryEventType("short_notification")).toBe(true);
      expect(isPrimaryEventType("admit_card")).toBe(false);
      expect(isTerminalEventType("final_result")).toBe(true);
      expect(isTerminalEventType("joining")).toBe(true);
      expect(isTerminalEventType("result")).toBe(false);
      expect(isLifecycleEventType("answer_key")).toBe(true);
      expect(isLifecycleEventType("application")).toBe(false);
    });

    test("publication state helper accepts only declared states", () => {
      for (const state of Object.values(PUBLICATION_STATES)) {
        expect(isPublicationState(state)).toBe(true);
      }
      expect(isPublicationState("live")).toBe(false);
      expect(isPublicationState(null)).toBe(false);
    });

    test("lifecycle descriptors expose stage groups and typical recruitment states", () => {
      const admitCard = getLifecycleEventDescriptorByType("admit_card");
      expect(admitCard).toEqual(
        expect.objectContaining({
          id: "admit_card",
          stageGroup: LIFECYCLE_STAGE_GROUPS.EXAMINATION,
          typicalRecruitmentStates: expect.arrayContaining(["exam_scheduled"])
        })
      );
      expect(getLifecycleEventDescriptor("missing-stage")).toBeNull();
      expect(getLifecycleEventDescriptorByType("")).toBeNull();
    });

    test("concept descriptors remain descriptive and non-executable", () => {
      expect(PRIMARY_EVENT_CONCEPT.establishesRecruitment).toBe(true);
      expect(TERMINAL_EVENT_CONCEPT.closesRecruitment).toBe(true);
      expect(PUBLICATION_STATE_CONCEPT.terminalStates).toEqual([
        "unpublished",
        "archived"
      ]);
      expect(typeof summarizeRecruitmentDomainModel).toBe("function");
      expect(summarizeRecruitmentDomainModel().sideEffects).toBe(false);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("domain model module has no DB / Express / filesystem / env access", () => {
      const source = read(MODULE_PATH);
      expect(source).toMatch(/Phase 63/);
      expect(source).toMatch(/Pure descriptive library/);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/require\(["'].*config\/db["']\)/);
      expect(source).not.toMatch(/process\.env/);
      expect(source).not.toMatch(/\bINSERT\s+INTO\b/i);
      expect(source).not.toMatch(/information_schema/i);
    });

    test("domain model has zero require dependencies (pure surface)", () => {
      const source = read(MODULE_PATH);
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual([]);
    });

    test("siteWorker and runtime modules are unchanged — domain model not wired", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/recruitmentDomainModel/);

      const preview = read("server/lib/recruitment/runtimePreviewBuffer.js");
      const policy = read("server/lib/recruitment/runtimePersistencePolicy.js");
      const registry = read(
        "server/lib/recruitment/runtimeCapabilityRegistry.js"
      );
      expect(preview).not.toMatch(/recruitmentDomainModel/);
      expect(policy).not.toMatch(/recruitmentDomainModel/);
      expect(registry).not.toMatch(/recruitmentDomainModel/);
    });

    test("capability platform and diagnostics modules do not import domain model", () => {
      const modules = [
        "server/lib/recruitment/runtimeCapabilityPreviewIntegration.js",
        "server/lib/recruitment/previewIntegrationContract.js",
        "server/lib/recruitment/executionDiagnostics.js",
        "server/lib/recruitment/executionDiagnosticsCapabilityIntegration.js",
        "server/lib/recruitment/persistenceEnablement.js",
        "server/lib/recruitment/controlledRuntimeExecutionAdapter.js"
      ];
      for (const relPath of modules) {
        expect(read(relPath)).not.toMatch(/recruitmentDomainModel/);
      }
    });
  });
});

function listRequiredFieldNames(descriptor) {
  return Object.values(descriptor.fields)
    .filter((field) => field.required)
    .map((field) => field.name)
    .sort((a, b) => a.localeCompare(b));
}
