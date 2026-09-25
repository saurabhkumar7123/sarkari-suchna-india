"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Admin UI cleanup — Site ID, 2-row sources, ID convention, editorial/recruitments", () => {
  const monitoring = read("private/admin-monitoring.html");
  const editorial = read("private/admin-editorial-review.html");
  const recruitments = read("private/admin-recruitments.html");
  const accJs = read("public/assets/js/admin-automation-control-center.js");
  const opsJs = read("public/assets/js/admin-recruitment-operations.js");
  const erJs = read("public/assets/js/admin-editorial-review.js");
  const polishCss = read("public/assets/css/admin/admin-workspace-polish.css");

  test("Monitoring Official Sources show Site ID in 2-row card layout", () => {
    expect(monitoring).toContain('id="accSourceRows"');
    expect(monitoring).toContain("mon-source-list");
    expect(monitoring).not.toContain("<thead>");
    expect(accJs).toContain("Site ID");
    expect(accJs).toContain("mon-source-card__row--primary");
    expect(accJs).toContain("mon-source-card__row--meta");
    expect(accJs).toContain('data-action="view"');
    expect(accJs).toContain('data-action="run-check"');
    expect(polishCss).toContain(".mon-source-card__row--primary");
    expect(polishCss).toContain(".mon-source-card__row--meta");
    expect(polishCss).not.toMatch(/\.acc-source-table\s*\{[^}]*min-width:\s*960px/);
  });

  test("visible entity IDs omit hash prefix", () => {
    expect(opsJs).toContain("Recruitment ID:");
    expect(opsJs).toContain('title="Recruitment ID">${escapeHtml(row.id)}</span>');
    expect(opsJs).not.toMatch(/Recruitment #\$\{/);
    expect(opsJs).not.toMatch(/Update #\$\{/);
    expect(opsJs).not.toMatch(/Review #\$\{/);
    expect(opsJs).not.toMatch(/Draft #\$\{/);
    expect(erJs).toContain("Recruitment ID:");
    expect(erJs).toContain("Draft ID:");
    expect(erJs).not.toMatch(/Recruitment #\$\{/);
    expect(accJs).toContain("Recruitment ID:");
    expect(accJs).toContain("Update ID:");
    expect(accJs).not.toMatch(/Recruitment #\$\{/);
    expect(recruitments).toContain("Recruitment ID: —");
    expect(recruitments).not.toContain("Recruitment #—");
  });

  test("Editorial Review inbox + empty placeholder + overflow constraints", () => {
    expect(editorial).toContain("Review inbox");
    expect(editorial).toContain('id="erInboxCount"');
    expect(editorial).toContain('id="erInboxList"');
    expect(editorial).not.toContain("Select a review item");
    expect(editorial).not.toContain("admin-ops-flow");
    expect(editorial).toContain('id="erRefreshBtn"');
    expect(erJs).toContain("openWorkspace");
    expect(erJs).toContain("erInboxList");
    expect(polishCss).toMatch(/\.er-layout[\s\S]*min-width:\s*0/);
    expect(polishCss).toContain("overflow-x: clip");
    expect(polishCss).toMatch(
      /\.main:has\(\.er-layout\)[\s\S]*width:\s*calc\(100%\s*-\s*var\(--admin-sidebar-current\)\)/
    );
  });

  test("Recruitments page links polish CSS and keeps identity edit workflow", () => {
    expect(recruitments).toContain("admin-workspace-polish.css");
    expect(recruitments).toContain('id="editRecruitmentIdentityBtn"');
    expect(recruitments).toContain('id="saveRecruitmentBtn"');
    expect(opsJs).toContain("closeRecruitmentDetail");
    expect(opsJs).toContain("setIdentityEditMode");
    expect(polishCss).toContain(".rom-rec-id");
  });

  test("technical hashes and query params remain", () => {
    expect(opsJs).toContain("draftId=");
    expect(opsJs).toContain("/admin/editorial-review?recruitment_id=");
    expect(editorial).not.toContain('href="/generator#drafts"');
    expect(editorial).not.toContain('href="/admin/recruitments"');
    expect(editorial).toContain('id="erRefreshBtn"');
    expect(recruitments).toContain('data-rom-acc="overview"');
    expect(recruitments).toContain('data-rom-acc="lifecycle"');
  });

  test("automation flags remain dormant", () => {
    const flags = require("../server/config/automationFlags");
    const current = flags.getAutomationFlags();
    expect(current.AUTO_PUBLISH_ENABLED).toBe(false);
    expect(flags.isAutoPublishBlocked()).toBe(true);
    expect(flags.isAutomationDormant()).toBe(true);
  });
});
