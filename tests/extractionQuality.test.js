"use strict";

const extractionQuality = require("../server/lib/contentIntelligence/extractionQuality");
const { extractHtml } = require("../server/lib/contentIntelligence/htmlExtraction");
const { correlateDocuments } = require("../server/lib/contentIntelligence/multiSourceCorrelation");

const sourceIntelligence = require("../server/lib/contentIntelligence/sourceIntelligence");
const htmlExtraction = require("../server/lib/contentIntelligence/htmlExtraction");
const pdfExtraction = require("../server/lib/contentIntelligence/pdfExtraction");
const multiSourceCorrelation = require("../server/lib/contentIntelligence/multiSourceCorrelation");
const documentClassification = require("../server/lib/contentIntelligence/documentClassification");
const metadataIntelligence = require("../server/lib/contentIntelligence/metadataIntelligence");
const validationEngine = require("../server/lib/contentIntelligence/validationEngine");

const {
  assessExtractionQuality,
  qualityReportFingerprint,
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  REPORT_VERSION,
  QUALITY_REPORT_FORMAT_ID,
  INPUT_KINDS,
  QUALITY_LEVELS,
  READINESS_STATES,
  SEVERITIES
} = extractionQuality;

function pdfDocument(overrides = {}) {
  const title = overrides.title || "SSC CGL Recruitment 2025 Notification";
  const text =
    overrides.text ||
    [
      title,
      "Organization: Staff Selection Commission",
      "Advertisement No: SSC-CGL-05/2025",
      "Notification Date: 01-01-2025",
      "Last Date: 15-02-2025"
    ].join("\n");
  const headings = overrides.headings || [
    "SSC CGL Recruitment 2025 Notification",
    "Important Dates",
    "Important Links"
  ];
  const contentBlocks = [];
  let order = 1;
  for (const heading of headings) {
    contentBlocks.push({
      id: `block-h-${order}`,
      type: "heading",
      text: heading,
      level: order === 1 ? 1 : 2,
      normalizedLevel: order === 1 ? 1 : 2,
      order: order++,
      pageNumber: 1
    });
    contentBlocks.push({
      id: `block-p-${order}`,
      type: "paragraph",
      text: `Content for ${heading}`,
      order: order++,
      pageNumber: 1
    });
  }
  if (overrides.extraBlocks) contentBlocks.push(...overrides.extraBlocks);

  return {
    engineId: "CIP_PDF_EXTRACTION_ENGINE",
    stageId: "CIP_3C",
    engineVersion: "1.0.0",
    version: "1.0.0",
    formatId: "cip_normalized_pdf_document_v1",
    metadata: {
      pageTitle: title,
      title,
      sourceUrl: overrides.sourceUrl || "https://ssc.gov.in/docs/cgl-2025.pdf",
      baseUrl: overrides.sourceUrl || "https://ssc.gov.in/docs/cgl-2025.pdf",
      canonicalUrl: null,
      creationDate: overrides.creationDate || null,
      modificationDate: overrides.modificationDate || null,
      pageCount: overrides.pageCount != null ? overrides.pageCount : 1,
      ...(overrides.metadata || {})
    },
    pages: [
      {
        pageNumber: 1,
        lineCount: text.split("\n").length,
        text,
        headers: [],
        footers: [],
        blockIds: contentBlocks.map((b) => b.id)
      }
    ],
    contentBlocks,
    structuralTree: {
      type: "document",
      blocks: [],
      resources: [],
      sections: contentBlocks
        .filter((b) => b.type === "heading")
        .map((heading, index) => ({
          type: "section",
          id: `section-${index + 1}`,
          headingBlockId: heading.id,
          actualHeadingLevel: heading.level,
          normalizedHeadingLevel: heading.normalizedLevel,
          blocks: [{ type: "block", blockId: heading.id }],
          subsections: []
        }))
    },
    resourceList: overrides.resourceList || [
      {
        id: "res-1",
        resourceType: "pdf",
        href: "https://ssc.gov.in/docs/cgl-2025.pdf",
        order: 1
      }
    ],
    resourceInventory: overrides.resourceInventory || {
      pdfLinks: [
        {
          id: "res-1",
          resourceType: "pdf",
          href: "https://ssc.gov.in/docs/cgl-2025.pdf"
        }
      ],
      downloads: [],
      images: [],
      attachments: [],
      forms: []
    },
    embeddedDocuments: [],
    navigationReferences: [],
    warnings: overrides.warnings || [],
    extractionSummary: overrides.extractionSummary || {
      contentBlockCount: contentBlocks.length,
      resourceCount: 1,
      sectionCount: headings.length,
      warningCount: 0
    }
  };
}

