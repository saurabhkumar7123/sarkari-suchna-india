"use strict";

const { createCanvas } = require("canvas");
const pageRepository = require("../../repositories/page.repository");
const { extractTotalPosts } = require("../../utils/extractTotalPosts");
const { getOgTheme } = require("../../utils/jobPosterTheme");

const W = 1200;
const H = 630;
const PAD = 56;

function normalizeSlug(raw) {
  return String(raw || "")
    .trim()
    .replace(/\.html$/i, "");
}

function wrapTitle(ctx, text, maxWidth, maxLines, startFontPx, minFontPx) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  for (let fontPx = startFontPx; fontPx >= minFontPx; fontPx -= 2) {
    ctx.font = `900 ${fontPx}px "Segoe UI", Arial, sans-serif`;
    const lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        if (lines.length >= maxLines) {
          line = "";
          break;
        }
        line = w;
      } else {
        line = test;
      }
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (lines.length <= maxLines && lines.length > 0) return { lines, fontPx };
  }
  ctx.font = `900 ${minFontPx}px "Segoe UI", Arial, sans-serif`;
  return { lines: [String(text).slice(0, 72)], fontPx: minFontPx };
}

async function renderOgJobImage(req, res) {
  const slug = normalizeSlug(req.params.slug);
  if (!slug) {
    res.status(400).end();
    return;
  }

  let page;
  try {
    page = await pageRepository.findPublicRowBySlug(slug);
  } catch {
    res.status(500).end();
    return;
  }

  if (!page) {
    res.status(404).end();
    return;
  }

  const title = String(page.title || "Recruitment");
  const tag = String(page.category || "");
  const totalPosts =
    String(page.total_posts || "")
      .trim()
      .replace(/,/g, "") ||
    extractTotalPosts(page.raw_text || "") ||
    "";
  const theme = getOgTheme(tag, title);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, theme.bgTop);
  g.addColorStop(1, theme.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = theme.accent;
  ctx.fillRect(0, H - 14, W, 14);

  const titleMaxW = totalPosts ? W - PAD * 2 - 220 : W - PAD * 2;
  const { lines, fontPx } = wrapTitle(ctx, title, titleMaxW, 3, 52, 28);
  let y = PAD + fontPx;
  ctx.textAlign = "left";
  ctx.fillStyle = theme.titleColor;
  for (const ln of lines) {
    ctx.font = `900 ${fontPx}px "Segoe UI", Arial, sans-serif`;
    ctx.fillText(ln, PAD, y);
    y += fontPx * 1.12;
  }

  if (tag) {
    ctx.font = `600 22px "Segoe UI", Arial, sans-serif`;
    ctx.fillStyle = theme.tagColor;
    ctx.fillText(tag.slice(0, 80), PAD, H - 48);
  }

  if (totalPosts) {
    const boxW = 200;
    const boxH = 140;
    const bx = W - PAD - boxW;
    const by = PAD + 10;
    ctx.fillStyle = theme.postsBox;
    ctx.strokeStyle = theme.postsGlow;
    ctx.lineWidth = 3;
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeRect(bx, by, boxW, boxH);

    ctx.textAlign = "center";
    ctx.fillStyle = theme.postsLabel;
    ctx.font = `900 64px "Segoe UI", Arial, sans-serif`;
    ctx.fillText(totalPosts, bx + boxW / 2, by + 78);

    ctx.font = `800 18px "Segoe UI", Arial, sans-serif`;
    ctx.fillStyle = theme.postsLabel;
    ctx.fillText("POSTS", bx + boxW / 2, by + boxH - 22);
  }

  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  res.send(canvas.toBuffer("image/png"));
}

module.exports = { renderOgJobImage };
