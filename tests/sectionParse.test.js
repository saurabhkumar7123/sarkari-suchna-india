const {
  parseSectionsFromText,
  resolveSectionRenderMode,
  isSafeCsvTable
} = require("../generator/parse/sectionParse");
const { buildDynamicSectionsWithWarnings } = require("../generator/builders/sectionBuilder");

describe("sectionParse", () => {
  test("parseSectionsFromText detects | table flag", () => {
    const text = `[Section: Vacancy | table]
Post, Cat, 1
A, B, 2`;
    const sections = parseSectionsFromText(text);
    expect(sections).toHaveLength(1);
    expect(sections[0].forceTable).toBe(true);
    expect(sections[0].cleanHeaderTitle).toBe("Vacancy");
  });

  test("resolveSectionRenderMode forced table", () => {
    const lines = ["only one line"];
    expect(resolveSectionRenderMode(lines, true)).toBe("table_forced");
  });

  test("forced table does not fall back to line mode for non-comma body", () => {
    const text = `[Section: Note | table]
This is prose without commas.`;
    const html = buildDynamicSectionsWithWarnings(text).html;
    expect(html).toContain("<table");
    expect(html).not.toContain('<p>This is prose');
  });

  test("isSafeCsvTable accepts vacancy-style grid", () => {
    const lines = ["Post, Cat, Count", "Clerk, UR, 100"];
    expect(isSafeCsvTable(lines)).toBe(true);
  });
});
