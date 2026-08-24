"use strict";

/**
 * Stage 5 — allocation-grid table compilation.
 * Compiles only confidently reconstructable delimiter-less allocation rows.
 * Does not enable AUTO_DRAFT.
 */

const fs = require("fs");
const path = require("path");

const {
  parseAllocationGridRow,
  compileAllocationGridBlocks
} = require("../server/utils/reconstructDelimiterLessVacancy");
const {
  runGeneratorIntelligencePipeline
} = require("../server/lib/generatorIntelligence");
const { parseSectionBlocks } = require("../generator/parse/sectionBlocks");
const { SAMPLES } = require("./fixtures/ai1/notificationSamples");

const REAL_457 = path.join(__dirname, "..", "..", "scripts", "tmp-stage2-out", "update-457.txt");

function withoutOpenAi(fn) {
  return async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      await fn();
    } finally {
      if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    }
  };
}

function sectionBody(publisher, title) {
  const escaped = String(title).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `\\[Section:\\s*${escaped}(?:\\s*\\|\\s*table)?\\]([\\s\\S]*?)(?=\\n\\[Section:|$)`,
    "i"
  );
  const m = String(publisher || "").match(re);
  return m ? m[1].trim() : "";
}

describe("Stage 5 — allocation grid parser", () => {
  test("parses a complete last-selected row and a nil last-selected row", () => {
    expect(parseAllocationGridRow("D54 UR 6 5 211 119 171.67478 30-12-2002")).toEqual([
      "D54",
      "UR",
      "6",
      "5",
      "211",
      "119",
      "171.67478",
      "30-12-2002"
    ]);
    expect(parseAllocationGridRow("D54 SC 3 0 - - - -")).toEqual([
      "D54",
      "SC",
      "3",
      "0",
      "-",
      "-",
      "-",
      "-"
    ]);
  });

  test("rejects garbled wrapped duplicates and does not invent values", () => {
    expect(parseAllocationGridRow("D54 EWS 169.91555 --2003")).toBeNull();
    expect(parseAllocationGridRow("D54 UR 6 5 211 119 171.67478 30 -12 -2002")).toBeNull();
    expect(parseAllocationGridRow("S. | Name of Examination")).toBeNull();
  });

  test("compiles a confident run to CSV and keeps surrounding prose", () => {
    const lines = [
      "Post-wise allocation is given below.",
      "D54 UR 6 5 211 119 171.67478 30-12-2002",
      "D54 SC 3 0 - - - -",
      "D54 ST 1 0 - - - -",
      "Note: nil vacancy rows were omitted."
    ];
    const blocks = compileAllocationGridBlocks(lines);
    expect(blocks).not.toBeNull();
    const table = blocks.find((b) => b.type === "table");
    expect(table.csvBody).toMatch(/^Code, Category, Vacancy, Allocated/);
    expect(table.csvBody).toMatch(/D54, UR, 6, 5, 211, 119, 171\.67478, 30-12-2002/);
    expect(table.csvBody).toMatch(/D54, SC, 3, 0, \*, \*, \*, \*/);
    expect(table.rows.length).toBe(4);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[0].text).toMatch(/Post-wise allocation/);
    expect(blocks[blocks.length - 1].text).toMatch(/nil vacancy/);
    expect(table.csvBody).not.toMatch(/7, 5/);
  });
});

describe("Stage 5 — real 457 extract", () => {
  const hasFile = fs.existsSync(REAL_457);

  test("source has a reconstructable allocation-grid run", () => {
    if (!hasFile) return;
    const src = fs.readFileSync(REAL_457, "utf8");
    const matching = src
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => parseAllocationGridRow(l));
    expect(matching.length).toBeGreaterThanOrEqual(300);
    expect(matching[0]).toMatch(/^D54 UR 6 5/);
  });

  test("pipeline compiles the grid without sending DOBs to Important Dates", () => {
    if (!hasFile) return;
    const src = fs.readFileSync(REAL_457, "utf8");
    const { result, structured, validation } = runGeneratorIntelligencePipeline(src);
    expect(validation.ok).toBe(true);

    const dates = sectionBody(result, "Important Dates");
    expect(dates.length).toBeLessThan(2000);
    expect(dates).not.toMatch(/30-12-2002/);
    expect(dates).not.toMatch(/24-08-2004/);
    expect(dates).toMatch(/27\.02\.2026|27 February 2026/);

    const vacancy = sectionBody(result, "Vacancy");
    expect(vacancy).toMatch(/---table---/);
    expect(vacancy).toMatch(/---endtable---/);
    expect(result).not.toMatch(/\[Section:\s*Vacancy\s*\|\s*table\]/i);

    const parsed = parseSectionBlocks(vacancy);
    const tables = parsed.blocks.filter((b) => b.type === "table");
    expect(tables.length).toBeGreaterThanOrEqual(1);
    const csv = tables.map((t) => t.content).find((c) => /Date of Birth/.test(c)) || tables[0].content;
    const dataRows = csv.split("\n").filter(Boolean).slice(1);
    expect(dataRows.length).toBeGreaterThanOrEqual(300);
    expect(csv).toMatch(/D54, UR, 6, 5, 211, 119, 171\.67478, 30-12-2002/);
    expect(csv).toMatch(/D54, SC, 3, 0, \*, \*, \*, \*/);
    expect(csv).not.toMatch(/169\.91555, --2003/);

    const vacSec = structured.sections.find((s) => s.sectionType === "vacancy_details");
    expect(vacSec.forceTable).toBe(false);
    expect((vacSec.blocks || []).some((b) => b.type === "table")).toBe(true);
  });
});

describe("Stage 5 — 458 / recruitment sample regression", () => {
  test("departmental sitting notice still has no vacancy table", () => {
    const sitting = `Staff Selection Commission (NR)
IMPORTANT NOTICE
The Commission has decided to conduct following examinations at Delhi on 23
rd
August,
2026.
S. | Name of Examination
1. Assistant Section Officer / Assistant Grade Limited Departmental Competitive Examination, 2025
The candidates are advised to visit the website of the Commission at regular intervals.`;
    const { result } = runGeneratorIntelligencePipeline(sitting);
    expect(result).not.toMatch(/\[Section:\s*Vacancy/i);
    expect(result).toMatch(/23rd August,? 2026/i);
    expect(result).toMatch(/\[Section:\s*Notification Details\]/i);
  });

  test("SSC GD sample still uses Vacancy | table for delimited grids", () => {
    const { result } = runGeneratorIntelligencePipeline(SAMPLES.SSC);
    expect(result).toMatch(/\[Section:\s*Vacancy/i);
    expect(result).toMatch(/Constable GD/);
  });
});

describe("Stage 5 — AUTO_DRAFT remains off", () => {
  test(
    "flags stay off",
    withoutOpenAi(async () => {
      const { getAutomationFlags } = require("../server/config/automationFlags");
      expect(getAutomationFlags().AUTO_DRAFT_ENABLED).toBe(false);
    })
  );
});
