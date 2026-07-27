'use strict';

/**
 * Package 5B — Product-side unit tests (advisory monitoring → review integration).
 */

const {
  WORKFLOW_STATES,
  integrateProductMonitoringCandidate,
  createMonitoringCandidate,
  normalizeMonitoringCandidate,
  validateMonitoringCandidate,
  mapConfidenceBand,
  adaptCandidateToReviewPayload,
  getMonitoringReviewIntegrationFramework,
  CONFIDENCE_BANDS,
  EDITORIAL_WORKFLOW_STATES,
} = require("../server/lib/recruitment/monitoringReviewIntegration");

describe("Package 5B monitoring → review integration (product advisory)", () => {
  test("framework identity is Package 5B advisory-only", () => {
    const framework = getMonitoringReviewIntegrationFramework();
    expect(framework.packageCode).toBe("5B");
    expect(framework.advisoryOnly).toBe(true);
    expect(framework.runtimeEffects.routesCreated).toBe(false);
    expect(framework.runtimeEffects.featureActivated).toBe(false);
    expect(framework.runtimeEffects.productionQueueInserted).toBe(false);
    expect(framework.program5AutomationAuthorized).toBe(false);
  });

  test("product integration reuses editorial workflow states", () => {
    const result = integrateProductMonitoringCandidate({
      candidate: {
        candidateId: "p-1",
        source: "upsc.gov.in",
        sourceUrl: "https://upsc.gov.in/notice/1",
        detectionTime: "2026-07-19T12:00:00.000Z",
        recruitmentType: "notification",
        confidence: 0.7,
        title: "UPSC CSE 2026",
        department: "upsc",
        qualification: "graduation",
        state: "central",
        recruitmentCategory: "notification",
        importantDates: [{ label: "notification_date", date: "2026-07-01" }],
      },
      availablePrerequisites: [
        "PACKAGE_5A_PIPELINE_HEALTH",
        "EDITORIAL_REVIEW_FRAMEWORK",
        "SHARED_PREVIEW_FRAMEWORK",
        "RECRUITMENT_OPERATIONS",
        "SEO_DIAGNOSTICS",
      ],
    });

    expect(result.productReuse.editorialReview).toBe(true);
    expect(result.productReuse.sharedPreview).toBe(true);
    expect(result.editorialAlignment.workflowStateValid).toBe(true);
    expect(result.editorialAlignment.workflowState).toBe(
      WORKFLOW_STATES.REVIEW_PENDING
    );
    expect(result.editorialAlignment.allowedDecisions).toEqual(
      expect.arrayContaining(["start_review", "return_to_draft"])
    );
    expect(result.adapter.insertedIntoProductionQueue).toBe(false);
    expect(result.preview.persisted).toBe(false);
    expect(result.diagnostics.missingPrerequisites).toEqual([]);
  });

  test("shared preview snapshot can be attached without persistence", () => {
    const result = integrateProductMonitoringCandidate({
      candidate: {
        candidateId: "p-2",
        source: "ssc.nic.in",
        sourceUrl: "https://ssc.nic.in/x",
        detectionTime: "2026-07-19T12:00:00.000Z",
        recruitmentType: "result",
        confidence: 0.4,
        title: "SSC Result",
      },
      sharedPreviewInput: {
        recruitment: {
          id: 10,
          title: "SSC Result",
          slug: "ssc-result",
          lifecycle_state: "result",
        },
        drafts: [],
        review: null,
        pages: [],
        events: [],
        generatedAt: "2026-07-19T12:00:00.000Z",
      },
      previewOptions: { operatorPersistRequested: true },
    });

    expect(result.sharedPreview.snapshot).toBeTruthy();
    expect(result.sharedPreview.snapshot.snapshotVersion).toMatch(/^v1-/);
    expect(result.preview.sharedPreviewReuse.moduleId).toBe("SHARED_PREVIEW");
    expect(result.preview.persisted).toBe(false);
    expect(result.preview.operatorPersistRequested).toBe(true);
    expect(result.confidence.band).toBe(CONFIDENCE_BANDS.LOW);
  });

  test("adapter editorial states align with package 4C constants", () => {
    expect(EDITORIAL_WORKFLOW_STATES.REVIEW_PENDING).toBe(
      WORKFLOW_STATES.REVIEW_PENDING
    );
    expect(EDITORIAL_WORKFLOW_STATES.APPROVED).toBe(WORKFLOW_STATES.APPROVED);

    const candidate = normalizeMonitoringCandidate({
      candidateId: "p-3",
      source: "rrb",
      sourceUrl: "https://example.com/r",
      detectionTime: "2026-07-19T12:00:00.000Z",
      recruitmentType: "admit_card",
      confidence: 0.95,
      title: "RRB NTPC Admit Card",
    }).candidate;

    const validation = validateMonitoringCandidate(candidate);
    const adapted = adaptCandidateToReviewPayload(candidate, { validation });
    expect(adapted.reviewPayload.editorialReview.workflowState).toBe(
      WORKFLOW_STATES.REVIEW_PENDING
    );
    expect(mapConfidenceBand(0.95).band).toBe(CONFIDENCE_BANDS.HIGH);
    expect(createMonitoringCandidate({ candidateId: "x" }).candidateId).toBe("x");
  });
});
