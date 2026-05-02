/**
 * Deep diagnostics: DATABASE(), SHOW CREATE TABLE, triggers, generated columns.
 * Usage: node server/scripts/debug-pages-deep.js
 */
require("dotenv").config();
const mysql = require("mysql2/promise");

async function main() {
  const database = process.env.DB_NAME;
  if (!database) {
    console.error("DB_NAME is not set in .env");
    process.exit(1);
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database,
    charset: "utf8mb4"
  });

  const conn = await pool.getConnection();
  try {
    const [[dbRow]] = await conn.query("SELECT DATABASE() AS db");
    console.log("SELECT DATABASE():", dbRow.db);

    console.log("\n--- SHOW CREATE TABLE pages ---\n");
    const [[createRow]] = await conn.query("SHOW CREATE TABLE `pages`");
    console.log(createRow && createRow["Create Table"]);

    const safeDb = String(database).replace(/`/g, "");

    console.log("\n--- SHOW TRIGGERS (pages table) ---\n");
    try {
      const [triggers] = await conn.query(`SHOW TRIGGERS FROM \`${safeDb}\``);
      const pagesTriggers = (triggers || []).filter((t) => t && t.Table === "pages");
      if (pagesTriggers.length === 0) {
        console.log("No triggers on `pages`.");
      } else {
        console.table(pagesTriggers);
        console.warn(
          "If any trigger sets qualification/state/department to NULL, fix or DROP TRIGGER in MySQL."
        );
      }
    } catch (e) {
      console.warn("Could not list triggers:", e.message);
    }

    console.log("\n--- INFORMATION_SCHEMA columns (structured + generated check) ---\n");
    let cols;
    try {
      const [rows] = await conn.query(
        `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, GENERATION_EXPRESSION
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ?
           AND TABLE_NAME = 'pages'
           AND COLUMN_NAME IN ('qualification','state','department')
         ORDER BY COLUMN_NAME`,
        [safeDb]
      );
      cols = rows;
    } catch {
      const [rows] = await conn.query(
        `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ?
           AND TABLE_NAME = 'pages'
           AND COLUMN_NAME IN ('qualification','state','department')
         ORDER BY COLUMN_NAME`,
        [safeDb]
      );
      cols = rows;
    }
    console.table(cols);

    for (const c of cols) {
      const extra = String(c.EXTRA || "").toLowerCase();
      if (extra.includes("generated") || extra.includes("virtual") || extra.includes("stored")) {
        console.warn(`WARNING: ${c.COLUMN_NAME} may be generated — inserts can be ignored/overwritten.`);
      }
    }
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
