#!/usr/bin/env bash
# Selective production deploy: approved Admin feature/UI polish (Dashboard → ACC + polish pages).
# Excludes tests, local-only, generator/lifecycle/page-controller WIP, package.json, .env.example.
# Usage on VPS: ACC_DEPLOY_SHA=<sha> bash scripts/_full_approved_feature_ui_prod_deploy.sh
set -euo pipefail

ROOT="${1:-/root/sarkari-suchna-india}"
SHA="${ACC_DEPLOY_SHA:?ACC_DEPLOY_SHA required}"
cd "$ROOT"

FILES=(
  # ACC shell + pages (prior approved consolidation)
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
  private/admin-dashboard.html
  # Monitoring + Detected Updates + Activity hosts
  private/admin-monitoring.html
  private/admin-monitoring-updates.html
  # Recruitments / RRQ / Editorial / Page Manager
  private/admin-recruitments.html
  private/admin-recruitment-review-queue.html
  private/admin-editorial-review.html
  private/admin-page-manager.html
  # Shared + page CSS
  public/assets/css/admin/admin-workspace-polish.css
  public/assets/css/admin/automation-control-center.css
  public/assets/css/admin/editorial-review.css
  public/assets/css/admin/recruitment-module.css
  public/assets/css/admin/recruitment-operations.css
  public/assets/css/admin/recruitment-review-queue.css
  # Admin JS (presentation + ID convention)
  public/assets/js/admin-automation-control-center.js
  public/assets/js/admin-command-palette.js
  public/assets/js/admin-monitoring.js
  public/assets/js/admin-nav.js
  public/assets/js/admin-recruitment-operations.js
  public/assets/js/admin-recruitment-review-queue.js
  public/assets/js/admin-editorial-review.js
  public/assets/js/admin-page-manager.js
  public/assets/js/admin-generator-drafts.js
  public/assets/js/admin-shared-preview.js
  public/assets/js/admin-recruitment-runtime-preview.js
  # Backend support already approved for ACC sources → monitoring
  server/app.js
  server/controllers/admin/automationControlCenter.controller.js
  server/services/automationControlCenter.service.js
  server/validations/admin.validation.js
  scripts/_full_approved_feature_ui_prod_deploy.sh
)

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="/root/backups/full_approved_feature_ui_${TS}"
mkdir -p "$BACKUP"
echo "BACKUP=$BACKUP"
echo "PREV_HEAD=$(git rev-parse HEAD)"
echo "PREV_STATUS=$(git status -sb | head -n 5)"

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

echo "FLAGS_BEFORE"
NODE_ENV=production node - <<'NODE'
const f = require("./server/config/automationFlags");
const g = f.getAutomationFlags();
const out = {
  RECRUITMENT_PIPELINE_ENABLED: g.RECRUITMENT_PIPELINE_ENABLED,
  AUTO_DRAFT_ENABLED: g.AUTO_DRAFT_ENABLED,
  AUTO_PUBLISH_ENABLED: g.AUTO_PUBLISH_ENABLED,
  TELEGRAM_DELIVERY_ENABLED: g.TELEGRAM_DELIVERY_ENABLED,
  LIVE_CRAWLER_ENABLED: g.LIVE_CRAWLER_ENABLED,
  NOTIFICATION_GATEWAY_ENABLED: g.NOTIFICATION_GATEWAY_ENABLED,
  PRODUCTION_MONITORING_ENABLED: g.PRODUCTION_MONITORING_ENABLED,
  SCHEDULER_ACTIVATION_ENABLED: g.SCHEDULER_ACTIVATION_ENABLED,
  WORKER_ACTIVATION_ENABLED: g.WORKER_ACTIVATION_ENABLED,
  dormant: f.isAutomationDormant(),
  blocked: f.isAutoPublishBlocked()
};
console.log(JSON.stringify(out));
for (const key of [
  "AUTO_PUBLISH_ENABLED","AUTO_DRAFT_ENABLED","LIVE_CRAWLER_ENABLED",
  "PRODUCTION_MONITORING_ENABLED","SCHEDULER_ACTIVATION_ENABLED",
  "TELEGRAM_DELIVERY_ENABLED","NOTIFICATION_GATEWAY_ENABLED","WORKER_ACTIVATION_ENABLED"
]) {
  if (g[key] === true) {
    console.error("REFUSING: unexpected true BEFORE deploy:", key);
    process.exit(2);
  }
}
if (g.AUTO_PUBLISH_ENABLED === true || f.isAutoPublishBlocked() !== true) {
  console.error("REFUSING: Auto Publish not locked BEFORE deploy");
  process.exit(2);
}
NODE

git fetch origin main
git checkout "$SHA" -- "${FILES[@]}"
echo "CHECKOUT_DONE sha=$SHA"

