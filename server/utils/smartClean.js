"use strict";

const ANNEXURE_LINE = /^\s*annexure[\s\-–:]*[ivx\d]*\s*$/i;
const PAGE_PIPE = /page\s*\|\s*\d+|^\s*page\s+\d+\s*of\s+\d+\s*$/i;
const RTI_OR_LEGAL =
  /\b(rti|right\s+to\s+information|tribunal|writ\s+petition|jurisdiction|legal\s+notice|disclaimer|undertaking|court\s+of)\b/i;
// Phase AI-1: do NOT drop How To Apply / Syllabus / Important Instructions — preserve for section detection.
const PAYMENT_RULES =
  /\b(refund\s+of\s+fee|fee\s+once\s+paid|fee\s+shall\s+not\s+be|payment\s+gateway\s+will|online\s+payment\s+only|challan\s+generation\s+rules)\b/i;
const GENERAL_CONDITIONS =
  /\b(general\s+conditions|terms\s+and\s+conditions|violation|liable\s+for|deemed\s+to\s+be|without\s+prejudice|in\s+case\s+of\s+dispute)\b/i;
const CERTIFICATE_RULES =
  /\b(certificate\s+(must|shall)|self\s*attested|dated\s+not\s+earlier|validity\s+of\s+certificate|issued\s+not\s+earlier|bona\s*fide)\b/i;
const ELIGIBILITY_NOISE =
  /\b(nationality|marital\s*status|nri\s+quota| oci\b|persons\s+of\s+indian\s+origin)\b/i;

/**
 * @param {string} line
 * @returns {boolean}
 */
function shouldDropLine(line) {
  const t = line.trim();
  if (!t) return false;
  if (ANNEXURE_LINE.test(t)) return true;
  if (PAGE_PIPE.test(t)) return true;
  if (RTI_OR_LEGAL.test(t)) return true;
  if (PAYMENT_RULES.test(t)) return true;
  if (GENERAL_CONDITIONS.test(t)) return true;
  if (CERTIFICATE_RULES.test(t)) return true;
  if (ELIGIBILITY_NOISE.test(t)) return true;
  if (/^\(?\s*see\s+annexure/i.test(t)) return true;

  if (t.length > 320) return true;
  if (
    t.length > 200 &&
    (t.match(/\./g) || []).length >= 4 &&
    !/\b(last\s*date|notification|vacancy|posts?|qualification|age\s*limit|exam\s*date|how\s*to\s*apply|syllabus|salary|helpline)\b/i.test(
      t
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Remove annexure / RTI / instructions / page markers; normalize whitespace.
 * @param {string} text
 * @returns {string}
 */
function smartCleanJobText(text) {
  if (!text || typeof text !== "string") return "";
  const raw = text.replace(/\r\n/g, "\n").replace(/\{\{TEXT\}\}/gi, "").replace(/\$\{text\}/gi, "");
  const lines = raw.split("\n");
  const out = [];
  let annexSkip = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const tr = line.trim();
    if (/^annexure\b/i.test(tr)) {
      annexSkip = true;
      continue;
    }
    if (annexSkip) {
      if (!tr) {
        annexSkip = false;
        continue;
      }
      if (tr.length > 80 && /\d{1,2}[./-]\d{1,2}/.test(tr)) {
        annexSkip = false;
        out.push(line);
      }
      continue;
    }
    if (shouldDropLine(line)) continue;
    out.push(line);
  }
  return out
    .join("\n")
    .replace(/[\t\f\v\u00a0]+/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "")
    .trim();
}

module.exports = { smartCleanJobText, shouldDropLine };
