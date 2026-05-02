/**
 * Generator-only PDF text extraction (buffer in → text out).
 * NOT used by dashboard upload.
 *
 * Pipeline: pdf-parse (primary) + pdfjs-dist (secondary, merged) → smart clean →
 * OCR (eng+hin, first pages) only when text is short or quality looks poor.
 */
"use strict";

const { pathToFileURL } = require("url");
const logger = require("../utils/logger");

const pdfParse = require("pdf-parse");

/** pdfjs-dist 4.x ships ESM builds only — load once per extraction path. */
async function loadPdfJsModule() {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href;
  return pdfjsLib;
}

/** Run OCR when merged text layer is shorter than this (characters) */
const OCR_TRIGGER_BELOW_CHARS = 200;

/** Minimum acceptable final text length */
const MIN_FINAL_TEXT = 50;

/** OCR: first N pages only */
const MAX_OCR_PAGES = 15;

/** Max longest side for OCR rasterization (px) */
const OCR_MAX_SIDE_PX = 2000;

const ERR_READ_FAIL = "PDF ka text properly read nahi ho paya";

function normalizePdfText(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[\t\f\v\u00a0]+/g, " ")
    .replace(/([A-Za-z\u0900-\u0D7F])-\s*\n+\s*([A-Za-z\u0900-\u0D7F])/g, "$1$2")
    .replace(/([a-zA-Z0-9\u0900-\u0D7F])\n([a-zA-Z0-9\u0900-\u0D7F])/g, "$1 $2")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/**
 * Browser / bad PDFs often emit "Q u a l i f i c a t i o n" — collapse when the line is mostly single Latin letters.
 */
function fixSpacedWordsLine(line) {
  const s = line.trim();
  if (s.length < 6) return line;
  const parts = s.split(/\s+/);
  if (parts.length < 4) return line;
  const latinSingles = parts.filter((p) => p.length === 1 && /[A-Za-z]/.test(p)).length;
  if (latinSingles / parts.length >= 0.45) return parts.join("");
  return line;
}

function fixSpacedLetterLines(text) {
  return text
    .split("\n")
    .map((line) => fixSpacedWordsLine(line))
    .join("\n");
}

function dedupeContentLines(text) {
  const seen = new Set();
  const out = [];
  for (const raw of text.split("\n")) {
    const t = raw.trim();
    if (!t) {
      out.push("");
      continue;
    }
    const k = t.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "")
    .trim();
}

function deepClean(text) {
  let t = normalizePdfText(text);
  t = fixSpacedLetterLines(t);
  t = dedupeContentLines(t);
  t = normalizePdfText(t);
  return t;
}

