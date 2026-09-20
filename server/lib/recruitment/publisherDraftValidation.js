"use strict";

/**
 * Lightweight structured validation for Generator publisher section text.
 * Advisory only — never blocks Review Center enqueue.
 */

const SECTION_RE = /\[Section:\s*([^\]]+)\]/gi;

const URL_RE = /https?:\/\/[^\s<>"']+/gi;
const DATE_HINT_RE =
  /\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})\b/g;
const FEE_HINT_RE = /\b(rs\.?|inr|₹)\s*[\d,]+|\bfee\b/i;
const VACANCY_HINT_RE = /\b(\d{1,6})\s*(posts?|vacancies|vacancy)\b/i;

function extractSections(text) {
  const raw = String(text || "");
  const sections = [];
  const re = new RegExp(SECTION_RE.source, "gi");
  let match;
  const indices = [];
  while ((match = re.exec(raw)) !== null) {
    indices.push({ title: match[1].trim(), start: match.index, end: match.index + match[0].length });
  }
  for (let i = 0; i < indices.length; i += 1) {
    const bodyStart = indices[i].end;
    const bodyEnd = i + 1 < indices.length ? indices[i + 1].start : raw.length;
    sections.push({
      title: indices[i].title,
      body: raw.slice(bodyStart, bodyEnd).trim()
    });
  }
  return sections;
}

function classifyDocumentFromTitle(title, eventType) {
  const t = String(title || "").toLowerCase();
  const e = String(eventType || "").toLowerCase();
  if (e && e !== "unknown") return e.toUpperCase();
  if (/admit\s*card|hall\s*ticket|call\s*letter/.test(t)) return "ADMIT_CARD";
  if (/answer\s*key|keys?\s*challenge|objection/.test(t)) return "ANSWER_KEY";
  if (/\bresult\b|merit\s*list|final\s*result/.test(t)) return "RESULT";
  if (/notification|advertisement|recruitment|vacancy|apply\s*online/.test(t)) return "NOTIFICATION";
  return "OTHER_UPDATE";
}

/**
 * @param {{ text?: string, title?: string, eventType?: string|null }} input
 */
function validatePublisherDraftContent(input = {}) {
  const text = String(input.text || "");
  const title = String(input.title || "");
  const problems = [];
  const warnings = [];
  const sections = extractSections(text);
  const sectionTitles = sections.map((s) => s.title.toLowerCase());

  const documentClass = classifyDocumentFromTitle(title, input.eventType);

  if (!text.trim() || text.trim().length < 40) {
    problems.push({
      code: "extraction_too_short",
      message: "Extracted/converted content is too short or empty."
    });
  }

  if (sections.length < 1) {
    warnings.push({
      code: "missing_section_markers",
      message: "No [Section: …] markers found — Generator may need manual structuring."
    });
  }

  const hasDates =
    sectionTitles.some((t) => t.includes("important date") || t.includes("date")) ||
    DATE_HINT_RE.test(text);
  DATE_HINT_RE.lastIndex = 0;
  if (!hasDates && documentClass === "NOTIFICATION") {
    warnings.push({
      code: "missing_important_dates",
      message: "Important dates section/signals not detected."
    });
  }

  if (documentClass === "NOTIFICATION" && !FEE_HINT_RE.test(text)) {
    warnings.push({
      code: "missing_fee_signals",
      message: "Application fee signals not detected."
    });
  }

  if (documentClass === "NOTIFICATION" && !VACANCY_HINT_RE.test(text)) {
    warnings.push({
      code: "missing_vacancy_numbers",
      message: "Vacancy/post count signals not detected."
    });
  }

  const urls = text.match(URL_RE) || [];
  for (const url of urls.slice(0, 20)) {
    try {
      // eslint-disable-next-line no-new
      new URL(url.replace(/[),.;]+$/g, ""));
    } catch {
      problems.push({ code: "invalid_url", message: `Invalid URL: ${url}` });
    }
  }

  if (/No usable data found|Input too short|\{\{TEXT\}\}/i.test(text)) {
    problems.push({
      code: "obvious_extraction_failure",
      message: "Content looks like a failed extraction placeholder."
    });
  }

  return {
    ok: problems.length === 0,
    status: problems.length ? "BLOCKED" : warnings.length ? "WARNING" : "PASS",
    documentClass,
    sectionCount: sections.length,
    sections: sections.map((s) => s.title),
    problems,
    warnings,
    blocking: false,
    reviewEnqueueBlocked: false
  };
}

module.exports = {
  extractSections,
  classifyDocumentFromTitle,
  validatePublisherDraftContent
};
