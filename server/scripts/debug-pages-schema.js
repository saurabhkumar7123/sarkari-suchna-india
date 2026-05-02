/**
 * Verifies DATABASE() context and DESCRIBE pages for structured columns.
 * Usage: node server/scripts/debug-pages-schema.js
 */
require("dotenv").config();
const mysql = require("mysql2/promise");

async function main() {
  const config = {
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME
  };

  if (!config.database) {
    console.error("DB_NAME is not set in .env — pool default schema is undefined.");
    process.exit(1);
  }

  const pool = mysql.createPool({ ...config, charset: "utf8mb4" });
  const conn = await pool.getConnection();
  try {
    const [[dbRow]] = await conn.query("SELECT DATABASE() AS currentDb");
    console.log("SELECT DATABASE():", dbRow && dbRow.currentDb);
    console.log("Expected DB_NAME from env:", config.database);
    if (String(dbRow.currentDb) !== String(config.database)) {
      console.warn("WARNING: DATABASE() does not match DB_NAME — check connection defaults.");
    }

    const [desc] = await conn.query("DESCRIBE `pages`");
    const fields = new Set(desc.map((r) => r.Field));
    console.log("\nDESCRIBE pages — structured columns:");
    for (const col of ["qualification", "state", "department"]) {
      const row = desc.find((r) => r.Field === col);
      console.log(`  ${col}:`, row ? `${row.Type} ${row.Null === "YES" ? "NULL" : "NOT NULL"}` : "MISSING");
    }
    if (!["qualification", "state", "department"].every((c) => fields.has(c))) {
      console.error("\nFix: ALTER TABLE pages ADD COLUMN ... for any MISSING column.");
      process.exitCode = 1;
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
