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

async function verifyMinimalInsert() {
  const [result] = await db.query(
    `INSERT INTO recruitment_review_queue (review_status) VALUES ('pending')`
  );
  const queueId = result.insertId;

  try {
    const [[row]] = await db.query(
      `SELECT review_status, update_id, recruitment_id, recruitment_event_id, confidence_level, payload_json
       FROM recruitment_review_queue WHERE id = ?`,
      [queueId]
    );
    if (!row || row.review_status !== "pending") {
      throw new Error("Minimal insert probe failed: review_status not pending");
    }
    if (
      row.update_id !== null ||
      row.recruitment_id !== null ||
      row.recruitment_event_id !== null ||
      row.confidence_level !== null ||
      row.payload_json !== null
    ) {
      throw new Error("Minimal insert probe failed: optional fields were not NULL");
    }
    console.log("Minimal insert probe: OK");
  } finally {
    await db.query("DELETE FROM recruitment_review_queue WHERE id = ?", [queueId]);
  }
}

async function verifySetNullOnDelete() {
  const slug = `__phase7_set_null_probe_${Date.now()}`;
  const [insertParent] = await db.query(
    `INSERT INTO recruitments (title, slug) VALUES (?, ?)`,
    ["Phase 7 SET NULL probe", slug]
  );
  const recruitmentId = insertParent.insertId;

  const [insertEvent] = await db.query(
    `INSERT INTO recruitment_events (recruitment_id, event_type, sequence_order, status)
     VALUES (?, 'notification', 1, 'pending')`,
    [recruitmentId]
  );
  const eventId = insertEvent.insertId;

  const [[site]] = await db.query("SELECT id FROM monitored_sites ORDER BY id ASC LIMIT 1");
  let updateId = null;
  if (site) {
    const title = `__phase7_set_null_probe_update_${Date.now()}`;
    const [insertUpdate] = await db.query(
      "INSERT INTO updates (site_id, title, link) VALUES (?, ?, ?)",
      [site.id, title, null]
    );
    updateId = insertUpdate.insertId;
  }

  const [insertQueue] = await db.query(
    `INSERT INTO recruitment_review_queue
       (update_id, recruitment_id, recruitment_event_id, review_status, confidence_level, payload_json)
     VALUES (?, ?, ?, 'pending', 3, ?)`,
    [updateId, recruitmentId, eventId, JSON.stringify({ probe: true })]
  );
  const queueId = insertQueue.insertId;

  try {
    if (updateId) {
      await db.query("DELETE FROM updates WHERE id = ?", [updateId]);
      const [[afterUpdateDelete]] = await db.query(
        "SELECT update_id FROM recruitment_review_queue WHERE id = ?",
        [queueId]
      );
      if (afterUpdateDelete.update_id !== null) {
        throw new Error("FK probe failed: update_id was not SET NULL on update delete");
      }
    }

    await db.query("DELETE FROM recruitment_events WHERE id = ?", [eventId]);
    const [[afterEventDelete]] = await db.query(
      "SELECT recruitment_event_id FROM recruitment_review_queue WHERE id = ?",
      [queueId]
    );
    if (afterEventDelete.recruitment_event_id !== null) {
      throw new Error("FK probe failed: recruitment_event_id was not SET NULL on event delete");
    }

    await db.query("DELETE FROM recruitments WHERE id = ?", [recruitmentId]);
    const [[afterRecruitmentDelete]] = await db.query(
      "SELECT id, recruitment_id FROM recruitment_review_queue WHERE id = ?",
      [queueId]
    );
    if (!afterRecruitmentDelete || afterRecruitmentDelete.recruitment_id !== null) {
      throw new Error("FK probe failed: review row missing or recruitment_id not SET NULL");
    }

    console.log("ON DELETE SET NULL probe: OK (review row preserved)");
  } finally {
    await db.query("DELETE FROM recruitment_review_queue WHERE id = ?", [queueId]).catch(() => {});
    if (updateId) {
      await db.query("DELETE FROM updates WHERE id = ?", [updateId]).catch(() => {});
    }
    await db.query("DELETE FROM recruitment_events WHERE recruitment_id = ?", [recruitmentId]).catch(() => {});
    await db.query("DELETE FROM recruitments WHERE id = ?", [recruitmentId]).catch(() => {});
  }
}

async function main() {
  const [[dbRow]] = await db.query("SELECT DATABASE() AS db_name");
  const dbName = dbRow && dbRow.db_name ? dbRow.db_name : "(unknown)";
  console.log(`Using database: ${dbName}`);

  if (!(await tableExists("recruitments"))) {
    throw new Error("Prerequisite missing: recruitments table (apply Phase 2 first)");
  }
  if (!(await tableExists("recruitment_events"))) {
    throw new Error("Prerequisite missing: recruitment_events table (apply Phase 3 first)");
  }
  if (!(await tableExists("updates"))) {
    throw new Error("Prerequisite missing: updates table");
  }

  if (await tableExists("recruitment_review_queue")) {
    const [[countRow]] = await db.query("SELECT COUNT(*) AS n FROM recruitment_review_queue");
    const rowCount = countRow && countRow.n != null ? Number(countRow.n) : 0;
    console.log(`recruitment_review_queue already exists (${rowCount} row(s)) — nothing to do`);
    await db.end();
    return;
  }

  const sqlPath = path.join(__dirname, "../db/migrations/2026-07-13-recruitment-review-queue.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  await db.query(sql);

  if (!(await tableExists("recruitment_review_queue"))) {
    throw new Error("Migration ran but recruitment_review_queue table was not created");
  }

  const [columns] = await db.query("SHOW COLUMNS FROM recruitment_review_queue");
  console.log(`Migration applied: recruitment_review_queue table created (${columns.length} columns)`);

  await verifyMinimalInsert();
  await verifySetNullOnDelete();
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
