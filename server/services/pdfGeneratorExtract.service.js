/**
 * Generator-only PDF text extraction (buffer in → text out).
 * NOT used by dashboard upload.
 *
 * Pipeline: pdf-parse (primary) + pdfjs-dist (secondary, layout-aware, merged) →
 * Phase AI-1 advanced normalize → OCR (eng+hin) when text is short/poor.
 * Quality improvement only — does not change publishing / monitoring / workflow.
 */
"use strict";

const { pathToFileURL } = require("url");
const logger = require("../utils/logger");
const {
  advancedNormalize,
  fixSpacedWordsLine
} = require("../lib/generatorIntelligence/textNormalization");

const pdfParse = require("pdf-parse");

/** pdfjs-dist 4.x ships ESM builds only — load once per extraction path. */
async function loadPdfJsModule() {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href;
  return pdfjsLib;
}

/** pdfjs-dist rejects Node Buffer even though Buffer extends Uint8Array. */
function toStandaloneUint8Array(buffer) {
  if (buffer instanceof Uint8Array && !Buffer.isBuffer(buffer)) {
    return buffer;
  }
  return Uint8Array.from(buffer);
}

/** Run OCR when merged text layer is shorter than this (characters) */
const OCR_TRIGGER_BELOW_CHARS = 200;

/** Minimum acceptable final text length */
const MIN_FINAL_TEXT = 50;

/** OCR: first N pages (raised from 15; still capped, no new OCR architecture) */
const MAX_OCR_PAGES = 25;

/** Max longest side for OCR rasterization (px) */
const OCR_MAX_SIDE_PX = 2000;

const ERR_READ_FAIL = "PDF ka text properly read nahi ho paya";

