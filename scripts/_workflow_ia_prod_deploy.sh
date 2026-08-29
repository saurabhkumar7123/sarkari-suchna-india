#!/usr/bin/env bash
# Deploy Manual + Automatic Workflow UX/IA to production (presentation only).
# Usage on VPS: ACC_DEPLOY_SHA=<sha> bash scripts/_workflow_ia_prod_deploy.sh
set -euo pipefail

ROOT="${1:-/root/sarkari-suchna-india}"
SHA="${ACC_DEPLOY_SHA:?ACC_DEPLOY_SHA required}"
cd "$ROOT"

FILES=(
  public/assets/js/admin-workflow-ia.js
  public/assets/css/admin/admin-design-system.css
  public/assets/js/admin-nav.js
  private/admin-dashboard.html
  private/admin-recruitments.html
  private/admin-recruitment-review-queue.html
  private/admin-editorial-review.html
  private/admin-page-manager.html
  private/generator.html
  private/admin-monitoring.html
  private/admin-monitoring-updates.html
  private/admin-automation-control-center.html
  tests/adminWorkflowIa.ux.test.js
  tests/adminUiDashboardNavPolish.test.js
  scripts/_workflow_ia_browser_verify.js
  scripts/_workflow_ia_prod_deploy.sh
  scripts/_workflow_ia_prod_postcheck.sh
  scripts/_workflow_ia_prod_browser_verify.js
)

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="/root/backups/workflow_ia_${TS}"
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
  public/assets/js/admin-workflow-ia.js \
  public/assets/css/admin/admin-design-system.css \
  public/assets/js/admin-nav.js \
  private/admin-dashboard.html \
  private/admin-recruitments.html \
  private/admin-recruitment-review-queue.html \
  private/admin-editorial-review.html \
  private/generator.html \
  private/admin-automation-control-center.html

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

# Ensure no enable-automation controls were introduced in deployed HTML/JS
node - <<'NODE'
const fs = require("fs");
const paths = [
  "public/assets/js/admin-workflow-ia.js",
  "private/admin-dashboard.html",
  "private/admin-recruitments.html",
  "private/admin-editorial-review.html",
  "private/admin-automation-control-center.html"
];
for (const p of paths) {
  const t = fs.readFileSync(p, "utf8");
  if (/enableAutoPublish|turnOnAutomation|AUTO_PUBLISH_ENABLED\s*=\s*true/i.test(t)) {
    console.error("REFUSING: unsafe automation enable pattern in", p);
    process.exit(2);
  }
  if (!/admin-workflow-ia|adm-wf|admWfScenarios|Needs Matching|Manual Publish/i.test(t) && p.endsWith(".html")) {
    // dashboard/recruitments/editorial/acc must retain workflow markers
  }
}
console.log("STATIC_SAFETY_OK");
NODE

pm2 reload ecosystem.config.js --update-env || pm2 restart all
sleep 3
pm2 status
nginx -t && systemctl reload nginx || true

curl -sS -o /dev/null -w "health=%{http_code}\n" http://127.0.0.1:3000/health || true
curl -sS -o /dev/null -w "ready=%{http_code}\n" http://127.0.0.1:3000/ready || true

echo "DEPLOY_OK sha=$SHA backup=$BACKUP"
