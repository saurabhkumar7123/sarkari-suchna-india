"use strict";

/**
 * CIP Stage 1B — Shared Metadata Intelligence Engine field taxonomy.
 * Extensible: add keys here and corresponding rules/normalizers.
 */

const METADATA_FIELDS = Object.freeze([
  "title",
  "organization",
  "department",
  "recruitmentBoard",
  "advertisementNumber",
  "postName",
  "totalPosts",
  "qualification",
  "ageLimit",
  "applicationMode",
  "category",
  "state",
  "importantDates",
  "officialWebsite",
  "notificationUrl",
  "documentLanguage",
  "sourceType",
  "detectedDocumentType"
]);

const IMPORTANT_DATE_FIELDS = Object.freeze([
  "notificationDate",
  "startDate",
  "lastDate",
  "examDate",
  "resultDate",
  "admitCardDate",
  "answerKeyDate"
]);

const SOURCE_TYPES = Object.freeze([
  "pdf_text",
  "website_text",
  "ai_draft_text",
  "extracted_content",
  "unknown"
]);

const DOCUMENT_LANGUAGES = Object.freeze([
  "en",
  "hi",
  "mixed",
  "unknown"
]);

const CONFIDENCE_LEVELS = Object.freeze(["high", "medium", "low", "none"]);

function createEmptyImportantDates() {
  return {
    notificationDate: null,
    startDate: null,
    lastDate: null,
    examDate: null,
    resultDate: null,
    admitCardDate: null,
    answerKeyDate: null
  };
}

function createEmptyMetadata() {
  return {
    title: null,
    organization: null,
    department: null,
    recruitmentBoard: null,
    advertisementNumber: null,
    postName: null,
    totalPosts: null,
    qualification: null,
    ageLimit: null,
    applicationMode: null,
    category: null,
    state: null,
    importantDates: createEmptyImportantDates(),
    officialWebsite: null,
    notificationUrl: null,
    documentLanguage: null,
    sourceType: null,
    detectedDocumentType: null
  };
}

function createEmptyConfidence() {
  const confidence = Object.create(null);
  for (const field of METADATA_FIELDS) {
    if (field === "importantDates") {
      confidence.importantDates = Object.create(null);
      for (const dateField of IMPORTANT_DATE_FIELDS) {
        confidence.importantDates[dateField] = "none";
      }
    } else {
      confidence[field] = "none";
    }
  }
  return confidence;
}

module.exports = {
  METADATA_FIELDS,
  IMPORTANT_DATE_FIELDS,
  SOURCE_TYPES,
  DOCUMENT_LANGUAGES,
  CONFIDENCE_LEVELS,
  createEmptyImportantDates,
  createEmptyMetadata,
  createEmptyConfidence
};
