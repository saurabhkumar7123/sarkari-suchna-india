"use strict";

/**
 * Phase PI-2 — Editorial Workspace Pro core tests.
 */

const path = require("path");
const GeneratorWorkspaceCore = require("../public/assets/js/generator-workspace-core.js");
global.GeneratorWorkspaceCore = GeneratorWorkspaceCore;
const core = require("../public/assets/js/editorial-workspace-core.js");
const { analyzeEditorialDraft } = require("../server/lib/editorialIntelligence");

const SAMPLE_DRAFT = `[Section: Short Information]
UPPSC Combined Exam 2026
Advertisement No. A-1/E-1/2026
Total Vacancy : 240 Posts
Online Apply Start Date : 04 September 2025
Last Date for Apply Online : 30 September 2025

[Section: Important Dates]
Online Apply Start Date : 04 September 2025
Last Date for Apply Online : 30 September 2025
Fee Payment Last Date : 30 September 2025
Age Limit As on : 01 July 2025

[Section: Application Fee]
For General / OBC / EWS : Rs 125/-
For SC / ST : Rs 65/-

[Section: Age Limit]
Minimum Age : 21 Years
Maximum Age : 40 Years As on 01 July 2025

[Section: Vacancy Details]
Post Name, Category, Vacancy
Naib Tehsildar, General, 120
Block Development Officer, OBC, 80
Assistant Conservator, SC, 40
Total, , 240

[Section: Eligibility]
Bachelor Degree in Any Stream from Recognized University

[Section: Selection Process]
Preliminary Examination
Main Examination
Interview

[Section: Salary]
Pay Scale Level-10 as per 7th CPC

[Section: Important Links]
Apply Online https://uppsc.up.nic.in/apply
Official Website https://uppsc.up.nic.in
Notification PDF https://uppsc.up.nic.in/notifications/a1e12026.pdf

[Section: Important Questions]
Q: What is the application fee for General?
A: Rs 125/-
Q: What is the application fee for General?
A: Rs 125/-

[Section: Important Instructions]
Read the official notification carefully before applying.
`;

function workspaceFromText(text, withAi4) {
  const payload = { result: text };
  let editorialIntelligence = null;
  if (withAi4) {
    editorialIntelligence = analyzeEditorialDraft(text, {
      now: new Date("2026-01-15T00:00:00.000Z"),
      profile: "new_recruitment"
    }).editorialIntelligence;
  }
  return {
    recruitment: { id: 12, title: "Sample", slug: "sample" },
    draft: {
      id: 99,
      title: "Sample draft",
      status: "draft",
      payload
    },
    editorialIntelligence,
    validation: { checks: [] },
    workflowState: "in_review"
  };
}

