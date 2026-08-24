"use strict";

require("dotenv").config();
const db = require("../server/config/db");

async function titleMeta() {
  const [rows] = await db.query(
    `SELECT COLUMN_TYPE AS columnType, CHARACTER_MAXIMUM_LENGTH AS maxLen, IS_NULLABLE AS nullable
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pages' AND COLUMN_NAME = 'title'
     LIMIT 1`
  );
  return rows[0] || null;
}

(async () => {
  const before = await titleMeta();
  if (!before) {
    throw new Error("pages.title column not found");
  }
  console.log(JSON.stringify({ before: { columnType: before.columnType, maxLen: Number(before.maxLen) } }));

  if (Number(before.maxLen) >= 500) {
    console.log(JSON.stringify({ skipped: true, reason: "already_compatible", maxLen: Number(before.maxLen) }));
    process.exit(0);
  }

  await db.query("ALTER TABLE `pages` MODIFY COLUMN `title` VARCHAR(500) NOT NULL");
  const after = await titleMeta();
  console.log(JSON.stringify({ after: { columnType: after.columnType, maxLen: Number(after.maxLen) } }));
  if (Number(after.maxLen) < 500) {
    throw new Error("pages.title capacity was not increased");
  }
  process.exit(0);
})().catch((err) => {
  console.error(JSON.stringify({ failed: true, message: err.message }));
  process.exit(1);
});
