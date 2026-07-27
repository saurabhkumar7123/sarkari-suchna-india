"use strict";

const {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  structureDocument,
  structureDocumentFromText,
  splitIntoRawSections,
  detectImplicitHeading,
  normalizeSectionTitle,
  parseBlocks,
  classifyLineKind,
  SECTION_TYPES,
  SECTION_TYPE_LIST,
  UNKNOWN_SECTION_TYPE,
  SECTION_CANONICAL_TITLES,
  BLOCK_TYPES,
  BLOCK_TYPE_LIST,
  UNKNOWN_BLOCK_TYPE,
  CONFIDENCE_LEVELS,
  matchSectionTitle,
  buildHeadingKey
} = require("../server/lib/contentIntelligence/structureIntelligence");

const {
  classifyDocument,
  ENGINE_ID: STAGE_1A_ENGINE_ID,
  STAGE_ID: STAGE_1A_STAGE_ID
} = require("../server/lib/contentIntelligence/documentClassification");

const {
  extractMetadata,
  ENGINE_ID: STAGE_1B_ENGINE_ID,
  STAGE_ID: STAGE_1B_STAGE_ID
} = require("../server/lib/contentIntelligence/metadataIntelligence");

const MARKER_DOC = `[Section: Short Information]
Staff Selection Commission (SSC) has released the CGL 2026 notification. Interested candidates can apply online.

[Section: Important Dates]
Application Begin : 01/07/2026
Last Date to Apply : 21/07/2026
Exam Date : 14 September 2026

[Section: Application Fee]
General / OBC : 100/-
SC / ST : 0/-
Pay the fee through online mode only.

[Section: Vacancy Details | table]
Post Name, UR, OBC, Total
Clerk, 10, 5, 15
Assistant, 20, 10, 30

[Section: How To Apply]
- Visit the official website
- Click on Apply Online
1. Register with a valid email
2. Fill the application form

[Section: Important Links]
Apply Online=https://example.gov.in/apply
Official Website=https://example.gov.in

Download Notification|Hindi=https://example.gov.in/hi.pdf|English=https://example.gov.in/en.pdf

[Section: FAQ]
Q: What is the last date to apply?
A: 21 July 2026.
Q: Can I pay offline?
A: No, only online payment is accepted.

[Section: Physical Standards]
Height and chest requirements apply for some posts.
`;

const IMPLICIT_DOC = `UPPSC has announced the PCS 2026 recruitment for various posts.

Important Dates
Notification Date : 01/06/2026
Last Date : 30/06/2026

Age Limit
Minimum Age : 21 Years
Maximum Age : 40 Years

Physical Standards:
Height requirements apply for police posts.

Syllabus
The syllabus covers general studies and aptitude.
`;

const PATTERN_DOC = `[Section: Exam Pattern]
The written exam has the following structure.
---table---
Subject, Questions, Marks
General Awareness, 25, 50
Reasoning, 25, 50
---endtable---
Total duration is 60 minutes.
`;

const EDGE_DOC = `[Section: Notice]
[color=red]This is an important notice.[/color]
Normal paragraph line follows here.

In this exam, candidates from UP, Bihar, MP can apply easily.
---endtable---
`;

