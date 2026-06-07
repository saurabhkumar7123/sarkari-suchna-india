"use strict";

const fs = require("fs");
const path = require("path");
const { renderBreadcrumbHtml } = require("../lib/breadcrumb");

const jobsDir = path.join(process.cwd(), "generated", "jobs");
const files = fs.readdirSync(jobsDir).filter((name) => name.endsWith(".html"));

for (const file of files) {
  const filePath = path.join(jobsDir, file);
  let html = fs.readFileSync(filePath, "utf8");
  const match = html.match(/<span class="page-name">([^<]*)<\/span>/);
  if (!match) {
    console.warn("skip (no page-name):", file);
    continue;
  }
  const title = match[1]
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
  const breadcrumb = renderBreadcrumbHtml(title);
  html = html.replace(/<div class="breadcrumb">[\s\S]*?<\/div>/, breadcrumb);
  html = html.replace(/breadcrumb\.css\?v=2/g, "breadcrumb.css?v=3");
  fs.writeFileSync(filePath, html, "utf8");
  console.log("updated", file);
}
