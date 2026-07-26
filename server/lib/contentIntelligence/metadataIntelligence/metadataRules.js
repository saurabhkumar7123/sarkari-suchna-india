"use strict";

/**
 * CIP Stage 1B — extraction rules / label patterns.
 * Deterministic, configuration-driven. No AI.
 */

const { IMPORTANT_DATE_FIELDS } = require("./metadataFields");

/** Field boundary lookahead shared with MB-3 extraction style. */
/** Stop at next labeled field; avoid truncating names ending in Commission/Board. */
const NEXT_FIELD_BOUNDARY =
  "(?=\\n|$|\\s+(?:Advertisement|Advt\\.?|Notification\\s*(?:No|Number|Date)|Department|Ministry|Organisation|Organization|Recruitment\\s*Board|Qualification|Educational|Eligibility|Age\\s*Limit|No\\.\\s*of|Total\\s*(?:Posts|Vacancies)|Post\\s*Name|Category|Recruitment\\s*Type|Exam\\s*Type|Mode\\s*of|Application\\s*Mode|How\\s*to\\s*Apply|Last\\s*Date|Closing\\s*Date|Start\\s*Date|Exam\\s*Date|Result\\s*Date|Admit\\s*Card|Answer\\s*Key|Published|Issue\\s*Date|Official\\s*Website|State|Apply\\s*Online)\\b)";

/**
 * @typedef {Object} FieldRule
 * @property {string} field
 * @property {string[]} labels
 * @property {'high'|'medium'|'low'} confidence
 * @property {'text'|'date'|'number'|'url'} [valueKind]
 */

/** @type {FieldRule[]} */
const FIELD_RULES = Object.freeze([
  {
    field: "advertisementNumber",
    labels: [
      "Advertisement\\s*(?:No\\.?|Number|Num)",
      "Advt\\.\\s*No\\.?",
      "Notification\\s*(?:No\\.?|Number)",
      "Exam\\s*(?:No\\.?|Code)"
    ],
    confidence: "high",
    valueKind: "text"
  },
  {
    field: "organization",
    labels: [
      "Organization",
      "Organisation",
      "Commission",
      "Recruiting\\s*Agency"
    ],
    confidence: "high",
    valueKind: "text"
  },
  {
    field: "department",
    labels: ["Department", "Ministry", "Directorate"],
    confidence: "high",
    valueKind: "text"
  },
  {
    field: "recruitmentBoard",
    labels: [
      "Recruitment\\s*Board",
      "Examining\\s*Body",
      "Board\\s*Name",
      "Board"
    ],
    confidence: "medium",
    valueKind: "text"
  },
  {
    field: "postName",
    labels: [
      "Post\\s*Name",
      "Name\\s*of\\s*(?:the\\s*)?Post",
      "Post\\s*/\\s*Cadre",
      "Vacancy\\s*Name"
    ],
    confidence: "high",
    valueKind: "text"
  },
  {
    field: "totalPosts",
    labels: [
      "No\\.\\s*of\\s*(?:Posts|Vacancies)",
      "Total\\s*(?:Posts|Vacancies|Vacancy)",
      "Number\\s*of\\s*(?:Posts|Vacancies)",
      "Vacancies?",
      "Posts?"
    ],
    confidence: "high",
    valueKind: "number"
  },
  {
    field: "qualification",
    labels: [
      "Educational\\s*Qualification",
      "Qualification",
      "Eligibility"
    ],
    confidence: "high",
    valueKind: "text"
  },
  {
    field: "ageLimit",
    labels: ["Age\\s*Limit", "Maximum\\s*Age", "Age"],
    confidence: "medium",
    valueKind: "text"
  },
  {
    field: "applicationMode",
    labels: [
      "Mode\\s*of\\s*Application",
      "Application\\s*Mode",
      "How\\s*to\\s*Apply",
      "Apply\\s*Mode"
    ],
    confidence: "high",
    valueKind: "text"
  },
  {
    field: "category",
    labels: ["Category", "Recruitment\\s*Type", "Exam\\s*Type"],
    confidence: "medium",
    valueKind: "text"
  },
  {
    field: "state",
    labels: [
      "State",
      "State\\s*/\\s*UT",
      "Recruitment\\s*State",
      "Applicable\\s*State"
    ],
    confidence: "medium",
    valueKind: "text"
  },
  {
    field: "officialWebsite",
    labels: [
      "Official\\s*Website",
      "Website",
      "Portal",
      "Apply\\s*Online"
    ],
    confidence: "medium",
    valueKind: "url"
  }
]);

/** Date label rules keyed by IMPORTANT_DATE_FIELDS. */
const DATE_FIELD_RULES = Object.freeze({
  notificationDate: {
    labels: [
      "Notification\\s*Date",
      "Date\\s*of\\s*Notification",
      "Published\\s*(?:on|Date)",
      "Issue\\s*Date"
    ],
    confidence: "high"
  },
  startDate: {
    labels: [
      "Start\\s*Date",
      "Opening\\s*Date",
      "Application\\s*Start\\s*Date",
      "Online\\s*Apply\\s*Start\\s*Date",
      "Registration\\s*Start\\s*Date"
    ],
    confidence: "high"
  },
  lastDate: {
    labels: [
      "Last\\s*Date\\s*(?:to|for)\\s*Apply",
      "Last\\s*Date",
      "Closing\\s*Date",
      "Application\\s*End\\s*Date",
      "Apply\\s*By"
    ],
    confidence: "high"
  },
  examDate: {
    labels: [
      "Exam\\s*Date",
      "Examination\\s*Date",
      "Date\\s*of\\s*Examination",
      "Test\\s*Date"
    ],
    confidence: "high"
  },
  resultDate: {
    labels: ["Result\\s*Date", "Result\\s*Declaration\\s*Date"],
    confidence: "high"
  },
  admitCardDate: {
    labels: [
      "Admit\\s*Card\\s*Date",
      "Hall\\s*Ticket\\s*Date",
      "Admit\\s*Card\\s*Release\\s*Date"
    ],
    confidence: "high"
  },
  answerKeyDate: {
    labels: [
      "Answer\\s*Key\\s*Date",
      "Answer\\s*Key\\s*Release\\s*Date"
    ],
    confidence: "high"
  }
});

const SOURCE_TYPE_HINTS = Object.freeze({
  pdf_text: [/pdf/i, /application\/pdf/i],
  website_text: [/website/i, /html/i, /http/i, /gov\.in/i],
  ai_draft_text: [/ai[_\s-]?draft/i, /generated/i, /llm/i],
  extracted_content: [/extract/i, /parsed/i, /ocr/i]
});

const ORGANIZATION_DISPLAY = Object.freeze({
  ssc: "Staff Selection Commission",
  rrb: "Railway Recruitment Board",
  upsc: "Union Public Service Commission",
  ibps: "Institute of Banking Personnel Selection",
  nta: "National Testing Agency",
  uppsc: "Uttar Pradesh Public Service Commission",
  bpsc: "Bihar Public Service Commission"
});

module.exports = {
  NEXT_FIELD_BOUNDARY,
  FIELD_RULES,
  DATE_FIELD_RULES,
  SOURCE_TYPE_HINTS,
  ORGANIZATION_DISPLAY,
  IMPORTANT_DATE_FIELDS
};
