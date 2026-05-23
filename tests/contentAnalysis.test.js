const { analyzeJobContent } = require("../generator/analysis/contentAnalysis");

describe("analyzeJobContent", () => {
  test("detects forced table section and column mismatch", () => {
    const text = `[Section: Vacancy | table]
Post, Category
Clerk, UR, 100, extra`;
    const a = analyzeJobContent(text);
    expect(a.summary.forcedTableCount).toBe(1);
    expect(a.sections[0].renderMode).toBe("table_forced");
    expect(a.sections[0].willRenderAsTable).toBe(true);
    expect(a.warnings.some((w) => w.code === "FORCED_TABLE_COL_MISMATCH")).toBe(true);
  });

  test("legacyWarnings strings for publish compatibility", () => {
    const text = `[Section: Vacancy]
A, B
C, D, E`;
    const a = analyzeJobContent(text);
    expect(Array.isArray(a.legacyWarnings)).toBe(true);
    expect(a.legacyWarnings.some((m) => /inconsistent columns/i.test(m))).toBe(true);
  });

  test("detects mixed blocks when flag enabled", () => {
    process.env.MIXED_SECTION_BLOCKS = "1";
    const text = `[Section: Vacancy]
Intro line
---table---
A, B
1, 2
---endtable---
Outro`;
    const a = analyzeJobContent(text);
    expect(a.sections[0].renderMode).toBe("mixed_blocks");
    expect(a.sections[0].isMixedSection).toBe(true);
    expect(a.sections[0].blocks.length).toBeGreaterThanOrEqual(2);
    expect(a.summary.mixedSectionCount).toBe(1);
    delete process.env.MIXED_SECTION_BLOCKS;
  });

  test("warns when markers present but flag off", () => {
    delete process.env.MIXED_SECTION_BLOCKS;
    const text = `[Section: Vacancy]
---table---
A, B
---endtable---`;
    const a = analyzeJobContent(text);
    expect(a.warnings.some((w) => w.code === "MIXED_BLOCKS_FLAG_OFF")).toBe(true);
  });

  test("warns when comma rows do not form a safe auto table", () => {
    const text = `[Section: Vacancy]
Intro line without commas
Post, Cat, 100
Clerk, UR, 50`;
    const a = analyzeJobContent(text);
    expect(a.sections[0].willRenderAsTable).toBe(false);
    expect(
      a.warnings.some((w) => w.code === "COMMA_NOT_TABLE" || w.code === "TABLE_COL_MISMATCH")
    ).toBe(true);
  });
});