describe("Phase PI-2 editorial workspace core", () => {
  test("exposes version and checklist contract", () => {
    expect(core.CORE_VERSION).toBe("pi2.1.0");
    expect(core.CHECKLIST_ITEMS).toHaveLength(11);
    expect(core.CHECKLIST_STATUS.COMPLETE).toBe("complete");
    expect(core.SEVERITY_ORDER).toEqual(["Critical", "High", "Medium", "Low"]);
  });

  test("extracts draft text from payload.result", () => {
    const ws = workspaceFromText(SAMPLE_DRAFT, false);
    expect(core.extractDraftText(ws)).toContain("[Section: Short Information]");
  });

  test("prefers AI-4 editorialIntelligence when present", () => {
    const ws = workspaceFromText(SAMPLE_DRAFT, true);
    const model = core.analyzeEditorialWorkspace(ws);
    expect(model.source).toBe("ai4");
    expect(model.advisoryOnly).toBe(true);
    expect(model.appliesChanges).toBe(false);
    expect(model.dashboard.overallQuality).toBeGreaterThan(0);
    expect(model.checklist).toHaveLength(11);
    expect(model.suggestions.every((s) => s.appliesChanges === false)).toBe(true);
    expect(model.suggestions.every((s) => s.replacement == null && s.patch == null && s.apply == null)).toBe(
      true
    );
  });

  test("falls back to PI-1 analysis when AI-4 is absent", () => {
    const ws = workspaceFromText(SAMPLE_DRAFT, false);
    const model = core.analyzeEditorialWorkspace(ws);
    expect(model.source).toBe("pi1-fallback");
    expect(model.sections.length).toBeGreaterThan(5);
    expect(model.dashboard).toBeTruthy();
    expect(model.linkInspector.total).toBeGreaterThan(0);
  });

  test("builds checklist statuses Complete / Needs Review / Missing", () => {
    const ws = workspaceFromText(SAMPLE_DRAFT, true);
    const model = core.analyzeEditorialWorkspace(ws);
    const statuses = new Set(model.checklist.map((c) => c.status));
    expect(statuses.has(core.CHECKLIST_STATUS.COMPLETE)).toBe(true);
    model.checklist.forEach((item) => {
      expect(["complete", "needs_review", "missing"]).toContain(item.status);
    });
  });

  test("groups issues by Critical High Medium Low", () => {
    const incomplete = `[Section: Short Information]
Only a title
`;
    const ws = workspaceFromText(incomplete, true);
    const model = core.analyzeEditorialWorkspace(ws);
    expect(Object.keys(model.issueGroups)).toEqual(["Critical", "High", "Medium", "Low"]);
    const total = core.SEVERITY_ORDER.reduce((n, s) => n + model.issueGroups[s].length, 0);
    expect(total).toBe(model.issues.length);
    expect(total).toBeGreaterThan(0);
  });

  test("duplicate detector finds repeated FAQ and dates", () => {
    const ws = workspaceFromText(SAMPLE_DRAFT, true);
    const model = core.analyzeEditorialWorkspace(ws);
    expect(model.duplicates.faqs.length + model.duplicates.dates.length).toBeGreaterThan(0);
  });

  test("link inspector categorizes official / apply / notification / broken buckets", () => {
    const ws = workspaceFromText(SAMPLE_DRAFT, true);
    const model = core.analyzeEditorialWorkspace(ws);
    const ids = model.linkInspector.labels.map((l) => l.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "official",
        "notification",
        "apply",
        "login",
        "result",
        "admit_card",
        "answer_key",
        "broken",
        "duplicate"
      ])
    );
  });

  test("draft health returns six cards", () => {
    const ws = workspaceFromText(SAMPLE_DRAFT, true);
    const model = core.analyzeEditorialWorkspace(ws);
    expect(model.draftHealth).toHaveLength(6);
    expect(model.draftHealth.map((c) => c.id)).toEqual([
      "overall",
      "missing",
      "validation",
      "links",
      "structure",
      "readability"
    ]);
  });

  test("change summary is presentation-only and detects added/removed sections", () => {
    const before = `[Section: Short Information]\nHello\n\n[Section: Salary]\nPay`;
    const after = `[Section: Short Information]\nHello world\n\n[Section: Age Limit]\n21`;
    const summary = core.buildChangeSummary(before, after);
    expect(summary.presentationOnly).toBe(true);
    expect(summary.modified.some((r) => /short/i.test(r.title) || r.key === "short_information")).toBe(true);
    expect(summary.added.length + summary.removed.length).toBeGreaterThan(0);
  });

  test("does not mutate workspace input", () => {
    const ws = workspaceFromText(SAMPLE_DRAFT, true);
    const freeze = JSON.stringify(ws);
    core.analyzeEditorialWorkspace(ws);
    expect(JSON.stringify(ws)).toBe(freeze);
  });

  test("empty workspace stays safe", () => {
    const model = core.analyzeEditorialWorkspace({});
    expect(model.hasDraft).toBe(false);
    expect(model.dashboard.readiness).toBe(core.READINESS.EMPTY);
    expect(model.suggestions).toEqual([]);
  });

  test("performance budget for typical draft with AI-4", () => {
    const ws = workspaceFromText(SAMPLE_DRAFT, true);
    const started = Date.now();
    for (let i = 0; i < 20; i++) core.analyzeEditorialWorkspace(ws);
    const elapsed = Date.now() - started;
    expect(elapsed / 20).toBeLessThan(50);
  });
});

describe("Phase PI-2 HTML / asset wiring", () => {
  const fs = require("fs");
  const htmlPath = path.join(__dirname, "../private/admin-editorial-review.html");

  test("admin editorial review page mounts Pro workspace assets", () => {
    const html = fs.readFileSync(htmlPath, "utf8");
    expect(html).toContain('id="editorialWorkspacePro"');
    expect(html).toContain("editorial-workspace.css");
    expect(html).toContain("generator-workspace-core.js");
    expect(html).toContain("editorial-workspace-core.js");
    expect(html).toContain("editorial-workspace.js");
    expect(html).toContain("ewDashboard");
    expect(html).toContain("ewChecklist");
    expect(html).toContain("ewIssues");
    expect(html).toContain("ewSuggestions");
    expect(html).toContain("ewNavList");
    expect(html).toContain("ewHealth");
    expect(html).toContain("ewLinks");
    expect(html).toContain("ewDuplicates");
    expect(html).toContain("ewChanges");
  });
});
