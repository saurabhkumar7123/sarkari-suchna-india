"use strict";

/**
 * Phase AI-1 — Generator Intelligence taxonomy.
 * Maps to existing Generator [Section: …] titles; unknown titles are preserved.
 */

const FORMAT_ID = "generator_intelligence_structured_v1";
const ENGINE_VERSION = "ai1.1.0";

const SECTION_TYPES = Object.freeze({
  SHORT_INFORMATION: "short_information",
  IMPORTANT_DATES: "important_dates",
  APPLICATION_FEE: "application_fee",
  AGE_LIMIT: "age_limit",
  VACANCY_DETAILS: "vacancy_details",
  ELIGIBILITY: "eligibility",
  QUALIFICATION: "qualification",
  SELECTION_PROCESS: "selection_process",
  SALARY: "salary",
  HOW_TO_APPLY: "how_to_apply",
  IMPORTANT_LINKS: "important_links",
  FAQ: "faq",
  HELPLINE: "helpline",
  NOTIFICATION_DETAILS: "notification_details",
  IMPORTANT_INSTRUCTIONS: "important_instructions",
  EXAM_PATTERN: "exam_pattern",
  SYLLABUS: "syllabus",
  UNKNOWN: "unknown"
});

/** Canonical Generator titles for known section types. */
const SECTION_TYPE_TO_TITLE = Object.freeze({
  [SECTION_TYPES.SHORT_INFORMATION]: "Short Information",
  [SECTION_TYPES.IMPORTANT_DATES]: "Important Dates",
  [SECTION_TYPES.APPLICATION_FEE]: "Application Fee",
  [SECTION_TYPES.AGE_LIMIT]: "Age Limit",
  [SECTION_TYPES.VACANCY_DETAILS]: "Vacancy Details",
  [SECTION_TYPES.ELIGIBILITY]: "Eligibility",
  [SECTION_TYPES.QUALIFICATION]: "Qualification",
  [SECTION_TYPES.SELECTION_PROCESS]: "Selection Process",
  [SECTION_TYPES.SALARY]: "Salary",
  [SECTION_TYPES.HOW_TO_APPLY]: "How To Apply",
  [SECTION_TYPES.IMPORTANT_LINKS]: "Important Links",
  [SECTION_TYPES.FAQ]: "Important Questions",
  [SECTION_TYPES.HELPLINE]: "Helpline",
  [SECTION_TYPES.NOTIFICATION_DETAILS]: "Notification Details",
  [SECTION_TYPES.IMPORTANT_INSTRUCTIONS]: "Important Instructions",
  [SECTION_TYPES.EXAM_PATTERN]: "Exam Pattern",
  [SECTION_TYPES.SYLLABUS]: "Syllabus",
  [SECTION_TYPES.UNKNOWN]: null
});

/**
 * Heading / alias → section type (English + common Hindi).
 * Keys are lowercased, whitespace-collapsed.
 */
