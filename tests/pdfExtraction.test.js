"use strict";

const {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  DOCUMENT_VERSION,
  NORMALIZED_PDF_DOCUMENT_FORMAT_ID,
  BLOCK_TYPES,
  extractPdfDocument,
  extractPdf,
  extractPdfFromBuffer,
  extractPdfFromSourceProfile,
  documentFingerprint
} = require("../server/lib/contentIntelligence/pdfExtraction");

const htmlExtraction = require("../server/lib/contentIntelligence/htmlExtraction");
const sourceIntelligence = require("../server/lib/contentIntelligence/sourceIntelligence");
const documentClassification = require("../server/lib/contentIntelligence/documentClassification");
const metadataIntelligence = require("../server/lib/contentIntelligence/metadataIntelligence");
const editorialDecisionSupport = require("../server/lib/contentIntelligence/editorialDecisionSupport");

const {
  notificationPdf,
  resultPdf,
  admitCardPdf,
  answerKeyPdf,
  corrigendumPdf,
  noticePdf,
  multiPageHeaderFooterPdf,
  unknownPdf,
  buildPdf
} = require("./helpers/minimalPdfBuilder");

describe("CIP Stage 3C — PDF Extraction Intelligence Engine", () => {
  test("publishes stable engine metadata and a frozen normalized document", async () => {
    const document = await extractPdf(unknownPdf());
    expect({
      ENGINE_ID,
      STAGE_ID,
      ENGINE_VERSION,
      DOCUMENT_VERSION,
      NORMALIZED_PDF_DOCUMENT_FORMAT_ID
    }).toEqual({
      ENGINE_ID: "CIP_PDF_EXTRACTION_ENGINE",
      STAGE_ID: "CIP_3C",
      ENGINE_VERSION: "1.0.0",
      DOCUMENT_VERSION: "1.0.0",
      NORMALIZED_PDF_DOCUMENT_FORMAT_ID: "cip_normalized_pdf_document_v1"
    });
    expect(Object.isFrozen(document)).toBe(true);
    expect(Object.isFrozen(document.contentBlocks)).toBe(true);
    expect(document.formatId).toBe(NORMALIZED_PDF_DOCUMENT_FORMAT_ID);
  });

  test("extracts notification PDF metadata, sections, contacts, and links", async () => {
    const document = await extractPdfDocument({
      pdf: notificationPdf(),
      sourceUrl: "https://ssc.nic.in/files/notification.pdf"
    });
    expect(document.metadata).toEqual(
      expect.objectContaining({
        pageTitle: "Official Notification",
        title: "Official Notification",
        sourceUrl: "https://ssc.nic.in/files/notification.pdf",
        pageCount: 1
      })
    );
    const texts = document.contentBlocks.map((block) => block.text).filter(Boolean);
    expect(texts.some((text) => /Recruitment Notification/u.test(text))).toBe(true);
    expect(texts.some((text) => /Important Dates/u.test(text))).toBe(true);
    expect(document.resourceInventory.emails[0].text).toBe("helpdesk@ssc.gov.in");
    expect(document.resourceInventory.phoneNumbers.some((item) => /011/.test(item.text))).toBe(
      true
    );
    expect(document.resourceInventory.dates.length).toBeGreaterThan(0);
    expect(document.resourceInventory.notificationNumbers.length).toBeGreaterThan(0);
    expect(document.resourceInventory.hyperlinks.length).toBeGreaterThan(0);
    expect(document.resourceInventory.urls.length).toBeGreaterThan(0);
    expect(document.pages).toHaveLength(1);
  });

  test("extracts result PDF tables in reading order", async () => {
    const document = await extractPdf(resultPdf());
    expect(document.metadata.pageTitle).toBe("Result Notice");
    const table = document.contentBlocks.find((block) => block.type === BLOCK_TYPES.TABLE);
    expect(table).toBeTruthy();
    expect(table.rows[0].section).toBe("head");
    expect(table.rows.length).toBeGreaterThanOrEqual(2);
    expect(document.resourceInventory.tables.length).toBeGreaterThanOrEqual(1);
    expect(
      document.contentBlocks.find((block) => /FINAL RESULT/u.test(block.text || ""))
    ).toBeTruthy();
  });

  test("extracts admit card PDF and inventories image metadata only", async () => {
    const document = await extractPdf(admitCardPdf());
    expect(document.metadata.pageTitle).toBe("Admit Card");
    expect(
      document.contentBlocks.some((block) => /ADMIT CARD/u.test(block.text || ""))
    ).toBe(true);
    expect(document.resourceInventory.images.length).toBeGreaterThanOrEqual(1);
    expect(document.resourceInventory.images[0].metadata).toEqual(
      expect.objectContaining({ name: expect.any(String) })
    );
    expect(document.extractionSummary.imageCount).toBeGreaterThanOrEqual(1);
  });

  test("extracts answer key PDF emails and dates", async () => {
    const document = await extractPdf(answerKeyPdf());
    expect(document.metadata.pageTitle).toBe("Answer Key");
    expect(document.resourceInventory.emails[0].text).toBe("answer-key@exam.gov.in");
    expect(document.resourceInventory.dates.some((item) => /25\/07\/2026/u.test(item.text))).toBe(
      true
    );
  });

  test("extracts corrigendum PDF notification numbers", async () => {
    const document = await extractPdf(corrigendumPdf());
    expect(document.metadata.pageTitle).toBe("Corrigendum");
    const joined = document.resourceInventory.notificationNumbers.map((item) => item.text).join(" ");
    expect(joined).toMatch(/CORR\/07\/2026/u);
    expect(joined).toMatch(/NTF\/01\/2026/u);
  });

  test("extracts notice PDF phone numbers", async () => {
    const document = await extractPdf(noticePdf());
    expect(document.metadata.pageTitle).toBe("Public Notice");
    expect(
      document.resourceInventory.phoneNumbers.some((item) => item.text.includes("9876543210"))
    ).toBe(true);
  });

  test("supports multi-page PDFs with headers, footers, lists, links, and attachments", async () => {
    const document = await extractPdfFromBuffer(multiPageHeaderFooterPdf(), {
      sourceUrl: "https://upsc.gov.in/advt.pdf"
    });
    expect(document.metadata.pageCount).toBe(3);
    expect(document.pages).toHaveLength(3);
    expect(document.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3]);

    const headers = document.contentBlocks.filter((block) => block.type === BLOCK_TYPES.HEADER);
    const footers = document.contentBlocks.filter((block) => block.type === BLOCK_TYPES.FOOTER);
    expect(headers.some((block) => /UNION PUBLIC SERVICE COMMISSION/u.test(block.text))).toBe(
      true
    );
    expect(footers.length).toBeGreaterThan(0);

    const list = document.contentBlocks.find((block) => block.type === BLOCK_TYPES.LIST);
    expect(list).toBeTruthy();
    expect(list.items.map((item) => item.text)).toEqual(
      expect.arrayContaining(["Age limit 18 years", "Graduate degree required"])
    );

    expect(document.resourceInventory.hyperlinks.length).toBeGreaterThan(0);
    expect(document.resourceInventory.attachments.length).toBeGreaterThan(0);
    expect(document.embeddedDocuments.length).toBeGreaterThan(0);
    expect(document.resourceInventory.pageReferences.length).toBeGreaterThan(0);
    expect(document.extractionSummary.suppressedHeaderFooterCount).toBeGreaterThan(0);
  });

  test("normalizes whitespace, line wrapping, and duplicate text without rewriting wording", async () => {
    const document = await extractPdf(
      buildPdf({
        pages: [
          {
            lines: [
              { text: "Applications   are", y: 720 },
              { text: "invited from eligible candidates.", y: 704 },
              { text: "Keep once", y: 660 },
              { text: "Keep once", y: 640 }
            ]
          }
        ]
      })
    );
    const paragraphs = document.contentBlocks.filter((block) => block.type === BLOCK_TYPES.PARAGRAPH);
    expect(
      paragraphs.some((block) => block.text === "Applications are invited from eligible candidates.")
    ).toBe(true);
    expect(paragraphs.filter((block) => block.text === "Keep once")).toHaveLength(1);
    expect(document.extractionSummary.duplicateNodeCount).toBeGreaterThanOrEqual(1);
  });

  test("preserves deterministic reading order across block types", async () => {
    const document = await extractPdf(
      buildPdf({
        pages: [
          {
            lines: [
              { text: "First paragraph", y: 740 },
              { text: "Important Dates", bold: true, fontSize: 14, y: 700 },
              { text: "1. Eligibility item", y: 660 },
              { text: "2. Fee item", y: 640 },
              { text: "Post          Count", y: 600 },
              { text: "Clerk         10", y: 580 }
            ]
          }
        ]
      })
    );
    const types = document.contentBlocks
      .filter((block) => block.type !== BLOCK_TYPES.HEADER && block.type !== BLOCK_TYPES.FOOTER)
      .map((block) => block.type);
    expect(types[0]).toBe("paragraph");
    expect(types).toEqual(expect.arrayContaining(["heading", "list", "table"]));
    const orders = document.contentBlocks.map((block) => block.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  test("builds document → pages → sections → blocks → resources", async () => {
    const document = await extractPdf(multiPageHeaderFooterPdf());
    expect(document.structuralTree.type).toBe("document");
    expect(document.structuralTree.pages).toHaveLength(3);
    expect(document.structuralTree.pages[0].type).toBe("page");
    expect(document.structuralTree.sections.length).toBeGreaterThan(0);
    const section = document.structuralTree.sections[0];
    expect(section.blocks.length).toBeGreaterThan(0);
    expect(section.blocks[0]).toEqual(
      expect.objectContaining({
        type: "block",
        blockId: expect.stringMatching(/^block-/),
        resources: expect.any(Array)
      })
    );
  });

  test("is deterministic for identical PDF bytes", async () => {
    const pdf = notificationPdf();
    const first = await extractPdfDocument({ pdf, sourceUrl: "https://ssc.nic.in/n.pdf" });
    const second = await extractPdfDocument({ pdf, sourceUrl: "https://ssc.nic.in/n.pdf" });
    expect(documentFingerprint(first)).toBe(documentFingerprint(second));
    expect(first).toEqual(second);
  });

  test("can return a mutable document only when explicitly requested", async () => {
    const document = await extractPdf(unknownPdf(), { freeze: false });
    expect(Object.isFrozen(document)).toBe(false);
  });

  test("rejects missing PDF rather than performing acquisition", async () => {
    await expect(extractPdfDocument({ sourceUrl: "https://ssc.gov.in/a.pdf" })).rejects.toThrow(
      /pdf\/buffer field must contain PDF binary data/i
    );
  });

  test("supports Stage 3A source profiles without mutating them", async () => {
    const profile = sourceIntelligence.analyzeSourceFromHtml({
      url: "https://ssc.nic.in/notice.pdf"
    });
    const before = sourceIntelligence.profileFingerprint(profile);
    const document = await extractPdfFromSourceProfile(notificationPdf(), profile);
    expect(document.metadata.sourceUrl).toBe("https://ssc.nic.in/notice.pdf");
    expect(document.metadata.sourceProfileFormatId).toBe("cip_source_profile_v1");
    expect(sourceIntelligence.profileFingerprint(profile)).toBe(before);
  });

  test("aligns common document model fields with Stage 3B HTML documents", async () => {
    const htmlDocument = htmlExtraction.extractHtml(
      "<html><head><title>Notice</title></head><body><h1>Notice</h1><p>Body</p></body></html>"
    );
    const pdfDocument = await extractPdf(noticePdf());
    const sharedKeys = [
      "engineId",
      "stageId",
      "engineVersion",
      "version",
      "formatId",
      "metadata",
      "contentBlocks",
      "structuralTree",
      "resourceList",
      "resourceInventory",
      "embeddedDocuments",
      "navigationReferences",
      "warnings",
      "extractionSummary"
    ];
    for (const key of sharedKeys) {
      expect(htmlDocument).toHaveProperty(key);
      expect(pdfDocument).toHaveProperty(key);
    }
    expect(pdfDocument.structuralTree.type).toBe("document");
    expect(htmlDocument.structuralTree.type).toBe("document");
    expect(pdfDocument.resourceInventory).toEqual(
      expect.objectContaining({
        pdfLinks: expect.any(Array),
        downloads: expect.any(Array),
        images: expect.any(Array),
        attachments: expect.any(Array),
        forms: expect.any(Array)
      })
    );
  });

  test("remains additive and backward compatible with Programs 1, 2, Stage 3A, and Stage 3B", async () => {
    expect(documentClassification.STAGE_ID).toBe("CIP_1A");
    expect(metadataIntelligence.STAGE_ID).toBe("CIP_1B");
    expect(editorialDecisionSupport.STAGE_ID).toBe("CIP_2E");
    expect(sourceIntelligence.STAGE_ID).toBe("CIP_3A");
    expect(htmlExtraction.STAGE_ID).toBe("CIP_3B");
    expect(STAGE_ID).toBe("CIP_3C");
    expect(htmlExtraction.ENGINE_ID).toBe("CIP_HTML_EXTRACTION_ENGINE");
    expect(ENGINE_ID).toBe("CIP_PDF_EXTRACTION_ENGINE");
  });
});
