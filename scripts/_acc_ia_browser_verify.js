"use strict";

/**
 * Read-only local ACC URL architecture browser smoke.
 * Does not click scheduler/Telegram toggles or any mutation controls.
 */
const fs = require("fs");
const path = require("path");
const http = require("http");

const BASE = process.env.UI_BASE || "http://127.0.0.1:3011";
const OUT = path.join(__dirname, "..", "backups", "ui-verify-acc-ia");

const ROUTES = [
  "/admin/automation-control-center",
  "/admin/automation-control-center/sources",
  "/admin/automation-control-center/recruitments",
  "/admin/automation-control-center/reviews",
  "/admin/automation-control-center/drafts",
  "/admin/automation-control-center/queue",
  "/admin/automation-control-center/insights",
  "/admin/automation-control-center/health",
  "/admin/automation-control-center/logs",
  "/admin/automation-control-center/controls"
];

const HASH_REDIRECTS = [
  ["#accDrafts", "/admin/automation-control-center/drafts"],
  ["#accPublishingControls", "/admin/automation-control-center/controls"],
  ["#accAudit", "/admin/automation-control-center/logs"],
  ["#accSettings", "/admin/automation-control-center/controls"]
];

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

function httpGet(urlPath, cookie) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: "GET",
        headers: cookie ? { Cookie: cookie } : {}
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function mintCookie(page) {
  // Prefer auto-login endpoint if available
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
  await sleep(800);
  const pathName = new URL(page.url()).pathname;
  if (!pathName.includes("/admin/")) throw new Error(`login did not land on admin: ${page.url()}`);
}

