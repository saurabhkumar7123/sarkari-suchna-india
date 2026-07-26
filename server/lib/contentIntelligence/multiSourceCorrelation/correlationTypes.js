"use strict";

/**
 * CIP Stage 3D — Multi-Source Correlation Engine taxonomy.
 * Deterministic constants only. Extensible via frozen maps.
 */

const ENGINE_ID = "CIP_MULTI_SOURCE_CORRELATION_ENGINE";
const STAGE_ID = "CIP_3D";
const ENGINE_VERSION = "1.0.0";
const CORRELATION_VERSION = "1.0.0";
const RECRUITMENT_CORRELATION_FORMAT_ID = "cip_recruitment_correlation_v1";

/** Canonical lifecycle roles a correlated document can play. */
const DOCUMENT_ROLES = Object.freeze({
  NOTIFICATION: "notification",
  CORRIGENDUM: "corrigendum",
  SHORT_NOTICE: "short_notice",
  DETAILED_ADVERTISEMENT: "detailed_advertisement",
  ADMIT_CARD: "admit_card",
  EXAM_SCHEDULE: "exam_schedule",
  ANSWER_KEY: "answer_key",
  RESPONSE_SHEET: "response_sheet",
  RESULT: "result",
  CUTOFF: "cutoff",
  MERIT_LIST: "merit_list",
  JOINING_NOTICE: "joining_notice",
  UNKNOWN: "unknown"
});

const DOCUMENT_ROLE_LABELS = Object.freeze({
  notification: "Notification",
  corrigendum: "Corrigendum",
  short_notice: "Short Notice",
  detailed_advertisement: "Detailed Advertisement",
  admit_card: "Admit Card",
  exam_schedule: "Exam Schedule",
  answer_key: "Answer Key",
  response_sheet: "Response Sheet",
  result: "Result",
  cutoff: "Cutoff",
  merit_list: "Merit List",
  joining_notice: "Joining Notice",
  unknown: "Unknown Document"
});

/** Lower number = earlier position in the recruitment lifecycle. */
const ROLE_TIMELINE_PRECEDENCE = Object.freeze({
  short_notice: 10,
  notification: 20,
  detailed_advertisement: 30,
  corrigendum: 40,
  exam_schedule: 50,
  admit_card: 60,
  answer_key: 70,
  response_sheet: 80,
  result: 90,
  cutoff: 100,
  merit_list: 110,
  joining_notice: 120,
  unknown: 130
});

const DOCUMENT_KINDS = Object.freeze({
  HTML: "html",
  PDF: "pdf",
  UNKNOWN: "unknown"
});

/** Kinds of deterministic evidence used to correlate documents. */
const EVIDENCE_KINDS = Object.freeze({
  ADVERTISEMENT_NUMBER: "advertisement_number",
  CROSS_REFERENCE: "cross_reference",
  REFERENCE_URL: "reference_url",
  SHARED_REFERENCE_URL: "shared_reference_url",
  ORGANIZATION: "organization",
  DEPARTMENT: "department",
  RECRUITMENT_NAME: "recruitment_name",
  POST_NAME: "post_name",
  EXAM_NAME: "exam_name",
  DATE: "date",
  DOCUMENT_METADATA: "document_metadata"
});

const EVIDENCE_STRENGTHS = Object.freeze({
  STRONG: "strong",
  MEDIUM: "medium",
  WEAK: "weak"
});

const EVIDENCE_STRENGTH_RANK = Object.freeze({
  strong: 3,
  medium: 2,
  weak: 1
});

const DUPLICATE_TYPES = Object.freeze({
  EXACT_DUPLICATE: "exact_duplicate",
  NEAR_DUPLICATE: "near_duplicate",
  REPLACEMENT: "replacement",
  SUPERSEDED: "superseded",
  UNKNOWN_RELATIONSHIP: "unknown_relationship"
});

const CHANGE_TYPES = Object.freeze({
  IMPORTANT_DATE: "important_date",
  VACANCY_COUNT: "vacancy_count",
  ELIGIBILITY: "eligibility",
  APPLICATION_FEE: "application_fee",
  EXAM_SCHEDULE: "exam_schedule",
  OFFICIAL_LINK: "official_link",
  NOTIFICATION_VERSION: "notification_version",
  SECTION_ADDED: "section_added",
  SECTION_REMOVED: "section_removed",
  DOCUMENT_REVISION: "document_revision"
});

const CONFIDENCE_LEVELS = Object.freeze(["high", "medium", "low", "none"]);

const GRAPH_ROOT_ID = "recruitment";

function isKnownDocumentRole(value) {
  return Object.values(DOCUMENT_ROLES).includes(value);
}

function getDocumentRoleLabel(role) {
  return DOCUMENT_ROLE_LABELS[role] || DOCUMENT_ROLE_LABELS.unknown;
}

module.exports = {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  CORRELATION_VERSION,
  RECRUITMENT_CORRELATION_FORMAT_ID,
  DOCUMENT_ROLES,
  DOCUMENT_ROLE_LABELS,
  ROLE_TIMELINE_PRECEDENCE,
  DOCUMENT_KINDS,
  EVIDENCE_KINDS,
  EVIDENCE_STRENGTHS,
  EVIDENCE_STRENGTH_RANK,
  DUPLICATE_TYPES,
  CHANGE_TYPES,
  CONFIDENCE_LEVELS,
  GRAPH_ROOT_ID,
  isKnownDocumentRole,
  getDocumentRoleLabel
};
