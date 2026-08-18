"use strict";

/**
 * Canonical Generator publisher [Section:] body/title normalization.
 * Used as the single finalization step for rule-based and OpenAI-refined output.
 */

const { resolveVacancySectionHeader } = require("./tableDetect");
const { reconstructDelimiterLessVacancyGrid } = require("./reconstructDelimiterLessVacancy");
const { detectSmartTables } = require("../lib/generatorIntelligence/smartTableDetection");
const {
  parseLinkLine,
  formatLinksForPublisher
} = require("../lib/generatorIntelligence/linkClassification");

const SECTION_ALIAS_MAP = {
  shortinfo: "Short Information",
  "short info": "Short Information",
  "short information": "Short Information",
  eligibility: "Eligibility",
  importantdates: "Important Dates",
  "important dates": "Important Dates",
  "important date": "Important Dates",
  applicationfee: "Application Fee",
  "application fee": "Application Fee",
  "application fees": "Application Fee",
  selectionprocess: "Selection Process",
  "selection process": "Selection Process",
  vacancy: "Vacancy",
  "vacancy details": "Vacancy Details",
  "age limit": "Age Limit",
  agelimit: "Age Limit",
  "how to apply": "How To Apply",
  howtoapply: "How To Apply",
  salary: "Salary",
  "pay scale": "Salary",
  helpline: "Helpline",
  "help line": "Helpline",
  "notification details": "Notification Details",
  "important instructions": "Important Instructions",
  "exam pattern": "Exam Pattern",
  syllabus: "Syllabus",
  importantlinks: "Important Links",
  "important links": "Important Links",
  importantquestions: "Important Questions",
  "important questions": "Important Questions",
  faq: "Important Questions",
  "अक्सर पूछे जाने वाले प्रश्न": "Important Questions",
  "आयु सीमा": "Age Limit",
  "चयन प्रक्रिया": "Selection Process",
  "आवेदन कैसे करें": "How To Apply",
  "महत्वपूर्ण लिंक": "Important Links",
  "महत्वपूर्ण निर्देश": "Important Instructions",
  वेतन: "Salary",
  हेल्पलाइन: "Helpline"
};

/**
 * @param {string} raw
 * @returns {string}
 */
function canonicalSectionTitle(raw) {
  let t = String(raw || "").trim();
  const forceTable = /\|\s*table\s*$/i.test(t);
  t = t.replace(/\|\s*table\s*$/i, "").trim();
  const spaced = t.toLowerCase().replace(/\s+/g, " ");
  const compact = spaced.replace(/\s+/g, "");
  const canonical = SECTION_ALIAS_MAP[spaced] || SECTION_ALIAS_MAP[compact] || t;
  return forceTable ? `${canonical} | table` : canonical;
}

