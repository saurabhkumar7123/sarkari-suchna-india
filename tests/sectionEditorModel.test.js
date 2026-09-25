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

  test("repair normalizes table markers and color closing tags", () => {
    const { repairEditorText } = require("../server/utils/sectionEditorModel");
    const raw = `[Section: Test]
---Table---
A, B
---Endtable---

[color=red][b]Note[/b][/Color]`;
    const { text, changes } = repairEditorText(raw);
    expect(text).toContain("---table---");
    expect(text).toContain("---endtable---");
    expect(text).toContain("[/color]");
    expect(changes.length).toBeGreaterThan(0);
  });

  test("analyzeVisualEditorSafety reports partial unsafe sections", () => {
    const { analyzeVisualEditorSafety } = require("../server/utils/sectionEditorModel");
    const text = `[Section: Dates]
Apply : 01 Jan 2026

[Section: Extra]
[color=red]orphan line[/color]
`;
    const analysis = analyzeVisualEditorSafety(normalizeEditorText(text));
    expect(analysis.sections.length).toBe(2);
    expect(typeof analysis.safe).toBe("boolean");
    expect(analysis.sections[0].editorSafe).toBe(true);
  });

  test("rich date line with highlight round-trips after normalize", () => {
    const text = `[Section: Important Dates]
Online Apply Start Date : [highlight]18 June 2026
Online Apply Last Date : [color=red] 08 July 2026
`;
    const normalized = normalizeEditorText(text);
    const sections = parseTextToEditorSections(normalized);
    expect(sections[0].contentType).toBe(CONTENT_TYPES.DATES);
    const out = normalizeEditorText(compileEditorSectionsToText(sections));
    expect(out).toContain("[highlight]18 June 2026");
    expect(out).toContain("[color=red]");
  });

  test("flexible blocks detect table plus text in one section", () => {
    const text = `[Section: Vacancy]
Intro line here.

---table---
Post, Count
Constable, 100
---endtable---

Closing note.`;
    const normalized = normalizeEditorText(text);
    const sections = parseTextToEditorSections(normalized);
    expect(sections[0].contentType).toBe(CONTENT_TYPES.TABLE);
    expect(sections[0].payload.blocks.length).toBeGreaterThan(1);
  });

  test("representative recruitment pack round-trips for section builder UX", () => {
    const text = `[Section: Short Information]
Railway RRB Technician recruitment overview.

[Section: Important Dates]
Online Apply Start Date : 30 June 2026
Online Apply Last Date : 29 July 2026
Fee Payment Last Date : 29 July 2026
Exam Date : Later
Admit Card : Later
Result Date : Later

[Section: Application Fee]
General / EWS / OBC : ₹500
SC / ST / PH : ₹250
Female : ₹250

[Section: Age Limit]
Minimum Age : 18 Years
Maximum Age : 33 Years

[Section: Vacancy Details | table]
Post Name, No Of Post, Eligibility Criteria
Railway RRB Technician, 6565, Eligibility text

[Section: How To Apply]
- Register on the official website
- Fill the application form
- Pay the fee and submit

[Section: Selection Process]
- CBT
- Document Verification
- Medical Examination

[Section: Important Links]
Apply Online=https://example.com/apply
Official Notification=https://example.com/notification.pdf
Official Website=https://example.com/

[Section: Important Questions]
Q: What is the last date?
A: 29 July 2026
Q: What is the application fee for SC?
A: ₹250
`;
    const normalized = normalizeEditorText(text);
    const sections = parseTextToEditorSections(normalized);
    expect(sections.map((s) => s.name)).toEqual([
      "Short Information",
      "Important Dates",
      "Application Fee",
      "Age Limit",
      "Vacancy Details",
      "How To Apply",
      "Selection Process",
      "Important Links",
      "Important Questions"
    ]);
    expect(sections[1].contentType).toBe(CONTENT_TYPES.DATES);
    expect(sections[2].contentType).toBe(CONTENT_TYPES.DATES);
    expect(sections[3].contentType).toBe(CONTENT_TYPES.DATES);
    expect(sections[4].contentType).toBe(CONTENT_TYPES.TABLE);
    expect(sections[4].forceTable).toBe(true);
    expect(sections[7].contentType).toBe(CONTENT_TYPES.LINKS);
    expect(sections[8].contentType).toBe(CONTENT_TYPES.FAQ);

    const out = normalizeEditorText(compileEditorSectionsToText(sections));
    expect(out).toContain("[Section: Important Dates]");
    expect(out).toContain("Online Apply Start Date : 30 June 2026");
    expect(out).toContain("[Section: Application Fee]");
    expect(out).toContain("General / EWS / OBC : ₹500");
    expect(out).toContain("[Section: Vacancy Details | table]");
    expect(out).toContain("Railway RRB Technician, 6565, Eligibility text");
    expect(out).toContain("Apply Online=https://example.com/apply");
    expect(out).toContain("Q: What is the last date?");
    expect(out).toBe(normalized);
    expect(isVisualEditorSafeForText(normalized)).toBe(true);
  });

  test("fee and vacancy presets compile to existing publish syntax", () => {
    const { createEmptySection, defaultPayloadForType } = require("../server/utils/sectionEditorModel");
    const fee = createEmptySection("Application Fee", CONTENT_TYPES.DATES);
    fee.payload = {
      blocks: [
        { type: "date", label: "General / EWS / OBC", value: "₹500" },
        { type: "date", label: "SC / ST / PH", value: "₹250" }
      ]
    };
    const vacancy = createEmptySection("Vacancy Details", CONTENT_TYPES.TABLE);
    vacancy.forceTable = true;
    vacancy.payload = {
      blocks: [
        {
          type: "table",
          grid: [
            ["Post Name", "No Of Post", "Eligibility Criteria"],
            ["Railway RRB Technician", "6565", "Eligibility text"]
          ]
        }
      ]
    };
    const compiled = normalizeEditorText(compileEditorSectionsToText([fee, vacancy]));
    expect(compiled).toContain("[Section: Application Fee]");
    expect(compiled).toContain("General / EWS / OBC : ₹500");
    expect(compiled).toContain("[Section: Vacancy Details | table]");
    expect(compiled).toContain("Railway RRB Technician, 6565, Eligibility text");
    expect(defaultPayloadForType(CONTENT_TYPES.FAQ)).toEqual({ pairs: [{ q: "", a: "" }] });
  });
});
