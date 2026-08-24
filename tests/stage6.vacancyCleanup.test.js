"use strict";

/**
 * Stage 6 — remaining vacancy cleanup (duplicate-noise, post/dept, cut-off).
 * Does not enable AUTO_DRAFT.
 */

const fs = require("fs");
const path = require("path");

const {
  parseAllocationGridRow,
  compileAllocationGridBlocks,
  compileVacancySectionBlocks,
  compileCategoryMatrixBlocks,
  compilePostDepartmentBlocks,
  analyzeDuplicatePdfExtractionNoise,
  stripDuplicatePdfExtractionNoise
} = require("../server/utils/reconstructDelimiterLessVacancy");
const {
  runGeneratorIntelligencePipeline
} = require("../server/lib/generatorIntelligence");
const { parseSectionBlocks } = require("../generator/parse/sectionBlocks");
const { buildMixedSectionHtml } = require("../generator/builders/mixedSectionBuilder");
const { buildTable } = require("../generator/builders/tableBuilder");
const { getAutomationFlags } = require("../server/config/automationFlags");

const REAL_457 = path.join(__dirname, "..", "..", "scripts", "tmp-stage2-out", "update-457.txt");
const REAL_458 = path.join(__dirname, "..", "..", "scripts", "tmp-stage2-out", "update-458.txt");

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

function makeCleanGrid(codeCount) {
  const lines = [];
  for (let i = 1; i <= codeCount; i += 1) {
    const code = `L${String(i).padStart(2, "0")}`;
    lines.push(`${code} UR ${i} ${i} ${200 + i} ${100 + i} ${150 + i}.12345 01-01-2000`);
    lines.push(`${code} SC ${i} 0 - - - -`);
  }
  return lines;
}

function makeDegradedFromClean(cleanLines) {
  return cleanLines.map((line) => {
    const cells = parseAllocationGridRow(line);
    if (!cells) return line;
    if (cells[4] === "-") return `${cells[0]} ${cells[1]} - - - -`;
    const dob = String(cells[7]).replace(/-/g, " -");
    return `${cells[0]} ${cells[1]} ${cells[2]} ${cells[3]} ${cells[4]} ${cells[5]} ${cells[6]} ${dob}`;
  });
}

describe("Stage 6 — TEST A duplicate grid detection", () => {
  test("valid Grid A is retained and degraded duplicate is classified as noise", () => {
    const clean = makeCleanGrid(12);
    const garbled = makeDegradedFromClean(clean);
    const compiled = compileAllocationGridBlocks(clean);
    expect(compiled).not.toBeNull();
    const table = compiled.find((b) => b.type === "table");
    expect(table.rows.length).toBe(25);
    garbled.forEach((line) => expect(parseAllocationGridRow(line)).toBeNull());

    const analysis = analyzeDuplicatePdfExtractionNoise(
      ["Code Category Vacancy Allocated Marks | of Tier", ...garbled],
      table.rows.slice(1)
    );
    expect(analysis.classified).toBe(true);
    expect(analysis.class).toBe("DUPLICATE_PDF_EXTRACTION_NOISE");
    expect(analysis.confidence).toBeGreaterThanOrEqual(0.75);

    const mixed = ["intro", ...clean, "Note after grid", ...garbled];
    const blocks = compileVacancySectionBlocks(mixed);
    const tables = blocks.filter((b) => b.type === "table");
    expect(tables.length).toBe(1);
    expect(tables[0].rows.length).toBe(25);
    const prose = blocks
      .filter((b) => b.type === "paragraph")
      .map((b) => b.text)
      .join("\n");
    expect(prose).toMatch(/intro/);
    expect(prose).toMatch(/Note after grid/);
    expect(prose).not.toMatch(/01 -01 -2000/);
  });

  test("skipped post-code still counts as duplicate when remaining order agrees", () => {
    const clean = makeCleanGrid(12);
    const garbled = makeDegradedFromClean(clean).filter((line) => !/^L03\b/.test(line));
    const compiled = compileAllocationGridBlocks(clean);
    const analysis = analyzeDuplicatePdfExtractionNoise(garbled, compiled.find((b) => b.type === "table").rows.slice(1));
    expect(analysis.classified).toBe(true);
    expect(analysis.class).toBe("DUPLICATE_PDF_EXTRACTION_NOISE");
  });
});

