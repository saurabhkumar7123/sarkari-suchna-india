"use strict";

/**
 * Local browser verify for Manual + Automatic Workflow UX/IA.
 * Checks overflow, workflow context mounts, and key links.
 * Does not enable automation or publish.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const BASE = process.env.UI_BASE || "http://127.0.0.1:3022";
const OUT = path.join(__dirname, "..", "backups", "ui-verify-workflow-ia");

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
  "/admin/monitoring/updates",
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

function httpJson(method, urlPath, { headers = {}, body = null, cookieJar = [] } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const payload = body == null ? null : JSON.stringify(body);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: {
          Origin: BASE,
          ...(payload
            ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
            : {}),
          ...(cookieJar.length ? { Cookie: cookieJar.join("; ") } : {}),
          ...headers
        }
      },
      (res) => {
        const setCookies = res.headers["set-cookie"] || [];
        for (const c of setCookies) {
          const pair = String(c).split(";")[0];
          const key = pair.split("=")[0];
          const idx = cookieJar.findIndex((x) => x.startsWith(`${key}=`));
          if (idx >= 0) cookieJar[idx] = pair;
          else cookieJar.push(pair);
        }
        let raw = "";
        res.on("data", (d) => (raw += d));
        res.on("end", () => {
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, json, cookieJar });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const puppeteer = require("puppeteer-core");
  const chrome = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ].find((p) => fs.existsSync(p));
  if (!chrome) throw new Error("Chrome/Edge not found");

  const jar = [];
  const login = await httpJson("POST", "/api/admin/dev-auto-login", { cookieJar: jar, body: {} });
  if (login.status >= 400) throw new Error(`dev-auto-login failed: ${login.status}`);

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-sandbox"]
  });
  const page = await browser.newPage();
  await page.setCookie(
    ...jar.map((c) => {
      const [n, ...r] = c.split("=");
      return { name: n, value: r.join("="), domain: "127.0.0.1", path: "/" };
    })
  );

  const results = [];
  let overflow = 0;
  let fail = 0;

  for (const route of ROUTES) {
    for (const vp of VPS) {
      await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1 });
      await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 60000 });
      await new Promise((r) => setTimeout(r, 700));

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
          hasWf: !!wf,
          wfTitle: wf ? (wf.querySelector(".adm-wf__title") || {}).textContent || "" : "",
          hasAutoBadge: !!autoBadge,
          autoBadgeText: autoBadge ? autoBadge.textContent.trim() : "",
          hasScenarios: !!scenarios,
          enableBtn,
          navNeeds,
          bodyOverflowClass: body ? body.className : ""
        };
      });

      const expectsWf = !route.startsWith("/admin/dashboard");
      const expectsScenarios = route.startsWith("/admin/dashboard");
      const ok =
        !m.overflowX &&
        !m.enableBtn &&
        (expectsWf ? m.hasWf : true) &&
        (expectsScenarios ? m.hasScenarios : true);

      if (m.overflowX) overflow += 1;
      if (!ok) fail += 1;

      results.push({
        route,
        viewport: vp.n,
        overflowX: m.overflowX,
        sw: m.sw,
        cw: m.cw,
        hasWf: m.hasWf,
        wfTitle: m.wfTitle,
        hasScenarios: m.hasScenarios,
        autoBadgeText: m.autoBadgeText,
        enableBtn: m.enableBtn,
        ok
      });

      if (vp.n === "d1280" || vp.n === "m390") {
        const slug = `${vp.n}__${route.replace(/[/?#=&.]/g, "_")}`;
        await page.screenshot({
          path: path.join(OUT, `${slug}.png`),
          fullPage: false
        });
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
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify(report.totals, null, 2));
  if (fail || overflow) process.exitCode = 1;
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
