"use strict";

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("../server/config/db");

async function tableExists(tableName) {
  const [rows] = await db.query(
    `SELECT 1 AS ok FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
    [tableName]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function verifyParentChildIntegrity() {
  const slug = `__phase3_fk_probe_${Date.now()}`;
  const [insertParent] = await db.query(
    `INSERT INTO recruitments (title, slug) VALUES (?, ?)`,
    ["Phase 3 FK probe", slug]
  );
  const recruitmentId = insertParent.insertId;

  try {
    let rejected = false;
    try {
      await db.query(
        `INSERT INTO recruitment_events (recruitment_id, event_type, sequence_order)
         VALUES (?, 'notification', 1)`,
        [999999999]
      );
    } catch (err) {
      rejected = err && (err.code === "ER_NO_REFERENCED_ROW_2" || err.errno === 1452);
      if (!rejected) throw err;
    }
    if (!rejected) {
      throw new Error("FK probe failed: orphan recruitment_id insert was not rejected");
    }

    const [insertChild] = await db.query(
      `INSERT INTO recruitment_events (recruitment_id, event_type, sequence_order, status)
       VALUES (?, 'notification', 1, 'pending')`,
      [recruitmentId]
    );
    const eventId = insertChild.insertId;

    let deleteBlocked = false;
    try {
      await db.query("DELETE FROM recruitments WHERE id = ?", [recruitmentId]);
    } catch (err) {
      deleteBlocked = err && (err.code === "ER_ROW_IS_REFERENCED_2" || err.errno === 1451);
      if (!deleteBlocked) throw err;
    }
    if (!deleteBlocked) {
      throw new Error("FK probe failed: parent delete with child row was not blocked");
    }

    await db.query("DELETE FROM recruitment_events WHERE id = ?", [eventId]);
    await db.query("DELETE FROM recruitments WHERE id = ?", [recruitmentId]);
    console.log("Parent-child integrity probe: OK");
  } catch (err) {
    await db.query("DELETE FROM recruitment_events WHERE recruitment_id = ?", [recruitmentId]).catch(() => {});
    await db.query("DELETE FROM recruitments WHERE id = ?", [recruitmentId]).catch(() => {});
    throw err;
  }
}

async function main() {
  const [[dbRow]] = await db.query("SELECT DATABASE() AS db_name");
  const dbName = dbRow && dbRow.db_name ? dbRow.db_name : "(unknown)";
  console.log(`Using database: ${dbName}`);

  if (!(await tableExists("recruitments"))) {
    throw new Error("Prerequisite missing: recruitments table does not exist (apply Phase 2 first)");
  }

  if (await tableExists("recruitment_events")) {
    const [[countRow]] = await db.query("SELECT COUNT(*) AS n FROM recruitment_events");
    const rowCount = countRow && countRow.n != null ? Number(countRow.n) : 0;
    console.log(`recruitment_events already exists (${rowCount} row(s)) — nothing to do`);
    await db.end();
    return;
  }

  const sqlPath = path.join(__dirname, "../db/migrations/2026-07-13-recruitment-events.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  await db.query(sql);

  if (!(await tableExists("recruitment_events"))) {
    throw new Error("Migration ran but recruitment_events table was not created");
  }

  const [columns] = await db.query("SHOW COLUMNS FROM recruitment_events");
  console.log(`Migration applied: recruitment_events table created (${columns.length} columns)`);

  await verifyParentChildIntegrity();
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
