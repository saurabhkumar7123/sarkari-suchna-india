const {
  CONTENT_TYPES,
  parseTextToEditorSections,
  compileEditorSectionsToText,
  isVisualEditorSafeForText,
  normalizeEditorText
} = require("../server/utils/sectionEditorModel");

describe("sectionEditorModel", () => {
  const sample = `[Section: Short Information]
Uttar Pradesh Public Service Commission

[Section: Important Dates]
Apply Start Date : 04 September 2025
Last Date : 30 September 2025

[Section: Important Links]
Download Answer Key=https://uppsc.up.nic.in/CandidatePages/Status/ViewAnswerKey.aspx?ID=5

[Section: Important Questions]
Q: When will the result come?
A: The answer will be published on the official website.
`;

  test("parseTextToEditorSections detects content types", () => {
    const sections = parseTextToEditorSections(sample);
    expect(sections).toHaveLength(4);
    expect(sections[0].contentType).toBe(CONTENT_TYPES.PARAGRAPH);
    expect(sections[1].contentType).toBe(CONTENT_TYPES.DATES);
    expect(sections[2].contentType).toBe(CONTENT_TYPES.LINKS);
    expect(sections[3].contentType).toBe(CONTENT_TYPES.FAQ);
  });

  test("round-trip preserves canonical sample", () => {
    const normalized = normalizeEditorText(sample);
    const sections = parseTextToEditorSections(normalized);
    const out = normalizeEditorText(compileEditorSectionsToText(sections));
    expect(out).toBe(normalized);
    expect(isVisualEditorSafeForText(normalized)).toBe(true);
  });

  test("compile builds link and date syntax automatically", () => {
    const sections = parseTextToEditorSections(sample);
    const out = compileEditorSectionsToText(sections);
    expect(out).toContain("Apply Start Date : 04 September 2025");
    expect(out).toContain("Download Answer Key=https://uppsc.up.nic.in");
    expect(out).toContain("Q: When will the result come?");
    expect(out).toContain("A: The answer will be published");
  });

  test("custom section name is preserved", () => {
    const text = `[Section: Document Required]
- Aadhaar Card
- Photo
`;
    const normalized = normalizeEditorText(text);
    const sections = parseTextToEditorSections(normalized);
    expect(sections[0].name).toBe("Document Required");
    const out = normalizeEditorText(compileEditorSectionsToText(sections));
    expect(out).toContain("[Section: Document Required]");
    expect(isVisualEditorSafeForText(normalized)).toBe(true);
  });

  test("dates section supports paragraph and list blocks", () => {
    const text = `[Section: Important Dates]
Apply Start Date : 04 September 2025
Last Date : 30 September 2025
Candidates must apply before the last date.
- Online application only
- Fee non-refundable
`;
    const normalized = normalizeEditorText(text);
    const sections = parseTextToEditorSections(normalized);
    expect(sections[0].contentType).toBe(CONTENT_TYPES.DATES);
    expect(sections[0].payload.blocks).toHaveLength(5);
    const out = normalizeEditorText(compileEditorSectionsToText(sections));
    expect(out).toBe(normalized);
    expect(isVisualEditorSafeForText(normalized)).toBe(true);
  });

  test("links section supports Hindi and English dual buttons", () => {
    const text = `[Section: Important Links]
Download PDF|Hindi=https://example.com/hindi.pdf|English=https://example.com/english.pdf
Apply Online=https://example.com/apply
`;
    const normalized = normalizeEditorText(text);
    const sections = parseTextToEditorSections(normalized);
    expect(sections[0].contentType).toBe(CONTENT_TYPES.LINKS);
    expect(sections[0].payload.rows[0].mode).toBe("multi");
    expect(sections[0].payload.rows[0].actions).toHaveLength(2);
    const out = normalizeEditorText(compileEditorSectionsToText(sections));
    expect(out).toContain("Download PDF|Hindi=https://example.com/hindi.pdf|English=https://example.com/english.pdf");
    expect(out).toContain("Apply Online=https://example.com/apply");
    expect(isVisualEditorSafeForText(normalized)).toBe(true);
  });

  test("table grid editor round-trips vacancy table", () => {
    const text = `[Section: Vacancy | table]
Post Name, Posts, Qualification
Constable, 1000, 12th
SI, 500, Graduation
`;
    const normalized = normalizeEditorText(text);
    const sections = parseTextToEditorSections(normalized);
    expect(sections[0].contentType).toBe(CONTENT_TYPES.TABLE);
    expect(sections[0].payload.blocks).toHaveLength(1);
    expect(sections[0].payload.blocks[0].type).toBe("table");
    expect(sections[0].payload.blocks[0].grid).toHaveLength(3);
    const out = normalizeEditorText(compileEditorSectionsToText(sections));
    expect(out).toBe(normalized);
    expect(isVisualEditorSafeForText(normalized)).toBe(true);
  });

  test("table section supports text before and after table blocks", () => {
    const text = `[Section: Vacancy]
UP Police recruitment details are below.

---table---
Post Name, Posts
Constable, 1000
---endtable---

Read official notification carefully.

---table---
Category, Age
General, 18-25
---endtable---

Apply before last date.`;
    const normalized = normalizeEditorText(text);
    const sections = parseTextToEditorSections(normalized);
    expect(sections[0].contentType).toBe(CONTENT_TYPES.TABLE);
    expect(sections[0].forceTable).toBe(false);
    expect(sections[0].payload.blocks.filter((b) => b.type === "text")).toHaveLength(3);
    expect(sections[0].payload.blocks.filter((b) => b.type === "table")).toHaveLength(2);
    const out = normalizeEditorText(compileEditorSectionsToText(sections));
    expect(out).toBe(normalized);
    expect(isVisualEditorSafeForText(normalized)).toBe(true);
  });

  test("table section with link cells round-trips", () => {
    const text = `[Section: Important Links]
Download notification before applying.

---table---
Document, Link
Notification, Download=https://example.com/notify.pdf
Apply, Apply Online=https://example.com/apply
---endtable---

Official website par verify karein.`;
    const normalized = normalizeEditorText(text);
    const sections = parseTextToEditorSections(normalized);
    const grid = sections[0].payload.blocks.find((b) => b.type === "table")?.grid;
    expect(grid?.[1]?.[1]).toBe("Download=https://example.com/notify.pdf");
    expect(grid?.[2]?.[1]).toBe("Apply Online=https://example.com/apply");
    const out = normalizeEditorText(compileEditorSectionsToText(sections));
    expect(out).toBe(normalized);
    expect(isVisualEditorSafeForText(normalized)).toBe(true);
  });

  test("parseTableCellForEditor detects link syntax", () => {
    const { parseTableCellForEditor, compileTableCellFromEditor, parseTableCellLinkSyntax } = require("../server/utils/sectionEditorModel");
    expect(parseTableCellLinkSyntax("Apply Online=https://example.com")).toEqual({
      label: "Apply Online",
      url: "https://example.com"
    });
    expect(parseTableCellForEditor("Apply Online=https://example.com").mode).toBe("link");
    expect(
      compileTableCellFromEditor({
        mode: "link",
        label: "Result",
        url: "https://example.com/result"
      })
    ).toBe("Result=https://example.com/result");
  });

  test("canonicalizes extra spaces in date lines for visual round-trip", () => {
    const text = `[Section: Important Dates]
Online Apply Start Date : 18 June 2026
Online Apply Last Date :  08 July 2026
Candidates Are Advised To Confirm From The SBI Official Website :
`;
    const normalized = normalizeEditorText(text);
    expect(normalized).toContain("Online Apply Last Date : 08 July 2026");
    expect(isVisualEditorSafeForText(normalized)).toBe(true);
  });

  test("forced table section compiles with | table suffix", () => {
    const text = `[Section: Vacancy | table]
Post Name, Posts, Qualification
Constable, 1000, 12th
`;
    const sections = parseTextToEditorSections(text);
    expect(sections[0].contentType).toBe(CONTENT_TYPES.TABLE);
    const out = compileEditorSectionsToText(sections);
    expect(out).toContain("[Section: Vacancy | table]");
  });
});
