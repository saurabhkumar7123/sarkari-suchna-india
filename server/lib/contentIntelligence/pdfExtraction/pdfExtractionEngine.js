"use strict";

const {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  DOCUMENT_VERSION,
  NORMALIZED_PDF_DOCUMENT_FORMAT_ID,
  BLOCK_TYPES
} = require("./pdfExtractionTypes");
const {
  normalizeWhitespace,
  deepFreeze,
  documentFingerprint,
  uniqueOrdered,
  countBy,
  normalizeUrl
} = require("./normalization");
const { openPdfDocument, toUint8Array } = require("./pdfLoader");
const { buildLinesFromTextContent, detectRepeatedEdgeLines } = require("./textLayout");
const { extractMetadata } = require("./metadataExtractor");
const { extractContentFromPages } = require("./contentExtractor");
const {
  extractResourcesFromDocument,
  buildResourceInventory
} = require("./resourceInventory");
const { buildStructuralTree } = require("./structuralTreeBuilder");

function normalizeInput(input, options) {
  if (Buffer.isBuffer(input) || input instanceof Uint8Array || input instanceof ArrayBuffer) {
    return { ...options, pdf: input };
  }
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return { ...input, ...options };
  }
  throw new TypeError("PDF extraction input must be binary PDF data or an input object.");
}

function resolvePdfBytes(normalizedInput) {
  const value =
    normalizedInput.pdf ??
    normalizedInput.buffer ??
    normalizedInput.bytes ??
    normalizedInput.data ??
    null;
  if (value == null) {
    throw new TypeError("The pdf/buffer field must contain PDF binary data.");
  }
  return toUint8Array(value);
}

async function extractPageBundle(pdf) {
  const pageCount = pdf.numPages;
  const pageLineSets = [];
  const annotationsByPage = {};
  const images = [];
  const warnings = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    try {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent({
        disableCombineTextItems: false,
        includeMarkedContent: false
      });
      const lines = buildLinesFromTextContent(textContent, pageNumber, viewport.height);
      pageLineSets.push(lines);

      let annotations = [];
      try {
        annotations = await page.getAnnotations({ intent: "display" });
      } catch {
        warnings.push(`Annotations unavailable for page ${pageNumber}.`);
      }
      annotationsByPage[pageNumber] = annotations;

      try {
        const opList = await page.getOperatorList();
        const { fnArray, argsArray } = opList;
        for (let i = 0; i < fnArray.length; i += 1) {
          const fn = fnArray[i];
          const args = argsArray[i] || [];
          // paintImageXObject family (pdf.js OPS) and fixture parser sentinel (85)
          if (fn === 85 || fn === 86 || fn === 87 || fn === 88) {
            const name = typeof args[0] === "string" ? args[0] : `img-${pageNumber}-${images.length + 1}`;
            let width = null;
            let height = null;
            try {
              const obj = page.objs.get(name);
              if (obj) {
                width = obj.width || null;
                height = obj.height || null;
              }
            } catch {
              // metadata only — missing decoded object is acceptable
            }
            images.push({
              pageNumber,
              name,
              width,
              height
            });
          }
        }
      } catch {
        warnings.push(`Image inventory unavailable for page ${pageNumber}.`);
      }
    } catch {
      warnings.push(`Failed to extract page ${pageNumber}.`);
      pageLineSets.push([]);
      annotationsByPage[pageNumber] = [];
    }
  }

  const headerTexts = detectRepeatedEdgeLines(pageLineSets, "header");
  const footerTexts = detectRepeatedEdgeLines(pageLineSets, "footer");

  const pages = pageLineSets.map((lines, index) => {
    const pageNumber = index + 1;
    return {
      pageNumber,
      lines,
      // Repeated headers/footers require multiple pages; single-page docs keep body intact.
      headerTexts: new Set(
        pageCount > 1
          ? [...headerTexts].filter((text) => lines.some((line) => line.text === text))
          : []
      ),
      footerTexts: new Set(
        pageCount > 1
          ? [...footerTexts].filter((text) => lines.some((line) => line.text === text))
          : lines
              .filter((line) => line.bottomRatio <= 0.1 && /\bpage\s+\d+\b/iu.test(line.text))
              .map((line) => line.text)
      ),
      tableBlocks: []
    };
  });

  return { pages, annotationsByPage, images, warnings, pageCount };
}

