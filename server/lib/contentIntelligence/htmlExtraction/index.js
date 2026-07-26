"use strict";

/**
 * CIP Stage 3B — shared deterministic HTML Extraction Intelligence Engine.
 *
 * Accepts HTML already supplied by manual or automated workflows. It never
 * downloads, crawls, renders, validates links, invokes AI, or performs OCR.
 */

const engine = require("./htmlExtractionEngine");
const types = require("./htmlExtractionTypes");
const normalization = require("./normalization");
const content = require("./contentExtractor");
const resources = require("./resourceInventory");
const metadata = require("./metadataExtractor");
const structure = require("./structuralTreeBuilder");

module.exports = {
  ENGINE_ID: engine.ENGINE_ID,
  STAGE_ID: engine.STAGE_ID,
  ENGINE_VERSION: engine.ENGINE_VERSION,
  DOCUMENT_VERSION: engine.DOCUMENT_VERSION,
  NORMALIZED_HTML_DOCUMENT_FORMAT_ID: engine.NORMALIZED_HTML_DOCUMENT_FORMAT_ID,

  // Shared primary API
  extractHtmlDocument: engine.extractHtmlDocument,
  extractHtml: engine.extractHtml,
  extractHtmlFromString: engine.extractHtmlFromString,
  extractHtmlFromSourceProfile: engine.extractHtmlFromSourceProfile,

  // Taxonomy
  BLOCK_TYPES: types.BLOCK_TYPES,
  RESOURCE_TYPES: types.RESOURCE_TYPES,
  DOWNLOAD_CATEGORIES: types.DOWNLOAD_CATEGORIES,

  // Deterministic helpers for tests and extension
  normalizeWhitespace: normalization.normalizeWhitespace,
  normalizeUrl: normalization.normalizeUrl,
  fileExtension: normalization.fileExtension,
  deepFreeze: normalization.deepFreeze,
  documentFingerprint: normalization.documentFingerprint,
  createElementOrder: content.createElementOrder,
  extractList: content.extractList,
  extractTable: content.extractTable,
  extractDefinitionList: content.extractDefinitionList,
  extractContentBlocks: content.extractContentBlocks,
  DOWNLOAD_EXTENSIONS: resources.DOWNLOAD_EXTENSIONS,
  downloadCategory: resources.downloadCategory,
  extractResources: resources.extractResources,
  extractMetadata: metadata.extractMetadata,
  buildStructuralTree: structure.buildStructuralTree
};