const HIGH_QUALITY_HTML = `
  <html><head><title>SSC CGL Recruitment 2025 Notification</title></head><body>
    <h1>SSC CGL Recruitment 2025 Notification</h1>
    <p>Organization: Staff Selection Commission</p>
    <p>Advertisement No: SSC-CGL-05/2025</p>
    <h2>Important Dates</h2>
    <p>Notification Date: 01-01-2025</p>
    <p>Last Date: 15-02-2025</p>
    <h2>Application Fee</h2>
    <p>Application Fee: Rs. 100/-</p>
    <h2>Vacancy Details</h2>
    <p>Total Posts: 4500</p>
    <h2>How to Apply</h2>
    <p>Apply online at the official website.</p>
    <h2>Important Links</h2>
    <p><a href="https://ssc.gov.in/docs/cgl-2025.pdf">Download Notification PDF</a></p>
  </body></html>`;

function highQualityHtmlDocument() {
  return extractHtml(HIGH_QUALITY_HTML, {
    sourceUrl: "https://ssc.gov.in/cgl-2025-notification.html"
  });
}

function missingMetadataDocument() {
  return {
    engineId: "CIP_HTML_EXTRACTION_ENGINE",
    stageId: "CIP_3B",
    engineVersion: "1.0.0",
    version: "1.0.0",
    formatId: "cip_normalized_html_document_v1",
    metadata: {
      pageTitle: null,
      title: null,
      sourceUrl: null
    },
    contentBlocks: [
      { id: "block-1", type: "paragraph", text: "Body only.", order: 1 }
    ],
    structuralTree: { type: "document", blocks: [], resources: [], sections: [] },
    resourceList: [],
    resourceInventory: {},
    embeddedDocuments: [],
    navigationReferences: [],
    warnings: [],
    extractionSummary: { contentBlockCount: 1, sectionCount: 0 }
  };
}

function brokenHierarchyDocument() {
  return pdfDocument({
    title: "Broken Hierarchy Notice",
    headings: ["Main Title"],
    extraBlocks: [
      {
        id: "block-h-skip",
        type: "heading",
        text: "Important Dates",
        level: 4,
        normalizedLevel: 2,
        order: 50,
        pageNumber: 1
      },
      {
        id: "block-p-skip",
        type: "paragraph",
        text: "Dates here",
        order: 51,
        pageNumber: 1
      }
    ]
  });
}

function emptySectionsDocument() {
  return {
    engineId: "CIP_HTML_EXTRACTION_ENGINE",
    stageId: "CIP_3B",
    engineVersion: "1.0.0",
    version: "1.0.0",
    formatId: "cip_normalized_html_document_v1",
    metadata: {
      pageTitle: "Empty Sections Notice",
      title: "Empty Sections Notice",
      sourceUrl: "https://example.gov.in/empty.html"
    },
    contentBlocks: [
      { id: "block-1", type: "heading", text: "Important Dates", level: 2, normalizedLevel: 1, order: 1 },
      { id: "block-2", type: "heading", text: "Important Links", level: 2, normalizedLevel: 1, order: 2 }
    ],
    structuralTree: {
      type: "document",
      blocks: [],
      resources: [],
      sections: [
        {
          type: "section",
          id: "section-1",
          headingBlockId: "block-1",
          actualHeadingLevel: 2,
          normalizedHeadingLevel: 1,
          blocks: [],
          subsections: []
        },
        {
          type: "section",
          id: "section-2",
          headingBlockId: "block-2",
          actualHeadingLevel: 2,
          normalizedHeadingLevel: 1,
          blocks: [],
          subsections: []
        }
      ]
    },
    resourceList: [],
    resourceInventory: {},
    embeddedDocuments: [],
    navigationReferences: [],
    warnings: [],
    extractionSummary: { contentBlockCount: 2, sectionCount: 2 }
  };
}

