'use strict';

/**
 * Package 5C — Product-side unit tests (advisory controlled lifecycle engine).
 */

const {
  WORKFLOW_STATES,
  evaluateProductControlledLifecycle,
  validateLifecycleTransition,
  listAllowedNextStates,
  getControlledLifecycleEngineFramework,
  LIFECYCLE_STATES,
  GATE_IDS,
} = require("../server/lib/recruitment/controlledLifecycleEngine");

describe("Package 5C controlled lifecycle engine (product advisory)", () => {
  test("framework identity is Package 5C advisory-only", () => {
    const framework = getControlledLifecycleEngineFramework();
    expect(framework.packageCode).toBe("5C");
    expect(framework.advisoryOnly).toBe(true);
    expect(framework.runtimeEffects.routesCreated).toBe(false);
    expect(framework.runtimeEffects.featureActivated).toBe(false);
    expect(framework.runtimeEffects.automaticTransitionExecuted).toBe(false);
    expect(framework.runtimeEffects.runtimeStateMutated).toBe(false);
    expect(framework.program5AutomationAuthorized).toBe(false);
    expect(framework.package5BComplete).toBe(true);
  });

  test("product evaluation reuses editorial workflow alignment", () => {
    const result = evaluateProductControlledLifecycle({
      currentState: "UNDER_REVIEW",
      previousState: "REVIEW_READY",
      proposedNextState: "APPROVED",
      editorialWorkflowState: WORKFLOW_STATES.IN_REVIEW,
      gateObservations: {
        satisfiedGates: [GATE_IDS.HUMAN_APPROVAL, GATE_IDS.EDITORIAL_CHECKLIST],
      },
    });

    expect(result.productReuse.editorialReview).toBe(true);
    expect(result.productReuse.sharedPreview).toBe(true);
    expect(result.productReuse.pipelineHealth).toBe(true);
    expect(result.productReuse.monitoringReviewIntegration).toBe(true);
    expect(result.editorialAlignment.workflowStateValid).toBe(true);
    expect(result.editorialAlignment.lifecycleHint).toBe("UNDER_REVIEW");
    expect(result.editorialAlignment.allowedDecisions).toEqual(
      expect.arrayContaining(["approve", "reject", "request_changes"])
    );
    expect(result.transitionValidation.valid).toBe(true);
    expect(result.effects.automaticTransition).toBe(false);
    expect(result.effects.runtimeStateMutated).toBe(false);
  });

  test("lifecycle states and transitions remain deterministic", () => {
    expect(LIFECYCLE_STATES.DETECTED).toBe("Detected");
    expect(listAllowedNextStates("SEO_READY")).toEqual(["PUBLISH_READY"]);

    const invalid = validateLifecycleTransition({
      fromState: "DETECTED",
      toState: "PUBLISH_READY",
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.automaticCorrection).toBe(false);
  });

  test("shared preview availability is observed without persistence", () => {
    const result = evaluateProductControlledLifecycle({
      currentState: "DRAFT_READY",
      proposedNextState: "PREVIEW_READY",
      gateObservations: {
        satisfiedGates: [GATE_IDS.SHARED_PREVIEW_AVAILABILITY],
      },
    });

    expect(result.sharedPreview.availabilityObserved).toBe(true);
    expect(result.effects.persisted).toBe(false);
    expect(result.transitionValidation.valid).toBe(true);
  });
});
