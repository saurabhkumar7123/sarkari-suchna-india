"use strict";

/**
 * Lifecycle hardening — one-page rule, guards, atomic finalize, revision,
 * validation, flags, and conversion-failure review retention.
 */

const {
  resolveCanonicalFromLinkedPages,
  evaluateSamePagePublishGuard
} = require("../server/lib/recruitment/canonicalPublicPage");
const {
  resolvePublishPolicy,
  PUBLISH_TARGETS
} = require("../server/lib/recruitment/lifecyclePublishPolicy");
const {
  finalizeLifecyclePublish,
  isLifecycleUpdateEvent,
  projectRecruitmentStageFromEvent
} = require("../server/lib/recruitment/lifecycleAtomicPublish");
const {
  validatePublisherDraftContent,
  classifyDocumentFromTitle
} = require("../server/lib/recruitment/publisherDraftValidation");
const { getAutomationFlags } = require("../server/config/automationFlags");
const { restorePageFromVersion } = require("../server/lib/recruitment/pageRestore");

jest.mock("../server/services/generatorDraft.service", () => ({
  getDraftById: jest.fn(),
  markDraftPublished: jest.fn()
}));
jest.mock("../server/services/recruitmentPageLink.service", () => ({
  linkPage: jest.fn()
}));
jest.mock("../server/services/recruitmentEvent.service", () => ({
  getRecruitmentEvent: jest.fn(),
  updateRecruitmentEvent: jest.fn()
}));
jest.mock("../server/repositories/recruitment.repository", () => ({
  patchRecruitment: jest.fn()
}));

const generatorDraftService = require("../server/services/generatorDraft.service");
const recruitmentPageLinkService = require("../server/services/recruitmentPageLink.service");
const recruitmentEventService = require("../server/services/recruitmentEvent.service");
const recruitmentRepository = require("../server/repositories/recruitment.repository");

describe("lifecycle hardening — one canonical page policy", () => {
  test("admit/result/answer_key never default to dedicated status page", () => {
    for (const type of ["admit_card", "answer_key", "result", "final_result", "objection"]) {
      const policy = resolvePublishPolicy(type);
      expect(policy.target).toBe(PUBLISH_TARGETS.UPDATE_EXISTING_VACANCY_PAGE);
      expect(policy.autoPublish).toBe(false);
      expect(policy.oneCanonicalPage).toBe(true);
    }
  });

  test("notification may create new vacancy page", () => {
    const policy = resolvePublishPolicy("notification");
    expect(policy.target).toBe(PUBLISH_TARGETS.NEW_VACANCY_PAGE);
    expect(policy.autoPublish).toBe(false);
  });
});

describe("lifecycle hardening — publish guards", () => {
  test("unique page + matching oldSlug allows update", () => {
    const resolution = resolveCanonicalFromLinkedPages([
      { id: 10, slug: "up-police-constable-2026", recruitment_id: 1 }
    ]);
    const guard = evaluateSamePagePublishGuard({
      oldSlug: "up-police-constable-2026",
      resolution,
      isLifecycleUpdate: true,
      eventType: "admit_card"
    });
    expect(guard.allowed).toBe(true);
    expect(guard.code).toBe("update");
  });

  test("lifecycle update with no canonical page is blocked", () => {
    const resolution = resolveCanonicalFromLinkedPages([]);
    const guard = evaluateSamePagePublishGuard({
      oldSlug: null,
      resolution,
      isLifecycleUpdate: true,
      eventType: "admit_card"
    });
    expect(guard.allowed).toBe(false);
    expect(guard.code).toBe("missing_canonical_page");
    expect(guard.message).toMatch(/exactly one canonical public page/i);
  });

  test("ambiguous pages always blocked", () => {
    const resolution = resolveCanonicalFromLinkedPages([
      { id: 1, slug: "page-a", recruitment_id: 1 },
      { id: 2, slug: "page-b", recruitment_id: 1 }
    ]);
    expect(
      evaluateSamePagePublishGuard({
        oldSlug: "page-a",
        resolution,
        eventType: "result"
      }).allowed
    ).toBe(false);
    expect(
      evaluateSamePagePublishGuard({
        oldSlug: null,
        resolution
      }).code
    ).toBe("ambiguous_pages");
  });

  test("second-page create blocked when unique canonical exists", () => {
    const resolution = resolveCanonicalFromLinkedPages([
      { id: 10, slug: "up-police-constable-2026", recruitment_id: 1 }
    ]);
    const guard = evaluateSamePagePublishGuard({ oldSlug: null, resolution });
    expect(guard.allowed).toBe(false);
    expect(guard.code).toBe("create_blocked_existing_page");
  });

  test("lifecycle update without oldSlug blocked even when unique page exists", () => {
    const resolution = resolveCanonicalFromLinkedPages([
      { id: 10, slug: "up-police-constable-2026", recruitment_id: 1 }
    ]);
    const guard = evaluateSamePagePublishGuard({
      oldSlug: null,
      resolution,
      eventType: "admit_card"
    });
    expect(guard.allowed).toBe(false);
    expect(guard.code).toBe("update_requires_old_slug");
    expect(guard.existingSlug).toBe("up-police-constable-2026");
  });
});

