# Sarkari Suchna India — RC-1 Release Candidate Report

**Final Assessment: RELEASE_CANDIDATE_READY**

Generated: 2026-07-20T06:36:00.088Z

## Repository Audit Report
- Product git: true
- Workspace git: false
- Product files scanned: 1021
- Workspace advisory layer: Workspace server/tests/scripts are advisory planning harness — NOT part of production deploy package

## Repository Classification Report
- Testing: 269
- Production Runtime: 174
- Public Assets: 120
- Advisory: 116
- Shared Library: 79
- Content: 64
- Generated: 55
- Development: 38
- Admin UI: 20
- Generator: 18
- Database Migration: 17
- Documentation: 14
- Configuration: 13
- Monitoring: 8
- SEO: 8
- Review Queue: 7
- Telegram: 1

## Release Inventory
- MUST go to production: **475** files
- MUST NEVER go to production: **556** files

## Production Runtime Inventory
- Reachable runtime modules: 270
- Deploy whitelist files: 475

## Excluded Inventory
- monitoringBot facades excluded: 11
- Dead/advisory candidates: 101

## Database Migration Report
Deterministic path (not executed):
1. `db/migrations/2026-05-09-add-pages-badges.sql`
2. `db/migrations/2026-05-16-content-imports.sql`
3. `db/migrations/2026-06-06-add-pages-updated-at.sql`
4. `db/migrations/2026-06-08-add-pages-small-box-slot.sql`
5. `db/migrations/2026-06-14-add-pages-content-updated-at.sql`
6. `db/migrations/2026-06-21-small-box-slots-1-8.sql`
7. `db/migrations/2026-06-26-add-pages-advertisement-no.sql`
8. `db/migrations/2026-06-27-generator-drafts.sql`
9. `db/migrations/2026-07-13-recruitments.sql`
10. `db/migrations/2026-07-13-recruitment-events.sql`
11. `db/migrations/2026-07-13-recruitment-review-queue.sql`
12. `db/migrations/2026-07-13-add-pages-recruitment-linkage.sql`
13. `db/migrations/2026-07-13-add-updates-recruitment-linkage.sql`
14. `db/migrations/2026-07-13-add-generator-drafts-recruitment-linkage.sql`
15. `db/migrations/2026-07-14-recruitment-review-queue-persistence.sql`
16. `db/migrations/suggested_indexes.sql` *(optional)*
- Duplicates found: 0
- Authoritative order file: `db/migrations/MIGRATION_ORDER.txt`

## Dependency Report
- Production deps: 28
- Dev deps: 8
- Removed unused: `fuse.js`, npm `dompurify` (browser uses `public/assets/js/vendor/dompurify.min.js`)
- Retained despite heuristic: `pdfjs-dist` (dynamic `import()` in PDF extract pipeline)
- Possibly missing: (none)

## Environment Report
- Required: NODE_ENV, SITE_URL, JWT_SECRET, ADMIN_USER, ADMIN_PASS_HASH, DB_HOST, DB_PORT, DB_USER, DB_NAME, REDIS_HOST, REDIS_PORT, CORS_ORIGINS
- Strongly recommended: TRUST_PROXY, COOKIE_DOMAIN, DB_PASSWORD, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN
- Secrets never commit: JWT_SECRET, ADMIN_PASS_HASH, DB_PASSWORD, DB_PASS, REDIS_PASSWORD, TELEGRAM_BOT_TOKEN, OPENAI_API_KEY
- Used but missing from .env.example: (none)

## Import Validation Report
- Runtime missing: 0
- Circular: 0
- Outside-product requires (advisory facades): 0
- Deploy whitelist missing: 0

## Release Verification Report
- generator: OK — Admin generator routes/controllers present
- monitoringBot: OK — Runtime monitoring via siteWorker/scheduler; advisory monitoringBot facades excluded from deploy
- telegram: OK — telegramNotifier present; activation is env-gated and not performed by RC
- reviewQueue: OK — Review queue service + admin UI present
- seo: OK — Sitemap + seo lib present
- scheduler: OK — Scheduler modules present; not activated by RC
- runtime: OK — Syntax checked 372 files; missing=0
- databaseLayer: OK — 16 migration files in deterministic order (not executed)
- redisLayer: OK — Redis config present
- admin: OK — Admin UI + protected routes present
- publicSite: OK — Public homepage + app present
- Syntax failures: 0

## Deployment Manifest
- Path: `docs/release-candidate/deployment-manifest.json`
- Version: RC1.0.0
- Whitelist file count: 475
- Approach: WHITELIST_ONLY (everything excluded by default)

## Release Checklist
- [ ] Confirm RC-1 assessment is RELEASE_CANDIDATE_READY
- [ ] Review deployment-manifest.json whitelist only
- [ ] Confirm .env.example matches required production variables
- [ ] Confirm advisory monitoringBot facades are NOT in deploy package
- [ ] Confirm tests/logs/tmp/generated are excluded
- [ ] Operator authorization required before any production action

## Migration Checklist
- [ ] Backup production MySQL before any migration
- [ ] Apply migrations in orderedPath sequence only
- [ ] Skip suggested_indexes.sql unless operator explicitly approves
- [ ] Do not merge or reorder dated migrations already applied in production
- [ ] Verify row counts / smoke queries after each migration batch
- [ ] No SQL execution performed by RC-1

## Deployment Checklist
- [ ] Deploy ONLY whitelist files from deployment-manifest.json
- [ ] Install dependencies on target via npm ci from package-lock.json
- [ ] Supply production .env separately (never from repo)
- [ ] Do not activate scheduler/Telegram until post-deploy health checks pass
- [ ] PM2 reload / Nginx reload only in a separate authorized deploy request
- [ ] No push/deploy performed by RC-1

## Rollback Checklist
- [ ] Retain previous release artifact / git tag before deploy
- [ ] Restore previous application files from last known good package
- [ ] Restore DB from pre-migration backup if migrations were applied
- [ ] Reload PM2 to previous ecosystem revision
- [ ] Verify /ready and critical public routes
- [ ] Disable feature flags (RECRUITMENT_PIPELINE_ENABLED etc.) if regression detected

## Git Preparation Report
- DO NOT commit automatically
- DO NOT push
- Files to commit (whitelist): 475
- Files deleted/archived this run: 0
- Keep local: .env, uploads, logs, generated, tests, docs, scripts, monitoringBot facades, .rc-archive

## Final Release Assessment

# RELEASE_CANDIDATE_READY

Only ONE final deployment request remains. No deploy/push/migration was performed.
