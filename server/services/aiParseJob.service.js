/**
 * POST /api/ai-parse — hybrid: smart clean → rule buckets → AI refine → validate → finalize.
 */
"use strict";

const logger = require("../utils/logger");
const { smartCleanJobText } = require("../utils/smartClean");
const {
  detectSections,
  formatBucketsForPrompt,
  bucketsToStructuredDocument
} = require("../utils/sectionDetector");
const { finalizeStructuredJobOutput } = require("../utils/jobSectionStructure");

const MIN_CHARS_REJECT = 20;
const MIN_CHARS_FORCE_OUTPUT = 50;
const OPENAI_MAX_INPUT = 120000;
const FALLBACK_SLICE = 500;

const SYSTEM_REFINE_PROMPT = `You are a structured job data extractor.

INPUT: PRE-CLASSIFIED lines (DATES, QUALIFICATION, AGE, VACANCY, STATE, SELECTION, LINKS, OTHER_HINTS). Noise is already reduced.

GOAL: VALUE-ONLY extraction. Do NOT leave a section empty if the input contains ANY relevant line for that section. Prefer the closest reasonable value over "—". Do NOT paste long paragraphs, RTI, legal text, or instructions.

FORMATTING (strict):
- Each [Section: …] alone on its own line; newline before every [Section: …]
- One data line per row under each section (no comma-joined section headers)

[Section: ShortInfo]
Exactly 2 short lines: organization + (post name and/or total vacancy if present). No long prose.

[Section: Eligibility]
Qualification: bullet lines — only qualification level (12th, Graduation, Degree, etc.), no notes.
Age Limit: bullet lines — numeric range only (e.g. 18-25) when possible; else shortest relevant fragment.
State: state name(s) only, or "—".

[Section: ImportantDates]
Notification Date / Application Start Date / Last Date / Fee Payment Last Date / Exam Date — calendar values ONLY (no sentences). "Notify Soon" allowed for exam if stated. "—" only if nothing parseable.

[Section: SelectionProcess]
Steps only: Written Exam, Interview, Physical Test, Document Verification — no syllabus, marks, or instructions.

[Section: Vacancy]
Structured where possible: Post/Category/Count style lines (e.g. Constable, General, 13093). Short fragments OK; no explanations.

[Section: ImportantLinks]
Label=https://… one per line.

[Section: अक्सर पूछे जाने वाले प्रश्न]
Generate 1–2 simple Q&A in Hindi (or English if input is English-only) from the classified facts (last date, age, qualification, etc.). If no basis, Q: — / A: —.

RULES:
- Fill every section from input when possible; use "—" only when truly nothing applies.
- Never output {{TEXT}} or dollar-brace placeholders.
- No JSON, no markdown # headings.`;

const JOB_LINE_HINT =
  /(vacancy|vacancies|भर्ती|नौकरी|recruit|recruitment|exam|परीक्षा|admit|admit\s*card|result|आयु|age|qualification|शिक्षा|fee|शुल्क|salary|वेतन|last\s*date|closing|opening|apply|आवेदन|notification|विज्ञापन|post|पद|posts|department|मंत्रालय|commission|आयोग|ssc|upsc|railway|bank|police|teacher|lecturer|सहायक|क्लर्क|officer|grade|कुल\s*पद|total\s*post)/i;

