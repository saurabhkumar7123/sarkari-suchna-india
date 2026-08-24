"use strict";

/**
 * Stage 7 — conservative post/department wrap reconstruction + leftover residue.
 * Does not enable AUTO_DRAFT.
 */

const fs = require("fs");
const path = require("path");

const {
  parseAllocationGridRow,
  compileAllocationGridBlocks,
  compileVacancySectionBlocks,
  compilePostDepartmentBlocks,
  joinPostDepartmentWrapLines,
  stripLeftoverCutoffResidue
} = require("../server/utils/reconstructDelimiterLessVacancy");
const { tryExtractTableRunAt, looksLikePostCodeDepartmentLine } = require("../server/utils/tableDetect");
const { softCleanForStructuring } = require("../server/lib/generatorIntelligence/textNormalization");
const { runGeneratorIntelligencePipeline } = require("../server/lib/generatorIntelligence");
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

describe("Stage 7 — TEST A L01–L03 source recovery", () => {
  test("tribunal post-code rows survive softClean; comma orgs are not a CSV table", () => {
    const tribunal = "L01 LDC/JSA Central Administrative Tribunal";
    expect(softCleanForStructuring(`${tribunal}\nWrit petition before the tribunal was dismissed by the court.`)).toMatch(
      /L01 LDC\/JSA Central Administrative Tribunal/
    );
    expect(softCleanForStructuring("The writ petition before the tribunal was dismissed after lengthy argument.")).not.toMatch(
      /writ petition before the tribunal/
    );

    const commaRows = [
      "L02 LDC/JSA Department of Internal Security, Intelligence Bureau",
      "L03 LDC/JSA Department of Science and Technology, Ministry of Science & Technology"
    ];
    expect(looksLikePostCodeDepartmentLine(commaRows[0])).toBe(true);
    expect(tryExtractTableRunAt(commaRows, 0)).toBeNull();
  });

  test("real source L01–L03 appear in Vacancy as table or prose", () => {
    if (!fs.existsSync(REAL_457)) return;
    const src = fs.readFileSync(REAL_457, "utf8");
    expect(src).toMatch(/L01 LDC\/JSA Central Administrative Tribunal/);
    expect(src).toMatch(/L02 LDC\/JSA Department of Internal Security, Intelligence Bureau/);
    expect(src).toMatch(/L03 LDC\/JSA Department of Science and Technology, Ministry of Science & Technology/);

    const { result } = runGeneratorIntelligencePipeline(src);
    const vacancy = sectionBody(result, "Vacancy");
    expect(vacancy).toMatch(/L01\b[\s\S]{0,80}Central Administrative Tribunal/);
    expect(vacancy).toMatch(/L02\b[\s\S]{0,120}Intelligence Bureau/);
    expect(vacancy).toMatch(/L03\b[\s\S]{0,160}Science and Technology/);
  });
});

describe("Stage 7 — TEST B unambiguous wrapped row compiles", () => {
  test("wrap join plus comma-free org-start compiles a 3-column table", () => {
    const lines = [
      "L17 LDC/JSA Ministry of Electronics and Information Technology",
      "L26 LDC/JSA",
      "Ministry of Civil Aviation",
      "L27 LDC/JSA",
      "Ministry of Information & Broadcasting"
    ];
    const joined = joinPostDepartmentWrapLines(lines);
    expect(joined).toContain("L26 LDC/JSA Ministry of Civil Aviation");
    const blocks = compilePostDepartmentBlocks(lines);
    const table = blocks.find((b) => b.type === "table");
    expect(table).toBeTruthy();
    expect(table.rows[0]).toEqual(["Code", "Post Name", "Organization/Ministry Name"]);
    expect(table.outputRows).toBe(3);
    expect(table.csvBody).toMatch(/L26, LDC\/JSA, Ministry of Civil Aviation/);
    expect(table.csvBody).toMatch(/L27, LDC\/JSA, Ministry of Information & Broadcasting/);
    const wrappedPost = joinPostDepartmentWrapLines([
      "L20 Junior Passport",
      "Assistant",
      "Staff Selection Commission"
    ]);
    expect(wrappedPost).toContain("L20 Junior Passport Assistant Staff Selection Commission");
  });
});

