#!/usr/bin/env bash
# Deploy Monitoring IA cleanup to production (nested URLs + single sidebar item).
# Usage on VPS: ACC_DEPLOY_SHA=<sha> bash scripts/_monitoring_ia_prod_deploy.sh
set -euo pipefail

ROOT="${1:-/root/sarkari-suchna-india}"
SHA="${ACC_DEPLOY_SHA:?ACC_DEPLOY_SHA required}"
cd "$ROOT"

FILES=(
  server/app.js
  private/admin-monitoring.html
  private/admin-monitoring-updates.html
  private/admin-monitoring-activity.html
  private/admin-dashboard.html
  public/assets/js/admin-monitoring.js
  public/assets/js/admin-nav.js
  public/assets/js/admin-shell.js
  public/assets/js/admin-command-palette.js
  public/assets/js/admin-notifications.js
  public/assets/css/admin/admin-design-system.css
  tests/adminMonitoringUrlArchitecture.test.js
  tests/adminUiDashboardNavPolish.test.js
  scripts/_monitoring_ia_browser_verify.js
)

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="/root/backups/monitoring_ia_${TS}"
mkdir -p "$BACKUP"
echo "BACKUP=$BACKUP"

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    mkdir -p "$BACKUP/$(dirname "$f")"
    cp -a "$f" "$BACKUP/$f"
  fi
done
cp -a .env "$BACKUP/.env" 2>/dev/null || true

if [ -x scripts/backup-db.sh ]; then
  BACKUP_ENV_FILE="$ROOT/.env" bash scripts/backup-db.sh || echo "DB_BACKUP_WARN"
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

echo "LOCAL_BLOBS"
git hash-object \
  server/app.js \
  private/admin-monitoring.html \
  private/admin-monitoring-updates.html \
  private/admin-monitoring-activity.html \
  public/assets/js/admin-nav.js \
  public/assets/js/admin-monitoring.js

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
if (g.LIVE_CRAWLER_ENABLED === true || g.PRODUCTION_MONITORING_ENABLED === true) {
  console.error("REFUSING: monitoring crawler flags unexpectedly true");
  process.exit(2);
}
NODE

pm2 reload ecosystem.config.js --update-env || pm2 restart all
sleep 3
pm2 status
nginx -t && systemctl reload nginx || true

curl -sS -o /dev/null -w "health=%{http_code}\n" http://127.0.0.1:3000/health || true
curl -sS -o /dev/null -w "ready=%{http_code}\n" http://127.0.0.1:3000/ready || true

echo "DEPLOY_OK sha=$SHA backup=$BACKUP"
