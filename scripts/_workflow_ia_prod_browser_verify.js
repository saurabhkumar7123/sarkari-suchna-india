"use strict";

/**
 * Production READ-ONLY Workflow IA browser verification.
 * Uses SMOKE_COOKIE_FILE. Never clicks mutation / crawler / publish controls.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "backups", "ui-verify-workflow-ia-prod");
const BASE = String(process.env.UI_BASE || "https://www.sarkarisuchnaindia.com").replace(/\/$/, "");

const ROUTES = [
  "/admin/dashboard",
  "/admin/recruitments",
  "/admin/recruitments#eventTimeline",
  "/admin/recruitment-review-queue",
  "/admin/recruitment-review-queue?status=needs_matching",
  "/generator#drafts",
  "/admin/editorial-review",
  "/admin/page-manager",
  "/admin/monitoring",
  "/admin/automation-control-center"
];

const VPS = [
  { n: "d1280", w: 1280, h: 900 },
  { n: "d1366", w: 1366, h: 900 },
  { n: "d1440", w: 1440, h: 900 },
  { n: "m375", w: 375, h: 812 },
  { n: "m390", w: 390, h: 844 },
  { n: "m768", w: 768, h: 1024 }
];

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadCookieJar() {
  const cookieFile = String(process.env.SMOKE_COOKIE_FILE || "").trim();
  if (!cookieFile) throw new Error("SMOKE_COOKIE_FILE required");
  const raw = JSON.parse(fs.readFileSync(cookieFile, "utf8"));
  const jar = (raw.cookies || []).map((c) => `${c.name}=${c.value}`);
  if (!jar.length) throw new Error("cookie file empty");
  return jar;
}

function cookieDomain(base) {
  return new URL(base).hostname;
}

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ].filter(Boolean);
  for (const p of candidates) if (fs.existsSync(p)) return p;
  throw new Error("Chrome/Edge not found");
}

(async () => {
  ensureDir(OUT_DIR);
  const jar = loadCookieJar();
  const puppeteer = require("puppeteer-core");
  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: "new",
    args: ["--no-sandbox", "--window-size=1280,900"]
  });
  const page = await browser.newPage();
  const domain = cookieDomain(BASE);
  await page.setCookie(
    ...jar.map((pair) => {
      const eq = pair.indexOf("=");
      return {
        name: pair.slice(0, eq),
        value: pair.slice(eq + 1),
        domain,
        path: "/",
        secure: true,
        httpOnly: true
      };
    })
  );

  const results = [];
  let overflow = 0;
  let fail = 0;

  for (const route of ROUTES) {
    for (const vp of VPS) {
      await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1 });
      const res = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 60000 });
      await sleep(900);
      const m = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        const sw = Math.max(doc.scrollWidth, body ? body.scrollWidth : 0);
        const cw = Math.max(doc.clientWidth, body ? body.clientWidth : 0);
        const wf = document.querySelector(".adm-wf:not([hidden])");
        const scenarios = document.getElementById("admWfScenarios");
        const autoBadge = document.querySelector("[data-adm-wf-auto-badge]");
        const enableBtn = !!document.querySelector(
          '[id*="enableAutoPublish"], [id*="enableLiveCrawler"], [id*="turnOnAutomation"]'
        );
        const navNeeds = Array.from(document.querySelectorAll("#sidebar a")).some((a) =>
          /Needs Matching/i.test(a.textContent || "")
        );
        return {
          overflowX: sw > cw + 1,
          sw,
          cw,
          path: location.pathname,
          search: location.search,
          hash: location.hash,
          loginRedirect: /\/login/i.test(location.pathname),
          hasWf: !!wf,
          wfTitle: wf ? (wf.querySelector(".adm-wf__title") || {}).textContent || "" : "",
          hasAutoBadge: !!autoBadge,
          autoBadgeText: autoBadge ? autoBadge.textContent.trim() : "",
          hasScenarios: !!scenarios,
          enableBtn,
          navNeeds,
          hasWorkflowScript: !!document.querySelector('script[src*="admin-workflow-ia"]')
        };
      });

      const expectsWf = !route.startsWith("/admin/dashboard");
      const expectsScenarios = route.startsWith("/admin/dashboard");
      const status = res ? res.status() : 0;
      const ok =
        status >= 200 &&
        status < 400 &&
        !m.loginRedirect &&
        !m.overflowX &&
        !m.enableBtn &&
        (expectsWf ? m.hasWf : true) &&
        (expectsScenarios ? m.hasScenarios : true) &&
        m.navNeeds;

      if (m.overflowX) overflow += 1;
      if (!ok) fail += 1;

      results.push({
        route,
        viewport: vp.n,
        status,
        overflowX: m.overflowX,
        sw: m.sw,
        cw: m.cw,
        hasWf: m.hasWf,
        wfTitle: m.wfTitle,
        hasScenarios: m.hasScenarios,
        autoBadgeText: m.autoBadgeText,
        enableBtn: m.enableBtn,
        navNeeds: m.navNeeds,
        hasWorkflowScript: m.hasWorkflowScript,
        loginRedirect: m.loginRedirect,
        ok
      });
    }
  }

  await browser.close();
  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    totals: {
      checks: results.length,
      ok: results.filter((r) => r.ok).length,
      fail,
      overflow
    },
    sample: results.filter((r) => r.viewport === "d1280"),
    bad: results.filter((r) => !r.ok)
  };
  fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ totals: report.totals, bad: report.bad }, null, 2));
  if (fail || overflow) process.exitCode = 1;
  else console.log("WORKFLOW_IA_PROD_VERIFY_OK");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
