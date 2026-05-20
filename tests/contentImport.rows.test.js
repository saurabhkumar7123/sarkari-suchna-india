const { rowsToImportRecords, normalizeCsvRowKeys } = require("../server/services/contentImport.service");

describe("rowsToImportRecords", () => {
  test("legacy content column: one row = one import (unchanged)", () => {
    const { records, skipped } = rowsToImportRecords(
      [{ content: "[Section: ShortInfo]\nHello" }],
      "legacy.csv"
    );
    expect(skipped).toBe(0);
    expect(records).toHaveLength(1);
    expect(records[0].content).toContain("[Section: ShortInfo]");
    expect(records[0].rowIndex).toBe(1);
  });

  test("structured rows with blank group/section carry-forward", () => {
    const rows = [
      {
        import_group: "1",
        section: "ImportantDates",
        line: "Notification Date: 31 December 2025"
      },
      { import_group: "", section: "", line: "Last Date: 30 January 2026" },
      { import_group: "", section: "ImportantLinks", line: "Apply Online=https://example.com" },
      {
        import_group: "",
        section: "",
        line: "Download Notification=https://example.com/notification.pdf"
      }
    ];
    const { records, skipped } = rowsToImportRecords(rows, "structured.csv");
    expect(skipped).toBe(0);
    expect(records).toHaveLength(1);
    expect(records[0].content).toContain("[Section: ImportantDates]");
    expect(records[0].content).toContain("Last Date: 30 January 2026");
    expect(records[0].content).toContain("[Section: ImportantLinks]");
    expect(records[0].content).toContain("Apply Online=https://example.com");
  });

  test("mixed file: legacy content row + structured group", () => {
    const rows = [
      { content: "[Section: ShortInfo]\nLegacy page", section: "", line: "" },
      { import_group: "2", section: "Vacancy", line: "Post,Total" },
      { import_group: "", section: "", line: "Clerk,100" }
    ];
    const { records } = rowsToImportRecords(rows, "mixed.csv");
    expect(records).toHaveLength(2);
    expect(records[0].content).toContain("Legacy page");
    expect(records[1].content).toContain("[Section: Vacancy]");
    expect(records[1].content).toContain("Clerk,100");
  });

  test("rejects line without prior section in group", () => {
    expect(() =>
      rowsToImportRecords(
        [{ import_group: "1", section: "", line: "Orphan line" }],
        "bad.csv"
      )
    ).toThrow(/section/i);
  });

  test("header without content or structured columns fails", () => {
    expect(() => rowsToImportRecords([{ title: "x", body: "y" }], "bad.csv")).toThrow(/content|section/i);
  });

  test("normalizeCsvRowKeys is case-insensitive for headers", () => {
    const keys = Object.keys(normalizeCsvRowKeys({ Section: "A", LINE: "B" }));
    expect(keys).toContain("section");
    expect(keys).toContain("line");
  });
});
