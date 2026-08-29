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
    expect(js).toContain("Publish: MANUAL ONLY");
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
    expect(pages.editorial.next).toMatch(/Manual Publish/i);
    expect(pages.drafts.purpose).toMatch(/not published/i);
    expect(pages.events.purpose).toMatch(/lifecycle events/i);
    expect(pages.acc.purpose).toMatch(/Ops overview/i);
  });

  test("design system includes compact workflow context styles (mobile-safe)", () => {
    const css = read("public/assets/css/admin/admin-design-system.css");
    expect(css).toContain(".adm-wf {");
    expect(css).toContain(".adm-wf-scenarios");
    expect(css).toContain(".adm-wf-steps");
    expect(css).toMatch(/@media \(max-width: 768px\)[\s\S]*\.adm-wf__meta/);
    expect(css).toMatch(/\.adm-wf-steps__arrow\s*\{\s*display:\s*none/);
  });

  test("key pages mount workflow context and clarify next steps", () => {
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
      expect(html).toContain("admin-design-system.css?v=16");
    });

    expect(read(files.recruitments)).toContain('data-adm-wf="recruitments"');
    expect(read(files.recruitments)).toContain('data-adm-wf="events"');
    expect(read(files.recruitments)).toContain("Create manual update");
    expect(read(files.recruitments)).toMatch(/do not create a duplicate/i);

    expect(read(files.rrq)).toContain('data-adm-wf="reviewCenter"');
    expect(read(files.rrq)).toContain('data-adm-wf="needsMatching"');
    expect(read(files.rrq)).toMatch(/Needs Matching means associate/i);
    expect(read(files.rrq)).toMatch(/Approve is not publish/i);

    expect(read(files.editorial)).toContain('data-adm-wf="editorial"');
    expect(read(files.editorial)).toMatch(/APPROVE ≠ PUBLISH|Approve ≠ Publish/i);

    expect(read(files.drafts)).toContain('data-adm-wf="drafts"');
    expect(read(files.drafts)).toContain('data-adm-wf="generator"');
    expect(read(files.drafts)).toMatch(/Draft ≠ Published/i);

    expect(read(files.pages)).toContain('data-adm-wf="pageManager"');
    expect(read(files.pages)).toMatch(/To publish a new page, use Generator/i);

    expect(read(files.monitoring)).toContain('data-adm-wf="monitoring"');
    expect(read(files.updates)).toContain('data-adm-wf="monitoringUpdates"');
    expect(read(files.acc)).toContain('data-adm-wf="acc"');
    expect(read(files.acc)).toMatch(/not the primary edit workspace/i);
  });

  test("dashboard scenario guide covers manual and automatic start points", () => {
    const html = read("private/admin-dashboard.html");
    expect(html).toContain('id="admWfScenarios"');
    expect(html).toContain("New vacancy");
    expect(html).toContain("Admit card / result / answer key");
    expect(html).toContain("Needs Matching");
    expect(html).toContain("Draft ready");
    expect(html).toContain("Editorial Review");
    expect(html).toContain("Automation path (dormant)");
    expect(html).toContain('href="/admin/recruitment-review-queue?status=needs_matching"');
    expect(html).toContain('href="/generator#drafts"');
    expect(html).toContain("MANUAL ONLY");
    expect(html).not.toMatch(/Enable automation|Turn on auto.?publish|AUTO_PUBLISH_ENABLED\s*=\s*true/i);
  });

  test("nav clarifies Needs Matching vs Review Center vs Editorial without URL changes", () => {
    const nav = read("public/assets/js/admin-nav.js");
    expect(nav).toContain('ADMIN_NAV_VERSION = "30"');
    expect(nav).toContain(
      'navLink("/admin/recruitment-review-queue", "/admin/recruitment-review-queue", I.review, "Review Center"'
    );
    expect(nav).toContain(
      'navLink("/admin/recruitment-review-queue?status=needs_matching", "/admin/recruitment-review-queue", I.review, "Needs Matching"'
    );
    expect(nav).toContain('navLink("/admin/editorial-review", "/admin/editorial-review", I.review, "Editorial Review"');
    expect(nav).toContain('navLink("/admin/recruitments#eventTimeline", "/admin/recruitments", I.cal, "Recruitment Timeline"');
    expect(nav).toContain("/admin/page-manager");
    expect(nav).toContain("/generator#drafts");
    expect(nav).toMatch(/filter shortcut; not a second active destination/);
  });

  test("Event Timeline remains hash on recruitments (no invented route)", () => {
    const html = read("private/admin-recruitments.html");
    expect(html).toContain('id="eventTimeline"');
    expect(html).toContain("/admin/recruitments#eventTimeline");
    expect(html).not.toContain("/admin/event-timeline");
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
