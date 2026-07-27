"use strict";

/**
 * Phase 96 — Recruitment Lifecycle Transition Resolver tests.
 * Every lifecycle state, valid/invalid transitions, terminal state,
 * completed workflow, unknown state, malformed input, determinism,
 * immutability, coordinator integration, feature flag OFF, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_LIFECYCLE_TRANSITION_RESOLVER_PHASE,
  RECRUITMENT_LIFECYCLE_TRANSITION_RESOLUTION_ENTITY,
  ADVISORY_LIFECYCLE_EVENTS,
  ADVISORY_LIFECYCLE_EVENT_LIST,
  SUPPORTED_ADVISORY_LIFECYCLE_EVENTS,
  CONFIDENCE_LEVELS,
  TRANSITION_REASONS,
  LIFECYCLE_WORKFLOW_ORDER,
  FORWARD_TRANSITIONS,
  RECRUITMENT_LIFECYCLE_TRANSITION_RESOLVER_DESCRIPTOR,
  RECRUITMENT_LIFECYCLE_TRANSITION_RESOLVER_METADATA,
  EMPTY_LIFECYCLE_TRANSITION_RESOLUTION,
  normalizeAdvisoryLifecycleEvent,
  isValidLifecycleTransition,
  resolveRecruitmentLifecycleTransition,
  isLifecycleTransitionResolutionResult,
  validateLifecycleTransitionResolutionResult,
  summarizeLifecycleTransitionResolutionResult
} = require("../server/lib/recruitment/recruitmentLifecycleTransitionResolver");

const {
  resolveRecruitmentLifecycleEvent
} = require("../server/lib/recruitment/recruitmentLifecycleEventResolver");

const {
  coordinateRecruitmentWorkflowIntegration
} = require("../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator");

const { processRecruitmentDetection } = require("../server/lib/recruitment/detectionProcessor");
const { runRecruitmentPipeline } = require("../server/lib/recruitment/runRecruitmentPipeline");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentLifecycleTransitionResolver.js";
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
    correlationId: "corr-96",
    traceId: "trace-96",
    ...overrides
  };
}

function transitionForEvent(event, overrides = {}) {
  return resolveRecruitmentLifecycleTransition({
    lifecycleResolution: {
      lifecycleEvent: event,
      lifecycleConfidence: CONFIDENCE_LEVELS.HIGH,
      resolutionReason: "EXPLICIT_ADVISORY_EVENT"
    },
    ...overrides
  });
}

describe("Phase 96 — recruitmentLifecycleTransitionResolver", () => {
  describe("exports", () => {
    test("exposes phase 96 constants and descriptor", () => {
      expect(RECRUITMENT_LIFECYCLE_TRANSITION_RESOLVER_PHASE).toBe(96);
      expect(RECRUITMENT_LIFECYCLE_TRANSITION_RESOLUTION_ENTITY).toBe(
        "recruitment_lifecycle_transition_resolution"
      );
      expect(RECRUITMENT_LIFECYCLE_TRANSITION_RESOLVER_DESCRIPTOR.phase).toBe(96);
      expect(RECRUITMENT_LIFECYCLE_TRANSITION_RESOLVER_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_LIFECYCLE_TRANSITION_RESOLVER_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_LIFECYCLE_TRANSITION_RESOLVER_METADATA.queriesDatabase).toBe(false);
    });

    test("exports all supported advisory lifecycle events and workflow order", () => {
      expect(ADVISORY_LIFECYCLE_EVENT_LIST).toEqual(LIFECYCLE_WORKFLOW_ORDER);
      expect(SUPPORTED_ADVISORY_LIFECYCLE_EVENTS.size).toBe(13);
    });
  });

  describe("every lifecycle state", () => {
    test.each(ADVISORY_LIFECYCLE_EVENT_LIST)(
      "resolves transitions for %s",
      (event) => {
        const result = transitionForEvent(event);

        expect(result.currentLifecycleEvent).toBe(event);
        expect(Array.isArray(result.nextAllowedEvents)).toBe(true);
        expect(Array.isArray(result.previousAllowedEvents)).toBe(true);
        expect(isLifecycleTransitionResolutionResult(result)).toBe(true);
      }
    );
  });

  describe("valid transitions", () => {
    const validCases = [
      ["NOTIFICATION", "APPLICATION"],
      ["APPLICATION", "ADMIT_CARD"],
      ["APPLICATION", "APPLICATION_CORRECTION"],
      ["ADMIT_CARD", "RESULT"],
      ["ADMIT_CARD", "ANSWER_KEY"],
      ["ANSWER_KEY", "RESULT"],
      ["RESULT", "FINAL_RESULT"],
      ["JOINING", "COMPLETED"],
      ["UNKNOWN", "NOTIFICATION"]
    ];

    test.each(validCases)("allows %s → %s", (fromEvent, toEvent) => {
      expect(isValidLifecycleTransition(fromEvent, toEvent)).toBe(true);
      const result = transitionForEvent(fromEvent);
      expect(result.nextAllowedEvents).toContain(toEvent);
    });

    test("supports multi-step advisory path NOTIFICATION → APPLICATION → ADMIT_CARD → RESULT", () => {
      const step1 = transitionForEvent(ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION);
      expect(step1.nextAllowedEvents).toContain(ADVISORY_LIFECYCLE_EVENTS.APPLICATION);

      const step2 = transitionForEvent(ADVISORY_LIFECYCLE_EVENTS.APPLICATION);
      expect(step2.nextAllowedEvents).toContain(ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD);

      const step3 = transitionForEvent(ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD);
      expect(step3.nextAllowedEvents).toContain(ADVISORY_LIFECYCLE_EVENTS.RESULT);

      const step4 = transitionForEvent(ADVISORY_LIFECYCLE_EVENTS.RESULT);
      expect(step4.nextAllowedEvents).toContain(ADVISORY_LIFECYCLE_EVENTS.FINAL_RESULT);
    });

    test("previousAllowedEvents include valid prior stages", () => {
      const result = transitionForEvent(ADVISORY_LIFECYCLE_EVENTS.RESULT);
      expect(result.previousAllowedEvents).toContain(ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD);
      expect(result.previousAllowedEvents).toContain(ADVISORY_LIFECYCLE_EVENTS.ANSWER_KEY);
    });
  });

  describe("invalid transitions", () => {
    const invalidCases = [
      ["NOTIFICATION", "RESULT"],
      ["NOTIFICATION", "FINAL_RESULT"],
      ["RESULT", "APPLICATION"],
      ["RESULT", "NOTIFICATION"],
      ["COMPLETED", "JOINING"],
      ["COMPLETED", "RESULT"],
      ["ADMIT_CARD", "APPLICATION"]
    ];

    test.each(invalidCases)("rejects %s → %s", (fromEvent, toEvent) => {
      expect(isValidLifecycleTransition(fromEvent, toEvent)).toBe(false);
      const result = transitionForEvent(fromEvent);
      expect(result.nextAllowedEvents).not.toContain(toEvent);
    });
  });

  describe("terminal state", () => {
    test("COMPLETED is terminal with no forward transitions", () => {
      const result = transitionForEvent(ADVISORY_LIFECYCLE_EVENTS.COMPLETED);

      expect(result.terminalState).toBe(true);
      expect(result.workflowCompleted).toBe(true);
      expect(result.nextAllowedEvents).toEqual([]);
      expect(result.transitionReason).toBe(TRANSITION_REASONS.TERMINAL_STATE_REACHED);
    });

    test("non-terminal states are not marked terminal", () => {
      const result = transitionForEvent(ADVISORY_LIFECYCLE_EVENTS.RESULT);

      expect(result.terminalState).toBe(false);
      expect(result.workflowCompleted).toBe(false);
    });
  });

  describe("completed workflow", () => {
    test("detects workflow completion from pipeline context", () => {
      const result = resolveRecruitmentLifecycleTransition({
        lifecycleResolution: {
          lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.JOINING,
          lifecycleConfidence: CONFIDENCE_LEVELS.HIGH
        },
        pipelineContext: {
          lifecycleCompleted: true,
          recruitmentCompleted: true,
          lifecycleStage: "completed"
        }
      });

      expect(result.currentLifecycleEvent).toBe(ADVISORY_LIFECYCLE_EVENTS.COMPLETED);
      expect(result.workflowCompleted).toBe(true);
      expect(result.terminalState).toBe(true);
      expect(result.transitionReason).toBe(TRANSITION_REASONS.PIPELINE_COMPLETION_DETECTED);
    });
  });

  describe("unknown state", () => {
    test("UNKNOWN current event suggests NOTIFICATION as next", () => {
      const result = resolveRecruitmentLifecycleTransition({});

      expect(result.currentLifecycleEvent).toBe(ADVISORY_LIFECYCLE_EVENTS.UNKNOWN);
      expect(result.nextAllowedEvents).toEqual([ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION]);
      expect(result.previousAllowedEvents).toEqual([]);
      expect(result.transitionConfidence).toBe(CONFIDENCE_LEVELS.NONE);
      expect(result.transitionReason).toBe(TRANSITION_REASONS.UNKNOWN_CURRENT_EVENT);
    });
  });

  describe("malformed input", () => {
    test("returns invalid-input resolution for null and non-object context", () => {
      const nullResult = resolveRecruitmentLifecycleTransition(null);
      const stringResult = resolveRecruitmentLifecycleTransition("bad");
      const arrayResult = resolveRecruitmentLifecycleTransition([]);

      expect(nullResult.transitionReason).toBe(TRANSITION_REASONS.INVALID_INPUT);
      expect(stringResult.transitionReason).toBe(TRANSITION_REASONS.INVALID_INPUT);
      expect(arrayResult.transitionReason).toBe(TRANSITION_REASONS.INVALID_INPUT);
    });

    test("does not throw for malformed nested fields", () => {
      expect(() =>
        resolveRecruitmentLifecycleTransition({
          lifecycleResolution: "bad",
          pipelineContext: [],
          workflowContext: null
        })
      ).not.toThrow();
    });

    test("ignores unsupported explicit lifecycle values and falls back to UNKNOWN", () => {
      const result = resolveRecruitmentLifecycleTransition({
        lifecycleEvent: "NOT_A_REAL_EVENT"
      });

      expect(result.currentLifecycleEvent).toBe(ADVISORY_LIFECYCLE_EVENTS.UNKNOWN);
    });
  });

  describe("deterministic output", () => {
    test("produces identical results for identical input", () => {
      const context = {
        lifecycleResolution: {
          lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD,
          lifecycleConfidence: CONFIDENCE_LEVELS.HIGH
        }
      };

      const first = resolveRecruitmentLifecycleTransition(context);
      const second = resolveRecruitmentLifecycleTransition(context);

      expect(first).toEqual(second);
      expect(first).not.toBe(second);
    });

    test("forward transition table is stable for every state", () => {
      for (let i = 0; i < ADVISORY_LIFECYCLE_EVENT_LIST.length; i += 1) {
        const event = ADVISORY_LIFECYCLE_EVENT_LIST[i];
        expect(FORWARD_TRANSITIONS[event]).toEqual(
          transitionForEvent(event).nextAllowedEvents
        );
      }
    });
  });

  describe("immutability", () => {
    test("freezes entire transition resolution result object graph", () => {
      const result = transitionForEvent(ADVISORY_LIFECYCLE_EVENTS.RESULT);
      assertAllFrozen(result);
      expect(hasCircularReference(result)).toBe(false);
    });

    test("does not mutate input context", () => {
      const context = {
        lifecycleResolution: {
          lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION,
          lifecycleConfidence: CONFIDENCE_LEVELS.HIGH
        }
      };
      const snapshot = JSON.stringify(context);

      resolveRecruitmentLifecycleTransition(context);

      expect(JSON.stringify(context)).toBe(snapshot);
    });

    test("empty transition resolution sentinel remains frozen", () => {
      assertAllFrozen(EMPTY_LIFECYCLE_TRANSITION_RESOLUTION);
    });
  });

  describe("validation helpers", () => {
    test("validates and summarizes transition resolution results", () => {
      const result = transitionForEvent(ADVISORY_LIFECYCLE_EVENTS.JOINING);

      expect(isLifecycleTransitionResolutionResult(result)).toBe(true);
      expect(validateLifecycleTransitionResolutionResult(result).valid).toBe(true);
      expect(summarizeLifecycleTransitionResolutionResult(result)).toMatchObject({
        phase: 96,
        valid: true,
        currentLifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.JOINING,
        nextAllowedCount: 1
      });
    });

    test("normalizeAdvisoryLifecycleEvent helper", () => {
      expect(normalizeAdvisoryLifecycleEvent("bogus_event")).toBeNull();
      expect(normalizeAdvisoryLifecycleEvent("ADMIT_CARD")).toBe("ADMIT_CARD");
    });
  });

  describe("coordinator integration", () => {
    test("plannedWorkflow includes lifecycle transition resolution when flag is on", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());

      expect(result.plannedWorkflow.currentLifecycleEvent).toBe(
        ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD
      );
      expect(result.plannedWorkflow.nextAllowedEvents).toContain(ADVISORY_LIFECYCLE_EVENTS.RESULT);
      expect(result.plannedWorkflow.workflowCompleted).toBe(false);
      expect(result.plannedWorkflow.terminalState).toBe(false);
      expect(result.plannedWorkflow.transitionConfidence).toBeDefined();
      expect(result.plannedWorkflow.executed).toBe(false);
      expect(result.plannedWorkflow.advisory).toBe(true);
    });

    test("diagnostics append lifecycle transition resolution stage without replacing existing stages", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());
      const summary = result.diagnostics.summary;

      expect(summary.stageCount).toBeGreaterThanOrEqual(7);
      expect(summary.stageTypes.filter((stageType) => stageType === "review").length).toBeGreaterThanOrEqual(
        3
      );
      expect(read(COORDINATOR_MODULE_PATH)).toContain("Lifecycle transition resolution");
      expect(read(COORDINATOR_MODULE_PATH)).toContain("Lifecycle event resolution");
    });

    test("accepts Phase 95 lifecycle resolution output as transition input", () => {
      const lifecycleResolution = resolveRecruitmentLifecycleEvent({ eventType: "result" });
      const transition = resolveRecruitmentLifecycleTransition({ lifecycleResolution });

      expect(transition.currentLifecycleEvent).toBe(ADVISORY_LIFECYCLE_EVENTS.RESULT);
      expect(transition.transitionReason).toBe(TRANSITION_REASONS.RESOLVED_FROM_LIFECYCLE_EVENT);
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

  describe("no persistence", () => {
    test("transition resolution is advisory-only with no execution", () => {
      const result = transitionForEvent(ADVISORY_LIFECYCLE_EVENTS.RESULT);

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

      expect(source).toContain("Phase 96");
      expect(source).toContain("resolveRecruitmentLifecycleTransition");
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

      expect(compatibilitySource).not.toMatch(/recruitmentLifecycleTransitionResolver/);
      expect(pipelineSource).not.toMatch(/recruitmentLifecycleTransitionResolver/);
      expect(workerSource).not.toMatch(/recruitmentLifecycleTransitionResolver/);
    });

    test("coordinator imports resolver for advisory plannedWorkflow enrichment only", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);

      expect(coordinatorSource).toMatch(/recruitmentLifecycleTransitionResolver/);
      expect(coordinatorSource).toMatch(/resolveRecruitmentLifecycleTransition/);
      expect(coordinatorSource).toMatch(/Lifecycle transition resolution/);
    });
  });
});