function nonEmptyLines(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function findSection(result, sectionType) {
  return result.sections.find((section) => section.sectionType === sectionType);
}

describe("CIP Combined Stage 1C + 1D — Structure Intelligence Engine", () => {
  test("engine metadata is stable", () => {
    expect(ENGINE_ID).toBe("CIP_STRUCTURE_INTELLIGENCE_ENGINE");
    expect(STAGE_ID).toBe("CIP_1C_1D");
    expect(ENGINE_VERSION).toBe("1.0.0");
  });

  test("section taxonomy includes all required section types", () => {
    const required = [
      "short_information",
      "important_dates",
      "application_fee",
      "age_limit",
      "qualification",
      "vacancy_details",
      "selection_process",
      "how_to_apply",
      "important_links",
      "faq",
      "exam_pattern",
      "syllabus",
      "result",
      "admit_card",
      "answer_key",
      "correction",
      "notice",
      "important_instructions"
    ];
    expect([...SECTION_TYPE_LIST].sort()).toEqual([...required].sort());
    for (const type of required) {
      expect(typeof SECTION_CANONICAL_TITLES[type]).toBe("string");
    }
    expect(UNKNOWN_SECTION_TYPE).toBe("unknown");
  });

  test("block taxonomy includes all required block types", () => {
    const required = [
      "paragraph",
      "table",
      "key_value",
      "date_row",
      "list",
      "faq",
      "link",
      "multi_link",
      "mixed",
      "rich_text"
    ];
    expect([...BLOCK_TYPE_LIST].sort()).toEqual([...required].sort());
    expect(UNKNOWN_BLOCK_TYPE).toBe("unknown");
  });

  test("returns one structured document object with required shape", () => {
    const result = structureDocument({
      title: "SSC CGL 2026 Recruitment Notification",
      text: MARKER_DOC,
      sourceType: "pdf_text"
    });

    expect(result.engineId).toBe(ENGINE_ID);
    expect(result.stageId).toBe(STAGE_ID);
    expect(typeof result.documentType).toBe("string");
    expect(Array.isArray(result.sections)).toBe(true);
    expect(result.sectionCount).toBe(result.sections.length);
    expect(result.metadata).toBeTruthy();
    expect(result.classification).toBeTruthy();
    expect(result.stats).toBeTruthy();
    expect(Array.isArray(result.warnings)).toBe(true);

    for (const section of result.sections) {
      expect(section).toHaveProperty("originalTitle");
      expect(typeof section.normalizedTitle).toBe("string");
      expect(typeof section.sectionType).toBe("string");
      expect(CONFIDENCE_LEVELS).toContain(section.confidence);
      expect(Array.isArray(section.matchedIndicators)).toBe(true);
      expect(Array.isArray(section.blocks)).toBe(true);
      for (const block of section.blocks) {
        expect(typeof block.blockType).toBe("string");
        expect(typeof block.originalContent).toBe("string");
        expect(block.normalizedContent).toBeTruthy();
        expect(CONFIDENCE_LEVELS).toContain(block.confidence);
        expect(Array.isArray(block.warnings)).toBe(true);
      }
    }
  });

  test("normalizes known section titles and preserves originals (markers)", () => {
    const result = structureDocumentFromText(MARKER_DOC);

    const shortInfo = findSection(result, SECTION_TYPES.SHORT_INFORMATION);
    expect(shortInfo.originalTitle).toBe("Short Information");
    expect(shortInfo.normalizedTitle).toBe("Short Information");
    expect(shortInfo.confidence).toBe("high");
    expect(shortInfo.matchedIndicators.length).toBeGreaterThan(0);
    expect(shortInfo.matchedIndicators[0].id).toBe("section:short_information");

    const vacancy = findSection(result, SECTION_TYPES.VACANCY_DETAILS);
    expect(vacancy.originalTitle).toBe("Vacancy Details | table");
    expect(vacancy.normalizedTitle).toBe("Vacancy Details");
    expect(vacancy.forceTable).toBe(true);

    const faq = findSection(result, SECTION_TYPES.FAQ);
    expect(faq.originalTitle).toBe("FAQ");
    expect(faq.normalizedTitle).toBe("FAQ");
    // Generator/publisher compatibility mapping is exposed, not forced.
    expect(faq.generatorTitle).toBe("Important Questions");
  });

  test("detects implicit headings in plain text without markers", () => {
    const result = structureDocumentFromText(IMPLICIT_DOC);

    const types = result.sections.map((section) => section.sectionType);
    expect(types).toContain(SECTION_TYPES.IMPORTANT_DATES);
    expect(types).toContain(SECTION_TYPES.AGE_LIMIT);
    expect(types).toContain(SECTION_TYPES.SYLLABUS);

    const dates = findSection(result, SECTION_TYPES.IMPORTANT_DATES);
    expect(dates.originalTitle).toBe("Important Dates");
    expect(dates.matchedIndicators[0].source).toBe("implicit_heading");

    // Preamble before the first heading is preserved.
    const preamble = result.sections[0];
    expect(preamble.originalTitle).toBeNull();
    expect(preamble.normalizedTitle).toBe("Preamble");
    expect(preamble.originalContent).toContain("UPPSC has announced");
  });

  test("preserves unknown and custom sections", () => {
    const markerResult = structureDocumentFromText(MARKER_DOC);
    const custom = markerResult.sections.find(
      (section) => section.originalTitle === "Physical Standards"
    );
    expect(custom.sectionType).toBe(UNKNOWN_SECTION_TYPE);
    expect(custom.normalizedTitle).toBe("Physical Standards");
    expect(custom.isKnownSection).toBe(false);
    expect(custom.blocks.length).toBeGreaterThan(0);

    const implicitResult = structureDocumentFromText(IMPLICIT_DOC);
    const customColon = implicitResult.sections.find(
      (section) => section.originalTitle === "Physical Standards:"
    );
    expect(customColon.sectionType).toBe(UNKNOWN_SECTION_TYPE);
    expect(customColon.normalizedTitle).toBe("Physical Standards");
    expect(customColon.confidence).toBe("low");
  });

  test("preserves preamble content before first explicit marker", () => {
    const doc = `SSC CGL 2026 Notification released.\n\n${MARKER_DOC}`;
    const result = structureDocumentFromText(doc);
    expect(result.sections[0].normalizedTitle).toBe("Preamble");
    expect(result.sections[0].originalContent).toContain("SSC CGL 2026 Notification released.");
    expect(result.sections[1].sectionType).toBe(SECTION_TYPES.SHORT_INFORMATION);
  });

  test("detects date rows with normalized dates", () => {
    const result = structureDocumentFromText(MARKER_DOC);
    const dates = findSection(result, SECTION_TYPES.IMPORTANT_DATES);
    expect(dates.blocks).toHaveLength(1);

    const block = dates.blocks[0];
    expect(block.blockType).toBe(BLOCK_TYPES.DATE_ROW);
    expect(block.confidence).toBe("high");
    expect(block.normalizedContent.rows).toHaveLength(3);
    expect(block.normalizedContent.rows[0]).toEqual({
      label: "Application Begin",
      value: "01/07/2026",
      normalizedValue: "2026-07-01",
      isDate: true
    });
    expect(block.normalizedContent.rows[2].normalizedValue).toBe("2026-09-14");
  });

  test("distinguishes key-value rows from date rows", () => {
    const result = structureDocumentFromText(IMPLICIT_DOC);
    const age = findSection(result, SECTION_TYPES.AGE_LIMIT);
    const kvBlock = age.blocks[0];
    expect(kvBlock.blockType).toBe(BLOCK_TYPES.KEY_VALUE);
    expect(kvBlock.normalizedContent.rows[0].label).toBe("Minimum Age");
    expect(kvBlock.normalizedContent.rows[0].value).toBe("21 Years");
    expect(kvBlock.normalizedContent.rows[0].isDate).toBe(false);
  });

  test("parses mixed sections into ordered heterogeneous blocks", () => {
    const result = structureDocumentFromText(MARKER_DOC);
    const fee = findSection(result, SECTION_TYPES.APPLICATION_FEE);
    expect(fee.blocks.map((block) => block.blockType)).toEqual([
      BLOCK_TYPES.KEY_VALUE,
      BLOCK_TYPES.PARAGRAPH
    ]);
    expect(fee.blocks[1].normalizedContent.text).toBe(
      "Pay the fee through online mode only."
    );
  });

  test("parses lists preserving item order and ordered flags", () => {
    const result = structureDocumentFromText(MARKER_DOC);
    const howToApply = findSection(result, SECTION_TYPES.HOW_TO_APPLY);
    expect(howToApply.blocks).toHaveLength(1);
    const block = howToApply.blocks[0];
    expect(block.blockType).toBe(BLOCK_TYPES.LIST);
    expect(block.normalizedContent.items.map((item) => item.text)).toEqual([
      "Visit the official website",
      "Click on Apply Online",
      "Register with a valid email",
      "Fill the application form"
    ]);
    expect(block.normalizedContent.items.map((item) => item.ordered)).toEqual([
      false,
      false,
      true,
      true
    ]);
  });

  test("parses single links and pipe multi-links", () => {
    const result = structureDocumentFromText(MARKER_DOC);
    const links = findSection(result, SECTION_TYPES.IMPORTANT_LINKS);
    expect(links.blocks.map((block) => block.blockType)).toEqual([
      BLOCK_TYPES.LINK,
      BLOCK_TYPES.MULTI_LINK
    ]);

    const single = links.blocks[0].normalizedContent.links;
    expect(single[0].label).toBe("Apply Online");
    expect(single[0].url).toBe("https://example.gov.in/apply");

    const multi = links.blocks[1].normalizedContent.links[0];
    expect(multi.label).toBe("Download Notification");
    expect(multi.actions).toEqual([
      { buttonText: "Hindi", url: "https://example.gov.in/hi.pdf" },
      { buttonText: "English", url: "https://example.gov.in/en.pdf" }
    ]);
  });

  test("parses FAQ blocks into question/answer pairs", () => {
    const result = structureDocumentFromText(MARKER_DOC);
    const faq = findSection(result, SECTION_TYPES.FAQ);
    expect(faq.blocks).toHaveLength(1);
    const block = faq.blocks[0];
    expect(block.blockType).toBe(BLOCK_TYPES.FAQ);
    expect(block.confidence).toBe("high");
    expect(block.normalizedContent.pairs).toEqual([
      { question: "What is the last date to apply?", answer: "21 July 2026." },
      { question: "Can I pay offline?", answer: "No, only online payment is accepted." }
    ]);
  });

  test("flags unanswered FAQ questions with warnings", () => {
    const blocks = parseBlocks("Q: Is there any fee?");
    expect(blocks[0].blockType).toBe(BLOCK_TYPES.FAQ);
    expect(blocks[0].confidence).toBe("medium");
    expect(blocks[0].warnings.join(" ")).toContain("Unanswered question");
  });

  test("parses forced tables from '| table' sections", () => {
    const result = structureDocumentFromText(MARKER_DOC);
    const vacancy = findSection(result, SECTION_TYPES.VACANCY_DETAILS);
    expect(vacancy.blocks).toHaveLength(1);
    const block = vacancy.blocks[0];
    expect(block.blockType).toBe(BLOCK_TYPES.TABLE);
    expect(block.normalizedContent.source).toBe("forced");
    expect(block.normalizedContent.grid).toEqual([
      ["Post Name", "UR", "OBC", "Total"],
      ["Clerk", "10", "5", "15"],
      ["Assistant", "20", "10", "30"]
    ]);
  });

  test("parses ---table--- marker tables with surrounding paragraphs in order", () => {
    const result = structureDocumentFromText(PATTERN_DOC);
    const pattern = findSection(result, SECTION_TYPES.EXAM_PATTERN);
    expect(pattern.blocks.map((block) => block.blockType)).toEqual([
      BLOCK_TYPES.PARAGRAPH,
      BLOCK_TYPES.TABLE,
      BLOCK_TYPES.PARAGRAPH
    ]);
    const table = pattern.blocks[1];
    expect(table.normalizedContent.source).toBe("markers");
    expect(table.normalizedContent.rowCount).toBe(3);
    expect(table.normalizedContent.columnCount).toBe(3);
    expect(table.confidence).toBe("high");
  });

  test("auto-detects CSV table runs", () => {
    const blocks = parseBlocks("Post, UR, OBC\nClerk, 5, 3\nTypist, 2, 1");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].blockType).toBe(BLOCK_TYPES.TABLE);
    expect(blocks[0].normalizedContent.source).toBe("csv");
    expect(blocks[0].confidence).toBe("high");
  });

  test("handles rich text, mixed, and unknown blocks without losing content", () => {
    const result = structureDocumentFromText(EDGE_DOC);
    const notice = findSection(result, SECTION_TYPES.NOTICE);
    const blockTypes = notice.blocks.map((block) => block.blockType);
    expect(blockTypes).toEqual([
      BLOCK_TYPES.RICH_TEXT,
      BLOCK_TYPES.PARAGRAPH,
      BLOCK_TYPES.MIXED,
      UNKNOWN_BLOCK_TYPE
    ]);

    const rich = notice.blocks[0];
    expect(rich.normalizedContent.plainText).toBe("This is an important notice.");
    expect(rich.originalContent).toContain("[color=red]");
    expect(rich.hasRichMarkup).toBe(true);

    const mixed = notice.blocks[2];
    expect(mixed.confidence).toBe("low");
    expect(mixed.originalContent).toContain("UP, Bihar, MP");

    const unknown = notice.blocks[3];
    expect(unknown.confidence).toBe("none");
    expect(unknown.normalizedContent.raw).toBe("---endtable---");
    expect(unknown.warnings.length).toBeGreaterThan(0);
  });

  test("preserves ordering of sections and blocks", () => {
    const result = structureDocumentFromText(MARKER_DOC);
    expect(result.sections.map((section) => section.order)).toEqual(
      result.sections.map((_, index) => index)
    );
    for (const section of result.sections) {
      expect(section.blocks.map((block) => block.order)).toEqual(
        section.blocks.map((_, index) => index)
      );
    }
    // Section order matches document order.
    expect(result.sections.map((section) => section.sectionType)).toEqual([
      SECTION_TYPES.SHORT_INFORMATION,
      SECTION_TYPES.IMPORTANT_DATES,
      SECTION_TYPES.APPLICATION_FEE,
      SECTION_TYPES.VACANCY_DETAILS,
      SECTION_TYPES.HOW_TO_APPLY,
      SECTION_TYPES.IMPORTANT_LINKS,
      SECTION_TYPES.FAQ,
      UNKNOWN_SECTION_TYPE
    ]);
  });

  test("never loses content: every non-empty line lands in exactly one block", () => {
    for (const doc of [MARKER_DOC, IMPLICIT_DOC, PATTERN_DOC, EDGE_DOC]) {
      const result = structureDocumentFromText(doc);
      for (const section of result.sections) {
        const sourceLines = nonEmptyLines(section.originalContent);
        const blockLines = section.blocks.flatMap((block) =>
          nonEmptyLines(block.originalContent)
        );
        expect(blockLines).toEqual(sourceLines);
      }
    }
  });

  test("output is deterministic across runs", () => {
    const input = {
      title: "SSC CGL 2026 Recruitment Notification",
      text: MARKER_DOC,
      sourceType: "pdf_text",
      url: "https://example.gov.in/notice"
    };
    const first = structureDocument(input);
    const second = structureDocument(input);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  test("works across different document types via Stage 1A", () => {
    const admitCard = structureDocument({
      title: "SSC CGL Admit Card 2026 Download",
      text: "[Section: Admit Card]\nDownload Admit Card=https://example.gov.in/admit"
    });
    const standalone = classifyDocument({
      title: "SSC CGL Admit Card 2026 Download",
      text: "[Section: Admit Card]\nDownload Admit Card=https://example.gov.in/admit"
    });
    expect(admitCard.documentType).toBe(standalone.documentType);
    expect(admitCard.sections[0].sectionType).toBe(SECTION_TYPES.ADMIT_CARD);

    const resultDoc = structureDocumentFromText(
      "[Section: Result]\nCheck Result=https://example.gov.in/result"
    );
    expect(resultDoc.sections[0].sectionType).toBe(SECTION_TYPES.RESULT);
  });

  test("reuses provided Stage 1A and Stage 1B results without recomputing", () => {
    const providedClassification = {
      documentType: "recruitment_notification",
      documentTypeLabel: "Recruitment Notification",
      confidence: "high"
    };
    const providedMetadata = {
      normalizedMetadata: { title: "Provided Title" }
    };
    const result = structureDocument({
      text: MARKER_DOC,
      classification: providedClassification,
      metadataResult: providedMetadata
    });
    expect(result.documentType).toBe("recruitment_notification");
    expect(result.metadata.title).toBe("Provided Title");
    expect(result.extensions.classificationReused).toBe(true);
    expect(result.extensions.metadataReused).toBe(true);
  });

  test("supports skipping Stage 1A / 1B", () => {
    const result = structureDocument({
      text: MARKER_DOC,
      skipClassification: true,
      skipMetadata: true
    });
    expect(result.classification).toBeNull();
    expect(result.metadata).toBeNull();
    expect(result.documentType).toBe("unknown");
    expect(result.sections.length).toBeGreaterThan(0);
  });

  test("handles empty input safely", () => {
    const result = structureDocument({});
    expect(result.sections).toEqual([]);
    expect(result.sectionCount).toBe(0);
    expect(result.blockCount).toBe(0);
    expect(result.warnings.join(" ")).toContain("Empty input");
  });

  test("does not mutate the input object", () => {
    const input = { title: "SSC CGL 2026", text: MARKER_DOC, metadata: { state: "All India" } };
    const snapshot = JSON.stringify(input);
    structureDocument(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  test("backward compatibility: Stage 1A and 1B stay intact and independent", () => {
    expect(STAGE_1A_ENGINE_ID).toBe("CIP_DOCUMENT_CLASSIFICATION_ENGINE");
    expect(STAGE_1A_STAGE_ID).toBe("CIP_1A");
    expect(STAGE_1B_ENGINE_ID).toBe("CIP_METADATA_INTELLIGENCE_ENGINE");
    expect(STAGE_1B_STAGE_ID).toBe("CIP_1B");

    const classifyInput = { title: "UP Police Constable Recruitment 2026" };
    const before1A = JSON.stringify(classifyDocument(classifyInput));
    const before1B = JSON.stringify(extractMetadata({ title: "UP Police Constable Recruitment 2026" }));
    structureDocumentFromText(MARKER_DOC);
    expect(JSON.stringify(classifyDocument(classifyInput))).toBe(before1A);
    expect(
      JSON.stringify(extractMetadata({ title: "UP Police Constable Recruitment 2026" }))
    ).toBe(before1B);
  });

  test("section rules map common alias headings", () => {
    const cases = [
      ["Educational Qualification", SECTION_TYPES.QUALIFICATION],
      ["Eligibility", SECTION_TYPES.QUALIFICATION],
      ["Mode of Selection", SECTION_TYPES.SELECTION_PROCESS],
      ["Application Process", SECTION_TYPES.HOW_TO_APPLY],
      ["Hall Ticket", SECTION_TYPES.ADMIT_CARD],
      ["Answer Keys", SECTION_TYPES.ANSWER_KEY],
      ["Correction / Edit Form", SECTION_TYPES.CORRECTION],
      ["General Instructions", SECTION_TYPES.IMPORTANT_INSTRUCTIONS],
      ["Frequently Asked Questions", SECTION_TYPES.FAQ],
      ["आवेदन शुल्क", SECTION_TYPES.APPLICATION_FEE]
    ];
    for (const [title, expected] of cases) {
      const info = normalizeSectionTitle(title);
      expect(info.sectionType).toBe(expected);
      expect(info.normalizedTitle).toBe(SECTION_CANONICAL_TITLES[expected]);
    }
  });

  test("low-level helpers stay consistent", () => {
    expect(buildHeadingKey("2. Important Dates :")).toBe("important dates");
    expect(matchSectionTitle("important dates")[0].sectionType).toBe(
      SECTION_TYPES.IMPORTANT_DATES
    );
    expect(classifyLineKind("Last Date : 21/07/2026")).toBe("kv");
    expect(classifyLineKind("Apply Online=https://x.gov.in")).toBe("link");
    expect(classifyLineKind("A|B=https://x/1|C=https://x/2")).toBe("multi_link");
    expect(classifyLineKind("- item")).toBe("list");
    expect(classifyLineKind("Q: question?")).toBe("faq_q");
    expect(detectImplicitHeading("Important Dates")).toBeTruthy();
    expect(detectImplicitHeading("Last Date: 21/07/2026")).toBeNull();
    expect(splitIntoRawSections("").length).toBe(0);
  });
});