describe("Stage 7 — TEST C ambiguous wrapped row remains prose", () => {
  test("truncated org and incomplete continuation stay prose", () => {
    const lines = [
      "L24 LDC/JSA Department of Defence Directorate of Public Relations, Ministry of",
      "D55 DEO/DEO Grade",
      "D56 DEO/DEO Grade"
    ];
    const blocks = compilePostDepartmentBlocks(lines);
    expect(blocks.some((b) => b.type === "table")).toBe(false);
    const prose = blocks.map((b) => b.text || "").join("\n");
    expect(prose).toMatch(/Ministry of$/m);
    expect(prose).toMatch(/D55 DEO\/DEO Grade/);
    expect(prose).not.toMatch(/invent/i);
  });
});

describe("Stage 7 — TEST D comma-containing organization remains safe", () => {
  test("comma inside org is not treated as a column delimiter", () => {
    const line = "L02 LDC/JSA Department of Internal Security, Intelligence Bureau";
    const naiveParts = line.split(",").map((p) => p.trim());
    expect(naiveParts.length).toBe(2);

    const blocks = compilePostDepartmentBlocks([
      "L01 LDC/JSA Central Administrative Tribunal",
      line,
      "L03 LDC/JSA Department of Science and Technology, Ministry of Science & Technology"
    ]);
    const table = blocks.find((b) => b.type === "table");
    expect(table).toBeTruthy();
    expect(table.csvBody).toMatch(
      /L02, LDC\/JSA, "Department of Internal Security, Intelligence Bureau"/
    );
    expect(table.csvBody).toMatch(
      /L03, LDC\/JSA, "Department of Science and Technology, Ministry of Science & Technology"/
    );
    expect(table.rows[2][2]).toBe("Department of Internal Security, Intelligence Bureau");
    expect(table.rows[2][2].split(",").length).toBeGreaterThan(1);
  });
});

describe("Stage 7 — TEST E typing/skill remains prose unless structured", () => {
  test("percent rows without an unambiguous header stay prose", () => {
    const lines = [
      "Cut-off on 10% 10% 10% 10% 10% 10% 10% 10% 10% 7%",
      "Cut-off on percentage of mistakes 7% 7% 7% 7% 7% 7% 7% 7% 7% 5%"
    ];
    const blocks = compileVacancySectionBlocks(lines) || compilePostDepartmentBlocks(lines);
    const tables = (blocks || []).filter((b) => b.type === "table");
    expect(tables.length).toBe(0);
    const prose = (blocks || []).map((b) => b.text || b.csvBody || "").join("\n");
    expect(prose).toMatch(/10%/);
    expect(prose).toMatch(/7%/);
  });
});

describe("Stage 7 — TEST F cut-off residue duplicate detection", () => {
  test("second garbled header/intro is removed by a general residue rule", () => {
    const lines = [
      "(i) Category-wise cut-off in Section III of Session-I (i.e. CKT) is as follows:",
      "#01 EWS candidates of horizontal categories qualified against unreserved (UR) vacancies.",
      "later unique post text",
      "( i) Category-wise cut-off in Section III of Session-I (i.e. CKT) is as follows:",
      "SC ST OBC EWS ESM OH HH VH PWD-UR",
      "Others",
      "SC ST OBC EWS ESM OH HH VH PWD- | UR",
      "# 01 EWS candidates of horizontal categories qualified against unreserved (UR) vacancies."
    ];
    const { kept, removed } = stripLeftoverCutoffResidue(lines);
    const keptText = kept.join("\n");
    expect(keptText).toMatch(/later unique post text/);
    expect(kept.filter((l) => /category-wise cut-off/i.test(l)).length).toBe(1);
    expect(removed.some((r) => r.reason === "duplicate-cutoff-intro")).toBe(true);
    expect(removed.some((r) => r.reason === "degraded-category-header")).toBe(true);
    expect(removed.some((r) => r.reason === "duplicate-footnote")).toBe(true);
    const later = stripLeftoverCutoffResidue(
      ["( i) Category-wise cut-off in Section III of Session-I (i.e. CKT) is as follows:"],
      "(i) Category-wise cut-off in Section III of Session-I (i.e. CKT) is as follows:"
    );
    expect(later.kept.length).toBe(0);
    expect(later.removed[0].reason).toBe("duplicate-cutoff-intro");
  });
});