echo "LOCAL_BLOBS"
git hash-object \
  private/admin-dashboard.html \
  private/admin-monitoring.html \
  private/admin-monitoring-updates.html \
  private/admin-recruitments.html \
  private/admin-recruitment-review-queue.html \
  private/admin-editorial-review.html \
  private/admin-page-manager.html \
  public/assets/css/admin/admin-workspace-polish.css \
  public/assets/js/admin-automation-control-center.js \
  public/assets/js/admin-monitoring.js \
  public/assets/js/admin-recruitment-review-queue.js \
  public/assets/js/admin-editorial-review.js \
  public/assets/js/admin-page-manager.js \
  server/app.js

node - <<'NODE'
const fs = require("fs");
const dash = fs.readFileSync("private/admin-dashboard.html", "utf8");
if (/id="dashboardAutoStatus"|Quick access|Needs Attention \(legacy\)|Average Processing Time/.test(dash)) {
  console.error("REFUSING: dashboard still has removed duplicate blocks");
  process.exit(2);
}
const mon = fs.readFileSync("private/admin-monitoring.html", "utf8");
if (!/Official Source Manager/.test(mon) || !/admin-workspace-polish\.css/.test(mon)) {
  console.error("REFUSING: monitoring missing Source Manager or polish CSS");
  process.exit(2);
}
if (/Runtime: Dormant|Activation: NO-GO|Refresh ops/.test(mon)) {
  console.error("REFUSING: monitoring still has Runtime/Activation/Refresh ops");
  process.exit(2);
}
const accJs = fs.readFileSync("public/assets/js/admin-automation-control-center.js", "utf8");
if (!/Site ID/.test(accJs) || !/mon-source-card/.test(accJs)) {
  console.error("REFUSING: ACC sources missing Site ID card layout");
  process.exit(2);
}
const monJs = fs.readFileSync("public/assets/js/admin-monitoring.js", "utf8");
if (!/Update ID:/.test(monJs) || !/>Site<\/a>/.test(monJs)) {
  console.error("REFUSING: Detected Updates identity UI markers missing");
  process.exit(2);
}
if (/Update #\$\{/.test(monJs) || /Open Official Site/.test(monJs)) {
  console.error("REFUSING: Detected Updates still has hash IDs or raw open-site label");
  process.exit(2);
}
const app = fs.readFileSync("server/app.js", "utf8");
if (!/automation-control-center\/sources/.test(app) || !/redirect\(302, "\/admin\/monitoring"\)/.test(app)) {
  console.error("REFUSING: ACC sources redirect missing");
  process.exit(2);
}
const rec = fs.readFileSync("private/admin-recruitments.html", "utf8");
if (!/Recruitment ID/.test(rec) || !/romAccordionGroup|data-rom-accordion/.test(rec)) {
  console.error("REFUSING: recruitments ID/accordion markers missing");
  process.exit(2);
}
const rrq = fs.readFileSync("private/admin-recruitment-review-queue.html", "utf8");
if (!/<th>Review ID<\/th>/.test(rrq) || !/<th>Update ID<\/th>/.test(rrq)) {
  console.error("REFUSING: RRQ missing Review/Update ID columns");
  process.exit(2);
}
const er = fs.readFileSync("private/admin-editorial-review.html", "utf8");
if (/Select a review item/.test(er)) {
  console.error("REFUSING: editorial still has Select a review item");
  process.exit(2);
}
const pm = fs.readFileSync("private/admin-page-manager.html", "utf8");
if (!/admin-workspace-polish\.css/.test(pm)) {
  console.error("REFUSING: page-manager missing polish CSS");
  process.exit(2);
}
const pmJs = fs.readFileSync("public/assets/js/admin-page-manager.js", "utf8");
if (!/Page ID:/.test(pmJs) || /Page #\$\{/.test(pmJs)) {
  console.error("REFUSING: page-manager Page ID convention missing");
  process.exit(2);
}
console.log("STATIC_SAFETY_OK");
NODE

