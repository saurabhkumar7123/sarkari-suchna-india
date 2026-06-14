# Pre-Commit Checklist — Phase 1 + 2 + 3

Use this before `git add` / `git commit`. Do **not** commit backup folders, screenshots, or upload PDFs.

## SAFE TO COMMIT (27 files)

### Phase 1 — Homepage Management (read + nav)
- `private/admin-homepage-management.html`
- `public/assets/js/admin-homepage-management.js`
- `server/controllers/admin/homepageManagement.controller.js`
- `private/admin-activity.html`
- `private/admin-alerts.html`
- `private/admin-csv-upload.html`
- `private/admin-dashboard.html`
- `private/admin-monitoring.html`
- `private/admin-page-manager.html`
- `private/admin-sessions.html`
- `public/assets/js/admin-layout.js`
- `server/app.js`
- `server/api/admin/page.routes.js` (GET overview only in Phase 1; PATCH added in Phase 2)

### Phase 2 — Placement writes
- `server/services/homepagePlacement.service.js`
- `server/lib/homepageBadges.js` (shared badge sanitizer)
- `server/validations/admin.validation.js` (PATCH schemas)
- `public/assets/js/admin-homepage-management.js` (write UI — same file as Phase 1)
- `server/api/admin/page.routes.js` (PATCH routes)
- `server/controllers/admin/homepageManagement.controller.js` (PATCH handlers)

### Phase 3 — Content freshness
- `db/migrations/2026-06-14-add-pages-content-updated-at.sql`
- `server/lib/contentFreshness.js`
- `server/repositories/page.repository.js`
- `server/controllers/admin/page.controller.js` (restore bump)
- `tests/contentFreshness.test.js`
- `scripts/verify-phase3-schema.js`
- `scripts/apply-phase3-migration.js`
- `docs/deployment/phase2-phase3-deploy-runbook.md`
- `docs/deployment/phase3-deploy-runbook.md`

### Repo hygiene (this prep)
- `.gitignore` (exclude backups, uploads, audit artifacts)

## EXCLUDE FROM COMMIT

- `.backup-freshness-phase3-*`
- `.backup-homepage-mgmt-*`
- `.backup-upload-fix-*`
- `.deploy/`
- `audit-screenshots/`
- `storage/uploads/pdf/*.pdf`
- `scripts/_*.mjs` (Playwright capture / audit one-offs)
- `scripts/finder-height-measure.mjs`
- `scripts/homepage-spacing-verify.mjs`
- `scripts/layout-3tier-measure.mjs`
- `scripts/local-preview.ps1`
- `scripts/production-layout-verify.mjs`
- `scripts/verify-taxonomy-visuals.js`

## Optional (owner choice)

- `docs/LOCAL_DEVELOPMENT_GUIDE.md` — useful dev doc, not required for deploy

## Suggested git add (copy-paste)

```bash
git add .gitignore \
  db/migrations/2026-06-14-add-pages-content-updated-at.sql \
  docs/deployment/ \
  private/admin-homepage-management.html \
  private/admin-activity.html \
  private/admin-alerts.html \
  private/admin-csv-upload.html \
  private/admin-dashboard.html \
  private/admin-monitoring.html \
  private/admin-page-manager.html \
  private/admin-sessions.html \
  public/assets/js/admin-homepage-management.js \
  public/assets/js/admin-layout.js \
  scripts/apply-phase3-migration.js \
  scripts/verify-phase3-schema.js \
  server/app.js \
  server/api/admin/page.routes.js \
  server/controllers/admin/homepageManagement.controller.js \
  server/controllers/admin/page.controller.js \
  server/lib/contentFreshness.js \
  server/lib/homepageBadges.js \
  server/repositories/page.repository.js \
  server/services/homepagePlacement.service.js \
  server/validations/admin.validation.js \
  tests/contentFreshness.test.js
```

## Suggested commit message

```
feat(admin): Homepage Management placement + content freshness

Phase 1: read-only Homepage Management dashboard and admin nav.
Phase 2: PATCH APIs for breaking, badges, and small-box placement without Generator publish.
Phase 3: content_updated_at column and freshness sort decoupled from placement edits.

Includes deploy runbook, schema verify/apply scripts, and contentFreshness tests.
```

## After commit

See `docs/deployment/phase2-phase3-deploy-runbook.md` for production sequence.
