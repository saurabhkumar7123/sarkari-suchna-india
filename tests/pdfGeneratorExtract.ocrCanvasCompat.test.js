"use strict";

const { extractGeneratorPdfText } = require("../server/services/pdfGeneratorExtract.service");
const { buildPdf } = require("./helpers/minimalPdfBuilder");

describe("Generator PDF OCR canvas compatibility", () => {
  test(
    "image XObject PDF does not fail with Image or Canvas expected",
    async () => {
      const pdf = buildPdf({
        includeImage: true,
        pages: [{ lines: [{ text: "Hi", y: 720 }] }]
      });
      try {
        const out = await extractGeneratorPdfText(pdf);
        expect(typeof out.text).toBe("string");
      } catch (err) {
        expect(String(err && err.message ? err.message : err)).not.toMatch(/Image or Canvas expected/i);
        expect(err && err.code).not.toBe("OCR_FAILED");
        expect(err && err.code).toBe("TEXT_TOO_SHORT");
      }
    },
    120000
  );
});
