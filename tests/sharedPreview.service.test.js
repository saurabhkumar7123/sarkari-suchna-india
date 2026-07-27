"use strict";

/**
 * Package 4D — shared preview service tests.
 *
 * Verifies aggregation, deterministic snapshots, manual refresh,
 * diagnostics, and cross-module/cross-process consistency.
 */

const os = require("os");
const path = require("path");
const fs = require("fs");

const previewStorePath = path.join(
  os.tmpdir(),
  `shared-preview-4d-${process.pid}-${Date.now()}.json`
);
const reviewStorePath = path.join(
  os.tmpdir(),
  `editorial-review-4d-${process.pid}-${Date.now()}.json`
);
process.env.SHARED_PREVIEW_STORE_PATH = previewStorePath;
process.env.EDITORIAL_REVIEW_STORE_PATH = reviewStorePath;
process.env.GENERATOR_DRAFTS_ENABLED = "1";

jest.mock("../server/repositories/recruitment.repository", () => ({
  tableExists: jest.fn().mockResolvedValue(true),
  getRecruitmentById: jest.fn()
}));

jest.mock("../server/repositories/generatorDraft.repository", () => ({
  tableExists: jest.fn().mockResolvedValue(true),
  linkageColumnsExist: jest.fn().mockResolvedValue(true),
  findById: jest.fn(),
  listDraftsByRecruitmentId: jest.fn(),
  listUnboundDrafts: jest.fn(),
  updateDraftLinkage: jest.fn()
}));

jest.mock("../server/repositories/recruitmentEvent.repository", () => ({
  tableExists: jest.fn().mockResolvedValue(true),
  getRecruitmentEventById: jest.fn(),
  listRecruitmentEventsByRecruitmentId: jest.fn()
}));

jest.mock("../server/repositories/recruitmentPageLink.repository", () => ({
  linkageColumnsExist: jest.fn().mockResolvedValue(true),
  listPageLinkagesByRecruitmentId: jest.fn()
}));

jest.mock("../server/config/generatorDrafts", () => ({
  isGeneratorDraftsEnabled: jest.fn(() => true),
  MAX_GENERATOR_DRAFTS: 20
}));

const recruitmentRepository = require("../server/repositories/recruitment.repository");
const generatorDraftRepository = require("../server/repositories/generatorDraft.repository");
const recruitmentEventRepository = require("../server/repositories/recruitmentEvent.repository");
const recruitmentPageLinkRepository = require("../server/repositories/recruitmentPageLink.repository");
const editorialReviewRepository = require("../server/repositories/editorialReview.repository");
const sharedPreviewRepository = require("../server/repositories/sharedPreview.repository");
const sharedPreviewService = require("../server/services/sharedPreview.service");
const editorialReviewService = require("../server/services/editorialReview.service");
const { WORKFLOW_STATES } = require("../server/lib/recruitment/editorialWorkflow");

const recruitment = {
  id: 10,
  title: "SSC CGL 2026",
  slug: "ssc-cgl-2026",
  department: "ssc",
  post_name: "Combined Graduate Level",
  advertisement_no: "SSC/2026/01",
  cycle_year: 2026,
  lifecycle_state: "open",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-10T00:00:00.000Z"
};

const draft = {
  id: 55,
  title: "SSC CGL 2026 Draft",
  slug_hint: "ssc-cgl-2026",
  status: "draft",
  payload: { title: "SSC CGL 2026 Draft", data: "Notification body content goes here for review." },
  recruitment_id: 10,
  recruitment_event_id: null,
  created_at: "2026-07-11T00:00:00.000Z",
  updated_at: "2026-07-12T00:00:00.000Z"
};

const events = [
  { id: 1, recruitment_id: 10, event_type: "notification", sequence_order: 0, status: "active" },
  { id: 2, recruitment_id: 10, event_type: "admit_card", sequence_order: 1, status: "pending" }
];

const pages = [
  { id: 100, slug: "ssc-cgl-2026", recruitment_id: 10, recruitment_event_id: null },
  { id: 101, slug: "ssc-cgl-2026-admit-card", recruitment_id: 10, recruitment_event_id: 2 }
];

