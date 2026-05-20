const {
  compileStructuredSections,
  createStructuredGroupState,
  appendLineToStructuredGroup,
  compileStructuredGroupState,
  csvHeadersSupportStructured,
  trimCell
} = require("../server/utils/contentCompiler");

describe("contentCompiler", () => {
  test("compileStructuredSections builds canonical section blocks", () => {
    const out = compileStructuredSections([
      {
        name: "ImportantDates",
        lines: ["Notification Date: 31 December 2025", "Last Date: 30 January 2026"]
      },
      {
        name: "ImportantLinks",
        lines: [
          "Apply Online=https://example.com",
          "Download Notification=https://example.com/notification.pdf"
        ]
      }
    ]);

    expect(out).toContain("[Section: ImportantDates]");
    expect(out).toContain("Notification Date: 31 December 2025");
    expect(out).toContain("Last Date: 30 January 2026");
    expect(out).toContain("[Section: ImportantLinks]");
    expect(out).toContain("Apply Online=https://example.com");
  });

  test("csvHeadersSupportStructured requires section and line", () => {
    expect(csvHeadersSupportStructured(["import_group", "section", "line"])).toBe(true);
    expect(csvHeadersSupportStructured(["content"])).toBe(false);
    expect(csvHeadersSupportStructured(["section"])).toBe(false);
  });

  test("appendLineToStructuredGroup preserves section order", () => {
    const state = createStructuredGroupState();
    appendLineToStructuredGroup(state, "ImportantDates", "A: 1");
    appendLineToStructuredGroup(state, "ImportantLinks", "B=url");
    appendLineToStructuredGroup(state, "ImportantDates", "A: 2");

    expect(state.sections.map((s) => s.name)).toEqual(["ImportantDates", "ImportantLinks"]);
    expect(state.sections[0].lines).toEqual(["A: 1", "A: 2"]);
    expect(compileStructuredGroupState(state)).toContain("[Section: ImportantDates]");
  });

  test("trimCell normalizes CRLF and whitespace", () => {
    expect(trimCell("  hello \r\n")).toBe("hello");
  });
});
