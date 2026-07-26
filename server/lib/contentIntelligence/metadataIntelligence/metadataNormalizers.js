"use strict";

/**
 * CIP Stage 1B — metadata normalizers.
 * Reuses existing project utilities; never invents values.
 */

const {
  normalizeAdvertisementNo,
  normalizeUrl,
  pickString
} = require("../../project/recruitmentIntelligence/utils");

const {
  resolveOrganization
} = require("../../project/recruitmentIntelligence/recruitmentMatchingEngine");

const {
  normalizeApplicationMode,
  APPLICATION_MODES
} = require("../../project/monitoringBot/recruitmentExtraction/structuredRecruitmentModel");

const {
  normalizeTitle,
  normalizeDepartment,
  normalizeQualification,
  normalizeState,
  normalizeRecruitmentCategory,
  DEFAULT_STATE_ALIASES,
  DEFAULT_QUALIFICATION_ALIASES,
  DEFAULT_DEPARTMENT_ALIASES,
  DEFAULT_CATEGORY_ALIASES
} = require("../../project/program5/candidateNormalization");

const {
  normalizeStateSlug,
  ALLOWED_JOB_QUALIFICATIONS,
  ALLOWED_JOB_STATES
} = require("../../structuredFields");

const { ORGANIZATION_DISPLAY } = require("./metadataRules");
const {
  createEmptyImportantDates,
  IMPORTANT_DATE_FIELDS,
  SOURCE_TYPES,
  DOCUMENT_LANGUAGES
} = require("./metadataFields");

const MONTH_MAP = Object.freeze({
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12
});