describe("Stage 6 — TEST B non-duplicate safety", () => {
  test("similar-looking but materially different data is not deleted", () => {
    const clean = makeCleanGrid(12);
    const other = [];
    for (let i = 1; i <= 12; i += 1) {
      const code = `M${String(i).padStart(2, "0")}`;
      other.push(`${code} UR ${90 + i} ${90 + i} 111 50 10.0 02 -02 -1990`);
      other.push(`${code} SC - - - -`);
    }
    const compiled = compileAllocationGridBlocks(clean);
    const analysis = analyzeDuplicatePdfExtractionNoise(other, compiled.find((b) => b.type === "table").rows.slice(1));
    expect(analysis.classified).toBe(false);

    const stripped = stripDuplicatePdfExtractionNoise(other, compiled.find((b) => b.type === "table").rows.slice(1));
    expect(stripped.kept.join("\n")).toMatch(/M01 UR/);
    expect(stripped.removed.length).toBe(0);
  });
});

describe("Stage 6 — TEST C wrapped post/department", () => {
  test("unambiguous comma-free rows compile; ambiguous/comma rows remain prose", () => {
    const lines = [
      "Code Post Name Organization/Ministry Name",
      "L01 LDC/JSA Central Administrative Tribunal",
      "L02 LDC/JSA Intelligence Bureau",
      "L03 LDC/JSA",
      "Ministry of Mines",
      "L04 LDC/JSA Department of Defence, Canteen Stores Department",
      "L24 LDC/JSA Department of Defence Ministry of",
      "L25 LDC/JSA Ministry of Tourism"
    ];
    const blocks = compilePostDepartmentBlocks(lines);
    const tables = blocks.filter((b) => b.type === "table");
    expect(tables.length).toBe(1);
    expect(tables[0].rows[0]).toEqual(["Code", "Post Name", "Organization/Ministry Name"]);
    expect(tables[0].outputRows).toBe(4);
    expect(tables[0].csvBody).toMatch(/L01, LDC\/JSA, Central Administrative Tribunal/);
    expect(tables[0].csvBody).toMatch(/L03, LDC\/JSA, Ministry of Mines/);
    expect(tables[0].csvBody).toMatch(/L04, LDC\/JSA, "Department of Defence, Canteen Stores Department"/);
    const prose = blocks
      .filter((b) => b.type === "paragraph")
      .map((b) => b.text)
      .join("\n");
    expect(prose).not.toMatch(/Canteen Stores Department/);
    expect(prose).toMatch(/Ministry of$/m);
    expect(prose).toMatch(/L25 LDC\/JSA Ministry of Tourism/);
  });
});

describe("Stage 6 — TEST D cut-off / recommended matrix", () => {
  test("confident matrix compiles; mismatched columns remain prose; mixed units stay split", () => {
    const confident = [
      "EWS SC ST OBC UR Total ESM OH HH VH PwDOthers",
      "Vacancies 337 490 252 768 1675 3522 301 35 43 39 37",
      "Candidates recommended 337# 487 251 766 1674* 3515 300 35 42 39 37"
    ];
    const ok = compileCategoryMatrixBlocks(confident);
    const table = ok.find((b) => b.type === "table");
    expect(table).toBeTruthy();
    expect(table.rows[0].length).toBe(12);
    expect(table.outputRows).toBe(2);
    expect(table.csvBody).toMatch(/Vacancies, 337, 490, 252/);
    expect(table.csvBody).toMatch(/1674\*/);
    expect(table.csvBody).not.toMatch(/invent/i);

    const mixedUnits = [
      "SC ST OBC EWS ESM OH HH VH PWDOthers UR",
      "Cut-off marks 9 9 11.25 11.25 9 9 9 9 9 13.5",
      "Cut-off on percentage of mistakes 7% 7% 7% 7% 7% 7% 7% 7% 7% 5%"
    ];
    const mixed = compileCategoryMatrixBlocks(mixedUnits);
    const mixedTable = mixed.find((b) => b.type === "table");
    expect(mixedTable.outputRows).toBe(1);
    expect(mixedTable.csvBody).toMatch(/Cut-off marks, 9, 9, 11.25/);
    expect(mixed.filter((b) => b.type === "paragraph").map((b) => b.text).join("\n")).toMatch(/7%/);

    const ambiguous = [
      "SC ST OBC EWS ESM OH HH VH PWDOthers UR",
      "Vacancies 337 490 252 768"
    ];
    const no = compileCategoryMatrixBlocks(ambiguous);
    expect(no.some((b) => b.type === "table")).toBe(false);
    expect(no[0].text).toMatch(/Vacancies 337 490 252 768/);
  });
});

