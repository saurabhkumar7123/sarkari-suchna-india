#!/usr/bin/env node
"use strict";

require("dotenv").config();
const db = require("../server/config/db");
const { writeSitemapFile } = require("../server/lib/sitemapGenerator");

(async () => {
  const result = await writeSitemapFile(db);
  console.log(`[sitemap] Wrote ${result.path} (${result.urlCount} URLs).`);
  await db.end().catch(() => {});
})().catch(async (err) => {
  console.error("[sitemap] Failed:", err);
  try {
    await db.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
