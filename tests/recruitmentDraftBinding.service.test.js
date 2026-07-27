"use strict";

const os = require("os");
const path = require("path");
const fs = require("fs");

const storePath = path.join(os.tmpdir(), `editorial-review-4c-${process.pid}-${Date.now()}.json`);
process.env.EDITORIAL_REVIEW_STORE_PATH = storePath;
process.env.GENERATOR_DRAFTS_ENABLED = "1";

jest.mock("../server/repositories/generatorDraft.repository", () => ({
  tableExists: jest.fn().mockResolvedValue(true),
  linkageColumnsExist: jest.fn().mockResolvedValue(true),
  findById: jest.fn(),
  listDraftsByRecruitmentId: jest.fn(),
  listUnboundDrafts: jest.fn(),
  updateDraftLinkage: jest.fn()
}));

jest.mock("../server/repositories/recruitment.repository", () => ({
  getRecruitmentById: jest.fn()
}));

jest.mock("../server/repositories/recruitmentEvent.repository", () => ({
  getRecruitmentEventById: jest.fn()
}));

jest.mock("../server/config/generatorDrafts", () => ({
  isGeneratorDraftsEnabled: jest.fn(() => true),
  MAX_GENERATOR_DRAFTS: 20
}));

const generatorDraftRepository = require("../server/repositories/generatorDraft.repository");
const recruitmentRepository = require("../server/repositories/recruitment.repository");
const editorialReviewRepository = require("../server/repositories/editorialReview.repository");
const bindingService = require("../server/services/recruitmentDraftBinding.service");
const reviewService = require("../server/services/editorialReview.service");
const { WORKFLOW_STATES, BINDING_STATUSES } = require("../server/lib/recruitment/editorialWorkflow");

const recruitment = {
  id: 10,
  title: "SSC CGL 2026",
  slug: "ssc-cgl-2026",
  department: "ssc",
  lifecycle_state: "announced"
};

const draft = {
  id: 55,
  title: "SSC CGL 2026 Draft",
  slug_hint: "ssc-cgl-2026",
  status: "draft",
  payload: { title: "SSC CGL 2026 Draft", data: "Notification body content goes here for review." },
  recruitment_id: null,
  recruitment_event_id: null,
  created_at: "2026-07-19T00:00:00.000Z",
  updated_at: "2026-07-19T00:00:00.000Z"
};

