#!/usr/bin/env node
"use strict";

/**
 * Production READ-ONLY verify for Phase 1 Generator publish + Lifecycle UI.
 * Requires SMOKE_COOKIE_FILE. Never clicks mutation / crawler / publish controls.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "backups", "ui-verify-lifecycle-generator-publish-prod");
const BASE = String(process.env.UI_BASE || "https://www.sarkarisuchnaindia.com").replace(/\/$/, "");

const ROUTES = [
  "/admin/recruitments",
  "/admin/recruitments#eventTimeline",
  "/admin/recruitment-review-queue",
  "/admin/recruitment-review-queue?status=needs_matching",
  "/generator",
  "/generator#drafts",
  "/admin/editorial-review",
  "/admin/page-manager"
];

const VPS = [
  { n: "m375", w: 375, h: 812 },
  { n: "m390", w: 390, h: 844 },
  { n: "m768", w: 768, h: 1024 },
  { n: "d1280", w: 1280, h: 900 },
  { n: "d1366", w: 1366, h: 900 },
  { n: "d1440", w: 1440, h: 900 }
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadCookieJar() {
  const cookieFile = String(process.env.SMOKE_COOKIE_FILE || "").trim();
  if (!cookieFile) throw new Error("SMOKE_COOKIE_FILE required");
  const raw = JSON.parse(fs.readFileSync(cookieFile, "utf8"));
  return (raw.cookies || []).map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain || ".sarkarisuchnaindia.com",
    path: c.path || "/"
  }));
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const puppeteer = require("puppeteer-core");
  const chrome = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium"
  ].find((p) => fs.existsSync(p));
  if (!chrome) throw new Error("Chrome/Chromium not found");

  const cookies = loadCookieJar();
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
  const page = await browser.newPage();
  await page.setCookie(...cookies);

  const results = [];
  let overflow = 0;
  let fail = 0;

  for (const route of ROUTES) {
    for (const vp of VPS) {
      await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1 });
      await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 90000 });
      await sleep(900);

      const m = await page.evaluate((routePath) => {
        const doc = document.documentElement;
        const body = document.body;
        const sw = Math.max(doc.scrollWidth, body ? body.scrollWidth : 0);
        const cw = Math.max(doc.clientWidth, body ? body.clientWidth : 0);
        const text = body ? body.innerText : "";
        const publishLink = document.getElementById("rrqManualPublishLink");
        const saveBtn = document.getElementById("savePageBtn");
        const out = {
          overflowX: sw > cw + 1,
          sw,
          cw,
          path: location.pathname + location.search + location.hash,
          publishHref: publishLink ? publishLink.getAttribute("href") : null,
          saveLabel: saveBtn ? (saveBtn.getAttribute("data-label-desktop") || saveBtn.textContent || "").trim() : null,
          hasPreview: !!document.getElementById("previewBtn"),
          hasSaveState: !!document.getElementById("generatorSaveState"),
          hasAttachSearch: !!document.getElementById("rrqAttachRecruitmentSearch"),
          hasNeedsChip: !!document.querySelector('[data-rrq-status="needs_matching"]'),
          hasEventTimeline: !!document.getElementById("eventTimeline"),
          textSample: text.slice(0, 4000)
        };
        out.ok = !out.overflowX;
        if (routePath.startsWith("/admin/recruitments")) {
          out.ok =
            out.ok &&
            /Recruitment Manager|One recruitment = one permanent/i.test(text) &&
            out.hasEventTimeline;
        }
        if (routePath.includes("recruitment-review-queue")) {
          const hrefOk =
            !publishLink ||
            out.publishHref === "/generator#drafts" ||
            (out.publishHref && out.publishHref.startsWith("/generator?draftId="));
          out.ok =
            out.ok &&
            /Review Center/i.test(text) &&
            out.hasNeedsChip &&
            hrefOk &&
            out.publishHref !== "/admin/page-manager";
        }
        if (routePath.startsWith("/generator")) {
          out.ok =
            out.ok &&
            out.hasPreview &&
            out.hasSaveState &&
            /Manual Publish/i.test(out.saveLabel || "");
        }
        if (routePath.startsWith("/admin/page-manager")) {
          out.ok = out.ok && /already published/i.test(text);
        }
        if (routePath.startsWith("/admin/editorial-review")) {
          out.ok = out.ok && /Optional content QA/i.test(text) && /Manual Publish \(Generator\)/i.test(text);
        }
        return out;
      }, route);

      if (m.overflowX) overflow += 1;
      if (!m.ok) fail += 1;
      results.push({ route, viewport: vp.n, ok: m.ok, overflowX: m.overflowX, publishHref: m.publishHref, saveLabel: m.saveLabel });

      if (vp.n === "d1280" || vp.n === "m390") {
        const slug = `${vp.n}__${route.replace(/[/?#=&.]/g, "_")}`;
        await page.screenshot({ path: path.join(OUT_DIR, `${slug}.png`), fullPage: false });
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    totals: {
      checks: results.length,
      ok: results.filter((r) => r.ok).length,
      fail,
      overflow
    },
    results
  };
  fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify(report.totals, null, 2));
  if (fail || overflow) {
    console.log(JSON.stringify(results.filter((r) => !r.ok), null, 2));
    process.exitCode = 1;
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
