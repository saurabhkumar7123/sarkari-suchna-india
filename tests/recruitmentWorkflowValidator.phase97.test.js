"use strict";

/**
 * Phase 97 — Recruitment Workflow Validator tests.
 * Valid workflow, invalid transition, duplicate event, missing expected event,
 * terminal violation, unknown state, completed workflow, malformed input,
 * determinism, immutability, coordinator integration, feature flag OFF,
 * and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_WORKFLOW_VALIDATOR_PHASE,
  RECRUITMENT_WORKFLOW_VALIDATION_ENTITY,
  ADVISORY_LIFECYCLE_EVENTS,
  CONFIDENCE_LEVELS,
  VALIDATION_REASONS,
  ANOMALY_TYPES,
  WORKFLOW_COMPLETENESS,
  RECRUITMENT_WORKFLOW_VALIDATOR_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_VALIDATOR_METADATA,
  EMPTY_WORKFLOW_VALIDATION,
  normalizeAdvisoryLifecycleEvent,
  isValidLifecycleTransition,
  validateRecruitmentWorkflow,
  isWorkflowValidationResult,
  summarizeWorkflowValidationResult
} = require("../server/lib/recruitment/recruitmentWorkflowValidator");

const {
  resolveRecruitmentLifecycleEvent
} = require("../server/lib/recruitment/recruitmentLifecycleEventResolver");

const {
  resolveRecruitmentLifecycleTransition
} = require("../server/lib/recruitment/recruitmentLifecycleTransitionResolver");

const {
  coordinateRecruitmentWorkflowIntegration
} = require("../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator");

const { processRecruitmentDetection } = require("../server/lib/recruitment/detectionProcessor");
const { runRecruitmentPipeline } = require("../server/lib/recruitment/runRecruitmentPipeline");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowValidator.js";
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
    correlationId: "corr-97",
    traceId: "trace-97",
    ...overrides
  };
}

function validationContextForEvent(event, overrides = {}) {
  const lifecycleResolution = {
    lifecycleEvent: event,
    lifecycleConfidence: CONFIDENCE_LEVELS.HIGH,
    resolutionReason: "EXPLICIT_ADVISORY_EVENT"
  };
  const transitionResolution = resolveRecruitmentLifecycleTransition({
    lifecycleResolution
  });

  return {
    lifecycleResolution,
    transitionResolution,
    ...overrides
  };
}

describe("Phase 97 — recruitmentWorkflowValidator", () => {
  describe("exports", () => {
    test("exposes phase 97 constants and descriptor", () => {
      expect(RECRUITMENT_WORKFLOW_VALIDATOR_PHASE).toBe(97);
      expect(RECRUITMENT_WORKFLOW_VALIDATION_ENTITY).toBe("recruitment_workflow_validation");
      expect(RECRUITMENT_WORKFLOW_VALIDATOR_DESCRIPTOR.phase).toBe(97);
      expect(RECRUITMENT_WORKFLOW_VALIDATOR_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_VALIDATOR_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_VALIDATOR_METADATA.queriesDatabase).toBe(false);
    });
  });

  describe("valid workflow", () => {
    test("accepts consistent single-event advisory workflow", () => {
      const result = validateRecruitmentWorkflow(
        validationContextForEvent(ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD)
      );

      expect(result.workflowValid).toBe(true);
      expect(result.workflowCompleteness).toBe(WORKFLOW_COMPLETENESS.PARTIAL);
      expect(result.validationReason).toBe(VALIDATION_REASONS.INCOMPLETE_WORKFLOW);
      expect(result.validationConfidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
      expect(result.detectedAnomalies).toEqual([]);
      expect(isWorkflowValidationResult(result)).toBe(true);
    });

    test("accepts valid multi-step lifecycle sequence", () => {
      const result = validateRecruitmentWorkflow({
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
            ADVISORY_LIFECYCLE_EVENTS.APPLICATION,
            ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD,
            ADVISORY_LIFECYCLE_EVENTS.RESULT
          ]
        }
      });

      expect(result.workflowValid).toBe(true);
      expect(result.invalidTransitions).toEqual([]);
      expect(result.duplicateEvents).toEqual([]);
    });
  });

  describe("invalid transition", () => {
    test("detects invalid lifecycle transition anomaly", () => {
      const result = validateRecruitmentWorkflow({
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

      expect(result.workflowValid).toBe(false);
      expect(result.invalidTransitions).toContain("NOTIFICATION->RESULT");
      expect(result.detectedAnomalies.some(
        (anomaly) => anomaly.type === ANOMALY_TYPES.INVALID_LIFECYCLE_TRANSITION
      )).toBe(true);
      expect(result.validationReason).toBe(VALIDATION_REASONS.ANOMALIES_DETECTED);
    });
  });

  describe("duplicate event", () => {
    test("detects duplicate lifecycle event anomaly", () => {
      const result = validateRecruitmentWorkflow({
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

      expect(result.workflowValid).toBe(false);
      expect(result.duplicateEvents).toContain(ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD);
      expect(result.detectedAnomalies.some(
        (anomaly) => anomaly.type === ANOMALY_TYPES.DUPLICATE_LIFECYCLE_EVENT
      )).toBe(true);
    });
  });

  describe("missing expected event", () => {
    test("detects missing expected lifecycle events for invalid jumps", () => {
      const result = validateRecruitmentWorkflow({
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

      expect(result.workflowValid).toBe(false);
      expect(result.missingExpectedEvents.length).toBeGreaterThan(0);
      expect(result.detectedAnomalies.some(
        (anomaly) => anomaly.type === ANOMALY_TYPES.MISSING_EXPECTED_LIFECYCLE_EVENT
      )).toBe(true);
    });
  });

  describe("terminal violation", () => {
    test("detects terminal state violation when event follows COMPLETED", () => {
      const result = validateRecruitmentWorkflow({
        lifecycleResolution: {
          lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.JOINING,
          lifecycleConfidence: CONFIDENCE_LEVELS.HIGH
        },
        transitionResolution: resolveRecruitmentLifecycleTransition({
          lifecycleResolution: {
            lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.JOINING,
            lifecycleConfidence: CONFIDENCE_LEVELS.HIGH
          }
        }),
        workflowContext: {
          observedLifecycleEvents: [
            ADVISORY_LIFECYCLE_EVENTS.COMPLETED,
            ADVISORY_LIFECYCLE_EVENTS.JOINING
          ]
        }
      });

      expect(result.workflowValid).toBe(false);
      expect(result.detectedAnomalies.some(
        (anomaly) => anomaly.type === ANOMALY_TYPES.TERMINAL_STATE_VIOLATION
      )).toBe(true);
    });
  });

  describe("unknown state", () => {
    test("flags unknown lifecycle state when current event is UNKNOWN", () => {
      const result = validateRecruitmentWorkflow({
        lifecycleResolution: {
          lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.UNKNOWN,
          lifecycleConfidence: CONFIDENCE_LEVELS.NONE
        },
        transitionResolution: resolveRecruitmentLifecycleTransition({})
      });

      expect(result.workflowValid).toBe(false);
      expect(result.workflowCompleteness).toBe(WORKFLOW_COMPLETENESS.UNKNOWN);
      expect(result.validationReason).toBe(VALIDATION_REASONS.UNKNOWN_WORKFLOW_STATE);
      expect(result.detectedAnomalies.some(
        (anomaly) => anomaly.type === ANOMALY_TYPES.UNKNOWN_LIFECYCLE_STATE
      )).toBe(true);
    });

    test("flags unsupported raw lifecycle values as unknown state", () => {
      const result = validateRecruitmentWorkflow({
        lifecycleEvent: "NOT_A_REAL_EVENT",
        lifecycleResolution: {
          lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD,
          lifecycleConfidence: CONFIDENCE_LEVELS.HIGH
        },
        transitionResolution: resolveRecruitmentLifecycleTransition({
          lifecycleResolution: {
            lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD,
            lifecycleConfidence: CONFIDENCE_LEVELS.HIGH
          }
        })
      });

      expect(result.detectedAnomalies.some(
        (anomaly) => anomaly.type === ANOMALY_TYPES.UNKNOWN_LIFECYCLE_STATE
      )).toBe(true);
    });
  });

  describe("completed workflow", () => {
    test("marks workflow completeness COMPLETE for terminal COMPLETED state", () => {
      const result = validateRecruitmentWorkflow(
        validationContextForEvent(ADVISORY_LIFECYCLE_EVENTS.COMPLETED)
      );

      expect(result.workflowValid).toBe(true);
      expect(result.workflowCompleteness).toBe(WORKFLOW_COMPLETENESS.COMPLETE);
      expect(result.validationReason).toBe(VALIDATION_REASONS.WORKFLOW_CONSISTENT);
      expect(result.validationConfidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });

    test("detects workflow completed but later event observed", () => {
      const result = validateRecruitmentWorkflow({
        lifecycleResolution: {
          lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD,
          lifecycleConfidence: CONFIDENCE_LEVELS.HIGH
        },
        transitionResolution: {
          currentLifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.COMPLETED,
          workflowCompleted: true,
          terminalState: true,
          transitionConfidence: CONFIDENCE_LEVELS.MEDIUM,
          transitionReason: "PIPELINE_COMPLETION_DETECTED"
        },
        pipelineContext: {
          lifecycleCompleted: true,
          recruitmentCompleted: true,
          lifecycleStage: "completed"
        }
      });

      expect(result.workflowValid).toBe(false);
      expect(result.detectedAnomalies.some(
        (anomaly) => anomaly.type === ANOMALY_TYPES.WORKFLOW_COMPLETED_LATER_EVENT
      )).toBe(true);
    });
  });

  describe("malformed input", () => {
    test("returns invalid-input validation for null and non-object context", () => {
      const nullResult = validateRecruitmentWorkflow(null);
      const stringResult = validateRecruitmentWorkflow("bad");
      const arrayResult = validateRecruitmentWorkflow([]);

      expect(nullResult.validationReason).toBe(VALIDATION_REASONS.INVALID_INPUT);
      expect(stringResult.validationReason).toBe(VALIDATION_REASONS.INVALID_INPUT);
      expect(arrayResult.validationReason).toBe(VALIDATION_REASONS.INVALID_INPUT);
      expect(nullResult.workflowValid).toBe(false);
    });

    test("does not throw for malformed nested fields", () => {
      expect(() =>
        validateRecruitmentWorkflow({
          lifecycleResolution: "bad",
          transitionResolution: [],
          workflowContext: null
        })
      ).not.toThrow();
    });
  });

  describe("deterministic output", () => {
    test("produces identical results for identical input", () => {
      const context = validationContextForEvent(ADVISORY_LIFECYCLE_EVENTS.RESULT, {
        workflowContext: {
          observedLifecycleEvents: [
            ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION,
            ADVISORY_LIFECYCLE_EVENTS.APPLICATION,
            ADVISORY_LIFECYCLE_EVENTS.RESULT
          ]
        }
      });

      const first = validateRecruitmentWorkflow(context);
      const second = validateRecruitmentWorkflow(context);

      expect(first).toEqual(second);
      expect(first).not.toBe(second);
    });
  });

  describe("immutability", () => {
    test("freezes entire workflow validation result object graph", () => {
      const result = validateRecruitmentWorkflow(
        validationContextForEvent(ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD)
      );
      assertAllFrozen(result);
      expect(hasCircularReference(result)).toBe(false);
    });

    test("does not mutate input context", () => {
      const context = validationContextForEvent(ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION, {
        workflowContext: {
          observedLifecycleEvents: [ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION]
        }
      });
      const snapshot = JSON.stringify(context);

      validateRecruitmentWorkflow(context);

      expect(JSON.stringify(context)).toBe(snapshot);
    });

    test("empty workflow validation sentinel remains frozen", () => {
      assertAllFrozen(EMPTY_WORKFLOW_VALIDATION);
    });
  });

  describe("validation helpers", () => {
    test("validates and summarizes workflow validation results", () => {
      const result = validateRecruitmentWorkflow(
        validationContextForEvent(ADVISORY_LIFECYCLE_EVENTS.JOINING)
      );

      expect(isWorkflowValidationResult(result)).toBe(true);
      expect(summarizeWorkflowValidationResult(result)).toMatchObject({
        phase: 97,
        valid: true,
        workflowCompleteness: WORKFLOW_COMPLETENESS.PARTIAL,
        validationConfidence: CONFIDENCE_LEVELS.MEDIUM
      });
    });

    test("normalizeAdvisoryLifecycleEvent and isValidLifecycleTransition helpers", () => {
      expect(normalizeAdvisoryLifecycleEvent("bogus_event")).toBeNull();
      expect(normalizeAdvisoryLifecycleEvent("ADMIT_CARD")).toBe("ADMIT_CARD");
      expect(isValidLifecycleTransition("NOTIFICATION", "APPLICATION")).toBe(true);
      expect(isValidLifecycleTransition("NOTIFICATION", "RESULT")).toBe(false);
    });

    test("accepts Phase 95 and Phase 96 outputs as validation input", () => {
      const lifecycleResolution = resolveRecruitmentLifecycleEvent({ eventType: "result" });
      const transitionResolution = resolveRecruitmentLifecycleTransition({ lifecycleResolution });
      const result = validateRecruitmentWorkflow({
        lifecycleResolution,
        transitionResolution,
        workflowContext: {
          observedLifecycleEvents: [
            ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION,
            ADVISORY_LIFECYCLE_EVENTS.APPLICATION,
            ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD,
            ADVISORY_LIFECYCLE_EVENTS.RESULT
          ]
        }
      });

      expect(result.workflowValid).toBe(true);
      expect(result.workflowCompleteness).toBe(WORKFLOW_COMPLETENESS.PARTIAL);
    });
  });

  describe("coordinator integration", () => {
    test("plannedWorkflow includes workflow validation when flag is on", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());

      expect(result.plannedWorkflow.workflowValid).toBe(true);
      expect(result.plannedWorkflow.workflowCompleteness).toBe(WORKFLOW_COMPLETENESS.PARTIAL);
      expect(result.plannedWorkflow.validationConfidence).toBeDefined();
      expect(result.plannedWorkflow.validationReason).toBeDefined();
      expect(Array.isArray(result.plannedWorkflow.detectedAnomalies)).toBe(true);
      expect(result.plannedWorkflow.executed).toBe(false);
      expect(result.plannedWorkflow.advisory).toBe(true);
    });

    test("diagnostics append workflow validation stage without replacing existing stages", () => {
      const result = coordinateRecruitmentWorkflowIntegration(enabledCoordinatorContext());
      const summary = result.diagnostics.summary;

      expect(summary.stageCount).toBeGreaterThanOrEqual(8);
      expect(summary.stageTypes.filter((stageType) => stageType === "review").length).toBeGreaterThanOrEqual(
        4
      );
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
    test("workflow validation is advisory-only with no execution", () => {
      const result = validateRecruitmentWorkflow(
        validationContextForEvent(ADVISORY_LIFECYCLE_EVENTS.RESULT)
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

      expect(source).toContain("Phase 97");
      expect(source).toContain("validateRecruitmentWorkflow");
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

    test("validator is not wired into pipeline, compatibility layer, or siteWorker directly", () => {
      const compatibilitySource = read(COMPATIBILITY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);

      expect(compatibilitySource).not.toMatch(/recruitmentWorkflowValidator/);
      expect(pipelineSource).not.toMatch(/recruitmentWorkflowValidator/);
      expect(workerSource).not.toMatch(/recruitmentWorkflowValidator/);
    });

    test("coordinator imports validator for advisory plannedWorkflow enrichment only", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);

      expect(coordinatorSource).toMatch(/recruitmentWorkflowValidator/);
      expect(coordinatorSource).toMatch(/validateRecruitmentWorkflow/);
      expect(coordinatorSource).toMatch(/Workflow validation/);
    });
  });
});