async function loadAttachments(pdf) {
  try {
    const attachments = await pdf.getAttachments();
    if (!attachments) return [];
    return Object.entries(attachments)
      .map(([filename, entry]) => ({
        filename: normalizeWhitespace(filename) || "attachment",
        contentType: entry.contentType || entry.mimeType || null,
        description: normalizeWhitespace(entry.description) || null,
        size: entry.content
          ? entry.content.byteLength || entry.content.length || null
          : typeof entry.length === "number"
            ? entry.length
            : null
      }))
      .sort((a, b) => a.filename.localeCompare(b.filename));
  } catch {
    return [];
  }
}

/**
 * Deterministically extract an already-available PDF.
 * No network, downloading, crawling, rendering, AI, or OCR.
 */
async function extractPdfDocument(input, options = {}) {
  const normalizedInput = normalizeInput(input, options);
  const pdfBytes = resolvePdfBytes(normalizedInput);
  const sourceUrl =
    normalizeWhitespace(
      normalizedInput.sourceUrl ||
        normalizedInput.url ||
        normalizedInput.sourceProfile?.identity?.sourceUrl
    ) || null;
  const baseUrl =
    normalizeWhitespace(normalizedInput.baseUrl || sourceUrl) || null;

  const warnings = [];
  let pdf;
  let openWarnings = [];
  try {
    const opened = await openPdfDocument(pdfBytes);
    pdf = opened.pdf;
    openWarnings = opened.warnings || [];
  } catch (error) {
    if (error && error.code === "EMPTY_PDF") {
      warnings.push("PDF input is empty.");
      const emptyDocument = {
        engineId: ENGINE_ID,
        stageId: STAGE_ID,
        engineVersion: ENGINE_VERSION,
        version: DOCUMENT_VERSION,
        formatId: NORMALIZED_PDF_DOCUMENT_FORMAT_ID,
        metadata: {
          pageTitle: null,
          title: null,
          author: null,
          subject: null,
          keywords: null,
          creator: null,
          producer: null,
          language: null,
          description: null,
          canonicalUrl: null,
          creationDate: null,
          modificationDate: null,
          pageCount: 0,
          pdfVersion: null,
          isEncrypted: false,
          metaTags: [],
          structuredData: [],
          sourceUrl,
          baseUrl,
          sourceProfileFormatId: normalizedInput.sourceProfile?.formatId || null
        },
        pages: [],
        contentBlocks: [],
        structuralTree: { type: "document", pages: [], blocks: [], resources: [], sections: [] },
        resourceList: [],
        resourceInventory: buildResourceInventory([]),
        embeddedDocuments: [],
        navigationReferences: [],
        warnings: uniqueOrdered(warnings),
        extractionSummary: {
          pageCount: 0,
          contentBlockCount: 0,
          contentBlocksByType: {},
          resourceCount: 0,
          resourcesByType: {},
          sectionCount: 0,
          embeddedDocumentCount: 0,
          navigationReferenceCount: 0,
          imageCount: 0,
          attachmentCount: 0,
          duplicateNodeCount: 0,
          suppressedHeaderFooterCount: 0,
          warningCount: warnings.length
        }
      };
      return normalizedInput.freeze === false ? emptyDocument : deepFreeze(emptyDocument);
    }
    throw error;
  }

  try {
    warnings.push(...openWarnings);
    let metaResult = { info: {}, metadata: null };
    try {
      metaResult = await pdf.getMetadata();
    } catch {
      warnings.push("PDF metadata dictionary could not be read.");
    }

    const pageBundle = await extractPageBundle(pdf);
    warnings.push(...pageBundle.warnings);

    const attachments = await loadAttachments(pdf);
    const metadataResult = extractMetadata(pdf, metaResult, pageBundle.pageCount, {
      sourceUrl,
      baseUrl,
      sourceProfile: normalizedInput.sourceProfile,
      language: normalizedInput.language
    });
    warnings.push(...metadataResult.warnings);

    const contentResult = extractContentFromPages(pageBundle.pages);
    for (const block of contentResult.blocks) {
      if (block.type === BLOCK_TYPES.TABLE) {
        const page = pageBundle.pages.find((entry) => entry.pageNumber === block.pageNumber);
        if (page) page.tableBlocks.push(block);
      }
    }

    const fullText = pageBundle.pages
      .map((page) => page.lines.map((line) => line.text).join("\n"))
      .join("\n\n");

    const resourceResult = extractResourcesFromDocument({
      pages: pageBundle.pages,
      annotationsByPage: pageBundle.annotationsByPage,
      attachments,
      images: pageBundle.images,
      fullText,
      baseUrl
    });

    if (!baseUrl) {
      const hasRelative = resourceResult.resources.some(
        (resource) =>
          resource.url &&
          !String(resource.url).startsWith("#") &&
          !/^[a-z][a-z\d+.-]*:/iu.test(String(resource.url))
      );
      if (hasRelative) {
        warnings.push("Relative URLs were retained because no base URL was provided.");
      }
    }

    const structuralTree = buildStructuralTree(
      contentResult.blocks,
      resourceResult.resources,
      pageBundle.pageCount
    );
    const resourceInventory = buildResourceInventory(resourceResult.resources);

    const pages = pageBundle.pages.map((page) => ({
      pageNumber: page.pageNumber,
      lineCount: page.lines.length,
      text: page.lines.map((line) => line.text).join("\n"),
      headers: [...page.headerTexts],
      footers: [...page.footerTexts],
      blockIds: contentResult.blocks
        .filter((block) => block.pageNumber === page.pageNumber)
        .map((block) => block.id)
    }));

    const document = {
      engineId: ENGINE_ID,
      stageId: STAGE_ID,
      engineVersion: ENGINE_VERSION,
      version: DOCUMENT_VERSION,
      formatId: NORMALIZED_PDF_DOCUMENT_FORMAT_ID,
      metadata: metadataResult.metadata,
      pages,
      contentBlocks: contentResult.blocks,
      structuralTree,
      resourceList: resourceResult.resources,
      resourceInventory,
      embeddedDocuments: uniqueOrdered(resourceResult.embeddedDocuments),
      navigationReferences: uniqueOrdered(resourceResult.navigationReferences),
      warnings: uniqueOrdered(warnings),
      extractionSummary: {
        pageCount: pageBundle.pageCount,
        contentBlockCount: contentResult.blocks.length,
        contentBlocksByType: countBy(contentResult.blocks, "type"),
        resourceCount: resourceResult.resources.length,
        resourcesByType: countBy(resourceResult.resources, "resourceType"),
        sectionCount: contentResult.blocks.filter(
          (block) => block.type === BLOCK_TYPES.HEADING || block.type === BLOCK_TYPES.SECTION_TITLE
        ).length,
        embeddedDocumentCount: resourceResult.embeddedDocuments.length,
        navigationReferenceCount: resourceResult.navigationReferences.length,
        imageCount: resourceInventory.images.length,
        attachmentCount: resourceInventory.attachments.length,
        duplicateNodeCount:
          contentResult.duplicateNodeCount + resourceResult.duplicateResourceCount,
        suppressedHeaderFooterCount: contentResult.suppressedHeaderFooterCount,
        warningCount: uniqueOrdered(warnings).length
      }
    };

    return normalizedInput.freeze === false ? document : deepFreeze(document);
  } finally {
    if (pdf) await pdf.destroy().catch(() => {});
  }
}

function extractPdf(pdf, options = {}) {
  return extractPdfDocument(pdf, options);
}

function extractPdfFromBuffer(buffer, options = {}) {
  return extractPdfDocument({ ...options, buffer });
}

function extractPdfFromSourceProfile(pdf, sourceProfile, options = {}) {
  return extractPdfDocument({ ...options, pdf, sourceProfile });
}

module.exports = {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  DOCUMENT_VERSION,
  NORMALIZED_PDF_DOCUMENT_FORMAT_ID,
  extractPdfDocument,
  extractPdf,
  extractPdfFromBuffer,
  extractPdfFromSourceProfile,
  deepFreeze,
  documentFingerprint,
  normalizeUrl
};
