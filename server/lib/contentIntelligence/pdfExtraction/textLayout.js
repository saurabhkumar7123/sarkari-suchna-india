"use strict";

const { normalizeWhitespace } = require("./normalization");

const LINE_Y_TOLERANCE = 3.5;

function itemGeometry(item) {
  const transform = item.transform || [1, 0, 0, 1, 0, 0];
  const fontHeight = Math.abs(transform[3] || transform[0] || 0) || Number(item.height) || 0;
  const width = Number(item.width) || 0;
  return {
    str: String(item.str || ""),
    x: Number(transform[4]) || 0,
    y: Number(transform[5]) || 0,
    width,
    height: fontHeight || Number(item.height) || 0,
    fontName: item.fontName || null,
    hasEOL: Boolean(item.hasEOL)
  };
}

function buildLinesFromTextContent(textContent, pageNumber, pageHeight) {
  const items = ((textContent && textContent.items) || [])
    .filter((item) => item && typeof item.str === "string" && item.str.length)
    .map(itemGeometry);

  items.sort((a, b) => {
    if (Math.abs(a.y - b.y) > LINE_Y_TOLERANCE) return b.y - a.y;
    return a.x - b.x;
  });

  const lines = [];
  let current = null;

  for (const item of items) {
    if (!current || Math.abs(item.y - current.y) > LINE_Y_TOLERANCE) {
      if (current) lines.push(finalizeLine(current, pageNumber, pageHeight));
      current = {
        y: item.y,
        xMin: item.x,
        xMax: item.x + item.width,
        height: item.height,
        parts: [item]
      };
    } else {
      current.parts.push(item);
      current.xMin = Math.min(current.xMin, item.x);
      current.xMax = Math.max(current.xMax, item.x + item.width);
      current.height = Math.max(current.height, item.height);
    }
  }
  if (current) lines.push(finalizeLine(current, pageNumber, pageHeight));
  return lines;
}

function finalizeLine(group, pageNumber, pageHeight) {
  const parts = group.parts.slice().sort((a, b) => a.x - b.x);
  let text = "";
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (i === 0) {
      text = part.str;
      continue;
    }
    const prev = parts[i - 1];
    const gap = part.x - (prev.x + prev.width);
    const needsSpace = gap > Math.max(1.2, prev.height * 0.18) && !/\s$/u.test(text) && !/^\s/u.test(part.str);
    text += (needsSpace ? " " : "") + part.str;
  }

  return {
    pageNumber,
    text: normalizeWhitespace(text),
    rawText: text.replace(/[ \t]+$/u, "").replace(/^[ \t]+/u, ""),
    y: group.y,
    xMin: group.xMin,
    xMax: group.xMax,
    height: group.height,
    fontHeight: group.height,
    topRatio: pageHeight > 0 ? 1 - group.y / pageHeight : 0,
    bottomRatio: pageHeight > 0 ? group.y / pageHeight : 0,
    parts
  };
}

function detectRepeatedEdgeLines(pageLines, edge) {
  const counts = new Map();
  const keyOf = (text) =>
    edge === "footer"
      ? String(text).replace(/\bpage\s+\d+\b/giu, "page #").replace(/\b\d+\s*\/\s*\d+\b/gu, "#/#")
      : text;

  for (const lines of pageLines) {
    const candidates =
      edge === "header"
        ? lines.filter((line) => line.topRatio <= 0.12 && line.text)
        : lines.filter((line) => line.bottomRatio <= 0.12 && line.text);
    const uniqueKeys = new Map();
    for (const line of candidates) {
      const key = keyOf(line.text);
      if (!uniqueKeys.has(key)) uniqueKeys.set(key, line.text);
    }
    for (const [key] of uniqueKeys.entries()) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  const threshold = Math.max(2, Math.ceil(pageLines.length * 0.6));
  const repeatedKeys = new Set();
  for (const [key, count] of counts.entries()) {
    if (count >= threshold) repeatedKeys.add(key);
  }

  const repeatedTexts = new Set();
  for (const lines of pageLines) {
    for (const line of lines) {
      if (repeatedKeys.has(keyOf(line.text))) repeatedTexts.add(line.text);
    }
  }
  return repeatedTexts;
}

module.exports = {
  LINE_Y_TOLERANCE,
  itemGeometry,
  buildLinesFromTextContent,
  detectRepeatedEdgeLines
};
