"use strict";

/**
 * Browser verify: Recruitments IA simplification + Review Center filter IA.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const BASE = process.env.UI_BASE || "http://127.0.0.1:3000";
const OUT = path.join(__dirname, "..", "backups", "ui-verify-recruitments-ia");

const ROUTES = [
  "/admin/recruitments",
  "/admin/recruitments#eventTimeline",
  "/admin/recruitment-review-queue",
  "/admin/recruitment-review-queue?status=needs_matching"
];
const VPS = [
  { n: "m375", w: 375, h: 812 },
  { n: "m390", w: 390, h: 844 },
  { n: "m768", w: 768, h: 1024 },
  { n: "d1280", w: 1280, h: 900 },
  { n: "d1366", w: 1366, h: 900 },
  { n: "d1440", w: 1440, h: 900 }
];

function httpJson(method, urlPath, { body = null, cookieJar = [] } = {}) {
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
          ...(cookieJar.length ? { Cookie: cookieJar.join("; ") } : {})
        }
      },
      (res) => {
        for (const c of res.headers["set-cookie"] || []) {
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
  if (login.status >= 400) console.warn("dev-auto-login", login.status);

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-sandbox"]
  });
  const page = await browser.newPage();
  if (jar.length) {
    await page.setCookie(
      ...jar.map((c) => {
        const [n, ...r] = c.split("=");
        return { name: n, value: r.join("="), domain: "127.0.0.1", path: "/" };
      })
    );
  }

  const results = [];
  let overflow = 0;
  let fail = 0;

  for (const route of ROUTES) {
    for (const vp of VPS) {
      await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1 });
      await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 60000 });
      await new Promise((r) => setTimeout(r, 800));

      if (route.startsWith("/admin/recruitments") && !route.includes("#")) {
        await page.click("#newRecruitmentBtn").catch(() => {});
        await new Promise((r) => setTimeout(r, 300));
      }

      const m = await page.evaluate((routePath) => {
        const doc = document.documentElement;
        const body = document.body;
        const sw = Math.max(doc.scrollWidth, body ? body.scrollWidth : 0);
        const cw = Math.max(doc.clientWidth, body ? body.clientWidth : 0);
        const text = body ? body.innerText : "";
        const html = body ? body.innerHTML : "";
        const navText = Array.from(document.querySelectorAll("#sidebar a"))
          .map((a) => a.textContent.trim())
          .join(" | ");
        const out = {
          overflowX: sw > cw + 1,
          sw,
          cw,
          path: location.pathname + location.search + location.hash,
          navText
        };

        if (routePath.startsWith("/admin/recruitments")) {
          out.hasManager = /Recruitment Manager/i.test(text);
          out.hasNewBtn = !!document.getElementById("newRecruitmentBtn");
          out.noWhereAmI = !/Where am I/i.test(text);
          out.noOpsFlow = !document.querySelector(".admin-ops-flow");
          out.noWfMount = !document.querySelector('[data-adm-wf="recruitments"]');
          out.hasEventTimeline = !!document.getElementById("eventTimeline");
          out.listVisible = !document.querySelector(".rom-list-panel")?.hidden;
          out.noTimelineNav = !/Recruitment Timeline/i.test(navText);
          out.noNeedsNav = !/\bNeeds Matching\b/.test(navText);
          out.ok =
            !out.overflowX &&
            out.hasManager &&
            out.hasNewBtn &&
            out.noWhereAmI &&
            out.noOpsFlow &&
            out.noWfMount &&
            out.hasEventTimeline &&
            out.listVisible &&
            out.noTimelineNav &&
            out.noNeedsNav;
        } else {
          out.hasReviewTitle = /Review Center/i.test(text);
          out.hasNeedsChip = !!document.querySelector('[data-rrq-status="needs_matching"]');
          out.hasFilterLegend = !!document.getElementById("rrqFilterLegend");
          out.needsIsFilter = /filter/i.test(html);
          out.noNeedsNav = !/\bNeeds Matching\b/.test(navText) || /Review Center/i.test(navText);
          out.isNeedsUrl = /status=needs_matching/.test(location.search);
          out.ok =
            !out.overflowX &&
            out.hasReviewTitle &&
            out.hasNeedsChip &&
            out.hasFilterLegend &&
            out.needsIsFilter;
        }
        return out;
      }, route);

      if (m.overflowX) overflow += 1;
      if (!m.ok) fail += 1;
      results.push({ route, viewport: vp.n, ...m });

      if (vp.n === "d1280" || vp.n === "m390") {
        const slug = `${vp.n}__${route.replace(/[/?#=&.]/g, "_")}`;
        await page.screenshot({ path: path.join(OUT, `${slug}.png`), fullPage: false });
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
