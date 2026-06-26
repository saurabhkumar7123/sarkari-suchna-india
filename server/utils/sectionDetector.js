"use strict";

const { extractStrictDateFromText, extractDateValueForDisplay } = require("./extractDateValue");
const { shouldDropLine } = require("./smartClean");
const {
  tryExtractTableRunAt,
  detectRowDelimiter,
  resolveVacancySectionHeader,
  formatVacancyStructured
} = require("./tableDetect");
const {
  pushPublisherSection,
  joinPublisherParts,
  prepareInputForStructuring
} = require("./publisherSections");
const { parseSectionsFromText } = require("../../generator/parse/sectionParse");

const MAX_CLASSIFY_LINE = 280;

/**
 * @param {string} line
 * @returns {boolean}
 */
function isFeeLine(line) {
  const s = String(line || "").trim();
  const l = s.toLowerCase();
  if (/\b(application\s*)?fee(s)?\b|शुल्क|exam\s*fee|registration\s*fee/i.test(l)) return true;
  if (/(₹|rs\.?)\s*[\d,]+/i.test(s) && /\b(general|obc|ews|sc\b|st\b|ur\b|pwd|ph|female|male)\b/i.test(l)) {
    return true;
  }
  if (/\/-\s*$/.test(s) && /[\d,]+/.test(s) && /\b(for|general|obc|ews|sc|st)\b/i.test(l)) return true;
  return false;
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function isNoiseLine(line) {
  const t = line.trim();
  if (!t || t.length < 2) return true;
  if (shouldDropLine(line)) return true;
  if (t.length > MAX_CLASSIFY_LINE && !/\d{1,2}[./-]\d{1,2}/.test(t) && !/https?:\/\//i.test(t)) return true;
  return false;
}

/**
 * @param {string} line
 * @returns {"dates"|"age"|"qualification"|"vacancy"|"selection"|"links"|"state"|"fee"|"other"}
 */
function classifyLine(line) {
  const s = line.trim();
  const l = s.toLowerCase();
  if (/^\[\s*section\s*:/i.test(s)) return "other";
  if (/https?:\/\/|www\./i.test(s)) return "links";
  if (isFeeLine(s)) return "fee";
  if (/^(Q|Question)\s*[:：]/i.test(s) || /^(A|Answer)\s*[:：]/i.test(s)) return "faq";
  if (/^\s*state\s*[:/-]|^राज्य\s*[:：]/i.test(s)) return "state";
  if (
    /\b(domicile|निवास|residing\s+in|only\s+for\s+candidates\s+of)\b/i.test(l) &&
    line.length < 180 &&
    /\b(uttar\s*pradesh|madhya\s*pradesh|bihar|rajasthan|delhi|haryana|punjab|assam|west\s*bengal|odisha|jharkhand|gujarat|maharashtra|karnataka|tamil\s*nadu|telangana|andhra|kerala|goa|chhattisgarh|himachal|uttarakhand|all\s+india|pan\s+india|u\.?p\.?|m\.?p\.?)\b/i.test(
      l
    )
  ) {
    return "state";
  }
  if (
    /\b(written\s*test|typing\s*test|personal\s*interview|document\s*verification|skill\s*test|physical\s*test|medical\s*exam)\b/i.test(
      l
    )
  ) {
    return "selection";
  }
  if (
    /\b(last\s*date|closing\s*date|opening\s*date|notification\s*date|exam\s*date|start\s*date|apply\s*start|online\s*apply|application\s*begin)\b/i.test(
      l
    ) &&
    !isFeeLine(s)
  ) {
    return "dates";
  }
  if (/\bfee\s*payment\s*last\b/i.test(l)) return "dates";
  if (/\d{1,2}[\s./-]+\d{1,2}[\s./-]+\d{2,4}/.test(s)) return "dates";
  if (/\b(last|exam|date|notification|start|schedule)\b/i.test(l) && /\d/.test(s)) return "dates";
  if (/\b(age|years?|आयु|वर्ष|born)\b/i.test(l) && /\d/.test(s)) return "age";
  if (
    /\b(qualification|degree|graduation|certificate|diploma|b\.?e|b\.?tech|m\.?a|m\.?sc|12th|10th|phd|matric|intermediate)\b/i.test(l)
  ) {
    return "qualification";
  }
  if (
    !isFeeLine(s) &&
    ((/\b(vacancy|vacancies|vacant|posts?|category|total)\b/i.test(l) && /\d/.test(s)) ||
      /\b(vacancy|vacancies|posts?\s*per|post\s*[:-]|category\s*[:/-])\b/i.test(l) ||
      (/\b(recruitment|भर्ती)\b/i.test(l) &&
        /\b(posts?|vacancies|vacant|vacancy|पद|seats?)\b/i.test(l) &&
        /\d/.test(s)) ||
      (/\b(obc|sc\b|st\b|ews|ur\b|gen)\b/i.test(l) && /\b(post|vacancy|seat)\b/i.test(l) && /\d/.test(s)))
  ) {
    return "vacancy";
  }
  if (/\b(written|interview|\btest\b|phase\s*[ivx\d]|prelims|mains|objective|descriptive)\b/i.test(l)) {
    return "selection";
  }
  if (/\bexamination\b/i.test(l) && /\b(tier|phase|stage|written|computer\s*based|cbt)\b/i.test(l)) {
    return "selection";
  }
  if (
    detectRowDelimiter(s) &&
    s.length < 220 &&
    !isFeeLine(s) &&
    !/https?:\/\//i.test(s)
  ) {
    return "vacancy";
  }
  return "other";
}

function uniq(lines) {
  const seen = new Set();
  const out = [];
  for (const x of lines) {
    const k = x.toLowerCase().replace(/\s+/g, " ").trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(x.trim());
  }
  return out;
}

/**
 * @param {string} text — already smart-cleaned recommended
 * @returns {{
 *   dates: string[],
 *   qualification: string[],
 *   age: string[],
 *   vacancy: string[],
 *   selection: string[],
 *   links: string[],
 *   state: string[],
 *   fee: string[],
 *   faq: string[],
 *   other: string[]
 * }}
 */
function linesForBucketDetection(text) {
  const normalized = prepareInputForStructuring(text);
  const parsed = parseSectionsFromText(normalized);
  if (parsed.length) {
    return parsed.flatMap((sec) =>
      String(sec.content || "")
        .split("\n")
        .map((x) => x.trim())
        .filter((x) => x.length && !/^\[\s*section\s*:/i.test(x))
    );
  }
  return normalized
    .split("\n")
    .map((x) => x.trim())
    .filter((x) => x.length);
}

function detectSections(text) {
  const buckets = {
    dates: [],
    qualification: [],
    age: [],
    vacancy: [],
    selection: [],
    links: [],
    state: [],
    fee: [],
    faq: [],
    other: []
  };
  const lines = linesForBucketDetection(text);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isNoiseLine(line)) {
      i += 1;
      continue;
    }
    const run = tryExtractTableRunAt(lines, i);
    if (run) {
      buckets.vacancy.push(run.csvBody);
      i = run.endIndex;
      continue;
    }
    const k = classifyLine(line);
    buckets[k].push(line);
    i += 1;
  }
  for (const key of Object.keys(buckets)) {
    buckets[key] = uniq(buckets[key]);
  }
  return buckets;
}

/**
 * @param {ReturnType<typeof detectSections>} buckets
 */
function formatBucketsForPrompt(buckets) {
  const fmt = (label, arr) => {
    const body = arr.length ? arr.map((x) => `- ${x}`).join("\n") : "(none)";
    return `${label}:\n${body}`;
  };
  return [
    fmt("DATES", buckets.dates),
    "",
    fmt("QUALIFICATION", buckets.qualification),
    "",
    fmt("AGE", buckets.age),
    "",
    fmt("VACANCY", buckets.vacancy),
    "",
    fmt("STATE", buckets.state),
    "",
    fmt("SELECTION", buckets.selection),
    "",
    fmt("LINKS", buckets.links),
    "",
    fmt("FEE", buckets.fee || []),
    "",
    fmt("FAQ", buckets.faq || []),
    "",
    fmt("OTHER_HINTS", buckets.other.slice(0, 12))
  ].join("\n");
}

/**
 * @param {string[]} dates
 */
function formatImportantDatesFromBucket(dates) {
  const slots = [
    "Notification Date",
    "Application Start Date",
    "Last Date",
    "Fee Payment Last Date",
    "Exam Date"
  ];
  const values = ["—", "—", "—", "—", "—"];
  const consumed = new Set();

  function slotForLine(low) {
    if (/fee\s*(payment|payable)?|challan|payment\s*last|fee\s*last/i.test(low)) return 3;
    if (/notification|publish|issue|विज्ञापन/i.test(low)) return 0;
    if (/application\s*start|opening|commence|registration\s*start|apply\s*from|start\s*date/i.test(low)) return 1;
    if (/last\s*date|closing|submission\s*last|end\s*date|आखिरी/i.test(low)) return 2;
    if (/exam\s*(date)?|tier|written\s*exam|pt\s*date|mains|परीक्षा\s*तिथि/i.test(low)) return 4;
    return -1;
  }

  dates.forEach((line, di) => {
    const raw = line.replace(/^[-*•]\s*/, "").trim();
    const low = raw.toLowerCase();
    const extracted = extractDateValueForDisplay(raw);
    const idx = slotForLine(low);
    if (idx >= 0 && values[idx] === "—" && extracted !== "—") {
      values[idx] = extracted;
      consumed.add(di);
    }
  });

  let next = 0;
  dates.forEach((line, di) => {
    if (consumed.has(di)) return;
    const raw = line.replace(/^[-*•]\s*/, "").trim();
    const extracted = extractDateValueForDisplay(raw);
    if (extracted === "—") return;
    while (next < 5 && values[next] !== "—") next += 1;
    if (next < 5) values[next++] = extracted;
  });

  return slots.map((label, i) => `${label}: ${values[i]}`).join("\n");
}

/**
 * @param {string[]} links
 */
function formatImportantLinksFromBucket(links) {
  if (!links.length) return "—";
  const labels = ["Apply Online", "Official Website", "Notification PDF", "More"];
  return links
    .map((raw, i) => {
      const t = raw.trim().replace(/^[-*•]\s*/, "");
      const eqIdx = t.indexOf("=");
      if (eqIdx > 0 && /https?:/i.test(t)) {
        const left = t.slice(0, eqIdx).trim();
        const right = t.slice(eqIdx + 1).trim().split(/\s/)[0];
        if (left && /https?:\/\//i.test(right)) return `${left}=${right}`;
      }
      const urlMatch = t.match(/https?:\/\/[^\s)]+/i);
      let url = urlMatch ? urlMatch[0] : "";
      if (!url) {
        const w = t.match(/www\.[^\s)]+/i);
        if (w) url = `https://${w[0]}`;
      }
      if (!url) {
        const rootRelative = t.match(/\/[^\s)=]+/);
        if (rootRelative) url = rootRelative[0];
      }
      const label = labels[i] || `Link ${i + 1}`;
      return url ? `${label}=${url}` : `${label}=—`;
    })
    .join("\n");
}

