"use strict";

const { RESOURCE_TYPES, DOWNLOAD_CATEGORIES } = require("./htmlExtractionTypes");
const {
  normalizeWhitespace,
  normalizeUrl,
  fileExtension,
  isHidden,
  attributesOf
} = require("./normalization");

const DOWNLOAD_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".zip",
  ".rar",
  ".7z",
  ".odt"
]);

function downloadCategory(text, url) {
  const value = `${text} ${url || ""}`.toLowerCase();
  if (/\b(admit[\s_-]*card|hall[\s_-]*ticket)\b/u.test(value)) {
    return DOWNLOAD_CATEGORIES.ADMIT_CARD;
  }
  if (/\banswer[\s_-]*key\b/u.test(value)) return DOWNLOAD_CATEGORIES.ANSWER_KEY;
  if (/\b(result|merit[\s_-]*list|score[\s_-]*card)\b/u.test(value)) {
    return DOWNLOAD_CATEGORIES.RESULT;
  }
  if (/\b(notification|advertisement|corrigendum|notice)\b/u.test(value)) {
    return DOWNLOAD_CATEGORIES.NOTIFICATION;
  }
  if (fileExtension(url)) return DOWNLOAD_CATEGORIES.ATTACHMENT;
  return DOWNLOAD_CATEGORIES.OTHER;
}

function extractResources($, baseUrl, orderOf) {
  const candidates = [];
  const embeddedDocuments = [];
  const navigationReferences = [];

  $(
    "a[href], area[href], img, form, button, input[type=button], input[type=submit], iframe, embed, object"
  ).each((_index, element) => {
    if (isHidden($, element)) return;
    const node = $(element);
    const tag = String(element.tagName || element.name || "").toLowerCase();
    const order = orderOf(element);

    if (tag === "a" || tag === "area") {
      const url = normalizeUrl(node.attr("href"), baseUrl);
      const text = normalizeWhitespace(
        node.text() || node.attr("aria-label") || node.attr("title")
      );
      const extension = fileExtension(url);
      const isPdf = extension === ".pdf" || /\bapplication\/pdf\b/iu.test(node.attr("type") || "");
      const isDownload = node.attr("download") !== undefined || DOWNLOAD_EXTENSIONS.has(extension);
      const resourceType = isPdf
        ? RESOURCE_TYPES.PDF
        : isDownload
          ? RESOURCE_TYPES.DOWNLOAD
          : RESOURCE_TYPES.LINK;
      candidates.push({
        order,
        resourceType,
        url,
        text: text || null,
        download: isDownload,
        category: isDownload ? downloadCategory(text, url) : null,
        metadata: attributesOf($, element, ["title", "target", "rel", "type", "download"])
      });

      if (
        String(node.attr("href") || "").startsWith("#") ||
        node.closest("nav, header, footer, [role=navigation]").length
      ) {
        navigationReferences.push({
          order,
          type: String(node.attr("href") || "").startsWith("#") ? "anchor" : "navigation_link",
          url,
          text: text || null
        });
      }
      if (isPdf) {
        embeddedDocuments.push({
          order,
          type: "linked_pdf",
          url,
          text: text || null
        });
      }
      return;
    }

    if (tag === "img") {
      candidates.push({
        order,
        resourceType: RESOURCE_TYPES.IMAGE,
        url: normalizeUrl(node.attr("src"), baseUrl),
        text: normalizeWhitespace(node.attr("alt")) || null,
        download: false,
        category: null,
        metadata: attributesOf($, element, ["alt", "title", "width", "height", "loading", "srcset"])
      });
      return;
    }

    if (tag === "form") {
      const fields = [];
      node.find("input, select, textarea, button").each((_fieldIndex, field) => {
        if (isHidden($, field)) return;
        const fieldNode = $(field);
        fields.push({
          tag: String(field.tagName || field.name || "").toLowerCase(),
          name: normalizeWhitespace(fieldNode.attr("name")) || null,
          type: normalizeWhitespace(fieldNode.attr("type")) || null,
          required: fieldNode.attr("required") !== undefined
        });
      });
      candidates.push({
        order,
        resourceType: RESOURCE_TYPES.FORM,
        url: normalizeUrl(node.attr("action"), baseUrl),
        text:
          normalizeWhitespace(node.attr("aria-label") || node.attr("name") || node.attr("id")) ||
          null,
        download: false,
        category: null,
        metadata: {
          ...attributesOf($, element, ["id", "name", "method", "enctype", "target"]),
          fields
        }
      });
      return;
    }

    if (tag === "button" || tag === "input") {
      candidates.push({
        order,
        resourceType: RESOURCE_TYPES.BUTTON,
        url: normalizeUrl(node.attr("formaction"), baseUrl),
        text:
          normalizeWhitespace(
            tag === "button"
              ? node.text() || node.attr("aria-label")
              : node.attr("value") || node.attr("aria-label")
          ) || null,
        download: false,
        category: null,
        metadata: attributesOf($, element, ["type", "name", "form", "title", "aria-label"])
      });
      return;
    }

    const rawUrl = tag === "object" ? node.attr("data") : node.attr("src");
    const url = normalizeUrl(rawUrl, baseUrl);
    const type = String(node.attr("type") || "").toLowerCase();
    if (fileExtension(url) === ".pdf" || type.includes("application/pdf")) {
      const embedded = {
        order,
        type: "embedded_pdf",
        url,
        text: normalizeWhitespace(node.attr("title")) || null
      };
      embeddedDocuments.push(embedded);
      candidates.push({
        order,
        resourceType: RESOURCE_TYPES.EMBEDDED_DOCUMENT,
        url,
        text: embedded.text,
        download: false,
        category: DOWNLOAD_CATEGORIES.ATTACHMENT,
        metadata: { element: tag, ...attributesOf($, element, ["type", "title"]) }
      });
    }
  });

  candidates.sort((a, b) => a.order - b.order);
  const seen = new Set();
  const resources = [];
  let duplicateResourceCount = 0;
  for (const candidate of candidates) {
    const key = JSON.stringify([
      candidate.resourceType,
      candidate.url,
      candidate.text,
      candidate.category
    ]);
    if (seen.has(key)) {
      duplicateResourceCount += 1;
      continue;
    }
    seen.add(key);
    resources.push({ id: `resource-${resources.length + 1}`, ...candidate });
  }

  return {
    resources,
    embeddedDocuments: embeddedDocuments.sort((a, b) => a.order - b.order),
    navigationReferences: navigationReferences.sort((a, b) => a.order - b.order),
    duplicateResourceCount
  };
}

module.exports = {
  DOWNLOAD_EXTENSIONS,
  downloadCategory,
  extractResources
};
