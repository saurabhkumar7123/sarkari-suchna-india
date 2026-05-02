"use strict";

const { formatImportantDatesFromBucket, formatVacancyStructured } = require("./sectionDetector");

const GARBAGE = /\b(rti|annexure|syllabus|how\s+to\s+apply|exam\s*pattern|marks\s*distribution|click\s+here\s+to\s+apply|negative\s*marking)\b/i;

const SECTION_NAMES = ["ShortInfo", "Eligibility", "ImportantDates", "SelectionProcess", "Vacancy", "ImportantLinks"];

/**
 * @param {string} block
 */
function stripGarbageLines(block) {
  const lines = String(block || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const kept = lines.filter((t) => {
    if (GARBAGE.test(t) && t.length > 35 && !/\d{1,2}[./-]\d{1,2}/.test(t)) return false;
    return true;
  });
  return kept.length ? kept.join("\n") : "—";
}

/**
 * @param {string} text
 * @param {string} sectionName
 * @param {string} newBody
 */
function setSectionContent(text, sectionName, newBody) {
  const re = new RegExp(
    `(\\[Section:\\s*${sectionName}\\]\\s*)([\\s\\S]*?)(?=\\n\\[Section:|$)`,
    "i"
  );
  if (!re.test(text)) return text;
  return text.replace(re, (_, header) => `${header}${String(newBody || "").trim()}\n`);
}

/**
 * @param {string} text
 */
function hasMeaningfulDates(text) {
  const m = text.match(/\[Section:\s*ImportantDates\]\s*([\s\S]*?)(?=\n\[Section:|$)/i);
  if (!m) return false;
  const body = m[1].replace(/—/g, "").trim();
  return body.length > 2 && (/\d{1,2}[./-]\d{1,2}/.test(body) || /\b(last|exam|start|notification|date|schedule)\b/i.test(body));
}

/**
 * @param {string} text
 */
function hasMeaningfulVacancy(text) {
  const m = text.match(/\[Section:\s*Vacancy\]\s*([\s\S]*?)(?=\n\[Section:|$)/i);
  if (!m) return false;
  const body = m[1].replace(/—/g, "").trim();
  return body.length > 2 && /\d/.test(body);
}

/**
 * @param {string} structured
 * @param {object} buckets — from detectSections()
 * @returns {{ ok: boolean, text: string }}
 */
function validateAndRepair(structured, buckets) {
  let text = String(structured || "").trim();
  for (const name of SECTION_NAMES) {
    const re = new RegExp(
      `(\\[Section:\\s*${name}\\]\\s*)([\\s\\S]*?)(?=\\n\\[Section:|$)`,
      "i"
    );
    text = text.replace(re, (_, header, body) => `${header}${stripGarbageLines(body)}\n`);
  }

  if (!hasMeaningfulDates(text) && buckets.dates.length) {
    text = setSectionContent(text, "ImportantDates", formatImportantDatesFromBucket(buckets.dates));
  }
  if (!hasMeaningfulVacancy(text) && buckets.vacancy.length) {
    text = setSectionContent(text, "Vacancy", formatVacancyStructured(buckets.vacancy));
  }

  const ok =
    hasMeaningfulDates(text) ||
    hasMeaningfulVacancy(text) ||
    (buckets.dates.length === 0 && buckets.vacancy.length === 0);
  return { ok: !!ok, text };
}

module.exports = {
  validateAndRepair,
  hasMeaningfulDates,
  hasMeaningfulVacancy,
  stripGarbageLines
};
