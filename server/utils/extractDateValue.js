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
 * DOB / certificate validity / random refs — not application schedule dates.
 * @param {string} line
 */
function isNonApplicationDateContext(line) {
  const l = line.toLowerCase();
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
  extractDateValueForDisplay
};
