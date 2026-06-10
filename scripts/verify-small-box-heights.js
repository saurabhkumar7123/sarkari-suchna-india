"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "audit-screenshots", "small-box-alignment");
const PORT = 3848;

const previewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Small Box Height Verification</title>
<link rel="stylesheet" href="/css/pages/home.css?v=6">
<style>
body{font-family:system-ui,sans-serif;padding:16px;background:#f1f5f9;max-width:420px;margin:0 auto}
section{margin-bottom:28px;background:#fff;border-radius:12px;padding:14px;box-shadow:0 4px 14px rgba(0,0,0,.06)}
h2{font-size:13px;color:#64748b;margin:0 0 12px;text-transform:uppercase;letter-spacing:.04em}
</style>
</head>
<body class="page-home">
<section>
<h2>Small Boxes (#smallBoxes)</h2>
<div class="small-boxes section" id="smallBoxes">
  <a href="#" class="cat blue">SSC</a>
  <a href="#" class="cat green">SSC CGL Online Form (12256 Posts)</a>
  <a href="#" class="cat purple">Admit Card</a>
</div>
</section>
<section class="taxonomy-discovery" id="taxonomyDiscovery">
<h2>Departments</h2>
<section class="popular-categories taxonomy-panel section taxonomy-panel--active" id="popularBoards">
  <div class="popular-categories__grid">
    <a class="popular-categories__pill" href="#">SSC (12)</a>
    <a class="popular-categories__pill" href="#">Railway (8)</a>
    <a class="popular-categories__pill" href="#">Teaching (4)</a>
    <a class="popular-categories__pill popular-categories__pill--view-all" href="#">View All</a>
  </div>
</section>
<h2 style="margin-top:16px">States</h2>
<section class="popular-categories taxonomy-panel section taxonomy-panel--active" id="popularStates">
  <div class="popular-categories__grid">
    <a class="popular-categories__pill" href="#">All India (7)</a>
    <a class="popular-categories__pill" href="#">Uttar Pradesh (5)</a>
    <a class="popular-categories__pill" href="#">Madhya Pradesh (3)</a>
    <a class="popular-categories__pill" href="#">Bihar (4)</a>
  </div>
</section>
</section>
<section class="page-categories">
<h2>/categories Browse</h2>
<div class="popular-categories__grid popular-categories__grid--browse">
  <a href="#" class="popular-categories__pill">SSC</a>
  <a href="#" class="popular-categories__pill">Railway</a>
  <a href="#" class="popular-categories__pill">Teaching</a>
  <a href="#" class="popular-categories__pill">Health</a>
</div>
</section>
</body>
</html>`;

function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (url.pathname === "/preview.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(previewHtml);
      return;
    }
    if (url.pathname.startsWith("/css/")) {
      const cssPath = path.join(ROOT, "public", "assets", url.pathname.slice(1));
      if (fs.existsSync(cssPath)) {
        res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
        res.end(fs.readFileSync(cssPath));
        return;
      }
    }
    res.writeHead(404).end("Not found");
  });
}

async function capture() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const scriptPath = path.join(ROOT, "scripts", "_small-box-capture.mjs");
  const shots = [
    { name: "after-mobile", width: 390, height: 1100 },
    { name: "after-desktop", width: 900, height: 900 }
  ];
  fs.writeFileSync(
    scriptPath,
    `
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "audit-screenshots", "small-box-alignment");
const shots = ${JSON.stringify(shots)};
const browser = await chromium.launch();
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:${PORT}/preview.html", { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const metrics = await page.evaluate(() => {
    const rows = [];
    document.querySelectorAll(".small-boxes .cat").forEach((el, i) => {
      rows.push({ type: "cat", i, h: Math.round(el.getBoundingClientRect().height) });
    });
    document.querySelectorAll("#popularStates .popular-categories__pill:not(.popular-categories__pill--view-all)").forEach((el, i) => {
      rows.push({ type: "state-pill", i, h: Math.round(el.getBoundingClientRect().height) });
    });
    return rows;
  });
  console.log(s.name, JSON.stringify(metrics));
  await page.screenshot({ path: path.join(outDir, s.name + ".png"), fullPage: true });
  await ctx.close();
}
await browser.close();
`,
    "utf8"
  );

  return new Promise((resolve, reject) => {
    const run = spawn("node", [scriptPath], { cwd: ROOT, stdio: "inherit", shell: true });
    run.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`capture ${code}`))));
  });
}

async function main() {
  const server = createServer();
  await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
  try {
    await capture();
    console.log("Screenshots:", OUT_DIR);
  } finally {
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
