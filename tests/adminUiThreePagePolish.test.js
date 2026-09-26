"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Admin UI visual polish — RRQ / Editorial / Page Manager", () => {
  const rrqHtml = read("private/admin-recruitment-review-queue.html");
  const erHtml = read("private/admin-editorial-review.html");
  const pmHtml = read("private/admin-page-manager.html");
  const rrqJs = read("public/assets/js/admin-recruitment-review-queue.js");
  const erJs = read("public/assets/js/admin-editorial-review.js");
  const pmJs = read("public/assets/js/admin-page-manager.js");
  const polishCss = read("public/assets/css/admin/admin-workspace-polish.css");

  test("all three pages share admin-workspace-polish.css", () => {
    expect(rrqHtml).toContain("admin-workspace-polish.css");
    expect(erHtml).toContain("admin-workspace-polish.css");
    expect(pmHtml).toContain("admin-workspace-polish.css");
  });

  test("RRQ list shows Review ID without hash and exclusive list/detail layout", () => {
    expect(rrqHtml).toContain("<th>Review ID</th>");
    expect(rrqHtml).toContain("<th>Update ID</th>");
    expect(rrqHtml).toContain('id="rrqCloseDetail"');
    expect(rrqHtml).toContain("← Back to Review Queue");
    expect(rrqJs).toContain("rrq-cell-id");
    expect(rrqJs).toContain("resolveUpdateId");
    expect(rrqJs).toContain("Review ID");
    expect(rrqJs).toContain("Update ID");
    expect(rrqJs).toContain('colspan="9"');
    expect(rrqJs).toContain("syncListDetailChrome");
    expect(rrqJs).toContain("rrq-layout--detail-only");
    expect(rrqJs).toContain("syncReviewUrl");
    expect(rrqJs).not.toMatch(/Review #\$\{/);
    expect(rrqJs).not.toMatch(/Update #\$\{/);
    expect(polishCss).toContain(".rrq-layout.rrq-layout--detail-only");
    expect(polishCss).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/);
  });

  test("Editorial Review keeps inbox selection and omits placeholder text", () => {
    expect(erHtml).toContain("Review inbox");
    expect(erHtml).toContain('id="erInboxCount"');
    expect(erHtml).not.toContain("Select a review item");
    expect(erJs).toContain("openWorkspace");
    expect(erJs).toContain("er-inbox-item__id");
    expect(erJs).toContain("Recruitment ID:");
    expect(erJs).toContain("/api/admin/editorial-reviews");
    expect(erJs).toContain("approve");
    expect(polishCss).toMatch(/\.er-layout[\s\S]*min-width:\s*0/);
  });

  test("Page Manager shows Page ID without hash; actions and URLs preserved", () => {
    expect(pmJs).toContain("Page ID:");
    expect(pmJs).toContain("Recruitment ID:");
    expect(pmJs).not.toMatch(/Page #\$\{/);
    expect(pmJs).not.toMatch(/page #\$\{/);
    expect(pmJs).toContain('textContent = "Edit"');
    expect(pmJs).toContain('textContent = "View"');
    expect(pmJs).toContain('textContent = "Trash"');
    expect(pmJs).toContain("/generator?slug=");
    expect(pmJs).toContain("/admin/recruitments?recruitment_id=");
    expect(pmJs).toContain("openPageVersionRestore");
    expect(polishCss).toContain(".page-row-id");
  });

  test("technical fragments and query params remain", () => {
    expect(erHtml).not.toContain('href="/generator#drafts"');
    expect(erHtml).not.toContain('href="/admin/recruitments"');
    expect(erHtml).toContain('id="erRefreshBtn"');
    expect(rrqJs).toContain("draftId=");
    expect(rrqJs).toContain("update_id");
    expect(pmJs).toContain("/api/admin/enterprise-persistence/versions/page/");
  });

  test("automation flags remain dormant", () => {
    const flags = require("../server/config/automationFlags");
    const current = flags.getAutomationFlags();
    expect(current.AUTO_PUBLISH_ENABLED).toBe(false);
    expect(flags.isAutoPublishBlocked()).toBe(true);
    expect(flags.isAutomationDormant()).toBe(true);
  });
});
