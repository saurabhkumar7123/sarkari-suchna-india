"use strict";

const ENGINE_ID = "CIP_PDF_EXTRACTION_ENGINE";
const STAGE_ID = "CIP_3C";
const ENGINE_VERSION = "1.0.0";
const DOCUMENT_VERSION = "1.0.0";
const NORMALIZED_PDF_DOCUMENT_FORMAT_ID = "cip_normalized_pdf_document_v1";

/** Aligned with Stage 3B BLOCK_TYPES where practical, plus PDF-native kinds. */
const BLOCK_TYPES = Object.freeze({
  HEADING: "heading",
  PARAGRAPH: "paragraph",
  LIST: "list",
  TABLE: "table",
  HEADER: "header",
  FOOTER: "footer",
  LINK: "link",
  IMAGE: "image",
  SECTION_TITLE: "section_title"
});

/** Aligned with Stage 3B RESOURCE_TYPES where practical, plus PDF inventory kinds. */
const RESOURCE_TYPES = Object.freeze({
  LINK: "link",
  HYPERLINK: "hyperlink",
  URL: "url",
  EMAIL: "email",
  PHONE: "phone",
  IMAGE: "image",
  ATTACHMENT: "attachment",
  TABLE: "table",
  PAGE_REFERENCE: "page_reference",
  NOTIFICATION_NUMBER: "notification_number",
  DATE: "date",
  PDF: "pdf",
  DOWNLOAD: "download",
  EMBEDDED_DOCUMENT: "embedded_document"
});

const DOWNLOAD_CATEGORIES = Object.freeze({
  NOTIFICATION: "notification",
  RESULT: "result",
  ADMIT_CARD: "admit_card",
  ANSWER_KEY: "answer_key",
  ATTACHMENT: "attachment",
  OTHER: "other"
});

module.exports = {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  DOCUMENT_VERSION,
  NORMALIZED_PDF_DOCUMENT_FORMAT_ID,
  BLOCK_TYPES,
  RESOURCE_TYPES,
  DOWNLOAD_CATEGORIES
};
