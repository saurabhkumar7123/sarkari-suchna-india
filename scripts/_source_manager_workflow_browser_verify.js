"use strict";

/**
 * Read-only Source Manager UI smoke (desktop + mobile).
 * Does not mutate sources or enable monitoring flags.
 */
const fs = require("fs");
const path = require("path");

const BASE = process.env.UI_BASE || "http://127.0.0.1:3011";
const OUT = path.join(__dirname, "..", "backups", "ui-verify-source-manager");
const ROUTE = "/admin/automation-control-center/sources";

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function loadPuppeteer() {
  try {
    return require("puppeteer-core");
  } catch {
    const { execSync } = require("child_process");
    execSync("npm install --no-save puppeteer-core@24.2.0", {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit"
    });
    return require("puppeteer-core");
  }
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

async function mintCookie(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await sleep(400);
  const auto = await page.evaluate(async () => {
    try {
      const res = await fetch("/api/admin/dev-auto-login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      return { ok: res.ok, status: res.status };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });
  if (!auto.ok) throw new Error(`dev-auto-login failed: ${JSON.stringify(auto)}`);
  await page.goto(`${BASE}/admin/dashboard`, { waitUntil: "domcontentloaded" });
  await sleep(600);
}

async function measureOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
    const clientWidth = doc.clientWidth;
    const main = document.querySelector(".acc-main");
    return {
      overflowX: scrollWidth > clientWidth + 1,
      mainOverflowX: main ? main.scrollWidth > main.clientWidth + 1 : false,
      scrollWidth,
      clientWidth
    };
  });
}

async function runViewport(browser, name, width, height) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await mintCookie(page);

  await page.goto(`${BASE}${ROUTE}`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(800);

  const title = await page.title();
  const hasManager = await page.$("#acc-sources-title");
  const addBtn = await page.$("#accAddSourceBtn");
  const addLabel = addBtn ? await page.evaluate((el) => el.textContent.trim(), addBtn) : "";
  const overflowBefore = await measureOverflow(page);

  if (addBtn) {
    await page.evaluate(() => document.getElementById("accAddSourceBtn")?.click());
    await sleep(400);
  }
  const dialogOpen = await page.evaluate(() => {
    const d = document.getElementById("accSourceDialog");
    return d ? d.open === true : false;
  });
  const hasExactPreview = Boolean(await page.$("#accExactUrlPreview"));
  const hasVerify = Boolean(await page.$("#accVerifySourceBtn"));
  const hasOpenSite = Boolean(await page.$("#accOpenOfficialSiteBtn"));
  const hasPurpose = Boolean(await page.$("#accFormPurpose"));
  const hasForceBypass = await page.evaluate(() => {
    const text = document.body.innerText || "";
    return /force\s*activate|ignore\s*robots|bypass\s*restriction/i.test(text);
  });

  // Close dialog before sidebar toggle so controls remain clickable.
  await page.evaluate(() => {
    const d = document.getElementById("accSourceDialog");
    if (d && d.open) d.close();
  });
  await sleep(200);

  const collapse = await page.$("#sidebarCollapseBtn");
  let overflowCollapsed = null;
  if (collapse) {
    await page.evaluate(() => document.getElementById("sidebarCollapseBtn")?.click());
    await sleep(350);
    overflowCollapsed = await measureOverflow(page);
    await page.evaluate(() => document.getElementById("sidebarCollapseBtn")?.click());
    await sleep(350);
  }

  const shot = path.join(OUT, `${name}_sources.png`);
  await page.screenshot({ path: shot, fullPage: true });
  await page.close();

  return {
    name,
    width,
    height,
    title,
    hasManager: Boolean(hasManager),
    addLabel,
    dialogOpen,
    hasExactPreview,
    hasVerify,
    hasOpenSite,
    hasPurpose,
    hasForceBypass,
    overflowBefore,
    overflowCollapsed,
    shot
  };
}

async function main() {
  ensureDir(OUT);
  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });

  const results = [];
  try {
    results.push(await runViewport(browser, "d1280", 1280, 800));
    results.push(await runViewport(browser, "m390", 390, 844));
  } finally {
    await browser.close();
  }

  const report = {
    at: new Date().toISOString(),
    base: BASE,
    route: ROUTE,
    results,
    pass: results.every(
      (r) =>
        r.hasManager &&
        /Add Official Monitoring Source/i.test(r.addLabel) &&
        r.dialogOpen &&
        r.hasExactPreview &&
        r.hasVerify &&
        r.hasOpenSite &&
        r.hasPurpose &&
        r.hasForceBypass === false &&
        r.overflowBefore.overflowX === false
    )
  };
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