describe("lifecycle hardening — atomic finalize", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("successful finalize marks draft, links page, activates event, projects stage", async () => {
    generatorDraftService.getDraftById.mockResolvedValue({
      id: 7,
      status: "draft",
      recruitment_id: 3,
      recruitment_event_id: 9
    });
    generatorDraftService.markDraftPublished.mockResolvedValue({
      id: 7,
      status: "published",
      recruitment_id: 3,
      recruitment_event_id: 9
    });
    recruitmentPageLinkService.linkPage.mockResolvedValue({ id: 50 });
    recruitmentEventService.getRecruitmentEvent.mockResolvedValue({
      id: 9,
      status: "pending",
      event_type: "admit_card"
    });
    recruitmentEventService.updateRecruitmentEvent.mockResolvedValue({
      id: 9,
      status: "active",
      event_type: "admit_card"
    });
    recruitmentRepository.patchRecruitment.mockResolvedValue({
      id: 3,
      lifecycle_state: "exam_scheduled"
    });

    const result = await finalizeLifecyclePublish({
      savedPageId: 50,
      publishedSlug: "up-police-constable-2026",
      generatorDraftId: 7,
      recruitmentId: 3,
      recruitmentEventId: 9,
      eventType: "admit_card"
    });

    expect(result.ok).toBe(true);
    expect(generatorDraftService.markDraftPublished).toHaveBeenCalled();
    expect(recruitmentPageLinkService.linkPage).toHaveBeenCalledWith({
      page_id: 50,
      recruitment_id: 3,
      recruitment_event_id: 9
    });
    expect(recruitmentEventService.updateRecruitmentEvent).toHaveBeenCalledWith(9, {
      status: "active"
    });
    expect(recruitmentRepository.patchRecruitment).toHaveBeenCalled();
  });

  test("draft mark failure sets ok=false and preserves error", async () => {
    generatorDraftService.getDraftById.mockResolvedValue({ id: 7, status: "draft" });
    generatorDraftService.markDraftPublished.mockRejectedValue(new Error("draft boom"));
    recruitmentPageLinkService.linkPage.mockResolvedValue({});

    const result = await finalizeLifecyclePublish({
      savedPageId: 50,
      publishedSlug: "slug",
      generatorDraftId: 7,
      recruitmentId: 3
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.step === "draft_mark_published")).toBe(true);
  });

  test("already published draft is not re-marked", async () => {
    generatorDraftService.getDraftById.mockResolvedValue({
      id: 7,
      status: "published"
    });
    const result = await finalizeLifecyclePublish({
      savedPageId: 50,
      publishedSlug: "slug",
      generatorDraftId: 7
    });
    expect(generatorDraftService.markDraftPublished).not.toHaveBeenCalled();
    expect(result.draft.skipped).toBe(true);
  });
});

describe("lifecycle hardening — stage + validation", () => {
  test("isLifecycleUpdateEvent covers admit/result", () => {
    expect(isLifecycleUpdateEvent("admit_card")).toBe(true);
    expect(isLifecycleUpdateEvent("result")).toBe(true);
    expect(isLifecycleUpdateEvent("notification")).toBe(false);
  });

  test("document classification from title", () => {
    expect(classifyDocumentFromTitle("UP Police Admit Card 2026")).toBe("ADMIT_CARD");
    expect(classifyDocumentFromTitle("SSC CGL Result")).toBe("RESULT");
    expect(classifyDocumentFromTitle("RRB NTPC Notification")).toBe("NOTIFICATION");
  });

  test("publisher validation flags short extraction without blocking", () => {
    const result = validatePublisherDraftContent({
      title: "Test",
      text: "short",
      eventType: "notification"
    });
    expect(result.blocking).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.code === "extraction_too_short")).toBe(true);
  });

  test("projectRecruitmentStageFromEvent patches lifecycle_state", async () => {
    recruitmentRepository.patchRecruitment.mockResolvedValue({
      id: 1,
      lifecycle_state: "results"
    });
    const out = await projectRecruitmentStageFromEvent({
      recruitmentId: 1,
      eventType: "result"
    });
    expect(out.skipped).toBe(false);
    expect(recruitmentRepository.patchRecruitment).toHaveBeenCalled();
  });
});

describe("lifecycle hardening — automation safety", () => {
  test("AUTO_PUBLISH and related activation flags remain false by default", () => {
    const flags = getAutomationFlags();
    expect(flags.AUTO_PUBLISH_ENABLED).toBe(false);
    expect(flags.AUTO_DRAFT_ENABLED).toBe(false);
    expect(flags.LIVE_CRAWLER_ENABLED).toBe(false);
    expect(flags.PRODUCTION_MONITORING_ENABLED).toBe(false);
    expect(flags.RECRUITMENT_PIPELINE_ENABLED).toBe(false);
  });

  test("page restore requires explicit confirmation", async () => {
    await expect(
      restorePageFromVersion({ pageId: 1, version: 1, confirm: false })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("lifecycle hardening — conversion failure review retention (unit)", () => {
  test("persistDraft soft-fails conversion instead of hard-skip when requireAcceptedConvert", async () => {
    // Behavioral contract: soft gate sets conversionRequired rather than skipped:true
    // for convert failure — asserted via source string (implementation freeze).
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(
      path.join(__dirname, "../server/lib/recruitment/productionRuntime/index.js"),
      "utf8"
    );
    expect(src).toContain("conversionRequired = true");
    expect(src).toContain("never drop the update");
    expect(src).toContain("shouldEnqueueReview = draftReady || needsMatching");
    expect(src).not.toMatch(
      /if \(requireAcceptedConvert && \(!pdfExtraction\.ok \|\| aiConvert\.ok !== true\)\) \{\s*return \{\s*skipped: true/
    );
  });
});
