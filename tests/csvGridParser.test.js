const {
  parseNaiveCommaGrid,
  parseV2Grid,
  parseGrid,
  parseGridFromContent,
  parseCsvLine,
  parseTableContent,
  isGridParserV2Enabled,
  evaluateAutoTableEligibility,
  splitLogicalRows
} = require("../generator/lib/csvGridParser");

describe("csvGridParser", () => {
  const prevFlag = process.env.TABLE_PARSER_V2;

  afterEach(() => {
    if (prevFlag === undefined) delete process.env.TABLE_PARSER_V2;
    else process.env.TABLE_PARSER_V2 = prevFlag;
  });

  test("parseNaiveCommaGrid reports column mismatch", () => {
    const grid = parseNaiveCommaGrid(["A, B", "C, D, E"]);
    expect(grid.columnCount).toBe(2);
    expect(grid.issues.some((i) => i.code === "COL_MISMATCH")).toBe(true);
  });

  test("V2 parser disabled by default", () => {
    delete process.env.TABLE_PARSER_V2;
    expect(isGridParserV2Enabled()).toBe(false);
    const grid = parseGrid(["A,B", "1,2"]);
    expect(grid.parser).toBe("naive");
  });

  test("parseCsvLine handles quoted Indian amount", () => {
    const { cells, issues } = parseCsvLine('"Constable","General","1,30,093"');
    expect(issues).toHaveLength(0);
    expect(cells).toEqual(["Constable", "General", "1,30,093"]);
  });

  test("parseCsvLine handles escaped quotes", () => {
    const { cells } = parseCsvLine('"He said ""Hi""",B');
    expect(cells[0]).toBe('He said "Hi"');
    expect(cells[1]).toBe("B");
  });

  test("parseCsvLine detects unclosed quote", () => {
    const { issues } = parseCsvLine('"Open,B');
    expect(issues.some((i) => i.code === "UNCLOSED_QUOTE")).toBe(true);
  });

  test("parseV2Grid preserves empty cells", () => {
    const grid = parseV2Grid(["A,B,C", "1,,3"]);
    expect(grid.rows[1].cells).toEqual(["1", "", "3"]);
  });

  test("splitLogicalRows merges multiline quoted field", () => {
    const text = 'Post,Cat\n"Line one\nline two",B';
    const rows = splitLogicalRows(text);
    expect(rows).toHaveLength(2);
    const grid = parseV2Grid(rows);
    expect(grid.rows[1].cells[0]).toContain("line two");
  });

  test("TABLE_PARSER_V2=1 uses quoted parser for table content", () => {
    process.env.TABLE_PARSER_V2 = "1";
    const content = `Post,Category,Posts
Constable,General,"1,30,093"`;
    const { rows, parser } = parseTableContent(content);
    expect(parser).toBe("v2");
    expect(rows[1]).toEqual(["Constable", "General", "1,30,093"]);
  });

  test("TABLE_PARSER_V2=0 keeps naive split for amounts", () => {
    process.env.TABLE_PARSER_V2 = "0";
    const content = `Post,Category,Posts
Constable,General,"1,30,093"`;
    const { rows, parser } = parseTableContent(content);
    expect(parser).toBe("naive");
    expect(rows[1].length).toBeGreaterThan(3);
  });

  test("evaluateAutoTableEligibility rejects inconsistent rows", () => {
    delete process.env.TABLE_PARSER_V2;
    const { eligible } = evaluateAutoTableEligibility("A,B\nC,D,E", ["A,B", "C,D,E"]);
    expect(eligible).toBe(false);
  });

  test("evaluateAutoTableEligibility accepts clean grid with V2", () => {
    process.env.TABLE_PARSER_V2 = "1";
    const content = `Post,Cat,Count
Clerk,UR,100`;
    const { eligible, grid } = evaluateAutoTableEligibility(content);
    expect(eligible).toBe(true);
    expect(grid.columnCount).toBe(3);
  });
});
