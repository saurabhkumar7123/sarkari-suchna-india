"use strict";

/**
 * Preparation Pipeline — extraction quality gate for live PDF text.
 *
 * Marks EXTRACTION_LOW_CONFIDENCE when text is poor. Does not silently
 * promote weak extraction as high-confidence data. Never publishes.
 */

const ADVISORY_STATUS = Object.freeze({
  PASS: "PASS",
  WARNING: "WARNING",
  BLOCKED: "BLOCKED"
});

const EXTRACTION_CODES = Object.freeze({
  EXTRACTION_LOW_CONFIDENCE: "EXTRACTION_LOW_CONFIDENCE",
  EXTRACTION_READY: "EXTRACTION_READY",
  EXTRACTION_READY_WITH_WARNINGS: "EXTRACTION_READY_WITH_WARNINGS",
  EXTRACTION_FAILED: "EXTRACTION_FAILED",
  OBVIOUS_SCANNED_IMAGE: "OBVIOUS_SCANNED_IMAGE",
  HIGH_GARBAGE_RATIO: "HIGH_GARBAGE_RATIO",
  HIGH_REPEATED_TEXT: "HIGH_REPEATED_TEXT",
  TEXT_TOO_SHORT: "TEXT_TOO_SHORT",
  MISSING_EXPECTED_SIGNALS: "MISSING_EXPECTED_SIGNALS"
});

const MIN_READY_CHARS = 200;
const MIN_WARNING_CHARS = 50;

function garbageRatio(text) {
  const raw = String(text || "");
  if (!raw.length) return 1;
  let bad = 0;
  for (let i = 0; i < raw.length; i += 1) {
    const c = raw.charCodeAt(i);
    const ok =
      (c >= 32 && c <= 126) ||
      c === 9 ||
      c === 10 ||
      c === 13 ||
      (c >= 0x0900 && c <= 0x097f) ||
      c === 0xa0;
    if (!ok) bad += 1;
  }
  return bad / raw.length;
}

function repeatedLineRatio(text) {
  const lines = String(text || "")
    .split(/\n/)
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l.length >= 12);
  if (lines.length < 8) return 0;
  const counts = new Map();
  for (const line of lines) {
    counts.set(line, (counts.get(line) || 0) + 1);
  }
  let repeated = 0;
  for (const n of counts.values()) {
    if (n >= 3) repeated += n;
  }
  return repeated / lines.length;
}

function hasPoorLetterSpacing(text) {
  if (!text || text.length < 80) return false;
  const sample = text.slice(0, 4500);
  if (/(?:[A-Za-z]\s){12,}[A-Za-z]/.test(sample)) return true;
  return false;
}

function countSignalHits(text) {
  const t = String(text || "");
  const signals = {
    dates: /\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})\b/.test(t),
    urls: /https?:\/\/[^\s<>"']+/i.test(t),
    contact: /\b(\+?\d{2,4}[-\s]?\d{6,12}|email|e-?mail|helpline|contact)\b/i.test(t),
    hindi: /[\u0900-\u097F]/.test(t),
    english: /[A-Za-z]{4,}/.test(t),
    vacancy: /\b(vacanc|post|recruitment|notification|admit\s*card|result|answer\s*key)\b/i.test(t)
  };
  const hitCount = Object.values(signals).filter(Boolean).length;
  return { signals, hitCount };
}

/**
 * @param {{
 *   text?: string,
 *   pageCount?: number|null,
 *   ocrUsed?: boolean,
 *   extractionNote?: string|null,
 *   errorCode?: string|null,
 *   pdfParseLen?: number,
 *   pdfJsLen?: number
 * }} input
 */
