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

async function verifyNullLinkageOnExistingPages() {
  const [[stats]] = await db.query(
    `SELECT COUNT(*) AS total,
            SUM(recruitment_id IS NULL) AS null_recruitment,
            SUM(recruitment_event_id IS NULL) AS null_event
     FROM pages`
  );
  const total = Number(stats.total);
  const nullRecruitment = Number(stats.null_recruitment);
  const nullEvent = Number(stats.null_event);

  if (total !== nullRecruitment || total !== nullEvent) {
    throw new Error(
      `Expected all pages to have NULL linkage after migration (total=${total}, null_recruitment=${nullRecruitment}, null_event=${nullEvent})`
    );
  }
  console.log(`NULL linkage check: ${total} page(s), all NULL`);
}

async function verifySetNullOnDelete() {
  const slug = `__phase4_set_null_probe_${Date.now()}`;
  const [insertParent] = await db.query(
    `INSERT INTO recruitments (title, slug) VALUES (?, ?)`,
    ["Phase 4 SET NULL probe", slug]
  );
  const recruitmentId = insertParent.insertId;

  const [insertEvent] = await db.query(
    `INSERT INTO recruitment_events (recruitment_id, event_type, sequence_order, status)
     VALUES (?, 'notification', 1, 'pending')`,
    [recruitmentId]
  );
  const eventId = insertEvent.insertId;

  const [[page]] = await db.query("SELECT id FROM pages LIMIT 1");
  if (!page) {
    await db.query("DELETE FROM recruitment_events WHERE id = ?", [eventId]);
    await db.query("DELETE FROM recruitments WHERE id = ?", [recruitmentId]);
    console.log("ON DELETE SET NULL probe: skipped (no pages row)");
    return;
  }

  const pageId = page.id;
  const [[before]] = await db.query(
    "SELECT recruitment_id, recruitment_event_id FROM pages WHERE id = ?",
    [pageId]
  );

  try {
    await db.query(
      "UPDATE pages SET recruitment_id = ?, recruitment_event_id = ? WHERE id = ?",
      [recruitmentId, eventId, pageId]
    );

    await db.query("DELETE FROM recruitment_events WHERE id = ?", [eventId]);
    const [[afterEventDelete]] = await db.query(
      "SELECT recruitment_id, recruitment_event_id FROM pages WHERE id = ?",
      [pageId]
    );
    if (afterEventDelete.recruitment_event_id !== null) {
      throw new Error("FK probe failed: recruitment_event_id was not SET NULL on event delete");
    }

    await db.query("DELETE FROM recruitments WHERE id = ?", [recruitmentId]);
    const [[afterRecruitmentDelete]] = await db.query(
      "SELECT recruitment_id, recruitment_event_id FROM pages WHERE id = ?",
      [pageId]
    );
    if (afterRecruitmentDelete.recruitment_id !== null) {
      throw new Error("FK probe failed: recruitment_id was not SET NULL on recruitment delete");
    }

    await db.query(
      "UPDATE pages SET recruitment_id = ?, recruitment_event_id = ? WHERE id = ?",
      [before.recruitment_id, before.recruitment_event_id, pageId]
    );
    console.log("ON DELETE SET NULL probe: OK");
  } catch (err) {
    await db.query(
      "UPDATE pages SET recruitment_id = ?, recruitment_event_id = ? WHERE id = ?",
      [before.recruitment_id, before.recruitment_event_id, pageId]
    ).catch(() => {});
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
    throw new Error("Prerequisite missing: recruitments table (apply Phase 2 first)");
  }
  if (!(await tableExists("recruitment_events"))) {
    throw new Error("Prerequisite missing: recruitment_events table (apply Phase 3 first)");
  }
  if (!(await columnExists("pages", "content_updated_at"))) {
    throw new Error("Prerequisite missing: pages.content_updated_at column");
  }

  if (await columnExists("pages", "recruitment_id")) {
    console.log("pages.recruitment_id already exists — nothing to do");
    await db.end();
    return;
  }

  const sqlPath = path.join(__dirname, "../db/migrations/2026-07-13-add-pages-recruitment-linkage.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  await db.query(sql);

  if (!(await columnExists("pages", "recruitment_id")) || !(await columnExists("pages", "recruitment_event_id"))) {
    throw new Error("Migration ran but pages linkage columns were not created");
  }

  console.log("Migration applied: pages recruitment linkage columns added");
  await verifyNullLinkageOnExistingPages();
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
