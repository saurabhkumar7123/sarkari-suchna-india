# RC-1 Git Preparation Report

**DO NOT commit automatically. DO NOT push.**

Product repository: `sarkari-suchna-india/` (remote: `origin/main`)  
Workspace advisory harness (`../server`, `../tests`, `../scripts`) is **outside** this git repo and must never be pushed to the production remote.

---

## Files to Commit

Commit the deployment whitelist plus RC support files the operator chooses to version:

### A) Always commit (production runtime whitelist)

See full list:

- `docs/release-candidate/RC1-PRODUCTION-WHITELIST.txt` (475 files)
- `docs/release-candidate/deployment-manifest.json`

Includes:

- `server/**` runtime (excluding `server/lib/monitoringBot/**`, `server/scripts/**`, `server/data/**`)
- `generator/**` runtime (excluding `generator/scripts/**`)
- `public/**` (excluding samples)
- `private/**` admin UI
- `db/migrations/**` + `db/migrations/MIGRATION_ORDER.txt`
- `nginx/**`, `nginx.conf`, `ecosystem.config.js`
- `package.json`, `package-lock.json`, `.env.example`
- `homepage.html`, `mobile-homepage.html`

### B) Recommended commit (local RC artifacts / docs)

- `docs/release-candidate/**` (RC reports + manifest)
- `.gitignore` updates (`tmp-*.png`, `scripts/tmp-*`, `.rc-archive/`, `coverage/`)
- `scripts/rc1-prepare-release-candidate.js` (reproducible RC tool; not deployed)

### C) Optional commit (operator policy)

- Production apply helpers: `scripts/apply-*-migration.js` (not in deploy whitelist; keep for ops)
- `docs/*.md` runbooks (not deployed)

---

## Files to Ignore

Already covered / ensure ignored:

- `node_modules/`
- `.env` (and other secret env files)
- `logs/`
- `tmp-*.png`
- `scripts/tmp-*`
- `.rc-archive/`
- `coverage/`
- `storage/uploads/`
- `storage/temp/`
- `data/admin-activity.json`
- `data/activity.json`
- `data/related-analytics.json`
- `server/data/editorial-reviews.json`

---

## Files to Delete

Already removed from working tree and archived under `.rc-archive/` this RC run:

- 8× root `tmp-*.png` screenshots
- 39× `scripts/tmp-*` probe scripts
- 7× `logs/*` runtime logs

Do **not** restore these into the commit set.

---

## Files to Archive

Location: `.rc-archive/` (gitignored)

- temporary screenshots
- temporary probe scripts
- runtime logs

Keep locally for audit; never deploy; never push.

---

## Files to Keep Local

| Path | Reason |
|------|--------|
| `.env` | Secrets |
| `storage/uploads/` | Runtime user content |
| `logs/` | Runtime logs |
| `generated/` | Regenerable content snapshots (exclude from deploy package unless policy requires) |
| `node_modules/` | Install via `npm ci` on target |
| `tests/` | Development / CI only |
| `docs/` (except if you choose to version RC reports) | Documentation not required on VPS |
| `scripts/` | Ops/dev utilities (not whitelist-deployed) |
| `server/lib/monitoringBot/` | Advisory facades; require workspace frameworks; **excluded from production** |
| `.rc-archive/` | RC cleanup archive |
| Workspace `../server`, `../tests`, `../scripts` | Planning harness outside product git |

---

## Explicit Non-Actions

- No `git commit` performed by RC-1
- No `git push` performed by RC-1
- No production deploy / PM2 / Nginx / scheduler / Telegram / SQL migration

---

## Suggested operator sequence (next request only)

1. Review `docs/release-candidate/RC1-RELEASE-CANDIDATE-REPORT.md`
2. Stage whitelist + chosen docs
3. Commit with operator-approved message
4. Separate authorized **final deployment** request
