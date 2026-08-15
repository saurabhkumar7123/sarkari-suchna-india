"use strict";

const fs = require("fs");
const path = require("path");

const {
  applyCanonicalPublisherFormat
} = require("../server/utils/canonicalPublisherFormat");
const {
  reconstructDelimiterLessVacancyGrid
} = require("../server/utils/reconstructDelimiterLessVacancy");
const { processJobParse } = require("../server/services/aiParseJob.service");
const { extractGeneratorPdfText } = require("../server/services/pdfGeneratorExtract.service");

const REAL_FIXTURE = path.join(
  __dirname,
  "fixtures",
  "generator-pdf",
  "ssc-cht-tentative-vacancies-09072026.pdf"
);

function vacancyDoc(body) {
  return applyCanonicalPublisherFormat(`[Section: Vacancy]\n${body}`);
}

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

describe("Delimiter-less vacancy grid reconstruction", () => {
  test("1. deterministic delimiter-less pattern → table", () => {
    const src = `Post
Senior Translator
Category
UR
OBC
SC
ST
Vacancy
10
5
3
2`;
    const out = vacancyDoc(src);
    expect(out).toMatch(/\[Section: Vacancy \| table\]/);
    expect(out).toMatch(/Senior Translator.*UR.*10/);
    expect(out).toMatch(/Senior Translator.*OBC.*5/);
    expect(out).toMatch(/Senior Translator.*SC.*3/);
    expect(out).toMatch(/Senior Translator.*ST.*2/);
  });

  test("2. source values preserved", () => {
    const src = `Post
Junior Translator
Category
UR
Vacancy
7`;
    const out = vacancyDoc(src);
    expect(out).toContain("Junior Translator");
    expect(out).toContain("UR");
    expect(out).toMatch(/\b7\b/);
    expect(out).not.toMatch(/\b8\b/);
    expect(out).not.toMatch(/EWS/);
    const table = reconstructDelimiterLessVacancyGrid(src);
    expect(table).toContain("Junior Translator | UR | 7");
    for (const cell of ["Junior Translator", "UR", "7"]) {
      expect(src).toContain(cell);
    }
  });

  test("3. ambiguous pattern → original lines", () => {
    const src = `Senior Translator
Junior Translator
10
5
3`;
    const out = vacancyDoc(src);
    expect(out).not.toMatch(/\[Section: Vacancy \| table\]/);
    expect(out).toContain("Senior Translator");
    expect(out).toContain("Junior Translator");
    expect(out).toContain("10");
    expect(out).toContain("5");
    expect(out).toContain("3");
    expect(reconstructDelimiterLessVacancyGrid(src)).toBeNull();
  });

  test("4. missing column → fallback", () => {
    const src = `Post
Senior Translator
Vacancy
10`;
    const out = vacancyDoc(src);
    expect(out).not.toMatch(/\[Section: Vacancy \| table\]/);
    expect(out).toContain("Post");
    expect(out).toContain("Senior Translator");
    expect(out).toContain("Vacancy");
    expect(out).toContain("10");
    expect(reconstructDelimiterLessVacancyGrid(src)).toBeNull();
  });

  test("5. malformed numeric sequence → fallback", () => {
    const src = `Post
Senior Translator
Category
UR
OBC
Vacancy
10
5
3`;
    const out = vacancyDoc(src);
    expect(out).not.toMatch(/\[Section: Vacancy \| table\]/);
    expect(out).toContain("UR");
    expect(out).toContain("OBC");
    expect(out).toContain("10");
    expect(out).toContain("5");
    expect(out).toContain("3");
    expect(reconstructDelimiterLessVacancyGrid(src)).toBeNull();
  });

  test("6. existing explicit pipe table remains unchanged", () => {
    const src = `Post | Category | Vacancy
Senior Translator | UR | 10
Junior Translator | OBC | 5`;
    const out = vacancyDoc(src);
    expect(out).toMatch(/\[Section: Vacancy \| table\]/);
    expect(out).toMatch(/Senior Translator,\s*UR,\s*10/);
    expect(out).toMatch(/Junior Translator,\s*OBC,\s*5/);
    expect(out).not.toMatch(/SC/);
    expect(reconstructDelimiterLessVacancyGrid(src.split("\n"))).toBeNull();
  });

  test(
    "7. real SSC fixture result",
    withoutOpenAi(async () => {
      expect(fs.existsSync(REAL_FIXTURE)).toBe(true);
      const extracted = await extractGeneratorPdfText(fs.readFileSync(REAL_FIXTURE));
      expect(extracted.text).toMatch(/Post Name|TENTATIVE VACANCIES/i);
      expect(extracted.text).toMatch(/URSCST|Level-\d/);
      expect(reconstructDelimiterLessVacancyGrid(extracted.text)).toBeNull();

      const { result } = await processJobParse(extracted.text);
      expect(result).toMatch(/\[Section:\s*Short Information\]/);
      expect(result).toMatch(/TENTATIVE VACANCIES|Vacancy/i);
      const vac = result.match(/\[Section:\s*Vacancy(?:\s*\|\s*table)?\][\s\S]*?(?=\n\[Section:|$)/i);
      expect(vac).toBeTruthy();
      expect(vac[0]).not.toMatch(/\[Section:\s*Vacancy\s*\|\s*table\]/i);
    }),
    120000
  );
});
