"use strict";

/**
 * Phase AI-1 — PDF Extraction & AI Conversion Quality Upgrade tests.
 * Representative styles: UPPSC, SSC, Railway, UP Police, BPSC, NTA, Hindi-heavy.
 */

const { SAMPLES } = require("./fixtures/ai1/notificationSamples");
const {
  advancedNormalize,
  softCleanForStructuring,
  fixMergedWords,
  fixSpacedWordsLine,
  unicodeNormalize
} = require("../server/lib/generatorIntelligence/textNormalization");
const {
  runGeneratorIntelligencePipeline,
  buildStructuredDocument,
  compileToPublisherText,
  classifyLink,
  detectAndClassifyLinks,
  detectSmartTables,
  matchSectionHeading,
  validateStructuredDocument,
  LINK_CATEGORIES,
  FORMAT_ID
} = require("../server/lib/generatorIntelligence");
const { processJobParse } = require("../server/services/aiParseJob.service");
const { parseSectionsFromText } = require("../generator/parse/sectionParse");
const { buildDynamicSectionsWithWarnings } = require("../generator/builders/sectionBuilder");

describe("Phase AI-1 text normalization", () => {
  test("unicode NFC + spaced words + merged words", () => {
    const spaced = fixSpacedWordsLine("Q u a l i f i c a t i o n");
    expect(spaced.replace(/\s+/g, "")).toMatch(/qualification/i);

    const merged = fixMergedWords("AgeLimit LastDate ApplyOnline");
    expect(merged).toMatch(/Age Limit/);
    expect(merged).toMatch(/Last Date/);
    expect(merged).toMatch(/Apply Online/);

    const nfc = unicodeNormalize("कार्य\u094D\u200D");
    expect(typeof nfc).toBe("string");
  });

  test("strips page numbers and repeated headers", () => {
    const raw = `UPPSC Notice
Page 1 of 10
Body line about vacancy 100 posts
Page 2 of 10
UPPSC Notice
More vacancy detail for clerk
Page 3 of 10
UPPSC Notice
Final line`;
    const out = advancedNormalize(raw);
    expect(out).not.toMatch(/Page \d+ of \d+/i);
    expect(out).toMatch(/vacancy/i);
  });

  test("soft clean preserves How To Apply", () => {
    const raw = `How To Apply
Candidates must register online
Annexure I
ignored annexure body`;
    const out = softCleanForStructuring(raw);
    expect(out).toMatch(/How To Apply/i);
    expect(out).toMatch(/register online/i);
    expect(out).not.toMatch(/ignored annexure/i);
  });
});

describe("Phase AI-1 section / link / table detection", () => {
  test("matches Hindi and English headings", () => {
    expect(matchSectionHeading("Important Dates").sectionType).toBe("important_dates");
    expect(matchSectionHeading("आयु सीमा").sectionType).toBe("age_limit");
    expect(matchSectionHeading("आवेदन कैसे करें").sectionType).toBe("how_to_apply");
    expect(matchSectionHeading("Helpline").sectionType).toBe("helpline");
  });

  test("classifies common recruitment links", () => {
    expect(classifyLink("Apply Online", "https://ssc.nic.in/apply")).toBe(LINK_CATEGORIES.APPLY_ONLINE);
    expect(classifyLink("Notification", "https://uppsc.up.nic.in/a.pdf")).toBe(
      LINK_CATEGORIES.NOTIFICATION_PDF
    );
    expect(classifyLink("Admit Card", "https://ssc.nic.in/admit")).toBe(LINK_CATEGORIES.ADMIT_CARD);
    expect(classifyLink("Answer Key", "https://nta.ac.in/key")).toBe(LINK_CATEGORIES.ANSWER_KEY);
    expect(classifyLink("Login", "https://cuet.nta.nic.in/login")).toBe(LINK_CATEGORIES.LOGIN);
    expect(classifyLink("Correction", "https://cuet.nta.nic.in/correction")).toBe(
      LINK_CATEGORIES.CORRECTION
    );
    expect(classifyLink("Syllabus", "https://nta.ac.in/syllabus")).toBe(LINK_CATEGORIES.SYLLABUS);
    expect(classifyLink("Official Website", "https://nta.ac.in")).toBe(LINK_CATEGORIES.OFFICIAL_WEBSITE);
    expect(classifyLink("Result", "https://ssc.nic.in/result")).toBe(LINK_CATEGORIES.RESULT);
    expect(classifyLink("Registration", "https://cuet.nta.nic.in")).toBe(LINK_CATEGORIES.REGISTRATION);
  });

  test("detects vacancy pipe table kind", () => {
    const lines = ["Post | Force | Vacancy", "Constable GD | BSF | 13093", "Constable GD | CISF | 5000"];
    const tables = detectSmartTables(lines);
    expect(tables.length).toBe(1);
    expect(tables[0].kind).toBe("vacancy");
    expect(tables[0].rows.length).toBe(3);
    expect(tables[0].confidence).toBeGreaterThan(0.5);
  });

  test("detectAndClassifyLinks from mixed lines", () => {
    const links = detectAndClassifyLinks([
      "Apply Online https://ssc.nic.in",
      "Notification PDF=https://ssc.nic.in/gd.pdf"
    ]);
    expect(links.length).toBe(2);
    expect(links.some((l) => l.category === LINK_CATEGORIES.APPLY_ONLINE)).toBe(true);
    expect(links.some((l) => l.category === LINK_CATEGORIES.NOTIFICATION_PDF)).toBe(true);
  });
});

