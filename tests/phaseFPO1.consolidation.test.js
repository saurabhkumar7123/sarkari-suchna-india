/**
 * FPO-1 — Enterprise Product Consolidation contracts.
 *
 * Guards: no AUTO_PUBLISH, no new fetches in workspace UIs, shared helpers
 * present, shared CSS wired, and PI-1/PI-2 markup contracts still hold.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

describe("FPO-1 consolidation contracts", () => {
  test("AUTO_PUBLISH remains false", () => {
    const flags = require("../server/config/automationFlags");
    expect(flags.FLAG_DEFAULTS.AUTO_PUBLISH_ENABLED).toBe(false);
    expect(flags.getAutomationFlags().AUTO_PUBLISH_ENABLED).toBe(false);
    expect(flags.isAutoPublishBlocked()).toBe(true);
    const { PUBLISHING_POLICY } = require("../server/lib/productionWorkflow/publishingPolicy");
    expect(PUBLISHING_POLICY.AUTO_PUBLISH_ENABLED).toBe(false);
  });

  test("shared workspace CSS and JS modules exist", () => {
    expect(fs.existsSync(path.join(ROOT, "public/assets/css/admin/workspace-shared.css"))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, "public/assets/js/admin-workspace-ui.js"))).toBe(true);
  });

  test("Generator page wires shared assets before workspace UI", () => {
    const html = read("private/generator.html");
    expect(html).toContain("workspace-shared.css");
    expect(html).toContain("admin-workspace-ui.js");
    expect(html.indexOf("admin-workspace-ui.js")).toBeLessThan(html.indexOf("generator-workspace.js"));
    expect(html.indexOf("workspace-shared.css")).toBeLessThan(html.indexOf("generator-workspace.css"));
  });

  test("Editorial Review page wires shared assets before Pro UI", () => {
    const html = read("private/admin-editorial-review.html");
    expect(html).toContain("workspace-shared.css");
    expect(html).toContain("admin-workspace-ui.js");
    expect(html.indexOf("admin-workspace-ui.js")).toBeLessThan(html.indexOf("editorial-workspace.js"));
    expect(html.indexOf("workspace-shared.css")).toBeLessThan(html.indexOf("editorial-workspace.css"));
  });

  test("AdminUI and AdminWorkspaceUI expose escapeHtml", () => {
    const adminUi = read("public/assets/js/admin-ui.js");
    const wsUi = read("public/assets/js/admin-workspace-ui.js");
    expect(adminUi).toMatch(/escapeHtml\s*,/);
    expect(wsUi).toContain("escapeHtml");
    expect(wsUi).toContain("bandClass");
    expect(wsUi).toContain("storageGet");
    expect(wsUi).toContain("stateHtml");
    expect(wsUi).toContain("MESSAGES");
  });

  test("workspace UIs reuse shared helpers and do not invent network calls", () => {
    const gw = read("public/assets/js/generator-workspace.js");
    const ew = read("public/assets/js/editorial-workspace.js");
    expect(gw).toContain("AdminWorkspaceUI");
    expect(ew).toContain("AdminWorkspaceUI");
    for (const source of [gw, ew]) {
      expect(source).not.toMatch(/\bfetch\s*\(/);
      expect(source).not.toMatch(/XMLHttpRequest/);
      expect(source).not.toContain("AUTO_PUBLISH");
      expect(source).not.toContain("/api/admin/pages");
    }
  });

  test("shared helper module itself never fetches or publishes", () => {
    const wsUi = read("public/assets/js/admin-workspace-ui.js");
    expect(wsUi).not.toMatch(/\bfetch\s*\(/);
    expect(wsUi).not.toContain("AUTO_PUBLISH");
    expect(wsUi).not.toContain("mark-published");
  });

  test("AdminWorkspaceUI escapeHtml matches workspace escaping contract", () => {
    global.window = global;
    // eslint-disable-next-line no-eval
    eval(read("public/assets/js/admin-workspace-ui.js"));
    expect(typeof global.AdminWorkspaceUI.escapeHtml).toBe("function");
    const sample = "<a href=\"x\">" + "'" + "&";
    expect(global.AdminWorkspaceUI.escapeHtml(sample)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;"
    );
    expect(global.AdminWorkspaceUI.bandClass("high")).toBe("is-high");
    expect(global.AdminWorkspaceUI.bandClass("medium")).toBe("is-medium");
    expect(global.AdminWorkspaceUI.bandClass("low")).toBe("is-low");
    delete global.AdminWorkspaceUI;
  });

  test("no FPO schema/migration artifacts", () => {
    const migrations = path.join(ROOT, "server/migrations");
    if (!fs.existsSync(migrations)) return;
    const names = fs.readdirSync(migrations).join("\n").toLowerCase();
    expect(names).not.toContain("fpo");
  });
});
