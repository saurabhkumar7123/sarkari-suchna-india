# Phase 2 + Phase 3 Production Deploy Runbook

**Scope:** Homepage Management write capabilities (Phase 2) + `content_updated_at` freshness architecture (Phase 3).

**Critical rule:** Run the database migration **before** reloading application code. `deploy.sh` does **not** run migrations and will break production if used alone after pulling Phase 3 code.

---

## Pre-deploy operator checklist

- [ ] Phase 2 + Phase 3 changes are **committed and pushed** to the branch production pulls from
- [ ] Maintenance window or low-traffic period scheduled (ALTER TABLE metadata lock)
- [ ] MySQL backup taken (`scripts/backup-db.sh`)
- [ ] `.env` on server has correct `DB_*` credentials

---

## Step 1 — Backup

On the production server:

```bash
cd /root/sarkari-suchna-india   # or your deploy path
./scripts/backup-db.sh
```

Optional code snapshot:

```bash
git rev-parse HEAD > /tmp/pre-phase23-deploy-$(date +%Y%m%d).txt
```

---

## Step 2 — Pre-migration schema verification

```bash
node scripts/verify-phase3-schema.js
```

**Expected (pre-migration):**

| Column | Status | Required by |
|--------|--------|-------------|
| `updated_at` | OK | Phase 3 migration anchor |
| `small_box_slot` | OK | Phase 2 small-box PATCH |
| `content_updated_at` | MISSING | Added in Step 3 |

If `updated_at` or `small_box_slot` is MISSING, apply earlier migrations first:

```bash
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < db/migrations/2026-06-06-add-pages-updated-at.sql
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < db/migrations/2026-06-08-add-pages-small-box-slot.sql
```

Manual SQL (optional):

```sql
SHOW COLUMNS FROM pages LIKE 'updated_at';
SHOW COLUMNS FROM pages LIKE 'small_box_slot';
SHOW COLUMNS FROM pages LIKE 'content_updated_at';
```

---

## Step 3 — Run Phase 3 migration

**Recommended (idempotent helper):**

```bash
node scripts/apply-phase3-migration.js
```

**Alternative (raw SQL file):**

```bash
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
  < db/migrations/2026-06-14-add-pages-content-updated-at.sql
```

> Raw SQL `ALTER TABLE` is **not** idempotent — fails if column already exists. Use the Node helper for safer re-runs.

---

## Step 4 — Post-migration verification

```bash
node scripts/verify-phase3-schema.js --post
```

**Expected (post-migration):**

| Column | Status |
|--------|--------|
| `updated_at` | OK |
| `small_box_slot` | OK |
| `content_updated_at` | OK |
| Backfill | All rows populated (`null_count = 0`) |

Manual check:

```sql
SELECT COUNT(*) AS total,
       SUM(content_updated_at IS NOT NULL) AS populated
FROM pages;
```

---

## Step 5 — Deploy code

```bash
git pull
npm install
```

**Do not run `deploy.sh` / PM2 reload until Steps 2–4 passed.**

---

## Step 6 — PM2 reload

```bash
pm2 reload ecosystem.config.js --env production
# or: ./deploy.sh   (only AFTER migration is verified)
```

---

## Step 7 — Smoke tests

See [Smoke test checklist](#smoke-test-checklist) below.

---

## Step 8 — Optional Redis cache flush

**Recommended** after Phase 3 deploy for immediate freshness cutover on homepage dynamic sections.

```bash
redis-cli KEYS "pages:list:*"
redis-cli --scan --pattern "pages:list:*" | xargs -r redis-cli DEL
```

Or flush all Redis keys if acceptable in your environment:

```bash
redis-cli FLUSHDB
```

**Why:** Dynamic section order uses cached `pages:list:*:fresh` keys (TTL ~60s). Migration does not invalidate Redis. Flush avoids up to 60s of stale ordering.

**Not required for:**

- Breaking rotator (direct DB query)
- Small boxes (direct DB query)
- Search / sitemap / listings (unchanged sort fields)

**Badge display on dynamic cards** after Homepage Management badge PATCH may lag up to TTL without flush — optional flush clears this too.

---

## Rollback sequence

### Code rollback (safe immediately)

```bash
git checkout <previous-commit>
npm install
pm2 reload ecosystem.config.js --env production
```

Old code ignores `content_updated_at`; column can remain in DB harmlessly.

### Database rollback (only if Phase 3 code is also rolled back)

**Do not drop columns in normal rollback.** Leaving `content_updated_at` is safe.

If column must be removed (exceptional):

```sql
-- Destructive — only with explicit approval
ALTER TABLE pages DROP COLUMN content_updated_at;
```

---

## Smoke test checklist

| # | Test | How | Expected result |
|---|------|-----|-----------------|
| 1 | Homepage loads | `GET /` | HTTP 200; no 500 in PM2 logs |
| 2 | Dynamic sections | Homepage `#dynamicSections` cards | Sections render with job links |
| 3 | Breaking strip | Homepage breaking rotator | Breaking items visible; order by `breaking_order` |
| 4 | Generator content edit | Publish title/body change | Page saves; moves up in dynamic section order |
| 5 | Generator breaking-only | Toggle breaking, save unchanged content | Saves OK; **dynamic section order unchanged** |
| 6 | Homepage Mgmt breaking | `PATCH /api/admin/homepage-management/breaking/:slug` | Breaking list updates; no freshness jump |
| 7 | Homepage Mgmt badges | `PATCH /api/admin/homepage-management/badges/:slug` | Badges update; card badges within ~60s (or immediate after cache flush) |
| 8 | Homepage Mgmt small box | `PATCH /api/admin/homepage-management/small-box/:slug` | Slot map updates on refresh |
| 9 | Search | `/search?q=ssc` | Results return; no 500 |
| 10 | Sitemap | `/sitemap.xml` | Valid XML; job URLs present |

Admin UI: `/admin/homepage-management` loads with Breaking, Badges, Small Boxes sections.

---

## Migration file reference

| File | Purpose |
|------|---------|
| `db/migrations/2026-06-06-add-pages-updated-at.sql` | Prerequisite |
| `db/migrations/2026-06-08-add-pages-small-box-slot.sql` | Phase 2 prerequisite |
| `db/migrations/2026-06-14-add-pages-content-updated-at.sql` | Phase 3 target |

---

## deploy.sh warning

`deploy.sh` executes: `git pull` → `npm install` → `pm2 reload`.

It **never** runs SQL migrations. Running it on Phase 3 code **before** migration causes:

- Homepage SSR failure (`Unknown column 'content_updated_at'`)
- Generator publish failure on INSERT/UPDATE

**Always complete Steps 2–4 before Step 6.**
