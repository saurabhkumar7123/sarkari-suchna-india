"use strict";

/**
 * PWP Phase 2 — Recruitment Resolution & Routing Engine tests.
 */

const {
  resolveRecruitment,
  RESOLUTION_DECISIONS,
  ROUTE_DESTINATIONS,
  RECOMMENDED_ACTIONS,
  PAGE_SECTIONS,
  planUpdateScope,
  buildRouting,
  shouldRunGenerator,
  shouldRunEditorialQueue,
  runProductionWorkflow,
  WORKFLOW_STATES,
  STAGE_IDS,
  STAGE_STATUS,
  PIPELINE_STAGE_ORDER,
  ORCHESTRATOR_VERSION,
  PHASE,
  RESOLUTION_ENGINE_ID
} = require("../server/lib/productionWorkflow");

const { CHANGE_TYPES } = require("../server/lib/contentIntelligence/multiSourceCorrelation/correlationTypes");

const FULL_NOTIFICATION_HTML = `<html><head><title>SSC CGL Recruitment 2026 Notification</title></head><body>
  <h1>SSC CGL Recruitment 2026 Notification</h1>
  <h2>Short Information</h2>
  <p>Staff Selection Commission invites online applications for Combined Graduate Level Examination 2026. Advertisement Number SSC/CGL/2026/01</p>
  <h2>Important Dates</h2>
  <p>Application Begin : 01/07/2026</p>
  <p>Last Date to Apply : 21/07/2026</p>
  <p>Exam Date : 14 September 2026</p>
  <h2>Application Fee</h2>
  <p>General / OBC : 100/-</p>
  <p>SC / ST : 0/-</p>
  <h2>Vacancy Details</h2>
  <p>Total Posts: 4500</p>
  <h2>How To Apply</h2>
  <p>Candidates must apply online through the official website.</p>
  <h2>Important Links</h2>
  <p>Apply Online=https://ssc.gov.in/apply</p>
  <p>Official Website=https://ssc.gov.in</p>
</body></html>`;

const FULL_PROGRAM1_TEXT = `SSC CGL Recruitment 2026 Notification

[Section: Short Information]
Staff Selection Commission invites online applications for Combined Graduate Level Examination 2026. Advertisement Number SSC/CGL/2026/01

[Section: Important Dates]
Application Begin : 01/07/2026
Last Date to Apply : 21/07/2026
Exam Date : 14 September 2026

[Section: Application Fee]
General / OBC : 100/-
SC / ST : 0/-

[Section: Vacancy Details]
Total Posts: 4500

[Section: How To Apply]
Candidates must apply online through the official website.

[Section: Important Links]
Apply Online=https://ssc.gov.in/apply
Official Website=https://ssc.gov.in
`;

function pipelineEvent(overrides = {}) {
  return {
    sourceUrl: "https://ssc.gov.in/cgl-2026-notification.html",
    title: "SSC CGL Recruitment 2026 Notification",
    contentType: "text/html",
    html: FULL_NOTIFICATION_HTML,
    program1Text: FULL_PROGRAM1_TEXT,
    forceChangeDetected: true,
    allowTelegramDelivery: false,
    ...overrides
  };
}

function baseCorrelation(overrides = {}) {
  return {
    recruitmentIdentity: {
      recruitmentKey: "ssc-cgl-2026",
      organization: "SSC",
      advertisementNumber: "SSC/CGL/2026/01",
      recruitmentName: "SSC CGL Recruitment 2026",
      postName: "Assistant",
      department: "Staff Selection Commission",
      examName: "CGL",
      hasNotification: true,
      confidence: "high",
      ...((overrides.recruitmentIdentity) || {})
    },
    documents: [
      {
        documentId: "doc-1",
        role: "notification",
        duplicateMarks: null
      }
    ],
    duplicateAnalysis: {
      pairs: [],
      marks: {},
      exactDuplicateCount: 0,
      nearDuplicateCount: 0,
      replacementCount: 0,
      unknownRelationshipCount: 0
    },
    detectedChanges: [],
    summary: {
      primaryNotificationDocumentId: "doc-1"
    },
    ...overrides
  };
}

