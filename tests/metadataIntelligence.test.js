"use strict";

const {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  extractMetadata,
  extractMetadataFromText,
  METADATA_FIELDS,
  IMPORTANT_DATE_FIELDS,
  SOURCE_TYPES,
  DOCUMENT_LANGUAGES,
  CONFIDENCE_LEVELS,
  createEmptyMetadata,
  normalizeDateValue,
  normalizeOrganizationValue,
  normalizeStateValue,
  normalizeQualificationValue,
  normalizeApplicationModeValue,
  normalizeAdvertisementNo,
  detectDocumentLanguage,
  normalizeSourceType,
  normalizeMetadata
} = require("../server/lib/contentIntelligence/metadataIntelligence");

const {
  classifyDocument,
  ENGINE_ID: STAGE_1A_ENGINE_ID,
  STAGE_ID: STAGE_1A_STAGE_ID
} = require("../server/lib/contentIntelligence/documentClassification");

const RICH_TEXT = `
Staff Selection Commission
Organization: Staff Selection Commission
Department: Department of Personnel and Training
Recruitment Board: SSC
Advertisement No: SSC/CGL/2026
Post Name: Assistant Section Officer
Total Posts: 7500
Qualification: Graduation
Age Limit: 18 to 32 years
Application Mode: Online
Category: Recruitment
State: All India
Notification Date: 01/03/2026
Start Date: 10 March 2026
Last Date: 15/04/2026
Exam Date: 2026-06-15
Result Date: 20/08/2026
Admit Card Date: 01 June 2026
Answer Key Date: June 20, 2026
Official Website: https://ssc.gov.in
`;

