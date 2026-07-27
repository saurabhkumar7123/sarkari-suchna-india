"use strict";

/**
 * Phase 95 — Recruitment Lifecycle Event Resolver tests.
 * Supported lifecycle events, unknown/malformed input, determinism,
 * immutability, coordinator integration, feature flag OFF, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_LIFECYCLE_EVENT_RESOLVER_PHASE,
  RECRUITMENT_LIFECYCLE_EVENT_RESOLUTION_ENTITY,
  ADVISORY_LIFECYCLE_EVENTS,
  ADVISORY_LIFECYCLE_EVENT_LIST,
  SUPPORTED_ADVISORY_LIFECYCLE_EVENTS,
  CONFIDENCE_LEVELS,
  RESOLUTION_REASONS,
  RECRUITMENT_LIFECYCLE_EVENT_RESOLVER_DESCRIPTOR,
  RECRUITMENT_LIFECYCLE_EVENT_RESOLVER_METADATA,
  EMPTY_LIFECYCLE_EVENT_RESOLUTION,
  normalizeAdvisoryLifecycleEvent,
  mapDomainEventType,
  resolveRecruitmentLifecycleEvent,
  isLifecycleEventResolutionResult,
  validateLifecycleEventResolutionResult,
  summarizeLifecycleEventResolutionResult
} = require("../server/lib/recruitment/recruitmentLifecycleEventResolver");

const {
  coordinateRecruitmentWorkflowIntegration
} = require("../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator");

const { processRecruitmentDetection } = require("../server/lib/recruitment/detectionProcessor");
const { runRecruitmentPipeline } = require("../server/lib/recruitment/runRecruitmentPipeline");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentLifecycleEventResolver.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
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

function notice(overrides = {}) {
  return {
    title: "SSC CGL 2026 Admit Card",
    content: "Download admit card for Tier 1 Advertisement Number CGL-01/2026",
    url: "https://ssc.nic.in/admit-card-cgl-2026.pdf",
    ...overrides
  };
}

function candidate(overrides = {}) {
  return {
    id: 1,
    department: "ssc",
    post_name: "Combined Graduate Level",
    exam_name: "CGL",
    cycle_year: 2026,
    advertisement_no: "CGL-01/2026",
    ...overrides
  };
}

function okLookup(overrides = {}) {
  return {
    status: "ok",
    strategy: "advertisement_number_exact",
    candidateCount: 1,
    limitedTo: 20,
    criteria: { advertisementNo: "CGL-01/2026" },
    message: null,
    ...overrides
  };
}

function enabledCoordinatorContext(overrides = {}) {
  const processorResult = processRecruitmentDetection({
    notice: notice(),
    candidateRecruitments: [candidate()]
  });

  return {
    featureFlags: {
      workflowIntegrationEnabled: true,
      pipelineEnabled: true,
      automaticPersistenceEnabled: false,
      reviewQueueEnqueueEnabled: false
    },
    executionMode: "preview",
    processorResult: {
      ...processorResult,
      lookupSummary: okLookup(),
      selectedRecruitment: candidate()
    },
    pipelineOutcome: runRecruitmentPipeline({
      notice: notice(),
      candidateRecruitments: [candidate()],
      isEnabled: true,
      updateId: 42
    }),
    normalizedUpdate: {
      updateId: 42,
      notice: notice()
    },
    correlationId: "corr-95",
    traceId: "trace-95",
    ...overrides
  };
}

describe("Phase 95 — recruitmentLifecycleEventResolver", () => {
  describe("exports", () => {
    test("exposes phase 95 constants and descriptor", () => {
      expect(RECRUITMENT_LIFECYCLE_EVENT_RESOLVER_PHASE).toBe(95);
      expect(RECRUITMENT_LIFECYCLE_EVENT_RESOLUTION_ENTITY).toBe(
        "recruitment_lifecycle_event_resolution"
      );
      expect(RECRUITMENT_LIFECYCLE_EVENT_RESOLVER_DESCRIPTOR.phase).toBe(95);
      expect(RECRUITMENT_LIFECYCLE_EVENT_RESOLVER_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_LIFECYCLE_EVENT_RESOLVER_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_LIFECYCLE_EVENT_RESOLVER_METADATA.queriesDatabase).toBe(false);
    });

    test("exports all supported advisory lifecycle events", () => {
      expect(ADVISORY_LIFECYCLE_EVENT_LIST).toEqual([
        "UNKNOWN",
        "NOTIFICATION",
        "APPLICATION",
        "APPLICATION_CORRECTION",
        "EXAM_CITY",
        "ADMIT_CARD",
        "ANSWER_KEY",
        "RESULT",
        "FINAL_RESULT",
        "COUNSELLING",
        "DOCUMENT_VERIFICATION",
        "JOINING",
        "COMPLETED"
      ]);
      expect(SUPPORTED_ADVISORY_LIFECYCLE_EVENTS.size).toBe(13);
    });
  });

  describe("supported lifecycle events", () => {
    const domainCases = [
      ["NOTIFICATION", { eventType: "notification" }],
      ["NOTIFICATION", { eventType: "short_notification" }],
      ["APPLICATION", { eventType: "application_start" }],
      ["APPLICATION_CORRECTION", { eventType: "correction" }],
      ["EXAM_CITY", { eventType: "city_intimation" }],
      ["ADMIT_CARD", { eventType: "admit_card" }],
      ["ANSWER_KEY", { eventType: "answer_key" }],
      ["RESULT", { eventType: "result" }],
      ["FINAL_RESULT", { eventType: "final_result" }],
      ["DOCUMENT_VERIFICATION", { eventType: "dv" }],
      ["JOINING", { eventType: "joining" }],
      ["COMPLETED", { lifecycleEvent: "COMPLETED" }]
    ];

    test.each(domainCases)("resolves %s from domain mapping", (expectedEvent, context) => {
      const result = resolveRecruitmentLifecycleEvent(context);
      expect(result.lifecycleEvent).toBe(expectedEvent);
      expect(result.lifecycleConfidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });

    test("resolves COUNSELLING from page metadata", () => {
      const result = resolveRecruitmentLifecycleEvent({
        pageMetadata: {
          title: "UPSC CDS Counselling Schedule 2026",
          content: "Seat allotment list published"
        }
      });

      expect(result.lifecycleEvent).toBe(ADVISORY_LIFECYCLE_EVENTS.COUNSELLING);
      expect(result.resolutionReason).toBe(RESOLUTION_REASONS.PAGE_METADATA_SIGNAL);
    });

    test("resolves UNKNOWN when no signals are present", () => {
      const result = resolveRecruitmentLifecycleEvent({});
      expect(result.lifecycleEvent).toBe(ADVISORY_LIFECYCLE_EVENTS.UNKNOWN);
      expect(result.lifecycleConfidence).toBe(CONFIDENCE_LEVELS.NONE);
      expect(result.resolutionReason).toBe(RESOLUTION_REASONS.NO_RESOLUTION_SIGNALS);
    });
  });

  describe("unknown and malformed input", () => {
    test("returns invalid-input resolution for null and non-object context", () => {
      const nullResult = resolveRecruitmentLifecycleEvent(null);
      const stringResult = resolveRecruitmentLifecycleEvent("bad");
      const arrayResult = resolveRecruitmentLifecycleEvent([]);

      expect(nullResult.lifecycleEvent).toBe(ADVISORY_LIFECYCLE_EVENTS.UNKNOWN);
      expect(nullResult.resolutionReason).toBe(RESOLUTION_REASONS.INVALID_INPUT);
      expect(stringResult.resolutionReason).toBe(RESOLUTION_REASONS.INVALID_INPUT);
      expect(arrayResult.resolutionReason).toBe(RESOLUTION_REASONS.INVALID_INPUT);
    });

    test("ignores unsupported explicit advisory lifecycle values", () => {
      const result = resolveRecruitmentLifecycleEvent({
        lifecycleEvent: "NOT_A_REAL_EVENT",
        eventType: "result"
      });

      expect(result.lifecycleEvent).toBe(ADVISORY_LIFECYCLE_EVENTS.RESULT);
    });

    test("does not throw for malformed nested fields", () => {
      expect(() =>
        resolveRecruitmentLifecycleEvent({
          pageMetadata: "bad",
          recruitmentMetadata: 42,
          workflowContext: null,
          pipelineContext: []
        })
      ).not.toThrow();
    });
  });

  describe("deterministic output", () => {
    test("produces identical results for identical input", () => {
      const context = {
        eventType: "admit_card",
        pageMetadata: { title: "Admit Card Released" }
      };

      const first = resolveRecruitmentLifecycleEvent(context);
      const second = resolveRecruitmentLifecycleEvent(context);

      expect(first).toEqual(second);
      expect(first).not.toBe(second);
    });
  });

  describe("immutability", () => {
    test("freezes entire resolution result object graph", () => {
      const result = resolveRecruitmentLifecycleEvent({ eventType: "result" });
      assertAllFrozen(result);
      expect(hasCircularReference(result)).toBe(false);
    });

    test("does not mutate input context", () => {
      const context = {
        eventType: "notification",
        pageMetadata: { title: "Notification" }
      };
      const snapshot = JSON.stringify(context);

      resolveRecruitmentLifecycleEvent(context);

      expect(JSON.stringify(context)).toBe(snapshot);
    });

    test("empty resolution sentinel remains frozen", () => {
      assertAllFrozen(EMPTY_LIFECYCLE_EVENT_RESOLUTION);
    });
  });

  describe("validation helpers", () => {
    test("validates and summarizes resolution results", () => {
      const result = resolveRecruitmentLifecycleEvent({ eventType: "joining" });

      expect(isLifecycleEventResolutionResult(result)).toBe(true);
      expect(validateLifecycleEventResolutionResult(result).valid).toBe(true);
      expect(summarizeLifecycleEventResolutionResult(result)).toMatchObject({
        phase: 95,
        valid: true,
        lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.JOINING
      });
    });

    test("normalizeAdvisoryLifecycleEvent and mapDomainEventType helpers", () => {
      expect(normalizeAdvisoryLifecycleEvent("bogus_event")).toBeNull();
      expect(normalizeAdvisoryLifecycleEvent("ADMIT_CARD")).toBe("ADMIT_CARD");
      expect(mapDomainEventType("admit_card")).toBe(ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD);
      expect(mapDomainEventType("bogus")).toBeNull();
    });
  });

  describe("coordinator integration", () => {
    test("plannedWorkflow includes lifecycle resolution when flag is on", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());

      expect(result.plannedWorkflow.lifecycleEvent).toBe(ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD);
      expect(result.plannedWorkflow.lifecycleConfidence).toBe(CONFIDENCE_LEVELS.HIGH);
      expect(result.plannedWorkflow.resolutionReason).toBeDefined();
      expect(result.plannedWorkflow.executed).toBe(false);
      expect(result.plannedWorkflow.advisory).toBe(true);
    });

    test("diagnostics append lifecycle event resolution stage", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());
      const summary = result.diagnostics.summary;

      expect(summary.stageCount).toBeGreaterThanOrEqual(6);
      expect(summary.stageTypes.filter((stageType) => stageType === "review").length).toBeGreaterThanOrEqual(
        2
      );
      expect(read(COORDINATOR_MODULE_PATH)).toContain("Lifecycle event resolution");
    });
  });

  describe("feature flag OFF", () => {
    test("coordinator short-circuit leaves plannedWorkflow null", () => {
      const result = coordinateRecruitmentWorkflowIntegration({
        featureFlags: { workflowIntegrationEnabled: false },
        processorResult: { eventType: "admit_card" }
      });

      expect(result.plannedWorkflow).toBeNull();
      expect(result.featureEnabled).toBe(false);
    });
  });

  describe("production safety", () => {
    test("resolution result is advisory-only with no execution", () => {
      const result = resolveRecruitmentLifecycleEvent({ eventType: "result" });

      expect(result.architectureOnly).toBe(true);
      expect(result.advisory).toBe(true);
      expect(result.executed).toBe(false);
    });

    test("coordinator integration does not enable persistence or mutations", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());

      expect(result.metadata.persistenceEnabled).toBe(false);
      expect(result.metadata.mutatesProduction).toBe(false);
      expect(result.metadata.sideEffects).toBe(false);
      expect(result.plannedWorkflow.executed).toBe(false);
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares pure advisory constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 95");
      expect(source).toContain("resolveRecruitmentLifecycleEvent");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("advisoryOnly");
    });

    test("module does not import express, database drivers, or filesystem APIs", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2/);
      expect(source).not.toMatch(/require\(["']https?["']\)/);
    });

    test("resolver is not wired into pipeline, compatibility layer, or siteWorker directly", () => {
      const compatibilitySource = read(COMPATIBILITY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);

      expect(compatibilitySource).not.toMatch(/recruitmentLifecycleEventResolver/);
      expect(pipelineSource).not.toMatch(/recruitmentLifecycleEventResolver/);
      expect(workerSource).not.toMatch(/recruitmentLifecycleEventResolver/);
    });

    test("coordinator imports resolver for advisory plannedWorkflow enrichment only", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);

      expect(coordinatorSource).toMatch(/recruitmentLifecycleEventResolver/);
      expect(coordinatorSource).toMatch(/resolveRecruitmentLifecycleEvent/);
      expect(coordinatorSource).toMatch(/Lifecycle event resolution/);
    });
  });
});
