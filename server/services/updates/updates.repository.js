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
      restored_at DATETIME NULL
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
  await db.query(`ALTER TABLE ${SITES_TABLE} ADD COLUMN IF NOT EXISTS base_url TEXT NULL`);
  await db.query(`ALTER TABLE ${SITES_TABLE} ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1`);
  await db.query(`ALTER TABLE ${SITES_TABLE} ADD COLUMN IF NOT EXISTS last_content TEXT NULL`);
  await db.query(`ALTER TABLE ${SITES_TABLE} ADD COLUMN IF NOT EXISTS last_alert_at DATETIME NULL`);
  await db.query(`ALTER TABLE ${SITES_TABLE} ADD COLUMN IF NOT EXISTS fail_count INT NOT NULL DEFAULT 0`);
  await db.query(`ALTER TABLE ${SITES_TABLE} ADD COLUMN IF NOT EXISTS broken TINYINT(1) NOT NULL DEFAULT 0`);
  await db.query(`ALTER TABLE ${SITES_TABLE} ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 1`);
  await db.query(`ALTER TABLE ${SITES_TABLE} ADD COLUMN IF NOT EXISTS next_retry_at DATETIME NULL`);
  await db.query(`ALTER TABLE ${SITES_TABLE} ADD COLUMN IF NOT EXISTS pre_disable_warned TINYINT(1) NOT NULL DEFAULT 0`);
  await db.query(`ALTER TABLE ${SITES_TABLE} ADD COLUMN IF NOT EXISTS restored_at DATETIME NULL`);
}

async function fetchSites() {
  const [rows] = await db.query(
    `SELECT
      id,
      name,
      url,
      selector,
      last_content AS lastContent,
      last_alert_at AS lastAlertAt,
      fail_count AS failCount,
      broken,
      priority,
      is_active AS active,
      next_retry_at AS nextRetryAt,
      pre_disable_warned AS preDisableWarned,
      restored_at AS restoredAt
     FROM monitored_sites
     ORDER BY priority DESC, id ASC`
  );
  return rows;
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
    await conn.query("UPDATE monitored_sites SET last_content=? WHERE id=?", [latestContent || "", siteId]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function hasRecentDuplicate({ siteId, title, link }) {
  const [rows] = await db.query(
    `SELECT id
     FROM updates
     WHERE site_id = ?
       AND title = ?
       AND IFNULL(link, '') = IFNULL(?, '')
     ORDER BY id DESC
     LIMIT 1`,
    [siteId, title, link || ""]
  );
  return rows.length > 0;
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

async function createSite({ name, url, selector, priority = 1 }) {
  const [result] = await db.query(
    "INSERT INTO monitored_sites (name, url, selector, priority, is_active) VALUES (?, ?, ?, ?, 1)",
    [name, url, selector, priority]
  );
  return result.insertId;
}

async function getSiteById(siteId) {
  const [rows] = await db.query(
    `SELECT id, name, url, selector, last_content AS lastContent, last_alert_at AS lastAlertAt,
            fail_count AS failCount, broken, priority, is_active AS active, next_retry_at AS nextRetryAt,
            pre_disable_warned AS preDisableWarned, restored_at AS restoredAt
     FROM monitored_sites WHERE id=? LIMIT 1`,
    [siteId]
  );
  return rows[0] || null;
}

async function updateSite(siteId, { name, url, selector, priority }) {
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

async function fetchRecentUpdates(limit = 50) {
  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 50));
  const [rows] = await db.query(
    `SELECT u.id, u.site_id AS siteId, s.name AS siteName, u.title, u.link, u.created_at AS createdAt
     FROM updates u
     JOIN monitored_sites s ON s.id = u.site_id
     ORDER BY u.created_at DESC
     LIMIT ?`,
    [safeLimit]
  );
  return rows;
}

module.exports = {
  ensureTables,
  fetchSites,
  saveDetectedUpdate,
  hasRecentDuplicate,
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
  restoreSite,
  disableSite
};