/**
 * @param {string} line
 */
function extractQualificationSnippet(line) {
  const t = line.replace(/^[-*•]\s*/, "").trim();
  if (/\b(nationality|marital\s*status|certificate\s+must|self\s*attested| oci\b)\b/i.test(t)) {
    const m0 = t.match(
      /\b(10th|12th|intermediate|diploma|graduate|graduation|post\s*graduate|postgraduate|degree|b\.?e\.?|b\.?tech|b\.?sc|m\.?a|m\.?sc|ph\.?d|matric)\b[^.\n]{0,80}/i
    );
    return m0 ? m0[0].replace(/\s+/g, " ").trim() : "—";
  }
  const m = t.match(
    /\b(10th|12th|intermediate|diploma|graduate|graduation|post\s*graduate|postgraduate|degree|b\.?e\.?|b\.?tech|b\.?sc|m\.?a|m\.?sc|ph\.?d|matric)\b[^.\n]{0,80}/i
  );
  if (m) return m[0].replace(/\s+/g, " ").trim();
  const after = t.includes(":") ? t.split(":").slice(1).join(":").trim() : t;
  return after.replace(/\s+/g, " ").trim().slice(0, 100) || t.slice(0, 100);
}

/**
 * @param {string} line
 */
function extractAgeRangeOnly(line) {
  const t = line.replace(/^[-*•]\s*/, "").trim();
  const m = t.match(/\b(\d{1,2}\s*[-–]\s*\d{1,2})\b/);
  if (m) return m[1].replace(/\s/g, "");
  const m2 = t.match(/minimum\s*(\d{1,2}).{0,20}(\d{1,2})/i);
  if (m2) return `${m2[1]}-${m2[2]}`;
  const m3 = t.match(/\bage\s*(\d{1,2}\s*[-–]\s*\d{1,2})/i);
  if (m3) return m3[1].replace(/\s/g, "");
  return t.replace(/\s+/g, " ").trim().slice(0, 48);
}

