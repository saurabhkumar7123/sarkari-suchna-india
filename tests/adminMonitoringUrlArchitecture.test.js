"use strict";

const fs = require("fs");
const path = require("path");
const request = require("supertest");
const app = require("../server/app");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const MONITORING_PAGE_ROUTES = [
  "/admin/monitoring",
  "/admin/monitoring/updates",
  "/admin/monitoring/activity"
];

describe("Monitoring URL / information architecture", () => {
  test("dedicated Monitoring page routes require authentication (not 404)", async () => {
    for (const route of MONITORING_PAGE_ROUTES) {
      const res = await request(app).get(route);
      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/^\/login/);
    }
  });

  test("unknown Monitoring nested path is not mapped in the section page table", () => {
    const source = read("server/app.js");
    expect(source).toContain("MONITORING_SECTION_PAGES");
    expect(source).toContain('updates: "admin-monitoring-updates.html"');
    expect(source).toContain('activity: "admin-monitoring-activity.html"');
    expect(source).toContain("if (!file) return next()");
    expect(source).not.toMatch(
      /MONITORING_SECTION_PAGES\[[^\]]+\]\s*\|\|\s*["']admin-monitoring/
    );
  });

  test("global sidebar has a single Monitoring entry; child URLs live in-page", () => {
    const nav = read("public/assets/js/admin-nav.js");
    expect(nav).toContain('navLink("/admin/monitoring", "/admin/monitoring"');
    expect(nav).toContain('"Monitoring"');
    expect(nav).not.toContain('navLink("/admin/monitoring#recentUpdates"');
    expect(nav).not.toContain('navLink("/admin/monitoring#monitoringActivity"');
    expect(nav).not.toContain('navLink("/admin/monitoring/updates"');
    expect(nav).not.toContain('navLink("/admin/monitoring/activity"');
    expect(nav).not.toContain('data-nav-alias="detections"');
    expect(nav).not.toContain('data-nav-alias="monitoring-activity"');

    const sources = read("private/admin-monitoring.html");
    const updates = read("private/admin-monitoring-updates.html");
    const activity = read("private/admin-monitoring-activity.html");
    for (const html of [sources, updates, activity]) {
      expect(html).toContain("mon-switcher");
      expect(html).toContain('href="/admin/monitoring"');
      expect(html).toContain('href="/admin/monitoring/updates"');
      expect(html).toContain('href="/admin/monitoring/activity"');
      expect(html).toContain("aria-current=\"page\"");
      expect(html).not.toContain('href="/admin/monitoring#recentUpdates"');
      expect(html).not.toContain('href="/admin/monitoring#monitoringActivity"');
    }
    expect(sources).toContain('data-mon-page="sources"');
    expect(updates).toContain('data-mon-page="updates"');
    expect(activity).toContain('data-mon-page="activity"');
  });

  test("Monitoring client supports compact switcher, content enter, and legacy hash redirects", () => {
    const client = read("public/assets/js/admin-monitoring.js");
    expect(client).toContain("bindMonSwitcher");
    expect(client).toContain("playMonContentEnter");
    expect(client).toContain("redirectLegacyMonitoringHash");
    expect(client).toContain("LEGACY_MONITORING_HASH_REDIRECTS");
    expect(client).toContain('recentUpdates: "/admin/monitoring/updates"');
    expect(client).toContain('monitoringActivity: "/admin/monitoring/activity"');
    expect(client).toContain("prefers-reduced-motion");
  });

  test("sources page includes first-paint legacy hash redirect map", () => {
    const sources = read("private/admin-monitoring.html");
    expect(sources).toContain("recentUpdates");
    expect(sources).toContain("/admin/monitoring/updates");
    expect(sources).toContain("monitoringActivity");
    expect(sources).toContain("/admin/monitoring/activity");
    expect(sources).toContain("location.replace");
  });

  test("shell keeps Monitoring sidebar item active across nested URLs", () => {
    const shell = read("public/assets/js/admin-shell.js");
    expect(shell).toContain('h === "/admin/monitoring"');
    expect(shell).toContain("p.startsWith(`${h}/`)");
  });

  test("Monitoring switcher is not sticky/fixed in CSS", () => {
    const css = read("public/assets/css/admin/admin-design-system.css");
    const switcherBlock = css.match(/\.mon-switcher\s*\{[\s\S]*?\n\}/);
    expect(switcherBlock).toBeTruthy();
    expect(switcherBlock[0]).toMatch(/position:\s*relative/);
    expect(switcherBlock[0]).not.toMatch(/position:\s*sticky/);
    expect(switcherBlock[0]).not.toMatch(/position:\s*fixed/);
  });

  test("each Monitoring section page shows only its primary content block", () => {
    const sources = read("private/admin-monitoring.html");
    const updates = read("private/admin-monitoring-updates.html");
    const activity = read("private/admin-monitoring-activity.html");

    expect(sources).toContain('id="sitesTable"');
    expect(sources).not.toContain('id="recentUpdatesList"');
    expect(sources).not.toContain('id="queueFailedList"');

    expect(updates).toContain('id="recentUpdatesList"');
    expect(updates).not.toContain('id="sitesTable"');
    expect(updates).not.toContain('id="queueFailedList"');

    expect(activity).toContain('id="queueFailedList"');
    expect(activity).not.toContain('id="sitesTable"');
    expect(activity).not.toContain('id="recentUpdatesList"');
  });
});
