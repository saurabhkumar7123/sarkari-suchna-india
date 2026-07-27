"use strict";

const path = require("path");
const {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  classifyDocument,
  classifyDocumentFromText,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  CONFIDENCE_LEVELS,
  UNKNOWN_DOCUMENT_TYPE,
  PAGE_STATUS_HINTS,
  isKnownDocumentType,
  getDocumentTypeLabel,
  CLASSIFICATION_RULES,
  buildFieldTexts
} = require("../server/lib/contentIntelligence/documentClassification");

const {
  classifyRecruitmentEventType,
  normalizeRecruitmentNoticeText
} = require("../server/lib/recruitment/eventTypeClassifier");

describe("CIP Stage 1A — Document Classification Engine", () => {
  test("engine metadata is stable", () => {
    expect(ENGINE_ID).toBe("CIP_DOCUMENT_CLASSIFICATION_ENGINE");
    expect(STAGE_ID).toBe("CIP_1A");
    expect(ENGINE_VERSION).toBe("1.0.0");
  });

  test("taxonomy includes all required document types", () => {
    const required = [
      "new_recruitment",
      "admit_card",
      "result",
      "answer_key",
      "correction_notice",
      "short_notice",
      "important_notice",
      "age_relaxation_notice",
      "exam_pattern",
      "syllabus",
      "document",
      "unknown"
    ];
    expect([...DOCUMENT_TYPES]).toEqual(required);
    for (const type of required) {
      expect(DOCUMENT_TYPE_LABELS[type]).toBeTruthy();
      expect(isKnownDocumentType(type)).toBe(true);
    }
  });

  test("labels match product-facing names", () => {
    expect(getDocumentTypeLabel("new_recruitment")).toBe("New Recruitment");
    expect(getDocumentTypeLabel("admit_card")).toBe("Admit Card");
    expect(getDocumentTypeLabel("result")).toBe("Result");
    expect(getDocumentTypeLabel("answer_key")).toBe("Answer Key");
    expect(getDocumentTypeLabel("correction_notice")).toBe("Correction Notice");
    expect(getDocumentTypeLabel("short_notice")).toBe("Short Notice");
    expect(getDocumentTypeLabel("important_notice")).toBe("Important Notice");
    expect(getDocumentTypeLabel("age_relaxation_notice")).toBe("Age Relaxation Notice");
    expect(getDocumentTypeLabel("exam_pattern")).toBe("Exam Pattern");
    expect(getDocumentTypeLabel("syllabus")).toBe("Syllabus");
    expect(getDocumentTypeLabel("document")).toBe("Document");
    expect(getDocumentTypeLabel("unknown")).toBe("Unknown");
  });

  describe("classifyDocument — all supported types", () => {
    const cases = [
      ["new_recruitment", "SSC CGL 2026 Recruitment Notification", "New Recruitment"],
      ["admit_card", "Download Admit Card for Tier-1 Exam", "Admit Card"],
      ["result", "Tier 1 Result Declared", "Result"],
      ["answer_key", "Provisional Answer Key Released", "Answer Key"],
      ["correction_notice", "Corrigendum to Notification No. 03/2026", "Correction Notice"],
      ["short_notice", "Short Notice for Junior Engineer Posts", "Short Notice"],
      ["important_notice", "Important Notice for All Candidates", "Important Notice"],
      ["age_relaxation_notice", "Age Relaxation Notice for Ex-Servicemen", "Age Relaxation Notice"],
      ["exam_pattern", "Examination Pattern and Marks Distribution", "Exam Pattern"],
      ["syllabus", "Detailed Syllabus for Combined Graduate Level", "Syllabus"],
      ["document", "Required Documents Checklist for Verification", "Document"]
    ];

    test.each(cases)("classifies %s from title %s", (documentType, title, label) => {
      const result = classifyDocument({ title });
      expect(result.documentType).toBe(documentType);
      expect(result.documentTypeLabel).toBe(label);
      expect(CONFIDENCE_LEVELS).toContain(result.confidence);
      expect(result.confidence).not.toBe("none");
      expect(result.matchedIndicators.length).toBeGreaterThan(0);
      expect(result.reasoning).toContain(label);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(result.normalizedText.length).toBeGreaterThan(0);
    });
  });

  test("returns structured result shape", () => {
    const result = classifyDocument({ title: "Admit Card Download" });
    expect(result).toEqual(
      expect.objectContaining({
        documentType: expect.any(String),
        documentTypeLabel: expect.any(String),
        confidence: expect.any(String),
        matchedIndicators: expect.any(Array),
        reasoning: expect.any(String),
        warnings: expect.any(Array),
        normalizedText: expect.any(String),
        scores: expect.any(Object)
      })
    );
    expect(result.matchedIndicators[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        documentType: expect.any(String),
        source: expect.any(String),
        confidence: expect.any(String)
      })
    );
  });

  test("unknown for empty input", () => {
    const result = classifyDocument({});
    expect(result.documentType).toBe(UNKNOWN_DOCUMENT_TYPE);
    expect(result.confidence).toBe("none");
    expect(result.matchedIndicators).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test("unknown for unrelated content without guessing", () => {
    const result = classifyDocument({ title: "Office Holiday Calendar 2026" });
    expect(result.documentType).toBe(UNKNOWN_DOCUMENT_TYPE);
    expect(result.confidence).toBe("none");
  });

  test("case-insensitive classification", () => {
    const a = classifyDocument({ title: "admit card download" });
    const b = classifyDocument({ title: "ADMIT CARD DOWNLOAD" });
    expect(a.documentType).toBe("admit_card");
    expect(b.documentType).toBe("admit_card");
  });

  test("uses headings when title is weak", () => {
    const result = classifyDocument({
      title: "Update",
      headings: ["Syllabus for Paper I", "Subject Wise Topics"]
    });
    expect(result.documentType).toBe("syllabus");
  });

  test("uses filename hints", () => {
    const result = classifyDocument({
      title: "Notice",
      filename: "ssc-cgl-answer-key-2026.pdf"
    });
    expect(result.documentType).toBe("answer_key");
  });

  test("uses url path hints", () => {
    const result = classifyDocument({
      title: "SSC update",
      url: "https://ssc.nic.in/admit-card-tier1.html"
    });
    expect(result.documentType).toBe("admit_card");
  });

  test("uses body text when title is generic", () => {
    const result = classifyDocumentFromText(
      "Candidates may download the hall ticket from the portal.",
      { title: "Update" }
    );
    expect(result.documentType).toBe("admit_card");
  });

  test("uses metadata category/status hints", () => {
    const result = classifyDocument({
      title: "Official release",
      metadata: { category: "syllabus", status: "syllabus" }
    });
    expect(result.documentType).toBe("syllabus");
  });

  describe("precedence and ambiguity", () => {
    test("prefers correction_notice over new_recruitment", () => {
      const result = classifyDocument({
        title: "Corrigendum to Recruitment Notification"
      });
      expect(result.documentType).toBe("correction_notice");
    });

    test("prefers short_notice over new_recruitment", () => {
      const result = classifyDocument({
        title: "Short Notice Recruitment for Group D"
      });
      expect(result.documentType).toBe("short_notice");
    });

    test("prefers age_relaxation_notice over important_notice", () => {
      const result = classifyDocument({
        title: "Important Notice — Age Relaxation for OBC Candidates"
      });
      expect(result.documentType).toBe("age_relaxation_notice");
    });

    test("prefers exam_pattern over generic document signals", () => {
      const result = classifyDocument({
        title: "Exam Pattern Document PDF",
        text: "annexure and marks distribution"
      });
      expect(result.documentType).toBe("exam_pattern");
    });

    test("ambiguous result vs answer_key lowers confidence and warns", () => {
      const result = classifyDocument({
        title: "Result and Answer Key Notice"
      });
      expect(["result", "answer_key"]).toContain(result.documentType);
      expect(["medium", "low", "high"]).toContain(result.confidence);
      expect(result.matchedIndicators.length).toBeGreaterThan(0);
      if (result.confidence !== "high") {
        expect(result.warnings.some((w) => /confidence|Ambiguous/i.test(w))).toBe(true);
      }
    });

    test("syllabus vs exam_pattern competing signals remain deterministic", () => {
      const a = classifyDocument({
        title: "Syllabus and Exam Pattern",
        text: "subject wise syllabus with negative marking"
      });
      const b = classifyDocument({
        title: "Syllabus and Exam Pattern",
        text: "subject wise syllabus with negative marking"
      });
      expect(a.documentType).toBe(b.documentType);
      expect(["syllabus", "exam_pattern"]).toContain(a.documentType);
      expect(a.scores).toEqual(b.scores);
    });
  });

  test("pageStatusHint maps where applicable without touching Generator", () => {
    expect(PAGE_STATUS_HINTS.admit_card).toBe("admit card");
    expect(PAGE_STATUS_HINTS.new_recruitment).toBe("latest job");
    expect(PAGE_STATUS_HINTS.syllabus).toBe("syllabus");
    const result = classifyDocument({ title: "Admit Card" });
    expect(result.pageStatusHint).toBe("admit card");
  });

  test("rules are extensible frozen list", () => {
    expect(Array.isArray(CLASSIFICATION_RULES)).toBe(true);
    expect(CLASSIFICATION_RULES.length).toBeGreaterThan(8);
    expect(() => {
      CLASSIFICATION_RULES.push({});
    }).toThrow();
  });

  test("reuses eventTypeClassifier normalization", () => {
    const shared = normalizeRecruitmentNoticeText({ title: "Advt. AC download" });
    const fields = buildFieldTexts({ title: "Advt. AC download" });
    expect(fields.title).toContain("advertisement");
    expect(fields.title).toContain("admit card");
    expect(shared).toContain("admit card");
  });

  describe("backward compatibility", () => {
    test("does not alter recruitment eventTypeClassifier behavior", () => {
      const event = classifyRecruitmentEventType({
        title: "Corrigendum to Recruitment Notification"
      });
      expect(event.eventType).toBe("correction");
      expect(event.matchedRules.length).toBeGreaterThan(0);

      const doc = classifyDocument({
        title: "Corrigendum to Recruitment Notification"
      });
      expect(doc.documentType).toBe("correction_notice");
    });

    test("CIP module path is additive and does not require Generator", () => {
      const resolved = require.resolve(
        "../server/lib/contentIntelligence/documentClassification"
      );
      expect(resolved).toContain(path.join("contentIntelligence", "documentClassification"));
    });

    test("classifyDocumentFromText is available for PDF pipeline callers", () => {
      const result = classifyDocumentFromText("Final Merit List Result");
      expect(result.documentType).toBe("result");
    });
  });

  test("deterministic across repeated calls", () => {
    const input = {
      title: "RRB NTPC Short Notice",
      headings: ["Important Dates"],
      text: "Online application starts soon",
      url: "https://rrb.gov.in/short-notice.pdf"
    };
    const first = classifyDocument(input);
    const second = classifyDocument(input);
    expect(first).toEqual(second);
  });
});
