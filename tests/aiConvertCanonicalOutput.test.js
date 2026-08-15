"use strict";

const fs = require("fs");
const path = require("path");

const {
  applyCanonicalPublisherFormat,
  canonicalSectionTitle
} = require("../server/utils/canonicalPublisherFormat");
const { finalizeStructuredJobOutput } = require("../server/utils/jobSectionStructure");
const {
  processJobParse,
  isStrongAiOutput,
  pickBestPublisherDoc
} = require("../server/services/aiParseJob.service");
const { extractGeneratorPdfText } = require("../server/services/pdfGeneratorExtract.service");

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

describe("AI Convert canonical publisher format", () => {
  test("1. Short Information uses canonical title, not ShortInfo", () => {
    const out = applyCanonicalPublisherFormat(`[Section: ShortInfo]\nSSC Combined Hindi Translators 2026`);
    expect(out).toContain("[Section: Short Information]");
    expect(out).not.toMatch(/\[Section:\s*ShortInfo\]/);
    expect(canonicalSectionTitle("ShortInfo")).toBe("Short Information");
  });

  test("2. Important Dates uses Label : value", () => {
    const out = applyCanonicalPublisherFormat(
      `[Section: ImportantDates]\nOnline Apply Start Date: 04 September 2025`
    );
    expect(out).toContain("[Section: Important Dates]");
    expect(out).toContain("Online Apply Start Date : 04 September 2025");
  });

  test("3. Application Fee uses Label : value", () => {
    const out = applyCanonicalPublisherFormat(
      `[Section: ApplicationFee]\nFor General / OBC / EWS: ₹ 125/-`
    );
    expect(out).toContain("[Section: Application Fee]");
    expect(out).toContain("For General / OBC / EWS : ₹ 125/-");
  });

  test("4. Vacancy table uses existing | table convention", () => {
    const out = applyCanonicalPublisherFormat(`[Section: Vacancy]
Post | Category | Vacancy
Senior Translator | UR | 10
Junior Translator | OBC | 5`);
    expect(out).toMatch(/\[Section: Vacancy \| table\]/);
    expect(out).toMatch(/Senior Translator/);
    expect(out).toMatch(/Junior Translator/);
  });

  test("5. Important Links uses Label=url", () => {
    const out = applyCanonicalPublisherFormat(
      `[Section: ImportantLinks]\nOfficial Website=https://ssc.nic.in/`
    );
    expect(out).toContain("[Section: Important Links]");
    expect(out).toContain("Official Website=https://ssc.nic.in/");
  });

  test("6. FAQ uses Q: / A:", () => {
    const out = applyCanonicalPublisherFormat(`[Section: FAQ]
Question: What is the last date?
Answer: 30 September 2025`);
    expect(out).toContain("[Section: Important Questions]");
    expect(out).toContain("Q: What is the last date?");
    expect(out).toContain("A: 30 September 2025");
  });

  test("7. Custom section title is preserved", () => {
    const out = applyCanonicalPublisherFormat(
      `[Section: Board Instructions]\nRead the official notice carefully.`
    );
    expect(out).toContain("[Section: Board Instructions]");
    expect(out).toContain("Read the official notice carefully.");
  });

  test("8. malformed link Label : https is normalized to Label=https", () => {
    const out = applyCanonicalPublisherFormat(
      `[Section: Important Links]\nOfficial Website : https://ssc.nic.in/`
    );
    expect(out).toContain("Official Website=https://ssc.nic.in/");
    expect(out).not.toMatch(/Official Website\s*:/);
  });

  test("9. malformed AI output is not treated as strong", () => {
    const malformed = `{ "shortInfo": "SSC", "dates": [] }`;
    expect(isStrongAiOutput(malformed)).toBe(false);
    const rule = `[Section: Short Information]\nSSC 2026\n[Section: Important Dates]\nLast Date : 31 July 2026\n`;
    expect(pickBestPublisherDoc(malformed, rule)).toContain("[Section: Short Information]");
    const finalized = finalizeStructuredJobOutput(malformed, "Staff Selection Commission Combined Hindi Translators Examination 2026 last date 31/07/2026");
    expect(finalized).toMatch(/\[Section:/);
    expect(finalized).not.toMatch(/\{\s*"shortInfo"/);
  });

  test(
    "10. OpenAI unavailable still converts via rule-based path",
    withoutOpenAi(async () => {
      const { result } = await processJobParse(`Staff Selection Commission
Combined Hindi Translators Examination 2026
Online Apply Start Date : 04 September 2025
Last Date : 30 September 2025
For General / OBC / EWS : Rs 125/-
Apply Online https://ssc.nic.in
Post | Category | Vacancy
Senior Translator | UR | 10`);
      expect(result).toContain("[Section: Short Information]");
      expect(result).toContain("[Section: Important Dates]");
      expect(result).toContain("Online Apply Start Date : 04 September 2025");
      expect(result).toContain("[Section: Application Fee]");
      expect(result).toMatch(/ssc\.nic\.in/i);
      expect(result).not.toMatch(/\[Section:\s*ShortInfo\]/);
    })
  );

  test(
    "11. already-structured input is preserved and canonicalized",
    withoutOpenAi(async () => {
      const input = `[Section: Short Information]
Uttar Pradesh Public Service Commission
[Section: Important Dates]
Online Apply Start Date : 04 September 2025
[Section: Application Fee]
For General / OBC / EWS : ₹ 125/-
[Section: Board Instructions]
Candidates must read the notice.`;
      const { result } = await processJobParse(input);
      expect(result).toContain("[Section: Short Information]");
      expect(result).toContain("Uttar Pradesh Public Service Commission");
      expect(result).toContain("[Section: Important Dates]");
      expect(result).toContain("Online Apply Start Date : 04 September 2025");
      expect(result).toContain("[Section: Application Fee]");
      expect(result).toContain("For General / OBC / EWS : ₹ 125/-");
      expect(result).toContain("[Section: Board Instructions]");
      expect(result).toContain("Candidates must read the notice.");
    })
  );
});

describe("Real SSC PDF extraction → AI convert (no OpenAI)", () => {
  const present = fs.existsSync(REAL_FIXTURE);

  test("fixture exists", () => {
    expect(present).toBe(true);
  });

  test(
    "extracted SSC CHT text converts to publisher [Section:] text",
    withoutOpenAi(async () => {
      if (!present) return;
      const extracted = await extractGeneratorPdfText(fs.readFileSync(REAL_FIXTURE));
      expect(extracted.text.length).toBeGreaterThan(80);
      const { result } = await processJobParse(extracted.text);
      expect(result).toMatch(/\[Section:\s*Short Information\]/);
      expect(result).not.toMatch(/\[Section:\s*ShortInfo\]/);
      expect(result).toMatch(/Hindi Translator|COMBINED HINDI TRANSLATORS|Staff Selection Commission|SSC/i);
      expect(result).toMatch(/TENTATIVE VACANCIES|Vacancy/i);
      if (/09[./-]07[./-]2026|09\.07\.2026|09-07-2026|09\/07\/2026/.test(extracted.text)) {
        expect(result).toMatch(/09[./-]07[./-]2026|09\.07\.2026|09-07-2026|09\/07\/2026/);
      }
    }),
    120000
  );
});