function cleanText(inputText) {
  if (!inputText || typeof inputText !== "string") return "";
  return inputText
    .replace(/\r\n/g, "\n")
    .replace(/[\t\f\v\u00a0]+/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanedImportantLines(text) {
  const n = cleanText(text);
  const lines = n
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 1);
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const key = line.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out.join("\n");
}

function fallbackExtractJobLike(text) {
  const n = cleanedImportantLines(text);
  const base = n || cleanText(text);
  const lines = base
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (!lines.length) return null;

  const scored = lines.map((line, idx) => {
    let score = 0;
    if (JOB_LINE_HINT.test(line)) score += 4;
    if (/\d/.test(line)) score += 1;
    if (/(http|www\.|@)/i.test(line)) score += 2;
    if (line.length >= 12 && line.length <= 500) score += 1;
    return { line, score, idx };
  });
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
  const picked = [];
  for (const { line, score } of scored) {
    if (score > 0 && picked.length < 80) {
      picked.push(line);
    }
  }
  if (picked.length >= 3) return picked.join("\n");
  return lines.length ? lines.slice(0, Math.min(45, lines.length)).join("\n") : null;
}

/**
 * @param {string | null} s
 */
function isStrongAiOutput(s) {
  if (!s || typeof s !== "string") return false;
  const t = s.trim();
  if (t.length < 100) return false;
  if (!/\[Section:\s*Eligibility\]/i.test(t)) return false;
  if (!/\[Section:\s*ShortInfo\]/i.test(t)) return false;
  return true;
}

/**
 * @param {string} classifiedOrFallback
 */
async function callOpenAiChat(classifiedOrFallback) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return null;
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const injected = String(classifiedOrFallback || "")
    .replace(/\{\{TEXT\}\}/gi, "")
    .replace(/\$\{text\}/gi, "")
    .trim();
  const body = {
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_REFINE_PROMPT },
      {
        role: "user",
        content: `CLASSIFIED INPUT (refine into template):\n\n${injected.slice(0, OPENAI_MAX_INPUT)}`
      }
    ]
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    logger.warn("aiParseJob: OpenAI HTTP error", { status: res.status, body: errText.slice(0, 500) });
    return null;
  }

  const data = await res.json();
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (typeof content !== "string") return null;
  const t = content.trim();
  return t.length ? t : null;
}

/**
 * @param {string} rawText
 * @returns {Promise<{ result: string }>}
 */
async function processJobParse(rawText) {
  let inputText = typeof rawText === "string" ? rawText : "";
  inputText = inputText.replace(/\{\{TEXT\}\}/gi, "").replace(/\$\{text\}/gi, "").trim();
  const inputLen = inputText.length;

  logger.info("ai-parse extractedText length", { inputLen });

  if (!inputText || inputLen < MIN_CHARS_REJECT) {
    return { result: "No usable data found" };
  }

  let cleanedText = smartCleanJobText(inputText);
  if (cleanedText.length < 40) {
    cleanedText = cleanText(inputText);
  }

  const buckets = detectSections(cleanedText);
  const classifiedBlock = formatBucketsForPrompt(buckets);
  const classifiedLen = classifiedBlock.length;

  logger.info("ai-parse payloadText (classified) length", {
    smartCleanLen: cleanedText.length,
    classifiedLen,
    bucketCounts: {
      dates: buckets.dates.length,
      qualification: buckets.qualification.length,
      age: buckets.age.length,
      vacancy: buckets.vacancy.length,
      state: buckets.state.length,
      selection: buckets.selection.length,
      links: buckets.links.length,
      other: buckets.other.length
    }
  });

  const nonWs = classifiedBlock.replace(/\s/g, "").length;
  const forAi =
    nonWs >= 24 ? classifiedBlock : cleanedText.slice(0, Math.min(OPENAI_MAX_INPUT, cleanedText.length));

  const ruleDoc = bucketsToStructuredDocument(buckets);

  let aiRaw = null;
  if (process.env.OPENAI_API_KEY) {
    try {
      aiRaw = await callOpenAiChat(forAi);
    } catch (e) {
      logger.warn("aiParseJob: OpenAI call failed", { message: e.message });
    }
  }

  logger.info("ai-parse AI response length", {
    length: aiRaw ? aiRaw.length : 0,
    openaiConfigured: !!process.env.OPENAI_API_KEY
  });

  let result = isStrongAiOutput(aiRaw) ? String(aiRaw).trim() : ruleDoc;

  if (!result) {
    const fb = fallbackExtractJobLike(cleanedText.length ? cleanedText : inputText);
    if (fb && String(fb).trim()) result = String(fb).trim();
  }

  if (!result) result = cleanedText.slice(0, FALLBACK_SLICE).trim();
  if (!result) result = inputText.slice(0, FALLBACK_SLICE).trim();

  if (inputLen > MIN_CHARS_FORCE_OUTPUT && !String(result).trim()) {
    result =
      cleanedText.slice(0, FALLBACK_SLICE).trim() ||
      inputText.slice(0, FALLBACK_SLICE).trim();
  }

  if (!result || result.trim().length === 0) {
    result =
      cleanedText?.slice(0, FALLBACK_SLICE) ||
      inputText?.slice(0, FALLBACK_SLICE) ||
      "No usable data found";
  }

  if (!String(result).trim()) {
    result = "No usable data found";
  }

  result = finalizeStructuredJobOutput(result, cleanedText.length ? cleanedText : inputText);

  logger.info("ai-parse FINAL RESULT LENGTH", { length: result?.length });

  return { result };
}

module.exports = {
  processJobParse
};
