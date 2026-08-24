"use strict";

/**
 * Stage 8 — scoped comma-safe Post/Department tables.
 * Does not enable AUTO_DRAFT.
 */

const fs = require("fs");
const path = require("path");

const {
  parseAllocationGridRow,
  compilePostDepartmentBlocks
} = require("../server/utils/reconstructDelimiterLessVacancy");
const { parseTableContent } = require("../generator/lib/csvGridParser");
const { buildTable } = require("../generator/builders/tableBuilder");
const { runGeneratorIntelligencePipeline } = require("../server/lib/generatorIntelligence");
const { parseSectionBlocks } = require("../generator/parse/sectionBlocks");
const { getAutomationFlags } = require("../server/config/automationFlags");

const REAL_457 = path.join(__dirname, "..", "..", "scripts", "tmp-stage2-out", "update-457.txt");
const REAL_458 = path.join(__dirname, "..", "..", "scripts", "tmp-stage2-out", "update-458.txt");

function sectionBody(publisher, title) {
  const escaped = String(title).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `\\[Section:\\s*${escaped}(?:\\s*\\|\\s*table)?\\]([\\s\\S]*?)(?=\\n\\[Section:|$)`,
    "i"
  );
  const m = String(publisher || "").match(re);
  return m ? m[1].trim() : "";
}

function postDeptTables(publisher) {
  const vacancy = sectionBody(publisher, "Vacancy");
  return parseSectionBlocks(vacancy)
    .blocks.filter((b) => b.type === "table" && /Organization\/Ministry/i.test(b.content))
    .map((b) => parseTableContent(b.content));
}

describe("Stage 8 — TEST A comma organization remains one cell", () => {
  test("quoted org comma does not create an extra column", () => {
    const blocks = compilePostDepartmentBlocks([
      "L02 LDC/JSA Department of Internal Security, Intelligence Bureau",
      "L03 LDC/JSA Department of Science and Technology, Ministry of Science & Technology"
    ]);
    const table = blocks.find((b) => b.type === "table");
    expect(table.rows[0].length).toBe(3);
    expect(table.rows[1].length).toBe(3);
    expect(table.csvBody).toMatch(/^L02, LDC\/JSA, "/m);

    const parsed = parseTableContent(table.csvBody);
    expect(parsed.parser).toBe("v2");
    expect(parsed.rows[1]).toEqual([
      "L02",
      "LDC/JSA",
      "Department of Internal Security, Intelligence Bureau"
    ]);
    const html = buildTable(table.csvBody);
    expect(html).toMatch(/Department of Internal Security, Intelligence Bureau/);
    expect((html.match(/<td>/g) || []).length).toBe(6);
  });
});

describe("Stage 8 — TEST B/C/D L01–L03", () => {
  test("L02/L03 compile with org commas intact; L01 table or prose", () => {
    if (!fs.existsSync(REAL_457)) return;
    const src = fs.readFileSync(REAL_457, "utf8");
    const { result } = runGeneratorIntelligencePipeline(src);
    const vacancy = sectionBody(result, "Vacancy");
    const tables = postDeptTables(result);
    const cells = tables.flatMap((t) => t.rows.slice(1));
    const l02 = cells.find((r) => r[0] === "L02");
    const l03 = cells.find((r) => r[0] === "L03");
    expect(l02).toEqual(["L02", "LDC/JSA", "Department of Internal Security, Intelligence Bureau"]);
    expect(l03).toEqual([
      "L03",
      "LDC/JSA",
      "Department of Science and Technology, Ministry of Science & Technology"
    ]);
    expect(l02[2].includes(",")).toBe(true);
    expect(l03[2].includes(",")).toBe(true);
    const l01Table = cells.find((r) => r[0] === "L01");
    if (l01Table) {
      expect(l01Table).toEqual(["L01", "LDC/JSA", "Central Administrative Tribunal"]);
    } else {
      expect(vacancy).toMatch(/L01 LDC\/JSA Central Administrative Tribunal/);
    }
  });
});

describe("Stage 8 — TEST E/F/G Grid A", () => {
  test("339×8 preserved; 0 invented/shifted/dropped", () => {
    if (!fs.existsSync(REAL_457)) return;
    const src = fs.readFileSync(REAL_457, "utf8");
    const matching = src.split(/\r?\n/).map((l) => l.trim()).filter((l) => parseAllocationGridRow(l));
    expect(matching.length).toBe(339);

    const { result } = runGeneratorIntelligencePipeline(src);
    const vacancy = sectionBody(result, "Vacancy");
    const grid = parseSectionBlocks(vacancy).blocks.find(
      (t) => t.type === "table" && /Date of Birth/.test(t.content)
    );
    const parsed = parseTableContent(grid.content);
    const data = parsed.rows.slice(1);
    expect(parsed.rows[0].length).toBe(8);
    expect(data.length).toBe(339);
    expect(data[0]).toEqual(["D54", "UR", "6", "5", "211", "119", "171.67478", "30-12-2002"]);
    expect(data.every((r) => r.length === 8)).toBe(true);
  });
});

describe("Stage 8 — TEST H Important Dates", () => {
  test("no DOBs; event dates remain", () => {
    if (!fs.existsSync(REAL_457)) return;
    const { result } = runGeneratorIntelligencePipeline(fs.readFileSync(REAL_457, "utf8"));
    const dates = sectionBody(result, "Important Dates");
    expect(dates.length).toBeLessThan(2000);
    expect(dates).not.toMatch(/30-12-2002/);
    expect(dates).not.toMatch(/24-08-2004/);
    expect(dates).toMatch(/27\.02\.2026|27 February 2026/);
  });
});

describe("Stage 8 — TEST I 458 regression", () => {
  test("no Vacancy; Notification Details; 23rd August 2026", () => {
    if (!fs.existsSync(REAL_458)) return;
    const { result } = runGeneratorIntelligencePipeline(fs.readFileSync(REAL_458, "utf8"));
    expect(result).not.toMatch(/\[Section:\s*Vacancy/i);
    expect(result).toMatch(/\[Section:\s*Notification Details\]/i);
    expect(result).toMatch(/23rd August,? 2026/i);
  });
});

describe("Stage 8 — AUTO_DRAFT remains off", () => {
  test("flags stay off", () => {
    expect(getAutomationFlags().AUTO_DRAFT_ENABLED).toBe(false);
    expect(getAutomationFlags().AUTO_PUBLISH_ENABLED).toBe(false);
  });
});