describe("Stage 6 — TEST E Grid A preservation", () => {
  const hasFile = fs.existsSync(REAL_457);

  test("339 rows and 8 columns remain with no value shifts", () => {
    if (!hasFile) return;
    const src = fs.readFileSync(REAL_457, "utf8");
    const matching = src
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => parseAllocationGridRow(l));
    expect(matching.length).toBe(339);

    const { result, structured } = runGeneratorIntelligencePipeline(src);
    const vacancy = sectionBody(result, "Vacancy");
    const parsed = parseSectionBlocks(vacancy);
    const tables = parsed.blocks.filter((b) => b.type === "table");
    const grid = tables.find((t) => /Code, Category, Vacancy, Allocated/.test(t.content));
    expect(grid).toBeTruthy();
    const dataRows = String(grid.content)
      .split("\n")
      .filter(Boolean)
      .slice(1);
    expect(dataRows.length).toBe(339);
    expect(dataRows[0].split(",").length).toBe(8);
    expect(dataRows[0]).toMatch(/D54, UR, 6, 5, 211, 119, 171\.67478, 30-12-2002/);
    expect(dataRows[1]).toMatch(/D54, SC, 3, 0, \*, \*, \*, \*/);
    expect(grid.content).not.toMatch(/169\.91555, --2003/);

    const vacSec = structured.sections.find((s) => s.sectionType === "vacancy_details");
    const allocTable = (vacSec.blocks || []).find(
      (b) => b.type === "table" && /Date of Birth/.test(String(b.csvBody || ""))
    );
    expect(allocTable.rows.length).toBe(340);
    expect(allocTable.rows[0].length).toBe(8);
    expect(vacancy).not.toMatch(/30 -12 -2002/);
    expect(vacancy).not.toMatch(/169\.91555 --2003/);
    const allocTables = tables.filter((t) => /Date of Birth/.test(t.content));
    expect(allocTables.length).toBe(1);
  });
});

describe("Stage 6 — TEST F Important Dates regression", () => {
  const hasFile = fs.existsSync(REAL_457);

  test("DOBs stay out of date_list; event dates remain", () => {
    if (!hasFile) return;
    const src = fs.readFileSync(REAL_457, "utf8");
    const { result } = runGeneratorIntelligencePipeline(src);
    const dates = sectionBody(result, "Important Dates");
    expect(dates.length).toBeLessThan(2000);
    expect(dates).not.toMatch(/30-12-2002/);
    expect(dates).not.toMatch(/24-08-2004/);
    expect(dates).not.toMatch(/01 -01 -2000/);
    expect(dates).toMatch(/27\.02\.2026|27 February 2026/);
  });
});

describe("Stage 6 — TEST G mixed publisher rendering", () => {
  test("paragraph + table + paragraph markers render as HTML table", () => {
    const body = [
      "Post-wise allocation is given below.",
      "---table---",
      "Code, Category, Vacancy, Allocated, Total Marks, Marks in Section-I of Tier-II, Marks in Tier-I, Date of Birth",
      "D54, UR, 6, 5, 211, 119, 171.67478, 30-12-2002",
      "D54, SC, 3, 0, *, *, *, *",
      "---endtable---",
      "Rows with nil vacancies were omitted."
    ].join("\n");
    const parsed = parseSectionBlocks(body);
    expect(parsed.blocks.map((b) => b.type)).toEqual(["text", "table", "text"]);
    expect(parsed.blocks[1].content).toMatch(/Date of Birth/);

    const html = buildMixedSectionHtml(body, "Vacancy");
    expect(html).toMatch(/<table/);
    expect(html).toMatch(/<th>/);
    expect((html.match(/<tr>/g) || []).length).toBe(3);
    expect(html).toMatch(/D54/);
    expect(html).toMatch(/30-12-2002/);
    expect(html).toMatch(/Post-wise allocation/);
    expect(html).toMatch(/nil vacancies/);
    expect(html).not.toMatch(/---table---/);

    const tableHtml = buildTable(parsed.blocks[1].content);
    expect((tableHtml.match(/<th>/g) || []).length).toBe(8);
    expect(tableHtml).toMatch(/<td><\/td>/);
  });
});

describe("Stage 6 — TEST H 458 regression", () => {
  const hasFile = fs.existsSync(REAL_458);

  test("sitting notice has no Vacancy; keeps Notification Details and 23rd August 2026", () => {
    if (!hasFile) return;
    const src = fs.readFileSync(REAL_458, "utf8");
    const { result } = runGeneratorIntelligencePipeline(src);
    expect(result).not.toMatch(/\[Section:\s*Vacancy/i);
    expect(result).toMatch(/\[Section:\s*Notification Details\]/i);
    expect(result).toMatch(/23rd August,? 2026/i);
  });
});

describe("Stage 6 — AUTO_DRAFT remains off", () => {
  test(
    "flags stay off",
    withoutOpenAi(async () => {
      expect(getAutomationFlags().AUTO_DRAFT_ENABLED).toBe(false);
      expect(getAutomationFlags().AUTO_PUBLISH_ENABLED).toBe(false);
    })
  );
});
