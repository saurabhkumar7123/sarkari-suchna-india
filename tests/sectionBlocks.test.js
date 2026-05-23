const {
  parseSectionBlocks,
  hasExplicitTableMarkers,
  shouldUseMixedSectionBlocks,
  isMixedSectionBlocksEnabled
} = require("../generator/parse/sectionBlocks");

const { buildMixedSectionHtml } = require("../generator/builders/mixedSectionBuilder");
const { buildDynamicSectionsWithWarnings } = require("../generator/builders/sectionBuilder");

describe("sectionBlocks", () => {
  const prevFlag = process.env.MIXED_SECTION_BLOCKS;

  afterEach(() => {
    if (prevFlag === undefined) delete process.env.MIXED_SECTION_BLOCKS;
    else process.env.MIXED_SECTION_BLOCKS = prevFlag;
  });

  test("disabled by default", () => {
    delete process.env.MIXED_SECTION_BLOCKS;
    expect(isMixedSectionBlocksEnabled()).toBe(false);
  });

  test("parses text + table + text blocks", () => {
    const content = `Intro paragraph here.

---table---
Post, Cat
Clerk, UR
---endtable---

Closing paragraph.`;

    const { blocks, isMixed } = parseSectionBlocks(content);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe("text");
    expect(blocks[1].type).toBe("table");
    expect(blocks[2].type).toBe("text");
    expect(isMixed).toBe(true);
  });

  test("warns on unclosed table block", () => {
    const { issues } = parseSectionBlocks(`---table---
A, B`);
    expect(issues.some((i) => i.code === "UNCLOSED_TABLE_BLOCK")).toBe(true);
  });

  test("warns on nested table markers", () => {
    const { issues } = parseSectionBlocks(`---table---
---table---
A, B
---endtable---`);
    expect(issues.some((i) => i.code === "NESTED_TABLE_BLOCK")).toBe(true);
  });

  test("warns on empty table block", () => {
    const { issues } = parseSectionBlocks(`---table---
---endtable---`);
    expect(issues.some((i) => i.code === "EMPTY_TABLE_BLOCK")).toBe(true);
  });

  test("warns on orphan endtable", () => {
    const { issues } = parseSectionBlocks(`---endtable---`);
    expect(issues.some((i) => i.code === "ORPHAN_END_TABLE")).toBe(true);
  });

  test("supports multiple table blocks", () => {
    const content = `Intro
---table---
A, B
1, 2
---endtable---
Mid
---table---
X, Y
3, 4
---endtable---
End`;
    const { blocks } = parseSectionBlocks(content);
    expect(blocks.filter((b) => b.type === "table")).toHaveLength(2);
    expect(blocks.filter((b) => b.type === "text")).toHaveLength(3);
  });

  test("shouldUseMixedSectionBlocks requires flag and markers", () => {
    process.env.MIXED_SECTION_BLOCKS = "1";
    const sec = { forceTable: false, content: "---table---\nA\n---endtable---" };
    expect(shouldUseMixedSectionBlocks(sec)).toBe(true);
    delete process.env.MIXED_SECTION_BLOCKS;
    expect(shouldUseMixedSectionBlocks(sec)).toBe(false);
  });

  test("forced table sections ignore mixed blocks", () => {
    process.env.MIXED_SECTION_BLOCKS = "1";
    const sec = { forceTable: true, content: "---table---\nA\n---endtable---" };
    expect(shouldUseMixedSectionBlocks(sec)).toBe(false);
  });
});

describe("mixed section rendering", () => {
  const prevFlag = process.env.MIXED_SECTION_BLOCKS;
  const prevV2 = process.env.TABLE_PARSER_V2;

  afterEach(() => {
    if (prevFlag === undefined) delete process.env.MIXED_SECTION_BLOCKS;
    else process.env.MIXED_SECTION_BLOCKS = prevFlag;
    if (prevV2 === undefined) delete process.env.TABLE_PARSER_V2;
    else process.env.TABLE_PARSER_V2 = prevV2;
  });

  const mixedSectionText = `[Section: Vacancy]
UP Police recruitment details are below.

---table---
Post Name, Category, Posts
Constable, General, 100
---endtable---

Candidates should read official notification carefully.`;

  test("flag off renders markers as paragraphs (legacy)", () => {
    delete process.env.MIXED_SECTION_BLOCKS;
    const { html } = buildDynamicSectionsWithWarnings(mixedSectionText);
    expect(html).toContain("<p>UP Police recruitment");
    expect(html).not.toContain("<table");
    expect(html).toContain("---table---");
  });

  test("flag on renders paragraph + table + paragraph", () => {
    process.env.MIXED_SECTION_BLOCKS = "1";
    const { html } = buildDynamicSectionsWithWarnings(mixedSectionText);
    expect(html).toContain("<p>UP Police recruitment");
    expect(html).toContain("<table");
    expect(html).toContain("Constable");
    expect(html).toContain("<p>Candidates should read");
    expect(html).not.toContain("---table---");
  });

  test("FAQ lines work in text blocks", () => {
    process.env.MIXED_SECTION_BLOCKS = "1";
    const text = `[Section: FAQ]
Q: What is age limit?
---table---
Item, Value
Age, 18-25
---endtable---
A: See notification.`;
    const html = buildMixedSectionHtml(`Q: What is age limit?
---table---
Item, Value
Age, 18-25
---endtable---
A: See notification.`);
    expect(html).toContain("faq-item");
    expect(html).toContain("<table");
  });

  test("legacy full-table section unchanged with flag on", () => {
    process.env.MIXED_SECTION_BLOCKS = "1";
    const text = `[Section: Posts | table]
Post, Cat
Clerk, UR`;
    const { html } = buildDynamicSectionsWithWarnings(text);
    expect(html).toContain("<table");
    expect(html).not.toContain("---table---");
  });
});
