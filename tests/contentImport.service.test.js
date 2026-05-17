const {
  normalizeCsvRowKeys,
  extractContentFromRow
} = require("../server/services/contentImport.service");

describe("contentImport.service parsing helpers", () => {
  test("normalizeCsvRowKeys strips BOM from header", () => {
    const row = normalizeCsvRowKeys({ "\ufeffcontent": "hello" });
    expect(row.content).toBe("hello");
  });

  test("extractContentFromRow reads content column case-insensitively", () => {
    expect(extractContentFromRow({ Content: "  line one\nline two  " })).toBe("line one\nline two");
  });

  test("extractContentFromRow returns empty when column missing", () => {
    expect(extractContentFromRow({ title: "x" })).toBe("");
  });
});