const SECTION_HEADING_MAP = Object.freeze({
  "short information": SECTION_TYPES.SHORT_INFORMATION,
  "short info": SECTION_TYPES.SHORT_INFORMATION,
  shortinfo: SECTION_TYPES.SHORT_INFORMATION,
  "brief information": SECTION_TYPES.SHORT_INFORMATION,
  "important dates": SECTION_TYPES.IMPORTANT_DATES,
  "important date": SECTION_TYPES.IMPORTANT_DATES,
  "key dates": SECTION_TYPES.IMPORTANT_DATES,
  schedule: SECTION_TYPES.IMPORTANT_DATES,
  "महत्वपूर्ण तिथियाँ": SECTION_TYPES.IMPORTANT_DATES,
  "महत्वपूर्ण तिथियां": SECTION_TYPES.IMPORTANT_DATES,
  "महत्वपूर्ण तिथि": SECTION_TYPES.IMPORTANT_DATES,
  "आवेदन तिथि": SECTION_TYPES.IMPORTANT_DATES,
  "application fee": SECTION_TYPES.APPLICATION_FEE,
  "application fees": SECTION_TYPES.APPLICATION_FEE,
  "exam fee": SECTION_TYPES.APPLICATION_FEE,
  "registration fee": SECTION_TYPES.APPLICATION_FEE,
  fee: SECTION_TYPES.APPLICATION_FEE,
  "आवेदन शुल्क": SECTION_TYPES.APPLICATION_FEE,
  शुल्क: SECTION_TYPES.APPLICATION_FEE,
  "age limit": SECTION_TYPES.AGE_LIMIT,
  "age criteria": SECTION_TYPES.AGE_LIMIT,
  आयु: SECTION_TYPES.AGE_LIMIT,
  "आयु सीमा": SECTION_TYPES.AGE_LIMIT,
  "vacancy details": SECTION_TYPES.VACANCY_DETAILS,
  vacancy: SECTION_TYPES.VACANCY_DETAILS,
  vacancies: SECTION_TYPES.VACANCY_DETAILS,
  "post details": SECTION_TYPES.VACANCY_DETAILS,
  "post wise vacancy": SECTION_TYPES.VACANCY_DETAILS,
  "category wise vacancy": SECTION_TYPES.VACANCY_DETAILS,
  रिक्ति: SECTION_TYPES.VACANCY_DETAILS,
  "पद विवरण": SECTION_TYPES.VACANCY_DETAILS,
  eligibility: SECTION_TYPES.ELIGIBILITY,
  "eligibility criteria": SECTION_TYPES.ELIGIBILITY,
  "पात्रता": SECTION_TYPES.ELIGIBILITY,
  qualification: SECTION_TYPES.QUALIFICATION,
  "educational qualification": SECTION_TYPES.QUALIFICATION,
  "शैक्षणिक योग्यता": SECTION_TYPES.QUALIFICATION,
  "selection process": SECTION_TYPES.SELECTION_PROCESS,
  "mode of selection": SECTION_TYPES.SELECTION_PROCESS,
  "चयन प्रक्रिया": SECTION_TYPES.SELECTION_PROCESS,
  salary: SECTION_TYPES.SALARY,
  pay: SECTION_TYPES.SALARY,
  "pay scale": SECTION_TYPES.SALARY,
  "salary / pay scale": SECTION_TYPES.SALARY,
  वेतन: SECTION_TYPES.SALARY,
  "वेतनमान": SECTION_TYPES.SALARY,
  "how to apply": SECTION_TYPES.HOW_TO_APPLY,
  "how to apply online": SECTION_TYPES.HOW_TO_APPLY,
  "application procedure": SECTION_TYPES.HOW_TO_APPLY,
  "steps to apply": SECTION_TYPES.HOW_TO_APPLY,
  "आवेदन कैसे करें": SECTION_TYPES.HOW_TO_APPLY,
  "important links": SECTION_TYPES.IMPORTANT_LINKS,
  "useful links": SECTION_TYPES.IMPORTANT_LINKS,
  links: SECTION_TYPES.IMPORTANT_LINKS,
  "महत्वपूर्ण लिंक": SECTION_TYPES.IMPORTANT_LINKS,
  faq: SECTION_TYPES.FAQ,
  "important questions": SECTION_TYPES.FAQ,
  "frequently asked questions": SECTION_TYPES.FAQ,
  "अक्सर पूछे जाने वाले प्रश्न": SECTION_TYPES.FAQ,
  helpline: SECTION_TYPES.HELPLINE,
  "help line": SECTION_TYPES.HELPLINE,
  "help desk": SECTION_TYPES.HELPLINE,
  "contact us": SECTION_TYPES.HELPLINE,
  "हेल्पलाइन": SECTION_TYPES.HELPLINE,
  "notification details": SECTION_TYPES.NOTIFICATION_DETAILS,
  "advertisement details": SECTION_TYPES.NOTIFICATION_DETAILS,
  "advt details": SECTION_TYPES.NOTIFICATION_DETAILS,
  "important instructions": SECTION_TYPES.IMPORTANT_INSTRUCTIONS,
  "general instructions": SECTION_TYPES.IMPORTANT_INSTRUCTIONS,
  instructions: SECTION_TYPES.IMPORTANT_INSTRUCTIONS,
  "महत्वपूर्ण निर्देश": SECTION_TYPES.IMPORTANT_INSTRUCTIONS,
  "exam pattern": SECTION_TYPES.EXAM_PATTERN,
  "scheme of examination": SECTION_TYPES.EXAM_PATTERN,
  "परीक्षा पैटर्न": SECTION_TYPES.EXAM_PATTERN,
  syllabus: SECTION_TYPES.SYLLABUS,
  "पाठ्यक्रम": SECTION_TYPES.SYLLABUS
});

const BLOCK_TYPES = Object.freeze({
  PARAGRAPH: "paragraph",
  DATE_LIST: "date_list",
  TABLE: "table",
  BULLET_LIST: "bullet_list",
  LINK_LIST: "link_list",
  FAQ: "faq",
  NOTICE: "notice",
  KEY_VALUE: "key_value",
  RAW: "raw"
});

const TABLE_KINDS = Object.freeze({
  VACANCY: "vacancy",
  FEE: "fee",
  AGE: "age",
  IMPORTANT_DATES: "important_dates",
  QUALIFICATION: "qualification",
  RESERVATION: "reservation",
  UNKNOWN: "unknown"
});

const LINK_CATEGORIES = Object.freeze({
  NOTIFICATION_PDF: "notification_pdf",
  APPLY_ONLINE: "apply_online",
  OFFICIAL_WEBSITE: "official_website",
  LOGIN: "login",
  REGISTRATION: "registration",
  CORRECTION: "correction",
  ADMIT_CARD: "admit_card",
  RESULT: "result",
  ANSWER_KEY: "answer_key",
  SYLLABUS: "syllabus",
  OTHER: "other"
});

/** Preferred Generator label for classified links. */
const LINK_CATEGORY_TO_LABEL = Object.freeze({
  [LINK_CATEGORIES.NOTIFICATION_PDF]: "Notification PDF",
  [LINK_CATEGORIES.APPLY_ONLINE]: "Apply Online",
  [LINK_CATEGORIES.OFFICIAL_WEBSITE]: "Official Website",
  [LINK_CATEGORIES.LOGIN]: "Login",
  [LINK_CATEGORIES.REGISTRATION]: "Registration",
  [LINK_CATEGORIES.CORRECTION]: "Correction",
  [LINK_CATEGORIES.ADMIT_CARD]: "Admit Card",
  [LINK_CATEGORIES.RESULT]: "Result",
  [LINK_CATEGORIES.ANSWER_KEY]: "Answer Key",
  [LINK_CATEGORIES.SYLLABUS]: "Syllabus",
  [LINK_CATEGORIES.OTHER]: "Link"
});

module.exports = {
  FORMAT_ID,
  ENGINE_VERSION,
  SECTION_TYPES,
  SECTION_TYPE_TO_TITLE,
  SECTION_HEADING_MAP,
  BLOCK_TYPES,
  TABLE_KINDS,
  LINK_CATEGORIES,
  LINK_CATEGORY_TO_LABEL
};
