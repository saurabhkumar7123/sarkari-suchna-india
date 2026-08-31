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
    expect(html).toContain("Recruitment Manager");
    expect(html).toMatch(/One recruitment = one permanent public page/i);
    expect(html).toContain('id="newRecruitmentBtn"');
    expect(html).toContain("+ New Recruitment");
    expect(html).not.toContain('data-adm-wf="recruitments"');
    expect(html).not.toContain('data-adm-wf="events"');
    expect(html).not.toContain("Where am I");
    expect(html).not.toContain("admin-ops-flow");
    expect(html).not.toContain("rom-workflow");
    expect(html).not.toContain('data-workspace="events"');
    expect(html).toContain("Manual Publish");
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

    expect(html).toMatch(/Operational decisions/i);
    expect(html).toMatch(/Needs Matching.*filter/i);
    expect(html).toContain('data-rrq-status="needs_matching"');
    expect(html).toContain('id="rrqFilterLegend"');
    expect(html).toContain("Attach to existing Recruitment");
    expect(html).toContain('data-field="source_url"');
    expect(html).not.toContain('aria-label="Review workflow"');
    expect(wf).toMatch(/Needs Matching is a status filter/i);
    expect(wf).toContain("Review Center · Needs Matching");
    expect(rrq).toContain("Showing: Needs Matching (Review Center filter");
    expect(rrq).toContain('status === "needs_matching"');
    expect(rrq).toContain("nextStepMessage");
    expect(rrq).toContain("setAttachSelection");
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
});
