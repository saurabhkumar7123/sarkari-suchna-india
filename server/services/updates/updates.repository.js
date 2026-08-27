const db = require("../../config/db");
const logger = require("../../utils/logger");
const SITES_TABLE = "monitored_sites";

async function ensureTables() {
  console.log("Using table: monitored_sites");
  await db.query(
    `CREATE TABLE IF NOT EXISTS ${SITES_TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      selector VARCHAR(255) NOT NULL,
      base_url TEXT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      last_content TEXT NULL,
      last_alert_at DATETIME NULL,
      fail_count INT NOT NULL DEFAULT 0,
      broken TINYINT(1) NOT NULL DEFAULT 0,
      priority INT NOT NULL DEFAULT 1,
      next_retry_at DATETIME NULL,
      pre_disable_warned TINYINT(1) NOT NULL DEFAULT 0,
      restored_at DATETIME NULL,
      last_checked_at DATETIME NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  await db.query(
    `CREATE TABLE IF NOT EXISTS updates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      site_id INT NOT NULL,
      title TEXT NOT NULL,
      link TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_updates_site_created (site_id, created_at),
      CONSTRAINT fk_updates_site
        FOREIGN KEY (site_id) REFERENCES ${SITES_TABLE}(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  logger.warn("updates: ensured monitored_sites/updates tables");

  // Backward compatible schema upgrades for existing installations.
  await ensureColumn("base_url", "TEXT NULL");
  await ensureColumn("is_active", "TINYINT(1) NOT NULL DEFAULT 1");
  await ensureColumn("last_content", "TEXT NULL");
  await ensureColumn("last_alert_at", "DATETIME NULL");
  await ensureColumn("fail_count", "INT NOT NULL DEFAULT 0");
  await ensureColumn("broken", "TINYINT(1) NOT NULL DEFAULT 0");
  await ensureColumn("priority", "INT NOT NULL DEFAULT 1");
  await ensureColumn("next_retry_at", "DATETIME NULL");
  await ensureColumn("pre_disable_warned", "TINYINT(1) NOT NULL DEFAULT 0");
  await ensureColumn("restored_at", "DATETIME NULL");
  await ensureColumn("purpose", "VARCHAR(64) NULL");
  await ensureLastCheckedAtColumn();
}

async function ensureColumn(columnName, columnDefinition) {
  const [rows] = await db.query(
    `SELECT 1 AS ok FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [SITES_TABLE, columnName]
  );
  if (rows.length) return;
  try {
    await db.query(`ALTER TABLE ${SITES_TABLE} ADD COLUMN ${columnName} ${columnDefinition}`);
  } catch (err) {
    if (err && err.code !== "ER_DUP_FIELDNAME") throw err;
  }
}

async function ensureLastCheckedAtColumn() {
  const [rows] = await db.query(
    `SELECT 1 AS ok FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'last_checked_at'
     LIMIT 1`,
    [SITES_TABLE]
  );
  if (rows.length) return;
  try {
    await db.query(`ALTER TABLE ${SITES_TABLE} ADD COLUMN last_checked_at DATETIME NULL`);
  } catch (err) {
    if (err && err.code !== "ER_DUP_FIELDNAME") throw err;
  }
}

async function ensurePurposeColumn() {
  await ensureColumn("purpose", "VARCHAR(64) NULL");
}

async function fetchSites() {
  await ensureLastCheckedAtColumn();
  await ensurePurposeColumn();
  const [rows] = await db.query(
    `SELECT
      id,
      name,
      url,
      selector,
      purpose,
      last_content AS lastContent,
      last_alert_at AS lastAlertAt,
      fail_count AS failCount,
      broken,
      priority,
      is_active AS active,
      next_retry_at AS nextRetryAt,
      pre_disable_warned AS preDisableWarned,
      restored_at AS restoredAt,
      last_checked_at AS lastCheckedAt
     FROM monitored_sites
     ORDER BY priority DESC, id ASC`
  );
  return rows;
}

/**
 * Insert a detected update row.
 * Returns the new updates.id when available (traceability only; callers may ignore).
 * Write query and columns are unchanged.
 *
 * @returns {Promise<number|null>}
 */
async function insertDetectedUpdate({ siteId, title, link, documentHash = null, supersedesUpdateId = null }) {
  const hasHash = await updatesHasColumn("document_hash");
  const hasSupersedes = await updatesHasColumn("supersedes_update_id");
  const columns = ["site_id", "title", "link"];
  const values = [siteId, title, link || null];
  if (hasHash) {
    columns.push("document_hash");
    values.push(documentHash || null);
  }
  if (hasSupersedes && supersedesUpdateId != null) {
    columns.push("supersedes_update_id");
    values.push(supersedesUpdateId);
  }
  const placeholders = columns.map(() => "?").join(", ");
  const [result] = await db.query(
    `INSERT INTO updates (${columns.join(", ")}) VALUES (${placeholders})`,
    values
  );
  const insertId = result && result.insertId != null ? Number(result.insertId) : NaN;
  return Number.isFinite(insertId) && insertId > 0 ? insertId : null;
}

async function saveSiteBaseline(siteId, latestContent) {
  await db.query("UPDATE monitored_sites SET last_content=?, last_checked_at=NOW() WHERE id=?", [
    latestContent || "",
    siteId
  ]);
}

async function markSiteChecked(siteId) {
  await db.query("UPDATE monitored_sites SET last_checked_at=NOW() WHERE id=?", [siteId]);
}

async function saveDetectedUpdate({ siteId, title, link, latestContent }) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("INSERT INTO updates (site_id, title, link) VALUES (?, ?, ?)", [
      siteId,
      title,
      link || null
    ]);
    await conn.query(
      "UPDATE monitored_sites SET last_content=?, last_checked_at=NOW() WHERE id=?",
      [latestContent || "", siteId]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function updatesHasColumn(columnName) {
  try {
    const [rows] = await db.query(
      `SELECT 1 AS ok FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'updates'
         AND column_name = ?
       LIMIT 1`,
      [columnName]
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

async function findDuplicateUpdate({ siteId, title, link }) {
  const hasHash = await updatesHasColumn("document_hash");
  const hasSupersedes = await updatesHasColumn("supersedes_update_id");
  const extra = [
    hasHash ? "document_hash AS documentHash" : "NULL AS documentHash",
    hasSupersedes ? "supersedes_update_id AS supersedesUpdateId" : "NULL AS supersedesUpdateId"
  ].join(", ");
  const [rows] = await db.query(
    `SELECT id, site_id AS siteId, title, link, recruitment_id AS recruitmentId, ${extra}
     FROM updates
     WHERE site_id = ?
       AND title = ?
       AND IFNULL(link, '') = IFNULL(?, '')
     ORDER BY id DESC
     LIMIT 1`,
    [siteId, title, link || ""]
  );
  return rows && rows[0] ? rows[0] : null;
}

async function hasRecentDuplicate({ siteId, title, link }) {
  const row = await findDuplicateUpdate({ siteId, title, link });
  return Boolean(row && row.id);
}

async function storeDocumentHash(updateId, documentHash) {
  const id = Number(updateId);
  const hash = String(documentHash || "").trim();
  if (!Number.isFinite(id) || id <= 0 || !hash) return false;
  if (!(await updatesHasColumn("document_hash"))) return false;
  await db.query("UPDATE updates SET document_hash = ? WHERE id = ?", [hash, id]);
  return true;
}

async function markAlertSent(siteId) {
  await db.query("UPDATE monitored_sites SET last_alert_at=NOW() WHERE id=?", [siteId]);
}

async function isInCooldown(siteId, cooldownMinutes) {
  const [rows] = await db.query(
    `SELECT id
     FROM monitored_sites
     WHERE id=?
       AND last_alert_at IS NOT NULL
       AND TIMESTAMPDIFF(MINUTE, last_alert_at, NOW()) < ?
     LIMIT 1`,
    [siteId, cooldownMinutes]
  );
  return rows.length > 0;
}

async function incrementSiteFailure(siteId) {
  const [rows] = await db.query(
    "SELECT fail_count AS failCount, pre_disable_warned AS preDisableWarned FROM monitored_sites WHERE id=? LIMIT 1",
    [siteId]
  );
  const current = rows[0] ? Number(rows[0].failCount || 0) : 0;
  const warned = rows[0] ? Number(rows[0].preDisableWarned || 0) === 1 : false;
  const next = current + 1;
  const expMinutes = Math.min(240, Math.max(1, 2 ** Math.min(next, 8)));
  const deactivateAt = 5;
  const shouldWarn = next === deactivateAt - 1 && !warned;
  await db.query(
    `UPDATE monitored_sites
     SET fail_count = fail_count + 1,
         broken = CASE WHEN fail_count + 1 >= ? THEN 1 ELSE broken END,
         is_active = CASE WHEN fail_count + 1 >= ? THEN 0 ELSE is_active END,
         pre_disable_warned = CASE WHEN fail_count + 1 >= ? THEN pre_disable_warned ELSE pre_disable_warned END,
         next_retry_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
     WHERE id=?`,
    [deactivateAt, deactivateAt, deactivateAt, expMinutes, siteId]
  );
  if (shouldWarn) {
    await db.query("UPDATE monitored_sites SET pre_disable_warned=1 WHERE id=?", [siteId]);
  }
  return { current, next, deactivateAt, expMinutes, shouldWarn };
}

async function resetSiteFailure(siteId) {
  await db.query(
    "UPDATE monitored_sites SET fail_count=0, broken=0, next_retry_at=NULL, pre_disable_warned=0 WHERE id=?",
    [siteId]
  );
}

async function cleanupOldUpdates(days = 30) {
  const [result] = await db.query(
    "DELETE FROM updates WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)",
    [days]
  );
  return result && result.affectedRows ? result.affectedRows : 0;
}

async function createSite({ name, url, selector, priority = 1, purpose = null }) {
  await ensurePurposeColumn();
  const [result] = await db.query(
    "INSERT INTO monitored_sites (name, url, selector, priority, purpose, is_active) VALUES (?, ?, ?, ?, ?, 1)",
    [name, url, selector, priority, purpose || null]
  );
  return result.insertId;
}

async function getSiteById(siteId) {
  await ensureLastCheckedAtColumn();
  await ensurePurposeColumn();
  const [rows] = await db.query(
    `SELECT id, name, url, selector, purpose, last_content AS lastContent, last_alert_at AS lastAlertAt,
            fail_count AS failCount, broken, priority, is_active AS active, next_retry_at AS nextRetryAt,
            pre_disable_warned AS preDisableWarned, restored_at AS restoredAt,
            last_checked_at AS lastCheckedAt
     FROM monitored_sites WHERE id=? LIMIT 1`,
    [siteId]
  );
  return rows[0] || null;
}

async function updateSite(siteId, { name, url, selector, priority, purpose }) {
  await ensurePurposeColumn();
  if (purpose !== undefined) {
    await db.query(
      "UPDATE monitored_sites SET name=?, url=?, selector=?, priority=?, purpose=? WHERE id=?",
      [name, url, selector, priority, purpose || null, siteId]
    );
    return;
  }
  await db.query(
    "UPDATE monitored_sites SET name=?, url=?, selector=?, priority=? WHERE id=?",
    [name, url, selector, priority, siteId]
  );
}

async function deleteSite(siteId) {
  await db.query("DELETE FROM monitored_sites WHERE id=?", [siteId]);
}

async function restoreSite(siteId) {
  await db.query(
    "UPDATE monitored_sites SET is_active=1, fail_count=0, broken=0, next_retry_at=NULL, pre_disable_warned=0, restored_at=NOW() WHERE id=?",
    [siteId]
  );
  logger.warn("updates: site restored", { siteId });
}

async function disableSite(siteId) {
  await db.query(
    "UPDATE monitored_sites SET is_active=0 WHERE id=?",
    [siteId]
  );
  logger.warn("updates: site disabled", { siteId });
}

async function linkageColumnsExist() {
  try {
    const [rows] = await db.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'updates'
         AND column_name IN ('recruitment_id', 'recruitment_event_id')`
    );
    const names = new Set(rows.map((row) => row.COLUMN_NAME || row.column_name));
    return names.has("recruitment_id") && names.has("recruitment_event_id");
  } catch {
    return false;
  }
}

function mapLegacyUpdateRow(row) {
  return {
    id: row.id,
    siteId: row.siteId,
    siteName: row.siteName,
    title: row.title,
    link: row.link,
    createdAt: row.createdAt
  };
}

function mapRecruitmentAwareUpdateRow(row) {
  const base = mapLegacyUpdateRow(row);
  const recruitmentId = row.recruitmentId != null ? Number(row.recruitmentId) : null;
  const recruitmentEventId =
    row.recruitmentEventId != null ? Number(row.recruitmentEventId) : null;

  const aware = {
    ...base,
    recruitment_id: recruitmentId,
    recruitment_event_id: recruitmentEventId
  };

  if (recruitmentId) {
    aware.recruitment = {
      id: recruitmentId,
      title: row.recruitmentTitle || "",
      slug: row.recruitmentSlug || "",
      lifecycle_state: row.recruitmentLifecycleState || null
    };
  }

  if (recruitmentEventId) {
    aware.recruitment_event = {
      id: recruitmentEventId,
      event_type: row.recruitmentEventType || null,
      sequence_order:
        row.recruitmentEventSequenceOrder != null
          ? Number(row.recruitmentEventSequenceOrder)
          : null,
      status: row.recruitmentEventStatus || null
    };
  }

  return aware;
}

async function fetchRecentUpdates(limit = 50, options = {}) {
  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 50));
  const includeRecruitmentLinkage = Boolean(options.includeRecruitmentLinkage);
  const canIncludeLinkage = includeRecruitmentLinkage && (await linkageColumnsExist());

  if (!canIncludeLinkage) {
    const [rows] = await db.query(
      `SELECT u.id, u.site_id AS siteId, s.name AS siteName, u.title, u.link, u.created_at AS createdAt
       FROM updates u
       JOIN monitored_sites s ON s.id = u.site_id
       ORDER BY u.created_at DESC
       LIMIT ?`,
      [safeLimit]
    );
    return rows.map(mapLegacyUpdateRow);
  }

  const [rows] = await db.query(
    `SELECT u.id, u.site_id AS siteId, s.name AS siteName, u.title, u.link, u.created_at AS createdAt,
            u.recruitment_id AS recruitmentId, u.recruitment_event_id AS recruitmentEventId,
            r.title AS recruitmentTitle, r.slug AS recruitmentSlug,
            r.lifecycle_state AS recruitmentLifecycleState,
            re.event_type AS recruitmentEventType,
            re.sequence_order AS recruitmentEventSequenceOrder,
            re.status AS recruitmentEventStatus
     FROM updates u
     JOIN monitored_sites s ON s.id = u.site_id
     LEFT JOIN recruitments r ON r.id = u.recruitment_id
     LEFT JOIN recruitment_events re ON re.id = u.recruitment_event_id
     ORDER BY u.created_at DESC
     LIMIT ?`,
    [safeLimit]
  );
  return rows.map(mapRecruitmentAwareUpdateRow);
}

module.exports = {
  ensureTables,
  fetchSites,
  insertDetectedUpdate,
  saveSiteBaseline,
  markSiteChecked,
  saveDetectedUpdate,
  findDuplicateUpdate,
  hasRecentDuplicate,
  storeDocumentHash,
  markAlertSent,
  isInCooldown,
  incrementSiteFailure,
  resetSiteFailure,
  cleanupOldUpdates,
  createSite,
  getSiteById,
  updateSite,
  deleteSite,
  fetchRecentUpdates,
  linkageColumnsExist,
  mapLegacyUpdateRow,
  mapRecruitmentAwareUpdateRow,
  restoreSite,
  disableSite,
  ensureLastCheckedAtColumn
};