describe("PWP Phase 2 — Recruitment Resolution Engine", () => {
  test("engine identity and decision catalog", () => {
    expect(RESOLUTION_ENGINE_ID).toBe("PWP_RECRUITMENT_RESOLUTION_ENGINE");
    expect(PHASE).toBe("PHASE_2");
    expect(ORCHESTRATOR_VERSION).toBe("2.0.0");
    expect(Object.keys(RESOLUTION_DECISIONS).sort()).toEqual(
      [
        "CREATE_NEW_PAGE",
        "CREATE_NEW_RECRUITMENT",
        "IGNORE_DUPLICATE",
        "MANUAL_REVIEW_REQUIRED",
        "SUPERSEDED_DOCUMENT",
        "UNSUPPORTED",
        "UPDATE_EXISTING_PAGE",
        "UPDATE_EXISTING_RECRUITMENT"
      ].sort()
    );
    expect(PIPELINE_STAGE_ORDER).toContain(STAGE_IDS.RECRUITMENT_RESOLUTION);
  });

  test("CASE 1 — new recruitment routes to generator + editorial", () => {
    const result = resolveRecruitment({
      workflowContext: {
        monitoringEvent: { title: "SSC CGL Recruitment 2026 Notification" }
      },
      correlation: baseCorrelation(),
      existingRecruitment: null,
      existingPage: null
    });

    expect(result.decision).toBe(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT);
    expect(result.routing.destinations).toEqual([
      ROUTE_DESTINATIONS.GENERATOR,
      ROUTE_DESTINATIONS.EDITORIAL_QUEUE
    ]);
    expect(result.recommendedActions).toContain(
      RECOMMENDED_ACTIONS.CREATE_GENERATOR_DRAFT
    );
    expect(result.recommendedActions).toContain(
      RECOMMENDED_ACTIONS.QUEUE_EDITORIAL_REVIEW
    );
    expect(shouldRunGenerator(result)).toBe(true);
    expect(shouldRunEditorialQueue(result)).toBe(true);
    expect(result.effects.modifiesPages).toBe(false);
    expect(result.effects.usesAi).toBe(false);
  });

  test("CASE 2 — existing recruitment, missing page → CREATE_NEW_PAGE", () => {
    const result = resolveRecruitment({
      correlation: baseCorrelation(),
      existingRecruitment: {
        recruitmentId: "rec-100",
        advertisementNumber: "SSC/CGL/2026/01",
        organization: "SSC",
        recruitmentName: "SSC CGL Recruitment 2026"
      },
      existingPage: null
    });

    expect(result.decision).toBe(RESOLUTION_DECISIONS.CREATE_NEW_PAGE);
    expect(result.match.matched).toBe(true);
    expect(result.pageMatch.matched).toBe(false);
    expect(result.routing.includesGenerator).toBe(true);
    expect(result.reason).toBe("existing_recruitment_missing_page");
  });

  test("CASE 3 — existing page → UPDATE_EXISTING_PAGE with scoped plan", () => {
    const detectedChanges = [
      {
        changeType: CHANGE_TYPES.IMPORTANT_DATE,
        field: "importantDates.lastDate",
        previousValue: "2026-07-21",
        currentValue: "2026-07-31"
      },
      {
        changeType: CHANGE_TYPES.VACANCY_COUNT,
        field: "totalPosts",
        previousValue: "4500",
        currentValue: "5000"
      }
    ];

    const result = resolveRecruitment({
      correlation: baseCorrelation({ detectedChanges }),
      existingRecruitment: {
        recruitmentId: "rec-100",
        advertisementNumber: "SSC/CGL/2026/01",
        organization: "SSC"
      },
      existingPage: {
        pageId: "page-55",
        sections: [
          PAGE_SECTIONS.SHORT_INFORMATION,
          PAGE_SECTIONS.IMPORTANT_DATES,
          PAGE_SECTIONS.APPLICATION_FEE,
          PAGE_SECTIONS.VACANCY_DETAILS,
          PAGE_SECTIONS.IMPORTANT_LINKS
        ]
      },
      detectedChanges
    });

    expect(result.decision).toBe(RESOLUTION_DECISIONS.UPDATE_EXISTING_PAGE);
    expect(result.updatePlan).toBeTruthy();
    expect(result.updatePlan.affectedSections).toEqual([
      PAGE_SECTIONS.IMPORTANT_DATES,
      PAGE_SECTIONS.VACANCY_DETAILS
    ]);
    expect(result.updatePlan.unaffectedSections).toEqual(
      expect.arrayContaining([
        PAGE_SECTIONS.SHORT_INFORMATION,
        PAGE_SECTIONS.APPLICATION_FEE,
        PAGE_SECTIONS.IMPORTANT_LINKS
      ])
    );
    expect(result.updatePlan.suggestedUpdateScope).toBe("affected_sections_only");
    expect(result.updatePlan.overwriteUnrelatedSections).toBe(false);
    expect(result.updatePlan.rewriteContent).toBe(false);
  });

  test("CASE 4 — duplicate notification → IGNORE_DUPLICATE", () => {
    const result = resolveRecruitment({
      correlation: baseCorrelation({
        duplicateAnalysis: {
          pairs: [
            {
              documentIdA: "doc-0",
              documentIdB: "doc-1",
              duplicateType: "exact_duplicate",
              evidence: ["identical_content_fingerprint"]
            }
          ],
          marks: {
            "doc-1": {
              documentId: "doc-1",
              exactDuplicateOf: ["doc-0"],
              nearDuplicateOf: [],
              replaces: [],
              replacedBy: [],
              supersededBy: []
            }
          },
          exactDuplicateCount: 1,
          nearDuplicateCount: 0,
          replacementCount: 0,
          unknownRelationshipCount: 0
        }
      }),
      existingRecruitment: null,
      existingPage: null
    });

    expect(result.decision).toBe(RESOLUTION_DECISIONS.IGNORE_DUPLICATE);
    expect(result.routing.destinations).toEqual([ROUTE_DESTINATIONS.REJECTED]);
    expect(result.routing.haltPipeline).toBe(true);
    expect(shouldRunGenerator(result)).toBe(false);
  });

  test("CASE 5 — superseded notification → SUPERSEDED_DOCUMENT routes newest", () => {
    const result = resolveRecruitment({
      correlation: baseCorrelation({
        duplicateAnalysis: {
          pairs: [
            {
              documentIdA: "doc-1",
              documentIdB: "doc-2",
              duplicateType: "replacement",
              supersededDocumentId: "doc-1",
              replacementDocumentId: "doc-2",
              evidence: ["later_document_date"]
            }
          ],
          marks: {
            "doc-1": {
              documentId: "doc-1",
              exactDuplicateOf: [],
              nearDuplicateOf: [],
              replaces: [],
              replacedBy: ["doc-2"],
              supersededBy: ["doc-2"]
            }
          },
          exactDuplicateCount: 0,
          nearDuplicateCount: 0,
          replacementCount: 1,
          unknownRelationshipCount: 0
        }
      })
    });

    expect(result.decision).toBe(RESOLUTION_DECISIONS.SUPERSEDED_DOCUMENT);
    expect(result.newestDocumentId).toBe("doc-2");
    expect(result.routeNewestDocumentId).toBe("doc-2");
    expect(result.routing.routeNewest).toBe(true);
    expect(result.recommendedActions).toContain(
      RECOMMENDED_ACTIONS.MARK_SUPERSEDED_AND_ROUTE_NEWEST
    );
  });

  test("CASE 6 — unknown recruitment → MANUAL_REVIEW_REQUIRED", () => {
    const result = resolveRecruitment({
      workflowContext: { unknownRecruitment: true },
      correlation: baseCorrelation(),
      existingRecruitment: null,
      existingPage: null
    });

    expect(result.decision).toBe(RESOLUTION_DECISIONS.MANUAL_REVIEW_REQUIRED);
    expect(result.routing.destinations).toEqual([ROUTE_DESTINATIONS.MANUAL_REVIEW]);
    expect(result.routing.haltPipeline).toBe(true);
    expect(shouldRunGenerator(result)).toBe(false);
  });

  test("UPDATE_EXISTING_RECRUITMENT when prefer recruitment-only update", () => {
    const result = resolveRecruitment({
      workflowContext: { updateRecruitmentOnly: true },
      correlation: baseCorrelation(),
      existingRecruitment: {
        recruitmentId: "rec-9",
        advertisementNumber: "SSC/CGL/2026/01"
      },
      existingPage: null
    });

    expect(result.decision).toBe(RESOLUTION_DECISIONS.UPDATE_EXISTING_RECRUITMENT);
    expect(result.routing.includesGenerator).toBe(true);
  });

  test("unsupported content routes to REJECTED", () => {
    const result = resolveRecruitment({
      workflowContext: { unsupported: true },
      correlation: baseCorrelation()
    });
    expect(result.decision).toBe(RESOLUTION_DECISIONS.UNSUPPORTED);
    expect(result.routing.destinations).toEqual([ROUTE_DESTINATIONS.REJECTED]);
  });

  test("ambiguous identifier conflict → manual review", () => {
    const result = resolveRecruitment({
      correlation: baseCorrelation({
        recruitmentIdentity: {
          recruitmentKey: "other",
          organization: "UPSC",
          advertisementNumber: "UPSC/2026/99",
          recruitmentName: "Other Exam",
          confidence: "high",
          hasNotification: true
        }
      }),
      existingRecruitment: {
        recruitmentId: "rec-1",
        advertisementNumber: "SSC/CGL/2026/01",
        organization: "SSC",
        requireStrictIdentityMatch: true
      }
    });

    expect(result.decision).toBe(RESOLUTION_DECISIONS.MANUAL_REVIEW_REQUIRED);
    expect(result.match.ambiguous).toBe(true);
  });

  test("update scope planning never overwrites unrelated sections", () => {
    const plan = planUpdateScope({
      existingPage: {
        sections: [
          PAGE_SECTIONS.IMPORTANT_DATES,
          PAGE_SECTIONS.APPLICATION_FEE,
          PAGE_SECTIONS.VACANCY_DETAILS
        ]
      },
      detectedChanges: [
        {
          changeType: CHANGE_TYPES.APPLICATION_FEE,
          field: "applicationFee",
          previousValue: "100",
          currentValue: "120"
        }
      ]
    });

    expect(plan.affectedSections).toEqual([PAGE_SECTIONS.APPLICATION_FEE]);
    expect(plan.unaffectedSections).toEqual([
      PAGE_SECTIONS.IMPORTANT_DATES,
      PAGE_SECTIONS.VACANCY_DETAILS
    ]);
    expect(plan.overwriteUnrelatedSections).toBe(false);
  });

  test("routing model maps all decisions deterministically", () => {
    for (const decision of Object.values(RESOLUTION_DECISIONS)) {
      const routing = buildRouting(decision);
      expect(routing.decision).toBe(decision);
      expect(Array.isArray(routing.destinations)).toBe(true);
      expect(routing.destinations.length).toBeGreaterThan(0);
    }
  });

  test("determinism — identical inputs produce identical decisions", () => {
    const input = {
      correlation: baseCorrelation(),
      existingRecruitment: {
        recruitmentId: "rec-100",
        advertisementNumber: "SSC/CGL/2026/01"
      },
      existingPage: {
        pageId: "page-1",
        sections: [PAGE_SECTIONS.IMPORTANT_DATES]
      },
      detectedChanges: [
        {
          changeType: CHANGE_TYPES.IMPORTANT_DATE,
          field: "importantDates.lastDate",
          previousValue: "a",
          currentValue: "b"
        }
      ]
    };
    const a = resolveRecruitment(input);
    const b = resolveRecruitment(input);
    expect(a).toEqual(b);
    expect(Object.isFrozen(a)).toBe(true);
  });

  test("pipeline — duplicate notification halts before generator", async () => {
    const result = await runProductionWorkflow({
      workflowId: "phase2_dup",
      monitoringEvent: pipelineEvent({ isDuplicateNotification: true })
    });

    expect(result.status).toBe(STAGE_STATUS.SUCCESS);
    expect(result.finalState).toBe(WORKFLOW_STATES.RECRUITMENT_RESOLVED);
    expect(result.payload.resolution.decision).toBe(
      RESOLUTION_DECISIONS.IGNORE_DUPLICATE
    );
    expect(result.payload.generatorDraft).toBeFalsy();
    expect(result.report.skippedStages.map((s) => s.stageId)).toEqual(
      expect.arrayContaining([
        STAGE_IDS.GENERATOR_DRAFT,
        STAGE_IDS.EDITORIAL_QUEUE,
        STAGE_IDS.TELEGRAM_NOTIFICATION
      ])
    );
    expect(result.published).toBe(false);
  });

  test("pipeline — manual review routing", async () => {
    const result = await runProductionWorkflow({
      workflowId: "phase2_manual",
      monitoringEvent: pipelineEvent({ unknownRecruitment: true })
    });

    expect(result.status).toBe(STAGE_STATUS.SUCCESS);
    expect(result.finalState).toBe(WORKFLOW_STATES.READY_FOR_REVIEW);
    expect(result.payload.resolution.decision).toBe(
      RESOLUTION_DECISIONS.MANUAL_REVIEW_REQUIRED
    );
    expect(result.payload.resolution.routing.destinations).toEqual([
      ROUTE_DESTINATIONS.MANUAL_REVIEW
    ]);
  });

  test("pipeline — existing recruitment without page routes CREATE_NEW_PAGE", async () => {
    const result = await runProductionWorkflow({
      workflowId: "phase2_newpage",
      existingRecruitment: {
        recruitmentId: "rec-200",
        advertisementNumber: "SSC/CGL/2026/01",
        organization: "SSC",
        recruitmentName: "SSC CGL Recruitment 2026"
      },
      monitoringEvent: pipelineEvent()
    });

    expect(result.status).toBe(STAGE_STATUS.SUCCESS);
    expect(result.payload.resolution.decision).toBe(
      RESOLUTION_DECISIONS.CREATE_NEW_PAGE
    );
    expect(result.payload.generatorDraft).toBeTruthy();
    expect(result.payload.editorialQueueReference).toBeTruthy();
    expect(result.payload.editorialQueueReference.resolutionDecision).toBe(
      RESOLUTION_DECISIONS.CREATE_NEW_PAGE
    );
    expect(result.finalState).toBe(WORKFLOW_STATES.READY_FOR_REVIEW);
  });

  test("backward compatibility — Phase 1 happy path still reaches READY_FOR_REVIEW", async () => {
    const result = await runProductionWorkflow({
      workflowId: "phase2_compat",
      monitoringEvent: pipelineEvent()
    });

    expect(result.status).toBe(STAGE_STATUS.SUCCESS);
    expect(result.finalState).toBe(WORKFLOW_STATES.READY_FOR_REVIEW);
    expect(result.payload.resolution.decision).toBe(
      RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT
    );
    expect(result.payload.generatorDraft).toBeTruthy();
    expect(result.published).toBe(false);
    expect(result.autoPublishBlocked).toBe(true);
  });
});
