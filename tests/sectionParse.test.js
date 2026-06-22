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

  test("compact layout for text and date sections, wide for tables and links", () => {
    const dates = buildDynamicSectionsWithWarnings(`[Section: Important Dates]
Apply Start : 1 Jan 2026
Apply End : 31 Jan 2026`);
    expect(dates.html).toContain('class="card card--compact"');
    expect(dates.html).toContain("date-row");

    const links = buildDynamicSectionsWithWarnings(`[Section: Important Links]
Apply Online=https://example.com`);
    expect(links.html).toContain('class="card card--wide"');
    expect(links.html).toContain('class="link-box"');

    const vacancy = buildDynamicSectionsWithWarnings(`[Section: Vacancy | table]
Post, Count
Clerk, 100`);
    expect(vacancy.html).toContain('class="card card--wide"');
    expect(vacancy.html).toContain("<table");

    const faq = buildDynamicSectionsWithWarnings(`[Section: FAQ]
Q: When is the exam?
A: In June 2026`);
    expect(faq.html).toContain('class="card card--wide"');
    expect(faq.html).toContain('class="faq-item"');
  });
});
