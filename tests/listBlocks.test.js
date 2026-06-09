"use strict";

const {
  parseLineBlocks,
  parseBulletLineContent,
  canAutoGroupBulletLines,
  renderContentListHtml
} = require("../generator/lib/listBlocks");
const { renderLinesToHtml } = require("../generator/builders/lineRenderer");
const { buildDynamicSectionsWithWarnings } = require("../generator/builders/sectionBuilder");

describe("listBlocks parser", () => {
  test("parseLineBlocks detects explicit [list] block", () => {
    const lines = [
      "[list]",
      "Written Exam",
      "Physical Test",
      "Document Verification",
      "[/list]"
    ];
    const blocks = parseLineBlocks(lines);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: "list",
      items: ["Written Exam", "Physical Test", "Document Verification"]
    });
  });

  test("parseBulletLineContent strips leading markers", () => {
    expect(parseBulletLineContent("• Written Exam")).toBe("Written Exam");
    expect(parseBulletLineContent("- Physical Test")).toBe("Physical Test");
    expect(parseBulletLineContent("* Document Verification")).toBe("Document Verification");
  });

  test("canAutoGroupBulletLines requires 2+ lines without colons", () => {
    expect(canAutoGroupBulletLines(["• A", "• B"])).toBe(true);
    expect(canAutoGroupBulletLines(["• A"])).toBe(false);
    expect(canAutoGroupBulletLines(["• A", "Last Date: 22 June"])).toBe(false);
  });

  test("parseLineBlocks auto-groups safe consecutive bullet lines", () => {
    const lines = ["• Written Exam", "• Physical Test", "• Document Verification"];
    const blocks = parseLineBlocks(lines);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("list");
    expect(blocks[0].items).toEqual(["Written Exam", "Physical Test", "Document Verification"]);
  });

  test("single bullet line stays a plain line block", () => {
    const blocks = parseLineBlocks(["• Only One Item"]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ type: "line", line: "• Only One Item" });
  });

  test("bullet line with colon is not auto-grouped", () => {
    const lines = ["- Step 1: Written Exam", "- Step 2: Interview"];
    const blocks = parseLineBlocks(lines);
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.type === "line")).toBe(true);
  });
});

describe("listBlocks render", () => {
  test("renderContentListHtml outputs ul.content-list with li items", () => {
    const html = renderContentListHtml(["Written Exam", "Physical Test"]);
    expect(html).toBe(
      '<ul class="content-list"><li>Written Exam</li><li>Physical Test</li></ul>'
    );
  });

  test("rich text inside [list] items", () => {
    const html = renderLinesToHtml(
      [
        "[list]",
        "[color=red]Last Date[/color]",
        "[b]Important Notice[/b]",
        "[highlight]Documents Required[/highlight]",
        "[/list]"
      ],
      { sectionName: "Selection Process" }
    );
    expect(html).toContain('<ul class="content-list">');
    expect(html).toContain('class="rt-color rt-color--red"');
    expect(html).toContain('<strong class="rt-bold">');
    expect(html).toContain('<mark class="rt-highlight">');
    expect(html).not.toContain("[list]");
    expect(html).not.toContain("[/list]");
  });

  test("basic [list] block in section via renderLinesToHtml", () => {
    const html = renderLinesToHtml(
      ["[list]", "Written Exam", "Medical Examination", "[/list]"],
      { sectionName: "Selection Process" }
    );
    expect(html).toContain('<ul class="content-list">');
    expect(html).toContain("<li>Written Exam</li>");
    expect(html).toContain("<li>Medical Examination</li>");
    expect(html).not.toContain("<p>Written Exam</p>");
  });

  test("list before and after other content in same section", () => {
    const html = renderLinesToHtml(
      [
        "Overview paragraph",
        "[list]",
        "Written Exam",
        "Interview",
        "[/list]",
        "Closing note"
      ],
      { sectionName: "Selection Process" }
    );
    expect(html.indexOf("<p>Overview paragraph</p>")).toBeLessThan(html.indexOf("content-list"));
    expect(html.indexOf("content-list")).toBeLessThan(html.indexOf("<p>Closing note</p>"));
  });

  test("date rows unaffected when outside list block", () => {
    const html = renderLinesToHtml(
      [
        "Online Apply Start Date: 12 August 2025",
        "Online Apply Last Date: 11 September 2025",
        "[list]",
        "Written Exam",
        "Document Verification",
        "[/list]"
      ],
      { sectionName: "Important Dates" }
    );
    expect(html).toContain('class="date-row"');
    expect(html).toContain('class="date-value"');
    expect(html).toContain("12 August 2025");
    expect(html).toContain("11 September 2025");
    expect(html).toContain("content-list");
    expect(html).not.toContain("<p>Online Apply Start Date");
  });

  test("FAQ and links unchanged", () => {
    const html = renderLinesToHtml(
      [
        "Q: What is the last date?",
        "A: 22 June 2026",
        "Apply Online=https://example.com/apply"
      ],
      { sectionName: "Important Links" }
    );
    expect(html).toContain('class="faq-item"');
    expect(html).toContain('class="link-box"');
    expect(html).not.toContain("content-list");
  });

  test("existing paragraph-only section unchanged", () => {
    const html = renderLinesToHtml(
      ["Staff Selection Commission has released notification.", "Candidates must check details."],
      { sectionName: "ShortInfo" }
    );
    expect(html).toBe(
      "<p>Staff Selection Commission has released notification.</p><p>Candidates must check details.</p>"
    );
    expect(html).not.toContain("content-list");
  });

  test("mixed section: table then list via buildDynamicSections", () => {
    const text = `[Section: Selection Process]
---table---
Step, Detail
Written, CBT
---endtable---

[list]
Document Verification
Medical Examination
[/list]`;
    const prev = process.env.MIXED_SECTION_BLOCKS;
    process.env.MIXED_SECTION_BLOCKS = "1";
    const { html } = buildDynamicSectionsWithWarnings(text);
    if (prev === undefined) delete process.env.MIXED_SECTION_BLOCKS;
    else process.env.MIXED_SECTION_BLOCKS = prev;

    expect(html).toContain("<table");
    expect(html).toContain("content-list");
    expect(html).toContain("<li>Document Verification</li>");
    expect(html.indexOf("<table")).toBeLessThan(html.indexOf("content-list"));
  });
});
