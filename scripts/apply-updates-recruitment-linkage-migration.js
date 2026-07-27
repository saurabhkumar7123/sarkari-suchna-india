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

async function columnExists(tableName, columnName) {
  const [rows] = await db.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
  return rows.length > 0;
}

async function verifyNullLinkageOnExistingUpdates() {
  const [[stats]] = await db.query(
    `SELECT COUNT(*) AS total,
            SUM(recruitment_id IS NULL) AS null_recruitment,
            SUM(recruitment_event_id IS NULL) AS null_event
     FROM updates`
  );
  const total = Number(stats.total);
  const nullRecruitment = Number(stats.null_recruitment);
  const nullEvent = Number(stats.null_event);

  if (total !== nullRecruitment || total !== nullEvent) {
    throw new Error(
      `Expected all updates to have NULL linkage after migration (total=${total}, null_recruitment=${nullRecruitment}, null_event=${nullEvent})`
    );
  }
  console.log(`NULL linkage check: ${total} update(s), all NULL`);
}

async function verifyLegacyMonitoringInsert() {
  const [[site]] = await db.query("SELECT id FROM monitored_sites ORDER BY id ASC LIMIT 1");
  if (!site) {
    console.log("Legacy monitoring insert probe: skipped (no monitored_sites row)");
    return;
  }

  const title = `__phase5_monitoring_insert_probe_${Date.now()}`;
  const link = "https://example.com/phase5-probe";
  const [result] = await db.query(
    "INSERT INTO updates (site_id, title, link) VALUES (?, ?, ?)",
    [site.id, title, link]
  );
  const updateId = result.insertId;

  try {
    const [[row]] = await db.query(
      "SELECT site_id, title, link, recruitment_id, recruitment_event_id FROM updates WHERE id = ?",
      [updateId]
    );
    if (!row || row.site_id !== site.id || row.title !== title || row.link !== link) {
      throw new Error("Legacy monitoring insert probe failed: core columns not stored correctly");
    }
    if (row.recruitment_id !== null || row.recruitment_event_id !== null) {
      throw new Error("Legacy monitoring insert probe failed: linkage columns were not NULL");
    }
    console.log("Legacy monitoring insert probe: OK");
  } finally {
    await db.query("DELETE FROM updates WHERE id = ?", [updateId]);
  }
}

async function verifySetNullOnDelete() {
  const slug = `__phase5_set_null_probe_${Date.now()}`;
  const [insertParent] = await db.query(
    `INSERT INTO recruitments (title, slug) VALUES (?, ?)`,
    ["Phase 5 SET NULL probe", slug]
  );
  const recruitmentId = insertParent.insertId;

  const [insertEvent] = await db.query(
    `INSERT INTO recruitment_events (recruitment_id, event_type, sequence_order, status)
     VALUES (?, 'notification', 1, 'pending')`,
    [recruitmentId]
  );
  const eventId = insertEvent.insertId;

  const [[site]] = await db.query("SELECT id FROM monitored_sites ORDER BY id ASC LIMIT 1");
  if (!site) {
    await db.query("DELETE FROM recruitment_events WHERE id = ?", [eventId]);
    await db.query("DELETE FROM recruitments WHERE id = ?", [recruitmentId]);
    console.log("ON DELETE SET NULL probe: skipped (no monitored_sites row)");
    return;
  }

  const title = `__phase5_set_null_probe_update_${Date.now()}`;
  const [insertUpdate] = await db.query(
    "INSERT INTO updates (site_id, title, link, recruitment_id, recruitment_event_id) VALUES (?, ?, ?, ?, ?)",
    [site.id, title, null, recruitmentId, eventId]
  );
  const updateId = insertUpdate.insertId;

  try {
    await db.query("DELETE FROM recruitment_events WHERE id = ?", [eventId]);
    const [[afterEventDelete]] = await db.query(
      "SELECT id, recruitment_id, recruitment_event_id FROM updates WHERE id = ?",
      [updateId]
    );
    if (!afterEventDelete || afterEventDelete.recruitment_event_id !== null) {
      throw new Error("FK probe failed: detection row missing or recruitment_event_id not SET NULL");
    }

    await db.query("DELETE FROM recruitments WHERE id = ?", [recruitmentId]);
    const [[afterRecruitmentDelete]] = await db.query(
      "SELECT id, recruitment_id, recruitment_event_id FROM updates WHERE id = ?",
      [updateId]
    );
    if (!afterRecruitmentDelete || afterRecruitmentDelete.recruitment_id !== null) {
      throw new Error("FK probe failed: detection row missing or recruitment_id not SET NULL");
    }

    console.log("ON DELETE SET NULL probe: OK (detection row preserved)");
  } finally {
    await db.query("DELETE FROM updates WHERE id = ?", [updateId]).catch(() => {});
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

  if (await columnExists("updates", "recruitment_id")) {
    console.log("updates.recruitment_id already exists — nothing to do");
    await db.end();
    return;
  }

  const sqlPath = path.join(__dirname, "../db/migrations/2026-07-13-add-updates-recruitment-linkage.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  await db.query(sql);

  if (!(await columnExists("updates", "recruitment_id")) || !(await columnExists("updates", "recruitment_event_id"))) {
    throw new Error("Migration ran but updates linkage columns were not created");
  }

  console.log("Migration applied: updates recruitment linkage columns added");
  await verifyNullLinkageOnExistingUpdates();
  await verifyLegacyMonitoringInsert();
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
