const { resolveSectionHeaderTone, HEADER_TONE } = require("../generator/lib/sectionHeaderTone");
const { buildDynamicSectionsWithWarnings } = require("../generator/builders/sectionBuilder");

describe("sectionHeaderTone", () => {
  test("date rows use same navy header as paragraph", () => {
    const tone = resolveSectionHeaderTone({
      cleanHeaderTitle: "Application Fee",
      forceTable: false,
      content: "General : Rs 100\nOBC : Rs 50",
      lines: ["General : Rs 100", "OBC : Rs 50"]
    });
    expect(tone).toBe(HEADER_TONE.DEFAULT);

    const { html } = buildDynamicSectionsWithWarnings(`[Section: Important Dates]
Apply Start : 1 Jan 2026
Apply End : 31 Jan 2026`);
    expect(html).toContain('class="card-header card-header--facts"');
  });

  test("paragraph and list use default navy header", () => {
    expect(
      resolveSectionHeaderTone({
        cleanHeaderTitle: "Note",
        content: "This is a long note about eligibility.",
        lines: ["This is a long note about eligibility."]
      })
    ).toBe(HEADER_TONE.DEFAULT);

    const { html: listHtml } = buildDynamicSectionsWithWarnings(`[Section: Eligibility]
- Graduate from recognized university
- Age 18-30 years`);
    expect(listHtml).toContain('class="card-header card-header--facts"');
  });

  test("FAQ (Q:/A:) uses same navy header as paragraph", () => {
    const tone = resolveSectionHeaderTone({
      cleanHeaderTitle: "FAQ",
      content: "Q: When is the exam?\nA: In June 2026",
      lines: ["Q: When is the exam?", "A: In June 2026"]
    });
    expect(tone).toBe(HEADER_TONE.DEFAULT);

    const { html: faqHtml } = buildDynamicSectionsWithWarnings(`[Section: FAQ]
Q: When is the exam?
A: In June 2026`);
    expect(faqHtml).toContain('class="card-header card-header--facts"');
  });

  test("tables use same navy header as paragraph", () => {
    const tone = resolveSectionHeaderTone({
      cleanHeaderTitle: "Vacancy",
      forceTable: true,
      content: "Post, Count\nClerk, 100",
      lines: ["Post, Count", "Clerk, 100"]
    });
    expect(tone).toBe(HEADER_TONE.DEFAULT);

    const { html: tableHtml } = buildDynamicSectionsWithWarnings(`[Section: Vacancy | table]
Post, Count
Clerk, 100`);
    expect(tableHtml).toContain('class="card-header card-header--facts"');
  });

  test("links use action header class", () => {
    const { html } = buildDynamicSectionsWithWarnings(`[Section: Important Links]
Apply Online=https://example.com/apply`);
    expect(html).toContain('class="card-header card-header--action"');
  });

  test("links beat dates in mixed sections", () => {
    const tone = resolveSectionHeaderTone({
      cleanHeaderTitle: "Mixed",
      content: "Apply Start : 1 Jan 2026\nApply Online=https://example.com",
      lines: ["Apply Start : 1 Jan 2026", "Apply Online=https://example.com"]
    });
    expect(tone).toBe(HEADER_TONE.LINKS);
  });

  test("mixed table blocks without links use paragraph navy header", () => {
    const text = `[Section: Details]
Intro paragraph here.
---table---
Col1, Col2
A, B
---endtable---`;
    const { html } = buildDynamicSectionsWithWarnings(text);
    expect(html).toContain('class="card-header card-header--facts"');
  });
});
