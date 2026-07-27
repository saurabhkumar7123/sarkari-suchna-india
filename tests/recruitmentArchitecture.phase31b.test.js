"use strict";

/**
 * Phase 31.B regression — architecture hardening without behavior expansion.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

const {
  REVIEW_STATUS,
  REVIEW_DECISIONS,
  resolveStatusForDecision,
  updateReviewDecision,
  createReviewItem
} = require("../server/lib/recruitment/reviewQueue");

const {
  pushRuntimePreview,
  resetRuntimePreviewBuffer,
  getRuntimePreviewSize,
  MAX_PREVIEW_ENTRIES
} = require("../server/lib/recruitment/runtimePreviewBuffer");

const recruitmentRuntimePreviewService = require("../server/services/recruitmentRuntimePreview.service");
const recruitmentReviewService = require("../server/services/recruitmentReview.service");

jest.mock("../server/repositories/recruitmentReview.repository", () => ({
  tableExists: jest.fn().mockResolvedValue(true),
  create: jest.fn(),
  findById: jest.fn(),
  findPending: jest.fn(),
  list: jest.fn(),
  updateDecision: jest.fn()
}));

const recruitmentReviewRepository = require("../server/repositories/recruitmentReview.repository");

describe("Phase 31.B — unified status mapping", () => {
  test("resolveStatusForDecision is exported once from reviewQueue", () => {
    const source = read("server/lib/recruitment/reviewQueue.js");
    expect(source).toMatch(/function resolveStatusForDecision/);
    expect(source).toMatch(/resolveStatusForDecision/);

    const service = read("server/services/recruitmentReview.service.js");
    expect(service).toMatch(/resolveStatusForDecision/);
    expect(service).not.toMatch(/function resolveStatusForDecision/);
  });

  test("mapping matches prior admin service behavior when currentStatus omitted", () => {
    expect(resolveStatusForDecision(REVIEW_DECISIONS.APPROVE)).toBe(REVIEW_STATUS.APPROVED);
    expect(resolveStatusForDecision(REVIEW_DECISIONS.REJECT)).toBe(REVIEW_STATUS.REJECTED);
    expect(resolveStatusForDecision(REVIEW_DECISIONS.SKIP)).toBe(REVIEW_STATUS.UNDER_REVIEW);
    expect(resolveStatusForDecision(REVIEW_DECISIONS.NONE)).toBe(REVIEW_STATUS.PENDING);
  });

  test("mapping matches prior in-memory lib behavior with currentStatus", () => {
    expect(
      resolveStatusForDecision(REVIEW_DECISIONS.NONE, REVIEW_STATUS.UNDER_REVIEW)
    ).toBe(REVIEW_STATUS.PENDING);
    expect(
      resolveStatusForDecision(REVIEW_DECISIONS.NONE, REVIEW_STATUS.PENDING)
    ).toBe(REVIEW_STATUS.PENDING);
    expect(
      resolveStatusForDecision(REVIEW_DECISIONS.NONE, REVIEW_STATUS.FROZEN)
    ).toBe(REVIEW_STATUS.FROZEN);

    const item = createReviewItem({
      title: "SSC Admit Card",
      eventType: "admit_card"
    });
    const underReview = updateReviewDecision(item, REVIEW_DECISIONS.SKIP);
    expect(underReview.item.status).toBe(REVIEW_STATUS.UNDER_REVIEW);
    const reset = updateReviewDecision(underReview.item, REVIEW_DECISIONS.NONE);
    expect(reset.item.status).toBe(REVIEW_STATUS.PENDING);
  });

  test("service decision updates still use unified mapper", async () => {
    recruitmentReviewRepository.findById.mockResolvedValue({
      id: 3,
      status: REVIEW_STATUS.PENDING,
      decision: REVIEW_DECISIONS.NONE,
      notes: null
    });
    recruitmentReviewRepository.updateDecision.mockResolvedValue({
      id: 3,
      status: REVIEW_STATUS.APPROVED,
      decision: REVIEW_DECISIONS.APPROVE
    });

    await recruitmentReviewService.updateReviewDecision(3, {
      decision: REVIEW_DECISIONS.APPROVE
    });

    expect(recruitmentReviewRepository.updateDecision).toHaveBeenCalledWith(3, {
      decision: REVIEW_DECISIONS.APPROVE,
      status: REVIEW_STATUS.APPROVED,
      notes: null
    });
  });
});

describe("Phase 31.B — preview service + updateId", () => {
  beforeEach(() => {
    resetRuntimePreviewBuffer();
  });

  test("service preserves FIFO capacity over buffer", () => {
    for (let i = 0; i < MAX_PREVIEW_ENTRIES + 5; i += 1) {
      recruitmentRuntimePreviewService.recordRuntimePreviewFromPipeline({
        pipelineOutcome: {
          skipped: false,
          result: {
            status: "no_match",
            warnings: [],
            eventType: "result",
            selectedRecruitment: null,
            reviewItem: null
          },
          updateId: i + 1
        },
        notice: { title: `N${i}`, content: `N${i}`, url: "" },
        updateId: i + 1
      });
    }

    expect(recruitmentRuntimePreviewService.getRuntimePreviewSize()).toBe(
      MAX_PREVIEW_ENTRIES
    );
    expect(getRuntimePreviewSize()).toBe(MAX_PREVIEW_ENTRIES);
  });

  test("updateId propagates onto preview entries when present", () => {
    const entry = recruitmentRuntimePreviewService.recordRuntimePreviewFromPipeline({
      pipelineOutcome: {
        skipped: false,
        result: {
          status: "no_match",
          warnings: ["NO_CANDIDATES"],
          eventType: "admit_card",
          selectedRecruitment: null,
          reviewItem: null
        },
        updateId: 4242
      },
      notice: {
        title: "SSC CGL Admit Card",
        content: "SSC CGL Admit Card",
        url: "https://ssc.nic.in/a.pdf"
      },
      updateId: 4242
    });

    expect(entry).not.toBeNull();
    expect(entry.updateId).toBe(4242);

    const listed = recruitmentRuntimePreviewService.listRuntimePreviews({});
    expect(listed.data[0].updateId).toBe(4242);
  });

  test("controller does not import preview buffer", () => {
    const controller = read(
      "server/controllers/admin/recruitmentRuntimePreview.controller.js"
    );
    expect(controller).toMatch(/recruitmentRuntimePreview\.service/);
    expect(controller).not.toMatch(/runtimePreviewBuffer/);
  });
});

describe("Phase 31.B — runtime safety / no persistence", () => {
  test("worker does not auto-save review items", () => {
    const worker = read("server/services/workers/siteWorker.js");
    expect(worker).toMatch(/recruitmentRuntimePreview\.service/);
    expect(worker).not.toMatch(/recruitmentReview\.service/);
    expect(worker).not.toMatch(/saveReviewItem/);
    expect(worker).not.toMatch(/recruitment_review_queue/);
  });

  test("pipeline runner still has no review persistence", () => {
    const source = read("server/lib/recruitment/runRecruitmentPipeline.js");
    expect(source).not.toMatch(/saveReviewItem/);
    expect(source).not.toMatch(/recruitmentReview/);
  });

  test("scheduler and monitoring entrypoints are not recruitment-wired", () => {
    const candidates = [
      "server/services/updates/siteChecker.js",
      "server/services/queue/siteQueue.js"
    ];
    for (const rel of candidates) {
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) continue;
      const source = fs.readFileSync(abs, "utf8");
      expect(source).not.toMatch(/saveReviewItem/);
      expect(source).not.toMatch(/runtimePreviewBuffer/);
      expect(source).not.toMatch(/runRecruitmentPipeline/);
    }
  });

  test("saveReviewItem still accepts snake_case and camelCase (compat)", async () => {
    recruitmentReviewRepository.create.mockResolvedValue({ id: 1 });

    await recruitmentReviewService.saveReviewItem({
      reviewItem: {
        title: "Compat Notice",
        eventType: "result",
        createdAt: "2026-07-14T12:00:00.000Z"
      },
      update_id: 99,
      raw_notice: { title: "Compat Notice" }
    });

    expect(recruitmentReviewRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        update_id: 99,
        raw_notice: { title: "Compat Notice" }
      })
    );

    await recruitmentReviewService.saveReviewItem({
      reviewItem: {
        title: "Compat Notice 2",
        eventType: "result",
        createdAt: "2026-07-14T12:00:00.000Z"
      },
      updateId: 100,
      rawNotice: { title: "Compat Notice 2" }
    });

    expect(recruitmentReviewRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        update_id: 100,
        raw_notice: { title: "Compat Notice 2" }
      })
    );
  });

  test("UI removes misleading nothing-is-saved claim on testing page", () => {
    const html = read("private/admin-recruitment-testing.html");
    expect(html).not.toMatch(/Nothing is saved, published, or sent to Telegram/);
    expect(html).toMatch(/Save Review Item/);
    expect(html).toMatch(/Runtime Preview/);
    expect(html).toMatch(/Review Queue/);
  });

  test("docs document process-local preview limitation", () => {
    const doc = read("docs/recruitment-runtime-preview.md");
    expect(doc).toMatch(/process-local/i);
    expect(doc).toMatch(/PM2/);
    expect(doc).toMatch(/title/);
    expect(doc).toMatch(/link/);
  });

  test("pushRuntimePreview without updateId stores null", () => {
    const entry = pushRuntimePreview({
      notice: { title: "X", content: "X", url: "" },
      processorResult: {
        status: "no_match",
        warnings: [],
        eventType: "unknown",
        selectedRecruitment: null,
        reviewItem: null
      }
    });
    expect(entry.updateId).toBeNull();
  });
});
