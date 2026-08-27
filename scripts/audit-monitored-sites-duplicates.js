"use strict";

/**
 * Read-only audit: detect duplicate / normalized-duplicate monitored_sites URLs.
 * Does not modify data.
 *
 * Usage: node scripts/audit-monitored-sites-duplicates.js
 */

require("dotenv").config();
const db = require("../server/config/db");
const {
  normalizeMonitoringUrlForCompare
} = require("../server/services/updates/monitoringUrlSafety");

async function main() {
  const [rows] = await db.query(
    "SELECT id, name, url, is_active AS active FROM monitored_sites ORDER BY id ASC"
  );
  const byExact = new Map();
  const byNorm = new Map();
  for (const row of rows) {
    const exact = String(row.url || "").trim();
    const norm = normalizeMonitoringUrlForCompare(exact) || `unparseable:${row.id}`;
    if (!byExact.has(exact)) byExact.set(exact, []);
    byExact.get(exact).push(row);
    if (!byNorm.has(norm)) byNorm.set(norm, []);
    byNorm.get(norm).push(row);
  }

  const exactDupes = [...byExact.entries()].filter(([, list]) => list.length > 1);
  const normDupes = [...byNorm.entries()].filter(([, list]) => list.length > 1);

  console.log(
    JSON.stringify(
      {
        total: rows.length,
        exactDuplicateGroups: exactDupes.length,
        normalizedDuplicateGroups: normDupes.length,
        exactDuplicates: exactDupes.map(([url, list]) => ({
          url,
          ids: list.map((r) => r.id),
          names: list.map((r) => r.name)
        })),
        normalizedDuplicates: normDupes.map(([key, list]) => ({
          compareKey: key,
          ids: list.map((r) => r.id),
          urls: list.map((r) => r.url)
        })),
        dbUniqueRecommended: exactDupes.length === 0 && normDupes.length === 0
      },
      null,
      2
    )
  );
  process.exitCode = exactDupes.length || normDupes.length ? 2 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
