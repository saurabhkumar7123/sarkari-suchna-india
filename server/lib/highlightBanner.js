"use strict";

const PLACEHOLDER_FACT_RE =
  /will\s+be\s+update(d)?(\s+here)?\s+soon|will\s+be\s+updated\s+soon|available\s+soon|to\s+be\s+announced|^tba$|^n\/a$|^-$|not\s+yet\s+(released|announced|available)|coming\s+soon/i;

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isPlaceholderFactValue(value) {
  return PLACEHOLDER_FACT_RE.test(cleanText(value));
}

function normalizeStatusKey(value) {
  return cleanText(value).toLowerCase();
}

function extractFieldFromText(text, label) {
  const src = String(text || "");
  if (!src) return "";
  const re = new RegExp(`${label}\\s*:\\s*([^\\n\\r]+)`, "i");
  const m = src.match(re);
  return m && m[1] ? cleanText(m[1]) : "";
}

function extractSectionBlock(text, sectionName) {
  const src = String(text || "");
  const re = new RegExp(
    `\\[Section:\\s*${sectionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\]([\\s\\S]*?)(?=\\[Section:|$)`,
    "i"
  );
  const m = src.match(re);
  return m && m[1] ? String(m[1]) : "";
}

function extractRowValueFromBlock(block, labelRe) {
  const lines = String(block || "")
    .split(/\r?\n/)
    .map((line) => cleanText(line))
    .filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^([^:]+):\s*(.+)$/);
    if (!m) continue;
    if (labelRe.test(cleanText(m[1]))) return cleanText(m[2]);
  }
  return "";
}

function formatPostsWithCommas(value) {
  const raw = cleanText(value);
  if (!raw) return "";
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return raw;
  return Number(digits).toLocaleString("en-IN");
}

function bannerStatusBadge(normalizedStatus, title) {
  const status = normalizeStatusKey(normalizedStatus);
  const t = cleanText(title).toLowerCase();

  if (status.includes("admit") || /\badmit\s*card\b/.test(t)) return "Admit Card";
  if (status.includes("result") || /\bresult\b/.test(t)) return "Result Declared";
  if (status.includes("answer") || /\banswer\s*key\b/.test(t)) return "Answer Key";
  if (status.includes("syllabus") || /\bsyllabus\b/.test(t)) return "Syllabus";
  if (status.includes("admission") || /\badmission\b/.test(t)) return "Admission";
  if (
    status.includes("new form") ||
    status === "form" ||
    status === "new" ||
    /\bonline\s+form\b/.test(t) ||
    /\bapply\s+online\b/.test(t)
  ) {
    return "Apply Online";
  }
  if (status.includes("notification") || /\bnotification\b/.test(t)) return "Notification";
  return "Recruitment";
}

const ORG_RULES = [
  { re: /\b(upsssc|uttar pradesh subordinate services selection commission)\b/i, label: "UPSSSC" },
  { re: /\b(staff selection commission|ssc)\b/i, label: "SSC" },
  { re: /\b(union public service commission|upsc)\b/i, label: "UPSC" },
  { re: /\b(railway recruitment board|rrb)\b/i, label: "RRB" },
  { re: /\b(uttar pradesh police|up police)\b/i, label: "UP Police" },
  { re: /\b(crpf|central reserve police force)\b/i, label: "CRPF" },
  { re: /\b(bsf|border security force)\b/i, label: "BSF" },
  { re: /\b(cisf)\b/i, label: "CISF" },
  { re: /\b(itbp)\b/i, label: "ITBP" },
  { re: /\b(indian air force|airforce|iaf|agniveer vayu)\b/i, label: "Indian Air Force" },
  { re: /\b(indian army|join indian army)\b/i, label: "Indian Army" },
  { re: /\b(indian navy)\b/i, label: "Indian Navy" },
  { re: /\b(ctet|central teacher eligibility test)\b/i, label: "CTET" },
  { re: /\b(up tgt|up pgt|tgt|pgt)\b/i, label: "UP Education" },
  { re: /\b(allahabad high court|high court)\b/i, label: "High Court" },
  { re: /\b(railway)\b/i, label: "Railway" },
  { re: /\b(uttar pradesh|up\s)\b/i, label: "Uttar Pradesh" },
  { re: /\b(bihar)\b/i, label: "Bihar" },
  { re: /\b(rajasthan)\b/i, label: "Rajasthan" },
  { re: /\b(madhya pradesh|mp\s)\b/i, label: "Madhya Pradesh" }
];