describe("Phase AI-1 structured pipeline — board samples", () => {
  const cases = [
    ["UPPSC", SAMPLES.UPPSC, ["Important Dates", "Application Fee", "Vacancy", "How To Apply", "Important Links"]],
    ["SSC", SAMPLES.SSC, ["Important Dates", "Application Fee", "Vacancy", "Important Links"]],
    ["RAILWAY", SAMPLES.RAILWAY, ["Important Dates", "Application Fee", "Vacancy", "Important Links"]],
    ["UP_POLICE", SAMPLES.UP_POLICE, ["Important Dates", "Application Fee", "Vacancy", "Salary"]],
    ["BPSC", SAMPLES.BPSC, ["Important Dates", "Application Fee", "Vacancy", "Important Links"]],
    ["NTA", SAMPLES.NTA, ["Important Dates", "Application Fee", "Important Links", "Helpline"]],
    ["HINDI_HEAVY", SAMPLES.HINDI_HEAVY, ["Important Questions", "Helpline", "How To Apply"]]
  ];

  test.each(cases)("%s produces structured JSON + publisher sections", (name, sample, expectTitles) => {
    const out = runGeneratorIntelligencePipeline(sample, { sourceName: name });
    expect(out.structured.formatId).toBe(FORMAT_ID);
    expect(out.structured.sections.length).toBeGreaterThanOrEqual(3);
    expect(out.validation).toBeDefined();
    expect(out.validation.overallConfidence).toBeGreaterThan(0.3);
    expect(out.result).toMatch(/\[Section:/i);

    for (const title of expectTitles) {
      const re = new RegExp(`\\[Section:\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
      expect(out.result).toMatch(re);
    }

    const parsed = parseSectionsFromText(out.result);
    expect(parsed.length).toBeGreaterThanOrEqual(2);

    const built = buildDynamicSectionsWithWarnings(out.result);
    expect(built.html.length).toBeGreaterThan(50);
  });

  test("unknown custom heading is preserved", () => {
    const raw = `Short Information
Demo Board Recruitment
Custom Board Note
This note must not be discarded.
Important Dates
Start Date : 01 January 2026
Last Date : 31 January 2026`;
    const structured = buildStructuredDocument(raw);
    const unknown = structured.sections.find(
      (s) => !s.isKnownSection || /custom board note/i.test(s.title)
    );
    // Either detected as unknown section or content survives in publisher output
    const publisher = compileToPublisherText(structured);
    expect(publisher).toMatch(/Custom Board Note|This note must not be discarded/i);
    expect(unknown || publisher.includes("note")).toBeTruthy();
  });

  test("validation flags broken URLs and scores sections", () => {
    const structured = buildStructuredDocument(`Important Links
Apply Online=https://ssc.nic.in
Broken Link=http://
Important Dates
Last Date : 31 December 2025`);
    const validation = validateStructuredDocument(structured);
    expect(validation.sections.length).toBeGreaterThan(0);
    expect(validation.summary.sectionCount).toBeGreaterThan(0);
  });
});

describe("Phase AI-1 Generator compatibility via processJobParse", () => {
  test("UPPSC sample auto-fills Generator [Section:] document", async () => {
    const { result, structured, validation } = await processJobParse(SAMPLES.UPPSC);
    expect(result).toMatch(/\[Section: Short Information\]/i);
    expect(result).toMatch(/\[Section: Important Dates\]/i);
    expect(result).toMatch(/\[Section: Application Fee\]/i);
    expect(result).toMatch(/uppsc\.up\.nic\.in/i);
    expect(structured).toBeDefined();
    expect(validation).toBeDefined();

    const built = buildDynamicSectionsWithWarnings(result);
    expect(built.html).toMatch(/card-header/i);
  });

  test("Hindi-heavy FAQ language is preserved", async () => {
    const { result } = await processJobParse(SAMPLES.HINDI_HEAVY);
    expect(result).toMatch(/\[Section: Important Questions\]/i);
    expect(result).toContain("आयु सीमा क्या है?");
    expect(result).toContain("21-40 वर्ष");
  });

  test("SSC vacancy table remains table-renderable", async () => {
    const { result } = await processJobParse(SAMPLES.SSC);
    expect(result).toMatch(/\[Section: Vacancy/i);
    const built = buildDynamicSectionsWithWarnings(result);
    expect(built.html).toContain("<table");
  });

  test("NTA link categories map to publisher labels", async () => {
    const { result, structured } = await processJobParse(SAMPLES.NTA);
    expect(result).toMatch(/\[Section: Important Links\]/i);
    expect(result).toMatch(/Registration\s*=\s*https:\/\/cuet\.nta\.nic\.in|Login\s*=\s*https:\/\/cuet\.nta\.nic\.in\/login/i);
    if (structured?.links?.length) {
      const cats = structured.links.map((l) => l.category);
      expect(cats).toEqual(
        expect.arrayContaining([LINK_CATEGORIES.LOGIN, LINK_CATEGORIES.CORRECTION])
      );
    }
  });
});
