"use strict";

const { formatImportantDatesPublisher } = require("./sectionDetector");
const {
  formatVacancyStructured,
  resolveVacancySectionHeader
} = require("./tableDetect");

// Phase AI-1: do not treat how-to-apply / syllabus / exam pattern as garbage —
// those are valid preserved sections. Only strip clear legal/annexure noise.
const GARBAGE = /\b(rti|annexure|click\s+here\s+to\s+apply)\b/i;

const SECTION_BLOCK_RE = /(\[Section:\s*[^\]]+\]\s*)([\s\S]*?)(?=\n\[Section:|$)/gi;

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
    `(\\[Section:\\s*${sectionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\s*)([\\s\\S]*?)(?=\\n\\[Section:|$)`,
    "i"
  );
  if (!re.test(text)) return text;
  return text.replace(re, (_, header) => `${header}${String(newBody || "").trim()}\n`);
}

/**
 * @param {string} text
 * @param {string[]} names
 * @param {string} newBody
 */
function setSectionContentAny(text, names, newBody) {
  let out = text;
  for (const name of names) {
    const next = setSectionContent(out, name, newBody);
    if (next !== out) return next;
  }
  return out;
}

/**
 * @param {string} text
 */
function hasMeaningfulDates(text) {
  const m =
    text.match(/\[Section:\s*Important\s*Dates\]\s*([\s\S]*?)(?=\n\[Section:|$)/i) ||
    text.match(/\[Section:\s*ImportantDates\]\s*([\s\S]*?)(?=\n\[Section:|$)/i);
  if (!m) return false;
  const body = m[1].replace(/—/g, "").trim();
  return (
    body.length > 2 &&
    (/\d{1,2}[./-]\d{1,2}/.test(body) ||
      /\b(september|january|february|march|april|may|june|july|august|october|november|december)\b/i.test(body) ||
      /\b(last|exam|start|notification|date|schedule|apply)\b/i.test(body))
  );
}

/**
 * @param {string} text
 */
function hasMeaningfulVacancy(text) {
  const m = text.match(/\[Section:\s*Vacancy(?:\s*\|\s*table)?\]\s*([\s\S]*?)(?=\n\[Section:|$)/i);
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
  text = text.replace(SECTION_BLOCK_RE, (_, header, body) => `${header}${stripGarbageLines(body)}\n`);

  if (!hasMeaningfulDates(text) && buckets.dates.length) {
    text = setSectionContentAny(text, ["Important Dates", "ImportantDates"], formatImportantDatesPublisher(buckets.dates));
  }
  if (!hasMeaningfulVacancy(text) && buckets.vacancy.length) {
    const body = formatVacancyStructured(buckets.vacancy);
    const sec = resolveVacancySectionHeader(body);
    text = setSectionContentAny(text, ["Vacancy | table", "Vacancy"], sec.body);
  }
  if (buckets.fee && buckets.fee.length) {
    const feeBody = buckets.fee.map((l) => l.replace(/^[-*•]\s*/, "").trim()).join("\n");
    const feeMatch = text.match(/\[Section:\s*Application\s*Fee\]\s*([\s\S]*?)(?=\n\[Section:|$)/i);
    const feeExisting = feeMatch ? feeMatch[1].replace(/—/g, "").trim() : "";
    if (!feeExisting) {
      text = setSectionContentAny(text, ["Application Fee"], feeBody);
    }
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
