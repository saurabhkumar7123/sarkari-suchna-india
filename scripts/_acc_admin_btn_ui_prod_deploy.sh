#!/usr/bin/env bash
# Selective production deploy: ACC responsive UI + Admin button UI (presentation only).
# Usage on VPS: ACC_DEPLOY_SHA=<sha> bash scripts/_acc_admin_btn_ui_prod_deploy.sh
set -euo pipefail

ROOT="${1:-/root/sarkari-suchna-india}"
SHA="${ACC_DEPLOY_SHA:?ACC_DEPLOY_SHA required}"
cd "$ROOT"

FILES=(
  public/assets/css/admin/admin-design-system.css
  public/assets/css/admin/automation-control-center.css
  public/assets/css/admin/recruitment-module.css
  public/assets/js/admin-automation-control-center.js
  private/admin-automation-control-center.html
  private/admin-automation-controls.html
  private/admin-automation-drafts.html
  private/admin-automation-health.html
  private/admin-automation-insights.html
  private/admin-automation-logs.html
  private/admin-automation-queue.html
  private/admin-automation-recruitments.html
  private/admin-automation-reviews.html
  private/admin-automation-sources.html
  private/admin-activity.html
  private/admin-alerts.html
  private/admin-csv-upload.html
  private/admin-dashboard.html
  private/admin-editorial-review.html
  private/admin-homepage-management.html
  private/admin-monitoring.html
  private/admin-monitoring-updates.html
  private/admin-monitoring-activity.html
  private/admin-page-manager.html
  private/admin-recruitment-review-queue.html
  private/admin-recruitment-runtime-preview.html
  private/admin-recruitment-testing.html
  private/admin-recruitments.html
  private/admin-seo-diagnostics.html
  private/admin-sessions.html
  private/generator.html
  scripts/_acc_admin_btn_ui_prod_deploy.sh
)

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="/root/backups/acc_admin_btn_ui_${TS}"
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
  public/assets/css/admin/admin-design-system.css \
  public/assets/css/admin/automation-control-center.css \
  public/assets/js/admin-automation-control-center.js \
  private/admin-automation-sources.html \
  private/admin-dashboard.html \
  private/generator.html

NODE_ENV=production node - <<'NODE'
const f = require("./server/config/automationFlags");
const g = f.getAutomationFlags();
const report = {
  RECRUITMENT_PIPELINE_ENABLED: g.RECRUITMENT_PIPELINE_ENABLED,
  AUTO_DRAFT_ENABLED: g.AUTO_DRAFT_ENABLED,
  AUTO_PUBLISH_ENABLED: g.AUTO_PUBLISH_ENABLED,
  LIVE_CRAWLER_ENABLED: g.LIVE_CRAWLER_ENABLED,
  TELEGRAM_DELIVERY_ENABLED: g.TELEGRAM_DELIVERY_ENABLED,
  NOTIFICATION_GATEWAY_ENABLED: g.NOTIFICATION_GATEWAY_ENABLED,
  dormant: f.isAutomationDormant(),
  blocked: f.isAutoPublishBlocked()
};
console.log(JSON.stringify(report));
const mustBeOff = [
  "RECRUITMENT_PIPELINE_ENABLED",
  "AUTO_DRAFT_ENABLED",
  "AUTO_PUBLISH_ENABLED",
  "LIVE_CRAWLER_ENABLED",
  "TELEGRAM_DELIVERY_ENABLED",
  "NOTIFICATION_GATEWAY_ENABLED"
];
for (const key of mustBeOff) {
  if (g[key] === true) {
    console.error("REFUSING: " + key + " unexpectedly true");
    process.exit(2);
  }
}
NODE

# Static safety: no enable-automation controls introduced
node - <<'NODE'
const fs = require("fs");
const paths = [
  "public/assets/css/admin/admin-design-system.css",
  "public/assets/css/admin/automation-control-center.css",
  "public/assets/js/admin-automation-control-center.js",
  "private/admin-automation-control-center.html",
  "private/admin-automation-sources.html",
  "private/generator.html"
];
for (const p of paths) {
  const t = fs.readFileSync(p, "utf8");
  if (/enableAutoPublish|turnOnAutomation|AUTO_PUBLISH_ENABLED\s*=\s*true/i.test(t)) {
    console.error("REFUSING: unsafe automation enable pattern in", p);
    process.exit(2);
  }
}
const gen = fs.readFileSync("private/generator.html", "utf8");
if (!/admin-design-system\.css\?v=21/.test(gen)) {
  console.error("REFUSING: generator.html missing design-system v=21 cache bust");
  process.exit(2);
}
if (/generatorContextExtraction|generator\.js\?v=19/.test(gen)) {
  console.error("REFUSING: generator.html contains unrelated ownership/js hunks");
  process.exit(2);
}
console.log("STATIC_SAFETY_OK");
NODE

pm2 reload ecosystem.config.js --update-env || pm2 restart all
sleep 3
pm2 status
nginx -t && systemctl reload nginx || true

curl -sS -o /dev/null -w "health=%{http_code}\n" http://127.0.0.1:3000/health || true
curl -sS -o /dev/null -w "ready=%{http_code}\n" http://127.0.0.1:3000/ready || true
curl -sS -o /dev/null -w "login=%{http_code}\n" http://127.0.0.1:3000/login || true
curl -sS -o /dev/null -w "home=%{http_code}\n" http://127.0.0.1:3000/ || true

echo "DEPLOY_OK sha=$SHA backup=$BACKUP"
