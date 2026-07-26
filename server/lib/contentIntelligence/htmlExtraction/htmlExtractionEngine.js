"use strict";

const cheerio = require("cheerio");
const {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  DOCUMENT_VERSION,
  NORMALIZED_HTML_DOCUMENT_FORMAT_ID
} = require("./htmlExtractionTypes");
const {
  normalizeWhitespace,
  normalizeUrl,
  deepFreeze,
  documentFingerprint
} = require("./normalization");
const { extractMetadata } = require("./metadataExtractor");
const { createElementOrder, extractContentBlocks } = require("./contentExtractor");
const { extractResources } = require("./resourceInventory");
const { buildStructuralTree } = require("./structuralTreeBuilder");

function uniqueOrdered(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function countBy(items, key) {
  const output = {};
  for (const item of items) {
    const value = item[key] || "unknown";
    output[value] = (output[value] || 0) + 1;
  }
  return output;
}

function normalizeInput(input, options) {
  if (typeof input === "string") return { ...options, html: input };
  if (input && typeof input === "object" && !Array.isArray(input)) return { ...input, ...options };
  throw new TypeError("HTML extraction input must be an HTML string or an input object.");
}

function hasRelativeReferences($) {
  let found = false;
  $("[href], [src], object[data], form[action]").each((_index, element) => {
    const node = $(element);
    const value = node.attr("href") || node.attr("src") || node.attr("data") || node.attr("action");
    if (
      value &&
      !String(value).startsWith("#") &&
      !/^[a-z][a-z\d+.-]*:/iu.test(String(value)) &&
      !String(value).startsWith("//")
    ) {
      found = true;
      return false;
    }
    return undefined;
  });
  return found;
}

/**
 * Deterministically extract an already-available HTML string.
 * This function performs no network, rendering, crawling, downloading, AI, or OCR.
 */
function extractHtmlDocument(input, options = {}) {
  const normalizedInput = normalizeInput(input, options);
  if (typeof normalizedInput.html !== "string") {
    throw new TypeError("The html field must be a string.");
  }

  const sourceUrl =
    normalizeWhitespace(
      normalizedInput.sourceUrl ||
        normalizedInput.url ||
        normalizedInput.sourceProfile?.identity?.sourceUrl
    ) || null;
  const $ = cheerio.load(normalizedInput.html, {
    decodeEntities: true,
    xmlMode: false
  });

  const declaredBase = normalizeWhitespace($("head base[href]").first().attr("href")) || null;
  const requestedBase = normalizeWhitespace(normalizedInput.baseUrl || sourceUrl) || null;
  const baseUrl = declaredBase ? normalizeUrl(declaredBase, requestedBase) : requestedBase;
  const orderOf = createElementOrder($);

  const metadataResult = extractMetadata($, baseUrl);
  const contentResult = extractContentBlocks($, orderOf);
  const resourceResult = extractResources($, baseUrl, orderOf);
  const embeddedDocuments = uniqueOrdered(resourceResult.embeddedDocuments);
  const navigationReferences = uniqueOrdered(resourceResult.navigationReferences);

  const warnings = metadataResult.warnings.slice();
  if (!normalizeWhitespace(normalizedInput.html)) warnings.push("HTML input is empty.");
  if (!baseUrl && hasRelativeReferences($)) {
    warnings.push("Relative URLs were retained because no base URL was provided.");
  }

  const structuralTree = buildStructuralTree(contentResult.blocks, resourceResult.resources);
  const downloads = resourceResult.resources.filter((resource) => resource.download);
  const images = resourceResult.resources.filter((resource) => resource.resourceType === "image");
  const forms = resourceResult.resources.filter((resource) => resource.resourceType === "form");
  const attachments = resourceResult.resources.filter(
    (resource) =>
      resource.resourceType === "download" ||
      resource.resourceType === "pdf" ||
      resource.resourceType === "embedded_document"
  );

  const document = {
    engineId: ENGINE_ID,
    stageId: STAGE_ID,
    engineVersion: ENGINE_VERSION,
    version: DOCUMENT_VERSION,
    formatId: NORMALIZED_HTML_DOCUMENT_FORMAT_ID,
    metadata: {
      ...metadataResult.metadata,
      sourceUrl,
      baseUrl,
      sourceProfileFormatId: normalizedInput.sourceProfile?.formatId || null
    },
    contentBlocks: contentResult.blocks,
    structuralTree,
    resourceList: resourceResult.resources,
    resourceInventory: {
      pdfLinks: resourceResult.resources.filter((resource) => resource.resourceType === "pdf"),
      downloads,
      notificationDownloads: downloads.filter((resource) => resource.category === "notification"),
      resultDownloads: downloads.filter((resource) => resource.category === "result"),
      admitCardDownloads: downloads.filter((resource) => resource.category === "admit_card"),
      answerKeyDownloads: downloads.filter((resource) => resource.category === "answer_key"),
      images,
      attachments,
      forms
    },
    embeddedDocuments,
    navigationReferences,
    warnings: uniqueOrdered(warnings),
    extractionSummary: {
      contentBlockCount: contentResult.blocks.length,
      contentBlocksByType: countBy(contentResult.blocks, "type"),
      resourceCount: resourceResult.resources.length,
      resourcesByType: countBy(resourceResult.resources, "resourceType"),
      sectionCount: contentResult.blocks.filter((block) => block.type === "heading").length,
      embeddedDocumentCount: embeddedDocuments.length,
      navigationReferenceCount: navigationReferences.length,
      hiddenNodeCount: contentResult.hiddenNodeCount,
      duplicateNodeCount: contentResult.duplicateNodeCount + resourceResult.duplicateResourceCount,
      warningCount: uniqueOrdered(warnings).length
    }
  };

  return normalizedInput.freeze === false ? document : deepFreeze(document);
}

function extractHtml(html, options = {}) {
  return extractHtmlDocument(html, options);
}

function extractHtmlFromString(html, options = {}) {
  return extractHtmlDocument(html, options);
}

function extractHtmlFromSourceProfile(html, sourceProfile, options = {}) {
  return extractHtmlDocument({ ...options, html, sourceProfile });
}

module.exports = {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  DOCUMENT_VERSION,
  NORMALIZED_HTML_DOCUMENT_FORMAT_ID,
  extractHtmlDocument,
  extractHtml,
  extractHtmlFromString,
  extractHtmlFromSourceProfile,
  deepFreeze,
  documentFingerprint
};
