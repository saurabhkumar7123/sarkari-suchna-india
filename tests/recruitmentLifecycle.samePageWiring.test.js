"use strict";

const fs = require("fs");
const path = require("path");

const generatorJs = fs.readFileSync(
  path.join(__dirname, "../public/assets/js/generator.js"),
  "utf8"
);
const reviewQueueJs = fs.readFileSync(
  path.join(__dirname, "../public/assets/js/admin-recruitment-review-queue.js"),
  "utf8"
);
const recruitmentOpsJs = fs.readFileSync(
  path.join(__dirname, "../public/assets/js/admin-recruitment-operations.js"),
  "utf8"
);
const recruitmentsHtml = fs.readFileSync(
  path.join(__dirname, "../private/admin-recruitments.html"),
  "utf8"
);
const generatorHtml = fs.readFileSync(
  path.join(__dirname, "../private/generator.html"),
  "utf8"
);
const reviewQueueController = fs.readFileSync(
  path.join(__dirname, "../server/controllers/admin/recruitmentReviewQueue.controller.js"),
  "utf8"
);
const draftController = fs.readFileSync(
  path.join(__dirname, "../server/controllers/admin/generatorDraft.controller.js"),
  "utf8"
);
const generatorController = fs.readFileSync(
  path.join(__dirname, "../server/controllers/admin/generator.controller.js"),
  "utf8"
);

describe("recruitment lifecycle same-page wiring (static)", () => {
  test("A: Generator hydrates linked public page into oldSlug update mode", () => {
    expect(generatorJs).toContain("applyLinkedPublicPageToGenerator");
    expect(generatorJs).toContain('resolution.status === "unique"');
    expect(generatorJs).toContain("oldSlugEl.value = slug");
    expect(generatorJs).toContain("setPageUrlLocked(true)");
  });

  test("B: ambiguous multi-page blocks publish rather than creating", () => {
    expect(generatorJs).toContain("__generatorPublishBlock");
    expect(generatorJs).toContain("ambiguous_pages");
    expect(generatorController).toContain("evaluateSamePagePublishGuard");
    expect(generatorController).toContain("status(409)");
    expect(generatorController).toContain("existingSlug");
  });

  test("C/D: Review Center Manual Publish uses linked_draft status", () => {
    expect(reviewQueueController).toContain("linked_draft");
    expect(reviewQueueController).toContain("attachLinkedDraft");
    expect(reviewQueueJs).toContain('linked.status || "").toLowerCase() === "published"');
    expect(reviewQueueJs).toContain("/admin/page-manager");
    expect(reviewQueueJs).toContain("/generator?draftId=");
  });

  test("E: Manual Update exposes draft deep link", () => {
    expect(recruitmentOpsJs).toContain("manualUpdateOpenGenerator");
    expect(recruitmentOpsJs).toContain("/generator?draftId=");
    expect(recruitmentsHtml).toContain('id="manualUpdateOpenGenerator"');
  });

  test("H: Standalone copy does not claim recruitment was created", () => {
    expect(reviewQueueJs).toContain("Left standalone — no Recruitment was created or attached");
    expect(reviewQueueJs).not.toMatch(/standalone:\s*`Standalone Recruitment created/);
  });

  test("I: Draft binding Open in Generator uses draftId", () => {
    expect(recruitmentsHtml).toContain('id="openBoundDraftGeneratorBtn"');
    expect(recruitmentOpsJs).toContain("openBoundDraftGeneratorBtn");
    expect(recruitmentOpsJs).toContain("Open in Generator");
  });

  test("J: Preview path still present without requiring draft save", () => {
    expect(generatorJs).toContain("/api/preview-page");
    expect(generatorJs).toContain("updatePreview");
  });

  test("K: Save feedback offers Open saved draft link", () => {
    expect(generatorJs).toContain("Open saved draft");
    expect(generatorJs).toContain("Server draft kept open for editing");
    expect(generatorJs).toContain("Browser backup is separate");
  });

  test("publish confirmation distinguishes create vs update", () => {
    expect(generatorJs).toContain("Updating existing public page");
    expect(generatorJs).toContain("Creating new public page");
    expect(generatorJs).toContain("existing page updated");
    expect(generatorJs).toContain("new public page created");
  });

  test("draft GET returns linkedPublicPage for unpublished drafts", () => {
    expect(draftController).toContain("linkedPublicPage");
    expect(draftController).toContain("getDraftWithPublishContext");
  });

  test("Generator context distinguishes Recruitment / Event / Draft / Public page", () => {
    expect(generatorHtml).toContain("Lifecycle context");
    expect(generatorHtml).toContain("Recruitment = permanent parent");
    expect(generatorJs).toContain("UPDATE EXISTING PAGE");
    expect(generatorJs).toContain("CREATE NEW PUBLIC PAGE");
    expect(generatorJs).toContain("EDITING DRAFT");
    expect(generatorHtml).toContain("generatorContextPublicPage");
  });

  test("role copy keeps Editorial / Review / Page Manager distinct", () => {
    expect(recruitmentsHtml).toContain("Review Center = matching/ops");
    expect(recruitmentsHtml).toContain("Editorial Review = optional QA");
    expect(recruitmentsHtml).toContain("not the public page HTML preview");
  });
});
