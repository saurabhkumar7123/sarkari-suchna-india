#!/usr/bin/env node
/**
 * Phase 2 + Phase 3 deployment schema verification.
 *
 * Usage:
 *   node scripts/verify-phase3-schema.js           # pre-migration check
 *   node scripts/verify-phase3-schema.js --post    # post-migration check
 *
 * Exit 0 = ready / OK. Exit 1 = missing required columns or failed backfill.
 */
"use strict";

require("dotenv").config();
const mysql = require("mysql2/promise");

const REQUIRED_BEFORE = [
  { name: "updated_at", phase: "Phase 3 prerequisite (migration anchor)" },
  { name: "small_box_slot", phase: "Phase 2 small-box PATCH" }
];

const PHASE3_COLUMN = "content_updated_at";

function parseArgs(argv) {
  return { post: argv.includes("--post") };
}

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
  return rows.length > 0;
}

async function main() {
  const { post } = parseArgs(process.argv.slice(2));
  const config = {
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || process.env.DB_PASS || "",
    database: process.env.DB_NAME
  };

  if (!config.database) {
    console.error("FAIL: DB_NAME is not set in .env");
    process.exit(1);
  }

  const pool = mysql.createPool({ ...config, charset: "utf8mb4" });
  const conn = await pool.getConnection();
  let exitCode = 0;

  try {
    const [[dbRow]] = await conn.query("SELECT DATABASE() AS currentDb");
    console.log("Database:", dbRow && dbRow.currentDb);
    console.log("Mode:", post ? "post-migration" : "pre-migration");
    console.log("");

    console.log("--- Column checks (pages) ---");
    for (const col of REQUIRED_BEFORE) {
      const exists = await columnExists(conn, "pages", col.name);
      const status = exists ? "OK" : "MISSING";
      console.log(`  ${col.name.padEnd(20)} ${status.padEnd(8)} (${col.phase})`);
      if (!exists) exitCode = 1;
    }

    const hasContentUpdatedAt = await columnExists(conn, "pages", PHASE3_COLUMN);
    console.log(
      `  ${PHASE3_COLUMN.padEnd(20)} ${hasContentUpdatedAt ? "OK" : "MISSING".padEnd(8)} (Phase 3 target)`
    );

    if (post) {
      if (!hasContentUpdatedAt) {
        console.error("\nFAIL: content_updated_at missing after migration.");
        exitCode = 1;
      } else {
        const [[stats]] = await conn.query(
          `SELECT COUNT(*) AS total,
                  SUM(content_updated_at IS NOT NULL) AS populated,
                  SUM(content_updated_at IS NULL) AS null_count
           FROM pages`
        );
        console.log("\n--- Backfill stats ---");
        console.log("  total rows:", stats.total);
        console.log("  content_updated_at populated:", stats.populated);
        console.log("  content_updated_at NULL:", stats.null_count);
        if (Number(stats.null_count) > 0) {
          console.error("\nFAIL: some rows still have NULL content_updated_at.");
          exitCode = 1;
        } else {
          console.log("\nPASS: post-migration verification OK.");
        }
      }
    } else {
      if (hasContentUpdatedAt) {
        console.log("\nNOTE: content_updated_at already exists — skip ALTER; run backfill UPDATE only if needed.");
      } else if (exitCode === 0) {
        console.log("\nREADY: prerequisites met; run migration before deploying Phase 3 code.");
      }
      if (exitCode !== 0) {
        console.error("\nFAIL: missing prerequisite columns. Apply earlier migrations first:");
        console.error("  db/migrations/2026-06-06-add-pages-updated-at.sql");
        console.error("  db/migrations/2026-06-08-add-pages-small-box-slot.sql");
      }
    }

    console.log("\n--- Manual SQL (optional) ---");
    console.log("  SHOW COLUMNS FROM pages LIKE 'updated_at';");
    console.log("  SHOW COLUMNS FROM pages LIKE 'small_box_slot';");
    console.log("  SHOW COLUMNS FROM pages LIKE 'content_updated_at';");
  } finally {
    conn.release();
    await pool.end();
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
