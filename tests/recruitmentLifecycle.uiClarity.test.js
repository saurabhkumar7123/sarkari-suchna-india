"use strict";

/**
 * Focused UI clarity assertions for Recruitment / Event / Draft / Public Page.
 * Static wiring only — no DB wipe, no automation activation.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const recruitmentsHtml = read("private/admin-recruitments.html");
const recruitmentsJs = read("public/assets/js/admin-recruitment-operations.js");
const generatorHtml = read("private/generator.html");
const generatorJs = read("public/assets/js/generator.js");
const draftsJs = read("public/assets/js/admin-generator-drafts.js");
const reviewHtml = read("private/admin-recruitment-review-queue.html");
const reviewJs = read("public/assets/js/admin-recruitment-review-queue.js");
const pageManagerJs = read("public/assets/js/admin-page-manager.js");
const draftController = read("server/controllers/admin/generatorDraft.controller.js");
const draftService = read("server/services/generatorDraft.service.js");
const automationFlags = read("server/config/automationFlags.js");
const pageRepo = read("server/repositories/page.repository.js");

describe("Recruitment lifecycle UI clarity", () => {
  test("1–4: Recruitments overview shows Recruitment / Page / Stage / Drafts", () => {
    expect(recruitmentsHtml).toContain('id="recruitmentLifecycleOverview"');
    expect(recruitmentsHtml).toContain("Canonical Public Page");
    expect(recruitmentsHtml).toContain("Current Stage");
    expect(recruitmentsHtml).toContain("Pending Drafts");
    expect(recruitmentsHtml).toContain("Published History");
    expect(recruitmentsJs).toContain("renderLifecycleOverview");
    expect(recruitmentsJs).toContain("/generator?draftId=");
  });

  test("5: Draft binding shows Event + Canonical Page and sends event id", () => {
    expect(recruitmentsHtml).toContain('id="draftBindEventSelect"');
    expect(recruitmentsHtml).toContain("Canonical Public Page");
    expect(recruitmentsJs).toContain("recruitment_event_id");
    expect(recruitmentsJs).toContain("rom-bind__label");
    expect(recruitmentsJs).toContain("Open in Generator");
  });

  test("6–7: Generator loads draftId and distinguishes update vs create modes", () => {
    expect(generatorJs).toContain("loadGeneratorDraftFromURL");
    expect(generatorJs).toContain("applyLinkedPublicPageToGenerator");
    expect(generatorJs).toContain("UPDATE EXISTING PAGE");
    expect(generatorJs).toContain("CREATE NEW PUBLIC PAGE");
    expect(generatorJs).toContain("EDITING DRAFT");
    expect(generatorHtml).toContain("generatorContextPublicPage");
  });

  test("8: Published draft is not reopened as editable draft", () => {
    expect(draftController).toContain("This draft is already published");
    expect(generatorJs).toContain("Draft already published");
    expect(generatorJs).toContain("This draft is history");
  });

  test("9: Review Center Open Draft / Manual Publish use draftId", () => {
    expect(reviewJs).toContain("/generator?draftId=");
    expect(reviewJs).toContain("Open Draft");
    expect(reviewJs).toContain("Not matched yet");
    expect(reviewHtml).toContain('id="rrqNeedsMatchingSummary"');
    expect(reviewJs).toContain("Left standalone — no Recruitment was created or attached");
  });

  test("10: Draft Manager shows Recruitment / Event / Public Page context", () => {
    expect(generatorHtml).toContain("Saved Draft Management");
    expect(draftsJs).toContain("Saved Draft Management");
    expect(draftsJs).toContain("Recruitment:");
    expect(draftsJs).toContain("Event:");
    expect(draftsJs).toContain("Public Page:");
    expect(draftsJs).toContain("Open Recruitment");
    expect(draftService).toContain("enrichDraftListRows");
    expect(draftController).toContain("recruitmentTitle");
    expect(draftController).toContain("publicPageSlug");
  });

  test("11: Page Manager shows linkage without becoming recruitment workspace", () => {
    expect(pageRepo).toContain("recruitment_id, recruitment_event_id");
    expect(pageManagerJs).toContain("Open Recruitment");
    expect(pageManagerJs).toContain("Canonical Page:");
    expect(pageManagerJs).toContain("Current Stage:");
    expect(pageManagerJs).not.toContain("Manual Update");
  });

  test("12: Automation flags remain false by default", () => {
    expect(automationFlags).toContain("AUTO_PUBLISH_ENABLED: false");
    expect(automationFlags).toContain("AUTO_DRAFT_ENABLED: false");
    expect(automationFlags).toContain("LIVE_CRAWLER_ENABLED: false");
    expect(automationFlags).toContain("PRODUCTION_MONITORING_ENABLED: false");
    expect(automationFlags).toContain("RECRUITMENT_PIPELINE_ENABLED: false");
  });

  test("Save draft keeps form and avoids duplicate create on update", () => {
    expect(generatorJs).toContain("Server draft kept open for editing");
    expect(generatorJs).toContain("setGeneratorDraftId(savedId)");
    expect(generatorJs).not.toContain("Form cleared after park");
  });

  test("Ambiguous canonical pages are flagged, not auto-unlinked", () => {
    expect(recruitmentsJs).toContain("resolve canonical mapping");
    expect(generatorJs).toContain("ambiguous_pages");
    expect(recruitmentsJs).not.toContain("unlinkAllPages");
  });
});