function sectionKind(title) {
  const base = String(title || "")
    .replace(/\|\s*table\s*$/i, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (base === "short information") return "short";
  if (base === "important dates") return "dates";
  if (base === "application fee") return "fee";
  if (base === "important links") return "links";
  if (base === "important questions" || base === "faq") return "faq";
  if (base === "vacancy" || base === "vacancy details") return "vacancy";
  return "other";
}

/**
 * @param {string} line
 * @returns {string}
 */
function normalizeKeyValueLine(line) {
  const t = String(line || "")
    .replace(/^[-*•]\s*/, "")
    .trim();
  if (!t) return t;
  if (t.includes("|") && t.split("|").filter((x) => x.trim()).length >= 2) return t;
  if (/https?:\/\/|www\./i.test(t)) return t;
  const m = t.match(/^([^:=\n]{1,80}?)\s*:\s+(.+)$/) || t.match(/^([^:=\n]{1,80}?)\s*:\s*(.+)$/);
  if (m && m[1].trim() && m[2].trim()) {
    return `${m[1].trim()} : ${m[2].trim()}`;
  }
  return t;
}

/**
 * @param {string} body
 * @returns {string}
 */
function normalizeLinksBody(body) {
  const lines = String(body || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const parsed = [];
  const leftover = [];
  for (const line of lines) {
    const p = parseLinkLine(line);
    if (p && p.url) parsed.push(p);
    else leftover.push(line);
  }
  return [formatLinksForPublisher(parsed), leftover.join("\n")].filter(Boolean).join("\n");
}

/**
 * @param {string} body
 * @returns {string}
 */
function normalizeFaqBody(body) {
  return String(body || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      if (/^Q[:.]\s*/i.test(l)) return `Q: ${l.replace(/^Q[:.]\s*/i, "")}`;
      if (/^A[:.]\s*/i.test(l)) return `A: ${l.replace(/^A[:.]\s*/i, "")}`;
      if (/^Question\s*[:.]\s*/i.test(l)) return `Q: ${l.replace(/^Question\s*[:.]\s*/i, "")}`;
      if (/^Answer\s*[:.]\s*/i.test(l)) return `A: ${l.replace(/^Answer\s*[:.]\s*/i, "")}`;
      return l;
    })
    .join("\n");
}

/**
 * @param {string} title
 * @param {string} body
 * @returns {{ title: string, body: string }}
 */
function normalizePublisherSection(title, body) {
  let nextTitle = canonicalSectionTitle(title);
  let nextBody = String(body || "").trim();
  const kind = sectionKind(nextTitle);

  if (kind === "dates" || kind === "fee") {
    nextBody = nextBody
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map(normalizeKeyValueLine)
      .join("\n");
  } else if (kind === "links") {
    nextBody = normalizeLinksBody(nextBody);
  } else if (kind === "faq") {
    nextBody = normalizeFaqBody(nextBody);
  } else if (kind === "vacancy") {
    const lines = nextBody.split("\n").map((l) => l.trim()).filter(Boolean);
    const hasMixedMarkers = lines.some((l) => /^---table---$/i.test(l) || /^---endtable---$/i.test(l));
    if (!hasMixedMarkers) {
      const tables = detectSmartTables(lines);
      const fullTable =
        tables.length === 1 &&
        tables[0].csvBody &&
        tables[0].startIndex === 0 &&
        tables[0].endIndex >= lines.length
          ? tables[0]
          : null;
      if (fullTable) {
        nextBody = fullTable.csvBody;
      } else {
        const reconstructed = reconstructDelimiterLessVacancyGrid(lines);
        if (reconstructed) {
          const reconLines = reconstructed.split("\n").map((l) => l.trim()).filter(Boolean);
          const reconTables = detectSmartTables(reconLines);
          nextBody =
            reconTables.length === 1 &&
            reconTables[0].csvBody &&
            reconTables[0].startIndex === 0 &&
            reconTables[0].endIndex >= reconLines.length
              ? reconTables[0].csvBody
              : reconstructed;
        }
      }
      const resolved = resolveVacancySectionHeader(nextBody);
      nextTitle = resolved.title;
      nextBody = resolved.body === "—" ? nextBody : resolved.body;
    }
  }

  return { title: nextTitle, body: nextBody };
}

/**
 * Rewrite [Section:] document to canonical titles + body conventions.
 * Unknown custom titles are kept. Does not invent values.
 * @param {string} text
 * @returns {string}
 */
function applyCanonicalPublisherFormat(text) {
  const s = String(text || "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!s) return "";
  if (!/\[Section:/i.test(s)) return s.endsWith("\n") ? s : `${s}\n`;

  const headerRe = /\[Section:\s*([^\]\r\n]+)\]\s*/gi;
  const hits = [];
  let m;
  while ((m = headerRe.exec(s)) !== null) {
    hits.push({ name: m[1].trim(), headerEnd: m.index + m[0].length, start: m.index });
  }
  if (!hits.length) return s.endsWith("\n") ? s : `${s}\n`;

  const parts = [];
  for (let i = 0; i < hits.length; i++) {
    const { name, headerEnd } = hits[i];
    const bodyEnd = i + 1 < hits.length ? hits[i + 1].start : s.length;
    const rawBody = s
      .slice(headerEnd, bodyEnd)
      .split("\n")
      .map((ln) => ln.trim())
      .filter((ln) => ln.length > 0)
      .join("\n");
    const { title, body } = normalizePublisherSection(name, rawBody);
    parts.push(`[Section: ${title}]`);
    if (body) parts.push(body);
  }
  return `${parts.join("\n")}\n`;
}

module.exports = {
  SECTION_ALIAS_MAP,
  canonicalSectionTitle,
  normalizeKeyValueLine,
  normalizeLinksBody,
  normalizeFaqBody,
  normalizePublisherSection,
  applyCanonicalPublisherFormat
};
