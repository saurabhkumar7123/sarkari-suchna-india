#!/usr/bin/env bash
# Selective production deploy: full approved Admin/Generator UI state.
# Usage: FULL_UI_DEPLOY_SHA=<sha> bash scripts/_full_approved_admin_generator_ui_prod_deploy.sh
set -euo pipefail

ROOT="${1:-/root/sarkari-suchna-india}"
SHA="${FULL_UI_DEPLOY_SHA:?FULL_UI_DEPLOY_SHA required}"
cd "$ROOT"

FILES=(
  public/assets/css/admin/admin-design-system.css
  public/assets/css/admin/generator-saas.css
  public/assets/css/admin/admin-sidebar.css
  public/assets/css/admin/dashboard.css
  public/assets/js/admin-generator-drafts.js
  public/assets/js/admin-generator-ui.js
  public/assets/js/generator-workspace.js
  public/assets/js/admin-dashboard.js
  public/assets/js/admin-seo-diagnostics.js
  private/admin-activity.html
  private/admin-alerts.html
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
  private/admin-csv-upload.html
  private/admin-dashboard.html
  private/admin-editorial-review.html
  private/admin-homepage-management.html
  private/admin-monitoring.html
  private/admin-monitoring-activity.html
  private/admin-monitoring-updates.html
  private/admin-page-manager.html
  private/admin-recruitment-review-queue.html
  private/admin-recruitment-runtime-preview.html
  private/admin-recruitment-testing.html
  private/admin-recruitments.html
  private/admin-seo-diagnostics.html
  private/admin-sessions.html
  private/dashboard.html
  private/generator.html
  private/trash.html
  private/upload.html
  scripts/_full_approved_admin_generator_ui_prod_deploy.sh
)

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="/root/backups/full_approved_admin_generator_ui_${TS}"
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
  public/assets/css/admin/admin-design-system.css \
  public/assets/css/admin/generator-saas.css \
  public/assets/js/admin-generator-ui.js \
  public/assets/js/admin-generator-drafts.js \
  private/generator.html \
  private/admin-dashboard.html \
  private/admin-seo-diagnostics.html

NODE_ENV=production node - <<'NODE'
const f = require("./server/config/automationFlags");
const g = f.getAutomationFlags();
console.log(JSON.stringify({
  RECRUITMENT_PIPELINE_ENABLED: g.RECRUITMENT_PIPELINE_ENABLED,
  AUTO_DRAFT_ENABLED: g.AUTO_DRAFT_ENABLED,
  AUTO_PUBLISH_ENABLED: g.AUTO_PUBLISH_ENABLED,
  LIVE_CRAWLER_ENABLED: g.LIVE_CRAWLER_ENABLED,
  TELEGRAM_DELIVERY_ENABLED: g.TELEGRAM_DELIVERY_ENABLED,
  NOTIFICATION_GATEWAY_ENABLED: g.NOTIFICATION_GATEWAY_ENABLED,
  dormant: f.isAutomationDormant(),
  blocked: f.isAutoPublishBlocked()
}));
for (const key of [
  "RECRUITMENT_PIPELINE_ENABLED","AUTO_DRAFT_ENABLED","AUTO_PUBLISH_ENABLED",
  "LIVE_CRAWLER_ENABLED","TELEGRAM_DELIVERY_ENABLED","NOTIFICATION_GATEWAY_ENABLED"
]) {
  if (g[key] === true) { console.error("REFUSING", key); process.exit(2); }
}
NODE

node - <<'NODE'
const fs = require("fs");
const paths = [
  "private/generator.html",
  "public/assets/js/admin-generator-ui.js",
  "public/assets/css/admin/admin-design-system.css",
  "public/assets/css/admin/generator-saas.css",
  "private/admin-dashboard.html",
  "private/admin-seo-diagnostics.html"
];
for (const p of paths) {
  const t = fs.readFileSync(p, "utf8");
  if (/enableAutoPublish|turnOnAutomation|AUTO_PUBLISH_ENABLED\s*=\s*true/i.test(t)) {
    console.error("REFUSING unsafe pattern", p); process.exit(2);
  }
}
const gen = fs.readFileSync("private/generator.html", "utf8");
if (!/pageSearchPanel/.test(gen)) { console.error("missing search panel"); process.exit(2); }
if (/dashboard-jump-row|quickCreateDraftCard/.test(fs.readFileSync("private/admin-dashboard.html","utf8"))) {
  console.error("dashboard quick actions still present"); process.exit(2);
}
if (!/featureCompletionReport" hidden/.test(fs.readFileSync("private/admin-seo-diagnostics.html","utf8"))) {
  console.error("feature completion not hidden"); process.exit(2);
}
const ui = fs.readFileSync("public/assets/js/admin-generator-ui.js", "utf8");
if (/Draft saved locally/.test(ui)) { console.error("Draft saved locally still present"); process.exit(2); }
const ds = fs.readFileSync("public/assets/css/admin/admin-design-system.css", "utf8");
if (!/data-admin-hash="drafts"\][\s\S]*#savePageBtn/.test(ds)) {
  console.error("Manual Publish drafts hide missing"); process.exit(2);
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