function primeMocks() {
  recruitmentRepository.tableExists.mockResolvedValue(true);
  recruitmentRepository.getRecruitmentById.mockResolvedValue({ ...recruitment });
  generatorDraftRepository.tableExists.mockResolvedValue(true);
  generatorDraftRepository.linkageColumnsExist.mockResolvedValue(true);
  generatorDraftRepository.listDraftsByRecruitmentId.mockResolvedValue([{ ...draft }]);
  generatorDraftRepository.findById.mockResolvedValue({ ...draft });
  recruitmentEventRepository.tableExists.mockResolvedValue(true);
  recruitmentEventRepository.listRecruitmentEventsByRecruitmentId.mockResolvedValue({
    data: events.map((event) => ({ ...event })),
    pagination: { page: 1, limit: 50, total: events.length }
  });
  recruitmentPageLinkRepository.linkageColumnsExist.mockResolvedValue(true);
  recruitmentPageLinkRepository.listPageLinkagesByRecruitmentId.mockResolvedValue({
    data: pages.map((page) => ({ ...page })),
    pagination: { page: 1, limit: 50, total: pages.length }
  });
}

describe("Package 4D shared preview service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primeMocks();
    sharedPreviewRepository.resetStoreForTests(previewStorePath);
    editorialReviewRepository.resetStoreForTests(reviewStorePath);
    editorialReviewRepository.upsertReview(10, {
      draftId: 55,
      workflowState: WORKFLOW_STATES.IN_REVIEW,
      notes: [],
      decisionHistory: []
    });
  });

  afterAll(() => {
    for (const file of [previewStorePath, reviewStorePath]) {
      try {
        fs.unlinkSync(file);
      } catch {
        /* ignore */
      }
    }
  });

  test("buildSharedPreview aggregates recruitment, draft, review, pages and events", async () => {
    const snapshot = await sharedPreviewService.buildSharedPreview(10);

    expect(snapshot.recruitment).toMatchObject({ id: 10, slug: "ssc-cgl-2026" });
    expect(snapshot.currentDraft).toMatchObject({ id: 55, status: "draft" });
    expect(snapshot.reviewStatus).toMatchObject({
      workflowState: "in_review",
      bindingStatus: "review_required"
    });
    expect(snapshot.linkedPages).toHaveLength(2);
    expect(snapshot.lifecycleSummary.totalEvents).toBe(2);
    expect(snapshot.integrity.status).toBe("ok");
    expect(snapshot.missingDependencies).toEqual([]);
    expect(snapshot.snapshotVersion).toMatch(/^v1-[0-9a-f]{16}$/);
  });

  test("getSharedPreview builds an initial snapshot, then serves the stored one", async () => {
    const first = await sharedPreviewService.getSharedPreview(10);
    expect(first.source).toBe("refresh");
    expect(first.refreshReason).toBe("initial_build");
    expect(first.refreshCount).toBe(1);

    const second = await sharedPreviewService.getSharedPreview(10);
    expect(second.source).toBe("store");
    expect(second.snapshot.snapshotVersion).toBe(first.snapshot.snapshotVersion);
    expect(second.refreshCount).toBe(1);
  });

  test("snapshots are deterministic — same state yields the same version across refreshes", async () => {
    const first = await sharedPreviewService.refreshSharedPreview(10, { reason: "manual" });
    const second = await sharedPreviewService.refreshSharedPreview(10, { reason: "manual" });
    expect(second.snapshot.snapshotVersion).toBe(first.snapshot.snapshotVersion);
    expect(second.refreshCount).toBe(2);
  });

  test("manual refresh picks up state changes with a new snapshot version", async () => {
    const before = await sharedPreviewService.refreshSharedPreview(10, { reason: "manual" });

    editorialReviewRepository.upsertReview(10, { workflowState: WORKFLOW_STATES.APPROVED });
    const after = await sharedPreviewService.refreshSharedPreview(10, {
      reason: "review_decision",
      operator: "editor1"
    });

    expect(after.snapshot.snapshotVersion).not.toBe(before.snapshot.snapshotVersion);
    expect(after.snapshot.reviewStatus.workflowState).toBe("approved");
    expect(after.snapshot.reviewStatus.bindingStatus).toBe("approved");
    expect(after.refreshReason).toBe("review_decision");
    expect(after.refreshedBy).toBe("editor1");
  });

  test("cross-module consistency: snapshot matches the Editorial Review workspace state", async () => {
    const [preview, workspace] = [
      await sharedPreviewService.getSharedPreview(10),
      await editorialReviewService.getReviewWorkspace(10)
    ];

    expect(preview.snapshot.reviewStatus.workflowState).toBe(workspace.workflowState);
    expect(preview.snapshot.reviewStatus.bindingStatus).toBe(workspace.bindingStatus);
    expect(preview.snapshot.reviewStatus.allowedDecisions).toEqual(workspace.allowedDecisions);
    expect(preview.snapshot.currentDraft.id).toBe(workspace.draft.id);
    expect(preview.snapshot.recruitment.id).toBe(workspace.recruitment.id);
  });

  test("cross-process consistency: another process reading the store sees the same snapshot", async () => {
    const served = await sharedPreviewService.refreshSharedPreview(10, { reason: "manual" });

    // Simulate a separate process by reading the shared store file directly.
    const raw = JSON.parse(fs.readFileSync(previewStorePath, "utf8"));
    const otherProcessView = raw.previews["10"];

    expect(otherProcessView.snapshot.snapshotVersion).toBe(served.snapshot.snapshotVersion);
    expect(otherProcessView.lastRefresh).toBe(served.lastRefresh);
  });

  test("diagnostics report no_snapshot before any preview exists", async () => {
    const diagnostics = await sharedPreviewService.getPreviewDiagnostics(10);
    expect(diagnostics.consistencyStatus).toBe("no_snapshot");
    expect(diagnostics.lastRefresh).toBeNull();
    expect(diagnostics.snapshotVersion).toBeNull();
    expect(diagnostics.liveSnapshotVersion).toMatch(/^v1-/);
  });

  test("diagnostics report consistent after refresh and stale after an unseen change", async () => {
    await sharedPreviewService.refreshSharedPreview(10, { reason: "manual" });

    let diagnostics = await sharedPreviewService.getPreviewDiagnostics(10);
    expect(diagnostics.consistencyStatus).toBe("consistent");
    expect(diagnostics.validationStatus).toBe("ok");
    expect(diagnostics.missingDependencies).toEqual([]);
    expect(diagnostics.lastRefresh).toBeTruthy();

    editorialReviewRepository.upsertReview(10, { workflowState: WORKFLOW_STATES.APPROVED });
    diagnostics = await sharedPreviewService.getPreviewDiagnostics(10);
    expect(diagnostics.consistencyStatus).toBe("stale");
    expect(diagnostics.snapshotVersion).not.toBe(diagnostics.liveSnapshotVersion);
  });

  test("integrity validation flags a missing draft (advisory only)", async () => {
    generatorDraftRepository.listDraftsByRecruitmentId.mockResolvedValue([]);
    editorialReviewRepository.upsertReview(10, {
      draftId: null,
      workflowState: WORKFLOW_STATES.DRAFT_CREATED
    });

    const preview = await sharedPreviewService.refreshSharedPreview(10, { reason: "manual" });
    expect(preview.snapshot.integrity.status).toBe("issues_found");
    expect(preview.snapshot.integrity.issues.map((issue) => issue.code)).toContain("missing_draft");
    // Advisory: no corrective writes happened.
    expect(generatorDraftRepository.updateDraftLinkage).not.toHaveBeenCalled();
  });

  test("missing dependencies are reported without breaking the preview", async () => {
    recruitmentPageLinkRepository.linkageColumnsExist.mockResolvedValue(false);
    recruitmentEventRepository.tableExists.mockResolvedValue(false);

    const snapshot = await sharedPreviewService.buildSharedPreview(10);
    expect(snapshot.missingDependencies).toEqual(
      expect.arrayContaining(["pages_recruitment_linkage", "recruitment_events_table"])
    );
    expect(snapshot.linkedPages).toEqual([]);
    expect(snapshot.lifecycleSummary.totalEvents).toBe(0);
    expect(snapshot.recruitment.id).toBe(10);
  });

  test("unknown refresh reasons are normalized to manual", async () => {
    const preview = await sharedPreviewService.refreshSharedPreview(10, {
      reason: "definitely_not_a_reason"
    });
    expect(preview.refreshReason).toBe("manual");
  });

  test("refreshAfterChange never throws, even when aggregation fails", async () => {
    recruitmentRepository.getRecruitmentById.mockRejectedValue(new Error("db down"));
    await expect(
      sharedPreviewService.refreshAfterChange(10, "recruitment_update")
    ).resolves.toBeNull();
  });

  test("rejects invalid recruitment ids and unknown recruitments", async () => {
    await expect(sharedPreviewService.getSharedPreview("abc")).rejects.toMatchObject({
      statusCode: 400
    });

    recruitmentRepository.getRecruitmentById.mockResolvedValue(null);
    await expect(sharedPreviewService.getSharedPreview(999)).rejects.toMatchObject({
      statusCode: 404
    });
  });
});