echo "FLAGS_AFTER_CHECKOUT"
NODE_ENV=production node - <<'NODE'
const f = require("./server/config/automationFlags");
const g = f.getAutomationFlags();
const out = {
  RECRUITMENT_PIPELINE_ENABLED: g.RECRUITMENT_PIPELINE_ENABLED,
  AUTO_DRAFT_ENABLED: g.AUTO_DRAFT_ENABLED,
  AUTO_PUBLISH_ENABLED: g.AUTO_PUBLISH_ENABLED,
  TELEGRAM_DELIVERY_ENABLED: g.TELEGRAM_DELIVERY_ENABLED,
  LIVE_CRAWLER_ENABLED: g.LIVE_CRAWLER_ENABLED,
  NOTIFICATION_GATEWAY_ENABLED: g.NOTIFICATION_GATEWAY_ENABLED,
  PRODUCTION_MONITORING_ENABLED: g.PRODUCTION_MONITORING_ENABLED,
  SCHEDULER_ACTIVATION_ENABLED: g.SCHEDULER_ACTIVATION_ENABLED,
  WORKER_ACTIVATION_ENABLED: g.WORKER_ACTIVATION_ENABLED,
  dormant: f.isAutomationDormant(),
  blocked: f.isAutoPublishBlocked()
};
console.log(JSON.stringify(out));
for (const key of [
  "AUTO_PUBLISH_ENABLED","AUTO_DRAFT_ENABLED","LIVE_CRAWLER_ENABLED",
  "PRODUCTION_MONITORING_ENABLED","SCHEDULER_ACTIVATION_ENABLED",
  "TELEGRAM_DELIVERY_ENABLED","NOTIFICATION_GATEWAY_ENABLED","WORKER_ACTIVATION_ENABLED"
]) {
  if (g[key] === true) {
    console.error("REFUSING: unexpected true AFTER checkout:", key);
    process.exit(2);
  }
}
if (g.AUTO_PUBLISH_ENABLED === true || f.isAutoPublishBlocked() !== true) {
  console.error("REFUSING: Auto Publish not locked AFTER checkout");
  process.exit(2);
}
NODE

pm2 reload ecosystem.config.js --update-env || pm2 restart all
sleep 3
pm2 status
nginx -t && systemctl reload nginx || true

curl -sS -o /dev/null -w "health=%{http_code}\n" http://127.0.0.1:3000/health || true
curl -sS -o /dev/null -w "ready=%{http_code}\n" http://127.0.0.1:3000/ready || true
curl -sS -o /dev/null -w "home=%{http_code}\n" http://127.0.0.1:3000/ || true
curl -sS -o /dev/null -w "login=%{http_code}\n" http://127.0.0.1:3000/login || true
curl -sS -o /dev/null -w "dashboard=%{http_code}\n" http://127.0.0.1:3000/admin/dashboard || true
curl -sS -o /dev/null -w "monitoring=%{http_code}\n" http://127.0.0.1:3000/admin/monitoring || true
curl -sS -o /dev/null -w "updates=%{http_code}\n" http://127.0.0.1:3000/admin/monitoring/updates || true
curl -sS -o /dev/null -w "recruitments=%{http_code}\n" http://127.0.0.1:3000/admin/recruitments || true
curl -sS -o /dev/null -w "rrq=%{http_code}\n" http://127.0.0.1:3000/admin/recruitment-review-queue || true
curl -sS -o /dev/null -w "editorial=%{http_code}\n" http://127.0.0.1:3000/admin/editorial-review || true
curl -sS -o /dev/null -w "pages=%{http_code}\n" http://127.0.0.1:3000/admin/page-manager || true
curl -sS -o /dev/null -w "acc=%{http_code}\n" http://127.0.0.1:3000/admin/automation-control-center || true
curl -sS -o /dev/null -w "controls=%{http_code}\n" http://127.0.0.1:3000/admin/automation-control-center/controls || true
curl -sS -o /dev/null -w "sources=%{http_code} redirect=%{redirect_url}\n" http://127.0.0.1:3000/admin/automation-control-center/sources || true

echo "FLAGS_AFTER_RELOAD"
NODE_ENV=production node - <<'NODE'
const f = require("./server/config/automationFlags");
const g = f.getAutomationFlags();
console.log(JSON.stringify({
  AUTO_PUBLISH_ENABLED: g.AUTO_PUBLISH_ENABLED,
  AUTO_DRAFT_ENABLED: g.AUTO_DRAFT_ENABLED,
  LIVE_CRAWLER_ENABLED: g.LIVE_CRAWLER_ENABLED,
  PRODUCTION_MONITORING_ENABLED: g.PRODUCTION_MONITORING_ENABLED,
  SCHEDULER_ACTIVATION_ENABLED: g.SCHEDULER_ACTIVATION_ENABLED,
  TELEGRAM_DELIVERY_ENABLED: g.TELEGRAM_DELIVERY_ENABLED,
  NOTIFICATION_GATEWAY_ENABLED: g.NOTIFICATION_GATEWAY_ENABLED,
  WORKER_ACTIVATION_ENABLED: g.WORKER_ACTIVATION_ENABLED,
  dormant: f.isAutomationDormant(),
  blocked: f.isAutoPublishBlocked()
}));
NODE

echo "EXCLUSION_SPOTCHECK"
echo "NOTE: tests/.local-mysql/WIP not in allowlist"
git status -sb | head -n 20 || true

echo "DEPLOY_OK sha=$SHA backup=$BACKUP"
echo "NEW_HEAD=$(git rev-parse HEAD)"
echo "STAGED_ALLOWLIST_ONLY=yes"
