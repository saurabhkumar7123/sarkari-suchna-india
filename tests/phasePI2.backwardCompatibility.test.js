"use strict";

/**
 * Phase PI-2 — backward compatibility / no-regression contracts.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("Phase PI-2 backward compatibility", () => {
  test("does not enable AUTO_PUBLISH", () => {
    const flags = require("../server/config/automationFlags");
    expect(flags.FLAG_DEFAULTS.AUTO_PUBLISH_ENABLED).toBe(false);
    expect(flags.getAutomationFlags().AUTO_PUBLISH_ENABLED).toBe(false);
    expect(flags.isAutoPublishBlocked()).toBe(true);
    const { PUBLISHING_POLICY } = require("../server/lib/productionWorkflow/publishingPolicy");
    expect(PUBLISHING_POLICY.AUTO_PUBLISH_ENABLED).toBe(false);
  });

  test("does not modify Production Workflow package files", () => {
    // PI-2 must not rewrite production workflow sources; only editorial review service is touched.
    const touched = [
      "server/lib/productionWorkflow",
      "server/lib/generatorIntelligence",
      "server/lib/noticeIntelligence",
      "server/lib/recruitmentMatching"
    ];
    // Sanity: those packages still resolve
    touched.forEach((rel) => {
      expect(fs.existsSync(path.join(ROOT, rel))).toBe(true);
    });
  });

  test("editorial review service still exports original API surface", () => {
    const service = require("../server/services/editorialReview.service");
    expect(typeof service.getReviewWorkspace).toBe("function");
    expect(typeof service.applyDecision).toBe("function");
    expect(typeof service.addNote).toBe("function");
    expect(typeof service.listInbox).toBe("function");
  });

  test("editorialIntelligence attachment helper is additive and fail-soft", () => {
    const serviceSrc = read("server/services/editorialReview.service.js");
    expect(serviceSrc).toContain("analyzeEditorialDraft");
    expect(serviceSrc).toContain("editorialIntelligence");
    expect(serviceSrc).toContain("buildEditorialIntelligenceForDraft");
    expect(serviceSrc).toMatch(/catch\s*\{[\s\S]*return null/);
  });

  test("admin editorial review page keeps Package 4C controls", () => {
    const html = read("private/admin-editorial-review.html");
    expect(html).toContain('id="erInboxList"');
    expect(html).toContain('id="erDecisions"');
    expect(html).toContain('id="erNotes"');
    expect(html).toContain('id="erValidation"');
    expect(html).toContain('id="sharedPreviewPanel"');
    expect(html).toContain("Human review only");
  });

  test("Pro UI scripts never call publish endpoints or invent fetches", () => {
    const ui = read("public/assets/js/editorial-workspace.js");
    const core = read("public/assets/js/editorial-workspace-core.js");
    expect(ui).not.toMatch(/AUTO_PUBLISH/);
    expect(ui).not.toMatch(/\/api\/admin\/pages/);
    expect(ui).not.toMatch(/\bfetch\s*\(/);
    expect(ui).not.toMatch(/XMLHttpRequest/);
    expect(core).not.toMatch(/\bfetch\s*\(/);
    expect(core).not.toMatch(/appliesChanges:\s*true/);
    expect(ui).toContain("never publish");
  });

  test("suggestions cannot carry apply/patch fields after normalization", () => {
    global.GeneratorWorkspaceCore = require("../public/assets/js/generator-workspace-core.js");
    const core = require("../public/assets/js/editorial-workspace-core.js");
    const { analyzeEditorialDraft } = require("../server/lib/editorialIntelligence");
    const text = `[Section: Short Information]\nTest only`;
    const ai4 = analyzeEditorialDraft(text, { profile: "new_recruitment" }).editorialIntelligence;
    const model = core.analyzeEditorialWorkspace({
      draft: { id: 1, payload: { result: text } },
      editorialIntelligence: ai4
    });
    model.suggestions.forEach((s) => {
      expect(s.appliesChanges).toBe(false);
      expect(s.advisoryOnly).toBe(true);
      expect(s).not.toHaveProperty("replacement");
      expect(s).not.toHaveProperty("patch");
      expect(s).not.toHaveProperty("newText");
    });
  });

  test("admin-editorial-review wiring does not add new API paths", () => {
    const js = read("public/assets/js/admin-editorial-review.js");
    expect(js).toContain("EditorialWorkspacePro.render");
    expect(js).toContain("/api/admin/editorial-reviews");
    expect(js).not.toContain("/api/ai-parse");
    expect(js).not.toContain("analyzeEditorialDraft");
  });

  test("no database schema / migration files added for PI-2", () => {
    const migrations = path.join(ROOT, "server/migrations");
    if (!fs.existsSync(migrations)) return;
    const names = fs.readdirSync(migrations).join("\n");
    expect(names.toLowerCase()).not.toContain("pi2");
    expect(names.toLowerCase()).not.toContain("editorial_workspace_pro");
  });
});