function collapseWhitespace(value) {
  return String(value ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function asStringOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = collapseWhitespace(value);
  return text.length ? text : null;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Normalize a date string to YYYY-MM-DD when parseable; else trimmed original; else null.
 * Does not invent dates.
 */
function normalizeDateValue(value) {
  const text = asStringOrNull(value);
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${iso[1]}-${iso[2]}-${iso[3]}`;
    }
  }

  const dmy = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    let day = Number(dmy[1]);
    let month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    // Prefer DD/MM/YYYY (India). If month > 12, treat as MM/DD.
    if (month > 12 && day <= 12) {
      const tmp = day;
      day = month;
      month = tmp;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }

  const named = text.match(
    /^(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(\d{4})$|^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/
  );
  if (named) {
    let day;
    let monthName;
    let year;
    if (named[1]) {
      day = Number(named[1]);
      monthName = named[2].toLowerCase();
      year = Number(named[3]);
    } else {
      monthName = named[4].toLowerCase();
      day = Number(named[5]);
      year = Number(named[6]);
    }
    const month = MONTH_MAP[monthName];
    if (month && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }

  const ms = Date.parse(text);
  if (Number.isFinite(ms)) {
    const dt = new Date(ms);
    if (!Number.isNaN(dt.getTime())) {
      return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
    }
  }

  return text;
}

function normalizeTotalPosts(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  const digits = String(value).replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

function normalizeOrganizationValue(value) {
  const text = asStringOrNull(value);
  if (!text) return null;
  const canonical = resolveOrganization(text);
  if (canonical && ORGANIZATION_DISPLAY[canonical]) {
    return ORGANIZATION_DISPLAY[canonical];
  }
  if (canonical) return canonical.toUpperCase();
  return collapseWhitespace(text);
}

function normalizeRecruitmentBoardValue(value) {
  const text = asStringOrNull(value);
  if (!text) return null;
  const org = normalizeOrganizationValue(text);
  return org || collapseWhitespace(text);
}

function normalizeQualificationValue(value) {
  const text = asStringOrNull(value);
  if (!text) return null;
  const aliased = normalizeQualification(text, DEFAULT_QUALIFICATION_ALIASES);
  if (aliased && ALLOWED_JOB_QUALIFICATIONS.has(aliased)) {
    return aliased;
  }
  // Prefer known alias map result when present; else trimmed original label.
  if (aliased && aliased !== toSlugKey(text)) {
    return aliased;
  }
  return text;
}

function toSlugKey(value) {
  const text = collapseWhitespace(value).toLowerCase();
  return text || null;
}

function normalizeStateValue(value) {
  const text = asStringOrNull(value);
  if (!text) return null;
  const aliased = normalizeState(text, DEFAULT_STATE_ALIASES);
  const slug = normalizeStateSlug(aliased || text);
  if (slug && ALLOWED_JOB_STATES.has(slug)) return slug;
  if (aliased) return aliased;
  return text;
}

function normalizeDepartmentValue(value) {
  const text = asStringOrNull(value);
  if (!text) return null;
  const aliased = normalizeDepartment(text, DEFAULT_DEPARTMENT_ALIASES);
  return aliased || text;
}

function normalizeCategoryValue(value) {
  const text = asStringOrNull(value);
  if (!text) return null;
  return normalizeRecruitmentCategory(text, DEFAULT_CATEGORY_ALIASES) || text;
}

function normalizeApplicationModeValue(value) {
  const text = asStringOrNull(value);
  if (!text) return null;
  const mode = normalizeApplicationMode(text);
  if (mode === APPLICATION_MODES.UNKNOWN) {
    // Keep trimmed original when unknown — do not invent ONLINE/OFFLINE.
    return text;
  }
  return mode;
}

function normalizeWebsiteUrl(value) {
  const text = asStringOrNull(value);
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) {
    const normalized = normalizeUrl(text);
    return normalized || text;
  }
  // Bare domain — preserve without inventing scheme in raw; normalized adds none.
  return text.replace(/\/$/, "").toLowerCase();
}

function normalizeSourceType(value, hints = {}) {
  const explicit = asStringOrNull(value);
  if (explicit) {
    const key = explicit.toLowerCase().replace(/[\s-]+/g, "_");
    if (SOURCE_TYPES.includes(key)) return key;
  }
  if (hints.sourceType && SOURCE_TYPES.includes(hints.sourceType)) {
    return hints.sourceType;
  }
  const blob = [
    hints.contentType,
    hints.filename,
    hints.url,
    hints.pipeline,
    hints.source
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!blob) return "unknown";
  if (/pdf/.test(blob)) return "pdf_text";
  if (/ai[_\s-]?draft|llm|generated/.test(blob)) return "ai_draft_text";
  if (/extract|parsed|ocr/.test(blob)) return "extracted_content";
  if (/html|website|http|gov\.in/.test(blob)) return "website_text";
  return "unknown";
}

function detectDocumentLanguage(text) {
  const sample = String(text || "");
  if (!sample.trim()) return "unknown";
  const hasDevanagari = /[\u0900-\u097F]/.test(sample);
  const hasLatin = /[A-Za-z]{3,}/.test(sample);
  if (hasDevanagari && hasLatin) return "mixed";
  if (hasDevanagari) return "hi";
  if (hasLatin) return "en";
  return "unknown";
}

function normalizeImportantDates(rawDates = {}) {
  const out = createEmptyImportantDates();
  for (const key of IMPORTANT_DATE_FIELDS) {
    out[key] = normalizeDateValue(rawDates[key]);
  }
  return out;
}

function dedupeStringList(values) {
  const seen = Object.create(null);
  const out = [];
  for (const value of values) {
    const text = asStringOrNull(value);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    out.push(text);
  }
  return out;
}

/**
 * Build normalized metadata from raw metadata object.
 * @param {object} raw
 * @param {object} [context]
 */
function normalizeMetadata(raw = {}, context = {}) {
  const title = normalizeTitle(raw.title) || asStringOrNull(raw.title);
  const organization = normalizeOrganizationValue(raw.organization);
  const department = normalizeDepartmentValue(raw.department);
  let recruitmentBoard = normalizeRecruitmentBoardValue(raw.recruitmentBoard);
  if (!recruitmentBoard && organization) {
    recruitmentBoard = organization;
  }

  const advertisementNumber = (() => {
    const text = asStringOrNull(raw.advertisementNumber);
    if (!text) return null;
    return normalizeAdvertisementNo(text) || text;
  })();

  const postName = asStringOrNull(raw.postName);
  const totalPosts = normalizeTotalPosts(raw.totalPosts);
  const qualification = normalizeQualificationValue(raw.qualification);
  const ageLimit = asStringOrNull(raw.ageLimit);
  const applicationMode = normalizeApplicationModeValue(raw.applicationMode);
  const category = normalizeCategoryValue(raw.category);
  const state = normalizeStateValue(raw.state);
  const importantDates = normalizeImportantDates(raw.importantDates || {});
  const officialWebsite = normalizeWebsiteUrl(raw.officialWebsite);
  const notificationUrl = normalizeWebsiteUrl(raw.notificationUrl);
  const documentLanguage =
    DOCUMENT_LANGUAGES.includes(raw.documentLanguage)
      ? raw.documentLanguage
      : detectDocumentLanguage(context.text || raw.title || "");
  const sourceType = normalizeSourceType(raw.sourceType, context);
  const detectedDocumentType = asStringOrNull(raw.detectedDocumentType);

  return {
    title,
    organization,
    department,
    recruitmentBoard,
    advertisementNumber,
    postName,
    totalPosts,
    qualification,
    ageLimit,
    applicationMode,
    category,
    state,
    importantDates,
    officialWebsite,
    notificationUrl,
    documentLanguage,
    sourceType,
    detectedDocumentType
  };
}

module.exports = {
  collapseWhitespace,
  asStringOrNull,
  normalizeDateValue,
  normalizeTotalPosts,
  normalizeOrganizationValue,
  normalizeRecruitmentBoardValue,
  normalizeQualificationValue,
  normalizeStateValue,
  normalizeDepartmentValue,
  normalizeCategoryValue,
  normalizeApplicationModeValue,
  normalizeWebsiteUrl,
  normalizeSourceType,
  detectDocumentLanguage,
  normalizeImportantDates,
  normalizeMetadata,
  dedupeStringList,
  pickString,
  normalizeAdvertisementNo,
  normalizeTitle,
  APPLICATION_MODES,
  DEFAULT_STATE_ALIASES,
  DEFAULT_QUALIFICATION_ALIASES
};
