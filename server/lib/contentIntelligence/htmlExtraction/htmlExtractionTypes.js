"use strict";

const ENGINE_ID = "CIP_HTML_EXTRACTION_ENGINE";
const STAGE_ID = "CIP_3B";
const ENGINE_VERSION = "1.0.0";
const DOCUMENT_VERSION = "1.0.0";
const NORMALIZED_HTML_DOCUMENT_FORMAT_ID = "cip_normalized_html_document_v1";

const BLOCK_TYPES = Object.freeze({
  HEADING: "heading",
  PARAGRAPH: "paragraph",
  LIST: "list",
  TABLE: "table",
  DEFINITION_LIST: "definition_list",
  LINK: "link",
  BUTTON: "button",
  FORM: "form",
  IMAGE: "image"
});

const RESOURCE_TYPES = Object.freeze({
  LINK: "link",
  DOWNLOAD: "download",
  PDF: "pdf",
  IMAGE: "image",
  ATTACHMENT: "attachment",
  FORM: "form",
  BUTTON: "button",
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
  NORMALIZED_HTML_DOCUMENT_FORMAT_ID,
  BLOCK_TYPES,
  RESOURCE_TYPES,
  DOWNLOAD_CATEGORIES
};
