"use strict";

const fs = require("fs");
const path = require("path");
const request = require("supertest");
const app = require("../server/app");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const ACC_PAGE_ROUTES = [
  "/admin/automation-control-center",
  "/admin/automation-control-center/sources",
  "/admin/automation-control-center/recruitments",
  "/admin/automation-control-center/reviews",
  "/admin/automation-control-center/drafts",
  "/admin/automation-control-center/queue",
  "/admin/automation-control-center/insights",
  "/admin/automation-control-center/health",
  "/admin/automation-control-center/logs",
  "/admin/automation-control-center/controls"
];

describe("ACC URL / information architecture", () => {
  test("dedicated ACC page routes require authentication (not 404)", async () => {
    for (const route of ACC_PAGE_ROUTES) {
      const res = await request(app).get(route);
      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/^\/login/);
    }
  });

  test("unknown ACC nested path is not mapped in the section page table", () => {
    const source = read("server/app.js");
    expect(source).toContain("ACC_SECTION_PAGES");
    expect(source).toContain("if (!file) return next()");
    expect(source).not.toMatch(/ACC_SECTION_PAGES\[[^\]]+\]\s*\|\|\s*["']admin-automation-control-center/);
  });

  test("global sidebar has a single ACC entry; child ACC URLs live in-page", () => {
    const nav = read("public/assets/js/admin-nav.js");
    expect(nav).toContain("Automation Control Center");
    expect(nav).toContain('navLink("/admin/automation-control-center", "/admin/automation-control-center"');
    expect(nav).not.toContain('navLink("/admin/automation-control-center/sources"');
    expect(nav).not.toContain('navLink("/admin/automation-control-center/drafts"');
    expect(nav).not.toContain('navLink("/admin/automation-control-center/logs"');
    expect(nav).not.toContain('navLink("/admin/automation-control-center/controls"');
    expect(nav).not.toContain("#accDrafts");
    expect(nav).not.toContain("#accPublishingControls");
    expect(nav).not.toContain("#accAudit");
    expect(nav).not.toContain("#accSettings");

    const drafts = read("private/admin-automation-drafts.html");
    expect(drafts).toContain('href="/admin/automation-control-center/sources"');
    expect(drafts).toContain('href="/admin/automation-control-center/drafts"');
    expect(drafts).toContain('href="/admin/automation-control-center/controls"');
    expect(drafts).toContain("acc-switcher");
    expect(drafts).toContain("acc-switcher__value");
    expect(drafts).toContain('id="accContent"');
    expect(drafts).toContain('aria-current="page"');
    expect(drafts).not.toContain("acc-section-nav");
  });

  test("ACC client supports compact switcher and subtle content enter", () => {
    const client = read("public/assets/js/admin-automation-control-center.js");
    expect(client).toContain("bindAccSwitcher");
    expect(client).toContain("playAccContentEnter");
    expect(client).toContain("accContentEnter");
    expect(client).toContain("prefers-reduced-motion");
  });

  test("ACC switcher is not sticky/fixed in CSS", () => {
    const css = read("public/assets/css/admin/automation-control-center.css");
    const switcherBlock = css.match(/\.acc-switcher\s*\{[\s\S]*?\n\}/);
    expect(switcherBlock).toBeTruthy();
    expect(switcherBlock[0]).toMatch(/position:\s*relative/);
    expect(switcherBlock[0]).not.toMatch(/position:\s*sticky/);
    expect(switcherBlock[0]).not.toMatch(/position:\s*fixed/);
    expect(css).not.toMatch(/\.acc-switcher\s*\{[^}]*top:\s*88px/);
    expect(css).not.toMatch(/\.acc-workspace-head\s*\{[^}]*position:\s*sticky/);
  });

  test("ACC main does not override shell width with width:100%", () => {
    const css = read("public/assets/css/admin/automation-control-center.css");
    const mainBlock = css.match(/body\.admin-saas-v2\s+\.acc-main\s*\{[\s\S]*?\n\}/);
    expect(mainBlock).toBeTruthy();
    expect(mainBlock[0]).not.toMatch(/width:\s*100%/);
    expect(mainBlock[0]).toMatch(/max-width:\s*1440px/);
  });

  test("legacy hashes redirect from the overview page to dedicated URLs", () => {
    const html = read("private/admin-automation-control-center.html");
    const client = read("public/assets/js/admin-automation-control-center.js");
    expect(html).toContain('accDrafts: "/admin/automation-control-center/drafts"');
    expect(html).toContain('accPublishingControls: "/admin/automation-control-center/controls"');
    expect(html).toContain('accAudit: "/admin/automation-control-center/logs"');
    expect(client).toContain("LEGACY_HASH_REDIRECTS");
    expect(client).toContain("location.replace");
    expect(client).not.toContain("activateAccTab");
    expect(client).not.toContain("bindAccTabNavigation");
  });

  test("admin-shell keeps single ACC sidebar item active on nested ACC URLs", () => {
    const shell = read("public/assets/js/admin-shell.js");
    expect(shell).toContain('h === "/admin/automation-control-center"');
    expect(shell).toContain('p.startsWith(`${h}/`)');
  });

  test("ACC pages share polished workspace chrome", () => {
    const overview = read("private/admin-automation-control-center.html");
    const drafts = read("private/admin-automation-drafts.html");
    const controls = read("private/admin-automation-controls.html");
    expect(overview).toContain("acc-workspace-head");
    expect(overview).toContain("Control overview");
    expect(overview).toContain("acc-switcher");
    expect(drafts).toContain("acc-workspace-head");
    expect(drafts).toContain("Draft snapshot");
    expect(controls).toContain("Publishing controls — AUTO PUBLISH");
    expect(controls).toContain("LOCKED OFF");
  });

  test("command palette points at dedicated ACC URLs", () => {
    const palette = read("public/assets/js/admin-command-palette.js");
    expect(palette).toContain("/admin/automation-control-center/sources");
    expect(palette).toContain("/admin/automation-control-center/insights");
    expect(palette).toContain("/admin/automation-control-center/logs");
    expect(palette).toContain("/admin/automation-control-center/controls");
    expect(palette).not.toContain("#accSources");
    expect(palette).not.toContain("#accInsights");
    expect(palette).not.toContain("#accAudit");
  });
});
