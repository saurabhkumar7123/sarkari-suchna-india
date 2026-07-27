'use strict';

/**
 * Package 5D — Product-side unit tests (advisory draft preparation).
 */

const {
  WORKFLOW_STATES,
  prepareProductDraftFromReviewPayload,
  validatePreparedDraft,
  adaptPreparedDraftToGenerator,
  getDraftPreparationFramework,
  DRAFT_LIFECYCLE_STATES,
  DIAGNOSTIC_CODES,
} = require("../server/lib/recruitment/draftPreparation");

describe("Package 5D draft preparation framework (product advisory)", () => {
  test("framework identity is Package 5D advisory-only", () => {
    const framework = getDraftPreparationFramework();
    expect(framework.packageCode).toBe("5D");
    expect(framework.advisoryOnly).toBe(true);
    expect(framework.runtimeEffects.routesCreated).toBe(false);
    expect(framework.runtimeEffects.featureActivated).toBe(false);
    expect(framework.runtimeEffects.productionDraftCreated).toBe(false);
    expect(framework.runtimeEffects.automaticDraftGenerated).toBe(false);
    expect(framework.program5AutomationAuthorized).toBe(false);
    expect(framework.package5CComplete).toBe(true);
    expect(framework.package5EReady).toBe(true);
  });

  test("product preparation reuses Program 4–5C identities", () => {
    const result = prepareProductDraftFromReviewPayload({
      reviewPayload: {
        payloadKind: "HUMAN_REVIEW_ITEM",
        editorialReview: {
          recruitmentId: 10,
          draftId: null,
          workflowState: WORKFLOW_STATES.APPROVED,
          notes: [],
          decisionHistory: [],
          updatedBy: null
        },
        monitoringProvenance: {
          candidateId: "prod-cand-1",
          source: "ssc.nic.in",
          sourceUrl: "https://ssc.nic.in/notice/1",
          detectionTime: "2026-07-19T10:00:00.000Z",
          recruitmentType: "notification",
          confidence: 0.85
        },
        contentSummary: {
          title: "Product Draft Prep Demo",
          department: "ssc",
          qualification: "graduation",
          state: "central",
          recruitmentCategory: "notification",
          importantDates: [{ label: "application_end", date: "2026-09-01" }],
          advertisementNo: "DEMO/2026",
          postName: "Demo Post",
          cycleYear: 2026
        }
      },
      sections: {
        eligibility: "Graduation",
        selectionProcess: "CBT",
        applicationProcess: "Online"
      },
      editorialWorkflowState: WORKFLOW_STATES.APPROVED,
      lifecycleStateHint: "APPROVED"
    });

    expect(result.productReuse.editorialReview).toBe(true);
    expect(result.productReuse.sharedPreview).toBe(true);
    expect(result.productReuse.recruitmentOperations).toBe(true);
    expect(result.productReuse.controlledLifecycleEngine).toBe(true);
    expect(result.productReuse.monitoringReviewIntegration).toBe(true);
    expect(result.productReuse.seoDiagnostics).toBe(true);
    expect(result.productReuse.generator).toBe(true);
    expect(result.editorialAlignment.approved).toBe(true);
    expect(result.effects.productionDraftCreated).toBe(false);
    expect(result.effects.draftSaved).toBe(false);
    expect(result.validation.valid).toBe(true);
    expect(result.generatorAdapter.compatible).toBe(true);
    expect(result.preview.previewOnly).toBe(true);
    expect(result.readiness.recommendedNextStep.code).toBe(
      "OPERATOR_REVIEW_PREPARED_DRAFT"
    );
  });

  test("validation diagnostics never modify assembled data", () => {
    const result = prepareProductDraftFromReviewPayload({
      reviewPayload: {
        editorialReview: {
          workflowState: WORKFLOW_STATES.APPROVED,
          recruitmentId: 1,
          draftId: null
        },
        monitoringProvenance: { candidateId: "x1" },
        contentSummary: {
          title: "Title Only Partial",
          department: null,
          qualification: null,
          state: null,
          importantDates: []
        }
      },
      editorialWorkflowState: WORKFLOW_STATES.APPROVED
    });

    const before = JSON.stringify(result.assembly.assembled.recruitmentMetadata);
    const validation = validatePreparedDraft({ assembly: result.assembly });
    const after = JSON.stringify(result.assembly.assembled.recruitmentMetadata);

    expect(before).toBe(after);
    expect(validation.dataModified).toBe(false);
    expect(validation.automaticCorrection).toBe(false);
    expect(validation.valid).toBe(false);
    expect(
      validation.diagnostics.some(
        (d) => d.code === DIAGNOSTIC_CODES.MISSING_REQUIRED_SECTION
      )
    ).toBe(true);
  });

  test("generator adapter reuses contract without saving", () => {
    const result = prepareProductDraftFromReviewPayload({
      reviewPayload: {
        editorialReview: {
          workflowState: WORKFLOW_STATES.APPROVED,
          recruitmentId: 7,
          draftId: null
        },
        monitoringProvenance: { candidateId: "gen-1" },
        contentSummary: {
          title: "Generator Adapter Demo Notification",
          department: "upsc",
          qualification: "graduation",
          state: "central",
          importantDates: [{ label: "last date", date: "2026-10-01" }]
        }
      },
      sections: {
        eligibility: "Graduation",
        selectionProcess: "Interview",
        applicationProcess: "Online form"
      },
      editorialWorkflowState: WORKFLOW_STATES.APPROVED,
      lifecycleStateHint: "DRAFT_READY"
    });

    const adapter = adaptPreparedDraftToGenerator({
      assembly: result.assembly,
      validation: result.validation
    });

    expect(adapter.draftSaved).toBe(false);
    expect(adapter.automaticSaveDenied).toBe(true);
    expect(adapter.duplicatesGeneratorLogic).toBe(false);
    expect(adapter.generatorPayload.structuredDepartment).toBe("upsc");
    expect(DRAFT_LIFECYCLE_STATES.ASSEMBLED).toBe("assembled");
  });
});