function mergeUniqueBlocks(...parts) {
  const seen = new Set();
  const out = [];
  for (const part of parts) {
    if (!part) continue;
    for (const raw of String(part).split("\n")) {
      const t = raw.trim();
      if (!t) continue;
      const k = t.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
  }
  return out.join("\n");
}

/** Heuristic: many single-letter Latin tokens spaced apart (broken glyph extraction). */
function hasPoorLetterSpacing(text) {
  if (!text || text.length < 80) return false;
  const sample = text.slice(0, 4500);
  if (/(?:[A-Za-z]\s){12,}[A-Za-z]/.test(sample)) return true;
  const lines = sample.split("\n").slice(0, 45);
  let bad = 0;
  for (const line of lines) {
    const p = line.trim().split(/\s+/);
    if (p.length < 10) continue;
    const singles = p.filter((x) => x.length === 1 && /[A-Za-z]/.test(x)).length;
    if (singles / p.length > 0.42) bad++;
  }
  return bad >= 2;
}

function shouldRunOcr(layerText) {
  const len = (layerText && layerText.length) || 0;
  if (len < OCR_TRIGGER_BELOW_CHARS) return true;
  return hasPoorLetterSpacing(layerText);
}

async function extractWithPdfParse(buffer) {
  const data = await pdfParse(buffer);
  const text = typeof data.text === "string" ? data.text : "";
  const numpages = typeof data.numpages === "number" && data.numpages > 0 ? data.numpages : 1;
  return { text, numpages };
}

function textFromPdfJsContent(textContent) {
  const items = (textContent && textContent.items) || [];
  const filtered = items.filter((item) => item && typeof item.str === "string" && item.str.length);
  if (!filtered.length) return "";

  const tol = 5;
  const enriched = filtered.map((item) => ({
    str: item.str,
    x: item.transform[4],
    y: item.transform[5]
  }));

  enriched.sort((a, b) => {
    if (Math.abs(a.y - b.y) > tol) return b.y - a.y;
    return a.x - b.x;
  });

  const lines = [];
  let line = "";
  let lineY = null;

  for (const it of enriched) {
    if (lineY === null || Math.abs(it.y - lineY) > tol) {
      if (line.trim()) lines.push(line.trim());
      line = it.str;
      lineY = it.y;
    } else {
      const gap = line && !/[\s-]$/.test(line) && it.str && !/^\s/.test(it.str);
      line += (gap ? " " : "") + it.str;
    }
  }
  if (line.trim()) lines.push(line.trim());

  return lines.join("\n");
}

async function extractWithPdfJs(buffer) {
  let pdfjsLib;
  try {
    pdfjsLib = await loadPdfJsModule();
  } catch {
    return { fullText: "", itemCount: 0 };
  }

  const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let pdf;
  let itemCount = 0;
  const parts = [];

  try {
    const loadingTask = pdfjsLib.getDocument({ data: uint8, verbosity: 0, useSystemFonts: true });
    try {
      pdf = await loadingTask.promise;
    } catch (e) {
      logger.warn("pdfGeneratorExtract: pdfjs document load failed", { message: e.message });
      return { fullText: "", itemCount: 0 };
    }

    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const items = (textContent && textContent.items) || [];
        for (const it of items) {
          if (it && typeof it.str === "string") itemCount += it.str.length;
        }
        parts.push(textFromPdfJsContent(textContent));
      } catch (e) {
        logger.warn("pdfGeneratorExtract: pdfjs page failed", { page: i, message: e.message });
      }
    }
  } finally {
    if (pdf) await pdf.destroy().catch(() => {});
  }

  return {
    fullText: parts.filter(Boolean).join("\n\n"),
    itemCount
  };
}

function ocrDepsAvailable() {
  try {
    require.resolve("canvas");
    require.resolve("tesseract.js");
    require.resolve("pdfjs-dist/legacy/build/pdf.mjs");
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {Buffer} buffer
 * @param {number} maxPages
 */
async function extractWithOcr(buffer, maxPages = MAX_OCR_PAGES) {
  let createCanvas;
  let createWorker;
  let pdfjsLib;
  try {
    ({ createCanvas } = require("canvas"));
    ({ createWorker } = require("tesseract.js"));
    pdfjsLib = await loadPdfJsModule();
  } catch (e) {
    logger.warn("pdfGeneratorExtract: OCR deps missing", { message: e.message });
    return "";
  }

  const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({ data: uint8, verbosity: 0, useSystemFonts: true });

  let worker;
  let pdf;
  const chunks = [];

  try {
    try {
      worker = await createWorker("eng+hin");
    } catch {
      try {
        worker = await createWorker("eng");
      } catch (e) {
        logger.warn("pdfGeneratorExtract: createWorker failed", { message: e.message });
        return "";
      }
    }
    try {
      pdf = await loadingTask.promise;
    } catch (e) {
      logger.warn("pdfGeneratorExtract: OCR pdf load failed", { message: e.message });
      return "";
    }
    const pageCount = Math.min(pdf.numPages, maxPages);

    for (let i = 1; i <= pageCount; i++) {
      try {
        const page = await pdf.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const maxDim = Math.max(base.width, base.height, 1);
        const fit = Math.min(2.25, OCR_MAX_SIDE_PX / maxDim);
        const viewport = page.getViewport({ scale: fit });
        const w = Math.max(1, Math.ceil(viewport.width));
        const h = Math.max(1, Math.ceil(viewport.height));
        const canvas = createCanvas(w, h);
        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport }).promise;
        const png = canvas.toBuffer("image/png");
        const {
          data: { text }
        } = await worker.recognize(png);
        chunks.push(text || "");
      } catch (e) {
        logger.warn("pdfGeneratorExtract: OCR page failed", { page: i, message: e.message });
      }
    }
  } finally {
    if (worker) await worker.terminate().catch(() => {});
    if (pdf) await pdf.destroy().catch(() => {});
  }

  return chunks.filter(Boolean).join("\n\n");
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<{ text: string, extractionNote?: string }>}
 */
