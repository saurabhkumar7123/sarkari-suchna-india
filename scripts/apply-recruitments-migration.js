"use strict";

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("../server/config/db");

async function tableExists() {
  const [rows] = await db.query(
    `SELECT 1 AS ok FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = 'recruitments' LIMIT 1`
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function main() {
  const [[dbRow]] = await db.query("SELECT DATABASE() AS db_name");
  const dbName = dbRow && dbRow.db_name ? dbRow.db_name : "(unknown)";
  console.log(`Using database: ${dbName}`);

  if (await tableExists()) {
    const [[countRow]] = await db.query("SELECT COUNT(*) AS n FROM recruitments");
    const rowCount = countRow && countRow.n != null ? Number(countRow.n) : 0;
    console.log(`recruitments already exists (${rowCount} row(s)) — nothing to do`);
    await db.end();
    return;
  }

  const sqlPath = path.join(__dirname, "../db/migrations/2026-07-13-recruitments.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  await db.query(sql);

  if (!(await tableExists())) {
    throw new Error("Migration ran but recruitments table was not created");
  }

  const [columns] = await db.query("SHOW COLUMNS FROM recruitments");
  console.log(`Migration applied: recruitments table created (${columns.length} columns)`);
  await db.end();
}

main().catch(async (e) => {
  console.error("Migration failed:", e.message);
  try {
    await db.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
