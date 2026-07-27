'use strict';

/**
 * Package 5F — Product-side unit tests (advisory publish readiness authorization).
 */

const {
  WORKFLOW_STATES,
  evaluateProductPublishReadinessAuthorization,
  evaluateAuthorizationGates,
  verifyRollbackReadiness,
  getControlledPublishReadinessAuthorizationFramework,
  GATE_RESULT,
  OVERALL_STATUS,
  DEPLOYMENT_RECOMMENDATION,
  AUTHORIZATION_GATE_IDS,
} = require("../server/lib/recruitment/publishReadinessAuthorization");

describe("Package 5F publish readiness authorization (product advisory)", () => {
  test("framework identity is Package 5F advisory-only with Program 5 complete", () => {
    const framework = getControlledPublishReadinessAuthorizationFramework();
    expect(framework.packageCode).toBe("5F");
    expect(framework.advisoryOnly).toBe(true);
    expect(framework.runtimeEffects.routesCreated).toBe(false);
    expect(framework.runtimeEffects.featureActivated).toBe(false);
    expect(framework.runtimeEffects.publishingExecuted).toBe(false);
    expect(framework.runtimeEffects.deploymentExecuted).toBe(false);
    expect(framework.program5AutomationAuthorized).toBe(false);
    expect(framework.package5EComplete).toBe(true);
    expect(framework.package5FComplete).toBe(true);
    expect(framework.program5Complete).toBe(true);
    expect(framework.program6Ready).toBe(true);
    expect(framework.deploymentAuthorized).toBe(false);
    expect(framework.deploymentRecommendation).toBe(
      DEPLOYMENT_RECOMMENDATION.NOT_AUTHORIZED
    );
  });

  test("product evaluation reuses Program 4–5E identities", () => {
    const result = evaluateProductPublishReadinessAuthorization({
      gateObservations: {
        pipelineOverallStatus: "HEALTHY",
        lifecycleCurrentState: "PUBLISH_READY",
        lifecycleRemainingGates: [],
        lifecycleReady: true,
        draftReady: true,
        draftCompletenessScore: 1,
        draftRemainingIssues: [],
        resolutionUnresolvedCount: 0,
        resolutionAutomaticMerge: false,
        resolutionAdvisoryOnly: true,
        editorialChecklistComplete: true,
        editorialMissingChecklist: [],
        seoReady: true,
        seoMissingFields: [],
        seoBlocking: false,
        completedPackages: ["5A", "5B", "5C", "5D", "5E"],
        configurationValid: true,
        program5AutomationAuthorized: false,
        requiredApprovals: ["EDITORIAL_APPROVAL", "PUBLISH_READINESS_REVIEW"],
        recordedApprovals: ["EDITORIAL_APPROVAL", "PUBLISH_READINESS_REVIEW"]
      },
      rollback: {
        rollbackPlanExists: true,
        recoveryProcedureDocumented: true,
        manualRecoveryChecklistAvailable: true
      },
      backup: {
        backupPolicyDocumented: true,
        restoreProcedureAvailable: true,
        verificationChecklistComplete: true
      },
      editorialWorkflowState: WORKFLOW_STATES.APPROVED
    });

    expect(result.productReuse.pipelineHealth).toBe(true);
    expect(result.productReuse.monitoringReviewIntegration).toBe(true);
    expect(result.productReuse.controlledLifecycleEngine).toBe(true);
    expect(result.productReuse.draftPreparation).toBe(true);
    expect(result.productReuse.candidateResolution).toBe(true);
    expect(result.productReuse.editorialReview).toBe(true);
    expect(result.productReuse.sharedPreview).toBe(true);
    expect(result.productReuse.seoDiagnostics).toBe(true);
    expect(result.editorialAlignment.operatorControlled).toBe(true);
    expect(result.editorialAlignment.automaticApproval).toBe(false);
    expect(result.effects.contentPublished).toBe(false);
    expect(result.effects.softwareDeployed).toBe(false);
    expect(result.effects.routesActivated).toBe(false);
    expect(result.overallStatus).toBe(OVERALL_STATUS.READY);
    expect(result.deploymentRecommendation).toBe(
      DEPLOYMENT_RECOMMENDATION.NOT_AUTHORIZED
    );
    expect(result.governanceReport.program6Recommendation.eligibleToBegin).toBe(
      true
    );
  });

  test("authorization gates never auto-approve", () => {
    const evaluation = evaluateAuthorizationGates({
      pipelineOverallStatus: "HEALTHY",
      lifecycleCurrentState: "PUBLISH_READY",
      lifecycleRemainingGates: [],
      lifecycleReady: true,
      draftReady: true,
      resolutionUnresolvedCount: 0,
      resolutionAdvisoryOnly: true,
      editorialReady: true,
      editorialChecklistComplete: true,
      seoReady: true,
      completedPackages: ["5A", "5B", "5C", "5D", "5E"],
      configurationValid: true,
      program5AutomationAuthorized: false,
      recordedApprovals: ["EDITORIAL_APPROVAL", "PUBLISH_READINESS_REVIEW"],
      automaticApproval: false
    });

    expect(evaluation.automaticApproval).toBe(false);
    expect(evaluation.results.length).toBe(8);
    expect(
      evaluation.results.every((r) =>
        [GATE_RESULT.PASS, GATE_RESULT.WARNING, GATE_RESULT.BLOCKED].includes(
          r.result
        )
      )
    ).toBe(true);
    expect(AUTHORIZATION_GATE_IDS.REQUIRED_HUMAN_APPROVALS).toBe(
      "REQUIRED_HUMAN_APPROVALS"
    );
  });

  test("rollback readiness never executes rollback", () => {
    const verification = verifyRollbackReadiness({
      rollbackPlanExists: true,
      recoveryProcedureDocumented: true,
      manualRecoveryChecklistAvailable: true
    });
    expect(verification.rollbackExecuted).toBe(false);
    expect(verification.verificationOnly).toBe(true);
    expect(verification.ready).toBe(true);
  });
});
