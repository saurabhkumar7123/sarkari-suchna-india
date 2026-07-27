"use strict";

/**
 * Phase 99 — Recruitment Workflow Advisory Summary tests.
 * Healthy, warning, critical, and unknown workflows, malformed input,
 * determinism, immutability, coordinator integration, feature flag OFF,
 * and backward compatibility.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_PHASE,
  RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_ENTITY,
  ADVISORY_LIFECYCLE_EVENTS,
  CONFIDENCE_LEVELS,
  RECOMMENDED_ACTIONS,
  WORKFLOW_COMPLETENESS,
  OVERALL_HEALTH,
  ANOMALY_TYPES,
  RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_METADATA,
  EMPTY_WORKFLOW_ADVISORY_SUMMARY,
  buildRecruitmentWorkflowAdvisorySummary,
  isWorkflowAdvisorySummaryResult,
  summarizeWorkflowAdvisorySummaryResult
} = require("../server/lib/recruitment/recruitmentWorkflowAdvisorySummary");

const {
  resolveRecruitmentLifecycleEvent
} = require("../server/lib/recruitment/recruitmentLifecycleEventResolver");

const {
  resolveRecruitmentLifecycleTransition
} = require("../server/lib/recruitment/recruitmentLifecycleTransitionResolver");

const {
  validateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowValidator");

const {
  recommendRecruitmentWorkflowAction
} = require("../server/lib/recruitment/recruitmentWorkflowRecommendationEngine");

const {
  coordinateRecruitmentWorkflowIntegration
} = require("../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator");

const { processRecruitmentDetection } = require("../server/lib/recruitment/detectionProcessor");
const { runRecruitmentPipeline } = require("../server/lib/recruitment/runRecruitmentPipeline");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisorySummary.js";
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
    correlationId: "corr-99",
    traceId: "trace-99",
    ...overrides
  };
}

function advisoryContextForEvent(event, overrides = {}) {
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
  const workflowRecommendation = recommendRecruitmentWorkflowAction({
    lifecycleResolution,
    transitionResolution,
    workflowValidation
  });

  return {
    lifecycleResolution,
    transitionResolution,
    workflowValidation,
    workflowRecommendation,
    ...overrides
  };
}

describe("Phase 99 — recruitmentWorkflowAdvisorySummary", () => {
  describe("exports", () => {
    test("exposes phase 99 constants and descriptor", () => {
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_PHASE).toBe(99);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_ENTITY).toBe(
        "recruitment_workflow_advisory_summary"
      );
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_DESCRIPTOR.phase).toBe(99);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_METADATA.queriesDatabase).toBe(false);
    });
  });

  describe("healthy workflow", () => {
    test("reports HEALTHY when workflow is valid with no anomalies", () => {
      const result = buildRecruitmentWorkflowAdvisorySummary(
        advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD)
      );

      expect(result.overallHealth).toBe(OVERALL_HEALTH.HEALTHY);
      expect(result.workflowValid).toBe(true);
      expect(result.anomalyCount).toBe(0);
      expect(result.currentLifecycle).toBe(ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD);
      expect(result.recommendedAction).toBe(RECOMMENDED_ACTIONS.MONITOR);
      expect(isWorkflowAdvisorySummaryResult(result)).toBe(true);
    });
  });

  describe("warning workflow", () => {
    test("reports WARNING for minor anomalies such as duplicate lifecycle events", () => {
      const workflowValidation = {
        workflowValid: false,
        workflowCompleteness: WORKFLOW_COMPLETENESS.PARTIAL,
        validationConfidence: CONFIDENCE_LEVELS.LOW,
        validationReason: "ANOMALIES_DETECTED",
        detectedAnomalies: Object.freeze([
          Object.freeze({
            type: ANOMALY_TYPES.DUPLICATE_LIFECYCLE_EVENT,
            event: ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD
          })
        ]),
        advisory: true,
        architectureOnly: true,
        executed: false
      };

      const result = buildRecruitmentWorkflowAdvisorySummary({
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
        workflowValidation,
        workflowRecommendation: recommendRecruitmentWorkflowAction({
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
        })
      });

      expect(result.overallHealth).toBe(OVERALL_HEALTH.WARNING);
      expect(result.workflowValid).toBe(false);
      expect(result.anomalyCount).toBe(1);
    });
  });

  describe("critical workflow", () => {
    test("reports CRITICAL for invalid lifecycle transitions", () => {
      const workflowValidation = validateRecruitmentWorkflow({
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
      });

      const result = buildRecruitmentWorkflowAdvisorySummary({
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
        workflowValidation,
        workflowRecommendation: recommendRecruitmentWorkflowAction({
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
          workflowValidation
        })
      });

      expect(workflowValidation.detectedAnomalies.some(
        (anomaly) => anomaly.type === ANOMALY_TYPES.INVALID_LIFECYCLE_TRANSITION
      )).toBe(true);
      expect(result.overallHealth).toBe(OVERALL_HEALTH.CRITICAL);
      expect(result.workflowValid).toBe(false);
    });

    test("reports CRITICAL for terminal state violations", () => {
      const workflowValidation = validateRecruitmentWorkflow({
        lifecycleResolution: {
          lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.COMPLETED,
          lifecycleConfidence: CONFIDENCE_LEVELS.MEDIUM
        },
        transitionResolution: {
          currentLifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.RESULT,
          nextAllowedEvents: [ADVISORY_LIFECYCLE_EVENTS.FINAL_RESULT],
          workflowCompleted: false,
          terminalState: true,
          transitionConfidence: CONFIDENCE_LEVELS.MEDIUM,
          transitionReason: "PIPELINE_TERMINAL_MISMATCH"
        },
        workflowContext: {
          observedLifecycleEvents: [
            ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION,
            ADVISORY_LIFECYCLE_EVENTS.RESULT
          ]
        }
      });

      const result = buildRecruitmentWorkflowAdvisorySummary({
        lifecycleResolution: {
          lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.COMPLETED,
          lifecycleConfidence: CONFIDENCE_LEVELS.MEDIUM
        },
        transitionResolution: {
          currentLifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.RESULT,
          nextAllowedEvents: [ADVISORY_LIFECYCLE_EVENTS.FINAL_RESULT],
          workflowCompleted: false,
          terminalState: true,
          transitionConfidence: CONFIDENCE_LEVELS.MEDIUM,
          transitionReason: "PIPELINE_TERMINAL_MISMATCH"
        },
        workflowValidation,
        workflowRecommendation: recommendRecruitmentWorkflowAction({
          lifecycleResolution: {
            lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.COMPLETED,
            lifecycleConfidence: CONFIDENCE_LEVELS.MEDIUM
          },
          transitionResolution: {
            currentLifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.RESULT,
            nextAllowedEvents: [ADVISORY_LIFECYCLE_EVENTS.FINAL_RESULT],
            workflowCompleted: false,
            terminalState: true,
            transitionConfidence: CONFIDENCE_LEVELS.MEDIUM,
            transitionReason: "PIPELINE_TERMINAL_MISMATCH"
          },
          workflowValidation
        })
      });

      expect(workflowValidation.detectedAnomalies.some(
        (anomaly) => anomaly.type === ANOMALY_TYPES.TERMINAL_STATE_VIOLATION
      )).toBe(true);
      expect(result.overallHealth).toBe(OVERALL_HEALTH.CRITICAL);
    });
  });

  describe("unknown workflow", () => {
    test("reports UNKNOWN health for unknown lifecycle state", () => {
      const result = buildRecruitmentWorkflowAdvisorySummary({
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
        }),
        workflowRecommendation: recommendRecruitmentWorkflowAction({
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
        })
      });

      expect(result.currentLifecycle).toBe(ADVISORY_LIFECYCLE_EVENTS.UNKNOWN);
      expect(result.overallHealth).toBe(OVERALL_HEALTH.UNKNOWN);
      expect(result.overallConfidence).toBe(CONFIDENCE_LEVELS.NONE);
      expect(result.workflowCompleteness).toBe(WORKFLOW_COMPLETENESS.UNKNOWN);
    });
  });

  describe("malformed input", () => {
    test("returns safe defaults for null and non-object context", () => {
      const nullResult = buildRecruitmentWorkflowAdvisorySummary(null);
      const stringResult = buildRecruitmentWorkflowAdvisorySummary("bad");
      const arrayResult = buildRecruitmentWorkflowAdvisorySummary([]);

      expect(nullResult).toEqual(EMPTY_WORKFLOW_ADVISORY_SUMMARY);
      expect(stringResult.overallHealth).toBe(OVERALL_HEALTH.UNKNOWN);
      expect(arrayResult.overallHealth).toBe(OVERALL_HEALTH.UNKNOWN);
    });

    test("does not throw for malformed nested fields", () => {
      expect(() =>
        buildRecruitmentWorkflowAdvisorySummary({
          lifecycleResolution: "bad",
          transitionResolution: [],
          workflowValidation: null,
          workflowRecommendation: 42
        })
      ).not.toThrow();
    });
  });

  describe("deterministic output", () => {
    test("produces identical results for identical input", () => {
      const context = advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.RESULT, {
        workflowContext: {
          observedLifecycleEvents: [
            ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION,
            ADVISORY_LIFECYCLE_EVENTS.APPLICATION,
            ADVISORY_LIFECYCLE_EVENTS.RESULT
          ]
        }
      });

      const first = buildRecruitmentWorkflowAdvisorySummary(context);
      const second = buildRecruitmentWorkflowAdvisorySummary(context);

      expect(first).toEqual(second);
      expect(first).not.toBe(second);
    });
  });

  describe("immutability", () => {
    test("freezes entire advisory summary result object graph", () => {
      const result = buildRecruitmentWorkflowAdvisorySummary(
        advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.JOINING)
      );
      assertAllFrozen(result);
      expect(hasCircularReference(result)).toBe(false);
    });

    test("does not mutate input context", () => {
      const context = advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION);
      const snapshot = JSON.stringify(context);

      buildRecruitmentWorkflowAdvisorySummary(context);

      expect(JSON.stringify(context)).toBe(snapshot);
    });

    test("empty advisory summary sentinel remains frozen", () => {
      assertAllFrozen(EMPTY_WORKFLOW_ADVISORY_SUMMARY);
    });
  });

  describe("validation helpers", () => {
    test("validates and summarizes advisory summary results", () => {
      const result = buildRecruitmentWorkflowAdvisorySummary(
        advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.JOINING)
      );

      expect(isWorkflowAdvisorySummaryResult(result)).toBe(true);
      expect(summarizeWorkflowAdvisorySummaryResult(result)).toMatchObject({
        phase: 99,
        valid: true,
        overallHealth: OVERALL_HEALTH.HEALTHY,
        monitoringRequired: true
      });
    });

    test("aggregates confidence from lifecycle, transition, validation, and recommendation", () => {
      const result = buildRecruitmentWorkflowAdvisorySummary(
        advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD)
      );

      expect(result.overallConfidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
    });

    test("accepts Phase 95, 96, 97, and 98 outputs as summary input", () => {
      const lifecycleResolution = resolveRecruitmentLifecycleEvent({ eventType: "result" });
      const transitionResolution = resolveRecruitmentLifecycleTransition({ lifecycleResolution });
      const workflowValidation = validateRecruitmentWorkflow({
        lifecycleResolution,
        transitionResolution
      });
      const workflowRecommendation = recommendRecruitmentWorkflowAction({
        lifecycleResolution,
        transitionResolution,
        workflowValidation
      });
      const result = buildRecruitmentWorkflowAdvisorySummary({
        lifecycleResolution,
        transitionResolution,
        workflowValidation,
        workflowRecommendation
      });

      expect(result.currentLifecycle).toBe(ADVISORY_LIFECYCLE_EVENTS.RESULT);
      expect(result.recommendedAction).toBe(RECOMMENDED_ACTIONS.MONITOR);
      expect(result.overallHealth).toBe(OVERALL_HEALTH.HEALTHY);
    });
  });

  describe("coordinator integration", () => {
    test("plannedWorkflow includes workflowAdvisorySummary when flag is on", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());

      expect(result.plannedWorkflow.workflowAdvisorySummary).toBeDefined();
      expect(result.plannedWorkflow.workflowAdvisorySummary.overallHealth).toBeDefined();
      expect(result.plannedWorkflow.workflowAdvisorySummary.overallConfidence).toBeDefined();
      expect(typeof result.plannedWorkflow.workflowAdvisorySummary.workflowValid).toBe("boolean");
      expect(typeof result.plannedWorkflow.workflowAdvisorySummary.anomalyCount).toBe("number");
      expect(result.plannedWorkflow.workflowAdvisorySummary.advisory).toBe(true);
      expect(result.plannedWorkflow.workflowAdvisorySummary.executed).toBe(false);
    });

    test("diagnostics append workflow advisory summary stage without replacing existing stages", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());
      const summary = result.diagnostics.summary;

      expect(summary.stageCount).toBeGreaterThanOrEqual(10);
      expect(summary.stageTypes.filter((stageType) => stageType === "review").length).toBeGreaterThanOrEqual(
        6
      );
      expect(read(COORDINATOR_MODULE_PATH)).toContain("Workflow advisory summary");
      expect(read(COORDINATOR_MODULE_PATH)).toContain("Workflow recommendation");
      expect(read(COORDINATOR_MODULE_PATH)).toContain("Workflow validation");
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

  describe("backward compatibility", () => {
    test("plannedWorkflow retains all pre-phase-99 fields", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());
      const planned = result.plannedWorkflow;

      expect(planned.actionPlanSummary).toBeDefined();
      expect(planned.persistencePlanSummary).toBeDefined();
      expect(planned.lifecycleEvent).toBeDefined();
      expect(planned.lifecycleConfidence).toBeDefined();
      expect(planned.currentLifecycleEvent).toBeDefined();
      expect(Array.isArray(planned.nextAllowedEvents)).toBe(true);
      expect(typeof planned.workflowCompleted).toBe("boolean");
      expect(typeof planned.workflowValid).toBe("boolean");
      expect(planned.workflowCompleteness).toBeDefined();
      expect(Array.isArray(planned.detectedAnomalies)).toBe(true);
      expect(planned.recommendedAction).toBeDefined();
      expect(Array.isArray(planned.recommendedNextEvents)).toBe(true);
      expect(planned.recommendationPriority).toBeDefined();
      expect(planned.recommendationConfidence).toBeDefined();
      expect(typeof planned.monitoringRequired).toBe("boolean");
      expect(typeof planned.workflowTerminal).toBe("boolean");
      expect(planned.architectureOnly).toBe(true);
      expect(planned.executed).toBe(false);
      expect(planned.advisory).toBe(true);
    });
  });

  describe("no persistence", () => {
    test("advisory summary is advisory-only with no execution", () => {
      const result = buildRecruitmentWorkflowAdvisorySummary(
        advisoryContextForEvent(ADVISORY_LIFECYCLE_EVENTS.RESULT)
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

      expect(source).toContain("Phase 99");
      expect(source).toContain("buildRecruitmentWorkflowAdvisorySummary");
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

    test("advisory summary is not wired into pipeline, compatibility layer, or siteWorker directly", () => {
      const compatibilitySource = read(COMPATIBILITY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);

      expect(compatibilitySource).not.toMatch(/recruitmentWorkflowAdvisorySummary/);
      expect(pipelineSource).not.toMatch(/recruitmentWorkflowAdvisorySummary/);
      expect(workerSource).not.toMatch(/recruitmentWorkflowAdvisorySummary/);
    });

    test("coordinator imports advisory summary for plannedWorkflow enrichment only", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);

      expect(coordinatorSource).toMatch(/recruitmentWorkflowAdvisorySummary/);
      expect(coordinatorSource).toMatch(/buildRecruitmentWorkflowAdvisorySummary/);
      expect(coordinatorSource).toMatch(/Workflow advisory summary/);
    });
  });
});