function bannerOrgName(title, category, text) {
  const haystack = `${title} ${category} ${text}`.toLowerCase();
  for (const rule of ORG_RULES) {
    if (rule.re.test(haystack)) return rule.label;
  }
  const cat = cleanText(category);
  if (cat && cat.toLowerCase() !== "general") {
    return cat
      .split(/[,\s]+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }
  return "Official Notification";
}

function extractYear(title, text) {
  const combined = `${title} ${text}`;
  const m = combined.match(/\b(20\d{2})\b/);
  return m ? m[1] : "";
}

function shortBannerTitle(title, postName) {
  let t = cleanText(title);
  if (!t) return cleanText(postName);

  t = t.replace(/\([\d,\s]+posts?\)/gi, "").trim();
  t = t.replace(
    /\b(online\s+form|apply\s+online|admit\s+card|answer\s+key|result\s+declared?|notification|dv\s*&\s*pst)\b/gi,
    ""
  );
  t = t.replace(/\s{2,}/g, " ").replace(/[-–,:]+\s*$/g, "").trim();

  const year = extractYear(t, "");
  const post = cleanText(postName);
  if (t.length > 48 && post) {
    const withYear = year && !post.includes(year) ? `${post} ${year}` : post;
    return cleanText(withYear);
  }
  return t || post;
}

function bannerActionLine(normalizedStatus, title) {
  const badge = bannerStatusBadge(normalizedStatus, title);
  if (badge === "Apply Online") return "Online Form Started";
  if (badge === "Admit Card") return "Hall Ticket Available";
  if (badge === "Result Declared") return "Check Result Now";
  if (badge === "Answer Key") return "Answer Key Released";
  if (badge === "Syllabus") return "Download Syllabus";
  if (badge === "Admission") return "Admission Update";
  if (badge === "Notification") return "Official Notification";
  return "Latest Update";
}

function extractQualificationSnippet(text) {
  const eligibility = extractSectionBlock(text, "Eligibility");
  const src = eligibility || String(text || "");
  const match = src.match(
    /(10th|12th|intermediate|diploma|graduation|graduate|degree|b\.?\s*e\.?|b\.?\s*tech|iti|post\s*graduate|master|b\.?\s*ed)/i
  );
  if (!match) return "";
  const idx = src.toLowerCase().indexOf(match[0].toLowerCase());
  const snippet = cleanText(src.slice(Math.max(0, idx - 12), Math.min(src.length, idx + 48)));
  if (!snippet || snippet.length > 60) return match[0];
  return snippet;
}

function extractBannerFact(text) {
  const datesBlock = extractSectionBlock(text, "ImportantDates") || extractSectionBlock(text, "Important Dates");
  const lastDate =
    extractRowValueFromBlock(datesBlock, /(?:online\s+apply\s+)?last\s*date/i) ||
    extractFieldFromText(text, "Last Date") ||
    extractFieldFromText(text, "Online Apply Last Date");
  if (lastDate && !isPlaceholderFactValue(lastDate)) return `Last Date: ${lastDate}`;

  const examDate =
    extractRowValueFromBlock(datesBlock, /exam\s*date/i) || extractFieldFromText(text, "Exam Date");
  if (examDate && !isPlaceholderFactValue(examDate)) return `Exam Date: ${examDate}`;

  const qualification =
    extractRowValueFromBlock(extractSectionBlock(text, "Eligibility"), /qualification/i) ||
    extractQualificationSnippet(text);
  if (qualification && !isPlaceholderFactValue(qualification)) {
    const q = qualification.length > 52 ? `${qualification.slice(0, 49)}…` : qualification;
    return `Qualification: ${q}`;
  }

  const fee =
    extractRowValueFromBlock(extractSectionBlock(text, "Application Fee"), /fee|amount/i) ||
    extractFieldFromText(text, "Application Fee");
  if (fee && !isPlaceholderFactValue(fee)) return `Fees: ${fee}`;

  const age =
    extractRowValueFromBlock(extractSectionBlock(text, "Eligibility"), /age/i) ||
    extractFieldFromText(text, "Age Limit");
  if (age && !isPlaceholderFactValue(age)) return `Age: ${age}`;

  return "";
}

function bannerAdvtDisplay(advertisementNo, orgName) {
  const advt = cleanText(advertisementNo);
  if (advt && advt !== "-" && !isPlaceholderFactValue(advt)) return advt;
  return cleanText(orgName) || "Official Notification";
}

function bannerThemeClass(title, category, normalizedStatus) {
  const s = `${title} ${category} ${normalizedStatus}`.toLowerCase();
  if (/\brailway\b/.test(s) || /\brrb\b/.test(s)) return "theme-railway";
  if (/\barmy\b/.test(s) || /\bdefence\b/.test(s) || /\bdefense\b/.test(s) || /\bairforce\b/.test(s) || /\bagniveer\b/.test(s)) {
    return "theme-defence";
  }
  if (/\bpolice\b/.test(s) || /\bcrpf\b/.test(s) || /\bbsf\b/.test(s)) return "theme-police";
  if (/\bssc\b/.test(s) || /\bupsc\b/.test(s)) return "theme-ssc";
  if (/\bctet\b/.test(s) || /\btet\b/.test(s) || /\btgt\b/.test(s) || /\bpgt\b/.test(s) || /\bteaching\b/.test(s)) {
    return "theme-teaching";
  }
  if (/\bhigh court\b/.test(s) || /\bcourt\b/.test(s)) return "theme-court";
  if (/\bupsssc\b/.test(s) || /\buttar pradesh\b/.test(s) || /\bbihar\b/.test(s) || /\brajasthan\b/.test(s)) {
    return "theme-state";
  }
  return "";
}

/**
 * @param {{
 *   title: string,
 *   text?: string,
 *   category?: string,
 *   normalizedStatus?: string,
 *   postName?: string | null,
 *   totalPosts?: string | null,
 *   advertisementNo?: string
 * }} opts
 */
function buildHighlightBannerFields(opts) {
  const title = cleanText(opts.title);
  const text = String(opts.text || "");
  const category = cleanText(opts.category);
  const normalizedStatus = normalizeStatusKey(opts.normalizedStatus);
  const postName = cleanText(opts.postName) || title;
  const totalPostsRaw = cleanText(opts.totalPosts);
  const advertisementNo = cleanText(opts.advertisementNo);

  const orgName = bannerOrgName(title, category, text);
  const statusBadge = bannerStatusBadge(normalizedStatus, title);
  const titleShort = shortBannerTitle(title, postName);
  const actionLine = bannerActionLine(normalizedStatus, title);
  const fact = extractBannerFact(text);
  const totalPostsFormatted = formatPostsWithCommas(totalPostsRaw);
  const advtDisplay = bannerAdvtDisplay(advertisementNo, orgName);
  const themeClass = bannerThemeClass(title, category, normalizedStatus);

  return {
    BANNER_STATUS_BADGE: statusBadge,
    BANNER_ORG: orgName,
    BANNER_TITLE_SHORT: titleShort,
    BANNER_ACTION: actionLine,
    BANNER_FACT: fact,
    BANNER_ADVT_DISPLAY: advtDisplay,
    BANNER_THEME_CLASS: themeClass,
    TOTAL_POSTS_FORMATTED: totalPostsFormatted
  };
}

module.exports = {
  bannerStatusBadge,
  bannerOrgName,
  shortBannerTitle,
  bannerActionLine,
  extractBannerFact,
  formatPostsWithCommas,
  bannerAdvtDisplay,
  bannerThemeClass,
  buildHighlightBannerFields,
  isPlaceholderFactValue
};
