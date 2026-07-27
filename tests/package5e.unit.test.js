'use strict';

/**
 * Package 5E — Product-side unit tests (advisory candidate resolution).
 */

const {
  WORKFLOW_STATES,
  resolveProductControlledCandidates,
  detectCandidateDuplicates,
  generateMergeRecommendations,
  getControlledCandidateResolutionFramework,
  FINGERPRINT_CLASSES,
  MERGE_RECOMMENDATIONS,
  DUPLICATE_RELATION_TYPES,
} = require("../server/lib/recruitment/controlledCandidateResolution");

describe("Package 5E controlled candidate resolution (product advisory)", () => {
  test("framework identity is Package 5E advisory-only", () => {
    const framework = getControlledCandidateResolutionFramework();
    expect(framework.packageCode).toBe("5E");
    expect(framework.advisoryOnly).toBe(true);
    expect(framework.runtimeEffects.routesCreated).toBe(false);
    expect(framework.runtimeEffects.featureActivated).toBe(false);
    expect(framework.runtimeEffects.candidatesMerged).toBe(false);
    expect(framework.runtimeEffects.automaticResolutionExecuted).toBe(false);
    expect(framework.program5AutomationAuthorized).toBe(false);
    expect(framework.package5DComplete).toBe(true);
    expect(framework.package5FReady).toBe(true);
  });

  test("product resolution reuses Program 4–5D identities", () => {
    const result = resolveProductControlledCandidates({
      candidates: [
        {
          candidateId: "prod-cand-1",
          source: "ssc.nic.in",
          sourceUrl: "https://ssc.nic.in/notice/1",
          recruitmentType: "notification",
          organization: "ssc",
          department: "ssc",
          qualification: "graduation",
          state: "central",
          advertisementNumber: "DEMO/2026",
          title: "Product Resolution Demo",
          importantDates: [{ label: "application_end", date: "2026-09-01" }],
          confidence: 0.9
        },
        {
          candidateId: "prod-cand-2",
          source: "ssc.nic.in",
          sourceUrl: "https://ssc.nic.in/notice/1",
          recruitmentType: "notification",
          organization: "ssc",
          department: "ssc",
          qualification: "graduation",
          state: "central",
          advertisementNumber: "DEMO/2026",
          title: "Product Resolution Demo",
          importantDates: [{ label: "application_end", date: "2026-09-01" }],
          confidence: 0.85
        }
      ],
      editorialWorkflowState: WORKFLOW_STATES.APPROVED
    });

    expect(result.productReuse.monitoringReviewIntegration).toBe(true);
    expect(result.productReuse.controlledLifecycleEngine).toBe(true);
    expect(result.productReuse.draftPreparation).toBe(true);
    expect(result.productReuse.recruitmentOperations).toBe(true);
    expect(result.productReuse.editorialReview).toBe(true);
    expect(result.productReuse.sharedPreview).toBe(true);
    expect(result.productReuse.pipelineHealth).toBe(true);
    expect(result.editorialAlignment.operatorControlled).toBe(true);
    expect(result.effects.candidatesMerged).toBe(false);
    expect(result.effects.productionDataModified).toBe(false);
    expect(result.preview.previewOnly).toBe(true);
    expect(result.report.automaticMerge).toBe(false);
    expect(result.resolution.groupCount).toBeGreaterThanOrEqual(1);
    expect(
      Object.values(MERGE_RECOMMENDATIONS)
    ).toContain(result.mergeRecommendations.recommendations[0].recommendation);
  });

  test("duplicate detection diagnostics never merge candidates", () => {
    const detection = detectCandidateDuplicates({
      candidates: [
        {
          candidateId: "d1",
          source: "ssc.nic.in",
          sourceUrl: "https://ssc.nic.in/a",
          recruitmentType: "notification",
          organization: "ssc",
          advertisementNumber: "A/1",
          title: "A",
          confidence: 0.7
        },
        {
          candidateId: "d2",
          source: "ssc.nic.in",
          sourceUrl: "https://ssc.nic.in/a",
          recruitmentType: "notification",
          organization: "ssc",
          advertisementNumber: "A/1",
          title: "A",
          confidence: 0.6
        }
      ]
    });

    expect(detection.diagnosticsOnly).toBe(true);
    expect(detection.automaticMerge).toBe(false);
    expect(detection.summary.exactDuplicates).toBeGreaterThanOrEqual(1);
    expect(FINGERPRINT_CLASSES.EXACT_IDENTITY).toBe("exact_identity");
    expect(DUPLICATE_RELATION_TYPES.EXACT_DUPLICATE).toBe("exact_duplicate");
  });

  test("merge recommendations require operator confirmation", () => {
    const recommendations = generateMergeRecommendations({
      groups: [
        {
          groupId: "g1",
          confidenceScore: 0.95,
          relations: [DUPLICATE_RELATION_TYPES.EXACT_DUPLICATE],
          primaryCandidateSuggestion: { candidateId: "a" },
          relatedCandidates: [{ candidateId: "b" }]
        }
      ]
    });

    expect(recommendations.automaticMerge).toBe(false);
    expect(recommendations.recommendations[0].operatorConfirmationRequired).toBe(
      true
    );
    expect(recommendations.recommendations[0].recommendation).toBe(
      MERGE_RECOMMENDATIONS.MERGE_RECOMMENDED
    );
  });
});
