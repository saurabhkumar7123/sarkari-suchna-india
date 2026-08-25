"use strict";

require("dotenv").config();
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

async function enumIncludes(tableName, columnName, value) {
  const [rows] = await db.query(
    `SELECT COLUMN_TYPE AS columnType
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  const type = rows && rows[0] && (rows[0].columnType || rows[0].COLUMN_TYPE);
  return String(type || "").includes(`'${value}'`);
}

async function expandReviewStatusEnum() {
  if (!(await tableExists("recruitment_review_queue"))) {
    console.log("Skip: recruitment_review_queue missing");
    return;
  }
  if (await enumIncludes("recruitment_review_queue", "review_status", "needs_matching")) {
    console.log("review_status already includes needs_matching");
    return;
  }
  await db.query(
    `ALTER TABLE recruitment_review_queue
     MODIFY COLUMN review_status ENUM(
       'pending',
       'resolved',
       'dismissed',
       'under_review',
       'approved',
       'rejected',
       'frozen',
       'needs_matching'
     ) NOT NULL DEFAULT 'pending'`
  );
  console.log("Expanded review_status ENUM with needs_matching");
}

async function addUpdatesColumns() {
  if (!(await tableExists("updates"))) {
    console.log("Skip: updates missing");
    return;
  }
  if (!(await columnExists("updates", "document_hash"))) {
    await db.query(
      "ALTER TABLE updates ADD COLUMN document_hash VARCHAR(64) NULL DEFAULT NULL AFTER link"
    );
    console.log("Added column: updates.document_hash");
  } else {
    console.log("updates.document_hash already exists");
  }
  if (!(await columnExists("updates", "supersedes_update_id"))) {
    await db.query(
      "ALTER TABLE updates ADD COLUMN supersedes_update_id INT NULL DEFAULT NULL AFTER document_hash"
    );
    console.log("Added column: updates.supersedes_update_id");
  } else {
    console.log("updates.supersedes_update_id already exists");
  }
}

async function main() {
  await expandReviewStatusEnum();
  await addUpdatesColumns();
  console.log("Recruitment lifecycle safety migration complete");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
