"use strict";

/**
 * AMP-4B Part 16 — real Part-15 UPSC OCR text → existing processJobParse() quality gate.
 * Does not persist drafts, reviews, Telegram, or publish.
 */

jest.mock("../server/services/aiParseJob.service", () => {
  const actual = jest.requireActual("../server/services/aiParseJob.service");
  return {
    ...actual,
    processJobParse: jest.fn((...args) => actual.processJobParse(...args))
  };
});

const fs = require("fs");
const path = require("path");

const OCR_FIXTURE = path.join(
  __dirname,
  "fixtures",
  "generator-pdf",
  "upsc-prncpl-obc-caf-ocr.txt"
);

const PDF_URL =
  "https://www.upsc.gov.in/sites/default/files/Notice-PrncplVPrncplOBC-CAF-Engl-050826.pdf";
const TITLE = "UPSC Principal Vice Principal OBC CAF";

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

function loadPart15Ocr() {
  const text = fs.readFileSync(OCR_FIXTURE, "utf8").trim();
  expect(text.length).toBeGreaterThan(1000);
  expect(text).toMatch(/UNION PUBLIC SERVICE COMMISSION/i);
  expect(text).toMatch(/Principal and Vice Principal/i);
  expect(text).toMatch(/\bOBC\b/);
  expect(text).toMatch(/Special Advertisement No\.\s*51\/2026/i);
  expect(text).toMatch(/Common Application Form \(CAF\)/i);
  return text;
}

describe("Part 16 real UPSC OCR → existing AI Convert", () => {
  test("fixture is real Part-15 UPSC OCR, not SSC fixture text", () => {
    const text = loadPart15Ocr();
    expect(text).not.toMatch(/Staff Selection Commission/i);
    expect(text).not.toMatch(/Combined Hindi Translators/i);
  });

  test("weak / title-only output is rejected by existing quality gate", () => {
    const { isAcceptablePublisherOutput } = require("../server/lib/recruitment/productionRuntime/applyGeneratorAiConvert");
    const extractedText = loadPart15Ocr();
    expect(isAcceptablePublisherOutput("", { title: TITLE, extractedText })).toBe(false);
    expect(
      isAcceptablePublisherOutput(`[Section: Short Information]\n${TITLE}`, {
        title: TITLE,
        extractedText
      })
    ).toBe(false);
    expect(
      isAcceptablePublisherOutput("[Section: Short Information]\nNo usable data found", {
        extractedText
      })
    ).toBe(false);
  });

  test(
    "processJobParse converts real UPSC OCR via rule fallback when OpenAI is off",
    withoutOpenAi(async () => {
      const extractedText = loadPart15Ocr();
      const { processJobParse } = require("../server/services/aiParseJob.service");
      const {
        convertAmpExtractedTextToPublisher,
        isAcceptablePublisherOutput
      } = require("../server/lib/recruitment/productionRuntime/applyGeneratorAiConvert");

      processJobParse.mockClear();

      const parsed = await processJobParse(extractedText);
      expect(processJobParse).toHaveBeenCalledTimes(1);
      expect(processJobParse.mock.calls[0][0]).toBe(extractedText);

      const result = parsed && parsed.result ? parsed.result : "";
      expect(result).toMatch(/\[Section:\s*Short Information\]/);
      expect(result).not.toMatch(/\[Section:\s*ShortInfo\]/);
      expect(result).toMatch(/UNION PUBLIC SERVICE COMMISSION|\bUPSC\b/i);
      expect(result).toMatch(/Principal/i);
      expect(result).toMatch(/Vice Principal/i);
      expect(result).toMatch(/\bOBC\b/);
      expect(result).toMatch(/51\/2026/);

      const src = extractedText.toLowerCase();
      for (const token of result.match(/\b\d{4}\b/g) || []) {
        expect(src).toContain(token);
      }
      expect(result).not.toMatch(/₹|Rs\.?\s*\d/i);
      if (!/last\s*date|apply\s*start/i.test(extractedText)) {
        expect(result).not.toMatch(/\[Section:\s*Important Dates\]/i);
      }
      if (!/https?:\/\//i.test(extractedText)) {
        expect(result).not.toMatch(/\[Section:\s*Important Links\]/i);
      }

      const gated = await convertAmpExtractedTextToPublisher({
        extractedText,
        title: TITLE,
        officialUrl: PDF_URL
      });
      expect(gated.accepted).toBe(isAcceptablePublisherOutput(result, { title: TITLE, officialUrl: PDF_URL, extractedText }));
      if (gated.accepted) {
        expect(gated.result).toMatch(/\[Section:\s*Short Information\]/);
      }
    }),
    60000
  );
});