async function extractGeneratorPdfText(buffer) {
  if (!buffer || !buffer.length) {
    const err = new Error(
      "Readable text nahi mila — file khali hai ya PDF read nahi ho paayi (corrupt ho sakti hai)."
    );
    err.code = "INVALID_PDF";
    throw err;
  }

  let parseRaw = "";
  let numpages = 1;
  try {
    const parsed = await extractWithPdfParse(buffer);
    parseRaw = typeof parsed.text === "string" ? parsed.text : "";
    numpages = parsed.numpages;
  } catch (e) {
    logger.warn("pdfGeneratorExtract: pdf-parse failed, continuing to pdfjs", { message: e.message });
    parseRaw = "";
    numpages = 1;
  }

  let jsRaw = "";
  let pdfJsItemCount = 0;
  try {
    const js = await extractWithPdfJs(buffer);
    jsRaw = js.fullText || "";
    pdfJsItemCount = js.itemCount;
  } catch (e) {
    logger.warn("pdfGeneratorExtract: pdfjs failed", { message: e.message });
  }

  const parseCleaned = deepClean(parseRaw);
  const jsCleaned = deepClean(jsRaw);
  let layerMerged = deepClean(mergeUniqueBlocks(parseCleaned, jsCleaned));

  const pdfParseLen = parseCleaned.length;
  const pdfJsLen = jsCleaned.length;

  let ocrUsed = false;
  let ocrLen = 0;
  let ocrNote = "";

  const needOcr = shouldRunOcr(layerMerged);

  if (needOcr && ocrDepsAvailable()) {
    ocrNote = "OCR eng+hin (pehli " + MAX_OCR_PAGES + " pages); text layer short ya quality low.";
    let ocrRaw = "";
    try {
      ocrRaw = await extractWithOcr(buffer, MAX_OCR_PAGES);
    } catch (e) {
      logger.error("pdfGeneratorExtract: OCR pipeline error", { message: e.message, stack: e.stack });
      const err = new Error(
        "Scanned ya image PDF ho sakti hai — OCR abhi pura text nahi nikal paya. File clear / chhoti try karein."
      );
      err.code = "OCR_FAILED";
      err.cause = e;
      throw err;
    }
    ocrUsed = true;
    const ocrCleaned = deepClean(ocrRaw);
    ocrLen = ocrCleaned.length;
    layerMerged = deepClean(mergeUniqueBlocks(layerMerged, ocrCleaned));
  } else if (needOcr && !ocrDepsAvailable()) {
    logger.warn("pdfGeneratorExtract: OCR skipped (deps missing), using text layers only", {
      pdfJsItemCount
    });
  }

  const finalText = deepClean(layerMerged);

  logger.info("pdfGeneratorExtract pipeline", {
    pdfParseLen,
    pdfJsLen,
    ocrUsed,
    ocrLen: ocrUsed ? ocrLen : 0,
    finalLen: finalText.length
  });

  if (finalText.length >= MIN_FINAL_TEXT) {
    const out = { text: finalText };
    if (ocrUsed && ocrNote) out.extractionNote = ocrNote;
    return out;
  }

  const err = new Error(ERR_READ_FAIL);
  err.code = "TEXT_TOO_SHORT";
  throw err;
}

module.exports = {
  extractGeneratorPdfText
};