/**
 * @param {string[]} stateLines
 */
function formatStateLine(stateLines) {
  if (!stateLines.length) return "—";
  const parts = stateLines.map((s) => {
    const t = s.replace(/^[-*•]\s*/, "").trim();
    const m = t.match(/state\s*[:/-]\s*(.+)/i);
    if (m) return m[1].replace(/\s+/g, " ").trim().slice(0, 80);
    return t.replace(/\s+/g, " ").trim().slice(0, 80);
  });
  return parts.filter(Boolean).join(", ") || "—";
}

/**
 * @param {string[]} selection
 */
function formatSelectionSteps(selection) {
  if (!selection.length) return "—";
  const out = [];
  const seen = new Set();
  for (const raw of selection) {
    const l = raw.toLowerCase();
    if (/\b(syllabus|marks|negative\s*mark|exam\s*pattern|paper\s*duration|qualifying\s+marks)\b/i.test(l)) {
      continue;
    }
    if (/(written|objective|cbte|cbt)/i.test(l) && /interview/i.test(l)) {
      if (!seen.has("written exam")) {
        seen.add("written exam");
        out.push("- Written Exam");
      }
      if (!seen.has("interview")) {
        seen.add("interview");
        out.push("- Interview");
      }
      continue;
    }
    let label = "";
    if (/(written|objective|cbte|computer\s*based)/i.test(l)) label = "Written Exam";
    else if (/(personal\s*)?interview|oral\s*test/i.test(l)) label = "Interview";
    else if (/physical|pet|pst|efficiency|measurement/i.test(l)) label = "Physical Test";
    else if (/document|dv\b|verification/i.test(l)) label = "Document Verification";
    else if (/\btest\b|tier|phase/i.test(l)) label = raw.replace(/^[-*•]\s*/, "").trim().slice(0, 50);
    if (!label) label = raw.replace(/^[-*•]\s*/, "").trim().slice(0, 55);
    const k = label.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(`- ${label}`);
  }
  return out.length ? out.join("\n") : "—";
}