async function main() {
  ensureDir(OUT);
  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: "new",
    args: ["--no-sandbox", "--window-size=1280,900"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await mintCookie(page);

  const report = { base: BASE, at: new Date().toISOString(), routes: [], redirects: [], checks: [] };

  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(900);
    const info = await page.evaluate(() => {
      const title = document.title;
      const pageId = document.body.getAttribute("data-acc-page");
      const navActive = Array.from(document.querySelectorAll("#sidebar a.active")).map((a) => ({
        text: (a.querySelector(".nav-text") || a).textContent.trim(),
        href: a.getAttribute("href")
      }));
      const sidebarAccLinks = Array.from(
        document.querySelectorAll('#sidebar a[href*="/admin/automation-control-center"]')
      ).map((a) => ({
        text: (a.querySelector(".nav-text") || a).textContent.trim(),
        href: a.getAttribute("href")
      }));
      const currentSection = document.querySelector(".acc-switcher__value")?.textContent.trim() || "";
      const switcherOptions = document.querySelectorAll(".acc-switcher__option").length;
      const hasSectionNav = !!document.querySelector(".acc-section-nav");
      const hasSwitcher = !!document.querySelector("[data-acc-switcher]");
      const hasWorkspaceHead = !!document.querySelector(".acc-workspace-head");
      const hasContent = !!document.getElementById("accContent");
      const hasSchedulerToggle = !!document.getElementById("accSchedulerToggle");
      const hasSourceRows = !!document.getElementById("accSourceRows");
      const hasOverviewCards = !!document.querySelector(".acc-overview-grid");
      const hasAuditRows = !!document.getElementById("accAuditRows");
      const hasDraftNav = !!document.getElementById("accDraftNav");
      const bodyOverflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
      const mainEl = document.querySelector(".acc-main");
      const mainOverflowX = mainEl ? mainEl.scrollWidth > mainEl.clientWidth + 1 : false;
      return {
        title,
        pageId,
        pathname: location.pathname,
        navActive,
        sidebarAccLinks,
        currentSection,
        switcherOptions,
        hasSectionNav,
        hasSwitcher,
        hasWorkspaceHead,
        hasContent,
        hasSchedulerToggle,
        hasSourceRows,
        hasOverviewCards,
        hasAuditRows,
        hasDraftNav,
        bodyOverflowX,
        mainOverflowX,
        viewportWidth: window.innerWidth
      };
    });
    const shot = path.join(OUT, `d1280__${route.replace(/[/?#=&]/g, "_")}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    report.routes.push({ route, ...info, screenshot: path.basename(shot) });
  }

  // Desktop overflow matrix
  report.overflow = [];
  for (const width of [1366, 1440, 1920]) {
    await page.setViewport({ width, height: 900, isMobile: false });
    await page.goto(`${BASE}/admin/automation-control-center/drafts`, { waitUntil: "domcontentloaded" });
    await sleep(700);
    const overflow = await page.evaluate(() => ({
      bodyOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }));
    report.overflow.push({ width, ...overflow });
  }

  // Mobile sample
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  for (const route of [
    "/admin/automation-control-center",
    "/admin/automation-control-center/controls",
    "/admin/automation-control-center/drafts"
  ]) {
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
    await sleep(700);
    const mobileOverflow = await page.evaluate(() => ({
      bodyOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    }));
    const shot = path.join(OUT, `m390__${route.replace(/[/?#=&]/g, "_")}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    report.routes.push({ route, viewport: "m390", ...mobileOverflow, screenshot: path.basename(shot) });
  }

  await page.setViewport({ width: 1280, height: 900, isMobile: false });
  for (const [hash, expected] of HASH_REDIRECTS) {
    await page.goto(`${BASE}/admin/automation-control-center${hash}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });
    await sleep(1200);
    const landed = new URL(page.url()).pathname;
    report.redirects.push({ from: hash, expected, landed, ok: landed === expected });
  }

  // Overview must not embed detailed modules
  const overview = report.routes.find((r) => r.route === "/admin/automation-control-center" && !r.viewport);
  report.checks.push({
    name: "overview_is_summary",
    ok: overview && overview.hasOverviewCards && overview.hasWorkspaceHead && !overview.hasSchedulerToggle && !overview.hasSourceRows && !overview.hasAuditRows
  });
  report.checks.push({
    name: "single_sidebar_acc_item",
    ok: overview && Array.isArray(overview.sidebarAccLinks) && overview.sidebarAccLinks.length === 1 && overview.sidebarAccLinks[0].href === "/admin/automation-control-center"
  });
  report.checks.push({
    name: "compact_switcher_has_ten_options",
    ok: overview && overview.hasSwitcher && overview.switcherOptions === 10 && !overview.hasSectionNav
  });
  const controls = report.routes.find((r) => r.route === "/admin/automation-control-center/controls" && !r.viewport);
  report.checks.push({
    name: "controls_has_toggles",
    ok: controls && controls.hasSchedulerToggle && controls.hasWorkspaceHead
  });
  const drafts = report.routes.find((r) => r.route === "/admin/automation-control-center/drafts" && !r.viewport);
  report.checks.push({
    name: "drafts_page_has_viewer",
    ok: drafts && drafts.hasDraftNav && drafts.currentSection === "Draft snapshot" && drafts.hasContent
  });
  report.checks.push({
    name: "nested_sidebar_active",
    ok: drafts && drafts.navActive.some((n) => n.text === "Automation Control Center")
  });
  report.checks.push({
    name: "no_desktop_body_overflow",
    ok: Array.isArray(report.overflow) && report.overflow.every((row) => row.bodyOverflowX === false)
  });
  report.checks.push({
    name: "no_mobile_body_overflow",
    ok: report.routes.filter((r) => r.viewport === "m390").every((r) => r.bodyOverflowX === false)
  });
  report.checks.push({
    name: "legacy_hash_redirects",
    ok: report.redirects.every((r) => r.ok)
  });

  // Sidebar expanded vs collapsed: Switch section must stay in viewport
  await page.setViewport({ width: 1366, height: 900, isMobile: false });
  await page.goto(`${BASE}/admin/automation-control-center`, { waitUntil: "domcontentloaded" });
  await sleep(900);

  async function measureSwitcher(sidebarMode) {
    return page.evaluate((mode) => {
      const body = document.body;
      if (mode === "collapsed") body.classList.add("sidebar-collapsed");
      else body.classList.remove("sidebar-collapsed");
      // Force layout after sidebar CSS variable change
      void document.body.offsetWidth;
      const trigger = document.getElementById("accSwitcherTrigger");
      const switcher = document.querySelector("[data-acc-switcher]");
      const head = document.querySelector(".acc-workspace-head");
      const main = document.querySelector(".acc-main");
      if (!trigger || !switcher) {
        return { ok: false, reason: "missing_switcher" };
      }
      const tr = trigger.getBoundingClientRect();
      const sr = switcher.getBoundingClientRect();
      const mr = main ? main.getBoundingClientRect() : null;
      const cs = getComputedStyle(switcher);
      const hs = head ? getComputedStyle(head) : null;
      const ms = main ? getComputedStyle(main) : null;
      const inView =
        tr.width > 8 &&
        tr.height > 8 &&
        tr.right > 0 &&
        tr.left < window.innerWidth &&
        tr.top < window.innerHeight &&
        tr.bottom > 0 &&
        tr.right <= window.innerWidth + 2;
      return {
        ok: inView && cs.position !== "sticky" && cs.position !== "fixed",
        mode,
        position: cs.position,
        headPosition: hs ? hs.position : null,
        mainWidth: ms ? ms.width : null,
        mainRect: mr ? { left: mr.left, right: mr.right, width: mr.width } : null,
        trigger: { left: tr.left, right: tr.right, top: tr.top, bottom: tr.bottom, width: tr.width },
        switcher: { left: sr.left, right: sr.right, top: sr.top, width: sr.width },
        viewportWidth: window.innerWidth,
        bodyOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      };
    }, sidebarMode);
  }

  const expanded = await measureSwitcher("expanded");
  await sleep(280);
  const shotExp = path.join(OUT, "d1366_sidebar_expanded_switcher.png");
  await page.screenshot({ path: shotExp, fullPage: false });
  const collapsed = await measureSwitcher("collapsed");
  await sleep(280);
  // Re-measure after sidebar width transition settles
  const collapsedSettled = await measureSwitcher("collapsed");
  const shotCol = path.join(OUT, "d1366_sidebar_collapsed_switcher.png");
  await page.screenshot({ path: shotCol, fullPage: false });
  report.sidebarSwitcher = { expanded, collapsed: collapsedSettled, collapsedImmediate: collapsed };
  report.checks.push({
    name: "switcher_visible_sidebar_expanded",
    ok: !!(expanded && expanded.ok)
  });
  report.checks.push({
    name: "switcher_visible_sidebar_collapsed",
    ok: !!(collapsed && collapsed.ok)
  });
  report.checks.push({
    name: "switcher_not_sticky_or_fixed",
    ok: expanded && expanded.position === "relative" && collapsed && collapsed.position === "relative"
  });

  // Scroll away: switcher must leave the viewport (not stick)
  await measureSwitcher("expanded");
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(200);
  const beforeTop = await page.evaluate(() => document.querySelector("[data-acc-switcher]")?.getBoundingClientRect().top ?? null);
  await page.evaluate(() => {
    const el = document.querySelector("[data-acc-switcher]");
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY + el.offsetHeight + window.innerHeight;
    window.scrollTo(0, Math.max(y, 1600));
  });
  await sleep(400);
  const afterScroll = await page.evaluate(() => {
    const el = document.querySelector("[data-acc-switcher]");
    if (!el) return { ok: false };
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      ok: r.bottom < 0,
      top: r.top,
      bottom: r.bottom,
      position: cs.position
    };
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(300);
  const backTop = await page.evaluate(() => document.querySelector("[data-acc-switcher]")?.getBoundingClientRect().top ?? null);
  report.scrollAway = { beforeTop, afterScroll, backTop };
  report.checks.push({
    name: "switcher_scrolls_away_naturally",
    ok: !!(afterScroll && afterScroll.ok && afterScroll.position === "relative" && typeof beforeTop === "number" && beforeTop >= 0)
  });

  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();

  const failed = report.checks.filter((c) => !c.ok);
  console.log(JSON.stringify({ checks: report.checks, redirects: report.redirects, overflow: report.overflow, sidebarSwitcher: report.sidebarSwitcher, scrollAway: report.scrollAway }, null, 2));
  if (failed.length) {
    console.error("FAILED", failed);
    process.exit(1);
  }
  console.log("ACC IA browser smoke PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
