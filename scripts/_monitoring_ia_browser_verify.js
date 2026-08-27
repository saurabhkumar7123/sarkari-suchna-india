"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const BASE = process.env.UI_BASE || "http://127.0.0.1:3022";
const ROUTES = [
  "/admin/monitoring",
  "/admin/monitoring/updates",
  "/admin/monitoring/activity",
  "/admin/monitoring#recentUpdates",
  "/admin/monitoring#monitoringActivity"
];
const VPS = [
  { n: "d1280", w: 1280, h: 900 },
  { n: "d1366", w: 1366, h: 900 },
  { n: "d1440", w: 1440, h: 900 },
  { n: "d1920", w: 1920, h: 1080 },
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
  const puppeteer = require("puppeteer-core");
  const chrome = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ].find((p) => fs.existsSync(p));
  const jar = [];
  await httpJson("POST", "/api/admin/dev-auto-login", { cookieJar: jar, body: {} });
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

  async function check(route, vp, extra = {}) {
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1 });
    await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 900));
    const m = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const sw = Math.max(doc.scrollWidth, body ? body.scrollWidth : 0);
      const cw = Math.max(doc.clientWidth, body ? body.clientWidth : 0);
      const monLinks = Array.from(
        document.querySelectorAll('#sidebar a[data-nav-path="/admin/monitoring"]')
      );
      const activeMon = monLinks.filter((a) => a.classList.contains("active"));
      const opts = Array.from(document.querySelectorAll(".mon-switcher__option")).map((a) => ({
        text: a.textContent.trim(),
        href: a.getAttribute("href"),
        active: a.classList.contains("is-active")
      }));
      return {
        overflowX: sw > cw + 1,
        sw,
        cw,
        path: location.pathname,
        hash: location.hash,
        monSidebarCount: monLinks.length,
        monActive: activeMon.length,
        switcherCurrent: document.querySelector(".mon-switcher__value")?.textContent?.trim() || "",
        options: opts,
        hasSites: !!document.getElementById("sitesTable"),
        hasUpdates: !!document.getElementById("recentUpdatesList"),
        hasActivity: !!document.getElementById("queueFailedList")
      };
    });

    if (extra.collapse) {
      await page.evaluate(() => {
        document.body.classList.add("sidebar-collapsed");
      });
      await new Promise((r) => setTimeout(r, 250));
      const m2 = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        const sw = Math.max(doc.scrollWidth, body ? body.scrollWidth : 0);
        const cw = Math.max(doc.clientWidth, body ? body.clientWidth : 0);
        return {
          overflowX: sw > cw + 1,
          sw,
          cw,
          collapsed: document.body.classList.contains("sidebar-collapsed")
        };
      });
      m.collapsedCheck = m2;
      await page.evaluate(() => {
        document.body.classList.remove("sidebar-collapsed");
      });
    }

    let redirectOk = true;
    if (route.includes("#recentUpdates")) {
      redirectOk = m.path === "/admin/monitoring/updates";
    } else if (route.includes("#monitoringActivity")) {
      redirectOk = m.path === "/admin/monitoring/activity";
    }

    const ok = !m.overflowX && m.monSidebarCount === 1 && m.monActive === 1 && redirectOk;
    if (m.overflowX) overflow += 1;
    if (!ok) fail += 1;
    results.push({ route, viewport: vp.n, ...m, ok, redirectOk, ...extra });
  }

  for (const vp of VPS) {
    for (const route of ROUTES) {
      await check(route, vp);
    }
  }
  await check("/admin/monitoring/updates", { n: "d1280-collapsed", w: 1280, h: 900 }, { collapse: true });
  await check("/admin/monitoring/activity", { n: "m390-collapsed", w: 390, h: 844 }, { collapse: true });

  const out = {
    generatedAt: new Date().toISOString(),
    totals: {
      checks: results.length,
      ok: results.filter((r) => r.ok).length,
      fail,
      overflow
    },
    redirects: results
      .filter((r) => r.route.includes("#") && r.viewport === "d1280")
      .map((r) => ({ route: r.route, path: r.path, hash: r.hash, switcherCurrent: r.switcherCurrent })),
    results
  };
  const outDir = path.join(__dirname, "..", "backups", "ui-verify-monitoring-ia");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out.totals));
  console.log("redirects", JSON.stringify(out.redirects, null, 2));
  const bad = results.filter((r) => !r.ok);
  if (bad.length) {
    console.log(
      "BAD",
      JSON.stringify(
        bad.map((b) => ({
          route: b.route,
          vp: b.viewport,
          overflowX: b.overflowX,
          monSidebarCount: b.monSidebarCount,
          monActive: b.monActive,
          path: b.path,
          redirectOk: b.redirectOk
        })),
        null,
        2
      )
    );
    process.exitCode = 1;
  } else {
    console.log("all ok");
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
