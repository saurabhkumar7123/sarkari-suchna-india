"use strict";

const fs = require("fs");
const path = require("path");

const {
  detectByLineClassification,
  isVacancyGridRetainLine
} = require("../server/lib/generatorIntelligence/sectionDetection");
const { processJobParse } = require("../server/services/aiParseJob.service");
const { extractGeneratorPdfText } = require("../server/services/pdfGeneratorExtract.service");
const { reconstructDelimiterLessVacancyGrid } = require("../server/utils/reconstructDelimiterLessVacancy");

const REAL_FIXTURE = path.join(
  __dirname,
  "fixtures",
  "generator-pdf",
  "ssc-cht-tentative-vacancies-09072026.pdf"
);

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

function vacancySection(text) {
  const m = String(text || "").match(/\[Section:\s*Vacancy(?:\s*\|\s*table)?\][\s\S]*?(?=\n\[Section:|$)/i);
  return m ? m[0] : "";
}

describe("Fail-safe vacancy grid line retention", () => {
  test("1. flattened / merged grid lines are identified for Vacancy retention", () => {
    expect(isVacancyGridRetainLine("Post Name")).toBe(true);
    expect(isVacancyGridRetainLine("Pay Level URSCST OBC EWS Total OH HH VH")).toBe(true);
    expect(isVacancyGridRetainLine("Level-71100020000YES")).toBe(true);
    expect(isVacancyGridRetainLine("Online Apply Start Date : 04 September 2025")).toBe(false);
    expect(isVacancyGridRetainLine("For General / OBC / EWS : ₹ 125/-")).toBe(false);
    expect(isVacancyGridRetainLine("Apply Online https://ssc.nic.in")).toBe(false);
  });

  test("2. bucketing keeps ambiguous grid lines in vacancy, not other/salary", () => {
    const src = `Staff Selection Commission
Combined Hindi Translators Examination 2026
Online Apply Start Date : 04 September 2025
For General / OBC / EWS : Rs 125/-
Apply Online https://ssc.nic.in
Post Name
Pay Level URSCST OBC EWS Total OH HH VH
Senior Translator
Level-71100020000YES
Q: What is the last date?
A: 30 September 2025`;
    const { buckets } = detectByLineClassification(src);
    expect(buckets.vacancy.join("\n")).toContain("Post Name");
    expect(buckets.vacancy.join("\n")).toContain("Pay Level URSCST OBC EWS Total OH HH VH");
    expect(buckets.vacancy.join("\n")).toContain("Level-71100020000YES");
    expect(buckets.vacancy.join("\n")).toContain("Senior Translator");
    expect(buckets.other.join("\n")).not.toContain("Level-71100020000YES");
    expect(buckets.salary.join("\n")).not.toContain("Level-71100020000YES");
    expect(buckets.dates.join("\n")).toMatch(/04 September 2025/);
    expect(buckets.fee.join("\n")).toMatch(/125/);
    expect(buckets.links.join("\n")).toMatch(/ssc\.nic\.in/);
    expect(buckets.faq.join("\n")).toMatch(/last date/);
  });

  test(
    "3. AI Convert retains source grid lines without inventing a table",
    withoutOpenAi(async () => {
      const src = `Staff Selection Commission
Post Name
Pay Level URSCST OBC EWS Total OH HH VH
Level-71100020000YES
Online Apply Start Date : 04 September 2025`;
      expect(reconstructDelimiterLessVacancyGrid(src)).toBeNull();
      const { result } = await processJobParse(src);
      const vac = vacancySection(result);
      expect(vac).toBeTruthy();
      expect(vac).not.toMatch(/\[Section:\s*Vacancy\s*\|\s*table\]/i);
      expect(vac).toContain("Post Name");
      expect(vac).toContain("Pay Level URSCST OBC EWS Total OH HH VH");
      expect(vac).toContain("Level-71100020000YES");
      expect(vac).not.toMatch(/Level-7\s*\|\s*11/);
      expect(result).toMatch(/\[Section:\s*Important Dates\]/i);
      expect(result).toContain("04 September 2025");
    })
  );

  test(
    "4. real SSC fixture retains extracted vacancy-grid lines",
    withoutOpenAi(async () => {
      expect(fs.existsSync(REAL_FIXTURE)).toBe(true);
      const extracted = await extractGeneratorPdfText(fs.readFileSync(REAL_FIXTURE));
      const postName = (extracted.text.match(/^[^\n]*Post Name[^\n]*$/im) || [])[0];
      const mergedHeader = (extracted.text.match(/^[^\n]*URSCST[^\n]*$/im) || [])[0];
      const flattenedCell = (extracted.text.match(/^[^\n]*Level-71100020000YES[^\n]*$/im) || [])[0];
      expect(postName).toBeTruthy();
      expect(mergedHeader).toBeTruthy();
      expect(flattenedCell).toBeTruthy();
      expect(reconstructDelimiterLessVacancyGrid(extracted.text)).toBeNull();

      const { result } = await processJobParse(extracted.text);
      const vac = vacancySection(result);
      expect(vac).toBeTruthy();
      expect(vac).not.toMatch(/\[Section:\s*Vacancy\s*\|\s*table\]/i);
      expect(vac).toContain(postName.trim());
      expect(vac).toContain(mergedHeader.trim());
      expect(vac).toContain(flattenedCell.trim());
      expect(result).toMatch(/\[Section:\s*Short Information\]/);
      expect(vac).not.toMatch(/Level-7\s*\|\s*11/);
    }),
    120000
  );
});
