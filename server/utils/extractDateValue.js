"use strict";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const MONTH_ALT = MONTH_NAMES.join("|");

const MILESTONE_DATE_HINT =
  /\b(last\s*date|closing\s*date|opening\s*date|notification\s*date|exam\s*date|start\s*date|end\s*date|apply\s*(?:start|begin|from|online)|application\s*(?:begin|start|end|last)|online\s*apply|fee\s*payment\s*last|admit\s*card|result\s*(?:date|declared)|correction\s*(?:window|date|from)|counselling|counseling|preference(?:s)?|sliding(?:\s+process)?|tentative\s+allocation|reallocation|to\s*be\s*held|will\s*be\s*(?:held|conducted)|held\s+on|declared\s+on|schedule|conduct(?:ed)?\s+following\s+examinations?|examinations?\s+at\b|from\s+\d{1,2})/i;

/**
 * @param {string} d
 * @param {string} mo
 * @param {string} yStr
 * @returns {string|null}
 */
function formatNumericDayMonthYear(d, mo, yStr) {
  const day = parseInt(d, 10);
  const month = parseInt(mo, 10);
  if (Number.isNaN(day) || Number.isNaN(month) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  let year = parseInt(yStr, 10);
  if (Number.isNaN(year)) return null;
  if (yStr.length === 2) {
    year = year >= 70 ? 1900 + year : 2000 + year;
  }
  if (year < 1900 || year > 2100) return null;
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

/**
 * Allocation / last-selected grid row whose trailing date is a candidate DOB, not an event.
 * Example: D54 UR 6 5 211 119 171.67478 30-12-2002
 * @param {string} line
 */
function isAllocationTableDateRow(line) {
  const s = String(line || "").trim();
  if (!s) return false;
  if (/\b(date\s*of\s*birth|d\.?o\.?b\.?|birth\s*date|जन्म\s*तिथि)\b/i.test(s)) return true;
  if (
    /^[A-Z]{1,3}\d{2,4}\s+\b(UR|SC|ST|OBC|EWS|ESM|OH|HH|VH|OTHERS|PWD)/i.test(s) &&
    /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(s)
  ) {
    return true;
  }
  if (/\blast\s+selected\s+candidate/i.test(s) && /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(s)) {
    return true;
  }
  const dateHits = s.match(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/g) || [];
  const numHits = s.match(/\b\d+(?:\.\d+)?\b/g) || [];
  if (
    dateHits.length === 1 &&
    numHits.length >= 6 &&
    /^[A-Z0-9]{2,}\s/.test(s) &&
    !MILESTONE_DATE_HINT.test(s)
  ) {
    return true;
  }
  return false;
}

/**
 * DOB / certificate validity / allocation-row dates / random refs — not application schedule dates.
 * @param {string} line
 */
function isNonApplicationDateContext(line) {
  const l = String(line || "").toLowerCase();
  if (
    /\b(date\s*of\s*birth|d\.?o\.?b\.?|born\s+(on|before|after)|birth\s*date|father'?s?\s*name|mother'?s?\s*name|matriculation\s+certificate\s+date|जन्म\s*तिथि)\b/i.test(
      l
    )
  ) {
    return true;
  }
  if (/\b(certificate\s+valid|issued\s+not\s+earlier|not\s+later\s+than\s+.*certificate|validity\s+of)\b/i.test(l)) {
    return true;
  }
  if (/\b(reckon|cut[\s-]*off\s*date\s*for\s*age|age\s*count)\b/i.test(l) && /\b(19|20)\d{2}\b/.test(l)) {
    return true;
  }
  if (isAllocationTableDateRow(line)) return true;
  return false;
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function hasDateToken(line) {
  const s = String(line || "");
  if (/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(s)) return true;
  const word = new RegExp(
    `\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_ALT})\\s*,?\\s*\\d{4}\\b`,
    "i"
  );
  if (word.test(s)) return true;
  const mdy = new RegExp(`\\b(?:${MONTH_ALT})\\s+\\d{1,2}\\s*,?\\s*\\d{4}\\b`, "i");
  if (mdy.test(s)) return true;
  return /\b(notify\s*soon|to\s*be\s*announced|t\.?\s*b\.?\s*a\.?)\b/i.test(s);
}

/**
 * Citation / file dates ("Notice dated 23.06.2025") are not schedule milestones.
 * @param {string} line
 */
function isReferenceFileDateLine(line) {
  const s = String(line || "").trim();
  if (!s) return false;
  if (
    /\b(notice|corrigendum|office\s*memorandum|\bom\b)\s+dated\b/i.test(s) &&
    s.length > 60 &&
    !/\b(sliding\s+process|preference|to\s+be\s+held|exam\s+date|last\s+date|from\s+\d{1,2})\b/i.test(s)
  ) {
    return true;
  }
  if (/^no\.\s*[A-Z0-9]/i.test(s) && /\d{4}/.test(s) && s.length < 90 && !MILESTONE_DATE_HINT.test(s)) {
    return true;
  }
  return false;
}

/**
 * True only when the line names a schedule/event milestone (exam, apply, result, sliding, etc.).
 * A date-like token alone is not enough.
 * @param {string} line
 */
function isMilestoneEventDateLine(line) {
  const s = String(line || "").trim();
  if (!s) return false;
  if (isNonApplicationDateContext(s)) return false;
  if (isReferenceFileDateLine(s)) return false;
  const labeledEvent =
    /\b(last\s*date|closing\s*date|opening\s*date|notification\s*date|exam\s*date|start\s*date|apply\s*start|online\s*apply|application\s*begin|fee\s*payment\s*last)\b/i.test(
      s
    );
  if (!hasDateToken(s) && !labeledEvent) return false;
  if (MILESTONE_DATE_HINT.test(s)) return true;
  if (/^dated\s*[:：]/i.test(s) && hasDateToken(s) && s.length < 48) return true;
  if (/^[^:]{3,80}:\s*.+\d/.test(s) && hasDateToken(s) && !/https?:\/\//i.test(s)) {
    const label = s.split(":")[0];
    if (MILESTONE_DATE_HINT.test(label) || /\b(date|from|to|held|exam|apply|result|sliding|allocation)\b/i.test(label)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns only a compact date value (or "Notify Soon"), never a full sentence.
 * @param {string} raw
 * @returns {string|null}
 */
function extractStrictDateFromText(raw) {
  const line = String(raw || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!line) return null;
  if (isNonApplicationDateContext(line)) return null;

  if (
    /\b(notify\s*soon|to\s*be\s*(announced|notified|intimated)|will\s*be\s*(notified|announced|intimated)|t\.?\s*b\.?\s*a\.?|अभी\s*घोषित)\b/i.test(
      line
    )
  ) {
    return "Notify Soon";
  }

  const reWordDMY = /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s*,?\s*(\d{4})\b/i;
  const mWord = line.match(reWordDMY);
  if (mWord) {
    const day = parseInt(mWord[1], 10);
    const mon = mWord[2].slice(0, 1).toUpperCase() + mWord[2].slice(1).toLowerCase();
    const year = parseInt(mWord[3], 10);
    return `${day} ${mon} ${year}`;
  }

  const reWordMDY = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*,?\s*(\d{4})\b/i;
  const mWord2 = line.match(reWordMDY);
  if (mWord2) {
    const mon = mWord2[1].slice(0, 1).toUpperCase() + mWord2[1].slice(1).toLowerCase();
    const day = parseInt(mWord2[2], 10);
    const year = parseInt(mWord2[3], 10);
    return `${day} ${mon} ${year}`;
  }

  const reOrdinal = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s*,?\s*(\d{4})\b/i;
  const mOrd = line.match(reOrdinal);
  if (mOrd) {
    const day = parseInt(mOrd[1], 10);
    const mon = mOrd[2].slice(0, 1).toUpperCase() + mOrd[2].slice(1).toLowerCase();
    const year = parseInt(mOrd[3], 10);
    return `${day} ${mon} ${year}`;
  }

  const reNum = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/g;
  let best = null;
  let m;
  while ((m = reNum.exec(line)) !== null) {
    const formatted = formatNumericDayMonthYear(m[1], m[2], m[3]);
    if (formatted) best = formatted;
  }
  if (best) return best;

  return null;
}

/**
 * Prefer a date token inside a noisy line (e.g. after colon or at end).
 * @param {string} line
 * @returns {string}
 */
function extractDateValueForDisplay(line) {
  const raw = String(line || "").trim();
  if (isNonApplicationDateContext(raw)) return "—";
  const direct = extractStrictDateFromText(raw);
  if (direct) return direct;
  const tail = raw.includes(":") ? raw.split(":").slice(1).join(":").trim() : "";
  if (tail && tail !== raw) {
    if (isNonApplicationDateContext(tail)) return "—";
    const fromTail = extractStrictDateFromText(tail);
    if (fromTail) return fromTail;
  }
  return "—";
}

module.exports = {
  extractStrictDateFromText,
  extractDateValueForDisplay,
  isNonApplicationDateContext,
  isAllocationTableDateRow,
  isReferenceFileDateLine,
  isMilestoneEventDateLine,
  hasDateToken
};