const HTTP_URL_RE = /^https?:\/\/[^\s<>"']+$/i;

function normalizePdfText(text) {
  if (!text || typeof text !== "string") return "";
  return advancedNormalize(text);
}

function fixSpacedLetterLines(text) {
  return text
    .split("\n")
    .map((line) => fixSpacedWordsLine(line))
    .join("\n");
}

function lineKey(line) {
  return String(line || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Header/footer-like lines that are safe to globally unique. */
function looksLikeRepeatingBoilerplate(line) {
  const t = String(line || "").trim();
  if (t.length < 12 || t.length > 90) return false;
  if (/\d/.test(t)) return false;
  if (/https?:\/\//i.test(t)) return false;
  if (t.includes("|")) return false;
  if (/^##\s/.test(t)) return false;
  return true;
}

/**
 * Dedup running headers / consecutive artifacts without dropping legitimate
 * repeated table cells, category codes, or dates that reappear later.
 */
function dedupeContentLines(text) {
  const lines = String(text || "").split("\n");
  const counts = new Map();
  for (const raw of lines) {
    const k = lineKey(raw);
    if (!k) continue;
    counts.set(k, (counts.get(k) || 0) + 1);
  }

  const seenBoilerplate = new Set();
  const out = [];
  let prevKey = null;

  for (const raw of lines) {
    const t = raw.trim();
    if (!t) {
      out.push("");
      prevKey = "";
      continue;
    }
    const k = lineKey(t);
    const isDataLine = /\d/.test(t) || t.includes("|") || HTTP_URL_RE.test(t);

    if (k === prevKey && !isDataLine) continue;
    prevKey = k;

    if (looksLikeRepeatingBoilerplate(t) && (counts.get(k) || 0) >= 3) {
      if (seenBoilerplate.has(k)) continue;
      seenBoilerplate.add(k);
    }

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
      const k = lineKey(t);
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

function isUsableHttpUrl(value) {
  if (!value || typeof value !== "string") return false;
  const u = value.trim();
  if (!HTTP_URL_RE.test(u)) return false;
  if (u.length > 500) return false;
  return true;
}

function annotationUri(annot) {
  if (!annot || typeof annot !== "object") return "";
  const raw =
    annot.url ||
    annot.unsafeUrl ||
    (annot.action && (annot.action.url || annot.action.uri)) ||
    "";
  return typeof raw === "string" ? raw.trim() : "";
}

function harvestLinkUrisFromAnnotations(annotations) {
  const out = [];
  const seen = new Set();
  const list = Array.isArray(annotations) ? annotations : [];
  for (const annot of list) {
    const subtype = String((annot && (annot.subtype || annot.annotationType)) || "").toLowerCase();
    const uri = annotationUri(annot);
    if (!isUsableHttpUrl(uri)) continue;
    const skipSubtype = new Set([
      "widget",
      "fileattachment",
      "popup",
      "highlight",
      "freetext",
      "stamp",
      "ink",
      "square",
      "circle",
      "line"
    ]);
    if (skipSubtype.has(subtype)) continue;
    const key = uri.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const label = String(annot.contents || annot.title || annot.alt || "")
      .trim()
      .replace(/\s+/g, " ");
    out.push({ uri, label: label && label.length <= 48 && !/^https?:\/\//i.test(label) ? label : "" });
  }
  return out;
}

function formatHarvestedLinkLines(links) {
  const lines = [];
  const seen = new Set();
  for (const link of links || []) {
    const uri = link && link.uri ? String(link.uri).trim() : "";
    if (!isUsableHttpUrl(uri)) continue;
    const key = uri.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (link.label) lines.push(`${link.label}=${uri}`);
    else lines.push(uri);
  }
  return lines;
}

function appendHarvestedLinks(text, links) {
  const extra = formatHarvestedLinkLines(links).filter((line) => {
    const uri = line.includes("=") ? line.slice(line.indexOf("=") + 1) : line;
    return !String(text || "").toLowerCase().includes(uri.toLowerCase());
  });
  if (!extra.length) return String(text || "");
  return (text ? String(text).trim() + "\n\n" : "") + extra.join("\n");
}

function median(values) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function enrichPdfJsItems(items) {
  return (items || [])
    .filter((item) => item && typeof item.str === "string" && item.str.length)
    .map((item) => {
      const tr = item.transform || [12, 0, 0, 12, 0, 0];
      const height = Math.abs(Number(item.height) || Number(tr[0]) || 12) || 12;
      return {
        str: item.str,
        x: Number(tr[4]) || 0,
        y: Number(tr[5]) || 0,
        height,
        width: Number(item.width) || Math.max(height, item.str.length * height * 0.45),
        fontName: String(item.fontName || "")
      };
    });
}

/**
 * Cluster X positions into reading columns (multi-column government PDFs).
 * Returns a single column when the split looks like a table (cells on the same rows).
 */
function detectColumnCenters(items) {
  if (!items.length) return [0];
  const xs = items.map((i) => i.x).sort((a, b) => a - b);
  const min = xs[0];
  const max = xs[xs.length - 1];
  const span = max - min;
  if (span < 180) return [min];

  const gaps = [];
  for (let i = 1; i < xs.length; i++) {
    const g = xs[i] - xs[i - 1];
    if (g > Math.max(40, span * 0.12)) gaps.push({ idx: i, gap: g, x: (xs[i] + xs[i - 1]) / 2 });
  }
  if (!gaps.length) return [min];

  gaps.sort((a, b) => b.gap - a.gap);
  const splitX = gaps[0].x;
  const left = items.filter((i) => i.x < splitX);
  const right = items.filter((i) => i.x >= splitX);
  if (left.length < 8 || right.length < 8) return [min];

  const leftCenter = left.reduce((s, i) => s + i.x, 0) / left.length;
  const rightCenter = right.reduce((s, i) => s + i.x, 0) / right.length;
  if (rightCenter - leftCenter < 100) return [min];

  const yTol = Math.max(4, median(items.map((i) => i.height).filter(Boolean)) * 0.4 || 5);
  const rows = groupItemsIntoRows(items, yTol);
  let mixed = 0;
  for (const row of rows) {
    const hasL = row.some((i) => i.x < splitX);
    const hasR = row.some((i) => i.x >= splitX);
    if (hasL && hasR) mixed++;
  }
  if (rows.length && mixed / rows.length > 0.32) return [min];

  return [leftCenter, rightCenter].sort((a, b) => a - b);
}

function assignColumn(item, centers) {
  if (centers.length <= 1) return 0;
  let best = 0;
  let bestDist = Math.abs(item.x - centers[0]);
  for (let i = 1; i < centers.length; i++) {
    const d = Math.abs(item.x - centers[i]);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function groupItemsIntoRows(items, yTol) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const it of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last[0].y - it.y) <= yTol) last.push(it);
    else rows.push([it]);
  }
  for (const row of rows) row.sort((a, b) => a.x - b.x);
  return rows;
}

function isHeadingLikeLine(row, medianH) {
  if (!row.length || !medianH) return false;
  const text = row
    .map((i) => i.str)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 3 || text.length > 80) return false;
  if (text.includes("|") || /https?:\/\//i.test(text)) return false;
  if (/^\d+([.)]\s*)?$/.test(text)) return false;
  const words = text.split(/\s+/);
  if (words.length > 12) return false;
  const maxH = Math.max(...row.map((i) => i.height || 0));
  const bold = row.some((i) => /bold|black|heavy/i.test(i.fontName || ""));
  const tall = maxH >= medianH * 1.45;
  const boldShort = bold && words.length <= 10;
  if (!tall && !boldShort) return false;
  if (/[.?!]$/.test(text) && words.length > 6) return false;
  return true;
}

function joinRowAsLine(row, medianH) {
  if (!row.length) return "";
  const gapThreshold = Math.max(16, (medianH || 12) * 1.65);
  let line = row[0].str;
  for (let i = 1; i < row.length; i++) {
    const prev = row[i - 1];
    const cur = row[i];
    const prevEnd = prev.x + (prev.width || 0);
    const gap = cur.x - prevEnd;
    const prevEndsSpace = /[\s-]$/.test(line);
    const curStartsSpace = /^\s/.test(cur.str);
    if (gap > gapThreshold) line += " | " + cur.str.replace(/^\s+/, "");
    else if (prevEndsSpace || curStartsSpace) line += cur.str;
    else line += " " + cur.str;
  }
  return line.replace(/\s+/g, " ").replace(/\s*\|\s*/g, " | ").trim();
}

function linesFromColumnItems(colItems, yTol, medianH) {
  colItems.sort((a, b) => {
    if (Math.abs(a.y - b.y) > yTol) return b.y - a.y;
    return a.x - b.x;
  });
  const rows = groupItemsIntoRows(colItems, yTol);
  const lines = [];
  for (const row of rows) {
    const text = joinRowAsLine(row, medianH);
    if (!text) continue;
    if (isHeadingLikeLine(row, medianH)) {
      if (lines.length && lines[lines.length - 1] !== "") lines.push("");
      lines.push(text);
      lines.push("");
    } else {
      lines.push(text);
    }
  }
  return lines.join("\n");
}

/**
 * Build reading-order text:
 * - table-like pages: top→bottom rows, cells joined with " | "
 * - true two-column pages: top→bottom within each column, left→right across columns
 * Heading-like (larger/bold) lines are kept on their own lines.
 */
function textFromPdfJsContent(textContent) {
  const enriched = enrichPdfJsItems((textContent && textContent.items) || []);
  if (!enriched.length) return "";

  const heights = enriched.map((i) => i.height).filter((h) => h > 0);
  const medianH = median(heights) || 12;
  const yTol = Math.max(3.5, medianH * 0.38);

  const ys = enriched.map((i) => i.y);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const ySpan = Math.max(1, yMax - yMin);

  const body = [];
  for (const it of enriched) {
    const nearEdge = (it.y - yMin) / ySpan < 0.03 || (yMax - it.y) / ySpan < 0.03;
    const t = it.str.trim();
    if (ySpan > 220 && nearEdge && /^(\d{1,3}|page\s*\d+)$/i.test(t)) continue;
    body.push(it);
  }
  if (!body.length) return "";

  const centers = detectColumnCenters(body);

  if (centers.length > 1) {
    const byCol = centers.map(() => []);
    for (const it of body) byCol[assignColumn(it, centers)].push(it);
    const colTexts = byCol.map((colItems) => linesFromColumnItems(colItems, yTol, medianH));
    return colTexts.filter(Boolean).join("\n\n");
  }

  return linesFromColumnItems(body, yTol, medianH);
}

async function extractWithPdfParse(buffer) {
  const data = await pdfParse(buffer);
  const text = typeof data.text === "string" ? data.text : "";
  const numpages = typeof data.numpages === "number" && data.numpages > 0 ? data.numpages : 1;
  return { text, numpages };
}

async function extractWithPdfJs(buffer) {
  let pdfjsLib;
  try {
    pdfjsLib = await loadPdfJsModule();
  } catch {
    return { fullText: "", itemCount: 0, links: [] };
  }

  const uint8 = toStandaloneUint8Array(buffer);
  let pdf;
  let itemCount = 0;
  const parts = [];
  const links = [];

  try {
    const loadingTask = pdfjsLib.getDocument({ data: uint8, verbosity: 0, useSystemFonts: true });
    try {
      pdf = await loadingTask.promise;
    } catch (e) {
      logger.warn("pdfGeneratorExtract: pdfjs document load failed", { message: e.message });
      return { fullText: "", itemCount: 0, links: [] };
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
        try {
          const annots = await page.getAnnotations({ intent: "display" });
          links.push(...harvestLinkUrisFromAnnotations(annots));
        } catch (e) {
          logger.warn("pdfGeneratorExtract: pdfjs annotations failed", { page: i, message: e.message });
        }
      } catch (e) {
        logger.warn("pdfGeneratorExtract: pdfjs page failed", { page: i, message: e.message });
      }
    }
  } finally {
    if (pdf) await pdf.destroy().catch(() => {});
  }

  return {
    fullText: parts.filter(Boolean).join("\n\n"),
    itemCount,
    links
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
 * pdfjs NodeCanvasFactory uses @napi-rs/canvas. Mixing that with node-canvas
 * contexts makes drawImage throw "Image or Canvas expected".
 * Keep OCR on the already-installed `canvas` package.
 */
function createNodeCanvasFactory(createCanvas) {
  return class ProjectNodeCanvasFactory {
    create(width, height) {
      if (width <= 0 || height <= 0) {
        throw new Error("Invalid canvas size");
      }
      const canvas = createCanvas(width, height);
      return {
        canvas,
        context: canvas.getContext("2d")
      };
    }
    reset(canvasAndContext, width, height) {
      if (!canvasAndContext.canvas) {
        throw new Error("Canvas is not specified");
      }
      canvasAndContext.canvas.width = width;
      canvasAndContext.canvas.height = height;
    }
    destroy(canvasAndContext) {
      if (!canvasAndContext.canvas) {
        throw new Error("Canvas is not specified");
      }
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
      canvasAndContext.canvas = null;
      canvasAndContext.context = null;
    }
  };
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

  const uint8 = toStandaloneUint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    verbosity: 0,
    useSystemFonts: true,
    isOffscreenCanvasSupported: false,
    CanvasFactory: createNodeCanvasFactory(createCanvas)
  });

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
  let harvestedLinks = [];
  try {
    const js = await extractWithPdfJs(buffer);
    jsRaw = js.fullText || "";
    pdfJsItemCount = js.itemCount;
    harvestedLinks = js.links || [];
  } catch (e) {
    logger.warn("pdfGeneratorExtract: pdfjs failed", { message: e.message });
  }

  const parseCleaned = deepClean(parseRaw);
  const jsCleaned = deepClean(jsRaw);
  let layerMerged = deepClean(mergeUniqueBlocks(parseCleaned, jsCleaned));
  layerMerged = appendHarvestedLinks(layerMerged, harvestedLinks);

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
    layerMerged = appendHarvestedLinks(layerMerged, harvestedLinks);
  } else if (needOcr && !ocrDepsAvailable()) {
    logger.warn("pdfGeneratorExtract: OCR skipped (deps missing), using text layers only", {
      pdfJsItemCount
    });
  }

  const finalText = deepClean(layerMerged);

  logger.info("pdfGeneratorExtract pipeline", {
    pdfParseLen,
    pdfJsLen,
    numpages,
    ocrUsed,
    ocrLen: ocrUsed ? ocrLen : 0,
    finalLen: finalText.length,
    harvestedLinkCount: harvestedLinks.length
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
  extractGeneratorPdfText,
  textFromPdfJsContent,
  dedupeContentLines,
  shouldRunOcr,
  harvestLinkUrisFromAnnotations,
  appendHarvestedLinks,
  ocrDepsAvailable,
  OCR_TRIGGER_BELOW_CHARS,
  MAX_OCR_PAGES,
  MIN_FINAL_TEXT
};
