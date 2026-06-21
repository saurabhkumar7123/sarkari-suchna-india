"use strict";

const fs = require("fs");
const path = require("path");
const { normalizeBreadcrumbInHtml } = require("../lib/breadcrumb");

const jobsDir = path.join(process.cwd(), "generated", "jobs");
if (!fs.existsSync(jobsDir)) {
  console.error("jobs dir not found:", jobsDir);
  process.exit(1);
}

const files = fs.readdirSync(jobsDir).filter((name) => name.endsWith(".html"));
let updated = 0;

for (const file of files) {
  const filePath = path.join(jobsDir, file);
  const before = fs.readFileSync(filePath, "utf8");
  const after = normalizeBreadcrumbInHtml(before);
  if (after !== before) {
    fs.writeFileSync(filePath, after, "utf8");
    updated += 1;
    console.log("updated", file);
  }
}

console.log(`done — ${updated}/${files.length} job pages updated`);