describe("Stage 7 — TEST G non-duplicate residue is preserved", () => {
  test("unique percent cut-off line is not deleted", () => {
    const { kept, removed } = stripLeftoverCutoffResidue([
      "(i) Category-wise cut-off in Section III of Session-I (i.e. CKT) is as follows:",
      "SC ST OBC EWS ESM OH HH VH PWD- | UR",
      "Cut-off on 10% 10% 10% 10% 10% 10% 10% 10% 10% 7%",
      "unique footnote about withheld roll numbers 325160371803"
    ]);
    expect(kept.join("\n")).toMatch(/Cut-off on 10%/);
    expect(kept.join("\n")).toMatch(/withheld roll numbers/);
    expect(removed.some((r) => /10%/.test(r.line))).toBe(false);
  });
});

describe("Stage 7 — TEST H Grid A remains 339×8", () => {
  test("allocation compiler output is unchanged in shape and sample cells", () => {
    if (!fs.existsSync(REAL_457)) return;
    const src = fs.readFileSync(REAL_457, "utf8");
    const matching = src
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => parseAllocationGridRow(l));
    expect(matching.length).toBe(339);

    const compiled = compileAllocationGridBlocks(src.split(/\r?\n/));
    const table = compiled.find((b) => b.type === "table");
    expect(table.rows.length).toBe(340);
    expect(table.rows[0].length).toBe(8);
    expect(table.rows[1]).toEqual(["D54", "UR", "6", "5", "211", "119", "171.67478", "30-12-2002"]);

    const { result } = runGeneratorIntelligencePipeline(src);
    const vacancy = sectionBody(result, "Vacancy");
    const parsed = parseSectionBlocks(vacancy);
    const grid = parsed.blocks.find((t) => t.type === "table" && /Date of Birth/.test(t.content));
    const dataRows = String(grid.content).split("\n").filter(Boolean).slice(1);
    expect(dataRows.length).toBe(339);
    expect(dataRows[0].split(",").length).toBe(8);
  });
});

describe("Stage 7 — TEST I Important Dates remains clean", () => {
  test("no candidate DOBs; event dates remain", () => {
    if (!fs.existsSync(REAL_457)) return;
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

describe("Stage 7 — TEST J mixed renderer", () => {
  test("paragraph + table + comma cell + empty cell render without swallowing prose", () => {
    const body = [
      "Post-wise allocation is given below.",
      "---table---",
      "Code, Category, Vacancy, Allocated, Total Marks, Marks in Section-I of Tier-II, Marks in Tier-I, Date of Birth",
      "D54, UR, 6, 5, 211, 119, 171.67478, 30-12-2002",
      "D54, SC, 3, 0, *, *, *, *",
      "---endtable---",
      "Typing cut-off remains explanatory prose 10% / 7%.",
      "---table---",
      "Code, Post Name, Organization/Ministry Name",
      "L17, LDC/JSA, Ministry of Electronics and Information Technology",
      "---endtable---",
      "Ambiguous comma rows stay as sentences."
    ].join("\n");
    const parsed = parseSectionBlocks(body);
    expect(parsed.blocks.map((b) => b.type)).toEqual(["text", "table", "text", "table", "text"]);

    const html = buildMixedSectionHtml(body, "Vacancy");
    expect(html).toMatch(/<table/);
    expect(html).toMatch(/Post-wise allocation/);
    expect(html).toMatch(/Typing cut-off remains explanatory prose/);
    expect(html).toMatch(/Ambiguous comma rows stay as sentences/);
    expect(html).not.toMatch(/---table---/);
    expect(html).toMatch(/<th>/);

    const tableHtml = buildTable(parsed.blocks[1].content);
    expect((tableHtml.match(/<th>/g) || []).length).toBe(8);
    expect(tableHtml).toMatch(/<td><\/td>/);
  });
});

describe("Stage 7 — TEST K 458 regression", () => {
  test("sitting notice has no Vacancy; keeps Notification Details and 23rd August 2026", () => {
    if (!fs.existsSync(REAL_458)) return;
    const src = fs.readFileSync(REAL_458, "utf8");
    const { result } = runGeneratorIntelligencePipeline(src);
    expect(result).not.toMatch(/\[Section:\s*Vacancy/i);
    expect(result).toMatch(/\[Section:\s*Notification Details\]/i);
    expect(result).toMatch(/23rd August,? 2026/i);
  });
});

describe("Stage 7 — AUTO_DRAFT remains off", () => {
  test(
    "flags stay off",
    withoutOpenAi(async () => {
      expect(getAutomationFlags().AUTO_DRAFT_ENABLED).toBe(false);
      expect(getAutomationFlags().AUTO_PUBLISH_ENABLED).toBe(false);
    })
  );
});
