"use strict";

/**
 * PWP Phase 4 — Editorial Workflow & Review Operations tests.
 */

const {
  prepareGeneratorDraft,
  prepareEditorialReview,
  reviewAction,
  validateEditorialReviewInput,
  buildDiffModel,
  createReviewId,
  clearEditorialReviewMemory,
  getEditorialReviewHistory,
  RESOLUTION_DECISIONS,
  PAGE_SECTIONS,
  planUpdateScope,
  DRAFT_TYPES,
  SECTION_ACTIONS,
  REVIEW_STATES,
  REVIEW_ACTIONS,
  EDITORIAL_WORKFLOW_ENGINE_ID,
  EDITORIAL_WORKFLOW_PHASE,
  EDITORIAL_PACKAGE_FORMAT_ID,
  EDITORIAL_CONTRACT_FORMAT_ID,
  GENERATOR_INTEGRATION_ENGINE_ID,
  GENERATOR_INTEGRATION_PHASE,
  buildGeneratorDraftFromCanonical,
  resolveRecruitment,
  PHASE,
  ORCHESTRATOR_VERSION,
  RESOLUTION_ENGINE_ID
} = require("../server/lib/productionWorkflow");

const { CHANGE_TYPES } = require("../server/lib/contentIntelligence/multiSourceCorrelation/correlationTypes");

function baseCanonical(overrides = {}) {
  return {
    formatId: "cip_generator_ready_document_v1",
    metadata: {
      title: "SSC CGL Recruitment 2026 Notification",
      organization: "SSC",
      importantDates: { lastDate: "21/07/2026", applicationEnd: "21/07/2026" }
    },
    generatorText: `[Section: Short Information]
Staff Selection Commission CGL 2026
[Section: Important Dates]
Last Date : 21/07/2026
[Section: Vacancy Details]
Total Posts: 4500
[Section: Important Links]
Apply Online=https://ssc.gov.in/apply`,
    generatorMetadata: {
      title: "SSC CGL Recruitment 2026 Notification",
      organization: "SSC"
    },
    ...overrides
  };
}

function baseWorkflowContext(overrides = {}) {
  return {
    workflowId: "pwp_wf_phase4_001",
    monitoringEvent: {
      workflowId: "pwp_wf_phase4_001",
      title: "SSC CGL Recruitment 2026 Notification",
      sourceUrl: "https://ssc.gov.in/cgl-2026-notification.html"
    },
    orchestratorId: "PWP_PRODUCTION_WORKFLOW_ENGINE",
    phase: "PHASE_2",
    ...overrides
  };
}

function baseResolution(decision, extras = {}) {
  return {
    engineId: RESOLUTION_ENGINE_ID,
    decision,
    reason: extras.reason || "test",
    confidence: "high",
    identity: {
      recruitmentKey: "ssc-cgl-2026",
      organization: "SSC",
      advertisementNumber: "SSC/CGL/2026/01",
      recruitmentName: "SSC CGL Recruitment 2026",
      postName: "Assistant"
    },
    match: extras.match || null,
    pageMatch: extras.pageMatch || null,
    updatePlan: extras.updatePlan || null,
    routing: extras.routing || {
      createDraft: true,
      includesGenerator: true
    },
    ...extras
  };
}

function prepareDraft(decision, extras = {}) {
  return prepareGeneratorDraft({
    workflowContext: extras.workflowContext || baseWorkflowContext(),
    resolutionDecision: extras.resolution || baseResolution(decision, extras.resolutionExtras || {}),
    canonicalRecruitmentPackage:
      extras.canonicalRecruitmentPackage === undefined
        ? baseCanonical()
        : extras.canonicalRecruitmentPackage,
    updatePlan: extras.updatePlan || null,
    existingPageMetadata: extras.existingPageMetadata || null,
    recruitmentId: extras.recruitmentId || null
  });
}

