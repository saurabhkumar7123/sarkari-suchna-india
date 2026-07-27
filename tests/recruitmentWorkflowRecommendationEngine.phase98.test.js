"use strict";

/**
 * Phase 98 — Recruitment Workflow Recommendation Engine tests.
 * Every lifecycle state, anomaly-driven recommendations, completed workflow,
 * unknown workflow, malformed input, determinism, immutability,
 * coordinator integration, feature flag OFF, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_WORKFLOW_RECOMMENDATION_ENGINE_PHASE,
  RECRUITMENT_WORKFLOW_RECOMMENDATION_ENTITY,
  ADVISORY_LIFECYCLE_EVENTS,
  ADVISORY_LIFECYCLE_EVENT_LIST,
  CONFIDENCE_LEVELS,
  RECOMMENDED_ACTIONS,
  RECOMMENDATION_REASONS,
  RECOMMENDATION_PRIORITY,
  FORWARD_TRANSITIONS,
  RECRUITMENT_WORKFLOW_RECOMMENDATION_ENGINE_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_RECOMMENDATION_ENGINE_METADATA,
  EMPTY_WORKFLOW_RECOMMENDATION,
  recommendRecruitmentWorkflowAction,
  isWorkflowRecommendationResult,
  summarizeWorkflowRecommendationResult
} = require("../server/lib/recruitment/recruitmentWorkflowRecommendationEngine");

const {
  resolveRecruitmentLifecycleEvent
} = require("../server/lib/recruitment/recruitmentLifecycleEventResolver");

const {
  resolveRecruitmentLifecycleTransition
} = require("../server/lib/recruitment/recruitmentLifecycleTransitionResolver");

const {
  validateRecruitmentWorkflow,
  ANOMALY_TYPES
} = require("../server/lib/recruitment/recruitmentWorkflowValidator");

const {
  coordinateRecruitmentWorkflowIntegration
} = require("../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator");

const { processRecruitmentDetection } = require("../server/lib/recruitment/detectionProcessor");
const { runRecruitmentPipeline } = require("../server/lib/recruitment/runRecruitmentPipeline");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowRecommendationEngine.js";
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
    correlationId: "corr-98",
    traceId: "trace-98",
    ...overrides
  };
}

function recommendationContextForEvent(event, overrides = {}) {
  const lifecycleResolution = {
    lifecycleEvent: event,
    lifecycleConfidence: CONFIDENCE_LEVELS.HIGH,
    resolutionReason: "EXPLICIT_ADVISORY_EVENT"
  };
  const transitionResolution = resolveRecruitmentLifecycleTransition({
    lifecycleResolution
  });
  const workflowValidation = validateRecruitmentWorkflow({
    lifecycleResolution,
    transitionResolution
  });

  return {
    lifecycleResolution,
    transitionResolution,
    workflowValidation,
    ...overrides
  };
}

const EXPECTED_MONITOR_STATES = Object.freeze({
  [ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION]: [ADVISORY_LIFECYCLE_EVENTS.APPLICATION],
  [ADVISORY_LIFECYCLE_EVENTS.APPLICATION]: [
    ADVISORY_LIFECYCLE_EVENTS.APPLICATION_CORRECTION,
    ADVISORY_LIFECYCLE_EVENTS.EXAM_CITY,
    ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD
  ],
  [ADVISORY_LIFECYCLE_EVENTS.APPLICATION_CORRECTION]: [
    ADVISORY_LIFECYCLE_EVENTS.EXAM_CITY,
    ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD
  ],
  [ADVISORY_LIFECYCLE_EVENTS.EXAM_CITY]: [ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD],
  [ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD]: [
    ADVISORY_LIFECYCLE_EVENTS.ANSWER_KEY,
    ADVISORY_LIFECYCLE_EVENTS.RESULT
  ],
  [ADVISORY_LIFECYCLE_EVENTS.ANSWER_KEY]: [ADVISORY_LIFECYCLE_EVENTS.RESULT],
  [ADVISORY_LIFECYCLE_EVENTS.RESULT]: [ADVISORY_LIFECYCLE_EVENTS.FINAL_RESULT],
  [ADVISORY_LIFECYCLE_EVENTS.FINAL_RESULT]: [ADVISORY_LIFECYCLE_EVENTS.COUNSELLING],
  [ADVISORY_LIFECYCLE_EVENTS.COUNSELLING]: [ADVISORY_LIFECYCLE_EVENTS.DOCUMENT_VERIFICATION],
  [ADVISORY_LIFECYCLE_EVENTS.DOCUMENT_VERIFICATION]: [ADVISORY_LIFECYCLE_EVENTS.JOINING],
  [ADVISORY_LIFECYCLE_EVENTS.JOINING]: [ADVISORY_LIFECYCLE_EVENTS.COMPLETED]
});

describe("Phase 98 — recruitmentWorkflowRecommendationEngine", () => {
  describe("exports", () => {
    test("exposes phase 98 constants and descriptor", () => {
      expect(RECRUITMENT_WORKFLOW_RECOMMENDATION_ENGINE_PHASE).toBe(98);
      expect(RECRUITMENT_WORKFLOW_RECOMMENDATION_ENTITY).toBe("recruitment_workflow_recommendation");
      expect(RECRUITMENT_WORKFLOW_RECOMMENDATION_ENGINE_DESCRIPTOR.phase).toBe(98);
      expect(RECRUITMENT_WORKFLOW_RECOMMENDATION_ENGINE_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_RECOMMENDATION_ENGINE_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_RECOMMENDATION_ENGINE_METADATA.queriesDatabase).toBe(false);
    });

    test("exports all supported advisory lifecycle events", () => {
      expect(ADVISORY_LIFECYCLE_EVENT_LIST.length).toBe(13);
      expect(FORWARD_TRANSITIONS).toBeDefined();
    });
  });

  describe("every lifecycle state", () => {
    test.each(
      Object.keys(EXPECTED_MONITOR_STATES).map((event) => [event, EXPECTED_MONITOR_STATES[event]])
    )("recommends MONITOR for %s with expected next events", (event, expectedNextEvents) => {
      const result = recommendRecruitmentWorkflowAction(recommendationContextForEvent(event));

      expect(result.recommendedAction).toBe(RECOMMENDED_ACTIONS.MONITOR);
      expect(result.recommendedNextEvents).toEqual(expectedNextEvents);
      expect(result.monitoringRequired).toBe(true);
      expect(result.workflowTerminal).toBe(false);
      expect(result.recommendationPriority).toBe(RECOMMENDATION_PRIORITY.NORMAL);
      expect(result.recommendationReason).toBe(RECOMMENDATION_REASONS.MONITOR_NEXT_LIFECYCLE_EVENTS);
      expect(isWorkflowRecommendationResult(result)).toBe(true);
    });

    test("COMPLETED recommends no further monitoring", () => {
      const result = recommendRecruitmentWorkflowAction(
        recommendationContextForEvent(ADVISORY_LIFECYCLE_EVENTS.COMPLETED)
      );

      expect(result.recommendedAction).toBe(RECOMMENDED_ACTIONS.NO_MONITORING);
      expect(result.recommendedNextEvents).toEqual([]);
      expect(result.monitoringRequired).toBe(false);
      expect(result.workflowTerminal).toBe(true);
      expect(result.recommendationPriority).toBe(RECOMMENDATION_PRIORITY.NONE);
      expect(result.recommendationReason).toBe(RECOMMENDATION_REASONS.WORKFLOW_TERMINAL_REACHED);
    });

    test("UNKNOWN recommends manual review", () => {
      const result = recommendRecruitmentWorkflowAction(
        recommendationContextForEvent(ADVISORY_LIFECYCLE_EVENTS.UNKNOWN)
      );

      expect(result.recommendedAction).toBe(RECOMMENDED_ACTIONS.MANUAL_REVIEW);
      expect(result.monitoringRequired).toBe(false);
      expect(result.workflowTerminal).toBe(false);
      expect(result.recommendationReason).toBe(RECOMMENDATION_REASONS.UNKNOWN_WORKFLOW_STATE);
      expect(result.recommendationPriority).toBeGreaterThanOrEqual(RECOMMENDATION_PRIORITY.ELEVATED);
    });
  });

  describe("anomaly-driven recommendations", () => {
    test("increases recommendation priority when workflow validation reports anomalies", () => {
      const baseline = recommendRecruitmentWorkflowAction(
        recommendationContextForEvent(ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD)
      );

      const anomalous = recommendRecruitmentWorkflowAction({
        lifecycleResolution: {
          lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.RESULT,
          lifecycleConfidence: CONFIDENCE_LEVELS.HIGH
        },
        transitionResolution: resolveRecruitmentLifecycleTransition({
          lifecycleResolution: {
            lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.RESULT,
            lifecycleConfidence: CONFIDENCE_LEVELS.HIGH
          }
        }),
        workflowValidation: validateRecruitmentWorkflow({
          lifecycleResolution: {
            lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.RESULT,
            lifecycleConfidence: CONFIDENCE_LEVELS.HIGH
          },
          transitionResolution: resolveRecruitmentLifecycleTransition({
            lifecycleResolution: {
              lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.RESULT,
              lifecycleConfidence: CONFIDENCE_LEVELS.HIGH
            }
          }),
          workflowContext: {
            observedLifecycleEvents: [
              ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION,
              ADVISORY_LIFECYCLE_EVENTS.RESULT
            ]
          }
        })
      });

      expect(baseline.recommendationPriority).toBe(RECOMMENDATION_PRIORITY.NORMAL);
      expect(anomalous.recommendationPriority).toBeGreaterThan(baseline.recommendationPriority);
      expect(anomalous.recommendationReason).toBe(RECOMMENDATION_REASONS.ANOMALIES_ELEVATE_PRIORITY);
    });

    test("elevates priority for duplicate event anomalies", () => {
      const workflowValidation = validateRecruitmentWorkflow({
        lifecycleResolution: {
          lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD,
          lifecycleConfidence: CONFIDENCE_LEVELS.HIGH
        },
        transitionResolution: resolveRecruitmentLifecycleTransition({
          lifecycleResolution: {
            lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD,
            lifecycleConfidence: CONFIDENCE_LEVELS.HIGH
          }
        }),
        workflowContext: {
          observedLifecycleEvents: [
            ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD,
            ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD
          ]
        }
      });

      const result = recommendRecruitmentWorkflowAction({
        lifecycleResolution: {
          lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD,
          lifecycleConfidence: CONFIDENCE_LEVELS.HIGH
        },
        transitionResolution: resolveRecruitmentLifecycleTransition({
          lifecycleResolution: {
            lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD,
            lifecycleConfidence: CONFIDENCE_LEVELS.HIGH
          }
        }),
        workflowValidation
      });

      expect(workflowValidation.detectedAnomalies.some(
        (anomaly) => anomaly.type === ANOMALY_TYPES.DUPLICATE_LIFECYCLE_EVENT
      )).toBe(true);
      expect(result.recommendationPriority).toBeGreaterThan(RECOMMENDATION_PRIORITY.NORMAL);
      expect(result.recommendationReason).toBe(RECOMMENDATION_REASONS.ANOMALIES_ELEVATE_PRIORITY);
    });
  });

  describe("completed workflow", () => {
    test("marks workflowTerminal when transition resolution reports workflowCompleted", () => {
      const result = recommendRecruitmentWorkflowAction({
        lifecycleResolution: {
          lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.JOINING,
          lifecycleConfidence: CONFIDENCE_LEVELS.HIGH
        },
        transitionResolution: {
          currentLifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.COMPLETED,
          nextAllowedEvents: [],
          workflowCompleted: true,
          terminalState: true,
          transitionConfidence: CONFIDENCE_LEVELS.MEDIUM,
          transitionReason: "PIPELINE_COMPLETION_DETECTED"
        },
        workflowValidation: validateRecruitmentWorkflow({
          lifecycleResolution: {
            lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.COMPLETED,
            lifecycleConfidence: CONFIDENCE_LEVELS.MEDIUM
          },
          transitionResolution: resolveRecruitmentLifecycleTransition({
            lifecycleResolution: {
              lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.COMPLETED,
              lifecycleConfidence: CONFIDENCE_LEVELS.MEDIUM
            },
            pipelineContext: {
              lifecycleCompleted: true,
              recruitmentCompleted: true,
              lifecycleStage: "completed"
            }
          })
        })
      });

      expect(result.workflowTerminal).toBe(true);
      expect(result.recommendedAction).toBe(RECOMMENDED_ACTIONS.NO_MONITORING);
      expect(result.monitoringRequired).toBe(false);
      expect(result.recommendationPriority).toBe(RECOMMENDATION_PRIORITY.NONE);
    });
  });

  describe("unknown workflow", () => {
    test("recommends manual review for unknown lifecycle state", () => {
      const result = recommendRecruitmentWorkflowAction({
        lifecycleResolution: {
          lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.UNKNOWN,
          lifecycleConfidence: CONFIDENCE_LEVELS.NONE
        },
        transitionResolution: resolveRecruitmentLifecycleTransition({}),
        workflowValidation: validateRecruitmentWorkflow({
          lifecycleResolution: {
            lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.UNKNOWN,
            lifecycleConfidence: CONFIDENCE_LEVELS.NONE
          },
          transitionResolution: resolveRecruitmentLifecycleTransition({})
        })
      });

      expect(result.recommendedAction).toBe(RECOMMENDED_ACTIONS.MANUAL_REVIEW);
      expect(result.recommendationConfidence).toBe(CONFIDENCE_LEVELS.NONE);
      expect(result.recommendationReason).toBe(RECOMMENDATION_REASONS.UNKNOWN_WORKFLOW_STATE);
    });
  });

  describe("malformed input", () => {
    test("returns invalid-input recommendation for null and non-object context", () => {
      const nullResult = recommendRecruitmentWorkflowAction(null);
      const stringResult = recommendRecruitmentWorkflowAction("bad");
      const arrayResult = recommendRecruitmentWorkflowAction([]);

      expect(nullResult.recommendationReason).toBe(RECOMMENDATION_REASONS.INVALID_INPUT);
      expect(stringResult.recommendationReason).toBe(RECOMMENDATION_REASONS.INVALID_INPUT);
      expect(arrayResult.recommendationReason).toBe(RECOMMENDATION_REASONS.INVALID_INPUT);
      expect(nullResult.recommendedAction).toBe(RECOMMENDED_ACTIONS.MANUAL_REVIEW);
    });

    test("does not throw for malformed nested fields", () => {
      expect(() =>
        recommendRecruitmentWorkflowAction({
          lifecycleResolution: "bad",
          transitionResolution: [],
          workflowValidation: null
        })
      ).not.toThrow();
    });
  });

  describe("deterministic output", () => {
    test("produces identical results for identical input", () => {
      const context = recommendationContextForEvent(ADVISORY_LIFECYCLE_EVENTS.RESULT, {
        workflowContext: {
          observedLifecycleEvents: [
            ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION,
            ADVISORY_LIFECYCLE_EVENTS.APPLICATION,
            ADVISORY_LIFECYCLE_EVENTS.RESULT
          ]
        }
      });

      const first = recommendRecruitmentWorkflowAction(context);
      const second = recommendRecruitmentWorkflowAction(context);

      expect(first).toEqual(second);
      expect(first).not.toBe(second);
    });
  });

  describe("immutability", () => {
    test("freezes entire workflow recommendation result object graph", () => {
      const result = recommendRecruitmentWorkflowAction(
        recommendationContextForEvent(ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD)
      );
      assertAllFrozen(result);
      expect(hasCircularReference(result)).toBe(false);
    });

    test("does not mutate input context", () => {
      const context = recommendationContextForEvent(ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION);
      const snapshot = JSON.stringify(context);

      recommendRecruitmentWorkflowAction(context);

      expect(JSON.stringify(context)).toBe(snapshot);
    });

    test("empty workflow recommendation sentinel remains frozen", () => {
      assertAllFrozen(EMPTY_WORKFLOW_RECOMMENDATION);
    });
  });

  describe("validation helpers", () => {
    test("validates and summarizes workflow recommendation results", () => {
      const result = recommendRecruitmentWorkflowAction(
        recommendationContextForEvent(ADVISORY_LIFECYCLE_EVENTS.JOINING)
      );

      expect(isWorkflowRecommendationResult(result)).toBe(true);
      expect(summarizeWorkflowRecommendationResult(result)).toMatchObject({
        phase: 98,
        valid: true,
        recommendedAction: RECOMMENDED_ACTIONS.MONITOR,
        monitoringRequired: true
      });
    });

    test("accepts Phase 95, 96, and 97 outputs as recommendation input", () => {
      const lifecycleResolution = resolveRecruitmentLifecycleEvent({ eventType: "result" });
      const transitionResolution = resolveRecruitmentLifecycleTransition({ lifecycleResolution });
      const workflowValidation = validateRecruitmentWorkflow({
        lifecycleResolution,
        transitionResolution,
        workflowContext: {
          observedLifecycleEvents: [
            ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION,
            ADVISORY_LIFECYCLE_EVENTS.APPLICATION,
            ADVISORY_LIFECYCLE_EVENTS.RESULT
          ]
        }
      });
      const result = recommendRecruitmentWorkflowAction({
        lifecycleResolution,
        transitionResolution,
        workflowValidation
      });

      expect(result.recommendedAction).toBe(RECOMMENDED_ACTIONS.MONITOR);
      expect(result.recommendedNextEvents).toContain(ADVISORY_LIFECYCLE_EVENTS.FINAL_RESULT);
    });
  });

  describe("coordinator integration", () => {
    test("plannedWorkflow includes workflow recommendation when flag is on", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());

      expect(result.plannedWorkflow.recommendedAction).toBeDefined();
      expect(Array.isArray(result.plannedWorkflow.recommendedNextEvents)).toBe(true);
      expect(result.plannedWorkflow.recommendationPriority).toBeDefined();
      expect(result.plannedWorkflow.recommendationConfidence).toBeDefined();
      expect(typeof result.plannedWorkflow.monitoringRequired).toBe("boolean");
      expect(typeof result.plannedWorkflow.workflowTerminal).toBe("boolean");
      expect(result.plannedWorkflow.executed).toBe(false);
      expect(result.plannedWorkflow.advisory).toBe(true);
    });

    test("diagnostics append workflow recommendation stage without replacing existing stages", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());
      const summary = result.diagnostics.summary;

      expect(summary.stageCount).toBeGreaterThanOrEqual(9);
      expect(summary.stageTypes.filter((stageType) => stageType === "review").length).toBeGreaterThanOrEqual(
        5
      );
      expect(read(COORDINATOR_MODULE_PATH)).toContain("Workflow recommendation");
      expect(read(COORDINATOR_MODULE_PATH)).toContain("Workflow validation");
      expect(read(COORDINATOR_MODULE_PATH)).toContain("Lifecycle transition resolution");
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

  describe("no persistence", () => {
    test("workflow recommendation is advisory-only with no execution", () => {
      const result = recommendRecruitmentWorkflowAction(
        recommendationContextForEvent(ADVISORY_LIFECYCLE_EVENTS.RESULT)
      );

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

      expect(source).toContain("Phase 98");
      expect(source).toContain("recommendRecruitmentWorkflowAction");
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

    test("recommendation engine is not wired into pipeline, compatibility layer, or siteWorker directly", () => {
      const compatibilitySource = read(COMPATIBILITY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);

      expect(compatibilitySource).not.toMatch(/recruitmentWorkflowRecommendationEngine/);
      expect(pipelineSource).not.toMatch(/recruitmentWorkflowRecommendationEngine/);
      expect(workerSource).not.toMatch(/recruitmentWorkflowRecommendationEngine/);
    });

    test("coordinator imports recommendation engine for advisory plannedWorkflow enrichment only", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);

      expect(coordinatorSource).toMatch(/recruitmentWorkflowRecommendationEngine/);
      expect(coordinatorSource).toMatch(/recommendRecruitmentWorkflowAction/);
      expect(coordinatorSource).toMatch(/Workflow recommendation/);
    });
  });
});
