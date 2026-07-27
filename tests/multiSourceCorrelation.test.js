"use strict";

const correlation = require("../server/lib/contentIntelligence/multiSourceCorrelation");
const { extractHtml } = require("../server/lib/contentIntelligence/htmlExtraction");
const sourceIntelligence = require("../server/lib/contentIntelligence/sourceIntelligence");
const htmlExtraction = require("../server/lib/contentIntelligence/htmlExtraction");
const pdfExtraction = require("../server/lib/contentIntelligence/pdfExtraction");
const documentClassification = require("../server/lib/contentIntelligence/documentClassification");
const metadataIntelligence = require("../server/lib/contentIntelligence/metadataIntelligence");

const {
  correlateDocuments,
  DOCUMENT_ROLES,
  DUPLICATE_TYPES,
  CHANGE_TYPES,
  EVIDENCE_STRENGTHS,
  GRAPH_ROOT_ID
} = correlation;

/** Build a Stage 3C shaped normalized PDF document without touching Stage 3C. */
function pdfDocument({ title, text, sourceUrl, creationDate = null, modificationDate = null, headings = [] }) {
  return {
    engineId: "CIP_PDF_EXTRACTION_ENGINE",
    stageId: "CIP_3C",
    engineVersion: "1.0.0",
    version: "1.0.0",
    formatId: "cip_normalized_pdf_document_v1",
    metadata: {
      pageTitle: title,
      title,
      sourceUrl: sourceUrl || null,
      baseUrl: sourceUrl || null,
      canonicalUrl: null,
      creationDate,
      modificationDate,
      pageCount: 1
    },
    pages: [{ pageNumber: 1, lineCount: text.split("\n").length, text, headers: [], footers: [], blockIds: [] }],
    contentBlocks: headings.map((heading, index) => ({
      id: `h-${index + 1}`,
      type: "heading",
      text: heading,
      pageNumber: 1
    })),
    structuralTree: {},
    resourceList: [],
    resourceInventory: {},
    embeddedDocuments: [],
    navigationReferences: [],
    warnings: [],
    extractionSummary: {}
  };
}

const NOTIFICATION_HTML = `
  <html><head><title>SSC CGL Recruitment 2025 Notification</title></head><body>
    <h1>SSC CGL Recruitment 2025 Notification</h1>
    <h2>Important Dates</h2>
    <p>Organization: Staff Selection Commission</p>
    <p>Advertisement No: SSC-CGL-05/2025</p>
    <p>Notification Date: 01-01-2025</p>
    <p>Last Date: 15-02-2025</p>
    <p>Total Posts: 4500</p>
    <p>Application Fee: Rs. 100/-</p>
    <p>Official Website: https://ssc.gov.in</p>
    <a href="https://ssc.gov.in/docs/cgl-2025-corrigendum.pdf">Download PDF</a>
  </body></html>`;

function notificationHtmlDocument() {
  return extractHtml(NOTIFICATION_HTML, {
    sourceUrl: "https://ssc.gov.in/cgl-2025-notification.html"
  });
}

function corrigendumPdf() {
  return pdfDocument({
    title: "SSC CGL Recruitment 2025 Corrigendum",
    sourceUrl: "https://ssc.gov.in/docs/cgl-2025-corrigendum.pdf",
    text: [
      "Corrigendum to SSC CGL Recruitment 2025",
      "Organization: Staff Selection Commission",
      "Advertisement No: SSC-CGL-05/2025",
      "Notification Date: 20-01-2025",
      "Last Date: 28-02-2025",
      "Total Posts: 5000",
      "Application Fee: Rs. 150/-"
    ].join("\n")
  });
}

function admitCardPdf() {
  return pdfDocument({
    title: "SSC CGL Recruitment 2025 Admit Card",
    sourceUrl: "https://ssc.gov.in/docs/cgl-2025-admit-card.pdf",
    text: [
      "SSC CGL Recruitment 2025 Admit Card",
      "Organization: Staff Selection Commission",
      "Advertisement No: SSC-CGL-05/2025",
      "Admit Card Date: 25-04-2025"
    ].join("\n")
  });
}

function answerKeyPdf() {
  return pdfDocument({
    title: "SSC CGL Recruitment 2025 Answer Key",
    sourceUrl: "https://ssc.gov.in/docs/cgl-2025-answer-key.pdf",
    text: [
      "SSC CGL Recruitment 2025 Answer Key",
      "Organization: Staff Selection Commission",
      "Advertisement No: SSC-CGL-05/2025",
      "Answer Key Date: 20-05-2025"
    ].join("\n")
  });
}