function prepareReviewFromDraft(draftResult, overrides = {}) {
  return prepareEditorialReview({
    workflowContext: overrides.workflowContext || baseWorkflowContext(),
    draftPackage: overrides.draftPackage !== undefined ? overrides.draftPackage : draftResult.draftPackage,
    generatorContract:
      overrides.generatorContract !== undefined
        ? overrides.generatorContract
        : draftResult.generatorContract,
    validationSummary:
      overrides.validationSummary !== undefined
        ? overrides.validationSummary
        : draftResult.draftPackage && draftResult.draftPackage.validationSummary,
    editorialNotes:
      overrides.editorialNotes !== undefined
        ? overrides.editorialNotes
        : draftResult.draftPackage && draftResult.draftPackage.editorialNotes,
    existingPageMetadata: overrides.existingPageMetadata || null
  });
}

beforeEach(() => {
  clearEditorialReviewMemory();
});

describe("PWP Phase 4 — Editorial Workflow Layer", () => {
  test("engine identity and catalogs", () => {
    expect(EDITORIAL_WORKFLOW_ENGINE_ID).toBe("PWP_EDITORIAL_WORKFLOW_LAYER");
    expect(EDITORIAL_WORKFLOW_PHASE).toBe("PHASE_4");
    expect(EDITORIAL_PACKAGE_FORMAT_ID).toBe("pwp_editorial_package_v1");
    expect(EDITORIAL_CONTRACT_FORMAT_ID).toBe("pwp_editorial_contract_v1");
    expect(Object.keys(REVIEW_STATES).sort()).toEqual(
      [
        "APPROVED",
        "CHANGES_REQUESTED",
        "QUEUED",
        "READY_FOR_MANUAL_PUBLISH",
        "REJECTED",
        "UNDER_REVIEW"
      ].sort()
    );
    expect(Object.keys(REVIEW_ACTIONS).sort()).toEqual(
      [
        "APPROVE",
        "MARK_READY_FOR_MANUAL_PUBLISH",
        "REJECT",
        "REQUEST_CHANGES",
        "RETURN_TO_QUEUE",
        "START_REVIEW"
      ].sort()
    );
  });

  test("backward compatibility — Phase 1/2/3 exports unchanged", () => {
    expect(PHASE).toBe("PHASE_2");
    expect(ORCHESTRATOR_VERSION).toBe("2.0.0");
    expect(RESOLUTION_ENGINE_ID).toBe("PWP_RECRUITMENT_RESOLUTION_ENGINE");
    expect(GENERATOR_INTEGRATION_ENGINE_ID).toBe("PWP_GENERATOR_INTEGRATION_LAYER");
    expect(GENERATOR_INTEGRATION_PHASE).toBe("PHASE_3");
    expect(typeof buildGeneratorDraftFromCanonical).toBe("function");
    expect(typeof resolveRecruitment).toBe("function");
    expect(typeof prepareGeneratorDraft).toBe("function");
    expect(typeof planUpdateScope).toBe("function");
  });

  test("new recruitment review — queues editorial package", () => {
    const draft = prepareDraft(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT);
    const result = prepareReviewFromDraft(draft);

    expect(result.skipped).toBe(false);
    expect(result.queued).toBe(true);
    expect(result.validationReport.valid).toBe(true);
    expect(result.editorialPackage).toBeTruthy();
    expect(result.editorialPackage.draftType).toBe(DRAFT_TYPES.FULL_RECRUITMENT_DRAFT);
    expect(result.editorialPackage.decision).toBe(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT);
    expect(result.reviewState).toBe(REVIEW_STATES.QUEUED);
    expect(result.editorialPackage.reviewState).toBe(REVIEW_STATES.QUEUED);
    expect(result.editorialPackage.effects.rendersHtml).toBe(false);
    expect(result.editorialPackage.effects.publishes).toBe(false);
    expect(result.editorialPackage.effects.usesAi).toBe(false);
    expect(result.editorialPackage.effects.automaticApproval).toBe(false);
    expect(result.editorialContract.acceptPackage).toBe(true);
    expect(result.editorialContract.boundaries.mayAccessMonitoring).toBe(false);
    expect(result.editorialContract.boundaries.mayAccessProgram1).toBe(false);
    expect(result.editorialContract.boundaries.mayAccessProgram2).toBe(false);
    expect(result.editorialContract.boundaries.mayAccessProgram3).toBe(false);
    expect(result.editorialContract.boundaries.mayAccessResolutionEngine).toBe(false);
    expect(result.editorialContract.boundaries.mayAccessGeneratorInternals).toBe(false);
    expect(result.editorialContract.boundaries.mayPublish).toBe(false);
    expect(result.editorialContract.boundaries.mayAutoApprove).toBe(false);
  });

  test("new page review — queues full page draft", () => {
    const draft = prepareDraft(RESOLUTION_DECISIONS.CREATE_NEW_PAGE, {
      resolutionExtras: {
        match: { matched: true, recruitmentId: "rec-100" },
        pageMatch: { matched: false }
      },
      workflowContext: baseWorkflowContext({
        existingRecruitment: {
          recruitmentId: "rec-100",
          advertisementNumber: "SSC/CGL/2026/01"
        }
      }),
      recruitmentId: "rec-100"
    });

    const result = prepareReviewFromDraft(draft, {
      workflowContext: baseWorkflowContext({
        existingRecruitment: { recruitmentId: "rec-100" }
      })
    });

    expect(result.editorialPackage.draftType).toBe(DRAFT_TYPES.FULL_PAGE_DRAFT);
    expect(result.editorialPackage.recruitmentId).toBe("rec-100");
    expect(result.reviewState).toBe(REVIEW_STATES.QUEUED);
    expect(result.queued).toBe(true);
  });

  test("update review — structured diff model", () => {
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
      },
      {
        changeType: CHANGE_TYPES.SECTION_ADDED,
        previousValue: null,
        currentValue: "Important Links"
      },
      {
        changeType: CHANGE_TYPES.SECTION_REMOVED,
        previousValue: "Eligibility",
        currentValue: null
      }
    ];

    const existingPage = {
      pageId: "page-55",
      sections: [
        PAGE_SECTIONS.SHORT_INFORMATION,
        PAGE_SECTIONS.IMPORTANT_DATES,
        PAGE_SECTIONS.VACANCY_DETAILS,
        PAGE_SECTIONS.ELIGIBILITY
      ]
    };

    const updatePlan = planUpdateScope({ existingPage, detectedChanges });
    const draft = prepareDraft(RESOLUTION_DECISIONS.UPDATE_EXISTING_PAGE, {
      updatePlan,
      existingPageMetadata: existingPage,
      recruitmentId: "rec-100",
      resolutionExtras: {
        match: { matched: true, recruitmentId: "rec-100" },
        pageMatch: { matched: true, pageId: "page-55" },
        updatePlan
      }
    });

    const result = prepareReviewFromDraft(draft, {
      existingPageMetadata: existingPage
    });

    expect(result.editorialPackage.draftType).toBe(DRAFT_TYPES.PAGE_UPDATE_DRAFT);
    expect(result.editorialPackage.affectedSections).toEqual(
      expect.arrayContaining([
        PAGE_SECTIONS.IMPORTANT_DATES,
        PAGE_SECTIONS.VACANCY_DETAILS
      ])
    );
    expect(result.editorialPackage.unaffectedSections).toEqual(
      expect.arrayContaining([PAGE_SECTIONS.SHORT_INFORMATION])
    );
    expect(result.editorialPackage.modifiedSections).toEqual(
      expect.arrayContaining([
        PAGE_SECTIONS.IMPORTANT_DATES,
        PAGE_SECTIONS.VACANCY_DETAILS
      ])
    );
    expect(result.editorialPackage.addedSections).toContain(PAGE_SECTIONS.IMPORTANT_LINKS);
    expect(result.editorialPackage.removedSections).toContain(PAGE_SECTIONS.ELIGIBILITY);
    expect(result.editorialPackage.diff.rewriteContent).toBe(false);
    expect(result.editorialPackage.diff.generatesHtml).toBe(false);
    expect(result.editorialPackage.changeSummary).toBeTruthy();
  });

  test("manual review package — enters queue as REVIEW_ONLY", () => {
    const draft = prepareDraft(RESOLUTION_DECISIONS.MANUAL_REVIEW_REQUIRED, {
      canonicalRecruitmentPackage: null
    });

    const result = prepareReviewFromDraft(draft);

    expect(result.skipped).toBe(false);
    expect(result.queued).toBe(true);
    expect(result.editorialPackage.draftType).toBe(DRAFT_TYPES.REVIEW_ONLY);
    expect(result.editorialPackage.references.generatorCallGenerator).toBe(false);
    expect(result.reviewState).toBe(REVIEW_STATES.QUEUED);
  });

  test("validation failure — missing draft package does not enter queue", () => {
    const draft = prepareDraft(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT);
    const result = prepareEditorialReview({
      workflowContext: baseWorkflowContext(),
      draftPackage: null,
      generatorContract: draft.generatorContract,
      validationSummary: { valid: true, errorCount: 0, warningCount: 0 }
    });

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe("VALIDATION_FAILED");
    expect(result.queued).toBe(false);
    expect(result.editorialPackage).toBeNull();
    expect(result.reviewState).toBeNull();
    expect(result.validationReport.valid).toBe(false);
    expect(result.validationReport.errors.some((e) => e.code === "MISSING_DRAFT_PACKAGE")).toBe(
      true
    );
    expect(result.editorialContract.acceptPackage).toBe(false);
  });

  test("validation failure — incomplete workflow", () => {
    const draft = prepareDraft(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT);
    const result = prepareEditorialReview({
      workflowContext: baseWorkflowContext({ workflowComplete: false }),
      draftPackage: draft.draftPackage,
      generatorContract: draft.generatorContract,
      validationSummary: draft.draftPackage.validationSummary
    });

    expect(result.skipped).toBe(true);
    expect(result.validationReport.errors.some((e) => e.code === "WORKFLOW_INCOMPLETE")).toBe(
      true
    );
  });

  test("validation failure — missing validation summary", () => {
    const draft = prepareDraft(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT);
    const draftWithoutSummary = {
      ...draft.draftPackage,
      validationSummary: null
    };
    Object.freeze(draftWithoutSummary);

    const result = prepareEditorialReview({
      workflowContext: baseWorkflowContext(),
      draftPackage: draftWithoutSummary,
      generatorContract: {
        ...draft.generatorContract,
        validation: null
      },
      validationSummary: null
    });

    expect(result.skipped).toBe(true);
    expect(
      result.validationReport.errors.some((e) => e.code === "MISSING_VALIDATION_SUMMARY")
    ).toBe(true);
  });

  test("queue creation — initial history entry", () => {
    const draft = prepareDraft(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT);
    const result = prepareReviewFromDraft(draft);

    expect(result.reviewHistory).toHaveLength(1);
    expect(result.reviewHistory[0].action).toBe("QUEUE_CREATED");
    expect(result.reviewHistory[0].previousState).toBeNull();
    expect(result.reviewHistory[0].newState).toBe(REVIEW_STATES.QUEUED);
    expect(getEditorialReviewHistory(result.editorialPackage.reviewId)).toHaveLength(1);
  });

  test("start review — QUEUED → UNDER_REVIEW", () => {
    const draft = prepareDraft(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT);
    const prepared = prepareReviewFromDraft(draft);

    const result = reviewAction({
      editorialPackage: prepared.editorialPackage,
      action: REVIEW_ACTIONS.START_REVIEW,
      reason: "Picking up for review",
      reviewerId: "editor-1"
    });

    expect(result.ok).toBe(true);
    expect(result.reviewState).toBe(REVIEW_STATES.UNDER_REVIEW);
    expect(result.editorialPackage.reviewState).toBe(REVIEW_STATES.UNDER_REVIEW);
    expect(result.reviewHistory[result.reviewHistory.length - 1].action).toBe(
      REVIEW_ACTIONS.START_REVIEW
    );
    expect(result.reviewHistory[result.reviewHistory.length - 1].reviewerId).toBe("editor-1");
  });

  test("approve — UNDER_REVIEW → APPROVED (explicit only)", () => {
    const draft = prepareDraft(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT);
    const prepared = prepareReviewFromDraft(draft);
    reviewAction({
      editorialPackage: prepared.editorialPackage,
      action: REVIEW_ACTIONS.START_REVIEW,
      reviewerId: "editor-1"
    });

    const result = reviewAction({
      reviewId: prepared.editorialPackage.reviewId,
      action: REVIEW_ACTIONS.APPROVE,
      reason: "Looks correct",
      reviewerId: "editor-1"
    });

    expect(result.ok).toBe(true);
    expect(result.reviewState).toBe(REVIEW_STATES.APPROVED);
    expect(result.effects.automaticApproval).toBe(false);
  });

  test("reject — UNDER_REVIEW → REJECTED", () => {
    const draft = prepareDraft(RESOLUTION_DECISIONS.CREATE_NEW_PAGE, {
      recruitmentId: "rec-100",
      resolutionExtras: {
        match: { matched: true, recruitmentId: "rec-100" }
      }
    });
    const prepared = prepareReviewFromDraft(draft);
    reviewAction({
      editorialPackage: prepared.editorialPackage,
      action: REVIEW_ACTIONS.START_REVIEW
    });

    const result = reviewAction({
      reviewId: prepared.editorialPackage.reviewId,
      action: REVIEW_ACTIONS.REJECT,
      reason: "Incorrect organization",
      reviewerId: "editor-2"
    });

    expect(result.ok).toBe(true);
    expect(result.reviewState).toBe(REVIEW_STATES.REJECTED);
    expect(result.reviewHistory.some((h) => h.action === REVIEW_ACTIONS.REJECT)).toBe(true);
  });

  test("request changes — UNDER_REVIEW → CHANGES_REQUESTED", () => {
    const draft = prepareDraft(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT);
    const prepared = prepareReviewFromDraft(draft);
    reviewAction({
      editorialPackage: prepared.editorialPackage,
      action: REVIEW_ACTIONS.START_REVIEW
    });

    const result = reviewAction({
      reviewId: prepared.editorialPackage.reviewId,
      action: REVIEW_ACTIONS.REQUEST_CHANGES,
      reason: "Update fee section",
      reviewerId: "editor-1"
    });

    expect(result.ok).toBe(true);
    expect(result.reviewState).toBe(REVIEW_STATES.CHANGES_REQUESTED);
  });

  test("return to queue — CHANGES_REQUESTED → QUEUED", () => {
    const draft = prepareDraft(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT);
    const prepared = prepareReviewFromDraft(draft);
    const reviewId = prepared.editorialPackage.reviewId;

    reviewAction({ reviewId, action: REVIEW_ACTIONS.START_REVIEW });
    reviewAction({
      reviewId,
      action: REVIEW_ACTIONS.REQUEST_CHANGES,
      reason: "Need edits"
    });

    const result = reviewAction({
      reviewId,
      action: REVIEW_ACTIONS.RETURN_TO_QUEUE,
      reason: "Re-queue after notes"
    });

    expect(result.ok).toBe(true);
    expect(result.reviewState).toBe(REVIEW_STATES.QUEUED);
  });

  test("ready for manual publish — APPROVED → READY_FOR_MANUAL_PUBLISH", () => {
    const draft = prepareDraft(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT);
    const prepared = prepareReviewFromDraft(draft);
    const reviewId = prepared.editorialPackage.reviewId;

    reviewAction({ reviewId, action: REVIEW_ACTIONS.START_REVIEW });
    reviewAction({ reviewId, action: REVIEW_ACTIONS.APPROVE, reason: "OK" });

    const result = reviewAction({
      reviewId,
      action: REVIEW_ACTIONS.MARK_READY_FOR_MANUAL_PUBLISH,
      reason: "Ready for publisher",
      reviewerId: "editor-1"
    });

    expect(result.ok).toBe(true);
    expect(result.reviewState).toBe(REVIEW_STATES.READY_FOR_MANUAL_PUBLISH);
    expect(result.effects.readyForManualPublish).toBe(true);
    expect(result.effects.publishes).toBe(false);
  });

  test("invalid transition — cannot approve from QUEUED", () => {
    const draft = prepareDraft(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT);
    const prepared = prepareReviewFromDraft(draft);

    const result = reviewAction({
      editorialPackage: prepared.editorialPackage,
      action: REVIEW_ACTIONS.APPROVE
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("INVALID_TRANSITION");
    expect(result.reviewState).toBe(REVIEW_STATES.QUEUED);
  });

  test("review history — full action trail", () => {
    const draft = prepareDraft(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT);
    const prepared = prepareReviewFromDraft(draft);
    const reviewId = prepared.editorialPackage.reviewId;

    reviewAction({
      reviewId,
      action: REVIEW_ACTIONS.START_REVIEW,
      reviewerId: "ed-a",
      reason: "start"
    });
    reviewAction({
      reviewId,
      action: REVIEW_ACTIONS.REQUEST_CHANGES,
      reviewerId: "ed-a",
      reason: "fix dates"
    });
    reviewAction({
      reviewId,
      action: REVIEW_ACTIONS.START_REVIEW,
      reviewerId: "ed-b",
      reason: "re-check"
    });
    reviewAction({
      reviewId,
      action: REVIEW_ACTIONS.APPROVE,
      reviewerId: "ed-b",
      reason: "good"
    });
    const final = reviewAction({
      reviewId,
      action: REVIEW_ACTIONS.MARK_READY_FOR_MANUAL_PUBLISH,
      reviewerId: "ed-b"
    });

    const history = final.reviewHistory;
    expect(history.map((h) => h.action)).toEqual([
      "QUEUE_CREATED",
      REVIEW_ACTIONS.START_REVIEW,
      REVIEW_ACTIONS.REQUEST_CHANGES,
      REVIEW_ACTIONS.START_REVIEW,
      REVIEW_ACTIONS.APPROVE,
      REVIEW_ACTIONS.MARK_READY_FOR_MANUAL_PUBLISH
    ]);
    expect(history.every((h) => h.timestamp)).toBe(true);
    expect(history.every((h) => Object.prototype.hasOwnProperty.call(h, "previousState"))).toBe(
      true
    );
    expect(history.every((h) => Object.prototype.hasOwnProperty.call(h, "newState"))).toBe(true);
    expect(history.every((h) => Object.prototype.hasOwnProperty.call(h, "reviewerId"))).toBe(true);
  });

  test("determinism — same inputs produce same reviewId and package fields", () => {
    const draft = prepareDraft(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT);
    clearEditorialReviewMemory();
    const a = prepareReviewFromDraft(draft);
    clearEditorialReviewMemory();
    const b = prepareReviewFromDraft(draft);

    expect(a.editorialPackage.reviewId).toBe(b.editorialPackage.reviewId);
    expect(a.editorialPackage.draftId).toBe(b.editorialPackage.draftId);
    expect(a.editorialPackage.workflowId).toBe(b.editorialPackage.workflowId);
    expect(a.editorialPackage.reviewState).toBe(b.editorialPackage.reviewState);
    expect(createReviewId({
      workflowId: a.editorialPackage.workflowId,
      draftId: a.editorialPackage.draftId,
      recruitmentId: a.editorialPackage.recruitmentId
    })).toBe(a.editorialPackage.reviewId);
  });

  test("immutability — editorial package is frozen", () => {
    const draft = prepareDraft(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT);
    const result = prepareReviewFromDraft(draft);

    expect(Object.isFrozen(result.editorialPackage)).toBe(true);
    expect(Object.isFrozen(result.editorialContract)).toBe(true);
    expect(Object.isFrozen(result.reviewHistory)).toBe(true);
    expect(() => {
      result.editorialPackage.reviewState = REVIEW_STATES.APPROVED;
    }).toThrow();
  });

  test("diff model helper — empty for non-update drafts", () => {
    const draft = prepareDraft(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT);
    const diff = buildDiffModel({ draftPackage: draft.draftPackage });

    expect(diff.affectedSections).toEqual([]);
    expect(diff.addedSections).toEqual([]);
    expect(diff.removedSections).toEqual([]);
    expect(diff.modifiedSections).toEqual([]);
    expect(diff.rewriteContent).toBe(false);
    expect(diff.generatesHtml).toBe(false);
  });

  test("validateEditorialReviewInput — exposes summary", () => {
    const draft = prepareDraft(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT);
    const report = validateEditorialReviewInput({
      workflowContext: baseWorkflowContext(),
      draftPackage: draft.draftPackage,
      generatorContract: draft.generatorContract,
      validationSummary: draft.draftPackage.validationSummary
    });

    expect(report.valid).toBe(true);
    expect(report.summary.canEnterReview).toBe(true);
    expect(report.summary.draftId).toBe(draft.draftPackage.draftId);
  });

  test("no auto-approval — READY_FOR_MANUAL_PUBLISH requires explicit mark", () => {
    const draft = prepareDraft(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT);
    const prepared = prepareReviewFromDraft(draft);
    const reviewId = prepared.editorialPackage.reviewId;

    reviewAction({ reviewId, action: REVIEW_ACTIONS.START_REVIEW });
    const approved = reviewAction({ reviewId, action: REVIEW_ACTIONS.APPROVE });

    expect(approved.reviewState).toBe(REVIEW_STATES.APPROVED);
    expect(approved.reviewState).not.toBe(REVIEW_STATES.READY_FOR_MANUAL_PUBLISH);

    const ready = reviewAction({
      reviewId,
      action: REVIEW_ACTIONS.MARK_READY_FOR_MANUAL_PUBLISH
    });
    expect(ready.reviewState).toBe(REVIEW_STATES.READY_FOR_MANUAL_PUBLISH);
  });

  test("section actions map into diff ADD/UPDATE/REMOVE", () => {
    const existingPage = {
      pageId: "page-77",
      sections: [
        PAGE_SECTIONS.SHORT_INFORMATION,
        PAGE_SECTIONS.IMPORTANT_DATES,
        PAGE_SECTIONS.ELIGIBILITY
      ]
    };
    const detectedChanges = [
      {
        changeType: CHANGE_TYPES.IMPORTANT_DATE,
        field: "importantDates.lastDate",
        previousValue: "a",
        currentValue: "b"
      },
      {
        changeType: CHANGE_TYPES.SECTION_ADDED,
        previousValue: null,
        currentValue: "Important Links"
      },
      {
        changeType: CHANGE_TYPES.SECTION_REMOVED,
        previousValue: "Eligibility",
        currentValue: null
      }
    ];
    const updatePlan = planUpdateScope({ existingPage, detectedChanges });
    const draft = prepareDraft(RESOLUTION_DECISIONS.UPDATE_EXISTING_PAGE, {
      updatePlan,
      existingPageMetadata: existingPage,
      recruitmentId: "rec-77",
      resolutionExtras: {
        match: { matched: true, recruitmentId: "rec-77" },
        pageMatch: { matched: true, pageId: "page-77" },
        updatePlan
      }
    });

    expect(draft.draftPackage.updatePackage.sectionActions[PAGE_SECTIONS.IMPORTANT_DATES]).toBe(
      SECTION_ACTIONS.UPDATE
    );
    expect(draft.draftPackage.updatePackage.sectionActions[PAGE_SECTIONS.IMPORTANT_LINKS]).toBe(
      SECTION_ACTIONS.ADD
    );
    expect(draft.draftPackage.updatePackage.sectionActions[PAGE_SECTIONS.ELIGIBILITY]).toBe(
      SECTION_ACTIONS.REMOVE
    );

    const diff = buildDiffModel({
      draftPackage: draft.draftPackage,
      existingPageMetadata: existingPage
    });
    expect(diff.modifiedSections).toContain(PAGE_SECTIONS.IMPORTANT_DATES);
    expect(diff.addedSections).toContain(PAGE_SECTIONS.IMPORTANT_LINKS);
    expect(diff.removedSections).toContain(PAGE_SECTIONS.ELIGIBILITY);
  });
});
