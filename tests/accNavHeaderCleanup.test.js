"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const ACC_PAGES = [
  ["private/admin-automation-control-center.html", "Overview"],
  ["private/admin-automation-recruitments.html", "Recruitments"],
  ["private/admin-automation-reviews.html", "Reviews"],
  ["private/admin-automation-drafts.html", "Drafts"],
  ["private/admin-automation-queue.html", "Queue"],
  ["private/admin-automation-insights.html", "Insights"],
  ["private/admin-automation-health.html", "Health"],
  ["private/admin-automation-logs.html", "Logs"],
  ["private/admin-automation-controls.html", "Controls"]
];

const REQUIRED_LABELS = [
  "Overview",
  "Recruitments",
  "Reviews",
  "Drafts",
  "Queue",
  "Insights",
  "Health",
  "Logs",
  "Controls"
];

const FORBIDDEN_NAV_LABELS = [
  "Control overview",
  "Recruitment snapshot",
  "Review snapshot",
  "Draft snapshot",
  "Queue snapshot",
  "Health snapshot",
  "Automation logs",
  "Control flags"
];

describe("ACC navigation + header cleanup", () => {
  test("all ACC pages share the same short navigation labels and order", () => {
    for (const [file] of ACC_PAGES) {
      const html = read(file);
      expect(html).toContain('data-acc-switcher');
      const menu = html.match(/id="accSwitcherMenu"[\s\S]*?<\/div>/);
      expect(menu).toBeTruthy();
      const labels = [...menu[0].matchAll(/acc-switcher__option[^>]*>([^<]+)</g)].map((m) => m[1].trim());
      expect(labels).toEqual(REQUIRED_LABELS);
      for (const bad of FORBIDDEN_NAV_LABELS) {
        expect(menu[0]).not.toContain(`>${bad}<`);
      }
    }
  });

  test("common Runtime / Activation strip is removed from ACC headers", () => {
    for (const [file] of ACC_PAGES) {
      const html = read(file);
      expect(html).not.toContain('id="accRuntimeModeLabel"');
      expect(html).not.toContain('id="accActivationDecision"');
      expect(html).not.toContain("Runtime: Dormant");
      expect(html).not.toContain("Activation: NO-GO");
    }
  });

  test("ACC-internal Open * shortcuts are not duplicated on overview", () => {
    const overview = read("private/admin-automation-control-center.html");
    expect(overview).toContain("Open Monitoring");
    expect(overview).not.toContain("Open Queue");
    expect(overview).not.toContain("Open Insights");
    expect(overview).not.toContain("Open Controls");
    expect(overview).not.toContain("Open Health");
    expect(overview).not.toContain("Control flags — View details");
    expect(overview).not.toContain('href="/admin/automation-control-center/reviews">Reviews — View details');
  });

  test("page destinations and content markers remain", () => {
    expect(read("private/admin-automation-control-center.html")).toContain('id="accSystemStatus"');
    expect(read("private/admin-automation-recruitments.html")).toContain("Recruitment Explorer");
    expect(read("private/admin-automation-reviews.html")).toContain("Open Review Queue");
    expect(read("private/admin-automation-drafts.html")).toContain("Draft Viewer");
    expect(read("private/admin-automation-queue.html")).toContain("Workflow Queue");
    expect(read("private/admin-automation-insights.html")).toContain("AI Insights");
    expect(read("private/admin-automation-health.html")).toContain("System health");
    expect(read("private/admin-automation-logs.html")).toContain("Audit Center");
    expect(read("private/admin-automation-controls.html")).toContain('id="accOperatorControls"');
  });

  test("compact spacing styles reduce header/nav gap", () => {
    const css = read("public/assets/css/admin/automation-control-center.css");
    expect(css).toMatch(/\.acc-workspace-head\s*\{[\s\S]*?margin:\s*0\s+0\s+6px/);
    expect(css).toMatch(/\.acc-switcher\s*\{[\s\S]*?margin-bottom:\s*6px/);
  });

  test("automation flags remain unchanged / dormant", () => {
    const flags = require("../server/config/automationFlags");
    const current = flags.getAutomationFlags();
    expect(current.AUTO_PUBLISH_ENABLED).toBe(false);
    expect(current.PRODUCTION_MONITORING_ENABLED).toBe(false);
    expect(flags.isAutoPublishBlocked()).toBe(true);
    expect(flags.isAutomationDormant()).toBe(true);
  });
});