function resultPdf() {
  return pdfDocument({
    title: "SSC CGL Recruitment 2025 Result",
    sourceUrl: "https://ssc.gov.in/docs/cgl-2025-result.pdf",
    text: [
      "SSC CGL Recruitment 2025 Result",
      "Organization: Staff Selection Commission",
      "Advertisement No: SSC-CGL-05/2025",
      "Result Date: 01-08-2025"
    ].join("\n")
  });
}

function joiningNoticePdf() {
  return pdfDocument({
    title: "SSC CGL Recruitment 2025 Joining Notice",
    sourceUrl: "https://ssc.gov.in/docs/cgl-2025-joining.pdf",
    text: [
      "SSC CGL Recruitment 2025 Joining Notice",
      "Organization: Staff Selection Commission",
      "Advertisement No: SSC-CGL-05/2025"
    ].join("\n")
  });
}

function unrelatedPdf() {
  return pdfDocument({
    title: "BPSC Teacher Vacancy 2025",
    sourceUrl: "https://bpsc.bihar.gov.in/docs/teacher-2025.pdf",
    text: [
      "BPSC Teacher Vacancy 2025",
      "Organization: Bihar Public Service Commission",
      "Last Date: 15-02-2025"
    ].join("\n")
  });
}

function documentByRole(result, role) {
  return result.documents.find((doc) => doc.role === role);
}

