#!/usr/bin/env node
/**
 * Idempotent Phase 3 migration helper.
 * - Verifies updated_at exists before ALTER
 * - Skips ADD COLUMN if content_updated_at already exists
 * - Always runs idempotent backfill UPDATE
 *
 * Usage: node scripts/apply-phase3-migration.js
 * Does NOT deploy code or restart PM2.
 */
"use strict";

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
  return rows.length > 0;
}

async function main() {
  const config = {
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || process.env.DB_PASS || "",
    database: process.env.DB_NAME,
    multipleStatements: true
  };

  if (!config.database) {
    console.error("FAIL: DB_NAME is not set in .env");
    process.exit(1);
  }

  const pool = mysql.createPool({ ...config, charset: "utf8mb4" });
  const conn = await pool.getConnection();

  try {
    const hasUpdatedAt = await columnExists(conn, "pages", "updated_at");
    if (!hasUpdatedAt) {
      console.error("FAIL: pages.updated_at missing. Run db/migrations/2026-06-06-add-pages-updated-at.sql first.");
      process.exit(1);
    }

    const hasContentUpdatedAt = await columnExists(conn, "pages", "content_updated_at");
    if (!hasContentUpdatedAt) {
      console.log("Adding column pages.content_updated_at …");
      await conn.query(
        "ALTER TABLE `pages` ADD COLUMN `content_updated_at` DATETIME NULL DEFAULT NULL AFTER `updated_at`"
      );
      console.log("ALTER TABLE complete.");
    } else {
      console.log("SKIP: content_updated_at already exists.");
    }

    console.log("Running backfill UPDATE …");
    const [result] = await conn.query(
      "UPDATE `pages` SET `content_updated_at` = COALESCE(`updated_at`, `created_at`) WHERE `content_updated_at` IS NULL"
    );
    console.log("Backfill rows affected:", result.affectedRows);

    const [[stats]] = await conn.query(
      `SELECT COUNT(*) AS total, SUM(content_updated_at IS NOT NULL) AS populated FROM pages`
    );
    console.log("Verification:", stats);

    if (Number(stats.populated) < Number(stats.total)) {
      console.error("FAIL: backfill incomplete.");
      process.exit(1);
    }

    console.log("PASS: Phase 3 migration applied. Deploy code only after this step.");
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
