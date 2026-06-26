"use strict";

const { processJobParse } = require("../server/services/aiParseJob.service");
const { buildDynamicSectionsWithWarnings } = require("../generator/builders/sectionBuilder");
const {
  tryExtractTableRunAt,
  evaluatePublisherTable,
  normalizeRowToCsv
} = require("../server/utils/tableDetect");

describe("tableDetect", () => {
  test("detects pipe-delimited vacancy grid", () => {
    const lines = ["Post | Category | Vacancy", "IAS | General | 200", "IFS | OBC | 50"];
    const run = tryExtractTableRunAt(lines, 0);
    expect(run).not.toBeNull();
    expect(run.csvBody).toContain("IAS, General, 200");
    expect(evaluatePublisherTable(run.csvBody).eligible).toBe(true);
  });

  test("detects numbered comma rows", () => {
    const lines = ["Post, Category, Count", "1. Clerk, UR, 100", "2. Peon, SC, 50"];
    const run = tryExtractTableRunAt(lines, 0);
    expect(run).not.toBeNull();
    expect(run.csvBody).toContain("Clerk, UR, 100");
    expect(normalizeRowToCsv("1. Peon, SC, 50", ",")).toBe("Peon, SC, 50");
  });

  test("quoted Indian amount grid via publisher table check", () => {
    const body = `Post,Category,Posts
Constable,General,"1,30,093"
Constable,OBC,"5,000"`;
    expect(evaluatePublisherTable(body).eligible).toBe(true);
  });

  test("raw paste with pipe table becomes Vacancy | table section", async () => {
    const raw = `SSC GD Constable 2026
Post | Category | Vacancy
Constable | UR | 13093
Constable | OBC | 5000
Apply Online https://ssc.nic.in`;
    const { result } = await processJobParse(raw);
    expect(result).toMatch(/\[Section: Vacancy \| table\]/i);
    expect(result).toContain("Constable, UR, 13093");
    const built = buildDynamicSectionsWithWarnings(result);
    expect(built.html).toContain("<table");
  });
});
