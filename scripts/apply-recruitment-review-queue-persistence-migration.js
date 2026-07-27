"use strict";

require("dotenv").config();
const db = require("../server/config/db");

const REQUIRED_COLUMNS = [
  "event_type",
  "match_result_json",
  "confidence",
  "source_url",
  "title",
  "raw_notice_json",
  "normalized_notice_json",
  "processor_output_json",
  "decision",
  "notes"
];

async function tableExists(tableName) {
  const [rows] = await db.query(
    `SELECT 1 AS ok FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
    [tableName]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function columnExists(tableName, columnName) {
  const [rows] = await db.query(
    `SELECT 1 AS ok FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function indexExists(tableName, indexName) {
  const [rows] = await db.query(
    `SELECT 1 AS ok FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND index_name = ?
     LIMIT 1`,
    [tableName, indexName]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function expandReviewStatusEnum() {
  await db.query(
    `ALTER TABLE recruitment_review_queue
     MODIFY COLUMN review_status ENUM(
       'pending',
       'resolved',
       'dismissed',
       'under_review',
       'approved',
       'rejected',
       'frozen'
     ) NOT NULL DEFAULT 'pending'`
  );
}

async function addMissingColumns() {
  const statements = [
    ["event_type", "ADD COLUMN event_type VARCHAR(64) NULL DEFAULT NULL AFTER recruitment_event_id"],
    ["match_result_json", "ADD COLUMN match_result_json JSON NULL DEFAULT NULL AFTER event_type"],
    ["confidence", "ADD COLUMN confidence VARCHAR(16) NULL DEFAULT NULL AFTER match_result_json"],
    ["source_url", "ADD COLUMN source_url VARCHAR(2000) NULL DEFAULT NULL AFTER confidence"],
    ["title", "ADD COLUMN title VARCHAR(500) NULL DEFAULT NULL AFTER source_url"],
    ["raw_notice_json", "ADD COLUMN raw_notice_json JSON NULL DEFAULT NULL AFTER title"],
    [
      "normalized_notice_json",
      "ADD COLUMN normalized_notice_json JSON NULL DEFAULT NULL AFTER raw_notice_json"
    ],
    [
      "processor_output_json",
      "ADD COLUMN processor_output_json JSON NULL DEFAULT NULL AFTER normalized_notice_json"
    ],
    ["decision", "ADD COLUMN decision VARCHAR(32) NULL DEFAULT 'none' AFTER review_status"],
    ["notes", "ADD COLUMN notes TEXT NULL DEFAULT NULL AFTER decision"]
  ];

  let added = 0;
  for (const [column, fragment] of statements) {
    if (await columnExists("recruitment_review_queue", column)) {
      continue;
    }
    await db.query(`ALTER TABLE recruitment_review_queue ${fragment}`);
    added += 1;
    console.log(`Added column: ${column}`);
  }
  return added;
}

async function ensureIndexes() {
  if (!(await indexExists("recruitment_review_queue", "idx_recruitment_review_queue_pending"))) {
    await db.query(
      `CREATE INDEX idx_recruitment_review_queue_pending
       ON recruitment_review_queue (review_status, created_at)`
    );
    console.log("Created index: idx_recruitment_review_queue_pending");
  }
  if (!(await indexExists("recruitment_review_queue", "idx_recruitment_review_queue_event_type"))) {
    await db.query(
      `CREATE INDEX idx_recruitment_review_queue_event_type
       ON recruitment_review_queue (event_type)`
    );
    console.log("Created index: idx_recruitment_review_queue_event_type");
  }
}

async function verifyInsertProbe() {
  const payload = {
    event_type: "admit_card",
    match_result_json: JSON.stringify({ match: true, confidence: "high", matchedSignals: [], conflictingSignals: [] }),
    confidence: "high",
    source_url: "https://example.com/admit.pdf",
    title: "Phase 27 persistence probe",
    raw_notice_json: JSON.stringify({ title: "Phase 27 persistence probe" }),
    normalized_notice_json: JSON.stringify({ text: "phase 27 persistence probe" }),
    processor_output_json: JSON.stringify({ status: "success" }),
    review_status: "pending",
    decision: "none",
    notes: null
  };

  const [result] = await db.query(
    `INSERT INTO recruitment_review_queue (
       event_type, match_result_json, confidence, source_url, title,
       raw_notice_json, normalized_notice_json, processor_output_json,
       review_status, decision, notes
     ) VALUES (?, CAST(? AS JSON), ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), ?, ?, ?)`,
    [
      payload.event_type,
      payload.match_result_json,
      payload.confidence,
      payload.source_url,
      payload.title,
      payload.raw_notice_json,
      payload.normalized_notice_json,
      payload.processor_output_json,
      payload.review_status,
      payload.decision,
      payload.notes
    ]
  );

  const id = result.insertId;
  try {
    const [[row]] = await db.query(
      `SELECT event_type, confidence, title, review_status, decision
       FROM recruitment_review_queue WHERE id = ?`,
      [id]
    );
    if (!row || row.event_type !== "admit_card" || row.review_status !== "pending") {
      throw new Error("Insert probe failed");
    }
    console.log("Insert probe: OK");
  } finally {
    await db.query("DELETE FROM recruitment_review_queue WHERE id = ?", [id]);
  }
}

async function main() {
  const [[dbRow]] = await db.query("SELECT DATABASE() AS db_name");
  console.log(`Using database: ${dbRow && dbRow.db_name ? dbRow.db_name : "(unknown)"}`);

  if (!(await tableExists("recruitment_review_queue"))) {
    throw new Error(
      "Prerequisite missing: recruitment_review_queue (apply 2026-07-13-recruitment-review-queue.sql first)"
    );
  }

  await expandReviewStatusEnum();
  console.log("Expanded review_status enum for Phase 27 statuses");

  const added = await addMissingColumns();
  if (added === 0) {
    console.log("Phase 27 persistence columns already present — ensuring indexes");
  }

  await ensureIndexes();

  for (const column of REQUIRED_COLUMNS) {
    if (!(await columnExists("recruitment_review_queue", column))) {
      throw new Error(`Migration incomplete: missing column ${column}`);
    }
  }

  await verifyInsertProbe();
  console.log("Migration applied: recruitment_review_queue persistence columns ready");
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