describe("Package 4C recruitment draft binding + editorial review", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    editorialReviewRepository.resetStoreForTests(storePath);
    recruitmentRepository.getRecruitmentById.mockResolvedValue(recruitment);
    generatorDraftRepository.findById.mockResolvedValue({ ...draft });
    generatorDraftRepository.listDraftsByRecruitmentId.mockResolvedValue([]);
    generatorDraftRepository.listUnboundDrafts.mockResolvedValue([{ ...draft }]);
    generatorDraftRepository.updateDraftLinkage.mockResolvedValue(true);
  });

  afterAll(() => {
    try {
      fs.unlinkSync(storePath);
    } catch {
      /* ignore */
    }
  });

  test("getBinding reports No Draft when nothing is linked", async () => {
    const binding = await bindingService.getBinding(10);
    expect(binding.bindingStatus).toBe(BINDING_STATUSES.NO_DRAFT);
    expect(binding.workflowState).toBe(WORKFLOW_STATES.DRAFT_CREATED);
    expect(binding.drafts).toEqual([]);
  });

  test("attachDraft binds draft and moves workflow to draft_attached", async () => {
    generatorDraftRepository.listDraftsByRecruitmentId.mockResolvedValue([
      { ...draft, recruitment_id: 10 }
    ]);

    const binding = await bindingService.attachDraft(10, {
      draftId: 55,
      operator: "admin"
    });

    expect(generatorDraftRepository.updateDraftLinkage).toHaveBeenCalledWith(55, {
      recruitmentId: 10,
      recruitmentEventId: null
    });
    expect(binding.bindingStatus).toBe(BINDING_STATUSES.DRAFT_READY);
    expect(binding.primaryDraftId).toBe(55);
    expect(binding.workflowState).toBe(WORKFLOW_STATES.DRAFT_ATTACHED);
  });

  test("attachDraft rejects draft already bound to another recruitment", async () => {
    generatorDraftRepository.findById.mockResolvedValue({
      ...draft,
      recruitment_id: 99
    });

    await expect(
      bindingService.attachDraft(10, { draftId: 55 })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test("detachDraft clears linkage and resets workflow", async () => {
    generatorDraftRepository.listDraftsByRecruitmentId
      .mockResolvedValueOnce([{ ...draft, recruitment_id: 10 }])
      .mockResolvedValueOnce([]);

    editorialReviewRepository.upsertReview(10, {
      draftId: 55,
      workflowState: WORKFLOW_STATES.DRAFT_ATTACHED
    });

    const binding = await bindingService.detachDraft(10, { draftId: 55, operator: "admin" });
    expect(generatorDraftRepository.updateDraftLinkage).toHaveBeenCalledWith(55, {
      recruitmentId: null,
      recruitmentEventId: null
    });
    expect(binding.bindingStatus).toBe(BINDING_STATUSES.NO_DRAFT);
  });

  test("replaceDraft detaches previous and attaches next", async () => {
    const nextDraft = { ...draft, id: 77, title: "Replacement draft" };
    generatorDraftRepository.findById.mockResolvedValue(nextDraft);
    generatorDraftRepository.listDraftsByRecruitmentId
      .mockResolvedValueOnce([{ ...draft, id: 55, recruitment_id: 10 }])
      .mockResolvedValue([{ ...nextDraft, recruitment_id: 10 }]);

    editorialReviewRepository.upsertReview(10, {
      draftId: 55,
      workflowState: WORKFLOW_STATES.DRAFT_ATTACHED
    });

    const binding = await bindingService.replaceDraft(10, {
      draftId: 77,
      previousDraftId: 55,
      operator: "admin"
    });

    expect(generatorDraftRepository.updateDraftLinkage).toHaveBeenCalledWith(55, {
      recruitmentId: null,
      recruitmentEventId: null
    });
    expect(generatorDraftRepository.updateDraftLinkage).toHaveBeenCalledWith(77, {
      recruitmentId: 10,
      recruitmentEventId: null
    });
    expect(binding.primaryDraftId).toBe(77);
  });

  test("editorial review applies validated decisions and records history", async () => {
    generatorDraftRepository.listDraftsByRecruitmentId.mockResolvedValue([
      { ...draft, recruitment_id: 10 }
    ]);
    generatorDraftRepository.findById.mockResolvedValue({
      ...draft,
      recruitment_id: 10
    });
    editorialReviewRepository.upsertReview(10, {
      draftId: 55,
      workflowState: WORKFLOW_STATES.DRAFT_ATTACHED
    });

    let workspace = await reviewService.applyDecision(10, {
      decision: "submit_for_review",
      comment: "Ready for human review",
      operator: "editor1"
    });
    expect(workspace.workflowState).toBe(WORKFLOW_STATES.REVIEW_PENDING);

    workspace = await reviewService.applyDecision(10, {
      decision: "start_review",
      operator: "editor1"
    });
    expect(workspace.workflowState).toBe(WORKFLOW_STATES.IN_REVIEW);
    expect(workspace.allowedDecisions).toEqual(
      expect.arrayContaining(["approve", "request_changes", "reject", "return_to_draft"])
    );

    workspace = await reviewService.applyDecision(10, {
      decision: "approve",
      comment: "Looks good",
      operator: "editor1"
    });
    expect(workspace.workflowState).toBe(WORKFLOW_STATES.APPROVED);
    expect(workspace.bindingStatus).toBe(BINDING_STATUSES.APPROVED);
    expect(workspace.decisionHistory.length).toBeGreaterThanOrEqual(3);
    expect(workspace.notes.some((n) => n.text === "Looks good")).toBe(true);
  });

  test("editorial review blocks invalid transitions", async () => {
    editorialReviewRepository.upsertReview(10, {
      draftId: 55,
      workflowState: WORKFLOW_STATES.DRAFT_ATTACHED
    });
    generatorDraftRepository.listDraftsByRecruitmentId.mockResolvedValue([
      { ...draft, recruitment_id: 10 }
    ]);
    generatorDraftRepository.findById.mockResolvedValue({ ...draft, recruitment_id: 10 });

    await expect(
      reviewService.applyDecision(10, { decision: "approve", operator: "admin" })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("addNote stores operator identity and timestamp", async () => {
    editorialReviewRepository.upsertReview(10, {
      draftId: 55,
      workflowState: WORKFLOW_STATES.IN_REVIEW
    });
    generatorDraftRepository.listDraftsByRecruitmentId.mockResolvedValue([
      { ...draft, recruitment_id: 10 }
    ]);
    generatorDraftRepository.findById.mockResolvedValue({ ...draft, recruitment_id: 10 });

    const workspace = await reviewService.addNote(10, {
      text: "Internal check complete",
      operator: "reviewer-a"
    });
    expect(workspace.notes[0]).toMatchObject({
      text: "Internal check complete",
      operator: "reviewer-a",
      internal: true
    });
    expect(workspace.notes[0].createdAt).toBeTruthy();
  });
});
