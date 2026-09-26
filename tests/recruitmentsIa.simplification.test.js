"use strict";

/**
 * Focused IA tests: Recruitments simplification + Review Center / Needs Matching.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

describe("Recruitments IA simplification", () => {
  test("/admin/recruitments is the primary recruitment workspace without workflow dump", () => {
    const html = read("private/admin-recruitments.html");
    expect(html).toContain('id="romPageTitle"');
    expect(html).toContain(">Recruitments</div>");
    expect(html).toContain('id="newRecruitmentBtn"');
    expect(html).toContain("+ New Recruitment");
    expect(html).not.toContain('data-adm-wf="recruitments"');
    expect(html).not.toContain('data-adm-wf="events"');
    expect(html).not.toContain("Where am I");
    expect(html).not.toContain("admin-ops-flow");
    expect(html).not.toContain("rom-workflow");
    expect(html).not.toContain('data-workspace="events"');
    expect(html).toContain("Manual Publish");
    // Page-purpose explainer copy intentionally removed from Recruitments head.
    expect(html).not.toMatch(/One recruitment = one permanent public page/i);
  });

  test("New Recruitment copy and existing actions remain available", () => {
    const html = read("private/admin-recruitments.html");
    expect(html).toMatch(/Create a recruitment record when this vacancy does not already exist/i);
    expect(html).toContain('id="recruitmentForm"');
    expect(html).toContain('id="recruitmentFormPurpose"');
    expect(html).toContain('id="recruitmentSearch"');
    expect(html).toContain("Event Timeline");
    expect(html).toContain("Generator Draft Binding");
    expect(html).toContain("Recruitment Page");
    expect(html).toContain("manualUpdateForm");
    expect(html).toContain("Shared Runtime Preview");
    expect(html).toContain("Editorial Review (optional QA)");
  });

  test("Event Timeline does not duplicate the main Recruitment Manager", () => {
    const html = read("private/admin-recruitments.html");
    const css = read("public/assets/css/admin/admin-design-system.css");
    const js = read("public/assets/js/admin-recruitment-operations.js");
    const nav = read("public/assets/js/admin-nav.js");

    expect(html).toContain('id="eventTimeline"');
    expect(html).toContain('id="recruitmentEventsSection"');
    expect(html).not.toContain('href="/admin/recruitments#eventTimeline"');
    expect(html).not.toContain("/admin/event-timeline");
    expect(css).not.toMatch(
      /body\[data-admin-hash="eventTimeline"\]\s*\[data-workspace="recruitments"\]/
    );
    expect(js).toContain("handleEventTimelineHash");
    expect(js).toContain("focusEventTimeline");
    expect(nav).not.toContain('navLink("/admin/recruitments#eventTimeline"');
  });

  test("sidebar has Recruitments + Review Center; no Needs Matching / Timeline duplicates", () => {
    const nav = read("public/assets/js/admin-nav.js");
    expect(nav).toContain('ADMIN_NAV_VERSION = "31"');
    expect(nav).toContain(
      'navLink("/admin/recruitments", "/admin/recruitments", I.rec, "Recruitments"'
    );
    expect(nav).toContain(
      'navLink("/admin/recruitment-review-queue", "/admin/recruitment-review-queue", I.review, "Review Center"'
    );
    expect(nav).not.toContain(
      'navLink("/admin/recruitment-review-queue?status=needs_matching"'
    );
    expect(nav).not.toContain('"Recruitment Timeline"');
    expect(nav).not.toMatch(/navLink\([^)]*"Needs Matching"/);
    expect(nav).toContain("not a separate sidebar item");
  });

  test("Review Center clarifies Needs Matching as a filter; query still works", () => {
    const html = read("private/admin-recruitment-review-queue.html");
    const wf = read("public/assets/js/admin-workflow-ia.js");
    const rrq = read("public/assets/js/admin-recruitment-review-queue.js");
    const css = read("public/assets/css/admin/recruitment-review-queue.css");

    expect(html).toMatch(/Operational decisions/i);
    expect(html).toMatch(/Needs Matching.*filter/i);
    expect(html).toContain('data-rrq-status="needs_matching"');
    expect(html).toContain('id="rrqFilterLegend"');
    expect(html).toContain("Attach to existing Recruitment");
    expect(html).toContain('data-field="source_url"');
    expect(html).not.toContain('aria-label="Review workflow"');
    expect(html).toContain("recruitment-review-queue.css?v=14");
    expect(html).toContain("admin-recruitment-review-queue.js?v=14");
    expect(wf).toMatch(/Needs Matching is a status filter/i);
    expect(wf).toContain("Review Center · Needs Matching");
    expect(rrq).toContain("Showing: Needs Matching (Review Center filter");
    expect(rrq).toContain('status === "needs_matching"');
    expect(rrq).toContain("nextStepMessage");
    expect(rrq).toContain("setAttachSelection");
    expect(rrq).toContain("rrq-cell-title");
    expect(rrq).toContain("syncListDetailChrome");
    expect(rrq).toContain("rrq-layout--detail-only");
    expect(rrq).toContain("closeReviewDetail");
    expect(rrq).toContain("syncReviewUrl");
    expect(css).toContain(".rrq-layout.rrq-layout--detail-only");
    expect(css).toContain("body.rrq-detail-active");
    expect(css).toContain("table-layout: fixed");
    expect(css).toContain(".rrq-cell-title");
  });

  test("list shows human-readable recruitment fields; create success includes name", () => {
    const html = read("private/admin-recruitments.html");
    const js = read("public/assets/js/admin-recruitment-operations.js");
    expect(html).toContain("Recruitment Name");
    expect(html).toContain("Organization");
    expect(html).toContain("Exam / post");
    expect(js).toContain("Recruitment created successfully —");
    expect(js).toContain("row.post_name");
    expect(js).toContain("if (!steps.length) return");
  });

  test("safety flags unchanged", () => {
    const flags = read("server/config/automationFlags.js");
    expect(flags).toContain("AUTO_PUBLISH_ENABLED: false");
    expect(flags).toContain("LIVE_CRAWLER_ENABLED: false");
    expect(flags).toContain("PRODUCTION_MONITORING_ENABLED: false");
  });

  test("Recruitment ID column + compact detail accordion with close/back", () => {
    const html = read("private/admin-recruitments.html");
    const js = read("public/assets/js/admin-recruitment-operations.js");
    const css = read("public/assets/css/admin/recruitment-operations.css");

    expect(html).toContain("Recruitment ID");
    expect(html).toContain('id="romDetailIdLabel"');
    expect(html).toContain('id="closeRecruitmentDetailBtn"');
    expect(html).toContain("← Back to Recruitments");
    expect(html).toContain('data-rom-accordion="exclusive"');
    expect(html).toContain('data-rom-acc="overview"');
    expect(html).toContain('data-rom-acc="lifecycle"');
    expect(html).toContain('data-rom-acc="drafts"');
    expect(html).toContain('data-rom-acc="page"');
    expect(html).toContain('data-rom-acc="updates"');
    expect(html).toContain('data-rom-acc="actions"');
    expect(html).toContain('data-rom-acc="advanced"');
    expect(html).toMatch(/data-rom-acc="overview"[^>]*\sopen/);
    expect(html).toContain("recruitment-operations.css?v=13");
    expect(html).toContain("admin-recruitment-operations.js?v=15");
    expect(html).toContain('id="romDetailTabs"');
    expect(html).toContain('data-rom-tab="overview"');
    expect(html).toContain('data-rom-tab="lifecycle"');
    expect(html).toContain('data-rom-tab="drafts"');
    expect(html).toContain('data-rom-tab="page"');
    expect(html).toContain('data-rom-tab="updates"');
    expect(html).toContain('id="romDetailHeaderActions"');
    expect(html).toContain('form="recruitmentForm"');

    expect(js).toContain("rom-rec-id");
    expect(js).toContain("closeRecruitmentDetail");
    expect(js).toContain("syncRecruitmentUrl");
    expect(js).toContain("openAccordionSection");
    expect(js).toContain("wireExclusiveAccordion");
    expect(js).toContain("wireDetailTabs");
    expect(js).toContain("syncListDetailChrome");
    expect(js).toContain("syncUiContext");
    expect(js).toContain("getUiMode");
    expect(js).toContain("rom-layout--detail-only");
    expect(js).toContain("Recruitment ID:");
    expect(js).toContain('colspan="7"');
    expect(js).toContain("setIdentityEditMode");
    expect(js).toContain("enterIdentityEditMode");
    expect(js).toContain("cancelIdentityEdit");
    expect(js).toContain("editRecruitmentIdentityBtn");
    expect(js).toContain("bar.hidden = count === 0");
    expect(js).toContain('mode === "create"');
    expect(js).toContain('params.get("mode")');

    expect(css).toContain(".rom-detail-header");
    expect(css).toContain(".rom-acc-group");
    expect(css).toContain(".rom-layout--detail-only");
    expect(css).toContain(".rom-detail-tabs");
    expect(css).toContain(".rom-filters--toolbar");
    expect(css).toContain(".rom-rec-id");
    expect(css).toContain(".rom-form--readonly");
    expect(css).toContain(".rom-detail-header__actions");
    expect(css).toContain("body.rom-mode-edit #romDetailTabs");
  });

  test("list vs detail chrome: Review Center and New Recruitment only on list", () => {
    const html = read("private/admin-recruitments.html");
    const js = read("public/assets/js/admin-recruitment-operations.js");
    const css = read("public/assets/css/admin/recruitment-operations.css");

    expect(html).toContain('id="newRecruitmentBtn"');
    expect(html).toContain("+ New Recruitment");
    expect(html).not.toMatch(/href="\/admin\/recruitment-review-queue"/);
    expect(html).not.toMatch(/>\s*Review Center\s*</);
    expect(js).toContain("syncListDetailChrome");
    expect(js).toContain("syncUiContext");
    expect(js).toContain('return "create"');
    expect(js).toContain('return "view"');
    expect(js).toContain('return "edit"');
    expect(js).toContain("rom-recruitment-detail-active");
    expect(js).toMatch(/if \(selected\?\.id\) return/);
    expect(js).toContain("AdminUI?.simpleConfirm");
    expect(js).toContain('confirmLabel: "Archive"');
    expect(js).toContain('title: "Archive recruitment?"');
    expect(js).not.toContain('href="/admin/recruitment-review-queue"');
    expect(css).toContain("body.rom-recruitment-detail-active #newRecruitmentBtn");
    expect(css).toContain("body.rom-recruitment-detail-active #adminLastUpdated");
    expect(css).toContain("body.rom-mode-create #romDetailTabs");
    expect(css).toContain("body.rom-mode-edit #romDetailTabs");
  });

  test("Recruitment Identity uses Edit → Save/Cancel workflow", () => {
    const html = read("private/admin-recruitments.html");
    const js = read("public/assets/js/admin-recruitment-operations.js");

    expect(html).toContain('id="editRecruitmentIdentityBtn"');
    expect(html).toContain('id="recruitmentIdentityEditActions"');
    expect(html).toContain('id="saveRecruitmentBtn"');
    expect(html).toContain('id="romDetailHeaderActions"');
    expect(html).toContain('data-identity-mode="view"');
    expect(html).toContain("rom-form--readonly");
    expect(html).toMatch(/id="saveRecruitmentBtn"[^>]*>Save</);
    expect(js).toContain("setIdentityEditMode(false)");
    expect(js).toContain("setIdentityEditMode(!row?.id)");
    expect(js).toContain("if (!identityEditMode) return");
    expect(js).toContain("syncUiContext");
    expect(js).toContain("dataset.romMode");
    expect(js).toContain("Editing existing recruitment");
    expect(js).toContain('saveBtn.textContent = "Save"');
  });

  test("LIST / CREATE / VIEW / EDIT context matrix is encoded in UI state", () => {
    const html = read("private/admin-recruitments.html");
    const js = read("public/assets/js/admin-recruitment-operations.js");
    const css = read("public/assets/css/admin/recruitment-operations.css");

    // LIST
    expect(html).toContain('id="newRecruitmentBtn"');
    expect(html).toContain('id="recruitmentBulkBar" hidden');
    expect(js).toContain("bar.hidden = count === 0");
    expect(js).toMatch(/if \(mode === "list"\)[\s\S]*newBtn\.hidden = false/);
    expect(js).toMatch(/if \(mode === "list"\)[\s\S]*editBtn\.hidden = true/);
    expect(js).toMatch(/if \(mode === "list"\)[\s\S]*saveBtn\.hidden = true/);
    expect(js).toMatch(/if \(mode === "list"\)[\s\S]*archiveBtn\.hidden = true/);

    // CREATE (+ URL)
    expect(js).toContain('mode === "create"');
    expect(js).toContain('syncRecruitmentUrl(null, { replace: false, mode: "create" })');
    expect(js).toContain("createModeRequested");
    expect(js).toMatch(/if \(mode === "create"\)[\s\S]*tabs\.hidden = true/);
    expect(js).toMatch(/if \(mode === "create"\)[\s\S]*archiveBtn\.hidden = true/);
    expect(js).toMatch(/if \(mode === "create"\)[\s\S]*cancelBtn\.hidden = false/);
    expect(css).toContain("body.rom-mode-create #romDetailTabs");

    // VIEW
    expect(js).toMatch(/if \(mode === "view"\)[\s\S]*editBtn\.hidden = false/);
    expect(js).toMatch(/if \(mode === "view"\)[\s\S]*cancelBtn\.hidden = true/);
    expect(js).toMatch(/if \(mode === "view"\)[\s\S]*saveBtn\.hidden = true/);
    expect(js).toMatch(/if \(mode === "view"\)[\s\S]*tabs\.hidden = false/);
    expect(html).toContain('data-rom-tab="overview"');
    expect(html).toContain('data-rom-tab="lifecycle"');
    expect(html).toContain('data-rom-tab="drafts"');
    expect(html).toContain('data-rom-tab="page"');
    expect(html).toContain('data-rom-tab="updates"');
    expect(html).not.toMatch(/href="\/admin\/recruitment-review-queue"/);

    // EDIT
    expect(js).toContain('return "edit"');
    expect(js).toContain("Editing existing recruitment");
    expect(js).toMatch(/\/\/ edit[\s\S]*tabs\.hidden = true/);
    expect(js).toMatch(/\/\/ edit[\s\S]*archiveBtn\.hidden = true/);
    expect(js).toContain('if (getUiMode() !== "view") return');
    expect(css).toContain("body.rom-mode-edit #romDetailTabs");

    // Archive confirmation
    expect(js).toContain('title: "Archive recruitment?"');
    expect(js).toContain('confirmLabel: "Archive"');
  });
});