describe("CIP Stage 1B — Metadata Intelligence Engine", () => {
  test("engine metadata is stable", () => {
    expect(ENGINE_ID).toBe("CIP_METADATA_INTELLIGENCE_ENGINE");
    expect(STAGE_ID).toBe("CIP_1B");
    expect(ENGINE_VERSION).toBe("1.0.0");
  });

  test("taxonomy includes all required metadata fields", () => {
    const required = [
      "title",
      "organization",
      "department",
      "recruitmentBoard",
      "advertisementNumber",
      "postName",
      "totalPosts",
      "qualification",
      "ageLimit",
      "applicationMode",
      "category",
      "state",
      "importantDates",
      "officialWebsite",
      "notificationUrl",
      "documentLanguage",
      "sourceType",
      "detectedDocumentType"
    ];
    expect([...METADATA_FIELDS]).toEqual(required);
    expect([...IMPORTANT_DATE_FIELDS]).toEqual([
      "notificationDate",
      "startDate",
      "lastDate",
      "examDate",
      "resultDate",
      "admitCardDate",
      "answerKeyDate"
    ]);
  });

  test("returns structured result shape", () => {
    const result = extractMetadata({
      title: "SSC CGL 2026 Recruitment Notification",
      text: RICH_TEXT,
      sourceType: "pdf_text",
      url: "https://ssc.gov.in/notice/cgl-2026"
    });

    expect(result.engineId).toBe(ENGINE_ID);
    expect(result.stageId).toBe(STAGE_ID);
    expect(result.metadata).toBeTruthy();
    expect(result.normalizedMetadata).toBeTruthy();
    expect(result.confidence).toBeTruthy();
    expect(Array.isArray(result.matchedIndicators)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(result.extensions).toBeTruthy();
    expect(CONFIDENCE_LEVELS).toContain(result.confidence.title);
  });

  test("extracts all supported metadata fields from rich text", () => {
    const result = extractMetadata({
      title: "SSC CGL 2026 Recruitment Notification",
      text: RICH_TEXT,
      sourceType: "pdf_text",
      url: "https://ssc.gov.in/notice/cgl-2026.pdf"
    });

    const n = result.normalizedMetadata;
    expect(n.title).toBe("SSC CGL 2026 Recruitment Notification");
    expect(n.organization).toMatch(/Staff Selection Commission/i);
    expect(n.department).toBeTruthy();
    expect(n.recruitmentBoard).toBeTruthy();
    expect(n.advertisementNumber).toBe("SSC/CGL/2026");
    expect(n.postName).toMatch(/Assistant Section Officer/i);
    expect(n.totalPosts).toBe(7500);
    expect(n.qualification).toBe("graduation");
    expect(n.ageLimit).toMatch(/18/);
    expect(n.applicationMode).toBe("ONLINE");
    expect(n.category).toBeTruthy();
    expect(n.state).toBe("central");
    expect(n.importantDates.notificationDate).toBe("2026-03-01");
    expect(n.importantDates.startDate).toBe("2026-03-10");
    expect(n.importantDates.lastDate).toBe("2026-04-15");
    expect(n.importantDates.examDate).toBe("2026-06-15");
    expect(n.importantDates.resultDate).toBe("2026-08-20");
    expect(n.importantDates.admitCardDate).toBe("2026-06-01");
    expect(n.importantDates.answerKeyDate).toBe("2026-06-20");
    expect(n.officialWebsite).toContain("ssc.gov.in");
    expect(n.notificationUrl).toContain("ssc.gov.in");
    expect(DOCUMENT_LANGUAGES).toContain(n.documentLanguage);
    expect(n.sourceType).toBe("pdf_text");
    expect(n.detectedDocumentType).toBe("new_recruitment");
  });

  test("returns null for missing metadata — never invents", () => {
    const result = extractMetadata({
      title: "Some Notice",
      text: "General information without recruitment fields."
    });
    const n = result.normalizedMetadata;
    expect(n.advertisementNumber).toBeNull();
    expect(n.postName).toBeNull();
    expect(n.totalPosts).toBeNull();
    expect(n.qualification).toBeNull();
    expect(n.ageLimit).toBeNull();
    expect(n.applicationMode).toBeNull();
    expect(n.state).toBeNull();
    expect(n.importantDates.lastDate).toBeNull();
    expect(n.importantDates.examDate).toBeNull();
    expect(n.importantDates.resultDate).toBeNull();
    expect(n.importantDates.admitCardDate).toBeNull();
    expect(n.importantDates.answerKeyDate).toBeNull();
  });

  test("handles empty input", () => {
    const result = extractMetadata({});
    expect(result.normalizedMetadata.title).toBeNull();
    expect(result.normalizedMetadata.organization).toBeNull();
    expect(result.normalizedMetadata.detectedDocumentType).toBe("unknown");
    expect(result.warnings.some((w) => /Empty input/i.test(w))).toBe(true);
    expect(result.matchedIndicators.length).toBeGreaterThanOrEqual(0);
  });

  test("handles partial metadata", () => {
    const result = extractMetadata({
      title: "UPSC CSE Notification",
      text: "Advertisement No: UPSC/CSE/2026\nLast Date: 30/09/2026",
      sourceType: "website_text"
    });
    expect(result.normalizedMetadata.advertisementNumber).toBe("UPSC/CSE/2026");
    expect(result.normalizedMetadata.importantDates.lastDate).toBe("2026-09-30");
    expect(result.normalizedMetadata.postName).toBeNull();
    expect(result.normalizedMetadata.totalPosts).toBeNull();
    expect(result.normalizedMetadata.sourceType).toBe("website_text");
  });

  test("supports multiple date formats", () => {
    expect(normalizeDateValue("2026-04-15")).toBe("2026-04-15");
    expect(normalizeDateValue("15/04/2026")).toBe("2026-04-15");
    expect(normalizeDateValue("15-04-2026")).toBe("2026-04-15");
    expect(normalizeDateValue("15 April 2026")).toBe("2026-04-15");
    expect(normalizeDateValue("April 15, 2026")).toBe("2026-04-15");

    const result = extractMetadataFromText(
      "Start Date: 05/01/2026\nLast Date: 20 February 2026\nExam Date: 2026-07-01"
    );
    expect(result.normalizedMetadata.importantDates.startDate).toBe("2026-01-05");
    expect(result.normalizedMetadata.importantDates.lastDate).toBe("2026-02-20");
    expect(result.normalizedMetadata.importantDates.examDate).toBe("2026-07-01");
  });

  test("removes duplicate indicator noise and keeps first best value", () => {
    const result = extractMetadata({
      text:
        "Advertisement No: RRB/NTPC/2026\nAdvertisement No: RRB/NTPC/2026\nTotal Posts: 100\nTotal Posts: 100"
    });
    expect(result.normalizedMetadata.advertisementNumber).toBe("RRB/NTPC/2026");
    expect(result.normalizedMetadata.totalPosts).toBe(100);
    const advIndicators = result.matchedIndicators.filter(
      (i) => i.field === "advertisementNumber"
    );
    expect(advIndicators.length).toBeGreaterThanOrEqual(1);
  });

  test("flags ambiguous values with warnings", () => {
    const result = extractMetadata({
      text:
        "Advertisement No: A/2026, B/2026\nLast Date: 10/05/2026 or 15/05/2026\nQualification: 10th with 50 posts"
    });
    expect(result.warnings.some((w) => /Ambiguous advertisementNumber/i.test(w))).toBe(true);
    expect(result.warnings.some((w) => /Ambiguous lastDate/i.test(w))).toBe(true);
    expect(result.warnings.some((w) => /vacancy count embedded/i.test(w))).toBe(true);
  });

  test("unknown / unrecognized values stay null or preserved without invention", () => {
    const result = extractMetadata({
      text: "Application Mode: Counter Submission\nState: Unknown Territory XYZ"
    });
    expect(result.normalizedMetadata.applicationMode).toBe("Counter Submission");
    expect(result.normalizedMetadata.state).toBe("unknown territory xyz");
    expect(result.normalizedMetadata.organization).toBeNull();
  });

  test("normalizes organization, state, qualification, application mode, advt no", () => {
    expect(normalizeOrganizationValue("SSC")).toMatch(/Staff Selection Commission/i);
    expect(normalizeStateValue("UP")).toBe("uttar pradesh");
    expect(normalizeStateValue("All India")).toBe("central");
    expect(normalizeQualificationValue("Graduate")).toBe("graduation");
    expect(normalizeQualificationValue("12th Pass")).toBe("12th");
    expect(normalizeApplicationModeValue("Apply Online")).toBe("ONLINE");
    expect(normalizeApplicationModeValue("Offline Form")).toBe("OFFLINE");
    expect(normalizeAdvertisementNo(" ssc / cgl / 2026 ")).toBe("SSC/CGL/2026");
  });

  test("detects document language", () => {
    expect(detectDocumentLanguage("Recruitment Notification")).toBe("en");
    expect(detectDocumentLanguage("भर्ती सूचना")).toBe("hi");
    expect(detectDocumentLanguage("Recruitment भर्ती")).toBe("mixed");
    expect(detectDocumentLanguage("")).toBe("unknown");
  });

  test("normalizes source types for both pipelines", () => {
    expect(normalizeSourceType("pdf_text")).toBe("pdf_text");
    expect(normalizeSourceType(null, { filename: "notice.pdf" })).toBe("pdf_text");
    expect(normalizeSourceType(null, { contentType: "text/html", url: "https://upsc.gov.in" })).toBe(
      "website_text"
    );
    expect(normalizeSourceType(null, { pipeline: "ai_draft" })).toBe("ai_draft_text");
    expect(normalizeSourceType(null, { source: "extracted" })).toBe("extracted_content");
    expect(normalizeSourceType(null, {})).toBe("unknown");
    expect(SOURCE_TYPES).toContain("pdf_text");
    expect(SOURCE_TYPES).toContain("website_text");
  });

  test("reuses Stage 1A detected document type", () => {
    const classification = classifyDocument({
      title: "Download Admit Card for Tier-1 Exam"
    });
    const result = extractMetadata({
      title: "Download Admit Card for Tier-1 Exam",
      text: "Admit Card available from portal.",
      classification
    });
    expect(result.normalizedMetadata.detectedDocumentType).toBe("admit_card");
    expect(result.extensions.classificationReused).toBe(true);
  });

  test("invokes Stage 1A when classification not provided", () => {
    const result = extractMetadata({
      title: "Provisional Answer Key Released",
      text: "Answer Key for candidates."
    });
    expect(result.normalizedMetadata.detectedDocumentType).toBe("answer_key");
    expect(result.extensions.classificationReused).toBe(false);
  });

  test("deterministic output for identical input", () => {
    const input = {
      title: "RRB NTPC Recruitment",
      text: "Advertisement No: RRB/01/2026\nTotal Posts: 3528\nLast Date: 01/05/2026",
      sourceType: "extracted_content",
      url: "https://rrbcdg.gov.in/ntpc"
    };
    const a = extractMetadata(input);
    const b = extractMetadata(input);
    expect(a.normalizedMetadata).toEqual(b.normalizedMetadata);
    expect(a.confidence).toEqual(b.confidence);
    expect(a.matchedIndicators).toEqual(b.matchedIndicators);
    expect(a.warnings).toEqual(b.warnings);
  });

  test("does not modify original source text / input object", () => {
    const input = {
      title: "  Original Title  ",
      text: "Qualification: Graduation",
      metadata: { state: "Bihar" }
    };
    const snapshot = JSON.stringify(input);
    extractMetadata(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  test("empty metadata template has nulls", () => {
    const empty = createEmptyMetadata();
    for (const field of METADATA_FIELDS) {
      if (field === "importantDates") {
        for (const d of IMPORTANT_DATE_FIELDS) {
          expect(empty.importantDates[d]).toBeNull();
        }
      } else {
        expect(empty[field]).toBeNull();
      }
    }
  });

  test("hint metadata is accepted and normalized", () => {
    const result = extractMetadata({
      text: "Body without labels",
      metadata: {
        organization: "UPSC",
        advertisementNumber: "upsc / 2026",
        qualification: "Post Graduate",
        lastDate: "31/12/2026",
        applicationMode: "hybrid"
      }
    });
    expect(result.normalizedMetadata.organization).toMatch(/Union Public Service Commission/i);
    expect(result.normalizedMetadata.advertisementNumber).toBe("UPSC/2026");
    expect(result.normalizedMetadata.qualification).toBe("post graduation");
    expect(result.normalizedMetadata.importantDates.lastDate).toBe("2026-12-31");
    expect(result.normalizedMetadata.applicationMode).toBe("HYBRID");
  });

  test("PDF and website pipelines share the same engine API", () => {
    const pdfResult = extractMetadata({
      title: "IBPS PO Notification",
      text: "Advertisement No: IBPS/PO/2026\nApplication Mode: Online",
      sourceType: "pdf_text",
      filename: "ibps-po.pdf"
    });
    const webResult = extractMetadata({
      title: "IBPS PO Notification",
      text: "Advertisement No: IBPS/PO/2026\nApplication Mode: Online",
      sourceType: "website_text",
      url: "https://ibps.in/po"
    });
    expect(pdfResult.normalizedMetadata.advertisementNumber).toBe(
      webResult.normalizedMetadata.advertisementNumber
    );
    expect(pdfResult.normalizedMetadata.applicationMode).toBe("ONLINE");
    expect(webResult.normalizedMetadata.applicationMode).toBe("ONLINE");
    expect(pdfResult.normalizedMetadata.sourceType).toBe("pdf_text");
    expect(webResult.normalizedMetadata.sourceType).toBe("website_text");
  });

  test("backward compatibility — Stage 1A unchanged and still works", () => {
    expect(STAGE_1A_ENGINE_ID).toBe("CIP_DOCUMENT_CLASSIFICATION_ENGINE");
    expect(STAGE_1A_STAGE_ID).toBe("CIP_1A");
    const classified = classifyDocument({ title: "Final Result Declared" });
    expect(classified.documentType).toBe("result");
    expect(classified.confidence).not.toBe("none");
  });

  test("normalizeMetadata is pure and extensible", () => {
    const normalized = normalizeMetadata(
      {
        title: "  Test  ",
        organization: "NTA",
        importantDates: { examDate: "01/01/2027" },
        sourceType: null,
        documentLanguage: null,
        detectedDocumentType: "exam_pattern"
      },
      { filename: "pattern.pdf" }
    );
    expect(normalized.title).toBe("Test");
    expect(normalized.organization).toMatch(/National Testing Agency/i);
    expect(normalized.importantDates.examDate).toBe("2027-01-01");
    expect(normalized.sourceType).toBe("pdf_text");
    expect(normalized.detectedDocumentType).toBe("exam_pattern");
  });

  test("per-field confidence populated for extracted fields", () => {
    const result = extractMetadata({
      title: "BPSC Notice",
      text: "Advertisement No: BPSC/01/2026\nTotal Posts: 50\nState: Bihar"
    });
    expect(result.confidence.advertisementNumber).not.toBe("none");
    expect(result.confidence.totalPosts).not.toBe("none");
    expect(result.confidence.state).not.toBe("none");
    expect(result.confidence.postName).toBe("none");
  });
});