describe("CIP Stage 3D — Multi-Source Correlation Engine", () => {
  test("publishes stable engine metadata and a frozen correlation object", () => {
    const result = correlateDocuments([notificationHtmlDocument()]);
    expect({
      engineId: result.engineId,
      stageId: result.stageId,
      engineVersion: result.engineVersion,
      version: result.version,
      formatId: result.formatId
    }).toEqual({
      engineId: "CIP_MULTI_SOURCE_CORRELATION_ENGINE",
      stageId: "CIP_3D",
      engineVersion: "1.0.0",
      version: "1.0.0",
      formatId: "cip_recruitment_correlation_v1"
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.documents)).toBe(true);
    expect(Object.isFrozen(result.relationshipGraph)).toBe(true);
  });

  test("correlates Notification + Corrigendum across mixed HTML and PDF sources", () => {
    const result = correlateDocuments([notificationHtmlDocument(), corrigendumPdf()]);

    const notification = documentByRole(result, DOCUMENT_ROLES.NOTIFICATION);
    const corrigendum = documentByRole(result, DOCUMENT_ROLES.CORRIGENDUM);
    expect(notification.kind).toBe("html");
    expect(corrigendum.kind).toBe("pdf");

    const edge = result.relationships.find(
      (item) => item.fromDocumentId === notification.documentId
    );
    expect(edge.correlated).toBe(true);
    expect(edge.confidence).toBe("high");
    expect(edge.evidence.some((item) => item.strength === EVIDENCE_STRENGTHS.STRONG)).toBe(true);
    expect(edge.evidence.map((item) => item.kind)).toEqual(
      expect.arrayContaining(["advertisement_number", "reference_url", "organization"])
    );

    expect(result.recruitmentIdentity.organization).toBe("Staff Selection Commission");
    expect(result.recruitmentIdentity.advertisementNumber).toBe("SSC-CGL-05/2025");
    expect(result.recruitmentIdentity.hasNotification).toBe(true);
    expect(result.correlationConfidence).toBe("high");
    expect(result.summary.correlatedDocumentCount).toBe(2);
  });

  test("builds a canonical recruitment graph rooted at the notification", () => {
    const result = correlateDocuments([notificationHtmlDocument(), corrigendumPdf()]);
    const graph = result.relationshipGraph;
    const notification = documentByRole(result, DOCUMENT_ROLES.NOTIFICATION);
    const corrigendum = documentByRole(result, DOCUMENT_ROLES.CORRIGENDUM);

    expect(graph.rootId).toBe(GRAPH_ROOT_ID);
    expect(graph.root.type).toBe("recruitment");
    expect(graph.primaryNotificationId).toBe(notification.documentId);
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: GRAPH_ROOT_ID,
          to: notification.documentId,
          relationshipType: "recruitment->notification"
        }),
        expect.objectContaining({
          from: notification.documentId,
          to: corrigendum.documentId,
          relationshipType: "notification->corrigendum",
          evidenceSource: "pairwise_correlation"
        })
      ])
    );
    expect(graph.childrenByRole.notification).toEqual([notification.documentId]);
    expect(graph.childrenByRole.corrigendum).toEqual([corrigendum.documentId]);
  });

  test("detects structured changes from Notification to Corrigendum without rewriting", () => {
    const result = correlateDocuments([notificationHtmlDocument(), corrigendumPdf()]);
    const notification = documentByRole(result, DOCUMENT_ROLES.NOTIFICATION);
    const corrigendum = documentByRole(result, DOCUMENT_ROLES.CORRIGENDUM);

    expect(result.detectedChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          changeType: CHANGE_TYPES.IMPORTANT_DATE,
          field: "importantDates.lastDate",
          previousValue: "2025-02-15",
          currentValue: "2025-02-28",
          previousDocumentId: notification.documentId,
          currentDocumentId: corrigendum.documentId
        }),
        expect.objectContaining({
          changeType: CHANGE_TYPES.VACANCY_COUNT,
          field: "totalPosts",
          previousValue: "4500",
          currentValue: "5000"
        }),
        expect.objectContaining({
          changeType: CHANGE_TYPES.APPLICATION_FEE,
          field: "applicationFee",
          previousValue: "100",
          currentValue: "150"
        })
      ])
    );
    // Structured differences only — no rewritten content fields exist.
    for (const change of result.detectedChanges) {
      expect(Object.keys(change).sort()).toEqual([
        "changeType",
        "currentDocumentId",
        "currentValue",
        "field",
        "previousDocumentId",
        "previousValue"
      ]);
    }
  });

  test("correlates Notification + Admit Card", () => {
    const result = correlateDocuments([notificationHtmlDocument(), admitCardPdf()]);
    const admitCard = documentByRole(result, DOCUMENT_ROLES.ADMIT_CARD);
    expect(admitCard).toBeDefined();
    expect(result.summary.correlatedDocumentCount).toBe(2);
    expect(result.relationshipGraph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ relationshipType: "notification->admit_card" })
      ])
    );
  });

  test("correlates Notification + Result with timeline ordering", () => {
    const result = correlateDocuments([resultPdf(), notificationHtmlDocument()]);
    expect(result.summary.correlatedDocumentCount).toBe(2);
    expect(result.timeline.map((entry) => entry.role)).toEqual([
      DOCUMENT_ROLES.NOTIFICATION,
      DOCUMENT_ROLES.RESULT
    ]);
    expect(result.timeline[0].date).toBe("2025-01-01");
    expect(result.timeline[1].date).toBe("2025-08-01");
  });

  test("correlates Notification + Answer Key", () => {
    const result = correlateDocuments([notificationHtmlDocument(), answerKeyPdf()]);
    const answerKey = documentByRole(result, DOCUMENT_ROLES.ANSWER_KEY);
    expect(answerKey).toBeDefined();
    expect(answerKey.roleLabel).toBe("Answer Key");
    expect(result.summary.correlatedDocumentCount).toBe(2);
  });

  test("correlates multiple PDFs into one deterministic lifecycle timeline", () => {
    const result = correlateDocuments([
      resultPdf(),
      corrigendumPdf(),
      answerKeyPdf(),
      joiningNoticePdf(),
      admitCardPdf(),
      notificationHtmlDocument()
    ]);
    expect(result.summary.correlatedDocumentCount).toBe(6);
    expect(result.timeline.map((entry) => entry.role)).toEqual([
      DOCUMENT_ROLES.NOTIFICATION,
      DOCUMENT_ROLES.CORRIGENDUM,
      DOCUMENT_ROLES.ADMIT_CARD,
      DOCUMENT_ROLES.ANSWER_KEY,
      DOCUMENT_ROLES.RESULT,
      DOCUMENT_ROLES.JOINING_NOTICE
    ]);
    expect(result.timeline.map((entry) => entry.position)).toEqual([1, 2, 3, 4, 5, 6]);
    // Undated joining notice is placed by lifecycle precedence, deterministically last.
    expect(result.timeline[5].date).toBeNull();
  });

  test("marks exact duplicates without deleting either document", () => {
    const original = corrigendumPdf();
    const result = correlateDocuments([notificationHtmlDocument(), original, corrigendumPdf()]);

    expect(result.documents).toHaveLength(3);
    const exactPairs = result.duplicateAnalysis.pairs.filter(
      (pair) => pair.duplicateType === DUPLICATE_TYPES.EXACT_DUPLICATE
    );
    expect(exactPairs).toHaveLength(1);
    expect(exactPairs[0].similarity).toBe(1);
    expect(result.duplicateAnalysis.marks[exactPairs[0].documentIdA].exactDuplicateOf).toContain(
      exactPairs[0].documentIdB
    );
    expect(result.duplicateAnalysis.marks[exactPairs[0].documentIdB].exactDuplicateOf).toContain(
      exactPairs[0].documentIdA
    );
    expect(result.warnings.some((warning) => warning.includes("marked, not removed"))).toBe(true);
  });

  test("marks near duplicates when content differs slightly with no deterministic revision order", () => {
    const baseLines = [
      "UPSC Engineering Services Examination 2025 Notification",
      "Organization: Union Public Service Commission",
      "Advertisement No: UPSC-ES-02/2025",
      "Notification Date: 05-03-2025",
      "Last Date: 25-03-2025",
      "Applications are invited from eligible engineering graduates across the country",
      "for recruitment to various engineering services posts under the central government"
    ];
    const docA = pdfDocument({
      title: "UPSC Engineering Services Examination 2025 Notification",
      sourceUrl: "https://upsc.gov.in/docs/es-2025-a.pdf",
      text: baseLines.join("\n")
    });
    const docB = pdfDocument({
      title: "UPSC Engineering Services Examination 2025 Notification",
      sourceUrl: "https://upsc.gov.in/docs/es-2025-b.pdf",
      text: [...baseLines, "Centre details enclosed"].join("\n")
    });

    const result = correlateDocuments([docA, docB]);
    const nearPairs = result.duplicateAnalysis.pairs.filter(
      (pair) => pair.duplicateType === DUPLICATE_TYPES.NEAR_DUPLICATE
    );
    expect(nearPairs).toHaveLength(1);
    expect(nearPairs[0].similarity).toBeGreaterThanOrEqual(0.85);
    expect(result.documents).toHaveLength(2);
  });

  test("detects replacement and superseded documents plus section-level changes", () => {
    const originalHtml = extractHtml(NOTIFICATION_HTML, {
      sourceUrl: "https://ssc.gov.in/cgl-2025-notification.html"
    });
    const revisedHtml = extractHtml(
      `
      <html><head><title>SSC CGL Recruitment 2025 Notification</title></head><body>
        <h1>SSC CGL Recruitment 2025 Notification</h1>
        <p>Revised notification issued.</p>
        <h2>Important Dates</h2>
        <p>Organization: Staff Selection Commission</p>
        <p>Advertisement No: SSC-CGL-05/2025</p>
        <p>Notification Date: 01-01-2025</p>
        <p>Last Date: 10-03-2025</p>
        <p>Total Posts: 4500</p>
        <p>Application Fee: Rs. 100/-</p>
        <p>Official Website: https://ssc.gov.in</p>
        <h2>Fee Concession</h2>
        <p>Fee concession details for reserved categories.</p>
      </body></html>`,
      { sourceUrl: "https://ssc.gov.in/cgl-2025-notification-revised.html" }
    );

    const result = correlateDocuments([originalHtml, revisedHtml]);
    const replacementPairs = result.duplicateAnalysis.pairs.filter(
      (pair) => pair.duplicateType === DUPLICATE_TYPES.REPLACEMENT
    );
    expect(replacementPairs).toHaveLength(1);
    expect(replacementPairs[0].supersededDocumentId).toBe("doc-1");
    expect(replacementPairs[0].replacementDocumentId).toBe("doc-2");
    expect(result.duplicateAnalysis.marks["doc-1"].supersededBy).toEqual(["doc-2"]);
    expect(result.duplicateAnalysis.marks["doc-2"].replaces).toEqual(["doc-1"]);

    expect(result.detectedChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          changeType: CHANGE_TYPES.IMPORTANT_DATE,
          field: "importantDates.lastDate",
          previousValue: "2025-02-15",
          currentValue: "2025-03-10"
        }),
        expect.objectContaining({
          changeType: CHANGE_TYPES.SECTION_ADDED,
          field: "section",
          currentValue: "fee concession"
        }),
        expect.objectContaining({
          changeType: CHANGE_TYPES.NOTIFICATION_VERSION,
          field: "revisionMarkers"
        })
      ])
    );
  });

  test("never correlates from weak similarity alone and reports unrelated documents", () => {
    const result = correlateDocuments([
      notificationHtmlDocument(),
      corrigendumPdf(),
      unrelatedPdf()
    ]);

    expect(result.summary.correlatedDocumentCount).toBe(2);
    expect(result.unrelatedDocumentIds).toEqual(["doc-3"]);
    const unrelatedDoc = result.documents.find((doc) => doc.documentId === "doc-3");
    expect(unrelatedDoc.correlated).toBe(false);
    expect(
      result.warnings.some((warning) =>
        warning.includes("could not be deterministically correlated")
      )
    ).toBe(true);

    // The shared last date is weak evidence and must never correlate on its own.
    const weakEdge = result.relationships.find(
      (edge) => edge.toDocumentId === "doc-3" && edge.fromDocumentId === "doc-1"
    );
    expect(weakEdge.correlated).toBe(false);
  });

  test("extracts explicit identifier cross-references as strong evidence", () => {
    expect(correlation.extractReferencedIdentifiers("Refer Advt No. XY-07/2025 for details.")).toEqual(
      ["XY-07/2025"]
    );

    const viewA = correlation.buildDocumentView(
      { title: "Zonal Office Public Update", text: "Refer Advt No. XY-07/2025 for details." },
      0
    );
    const viewB = correlation.buildDocumentView(
      {
        title: "Zonal Recruitment 2025",
        text: "Advertisement No: XY-07/2025\nOrganization: Zonal Recruitment Office"
      },
      1
    );
    const evidence = correlation.buildPairEvidence(viewA, viewB);
    expect(evidence.some((item) => item.strength === EVIDENCE_STRENGTHS.STRONG)).toBe(true);
    expect(correlation.evaluatePair(evidence)).toEqual({ correlated: true, confidence: "high" });
  });

  test("keeps full traceability back to every original document", () => {
    const inputs = [notificationHtmlDocument(), corrigendumPdf(), admitCardPdf()];
    const result = correlateDocuments(inputs);

    result.documents.forEach((doc, index) => {
      expect(doc.trace.inputIndex).toBe(index);
      expect(doc.trace.fingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(doc.documentId).toBe(`doc-${index + 1}`);
    });
    expect(result.documents[0].trace.stageId).toBe("CIP_3B");
    expect(result.documents[1].trace.stageId).toBe("CIP_3C");
    expect(result.documents[0].trace.sourceUrl).toBe(
      "https://ssc.gov.in/cgl-2025-notification.html"
    );

    for (const node of result.relationshipGraph.nodes) {
      expect(node.documentRef.fingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(typeof node.documentRef.inputIndex).toBe("number");
    }
    const documentIds = new Set(result.documents.map((doc) => doc.documentId));
    for (const edge of result.relationships) {
      expect(documentIds.has(edge.fromDocumentId)).toBe(true);
      expect(documentIds.has(edge.toDocumentId)).toBe(true);
    }
  });

  test("is fully deterministic across repeated runs", () => {
    const run = () =>
      correlateDocuments([
        resultPdf(),
        corrigendumPdf(),
        answerKeyPdf(),
        joiningNoticePdf(),
        admitCardPdf(),
        notificationHtmlDocument(),
        unrelatedPdf()
      ]);
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  test("handles empty input, single documents, and unknown documents gracefully", () => {
    const empty = correlateDocuments([]);
    expect(empty.warnings).toContain("No documents provided for correlation.");
    expect(empty.correlationConfidence).toBe("none");
    expect(Object.isFrozen(empty)).toBe(true);

    const single = correlateDocuments([{ title: "Some Office Order", text: "General circular content." }]);
    expect(single.documents).toHaveLength(1);
    expect(single.documents[0].role).toBe(DOCUMENT_ROLES.UNKNOWN);
    expect(single.correlationConfidence).toBe("low");
    expect(single.timeline).toHaveLength(1);

    expect(() => correlateDocuments("not-a-list")).toThrow(TypeError);
  });

  test("does not modify Stage 3A, 3B, 3C, or Program 1/2 engine contracts", () => {
    expect(sourceIntelligence.STAGE_ID).toBe("CIP_3A");
    expect(htmlExtraction.STAGE_ID).toBe("CIP_3B");
    expect(pdfExtraction.STAGE_ID).toBe("CIP_3C");
    expect(documentClassification.STAGE_ID).toBe("CIP_1A");
    expect(metadataIntelligence.STAGE_ID).toBe("CIP_1B");

    // Inputs are consumed read-only: a frozen Stage 3B document passes through unchanged.
    const htmlDoc = notificationHtmlDocument();
    const before = JSON.stringify(htmlDoc);
    correlateDocuments([htmlDoc, corrigendumPdf()]);
    expect(JSON.stringify(htmlDoc)).toBe(before);
    expect(Object.isFrozen(htmlDoc)).toBe(true);
  });
});
