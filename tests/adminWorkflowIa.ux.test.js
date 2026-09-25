"use strict";

/**
 * Workflow UX/IA regression — presentation only.
 * Confirms manual/automatic guidance, page purpose copy, safety posture,
 * and that no automation enable / auto-publish controls were added.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const readBuf = (rel) => fs.readFileSync(path.join(root, rel));

describe("Admin Workflow IA — manual + automatic clarity", () => {
  test("shared workflow IA module exposes factual page catalog", () => {
    const js = read("public/assets/js/admin-workflow-ia.js");
    expect(js).toContain("AdminWorkflowIA");
    expect(js).toContain("Approve");
    expect(js).toContain("Publish");
    expect(js).toContain("Automation: OFF");
    expect(js).toContain("Manual Publish");
    expect(js).not.toMatch(/enableAutomation|AUTO_PUBLISH_ENABLED\s*=\s*true|setAutoPublish\s*\(\s*true/i);
    expect(js).toContain('/api/admin/automation-control-center/settings');

    const sandbox = {
      window: {},
      document: {
        readyState: "complete",
        body: { dataset: {} },
        querySelectorAll: () => [],
        getElementById: () => null,
        addEventListener() {}
      },
      location: { hash: "", search: "" },
      URLSearchParams
    };
    sandbox.window = Object.assign(sandbox.window, {
      location: sandbox.location,
      addEventListener() {},
      AdminWorkflowIA: null
    });
    vm.createContext(sandbox);
    vm.runInContext(js + "\nthis.__WF = this.AdminWorkflowIA || (this.window && this.window.AdminWorkflowIA);", sandbox);
    const pages = (sandbox.__WF || sandbox.window.AdminWorkflowIA).PAGES;
    expect(pages.recruitments.currentStep).toBe("recruitment");
    expect(pages.needsMatching.currentStep).toBe("matching");
    expect(pages.editorial.next).toMatch(/Manual Publish|Generator/i);
    expect(pages.editorial.purpose).toMatch(/optional/i);
    expect(pages.pageManager.purpose).toMatch(/already published/i);
    expect(pages.needsMatching.next).toMatch(/Generator/i);
    expect(pages.drafts.purpose).toMatch(/not published/i);
    expect(pages.events.purpose).toMatch(/lifecycle events/i);
    expect(pages.acc.purpose).toMatch(/Ops overview/i);
  });

  test("design system hides removed workflow guidance panel (mobile-safe)", () => {
    const css = read("public/assets/css/admin/admin-design-system.css");
    expect(css).toContain(".adm-wf");
    expect(css).toContain(".adm-wf-scenarios");
    expect(css).toMatch(/\.adm-wf[^{]*\{[^}]*display:\s*none\s*!important/);
    expect(css).toMatch(/@media \(max-width: 768px\)[\s\S]*\.adm-wf-scenarios/);
  });

  test("key pages keep workflow script; guidance panel is not rendered", () => {
    const files = {
      recruitments: "private/admin-recruitments.html",
      rrq: "private/admin-recruitment-review-queue.html",
      editorial: "private/admin-editorial-review.html",
      drafts: "private/generator.html",
      pages: "private/admin-page-manager.html",
      monitoring: "private/admin-monitoring.html",
      updates: "private/admin-monitoring-updates.html",
      acc: "private/admin-automation-control-center.html",
      dashboard: "private/admin-dashboard.html"
    };
    Object.values(files).forEach((rel) => {
      const html = read(rel);
      expect(html).toContain("admin-workflow-ia.js");
      expect(html).toMatch(/admin-design-system\.css\?v=\d+/);
    });

    const wfJs = read("public/assets/js/admin-workflow-ia.js");
    expect(wfJs).toContain("el.remove()");
    expect(wfJs).not.toContain("<dt>This page</dt>");
    expect(wfJs).not.toContain("<dt>Before this</dt>");
    expect(wfJs).not.toContain("<dt>Do here</dt>");
    expect(wfJs).not.toContain("<dt>Next step</dt>");

    expect(read(files.recruitments)).not.toContain('data-adm-wf="recruitments"');
    expect(read(files.recruitments)).not.toContain('data-adm-wf="events"');
    expect(read(files.recruitments)).not.toContain('id="recruitmentEmpty" class="rom-card rom-empty"');
    expect(read(files.recruitments)).not.toMatch(/<h2>Select a recruitment<\/h2>/);
    expect(read(files.recruitments)).toContain("Create manual update");
    expect(read(files.recruitments)).toMatch(/Create a recruitment record when this vacancy does not already exist/i);
    expect(read(files.recruitments)).toMatch(/Manual Publish/i);

    expect(read(files.rrq)).toMatch(/Needs Matching.*filter/i);
    expect(read(files.rrq)).toMatch(/Approve\s*[≠!=].*publish|Approve ≠ publish/i);
    expect(read(files.rrq)).toContain('id="rrqManualPublishLink"');
    expect(read(files.rrq)).toContain('href="/generator#drafts"');
    expect(read(files.rrq)).not.toContain('id="rrqManualPublishLink" href="/admin/page-manager"');
    expect(read(files.rrq)).toContain("Attach to existing Recruitment");

    expect(read(files.editorial)).toMatch(/APPROVE ≠ PUBLISH|Approve ≠ Publish/i);
    expect(read(files.editorial)).toMatch(/Optional content QA/i);
    expect(read(files.editorial)).toContain("Final manual publishing is done from Generator");
    expect(read(files.editorial)).not.toContain('href="/admin/page-manager" style="text-decoration:none;">Publish Page');

    expect(read(files.drafts)).toContain("Saved Draft Management");
    expect(read(files.drafts)).toMatch(/Manual Publish/i);
    expect(read(files.drafts)).toContain('data-label-desktop="Manual Publish"');
    expect(read(files.drafts)).toContain('id="savePageBtn"');
    expect(read(files.drafts)).toContain('id="previewBtn"');
    expect(read(files.drafts)).toContain('id="saveDraftBtn"');
    expect(read(files.drafts)).toContain('id="aiConvertBtn"');
    // Drafts hash hides Preview / Save Draft / AI / Publish — management list only.
    const draftsCss = read("public/assets/css/admin/admin-design-system.css");
    expect(draftsCss).toMatch(/body\[data-admin-hash="drafts"\][\s\S]*#savePageBtn/);
    expect(draftsCss).toMatch(/body\[data-admin-hash="drafts"\][\s\S]*#previewBtn/);
    expect(draftsCss).toMatch(/body\[data-admin-hash="drafts"\][\s\S]*#saveDraftBtn/);
    expect(draftsCss).toMatch(/body\[data-admin-hash="drafts"\][\s\S]*#aiConvertBtn/);
    expect(draftsCss).toMatch(/body\[data-admin-hash="drafts"\][\s\S]*\.action-group-tools/);
    expect(draftsCss).toMatch(/body\[data-admin-hash="drafts"\][\s\S]*display:\s*none\s*!important/);
    expect(draftsCss).toMatch(/\.admin-breadcrumbs[\s\S]*display:\s*none\s*!important/);
    expect(draftsCss).toMatch(/\.mon-workspace-head__sub[\s\S]*display:\s*none\s*!important/);
    expect(draftsCss).toMatch(/\.admin-header \+ \.admin-page-head:not\(\[id\]\)/);

    expect(read(files.pages)).toMatch(/already published/i);
    expect(read(files.pages)).toMatch(/First-time publishing is done from Generator/i);

    expect(read(files.acc)).toMatch(/Publishing remains manual-only|Manual Publish/i);
  });

  test("dashboard scenario guide markup remains for safety links; CSS hides explainer block", () => {
    const html = read("private/admin-dashboard.html");
    const css = read("public/assets/css/admin/admin-design-system.css");
    expect(html).toContain('id="admWfScenarios"');
    expect(html).toContain('href="/admin/recruitment-review-queue?status=needs_matching"');
    expect(html).toContain('href="/generator#drafts"');
    expect(html).toMatch(/Manual Publish|manual-only/i);
    expect(html).not.toMatch(/Enable automation|Turn on auto.?publish|AUTO_PUBLISH_ENABLED\s*=\s*true/i);
    expect(css).toMatch(/#admWfScenarios[\s\S]*display:\s*none\s*!important/);
  });

  test("nav keeps Review Center canonical; Needs Matching is filter-only (not sidebar)", () => {
    const nav = read("public/assets/js/admin-nav.js");
    expect(nav).toContain('ADMIN_NAV_VERSION = "31"');
    expect(nav).toContain(
      'navLink("/admin/recruitment-review-queue", "/admin/recruitment-review-queue", I.review, "Review Center"'
    );
    expect(nav).not.toContain(
      'navLink("/admin/recruitment-review-queue?status=needs_matching", "/admin/recruitment-review-queue", I.review, "Needs Matching"'
    );
    expect(nav).toContain('navLink("/admin/editorial-review", "/admin/editorial-review", I.review, "Editorial Review"');
    expect(nav).not.toContain('navLink("/admin/recruitments#eventTimeline", "/admin/recruitments", I.cal, "Recruitment Timeline"');
    expect(nav).toContain("/admin/page-manager");
    expect(nav).toContain("/generator#drafts");
    expect(nav).toMatch(/not a separate sidebar item/);
  });

  test("Event Timeline remains hash on recruitments (no invented route; not a second workspace)", () => {
    const html = read("private/admin-recruitments.html");
    expect(html).toContain('id="eventTimeline"');
    expect(html).toContain('id="recruitmentEventsSection"');
    expect(html).not.toContain("/admin/event-timeline");
    expect(html).not.toContain('href="/admin/recruitments#eventTimeline"');
  });

  test("safety copy present; no new enable-automation controls on workflow pages", () => {
    const pages = [
      "private/admin-recruitments.html",
      "private/admin-recruitment-review-queue.html",
      "private/admin-editorial-review.html",
      "private/admin-page-manager.html",
      "private/generator.html",
      "private/admin-dashboard.html",
      "private/admin-automation-control-center.html"
    ];
    pages.forEach((rel) => {
      const html = read(rel);
      expect(html).not.toMatch(/id=["']enableAutoPublish|enableLiveCrawler|turnOnAutomation/i);
      expect(html.toLowerCase()).toMatch(/manual publish|manual only|approve.*publish|publish.*manual/);
    });

    const flags = read("server/config/automationFlags.js");
    const rrqJs = read("public/assets/js/admin-recruitment-review-queue.js");
    const rrqHtml = read("private/admin-recruitment-review-queue.html");
    expect(rrqJs).toContain("/generator?draftId=");
    expect(rrqJs).toContain("/generator#drafts");
    // Default Manual Publish control stays on Generator; Page Manager is only a
    // fallback when the linked draft is already published history.
    expect(rrqHtml).toContain('id="rrqManualPublishLink" href="/generator#drafts"');
    expect(rrqHtml).not.toContain('id="rrqManualPublishLink" href="/admin/page-manager"');
    expect(rrqJs).toContain('getElementById("rrqManualPublishLink")');
    expect(rrqJs).toMatch(/published[\s\S]*\/admin\/page-manager|\/admin\/page-manager[\s\S]*published/i);

    expect(flags).toContain("AUTO_PUBLISH_ENABLED: false");
    expect(flags).toContain("LIVE_CRAWLER_ENABLED: false");
    expect(flags).toContain("PRODUCTION_MONITORING_ENABLED: false");
  });

  test("UTF-8: dashboard scenario section has no Windows-1252 mojibake", () => {
    const buf = readBuf("private/admin-dashboard.html");
    const html = buf.toString("utf8");
    expect(html).toContain("Approve never publishes");
    expect(buf.includes(0x92)).toBe(false);
    expect(buf.includes(0x97)).toBe(false);
  });
});
