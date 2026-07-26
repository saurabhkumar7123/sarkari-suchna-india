"use strict";

/**
 * CIP Stage 3C — shared deterministic PDF Extraction Intelligence Engine.
 *
 * Accepts an already-available PDF for manual or automated workflows.
 * Never downloads, crawls, renders, validates links, invokes AI, or performs OCR.
 */

const engine = require("./pdfExtractionEngine");
const types = require("./pdfExtractionTypes");
const normalization = require("./normalization");
const content = require("./contentExtractor");
const resources = require("./resourceInventory");
const metadata = require("./metadataExtractor");
const structure = require("./structuralTreeBuilder");
const layout = require("./textLayout");
const loader = require("./pdfLoader");

module.exports = {
  ENGINE_ID: engine.ENGINE_ID,
  STAGE_ID: engine.STAGE_ID,
  ENGINE_VERSION: engine.ENGINE_VERSION,
  DOCUMENT_VERSION: engine.DOCUMENT_VERSION,
  NORMALIZED_PDF_DOCUMENT_FORMAT_ID: engine.NORMALIZED_PDF_DOCUMENT_FORMAT_ID,

  // Shared primary API
  extractPdfDocument: engine.extractPdfDocument,
  extractPdf: engine.extractPdf,
  extractPdfFromBuffer: engine.extractPdfFromBuffer,
  extractPdfFromSourceProfile: engine.extractPdfFromSourceProfile,

  // Taxonomy
  BLOCK_TYPES: types.BLOCK_TYPES,
  RESOURCE_TYPES: types.RESOURCE_TYPES,
  DOWNLOAD_CATEGORIES: types.DOWNLOAD_CATEGORIES,

  // Deterministic helpers for tests and extension
  normalizeWhitespace: normalization.normalizeWhitespace,
  normalizeMultiline: normalization.normalizeMultiline,
  joinBrokenParagraph: normalization.joinBrokenParagraph,
  normalizeUrl: normalization.normalizeUrl,
  fileExtension: normalization.fileExtension,
  deepFreeze: normalization.deepFreeze,
  documentFingerprint: normalization.documentFingerprint,
  extractContentFromPages: content.extractContentFromPages,
  DOWNLOAD_EXTENSIONS: resources.DOWNLOAD_EXTENSIONS,
  downloadCategory: resources.downloadCategory,
  extractResourcesFromDocument: resources.extractResourcesFromDocument,
  buildResourceInventory: resources.buildResourceInventory,
  extractMetadata: metadata.extractMetadata,
  buildStructuralTree: structure.buildStructuralTree,
  buildLinesFromTextContent: layout.buildLinesFromTextContent,
  detectRepeatedEdgeLines: layout.detectRepeatedEdgeLines,
  openPdfDocument: loader.openPdfDocument
};