function assessExtractionConfidence(input = {}) {
  const text = String(input.text || "");
  const len = text.trim().length;
  const findings = [];
  const codes = [];

  if (input.errorCode) {
    codes.push(EXTRACTION_CODES.EXTRACTION_FAILED);
    findings.push({
      code: input.errorCode,
      severity: "error",
      message: `Extraction failed: ${input.errorCode}`
    });
    return Object.freeze({
      status: ADVISORY_STATUS.BLOCKED,
      code: EXTRACTION_CODES.EXTRACTION_FAILED,
      codes,
      confidence: "none",
      lowConfidence: true,
      findings,
      metrics: {
        textLength: len,
        pageCount: input.pageCount != null ? Number(input.pageCount) : null,
        ocrUsed: Boolean(input.ocrUsed),
        garbageRatio: 1,
        repeatedLineRatio: 0
      },
      preserveForHumanReview: true
    });
  }

  const garb = garbageRatio(text);
  const repeated = repeatedLineRatio(text);
  const { signals, hitCount } = countSignalHits(text);
  const poorSpacing = hasPoorLetterSpacing(text);
  const looksScanned =
    Boolean(input.ocrUsed) ||
    (len < MIN_READY_CHARS && (Number(input.pdfParseLen) || 0) < 40 && (Number(input.pdfJsLen) || 0) < 40);

  if (len < MIN_WARNING_CHARS) {
    codes.push(EXTRACTION_CODES.TEXT_TOO_SHORT);
    findings.push({
      code: EXTRACTION_CODES.TEXT_TOO_SHORT,
      severity: "error",
      message: "Extracted text is empty or too short."
    });
  } else if (len < MIN_READY_CHARS) {
    codes.push(EXTRACTION_CODES.EXTRACTION_LOW_CONFIDENCE);
    findings.push({
      code: EXTRACTION_CODES.EXTRACTION_LOW_CONFIDENCE,
      severity: "warning",
      message: "Extracted text length is below the ready threshold."
    });
  }

  if (garb > 0.12) {
    codes.push(EXTRACTION_CODES.HIGH_GARBAGE_RATIO);
    findings.push({
      code: EXTRACTION_CODES.HIGH_GARBAGE_RATIO,
      severity: "error",
      message: `High garbage/encoding ratio (${(garb * 100).toFixed(1)}%).`
    });
  } else if (garb > 0.05) {
    codes.push(EXTRACTION_CODES.HIGH_GARBAGE_RATIO);
    findings.push({
      code: EXTRACTION_CODES.HIGH_GARBAGE_RATIO,
      severity: "warning",
      message: `Elevated garbage/encoding ratio (${(garb * 100).toFixed(1)}%).`
    });
  }

  if (repeated > 0.35) {
    codes.push(EXTRACTION_CODES.HIGH_REPEATED_TEXT);
    findings.push({
      code: EXTRACTION_CODES.HIGH_REPEATED_TEXT,
      severity: "warning",
      message: "High proportion of repeated lines (possible header/footer or broken extract)."
    });
  }

  if (poorSpacing || looksScanned) {
    codes.push(EXTRACTION_CODES.OBVIOUS_SCANNED_IMAGE);
    findings.push({
      code: EXTRACTION_CODES.OBVIOUS_SCANNED_IMAGE,
      severity: poorSpacing ? "warning" : "info",
      message: poorSpacing
        ? "Poor letter spacing suggests broken glyph extraction or scanned PDF."
        : "Document appears scanned/image-heavy; OCR may be required."
    });
  }

  if (len >= MIN_WARNING_CHARS && hitCount < 2) {
    codes.push(EXTRACTION_CODES.MISSING_EXPECTED_SIGNALS);
    findings.push({
      code: EXTRACTION_CODES.MISSING_EXPECTED_SIGNALS,
      severity: "warning",
      message: "Few expected government-document signals (dates/URLs/vacancy terms)."
    });
  }

  const hasError = findings.some((f) => f.severity === "error");
  const hasWarning = findings.some((f) => f.severity === "warning");
  let status = ADVISORY_STATUS.PASS;
  let code = EXTRACTION_CODES.EXTRACTION_READY;
  let confidence = "high";

  if (hasError || len < MIN_WARNING_CHARS) {
    status = ADVISORY_STATUS.BLOCKED;
    code = EXTRACTION_CODES.EXTRACTION_LOW_CONFIDENCE;
    confidence = "none";
    if (!codes.includes(EXTRACTION_CODES.EXTRACTION_LOW_CONFIDENCE)) {
      codes.push(EXTRACTION_CODES.EXTRACTION_LOW_CONFIDENCE);
    }
  } else if (hasWarning || Boolean(input.ocrUsed)) {
    status = ADVISORY_STATUS.WARNING;
    code = EXTRACTION_CODES.EXTRACTION_LOW_CONFIDENCE;
    confidence = "low";
    if (!codes.includes(EXTRACTION_CODES.EXTRACTION_LOW_CONFIDENCE)) {
      codes.push(EXTRACTION_CODES.EXTRACTION_LOW_CONFIDENCE);
    }
    if (!hasWarning && input.ocrUsed) {
      code = EXTRACTION_CODES.EXTRACTION_READY_WITH_WARNINGS;
      confidence = "medium";
    }
  }

  return Object.freeze({
    status,
    code,
    codes: Object.freeze([...new Set(codes)]),
    confidence,
    lowConfidence:
      code === EXTRACTION_CODES.EXTRACTION_LOW_CONFIDENCE ||
      status === ADVISORY_STATUS.BLOCKED ||
      confidence === "low" ||
      confidence === "none",
    findings: Object.freeze(findings),
    metrics: Object.freeze({
      textLength: len,
      pageCount: input.pageCount != null ? Number(input.pageCount) : null,
      ocrUsed: Boolean(input.ocrUsed),
      garbageRatio: Number(garb.toFixed(4)),
      repeatedLineRatio: Number(repeated.toFixed(4)),
      signals
    }),
    extractionNote: input.extractionNote || null,
    preserveForHumanReview: true
  });
}

module.exports = {
  ADVISORY_STATUS,
  EXTRACTION_CODES,
  MIN_READY_CHARS,
  MIN_WARNING_CHARS,
  assessExtractionConfidence,
  garbageRatio,
  repeatedLineRatio
};
