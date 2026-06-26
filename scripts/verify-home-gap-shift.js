"use strict";

const http = require("http");

const PORT = Number(process.env.PORT || 3000);
const BASE = `http://127.0.0.1:${PORT}`;

function fetchText(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      })
      .on("error", reject);
  });
}

async function verifyWithPlaywright() {
  let playwright;
  try {
    playwright = require("playwright");
  } catch {
    const { execSync } = require("child_process");
    execSync("npm install --no-save playwright@1.51.0", {
      cwd: require("path").join(__dirname, ".."),
      stdio: "inherit",
    });
    playwright = require("playwright");
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

  const metrics = await page.evaluate(() => {
    const header = document.querySelector(".main-header");
    const headerIndicator = document.querySelector(".main-header .site-updated-indicator--title");
    const breaking = document.querySelector(".breaking-news");
    const gap = document.querySelector(".home-content-start-gap");
    const homeIndicator = document.querySelector(".site-updated-indicator--home-start");
    const smallBoxes = document.getElementById("smallBoxes");

    function box(el) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        height: Math.round(r.height),
        display: cs.display,
      };
    }

    const headerBox = box(header);
    const breakingBox = box(breaking);
    const gapBox = box(gap);
    const homeIndicatorBox = box(homeIndicator);
    const smallBoxesBox = box(smallBoxes);

    return {
      bodyClass: document.body.className,
      headerIndicatorDisplay: headerIndicator ? getComputedStyle(headerIndicator).display : "missing",
      homeIndicatorDisplay: homeIndicator ? getComputedStyle(homeIndicator).display : "missing",
      header: headerBox,
      breaking: breakingBox,
      gap: gapBox,
      homeIndicator: homeIndicatorBox,
      smallBoxes: smallBoxesBox,
      headerToBreaking:
        headerBox && breakingBox ? breakingBox.top - headerBox.bottom : null,
      breakingToSmallBoxes:
        breakingBox && smallBoxesBox ? smallBoxesBox.top - breakingBox.bottom : null,
      homeIndicatorBetweenBreakingAndBoxes:
        homeIndicatorBox && breakingBox && smallBoxesBox
          ? homeIndicatorBox.top >= breakingBox.bottom && homeIndicatorBox.bottom <= smallBoxesBox.top
          : false,
    };
  });

  await browser.close();
  return metrics;
}

async function main() {
  const home = await fetchText(`${BASE}/`);
  const headerCss = await fetchText(`${BASE}/css/components/header.css`);
  const homeCss = await fetchText(`${BASE}/css/pages/home.css`);

  const checks = {
    htmlHasGapElement: home.body.includes('class="home-content-start-gap"'),
    htmlHasHomeStartIndicator: home.body.includes("site-updated-indicator--home-start"),
    htmlHomeCssV71: home.body.includes("home.css?v=71"),
    htmlHeaderCssV16: home.body.includes("header.css?v=16"),
    headerMarginBottomZero: /main-header\s*\{[^}]*margin-bottom\s*:\s*0/.test(headerCss.body),
    mobileHeaderIndicatorHidden: /main-header \.site-updated-indicator--title[\s\S]*?display\s*:\s*none/.test(
      headerCss.body
    ),
    homeStartIndicatorCss: /site-updated-indicator--home-start/.test(homeCss.body),
  };

  console.log("=== Static checks ===");
  console.log(JSON.stringify(checks, null, 2));

  let layout = null;
  try {
    layout = await verifyWithPlaywright();
    console.log("\n=== Mobile layout (390px) ===");
    console.log(JSON.stringify(layout, null, 2));
  } catch (err) {
    console.error("\nPlaywright layout check failed:", err.message);
    process.exitCode = 1;
    return;
  }

  const pass =
    checks.htmlHasGapElement &&
    checks.htmlHasHomeStartIndicator &&
    checks.mobileHeaderIndicatorHidden &&
    checks.homeStartIndicatorCss &&
    layout.homeIndicatorDisplay !== "none" &&
    layout.headerIndicatorDisplay === "none" &&
    layout.homeIndicatorBetweenBreakingAndBoxes;

  console.log("\n=== Verdict ===");
  if (pass) {
    console.log("PASS: Stay Updated blinking light shifted from header to homepage gap.");
  } else {
    console.log("FAIL: shift not verified.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