function duplicateBlocksDocument() {
  const doc = pdfDocument({
    title: "Duplicate Blocks Notice",
    headings: ["Duplicate Blocks Notice", "Important Dates"]
  });
  doc.contentBlocks.push({
    id: "block-dup",
    type: "paragraph",
    text: "Content for Important Dates",
    order: 99,
    pageNumber: 1
  });
  return doc;
}

function unknownSectionsDocument() {
  return pdfDocument({
    title: "Odd Document",
    headings: ["Odd Document", "Zebra Protocol Alpha", "Moonbeam Checklist", "Important Dates"],
    sourceUrl: "https://example.gov.in/odd.pdf"
  });
}

function weakCorrelationBundle() {
  return correlateDocuments([
    {
      title: "Unrelated A",
      text: "No shared identity here."
    },
    {
      title: "Unrelated B",
      text: "Completely different topic."
    }
  ]);
}

function timelineInconsistentCorrelation() {
  return {
    engineId: "CIP_MULTI_SOURCE_CORRELATION_ENGINE",
    stageId: "CIP_3D",
    engineVersion: "1.0.0",
    version: "1.0.0",
    formatId: "cip_recruitment_correlation_v1",
    recruitmentIdentity: {
      recruitmentKey: "ssc-cgl-05-2025",
      organization: "Staff Selection Commission",
      advertisementNumber: "SSC-CGL-05/2025",
      hasNotification: true,
      confidence: "high"
    },
    documents: [
      {
        documentId: "doc-1",
        kind: "html",
        role: "result",
        title: "Result",
        sourceUrl: "https://ssc.gov.in/result.html",
        sections: ["result"],
        metadata: { organization: "Staff Selection Commission", advertisementNumber: "SSC-CGL-05/2025" },
        warnings: []
      },
      {
        documentId: "doc-2",
        kind: "pdf",
        role: "notification",
        title: "Notification",
        sourceUrl: "https://ssc.gov.in/notification.pdf",
        sections: ["important_dates"],
        metadata: { organization: "Staff Selection Commission", advertisementNumber: "SSC-CGL-05/2025" },
        warnings: []
      }
    ],
    relationships: [
      {
        fromDocumentId: "doc-1",
        toDocumentId: "doc-2",
        correlated: true,
        confidence: "high",
        evidence: []
      }
    ],
    relationshipGraph: {
      rootId: "recruitment",
      root: { id: "recruitment", type: "recruitment" },
      primaryNotificationId: "doc-2",
      nodes: [],
      edges: [{ from: "recruitment", to: "doc-2", relationshipType: "recruitment->notification" }],
      childrenByRole: {}
    },
    correlationConfidence: "high",
    detectedChanges: [],
    duplicateAnalysis: { pairs: [], marks: {}, exactDuplicateCount: 0 },
    timeline: [
      {
        position: 1,
        documentId: "doc-1",
        role: "result",
        roleLabel: "Result",
        title: "Result",
        date: "2025-08-01",
        dateSource: "importantDates.resultDate"
      },
      {
        position: 2,
        documentId: "doc-2",
        role: "notification",
        roleLabel: "Notification",
        title: "Notification",
        date: "2025-01-01",
        dateSource: "importantDates.notificationDate"
      }
    ],
    unrelatedDocumentIds: [],
    warnings: [],
    summary: { documentCount: 2 }
  };
}

