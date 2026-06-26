"use strict";

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("../server/config/db");

async function main() {
  const [[row]] = await db.query("SHOW COLUMNS FROM pages LIKE 'advertisement_no'");
  if (row) {
    console.log("advertisement_no already exists — nothing to do");
    await db.end();
    return;
  }

  const sqlPath = path.join(__dirname, "../db/migrations/2026-06-26-add-pages-advertisement-no.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  await db.query(sql);
  console.log("Migration applied: advertisement_no column added");
  await db.end();
}

main().catch(async (e) => {
  console.error(e.message);
  try {
    await db.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
