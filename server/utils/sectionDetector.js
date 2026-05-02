"use strict";

const { extractStrictDateFromText, extractDateValueForDisplay } = require("./extractDateValue");
const { shouldDropLine } = require("./smartClean");

const MAX_CLASSIFY_LINE = 280;

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
 * @returns {"dates"|"age"|"qualification"|"vacancy"|"selection"|"links"|"state"|"other"}
 */
function classifyLine(line) {
  const s = line.trim();
  const l = s.toLowerCase();
  if (/https?:\/\/|www\./i.test(s)) return "links";
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
  if (/\b(last\s*date|closing\s*date|opening\s*date|notification\s*date|exam\s*date|start\s*date|fee\s*payment|application\s*begin)\b/i.test(l)) {
    return "dates";
  }
  if (/\d{1,2}[\s./-]+\d{1,2}[\s./-]+\d{2,4}/.test(s)) return "dates";
  if (/\b(last|exam|date|notification|start|schedule)\b/i.test(l) && /\d/.test(s)) return "dates";
  if (/\b(age|years?|आयु|वर्ष|born)\b/i.test(l) && /\d/.test(s)) return "age";
  if (
    /\b(qualification|degree|graduation|certificate|diploma|b\.?e|b\.?tech|m\.?a|m\.?sc|12th|10th|phd|matric|intermediate)\b/i.test(l)
  ) {
    return "qualification";
  }
  if (
    (/\b(vacancy|vacancies|vacant|posts?|category|obc|sc\b|st\b|ews|ur\b|gen|total)\b/i.test(l) && /\d/.test(s)) ||
    /\b(vacancy|vacancies|posts?\s*per|post\s*[:-]|category\s*[:/-])\b/i.test(l) ||
    (/\b(recruitment|भर्ती)\b/i.test(l) &&
      /\b(posts?|vacancies|vacant|vacancy|पद|seats?)\b/i.test(l) &&
      /\d/.test(s))
  ) {
    return "vacancy";
  }
  if (/\b(written|interview|\btest\b|examination|phase\s*[ivx\d])\b/i.test(l)) return "selection";
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
 *   other: string[]
 * }}
 */
function detectSections(text) {
  const buckets = {
    dates: [],
    qualification: [],
    age: [],
    vacancy: [],
    selection: [],
    links: [],
    state: [],
    other: []
  };
  const lines = String(text || "")
    .split("\n")
    .map((x) => x.trim())
    .filter((x) => x.length);
  for (const line of lines) {
    if (isNoiseLine(line)) continue;
    const k = classifyLine(line);
    buckets[k].push(line);
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
 * @param {string[]} vacancy
 */
function formatVacancyStructured(vacancy) {
  if (!vacancy.length) return "—";
  return vacancy
    .map((raw) => {
      let t = raw.replace(/^[-*•]\s*/, "").trim();
      if (/\b(candidates?\s+are|therefore|accordingly|shall\s+be\s+eligible|general\s+information)\b/i.test(t)) {
        return "";
      }
      if (t.length > 140) t = t.slice(0, 140).trim();
      const parts = t.split(/[|,]/).map((x) => x.trim()).filter(Boolean);
      if (parts.length >= 2 && /\d/.test(parts[parts.length - 1])) {
        return parts.join(", ");
      }
      const nums = t.match(/\d[\d,\s]*/);
      const textOnly = nums ? t.replace(nums[0], "").replace(/\s+/g, " ").trim() : t;
      if (nums && textOnly.length > 2) return `${textOnly}, ${nums[0].replace(/\s/g, "")}`;
      return t;
    })
    .filter(Boolean)
    .join("\n") || "—";
}

/**
 * @param {ReturnType<typeof detectSections>} buckets
 * @returns {[string, string]}
 */
function buildShortInfoLines(buckets) {
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
 * @param {ReturnType<typeof detectSections>} buckets
 */
function buildFaqFromBuckets(buckets) {
  const rows = [];
  const lastLine = buckets.dates.find((d) => /last|closing|submission|आखिरी/i.test(d));
  const lastVal = lastLine ? extractDateValueForDisplay(lastLine) : null;
  if (lastVal && lastVal !== "—") {
    rows.push({ q: "आवेदन की अंतिम तिथि क्या है?", a: lastVal });
  }
  const ageLine = buckets.age[0];
  if (ageLine) {
    const ar = extractAgeRangeOnly(ageLine);
    if (ar && ar !== "—") rows.push({ q: "आयु सीमा क्या है?", a: ar });
  }
  if (rows.length < 2 && buckets.qualification[0]) {
    rows.push({ q: "शैक्षणिक योग्यता क्या है?", a: extractQualificationSnippet(buckets.qualification[0]) });
  }
  if (!rows.length) return "Q: —\nA: —";
  if (rows.length === 1) return `Q: ${rows[0].q}\nA: ${rows[0].a}`;
  return `Q: ${rows[0].q}\nA: ${rows[0].a}\nQ: ${rows[1].q}\nA: ${rows[1].a}`;
}

function bucketsToStructuredDocument(buckets) {
  const [short1, short2] = buildShortInfoLines(buckets);

  const q = buckets.qualification.length
    ? buckets.qualification.map((x) => `- ${extractQualificationSnippet(x)}`).join("\n")
    : "—";
  const a = buckets.age.length ? buckets.age.map((x) => `- ${extractAgeRangeOnly(x)}`).join("\n") : "—";
  const st = formatStateLine(buckets.state);
  const d = formatImportantDatesFromBucket(buckets.dates);
  const v = formatVacancyStructured(buckets.vacancy);
  const sel = formatSelectionSteps(buckets.selection);
  const links = formatImportantLinksFromBucket(buckets.links);
  const faq = buildFaqFromBuckets(buckets);

  return `[Section: ShortInfo]
${short1}
${short2}

[Section: Eligibility]
Qualification:
${q}
Age Limit:
${a}
State:
${st}

[Section: ImportantDates]
${d}

[Section: SelectionProcess]
${sel}

[Section: Vacancy]
${v}

[Section: ImportantLinks]
${links}

[Section: अक्सर पूछे जाने वाले प्रश्न]
${faq}
`;
}

module.exports = {
  detectSections,
  formatBucketsForPrompt,
  bucketsToStructuredDocument,
  formatImportantDatesFromBucket,
  formatImportantLinksFromBucket,
  formatVacancyStructured,
  extractStrictDateFromText,
  extractDateValueForDisplay,
  classifyLine,
  isNoiseLine
};
