#!/usr/bin/env bash
# Stage 1: Deploy official source-registry hardening to production.
# Usage on VPS: ACC_DEPLOY_SHA=<sha> bash scripts/_source_registry_hardening_prod_deploy.sh
set -euo pipefail

ROOT="${1:-/root/sarkari-suchna-india}"
SHA="${ACC_DEPLOY_SHA:?ACC_DEPLOY_SHA required}"
cd "$ROOT"

FILES=(
  package.json
  package-lock.json
  private/admin-automation-sources.html
  public/assets/js/admin-automation-control-center.js
  server/controllers/admin/updates.controller.js
  server/services/automationControlCenter.service.js
  server/services/updates/siteChecker.js
  server/services/updates/sscNoticeChecker.js
  server/services/workers/siteWorker.js
  server/validations/admin.validation.js
  server/services/updates/hostPoliteness.js
  server/services/updates/monitoringFetchErrors.js
  server/services/updates/monitoringSiteWriteGuard.js
  server/services/updates/monitoringUrlSafety.js
  server/services/updates/robotsAccessPolicy.js
  tests/monitoringRegistryHardening.test.js
  tests/packageAMP4B.part41.monitoring.test.js
  tests/upscSelector.monitoringReadiness.test.js
  scripts/audit-monitored-sites-duplicates.js
  scripts/verify-monitoring-pilot-sources.js
  db/migrations/2026-08-27-monitored-sites-url-norm-key.optional.sql
)

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="/root/backups/source_registry_hardening_${TS}"
mkdir -p "$BACKUP"
echo "BACKUP=$BACKUP"

# File backup
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    mkdir -p "$BACKUP/$(dirname "$f")"
    cp -a "$f" "$BACKUP/$f"
  fi
done
cp -a .env "$BACKUP/.env" 2>/dev/null || true

# DB backup (best-effort; do not abort deploy if dump tool missing after file backup)
if [ -x scripts/backup-db.sh ]; then
  BACKUP_ENV_FILE="$ROOT/.env" bash scripts/backup-db.sh || echo "DB_BACKUP_WARN"
  # Copy newest dump into this deploy backup folder if present
  NEWEST="$(ls -1t backups/mysql/*.sql 2>/dev/null | head -n 1 || true)"
  if [ -n "${NEWEST:-}" ]; then
    cp -a "$NEWEST" "$BACKUP/"
    echo "DB_BACKUP_COPIED=$NEWEST"
  fi
else
  echo "DB_BACKUP_SCRIPT_MISSING"
fi

git fetch origin main
git checkout "$SHA" -- "${FILES[@]}"
echo "CHECKOUT_DONE sha=$SHA"

npm install --omit=dev --no-fund --no-audit

NODE_ENV=production node - <<'NODE'
const f = require("./server/config/automationFlags");
const g = f.getAutomationFlags();
console.log(JSON.stringify({
  AUTO_PUBLISH_ENABLED: g.AUTO_PUBLISH_ENABLED,
  LIVE_CRAWLER_ENABLED: g.LIVE_CRAWLER_ENABLED,
  PRODUCTION_MONITORING_ENABLED: g.PRODUCTION_MONITORING_ENABLED,
  dormant: f.isAutomationDormant(),
  blocked: f.isAutoPublishBlocked()
}));
if (g.AUTO_PUBLISH_ENABLED === true) {
  console.error("REFUSING: AUTO_PUBLISH_ENABLED unexpectedly true");
  process.exit(2);
}
NODE

if command -v pm2 >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js --env production
else
  npx pm2 reload ecosystem.config.js --env production
fi

sleep 3
pm2 describe sarkari-suchna | head -50 || true
echo "DEPLOY_OK sha=$SHA backup=$BACKUP"