/**
 * @param {string[]} vacancy — re-exported from tableDetect
 */

/**
 * @param {ReturnType<typeof detectSections>} buckets
 * @returns {[string, string]}
 */
function isProseLine(line) {
  const s = String(line || "").trim();
  if (!s || s.length < 10) return false;
  if (isFeeLine(s) || /https?:\/\/|www\./i.test(s)) return false;
  if (/^\[\s*section\s*:/i.test(s)) return false;
  if (/\d{1,2}[\s./-]+\d{1,2}[\s./-]+\d{2,4}/.test(s)) return false;
  if (/\b(date|fee|age|qualification|last\s*date|apply\s*online)\b/i.test(s) && /:\s*/.test(s)) return false;
  const kind = classifyLine(s);
  return kind === "other" || kind === "state";
}

function buildShortInfoLines(buckets) {
  const prose = buckets.other.filter(isProseLine).map((x) => x.replace(/\s+/g, " ").trim().slice(0, 240));
  if (prose.length) {
    let line2 = "—";
    if (buckets.vacancy[0]) {
      line2 = buckets.vacancy[0].replace(/^[-*•]\s*/, "").trim().slice(0, 140);
    }
    const joined = buckets.vacancy.join(" ");
    const total =
      joined.match(/(?:कुल|total)\s*(?:posts?|पद)?\s*[:\s]*([\d,]+)/i) ||
      joined.match(/\b([\d,]{2,})\s*posts?\b/i);
    if (total && line2 !== "—" && !line2.includes(total[1])) {
      line2 = `${line2} | Total posts: ${total[1]}`;
    } else if (total && line2 === "—") {
      line2 = `Total posts: ${total[1]}`;
    }
    return [prose[0], prose[1] || (line2 !== "—" ? line2 : prose[2])].filter(Boolean);
  }

  const orgHint =
    buckets.other.find((x) => /commission|board|department|ministry|आयोग|विभाग|निगम|corporation/i.test(x)) ||
    buckets.other.find((x) => /recruitment|notification|police|railway|ssc|upsc|vacancy|भर्ती/i.test(x)) ||
    buckets.other[0] ||
    "—";
  let line2 = "—";
  if (buckets.vacancy[0]) {
    line2 = buckets.vacancy[0].replace(/^[-*•]\s*/, "").trim().slice(0, 140);
  }
  const joined = buckets.vacancy.join(" ");
  const total =
    joined.match(/(?:कुल|total)\s*(?:posts?|पद)?\s*[:\s]*([\d,]+)/i) || joined.match(/\b([\d,]{2,})\s*posts?\b/i);
  if (total && !line2.includes(total[1])) {
    line2 = line2 === "—" ? `Total posts: ${total[1]}` : `${line2} | Total posts: ${total[1]}`;
  }
  return [orgHint.replace(/\s+/g, " ").trim().slice(0, 200), line2.replace(/\s+/g, " ").trim().slice(0, 200)];
}

/**
 * @param {string[]} faqLines
 * @returns {string}
 */
function formatFaqFromBucket(faqLines) {
  if (!faqLines || !faqLines.length) return "";
  return faqLines
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter((l) => l.length > 0 && !/^Q:\s*—\s*$/i.test(l) && !/^A:\s*—\s*$/i.test(l))
    .join("\n");
}

/**
 * Only user-provided Q/A lines — no auto Hindi generation.
 * @param {ReturnType<typeof detectSections>} buckets
 */
function buildFaqFromBuckets(buckets) {
  return formatFaqFromBucket(buckets.faq);
}

function formatImportantDatesPublisher(dates) {
  if (!dates.length) return "—";
  const rows = dates
    .map((line) => {
      const t = line.replace(/^[-*•]\s*/, "").trim();
      if (!t || /^\[\s*section\s*:/i.test(t)) return "";
      if (/:\s*/.test(t)) return t;
      const val = extractDateValueForDisplay(t);
      return val !== "—" ? val : t;
    })
    .filter(Boolean);
  return rows.length ? rows.join("\n") : "—";
}

/**
 * @param {string[]} fee
 */
function formatApplicationFeeFromBucket(fee) {
  if (!fee || !fee.length) return "—";
  const rows = fee.map((line) => line.replace(/^[-*•]\s*/, "").trim()).filter(Boolean);
  return rows.length ? rows.join("\n") : "—";
}

function bucketsToPublisherDocument(buckets) {
  const shortLines = buildShortInfoLines(buckets);
  const shortBody = shortLines.filter((x) => x && x !== "—").join("\n");

  const q = buckets.qualification.length
    ? buckets.qualification.map((x) => `- ${extractQualificationSnippet(x)}`).join("\n")
    : "";
  const a = buckets.age.length ? buckets.age.map((x) => `- ${extractAgeRangeOnly(x)}`).join("\n") : "";
  const st = formatStateLine(buckets.state);
  const d = formatImportantDatesPublisher(buckets.dates);
  const fee = formatApplicationFeeFromBucket(buckets.fee);
  const v = formatVacancyStructured(buckets.vacancy);
  const vacancySec = resolveVacancySectionHeader(v);
  const sel = formatSelectionSteps(buckets.selection);
  const links = formatImportantLinksFromBucket(buckets.links);
  const faq = buildFaqFromBuckets(buckets);

  const eligLines = [];
  if (q && q !== "—") eligLines.push(`Qualification: ${q}`);
  if (a && a !== "—") eligLines.push(`Age Limit: ${a}`);
  if (st && st !== "—") eligLines.push(`State: ${st}`);

  const parts = [];
  pushPublisherSection(parts, "Short Information", shortBody);
  pushPublisherSection(parts, "Eligibility", eligLines.join("\n"));
  pushPublisherSection(parts, "Important Dates", d !== "—" ? d : "");
  pushPublisherSection(parts, "Application Fee", fee !== "—" ? fee : "");
  pushPublisherSection(parts, "Selection Process", sel !== "—" ? sel : "");
  pushPublisherSection(parts, vacancySec.title, vacancySec.body !== "—" ? vacancySec.body : "");
  pushPublisherSection(parts, "Important Links", links !== "—" ? links : "");
  pushPublisherSection(parts, "Important Questions", faq);

  return joinPublisherParts(parts);
}

function bucketsToStructuredDocument(buckets) {
  return bucketsToPublisherDocument(buckets);
}

module.exports = {
  detectSections,
  linesForBucketDetection,
  formatBucketsForPrompt,
  bucketsToStructuredDocument,
  bucketsToPublisherDocument,
  formatImportantDatesFromBucket,
  formatImportantDatesPublisher,
  formatApplicationFeeFromBucket,
  formatImportantLinksFromBucket,
  formatVacancyStructured,
  resolveVacancySectionHeader,
  extractStrictDateFromText,
  extractDateValueForDisplay,
  classifyLine,
  isNoiseLine,
  isFeeLine
};
