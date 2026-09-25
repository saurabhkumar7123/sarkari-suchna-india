#!/usr/bin/env bash
# Selective production deploy: ACC safety platform (control plane, kill switch,
# HTTP safety, source governance, dry-run, ACC UI/API).
# Does NOT enable LIVE / Master / Telegram / auto-publish.
# Does NOT run DB migrations.
# Usage on VPS: ACC_DEPLOY_SHA=<sha> bash scripts/_acc_safety_platform_prod_deploy.sh
set -euo pipefail

ROOT="${1:-/root/sarkari-suchna-india}"
SHA="${ACC_DEPLOY_SHA:?ACC_DEPLOY_SHA required}"
cd "$ROOT"

FILES=(
  # ACC UI
  private/admin-automation-control-center.html
  private/admin-automation-controls.html
  private/admin-automation-logs.html
  private/admin-monitoring.html
  public/assets/css/admin/automation-control-center.css
  public/assets/js/admin-automation-control-center.js
  # Control plane / kill switch / flags
  server/config/automationControlPlane.js
  server/config/automationKillSwitch.js
  server/config/automationFlags.js
  # ACC API surface
  server/api/admin/automationControlCenter.routes.js
  server/controllers/admin/automationControlCenter.controller.js
  server/services/automationControlCenter.service.js
  server/validations/admin.validation.js
  # Monitoring safety path
  server/services/updates/monitoringHttpSafety.js
  server/services/updates/monitoringDryRun.js
  server/services/updates/monitoringSecurityAudit.js
  server/services/updates/sourceGovernancePolicy.js
  server/services/updates/monitoringSourceVerify.js
  server/services/updates/robotsAccessPolicy.js
  server/services/updates/siteChecker.js
  server/services/updates/sscNoticeChecker.js
  server/services/updates/updateScheduler.js
  server/services/workers/siteWorker.js
  # Deploy helper
  scripts/_acc_safety_platform_prod_deploy.sh
  scripts/_acc_safety_prod_predeploy_audit.sh
  scripts/_acc_safety_prod_postcheck.sh
)

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="/root/backups/acc_safety_platform_${TS}"
mkdir -p "$BACKUP"
echo "BACKUP=$BACKUP"
echo "PREV_HEAD=$(git rev-parse HEAD)"
echo "PREV_STATUS=$(git status -sb | head -n 5 || true)"

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
    cp -a "$NEWEST" "$BACKUP/" || true
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
  server/config/automationControlPlane.js \
  server/config/automationKillSwitch.js \
  server/config/automationFlags.js \
  server/services/updates/monitoringHttpSafety.js \
  server/services/updates/monitoringDryRun.js \
  server/services/updates/sourceGovernancePolicy.js \
  server/services/automationControlCenter.service.js \
  public/assets/js/admin-automation-control-center.js \
  private/admin-automation-control-center.html || true

NODE_ENV=production node - <<'NODE'
const f = require("./server/config/automationFlags");
const g = f.getAutomationFlags();
const plane = require("./server/config/automationControlPlane").getControlPlaneSnapshot();
const master = require("./server/config/automationKillSwitch").isAutomationMasterEnabled();
const out = {
  AUTO_PUBLISH_ENABLED: g.AUTO_PUBLISH_ENABLED,
  LIVE_CRAWLER_ENABLED: g.LIVE_CRAWLER_ENABLED,
  TELEGRAM_DELIVERY_ENABLED: g.TELEGRAM_DELIVERY_ENABLED,
  PRODUCTION_MONITORING_ENABLED: g.PRODUCTION_MONITORING_ENABLED,
  AUTOMATION_MASTER_ENABLED: g.AUTOMATION_MASTER_ENABLED,
  dormant: f.isAutomationDormant(),
  blocked: f.isAutoPublishBlocked(),
  master,
  mode: plane.mode,
  live: plane.live === true,
  executionPermitted: plane.executionPermitted === true
};
console.log(JSON.stringify(out, null, 2));
if (g.AUTO_PUBLISH_ENABLED === true || master === true || plane.live === true || plane.mode === "LIVE") {
  console.error("REFUSING: unsafe automation state after checkout");
  process.exit(2);
}
NODE

if command -v pm2 >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js --env production
else
  npx pm2 reload ecosystem.config.js --env production
fi

sleep 3
pm2 describe sarkari-suchna | head -n 40 || true
pm2 describe worker | head -n 30 || true

curl -sS -o /dev/null -w "local_health=%{http_code}\n" http://127.0.0.1:3000/health || true
curl -sS -o /dev/null -w "local_ready=%{http_code}\n" http://127.0.0.1:3000/ready || true

NODE_ENV=production node - <<'NODE'
const f = require("./server/config/automationFlags");
const g = f.getAutomationFlags();
const plane = require("./server/config/automationControlPlane").getControlPlaneSnapshot();
console.log("POST_RELOAD", JSON.stringify({
  dormant: f.isAutomationDormant(),
  blocked: f.isAutoPublishBlocked(),
  master: g.AUTOMATION_MASTER_ENABLED,
  mode: plane.mode,
  live: plane.live === true,
  telegram: g.TELEGRAM_DELIVERY_ENABLED,
  autoPublish: g.AUTO_PUBLISH_ENABLED
}));
NODE

echo "DEPLOY_OK sha=$SHA backup=$BACKUP"
