"use strict";

const http = require("http");

const PORT = Number(process.env.PORT || 3000);
const BASE = `http://127.0.0.1:${PORT}`;

const PAGES = [
  { path: "/", name: "homepage" },
  { path: "/latest-job", name: "latest-job" },
  { path: "/categories", name: "categories" },
  { path: "/result", name: "result" },
];

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 900 },
];

function fetchOk(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = "";
        res.on("data", (c) => {
          body += c;
        });
        res.on("end", () => resolve({ status: res.statusCode, body }));
      })
      .on("error", reject);
  });
}

async function getPlaywright() {
  try {
    return require("playwright");
  } catch {
    const { execSync } = require("child_process");
    execSync("npm install --no-save playwright@1.51.0", {
      cwd: require("path").join(__dirname, ".."),
      stdio: "inherit",
    });
    return require("playwright");
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function checkPage(page, pageInfo, vp) {
  const url = `${BASE}${pageInfo.path}`;
  await page.setViewportSize({ width: vp.width, height: vp.height });
  const res = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  assert(res && res.ok(), `${pageInfo.name} ${vp.name}: HTTP ${res && res.status()}`);

  await page.waitForTimeout(800);

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const overflowX = Math.max(0, body.scrollWidth - window.innerWidth);
    const header = document.querySelector(".main-header");
    const main = document.querySelector(".site-main, main, .main-container, .page-container");
    const footer = document.querySelector("#footer, footer");

    function rect(sel) {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        w: r.width,
        h: r.height,
        display: s.display,
        visibility: s.visibility,
      };
    }

    return {
      overflowX,
      hasHeader: !!header && header.getBoundingClientRect().height > 0,
      hasMain: !!main && main.getBoundingClientRect().height > 20,
      homeCss: !!document.querySelector('link[href*="home.css"]'),
      breaking: rect(".breaking-news"),
      smallBoxes: rect("#smallBoxes"),
      finder: rect("#openFinder"),
      searchOverlay: rect("#searchOverlay"),
      taxonomy: rect("#taxonomyDiscovery"),
      cards: rect("#dynamicSections"),
      trending: rect("#trendingSection"),
      title: document.title,
    };
  });

  assert(metrics.overflowX <= 2, `${pageInfo.name} ${vp.name}: horizontal overflow ${metrics.overflowX}px`);
  assert(metrics.hasHeader, `${pageInfo.name} ${vp.name}: header missing/collapsed`);
  assert(metrics.hasMain, `${pageInfo.name} ${vp.name}: main content collapsed`);

  if (pageInfo.path === "/") {
    assert(metrics.homeCss, `homepage ${vp.name}: home.css not linked`);
    assert(metrics.breaking && metrics.breaking.h > 0, `homepage ${vp.name}: breaking news collapsed`);
    assert(metrics.smallBoxes && metrics.smallBoxes.h > 0, `homepage ${vp.name}: small boxes collapsed`);
    assert(metrics.finder && metrics.finder.h > 0, `homepage ${vp.name}: job finder collapsed`);

  if (vp.name === "mobile") {
      const gap = await page.$(".home-content-start-gap");
      const gapVisible = gap
        ? await gap.evaluate((el) => {
            const s = getComputedStyle(el);
            return s.display !== "none" && el.getBoundingClientRect().height > 0;
          })
        : false;
      assert(gapVisible, `homepage mobile: Stay Updated band hidden`);
    }
  }

  if (pageInfo.path === "/latest-job") {
    const grid = await page.$(".card-grid, .page-section .card-grid");
    assert(grid, `latest-job ${vp.name}: card grid missing`);
  }

  return metrics;
}

async function checkSearchOverlay(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.click(".header-search-mobile-btn");
  await page.waitForSelector("#searchOverlay.active", { timeout: 5000 });

  const box = await page.evaluate(() => {
    const input = document.getElementById("searchInput");
    const btn = document.getElementById("searchBtn");
    const ir = input.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    return { inputH: ir.height, btnH: br.height, overlayActive: document.getElementById("searchOverlay").classList.contains("active") };
  });

  assert(box.overlayActive, "search overlay did not open");
  assert(box.inputH >= 40, `search input too short: ${box.inputH}px`);
  assert(box.btnH >= 40, `search button too short: ${box.btnH}px`);
}

async function main() {
  const health = await fetchOk(`${BASE}/`);
  assert(health.status === 200, `Server not reachable on ${BASE} (status ${health.status})`);

  const playwright = await getPlaywright();
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();

  const results = [];
  for (const vp of VIEWPORTS) {
    for (const p of PAGES) {
      const m = await checkPage(page, p, vp);
      results.push({ page: p.name, viewport: vp.name, overflowX: m.overflowX, ok: true });
      console.log(`OK  ${p.name} @ ${vp.name} (overflow ${m.overflowX}px)`);
    }
  }

  await checkSearchOverlay(page);
  console.log("OK  search overlay mobile");

  await browser.close();
  console.log("\nAll layout checks passed:", results.length + 1);
}

main().catch((err) => {
  console.error("\nLAYOUT VERIFY FAILED:", err.message);
  process.exit(1);
});
