"use strict";

/**
 * AMP-4B Part 18 — trailing unclassified source lines must survive section packing.
 * Does not persist drafts, reviews, Telegram, or publish.
 */

const fs = require("fs");
const path = require("path");
const { detectDocumentSections } = require("../server/lib/generatorIntelligence/sectionDetection");
const { processJobParse } = require("../server/services/aiParseJob.service");
const { SECTION_TYPES } = require("../server/lib/generatorIntelligence/types");

const OCR_FIXTURE = path.join(
  __dirname,
  "fixtures",
  "generator-pdf",
  "upsc-prncpl-obc-caf-ocr.txt"
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

describe("Part 18 trailing other-line retention", () => {
  test("classification packing keeps trailing unclassified source lines", () => {
    const lines = [
      "Alpha Recruitment Board",
      "NOTICE",
      "This is line three of the unclassified preamble.",
      "This is line four of the unclassified preamble.",
      "This is line five of the unclassified preamble.",
      "This is line six of the unclassified preamble.",
      "This is line seven of the unclassified preamble.",
      "Trailing source paragraph about the official application form remains."
    ];
    const detected = detectDocumentSections(lines.join("\n"));
    const short = detected.sections.find((s) => s.sectionType === SECTION_TYPES.SHORT_INFORMATION);
    expect(short).toBeTruthy();
    expect(short.originalContent).toMatch(/Trailing source paragraph about the official application form remains/);
  });

  test(
    "processJobParse retains trailing CAF paragraph from Part-15 OCR when present in source",
    withoutOpenAi(async () => {
      const extractedText = fs.readFileSync(OCR_FIXTURE, "utf8").trim();
      expect(extractedText).toMatch(/Common Application Form \(CAF\)/i);
      const parsed = await processJobParse(extractedText);
      const result = parsed && parsed.result ? parsed.result : "";
      expect(result).toMatch(/\[Section:\s*Short Information\]/);
      expect(result).toMatch(/Common Application Form \(CAF\)|\bCAF\b/i);
    }),
    60000
  );
});
