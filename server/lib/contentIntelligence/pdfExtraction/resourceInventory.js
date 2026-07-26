"use strict";

const { RESOURCE_TYPES, DOWNLOAD_CATEGORIES } = require("./pdfExtractionTypes");
const {
  normalizeWhitespace,
  normalizeUrl,
  fileExtension,
  uniqueOrdered
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

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const URL_RE = /\bhttps?:\/\/[^\s<>"'()]+|\bwww\.[^\s<>"'()]+/giu;
const PHONE_RE =
  /(?:\+91[\s-]?)?(?:\d{5}[\s-]?\d{5}|\d{3,5}[\s-]?\d{6,8}|\(?\d{2,5}\)?[\s-]?\d{6,10}|\b\d{10}\b)/g;
const DATE_RE =
  /\b(?:\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{2,4}|\d{4}-\d{2}-\d{2})\b/giu;
const NOTIFICATION_RE =
  /\b(?:(?:Advt|Advertisement|Notification|Corrigendum|Notice|F)\.?\s*No\.?\s*[:.-]?\s*[A-Z0-9][A-Z0-9./-]{2,}|(?:No|Ref)\.?\s*[:.-]?\s*[A-Z0-9][A-Z0-9./-]{2,})\b/giu;
const PAGE_REF_RE = /\b(?:page|pg\.?|p\.)\s*(\d{1,4})\b/giu;

function downloadCategory(text, url) {
  const value = `${text || ""} ${url || ""}`.toLowerCase();
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

function collectMatches(text, regex) {
  if (!text) return [];
  const output = [];
  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  const pattern = new RegExp(regex.source, flags);
  let match = pattern.exec(text);
  while (match) {
    output.push(match[0]);
    match = pattern.exec(text);
  }
  return output;
}

function extractResourcesFromDocument({
  pages,
  annotationsByPage,
  attachments,
  images,
  fullText,
  baseUrl
}) {
  const candidates = [];
  let order = 0;
  let duplicateResourceCount = 0;
  const embeddedDocuments = [];
  const navigationReferences = [];

  for (const [pageNumber, annotations] of Object.entries(annotationsByPage)) {
    for (const annotation of annotations) {
      const subtype = String(annotation.subtype || annotation.annotationType || "").toLowerCase();
      const uri =
        normalizeUrl(
          annotation.url ||
            annotation.unsafeUrl ||
            (annotation.action && annotation.action.uri) ||
            null,
          baseUrl
        ) || null;
      const text = normalizeWhitespace(annotation.contents || annotation.title || annotation.alt) || null;

      if (uri && (subtype.includes("link") || annotation.url || annotation.unsafeUrl)) {
        const extension = fileExtension(uri);
        const isPdf = extension === ".pdf";
        const isDownload = DOWNLOAD_EXTENSIONS.has(extension);
        candidates.push({
          order: order++,
          pageNumber: Number(pageNumber),
          resourceType: isPdf ? RESOURCE_TYPES.PDF : RESOURCE_TYPES.HYPERLINK,
          url: uri,
          text,
          download: isDownload,
          category: isDownload ? downloadCategory(text, uri) : null,
          metadata: {
            subtype: annotation.subtype || null,
            annotationId: annotation.id || null
          }
        });
        if (isPdf || isDownload) {
          embeddedDocuments.push({
            order: order - 1,
            type: isPdf ? "linked_pdf" : "linked_attachment",
            url: uri,
            text,
            pageNumber: Number(pageNumber)
          });
        }
      }

      if (subtype.includes("fileattachment") || annotation.file) {
        const fileName =
          normalizeWhitespace(
            (annotation.file && (annotation.file.filename || annotation.file.name)) ||
              annotation.contents ||
              text
          ) || `attachment-page-${pageNumber}`;
        candidates.push({
          order: order++,
          pageNumber: Number(pageNumber),
          resourceType: RESOURCE_TYPES.ATTACHMENT,
          url: null,
          text: fileName,
          download: true,
          category: DOWNLOAD_CATEGORIES.ATTACHMENT,
          metadata: {
            subtype: annotation.subtype || "FileAttachment",
            contentType:
              (annotation.file && (annotation.file.contentType || annotation.file.mimeType)) || null,
            size:
              annotation.file && typeof annotation.file.size === "number" ? annotation.file.size : null
          }
        });
        embeddedDocuments.push({
          order: order - 1,
          type: "embedded_attachment",
          url: null,
          text: fileName,
          pageNumber: Number(pageNumber)
        });
      }
    }
  }

  for (const attachment of attachments) {
    candidates.push({
      order: order++,
      pageNumber: null,
      resourceType: RESOURCE_TYPES.ATTACHMENT,
      url: null,
      text: attachment.filename,
      download: true,
      category: DOWNLOAD_CATEGORIES.ATTACHMENT,
      metadata: {
        contentType: attachment.contentType || null,
        size: typeof attachment.size === "number" ? attachment.size : null,
        description: attachment.description || null
      }
    });
    embeddedDocuments.push({
      order: order - 1,
      type: "embedded_file",
      url: null,
      text: attachment.filename,
      pageNumber: null
    });
  }

  for (const image of images) {
    candidates.push({
      order: order++,
      pageNumber: image.pageNumber,
      resourceType: RESOURCE_TYPES.IMAGE,
      url: null,
      text: image.name || null,
      download: false,
      category: null,
      metadata: {
        name: image.name || null,
        width: image.width || null,
        height: image.height || null
      }
    });
  }

  for (const email of uniqueOrdered(collectMatches(fullText, EMAIL_RE))) {
    candidates.push({
      order: order++,
      pageNumber: null,
      resourceType: RESOURCE_TYPES.EMAIL,
      url: `mailto:${email}`,
      text: email,
      download: false,
      category: null,
      metadata: {}
    });
  }

  for (const phone of uniqueOrdered(collectMatches(fullText, PHONE_RE).map((value) => value.replace(/\s+/gu, " ").trim()))) {
    if (phone.replace(/\D/gu, "").length < 8) continue;
    candidates.push({
      order: order++,
      pageNumber: null,
      resourceType: RESOURCE_TYPES.PHONE,
      url: null,
      text: phone,
      download: false,
      category: null,
      metadata: {}
    });
  }

  for (const rawUrl of uniqueOrdered(collectMatches(fullText, URL_RE))) {
    const url = normalizeUrl(rawUrl.startsWith("www.") ? `http://${rawUrl}` : rawUrl, baseUrl);
    candidates.push({
      order: order++,
      pageNumber: null,
      resourceType: RESOURCE_TYPES.URL,
      url,
      text: rawUrl,
      download: DOWNLOAD_EXTENSIONS.has(fileExtension(url)),
      category: DOWNLOAD_EXTENSIONS.has(fileExtension(url)) ? downloadCategory(rawUrl, url) : null,
      metadata: {}
    });
  }

  for (const date of uniqueOrdered(collectMatches(fullText, DATE_RE))) {
    candidates.push({
      order: order++,
      pageNumber: null,
      resourceType: RESOURCE_TYPES.DATE,
      url: null,
      text: date,
      download: false,
      category: null,
      metadata: {}
    });
  }

  for (const notification of uniqueOrdered(collectMatches(fullText, NOTIFICATION_RE))) {
    candidates.push({
      order: order++,
      pageNumber: null,
      resourceType: RESOURCE_TYPES.NOTIFICATION_NUMBER,
      url: null,
      text: notification,
      download: false,
      category: null,
      metadata: {}
    });
  }

  for (const page of pages) {
    for (const line of page.lines) {
      PAGE_REF_RE.lastIndex = 0;
      let match = PAGE_REF_RE.exec(line.text);
      while (match) {
        const target = Number(match[1]);
        candidates.push({
          order: order++,
          pageNumber: page.pageNumber,
          resourceType: RESOURCE_TYPES.PAGE_REFERENCE,
          url: `#page=${target}`,
          text: match[0],
          download: false,
          category: null,
          metadata: { targetPage: target }
        });
        navigationReferences.push({
          order: order - 1,
          type: "page_reference",
          url: `#page=${target}`,
          text: match[0],
          pageNumber: page.pageNumber
        });
        match = PAGE_REF_RE.exec(line.text);
      }
    }
  }

  for (const page of pages) {
    for (const block of page.tableBlocks || []) {
      candidates.push({
        order: order++,
        pageNumber: page.pageNumber,
        resourceType: RESOURCE_TYPES.TABLE,
        url: null,
        text: block.caption || `table-page-${page.pageNumber}`,
        download: false,
        category: null,
        metadata: { rowCount: block.rows.length }
      });
    }
  }

  candidates.sort((a, b) => a.order - b.order);
  const seen = new Set();
  const resources = [];
  for (const candidate of candidates) {
    const key = JSON.stringify([
      candidate.resourceType,
      candidate.url,
      candidate.text,
      candidate.pageNumber,
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

function buildResourceInventory(resources) {
  const downloads = resources.filter((resource) => resource.download);
  return {
    hyperlinks: resources.filter(
      (resource) =>
        resource.resourceType === RESOURCE_TYPES.HYPERLINK ||
        resource.resourceType === RESOURCE_TYPES.LINK ||
        resource.resourceType === RESOURCE_TYPES.PDF
    ),
    urls: resources.filter((resource) => resource.resourceType === RESOURCE_TYPES.URL),
    emails: resources.filter((resource) => resource.resourceType === RESOURCE_TYPES.EMAIL),
    phoneNumbers: resources.filter((resource) => resource.resourceType === RESOURCE_TYPES.PHONE),
    images: resources.filter((resource) => resource.resourceType === RESOURCE_TYPES.IMAGE),
    attachments: resources.filter(
      (resource) =>
        resource.resourceType === RESOURCE_TYPES.ATTACHMENT ||
        resource.resourceType === RESOURCE_TYPES.EMBEDDED_DOCUMENT ||
        resource.resourceType === RESOURCE_TYPES.DOWNLOAD ||
        resource.resourceType === RESOURCE_TYPES.PDF
    ),
    tables: resources.filter((resource) => resource.resourceType === RESOURCE_TYPES.TABLE),
    pageReferences: resources.filter(
      (resource) => resource.resourceType === RESOURCE_TYPES.PAGE_REFERENCE
    ),
    notificationNumbers: resources.filter(
      (resource) => resource.resourceType === RESOURCE_TYPES.NOTIFICATION_NUMBER
    ),
    dates: resources.filter((resource) => resource.resourceType === RESOURCE_TYPES.DATE),
    // Stage 3B-compatible buckets for shared downstream consumers
    pdfLinks: resources.filter((resource) => resource.resourceType === RESOURCE_TYPES.PDF),
    downloads,
    notificationDownloads: downloads.filter((resource) => resource.category === "notification"),
    resultDownloads: downloads.filter((resource) => resource.category === "result"),
    admitCardDownloads: downloads.filter((resource) => resource.category === "admit_card"),
    answerKeyDownloads: downloads.filter((resource) => resource.category === "answer_key"),
    forms: []
  };
}

module.exports = {
  DOWNLOAD_EXTENSIONS,
  downloadCategory,
  extractResourcesFromDocument,
  buildResourceInventory,
  EMAIL_RE,
  URL_RE,
  PHONE_RE,
  DATE_RE,
  NOTIFICATION_RE
};
