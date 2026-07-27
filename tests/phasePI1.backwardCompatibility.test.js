/**
 * Phase PI-1 — Smart Generator Experience: backward-compatibility contract.
 *
 * PI-1 is a UI-only upgrade. These tests guard the promises made in the phase
 * brief: no Generator logic changes, no production workflow changes, no
 * publishing changes, no AUTO_PUBLISH changes, no monitoring changes.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

const GENERATOR_HTML = read("private/generator.html");
const GENERATOR_JS = read("public/assets/js/generator.js");
const WORKSPACE_JS = read("public/assets/js/generator-workspace.js");
const WORKSPACE_CORE_JS = read("public/assets/js/generator-workspace-core.js");

describe("PI-1 publishing and automation flags are untouched", () => {
  test("AUTO_PUBLISH stays disabled by default", () => {
    const flags = require("../server/config/automationFlags");
    expect(flags.FLAG_DEFAULTS.AUTO_PUBLISH_ENABLED).toBe(false);
    expect(flags.getAutomationFlags().AUTO_PUBLISH_ENABLED).toBe(false);
    expect(flags.isAutoPublishBlocked()).toBe(true);
  });

  test("publishing policy still hard-disables auto publish", () => {
    const { PUBLISHING_POLICY } = require("../server/lib/productionWorkflow/publishingPolicy");
    expect(PUBLISHING_POLICY.AUTO_PUBLISH_ENABLED).toBe(false);
  });

  test("PI-1 files never reference publish endpoints or automation flags", () => {
    for (const source of [WORKSPACE_JS, WORKSPACE_CORE_JS]) {
      expect(source).not.toContain("/api/admin/pages");
      expect(source).not.toContain("AUTO_PUBLISH");
      expect(source).not.toContain("mark-published");
    }
  });
});

describe("PI-1 workspace is strictly read-only", () => {
  test("the workspace never issues network requests of its own", () => {
    for (const source of [WORKSPACE_JS, WORKSPACE_CORE_JS]) {
      expect(source).not.toMatch(/\bfetch\s*\(/);
      expect(source).not.toMatch(/XMLHttpRequest/);
      expect(source).not.toMatch(/navigator\.sendBeacon/);
    }
  });

  test("the workspace never writes editor or form content", () => {
    // Assigning .value / .textContent on #data is the one thing PI-1 must not do.
    expect(WORKSPACE_JS).not.toMatch(/\bta\.value\s*=/);
    expect(WORKSPACE_JS).not.toMatch(/getElementById\(["']data["']\)\.value\s*=/);
    expect(WORKSPACE_JS).not.toMatch(/setDataFromServer/);
    expect(WORKSPACE_CORE_JS).not.toMatch(/document\./);
  });

  test("keyboard shortcuts delegate to existing buttons instead of reimplementing actions", () => {
    // Every shortcut target must be an existing control already present in the page.
    const targets = ["savePageBtn", "saveDraftBtn", "previewBtn", "aiConvertBtn"];
    for (const id of targets) {
      expect(WORKSPACE_JS).toContain(id);
      expect(GENERATOR_HTML).toContain(`id="${id}"`);
    }
    expect(WORKSPACE_JS).toContain("clickIfPresent");
  });

  test("suggestions are advisory: no auto-apply path exists in the core", () => {
    expect(WORKSPACE_CORE_JS).not.toMatch(/function\s+apply(Suggestion|Fix|Patch)/);
    expect(WORKSPACE_JS).not.toMatch(/data-gw-action=["']apply/);
  });
});

describe("PI-1 leaves the existing Generator markup intact", () => {
  const REQUIRED_CONTROLS = [
    "data",
    "title",
    "pageUrl",
    "pageId",
    "oldSlug",
    "status",
    "customStatus",
    "lastDate",
    "eventTime",
    "category",
    "badgesJson",
    "smallBoxSlot",
    "breaking",
    "breakingOrder",
    "post_name",
    "total_posts",
    "advertisement_no",
    "pdfFile",
    "pdfUploadBtn",
    "aiConvertBtn",
    "savePageBtn",
    "saveDraftBtn",
    "previewBtn",
    "deleteBtn",
    "previewFrame",
    "sectionEditorRoot",
    "generatorDraftId"
  ];

  test.each(REQUIRED_CONTROLS)("control #%s still exists", (id) => {
    expect(GENERATOR_HTML).toContain(`id="${id}"`);
  });

  test("the original script pipeline still loads in order", () => {
    const order = [
      "/js/jobSectionStructure.js",
      "/js/sectionEditorModel.js",
      "/js/sectionEditor.js",
      "/js/generator.js"
    ];
    let cursor = -1;
    for (const src of order) {
      const at = GENERATOR_HTML.indexOf(src);
      expect(at).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  test("workspace assets load after the generator itself", () => {
    expect(GENERATOR_HTML.indexOf("/js/generator-workspace-core.js")).toBeGreaterThan(
      GENERATOR_HTML.indexOf("/js/generator.js")
    );
    expect(GENERATOR_HTML.indexOf("/js/generator-workspace.js")).toBeGreaterThan(
      GENERATOR_HTML.indexOf("/js/generator-workspace-core.js")
    );
  });
});

describe("PI-1 generator.js changes are additive only", () => {
  test("the publish, preview and draft entry points still exist", () => {
    for (const fn of [
      "async function generatePage()",
      "async function aiConvert()",
      "async function extractPDF()",
      "function updatePreview()",
      "async function saveGeneratorDraftToServer()"
    ]) {
      expect(GENERATOR_JS).toContain(fn);
    }
  });

  test("lifecycle events are emitted through a single guarded helper", () => {
    expect(GENERATOR_JS).toContain("function emitGeneratorEvent(name, detail)");
    // The helper must swallow its own errors so a listener can never break publishing.
    const helper = GENERATOR_JS.slice(
      GENERATOR_JS.indexOf("function emitGeneratorEvent"),
      GENERATOR_JS.indexOf("function getActionBtnLabel")
    );
    expect(helper).toContain("try {");
    expect(helper).toContain("catch");
  });

  test("every documented lifecycle event is dispatched", () => {
    const events = [
      "generator:pdf-selected",
      "generator:extract-start",
      "generator:extract-success",
      "generator:extract-error",
      "generator:ai-start",
      "generator:ai-success",
      "generator:ai-error",
      "generator:content-change"
    ];
    for (const name of events) {
      expect(GENERATOR_JS).toContain(name);
      expect(WORKSPACE_JS).toContain(name);
    }
  });

  test("the AI convert request body is unchanged", () => {
    expect(GENERATOR_JS).toContain('fetch("/api/ai-parse"');
    expect(GENERATOR_JS).toContain("text: payloadText");
    expect(GENERATOR_JS).toContain("content: payloadText");
  });

  test("the PDF extract endpoint is unchanged", () => {
    expect(GENERATOR_JS).toContain('const PDF_EXTRACT_URL = "/api/admin/pdf/extract"');
    expect(GENERATOR_JS).toContain('formData.append("pdf", file)');
  });
});

describe("PI-1 does not change the published HTML pipeline", () => {
  test("generated job HTML contains no workspace markup", async () => {
    const { buildJobHtml } = require("../generator/pipeline/generatePage");
    const html = await buildJobHtml({
      title: "SSC CGL Online Form 2026",
      text: [
        "[Section: ShortInfo]",
        "SSC Combined Graduate Level notification.",
        "",
        "[Section: ImportantDates]",
        "Online Apply Last Date: 22 June 2026",
        "",
        "[Section: ImportantLinks]",
        "Apply Online=https://example.com/apply"
      ].join("\n"),
      slug: "pi1-compat-check",
      category: "ssc cgl",
      normalizedStatus: "latest job",
      postName: "SSC CGL",
      totalPosts: "12256"
    });

    expect(html).toContain("Apply Online");
    for (const marker of ["gw-", "generatorWorkspace", "generator-workspace", "Smart workspace"]) {
      expect(html).not.toContain(marker);
    }
  });
});

describe("PI-1 workspace markup parses and nests correctly", () => {
  const cheerio = require("cheerio");
  const $ = cheerio.load(GENERATOR_HTML);

  test("the workspace mounts inside the content wrapper, before the editor", () => {
    const workspace = $("#generatorWorkspace");
    expect(workspace).toHaveLength(1);
    expect(workspace.parent().attr("id")).toBe("gen-step-content");
    expect(GENERATOR_HTML.indexOf('id="generatorWorkspace"')).toBeLessThan(
      GENERATOR_HTML.indexOf('id="editorPanel"')
    );
  });

  test("every element the workspace script queries exists exactly once", () => {
    const ids = [
      "gwTimeline",
      "gwToggle",
      "gwNavList",
      "gwNavEmpty",
      "gwNavCount",
      "gwStructured",
      "gwSourceText",
      "gwSourcePdf",
      "gwSourceHint",
      "gwSourceTabText",
      "gwSourceTabPdf",
      "gwSummary",
      "gwValidation",
      "gwSuggestions",
      "gwError",
      "gwShortcuts",
      "gwShortcutTable",
      "gwQualityChip",
      "gwValidationChip"
    ];
    for (const id of ids) {
      expect($(`#${id}`)).toHaveLength(1);
    }
  });

  test("the shortcuts dialog is a sibling of the workspace, not nested in it", () => {
    expect($("#generatorWorkspace #gwShortcuts")).toHaveLength(0);
    expect($("#gwShortcuts").attr("role")).toBe("dialog");
    expect($("#gwShortcuts").attr("hidden")).toBeDefined();
  });

  test("panels expose accessible names and the advisory disclaimer", () => {
    expect($("#generatorWorkspace").attr("aria-label")).toBeTruthy();
    expect($(".gw-panel--suggestions .gw-advisory-note").text()).toMatch(/advisory only/i);
    expect($(".gw-tabs").attr("role")).toBe("tablist");
    expect($("#gwSourceTabText").attr("role")).toBe("tab");
  });

  test("no inline style attributes are used (the page CSP forbids them)", () => {
    const inlineStyled = $("#generatorWorkspace [style], #gwShortcuts [style]");
    expect(inlineStyled).toHaveLength(0);
  });

  test("the workspace stylesheet is linked", () => {
    const hrefs = $('link[rel="stylesheet"]')
      .map((_, el) => $(el).attr("href"))
      .get();
    expect(hrefs.some((h) => h.includes("generator-workspace.css"))).toBe(true);
  });
});

describe("PI-1 CSP change is narrowly scoped", () => {
  const APP_JS = read("server/app.js");

  test("frame-src allows only same-origin and local blob previews", () => {
    expect(APP_JS).toContain('frameSrc: ["\'self\'", "blob:"]');
  });

  test("clickjacking and object protections are unchanged", () => {
    expect(APP_JS).toContain('frameAncestors: ["\'none\'"]');
    expect(APP_JS).toContain('objectSrc: ["\'none\'"]');
    expect(APP_JS).toContain('defaultSrc: ["\'self\'"]');
  });
});
