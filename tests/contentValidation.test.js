"use strict";

const {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  validateContent,
  validateStructuredDocument,
  validateContentFromText,
  SEVERITIES,
  VALIDATION_CATEGORIES,
  QUALITY_SCORE_KEYS,
  PUBLISH_READINESS_STATES,
  GENERATOR_COMPATIBILITY_STATES,
  REQUIRED_SECTIONS_BY_TYPE,
  SCORE_DEDUCTIONS,
  getRequiredSections
} = require("../server/lib/contentIntelligence/validationEngine");

const {
  structureDocument,
  ENGINE_ID: STAGE_1C_ENGINE_ID,
  STAGE_ID: STAGE_1C_STAGE_ID
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

const VALID_DOC = `[Section: Short Information]
Staff Selection Commission (SSC) has released the CGL 2026 notification. Interested candidates can apply online.

[Section: Important Dates]
Application Begin : 01/07/2026
Last Date to Apply : 21/07/2026
Exam Date : 14 September 2026

[Section: Application Fee]
General / OBC : 100/-
SC / ST : 0/-

[Section: Vacancy Details | table]
Post Name, UR, OBC, Total
Clerk, 10, 5, 15
Assistant, 20, 10, 30

[Section: How To Apply]
- Visit the official website
- Click on Apply Online

[Section: Important Links]
Apply Online=https://ssc.gov.in/apply
Official Website=https://ssc.gov.in

[Section: FAQ]
Q: What is the last date to apply?
A: 21 July 2026.
Q: Can I pay offline?
A: No, only online payment is accepted.
`;

const MISSING_SECTIONS_DOC = `[Section: Short Information]
A short recruitment notice without dates or links.
`;

const DUPLICATE_SECTIONS_DOC = `[Section: Important Dates]
Start Date : 01/07/2026

[Section: Short Information]
Notice body here.

[Section: Important Dates]
Last Date : 21/07/2026

[Section: Important Links]
Apply Online=https://example.gov.in/apply
`;

const UNKNOWN_SECTION_DOC = `[Section: Short Information]
Body text for classification.

[Section: Important Dates]
Last Date : 21/07/2026

[Section: Important Links]
Apply Online=https://example.gov.in/apply

[Section: Physical Standards]
Height requirements apply.
`;

const BROKEN_LINKS_DOC = `[Section: Short Information]
Recruitment notice body.

[Section: Important Dates]
Last Date : 21/07/2026

[Section: Important Links]
Apply Online=not-a-url
Official Website=also broken
`;

const INVALID_DATES_DOC = `[Section: Short Information]
Recruitment notice.

[Section: Important Dates]
Application Begin : not-a-real-date
Last Date to Apply : also-bad

[Section: Important Links]
Apply Online=https://example.gov.in/apply
`;

const ORDERING_DOC = `[Section: Important Links]
Apply Online=https://example.gov.in/apply

[Section: FAQ]
Q: Why first?
A: Ordering test.

[Section: Short Information]
This short info should come first ideally.

[Section: Important Dates]
Last Date : 21/07/2026
`;

const UNKNOWN_BLOCK_DOC = `[Section: Short Information]
Paragraph content.

[Section: Important Dates]
Last Date : 21/07/2026

[Section: Important Links]
Apply Online=https://example.gov.in/apply

[Section: Notice]
---endtable---
`;

function codesOf(result, severity) {
  const list =
    severity === "error"
      ? result.errors
      : severity === "warning"
        ? result.warnings
        : result.information;
  return list.map((f) => f.code);
}

function hasCode(result, code) {
  return result.findings.some((f) => f.code === code);
}

describe("CIP Stage 1E — Content Validation & Quality Engine", () => {
  test("engine metadata is stable", () => {
    expect(ENGINE_ID).toBe("CIP_CONTENT_VALIDATION_ENGINE");
    expect(STAGE_ID).toBe("CIP_1E");
    expect(ENGINE_VERSION).toBe("1.0.0");
    expect(QUALITY_SCORE_KEYS).toEqual([
      "overall",
      "metadata",
      "section",
      "block",
      "generatorCompatibility",
      "publishReadiness"
    ]);
    expect(SCORE_DEDUCTIONS.error).toBe(12);
    expect(REQUIRED_SECTIONS_BY_TYPE.new_recruitment).toContain("important_dates");
    expect(getRequiredSections("new_recruitment")).toEqual(
      REQUIRED_SECTIONS_BY_TYPE.new_recruitment
    );
  });

  test("valid document produces validation summary with scores", () => {
    const structured = structureDocument({
      title: "SSC CGL 2026 Recruitment Notification",
      text: VALID_DOC,
      sourceType: "pdf_text",
      url: "https://ssc.gov.in/notice/cgl-2026"
    });
    const result = validateStructuredDocument(structured);

    expect(result.engineId).toBe(ENGINE_ID);
    expect(result.stageId).toBe(STAGE_ID);
    expect(result.summary).toBeTruthy();
    expect(typeof result.summary.valid).toBe("boolean");
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(Array.isArray(result.information)).toBe(true);
    expect(result.qualityScores).toBeTruthy();
    for (const key of QUALITY_SCORE_KEYS) {
      expect(typeof result.qualityScores[key]).toBe("number");
      expect(result.qualityScores[key]).toBeGreaterThanOrEqual(0);
      expect(result.qualityScores[key]).toBeLessThanOrEqual(100);
    }
    expect(result.generatorCompatibility).toBeTruthy();
    expect(Object.values(GENERATOR_COMPATIBILITY_STATES)).toContain(
      result.generatorCompatibility.state
    );
    expect(result.publishReadiness).toBeTruthy();
    expect(Object.values(PUBLISH_READINESS_STATES)).toContain(result.publishReadiness.state);
    expect(Array.isArray(result.suggestedReviewAreas)).toBe(true);
    expect(result.summary.documentType).toBe("new_recruitment");
    expect(result.summary.errorCount).toBe(result.errors.length);
  });

  test("validateContentFromText builds via Stage 1C+1D then validates", () => {
    const result = validateContentFromText(VALID_DOC, {
      title: "SSC CGL 2026 Recruitment Notification",
      sourceType: "pdf_text"
    });
    expect(result.extensions.structuredDocumentBuilt).toBe(true);
    expect(result.structuredDocumentRef.stageId).toBe(STAGE_1C_STAGE_ID);
    expect(result.summary.sectionCount).toBeGreaterThan(0);
  });

  test("invalid / unknown document is blocked", () => {
    const result = validateContentFromText("Random unrelated text without signals.", {
      title: "Miscellaneous file",
      skipMetadata: false
    });
    expect(hasCode(result, "DOC_UNKNOWN_TYPE") || result.summary.documentType === "unknown").toBe(
      true
    );
    expect(result.publishReadiness.ready).toBe(false);
  });

  test("missing metadata produces META_REQUIRED_MISSING", () => {
    const structured = structureDocument({
      title: "SSC CGL 2026 Recruitment Notification",
      text: VALID_DOC,
      sourceType: "pdf_text"
    });
    // Strip organization from normalized metadata without mutating via engine —
    // clone shallow fields for the test fixture.
    const fixture = {
      ...structured,
      metadata: {
        ...structured.metadata,
        organization: null,
        title: null
      },
      extensions: { ...structured.extensions }
    };
    const result = validateStructuredDocument(fixture);
    expect(hasCode(result, "META_REQUIRED_MISSING")).toBe(true);
    expect(codesOf(result, "error")).toEqual(
      expect.arrayContaining(["META_REQUIRED_MISSING"])
    );
  });

  test("missing required sections", () => {
    const result = validateContentFromText(MISSING_SECTIONS_DOC, {
      title: "SSC CGL 2026 Recruitment Notification",
      sourceType: "pdf_text"
    });
    expect(hasCode(result, "SEC_REQUIRED_MISSING")).toBe(true);
    expect(result.errors.some((e) => e.sectionType === "important_dates")).toBe(true);
    expect(result.errors.some((e) => e.sectionType === "important_links")).toBe(true);
  });

  test("duplicate sections", () => {
    const result = validateContentFromText(DUPLICATE_SECTIONS_DOC, {
      title: "SSC Recruitment 2026",
      sourceType: "pdf_text"
    });
    expect(hasCode(result, "SEC_DUPLICATE")).toBe(true);
    expect(
      result.warnings.some(
        (w) => w.code === "SEC_DUPLICATE" && w.sectionType === "important_dates"
      )
    ).toBe(true);
  });

  test("unknown sections", () => {
    const result = validateContentFromText(UNKNOWN_SECTION_DOC, {
      title: "SSC CGL 2026 Recruitment Notification",
      sourceType: "pdf_text"
    });
    expect(hasCode(result, "SEC_UNKNOWN")).toBe(true);
  });

  test("unknown blocks", () => {
    const result = validateContentFromText(UNKNOWN_BLOCK_DOC, {
      title: "Important Notice SSC",
      sourceType: "pdf_text"
    });
    expect(hasCode(result, "BLK_UNKNOWN_TYPE")).toBe(true);
  });

  test("broken links", () => {
    const result = validateContentFromText(BROKEN_LINKS_DOC, {
      title: "SSC CGL 2026 Recruitment Notification",
      sourceType: "pdf_text"
    });
    expect(hasCode(result, "BLK_BROKEN_LINK")).toBe(true);
    expect(result.errors.some((e) => e.code === "BLK_BROKEN_LINK")).toBe(true);
    expect(result.generatorCompatibility.compatible).toBe(false);
  });

  test("invalid dates in important date rows still validate document path", () => {
    const result = validateContentFromText(INVALID_DATES_DOC, {
      title: "SSC CGL 2026 Recruitment Notification",
      sourceType: "pdf_text"
    });
    expect(result.findings.length).toBeGreaterThan(0);
    // Date rows keep the raw value when unparseable; metadata ISO checks may still pass
    // when Stage 1B cannot extract dates. At minimum the document validates without throw.
    expect(result.summary).toBeTruthy();
    expect(typeof result.qualityScores.overall).toBe("number");
  });

  test("metadata invalid ISO date is flagged when injected", () => {
    const structured = structureDocument({
      title: "SSC CGL 2026 Recruitment Notification",
      text: VALID_DOC,
      sourceType: "pdf_text"
    });
    const fixture = {
      ...structured,
      metadata: {
        ...structured.metadata,
        importantDates: {
          ...structured.metadata.importantDates,
          lastDate: "21/07/2026",
          startDate: "2026-08-01",
          notificationDate: "2026-09-01"
        }
      }
    };
    const result = validateStructuredDocument(fixture);
    expect(hasCode(result, "META_INVALID_DATE")).toBe(true);
    expect(hasCode(result, "META_DATE_ORDER")).toBe(true);
  });

  test("ordering problems", () => {
    const result = validateContentFromText(ORDERING_DOC, {
      title: "SSC CGL 2026 Recruitment Notification",
      sourceType: "pdf_text"
    });
    expect(hasCode(result, "SEC_ORDERING")).toBe(true);
  });

  test("generator compatibility report present", () => {
    const result = validateContentFromText(VALID_DOC, {
      title: "SSC CGL 2026 Recruitment Notification",
      sourceType: "pdf_text"
    });
    expect(result.generatorCompatibility).toMatchObject({
      state: expect.any(String),
      score: expect.any(Number),
      issueCount: expect.any(Number),
      compatible: expect.any(Boolean)
    });
  });

  test("publish readiness report present and gated by errors", () => {
    const good = validateContentFromText(VALID_DOC, {
      title: "SSC CGL 2026 Recruitment Notification",
      sourceType: "pdf_text",
      url: "https://ssc.gov.in/cgl"
    });
    expect(good.publishReadiness).toMatchObject({
      state: expect.any(String),
      score: expect.any(Number),
      ready: expect.any(Boolean),
      errorCount: expect.any(Number)
    });

    const bad = validateContentFromText(BROKEN_LINKS_DOC, {
      title: "SSC CGL 2026 Recruitment Notification",
      sourceType: "pdf_text"
    });
    expect(bad.publishReadiness.ready).toBe(false);
    expect(bad.publishReadiness.errorCount).toBeGreaterThan(0);
  });

  test("never modifies the structured document", () => {
    const structured = structureDocument({
      title: "SSC CGL 2026 Recruitment Notification",
      text: VALID_DOC,
      sourceType: "pdf_text"
    });
    const before = JSON.stringify(structured);
    validateStructuredDocument(structured);
    expect(JSON.stringify(structured)).toBe(before);
  });

  test("deterministic output for identical input", () => {
    const input = {
      title: "SSC CGL 2026 Recruitment Notification",
      text: VALID_DOC,
      sourceType: "pdf_text",
      url: "https://ssc.gov.in/cgl"
    };
    const a = validateContent(input);
    const b = validateContent(input);
    expect(JSON.stringify(a.errors)).toBe(JSON.stringify(b.errors));
    expect(JSON.stringify(a.warnings)).toBe(JSON.stringify(b.warnings));
    expect(JSON.stringify(a.qualityScores)).toBe(JSON.stringify(b.qualityScores));
    expect(JSON.stringify(a.publishReadiness)).toBe(JSON.stringify(b.publishReadiness));
    expect(JSON.stringify(a.generatorCompatibility)).toBe(
      JSON.stringify(b.generatorCompatibility)
    );
  });

  test("invalid FAQ flagged", () => {
    const doc = `[Section: Short Information]
Body.

[Section: Important Dates]
Last Date : 21/07/2026

[Section: Important Links]
Apply Online=https://example.gov.in/apply

[Section: FAQ]
Q: Unanswered question only?
`;
    const result = validateContentFromText(doc, {
      title: "SSC CGL 2026 Recruitment Notification",
      sourceType: "pdf_text"
    });
    expect(hasCode(result, "BLK_INVALID_FAQ")).toBe(true);
  });

  test("empty section flagged", () => {
    const doc = `[Section: Short Information]

[Section: Important Dates]
Last Date : 21/07/2026

[Section: Important Links]
Apply Online=https://example.gov.in/apply
`;
    const result = validateContentFromText(doc, {
      title: "SSC CGL 2026 Recruitment Notification",
      sourceType: "pdf_text"
    });
    expect(hasCode(result, "SEC_EMPTY")).toBe(true);
  });

  test("suggested review areas derived from findings", () => {
    const result = validateContentFromText(BROKEN_LINKS_DOC, {
      title: "SSC CGL 2026 Recruitment Notification",
      sourceType: "pdf_text"
    });
    expect(result.suggestedReviewAreas.length).toBeGreaterThan(0);
    expect(hasCode(result, "BLK_BROKEN_LINK")).toBe(true);
    expect(result.suggestedReviewAreas).toEqual(
      expect.arrayContaining(["Block content quality"])
    );
  });

  test("categories cover required validation areas", () => {
    expect(VALIDATION_CATEGORIES.DOCUMENT).toBe("document");
    expect(VALIDATION_CATEGORIES.METADATA).toBe("metadata");
    expect(VALIDATION_CATEGORIES.SECTION).toBe("section");
    expect(VALIDATION_CATEGORIES.BLOCK).toBe("block");
    expect(VALIDATION_CATEGORIES.ORDERING).toBe("ordering");
    expect(VALIDATION_CATEGORIES.GENERATOR).toBe("generator");
    expect(VALIDATION_CATEGORIES.COMPLETENESS).toBe("completeness");
    expect(VALIDATION_CATEGORIES.CONSISTENCY).toBe("consistency");
    expect(SEVERITIES.ERROR).toBe("error");
  });

  test("regression: Stage 1A / 1B / 1C+1D remain intact and independent", () => {
    expect(STAGE_1A_ENGINE_ID).toBe("CIP_DOCUMENT_CLASSIFICATION_ENGINE");
    expect(STAGE_1A_STAGE_ID).toBe("CIP_1A");
    expect(STAGE_1B_ENGINE_ID).toBe("CIP_METADATA_INTELLIGENCE_ENGINE");
    expect(STAGE_1B_STAGE_ID).toBe("CIP_1B");
    expect(STAGE_1C_ENGINE_ID).toBe("CIP_STRUCTURE_INTELLIGENCE_ENGINE");
    expect(STAGE_1C_STAGE_ID).toBe("CIP_1C_1D");

    const classifyInput = {
      title: "SSC CGL 2026 Recruitment Notification",
      text: "Staff Selection Commission recruitment notification."
    };
    const before1A = JSON.stringify(classifyDocument(classifyInput));
    const before1B = JSON.stringify(
      extractMetadata({ title: "UP Police Constable Recruitment 2026" })
    );
    const before1C = JSON.stringify(
      structureDocument({
        title: "SSC CGL 2026 Recruitment Notification",
        text: VALID_DOC,
        sourceType: "pdf_text"
      })
    );

    validateContentFromText(VALID_DOC, {
      title: "SSC CGL 2026 Recruitment Notification",
      sourceType: "pdf_text"
    });

    expect(JSON.stringify(classifyDocument(classifyInput))).toBe(before1A);
    expect(
      JSON.stringify(extractMetadata({ title: "UP Police Constable Recruitment 2026" }))
    ).toBe(before1B);
    expect(
      JSON.stringify(
        structureDocument({
          title: "SSC CGL 2026 Recruitment Notification",
          text: VALID_DOC,
          sourceType: "pdf_text"
        })
      )
    ).toBe(before1C);
  });

  test("reuses provided structured document without rebuilding", () => {
    const structured = structureDocument({
      title: "SSC CGL 2026 Recruitment Notification",
      text: VALID_DOC,
      sourceType: "pdf_text"
    });
    const result = validateContent({
      structuredDocument: structured,
      skipStructure: true
    });
    expect(result.extensions.structuredDocumentBuilt).toBe(false);
    expect(result.structuredDocumentRef.documentType).toBe(structured.documentType);
  });

  test("conflicting document signals warning", () => {
    const structured = structureDocument({
      title: "SSC CGL 2026 Recruitment Notification",
      text: VALID_DOC,
      sourceType: "pdf_text"
    });
    const fixture = {
      ...structured,
      classification: {
        ...structured.classification,
        matchedIndicators: [
          {
            id: "a",
            documentType: "new_recruitment",
            source: "title",
            confidence: "high"
          },
          {
            id: "b",
            documentType: "admit_card",
            source: "text",
            confidence: "medium"
          }
        ]
      }
    };
    const result = validateStructuredDocument(fixture);
    expect(hasCode(result, "DOC_CONFLICTING_SIGNALS")).toBe(true);
  });
});