describe("CIP Stage 3E — Extraction Quality & Validation Engine", () => {
  test("publishes stable engine metadata and a frozen quality report", () => {
    const report = assessExtractionQuality(highQualityHtmlDocument());
    expect({
      ENGINE_ID,
      STAGE_ID,
      ENGINE_VERSION,
      REPORT_VERSION,
      QUALITY_REPORT_FORMAT_ID
    }).toEqual({
      ENGINE_ID: "CIP_EXTRACTION_QUALITY_ENGINE",
      STAGE_ID: "CIP_3E",
      ENGINE_VERSION: "1.0.0",
      REPORT_VERSION: "1.0.0",
      QUALITY_REPORT_FORMAT_ID: "cip_extraction_quality_report_v1"
    });
    expect(report.engineId).toBe(ENGINE_ID);
    expect(report.stageId).toBe(STAGE_ID);
    expect(report.formatId).toBe(QUALITY_REPORT_FORMAT_ID);
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.scores)).toBe(true);
    expect(Object.isFrozen(report.validationResults)).toBe(true);
  });

  test("assesses high-quality HTML as strong readiness", () => {
    const report = assessExtractionQuality(highQualityHtmlDocument());
    expect(report.inputKind).toBe(INPUT_KINDS.NORMALIZED_HTML);
    expect(report.scores.overallQuality.score).toBeGreaterThanOrEqual(70);
    expect([
      QUALITY_LEVELS.EXCELLENT,
      QUALITY_LEVELS.GOOD,
      QUALITY_LEVELS.FAIR
    ]).toContain(report.scores.overallQuality.level);
    expect([
      READINESS_STATES.READY,
      READINESS_STATES.READY_WITH_WARNINGS
    ]).toContain(report.readiness.state);
    expect(report.readiness.advisory).toBe(true);
    expect(report.blockingIssues.length).toBe(0);
  });

  test("assesses high-quality PDF document", () => {
    const report = assessExtractionQuality(pdfDocument());
    expect(report.inputKind).toBe(INPUT_KINDS.NORMALIZED_PDF);
    expect(report.documentsAssessed[0].kind).toBe("pdf");
    expect(report.scores.metadataQuality.score).toBeGreaterThanOrEqual(80);
    expect(report.scores.structureQuality.score).toBeGreaterThanOrEqual(60);
    expect(report.summary).toContain("normalized_pdf");
  });

  test("assesses mixed correlated recruitment set", () => {
    const html = highQualityHtmlDocument();
    const pdf = pdfDocument({
      title: "SSC CGL Recruitment 2025 Corrigendum",
      sourceUrl: "https://ssc.gov.in/docs/cgl-2025-corrigendum.pdf",
      headings: ["SSC CGL Recruitment 2025 Corrigendum", "Important Dates"],
      text: [
        "Corrigendum to SSC CGL Recruitment 2025",
        "Organization: Staff Selection Commission",
        "Advertisement No: SSC-CGL-05/2025",
        "Last Date: 28-02-2025"
      ].join("\n")
    });
    const correlation = correlateDocuments([html, pdf]);
    const report = assessExtractionQuality(correlation);

    expect(report.inputKind).toBe(INPUT_KINDS.RECRUITMENT_CORRELATION);
    expect(report.correlationPresent).toBe(true);
    expect(report.documentsAssessed.length).toBe(2);
    expect(report.scores.correlationQuality).toBeDefined();
    expect(report.readiness.state).toBeDefined();
  });

  test("flags missing metadata", () => {
    const report = assessExtractionQuality(missingMetadataDocument());
    expect(report.blockingIssues.some((f) => f.rule === "META_TITLE_MISSING")).toBe(true);
    expect(report.warnings.some((f) => f.rule === "META_SOURCE_URL_MISSING")).toBe(true);
    expect(report.scores.metadataQuality.score).toBeLessThan(90);
    expect([
      READINESS_STATES.NEEDS_REVIEW,
      READINESS_STATES.BLOCKED,
      READINESS_STATES.READY_WITH_WARNINGS
    ]).toContain(report.readiness.state);
  });

  test("flags broken hierarchy", () => {
    const report = assessExtractionQuality(brokenHierarchyDocument());
    expect(report.validationResults.some((f) => f.rule === "HIER_SKIPPED_LEVEL")).toBe(true);
    const finding = report.validationResults.find((f) => f.rule === "HIER_SKIPPED_LEVEL");
    expect(finding.affectedDocument).toBe("doc-1");
    expect(finding.affectedBlock).toBe("block-h-skip");
    expect(finding.validationRule).toBe("HIER_SKIPPED_LEVEL");
  });

  test("flags empty sections", () => {
    const report = assessExtractionQuality(emptySectionsDocument());
    expect(report.validationResults.filter((f) => f.rule === "STRUCT_EMPTY_SECTION").length).toBeGreaterThanOrEqual(2);
  });

  test("flags duplicate structural blocks", () => {
    const report = assessExtractionQuality(duplicateBlocksDocument());
    expect(report.validationResults.some((f) => f.rule === "STRUCT_DUPLICATE_BLOCK")).toBe(true);
  });

  test("flags unknown sections and high unknown ratio", () => {
    const report = assessExtractionQuality(unknownSectionsDocument());
    expect(
      report.validationResults.some(
        (f) => f.rule === "SEC_UNKNOWN_PRESENT" || f.rule === "SEC_UNKNOWN_RATIO_HIGH"
      )
    ).toBe(true);
    expect(report.validationResults.some((f) => f.category === "generator")).toBe(true);
  });

  test("flags weak correlation", () => {
    const report = assessExtractionQuality(weakCorrelationBundle());
    expect(report.inputKind).toBe(INPUT_KINDS.RECRUITMENT_CORRELATION);
    expect(
      report.validationResults.some(
        (f) => f.rule === "CORR_WEAK_CONFIDENCE" || f.rule === "CORR_IDENTITY_WEAK"
      )
    ).toBe(true);
    expect(report.scores.correlationQuality.score).toBeLessThan(100);
  });

  test("flags timeline inconsistency", () => {
    const report = assessExtractionQuality(timelineInconsistentCorrelation());
    expect(
      report.validationResults.some(
        (f) => f.rule === "TIME_OUT_OF_ORDER" || f.rule === "TIME_LIFECYCLE_INVERSION"
      )
    ).toBe(true);
  });

  test("assesses generator compatibility without calling Generator", () => {
    const report = assessExtractionQuality(highQualityHtmlDocument());
    expect(report.validationResults.every((f) => f.category !== "undefined")).toBe(true);
    // High-quality known sections should not be blocked for generator mapping
    expect(report.blockingIssues.some((f) => String(f.rule).startsWith("GEN_"))).toBe(false);
    const unknown = assessExtractionQuality(unknownSectionsDocument());
    expect(unknown.validationResults.some((f) => f.rule === "GEN_UNKNOWN_SECTION" || f.rule === "GEN_LOW_SECTION_MAPPING")).toBe(true);
  });

  test("covers readiness states READY / READY_WITH_WARNINGS / NEEDS_REVIEW / BLOCKED", () => {
    const readyish = assessExtractionQuality(highQualityHtmlDocument());
    expect([
      READINESS_STATES.READY,
      READINESS_STATES.READY_WITH_WARNINGS
    ]).toContain(readyish.readiness.state);

    const warned = assessExtractionQuality(emptySectionsDocument());
    expect([
      READINESS_STATES.READY_WITH_WARNINGS,
      READINESS_STATES.NEEDS_REVIEW,
      READINESS_STATES.READY
    ]).toContain(warned.readiness.state);

    const blocked = assessExtractionQuality(null);
    expect(blocked.readiness.state).toBe(READINESS_STATES.BLOCKED);
    expect(blocked.blockingIssues.some((f) => f.rule === "INPUT_EMPTY")).toBe(true);

    const missing = assessExtractionQuality(missingMetadataDocument());
    expect([
      READINESS_STATES.BLOCKED,
      READINESS_STATES.NEEDS_REVIEW,
      READINESS_STATES.READY_WITH_WARNINGS
    ]).toContain(missing.readiness.state);
  });

  test("every finding carries traceability fields", () => {
    const report = assessExtractionQuality(brokenHierarchyDocument());
    expect(report.validationResults.length).toBeGreaterThan(0);
    for (const finding of report.validationResults) {
      expect(finding).toEqual(
        expect.objectContaining({
          rule: expect.any(String),
          validationRule: expect.any(String),
          severity: expect.any(String),
          category: expect.any(String),
          message: expect.any(String)
        })
      );
      expect(finding).toHaveProperty("affectedDocument");
      expect(finding).toHaveProperty("affectedSection");
      expect(finding).toHaveProperty("affectedBlock");
    }
  });

  test("is deterministic for identical inputs", () => {
    const doc = highQualityHtmlDocument();
    const a = assessExtractionQuality(doc);
    const b = assessExtractionQuality(doc);
    expect(qualityReportFingerprint(a)).toBe(qualityReportFingerprint(b));
    expect(a.scores).toEqual(b.scores);
    expect(a.readiness.state).toBe(b.readiness.state);
  });

  test("supports unknown document input without mutation", () => {
    const unknown = { title: "Mystery", notes: "not normalized" };
    const frozen = Object.freeze({ ...unknown });
    const report = assessExtractionQuality(frozen);
    expect(report.inputKind).toBe(INPUT_KINDS.UNKNOWN);
    expect(frozen.title).toBe("Mystery");
    expect(report.suggestedManualChecks.length).toBeGreaterThan(0);
  });

  test("supports multiple documents without correlation object", () => {
    const report = assessExtractionQuality([highQualityHtmlDocument(), pdfDocument()]);
    expect(report.inputKind).toBe(INPUT_KINDS.MULTIPLE_DOCUMENTS);
    expect(report.documentsAssessed.length).toBe(2);
    expect(report.validationResults.some((f) => f.rule === "CORR_MISSING_FOR_MULTI")).toBe(true);
  });

  test("never modifies input documents (read-only)", () => {
    const html = highQualityHtmlDocument();
    const before = JSON.stringify(html);
    assessExtractionQuality(html);
    expect(JSON.stringify(html)).toBe(before);

    const pdf = pdfDocument();
    const beforePdf = JSON.stringify(pdf);
    assessExtractionQuality(pdf);
    expect(JSON.stringify(pdf)).toBe(beforePdf);
  });

  test("does not modify Program 1, Program 2, or Stages 3A–3D contracts", () => {
    expect(sourceIntelligence.STAGE_ID).toBe("CIP_3A");
    expect(htmlExtraction.STAGE_ID).toBe("CIP_3B");
    expect(pdfExtraction.STAGE_ID).toBe("CIP_3C");
    expect(multiSourceCorrelation.STAGE_ID).toBe("CIP_3D");
    expect(documentClassification.STAGE_ID).toBe("CIP_1A");
    expect(metadataIntelligence.STAGE_ID).toBe("CIP_1B");
    expect(validationEngine.STAGE_ID).toBe("CIP_1E");

    expect(extractionQuality.STAGE_ID).toBe("CIP_3E");
    expect(extractionQuality.ENGINE_ID).toBe("CIP_EXTRACTION_QUALITY_ENGINE");
  });

  test("quality report model includes required fields", () => {
    const report = assessExtractionQuality(highQualityHtmlDocument());
    expect(report).toEqual(
      expect.objectContaining({
        scores: expect.any(Object),
        validationResults: expect.any(Array),
        keyFindings: expect.any(Array),
        warnings: expect.any(Array),
        blockingIssues: expect.any(Array),
        suggestedManualChecks: expect.any(Array),
        readiness: expect.any(Object),
        summary: expect.any(String),
        version: REPORT_VERSION
      })
    );
    expect(report.scores).toEqual(
      expect.objectContaining({
        metadataQuality: expect.objectContaining({ score: expect.any(Number), level: expect.any(String) }),
        structureQuality: expect.objectContaining({ score: expect.any(Number), level: expect.any(String) }),
        extractionQuality: expect.objectContaining({ score: expect.any(Number), level: expect.any(String) }),
        correlationQuality: expect.objectContaining({ score: expect.any(Number), level: expect.any(String) }),
        overallQuality: expect.objectContaining({ score: expect.any(Number), level: expect.any(String) }),
        overallReadiness: expect.objectContaining({ score: expect.any(Number), level: expect.any(String) })
      })
    );
    expect(Object.values(QUALITY_LEVELS)).toContain(report.scores.overallQuality.level);
  });

  test("link integrity is structure-only (no network)", () => {
    const doc = pdfDocument({
      resourceList: [
        { id: "bad", resourceType: "link", href: "javascript:void(0)", order: 1 },
        { id: "empty", resourceType: "url", href: "", order: 2 }
      ],
      resourceInventory: { pdfLinks: [], downloads: [], images: [], attachments: [], forms: [] }
    });
    const report = assessExtractionQuality(doc);
    expect(report.validationResults.some((f) => f.rule === "LINK_STRUCTURALLY_INVALID")).toBe(true);
  });

  test("table integrity findings for irregular rows", () => {
    const doc = pdfDocument({
      extraBlocks: [
        {
          id: "table-1",
          type: "table",
          text: "",
          order: 80,
          rows: [
            ["A", "B"],
            ["C"]
          ],
          headers: ["Col1", "Col2"]
        }
      ]
    });
    const report = assessExtractionQuality(doc);
    expect(report.validationResults.some((f) => f.rule === "TABLE_IRREGULAR_ROWS")).toBe(true);
  });

  test("severity taxonomy remains stable", () => {
    expect(SEVERITIES).toEqual({
      ERROR: "error",
      WARNING: "warning",
      INFO: "info"
    });
  });
});
