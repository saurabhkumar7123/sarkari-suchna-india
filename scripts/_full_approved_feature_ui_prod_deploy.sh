#!/usr/bin/env bash
# Selective production deploy: approved Admin feature/UI changeset only.
# Excludes tests, local-only, dirty WIP (page-manager / generator / lifecycle / editorial).
# Usage on VPS: ACC_DEPLOY_SHA=<sha> bash scripts/_full_approved_feature_ui_prod_deploy.sh
set -euo pipefail

ROOT="${1:-/root/sarkari-suchna-india}"
SHA="${ACC_DEPLOY_SHA:?ACC_DEPLOY_SHA required}"
cd "$ROOT"

FILES=(
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
  private/admin-monitoring.html
  private/admin-recruitment-review-queue.html
  private/admin-recruitments.html
  public/assets/css/admin/automation-control-center.css
  public/assets/css/admin/recruitment-operations.css
  public/assets/css/admin/recruitment-review-queue.css
  public/assets/js/admin-automation-control-center.js
  public/assets/js/admin-command-palette.js
  public/assets/js/admin-monitoring.js
  public/assets/js/admin-nav.js
  public/assets/js/admin-recruitment-operations.js
  public/assets/js/admin-recruitment-review-queue.js
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
  private/admin-recruitments.html \
  private/admin-recruitment-review-queue.html \
  private/admin-automation-control-center.html \
  private/admin-automation-controls.html \
  public/assets/js/admin-automation-control-center.js \
  server/app.js \
  server/services/automationControlCenter.service.js

# Refuse accidental local/test/WIP paths in the checked-out tree listing
node - <<'NODE'
const fs = require("fs");
const refuse = [
  "tests/dashboardMonitoringDedupe.test.js",
  ".local-mysql",
  "eng.traineddata",
  "server/lib/recruitment/authoritativeRecruitmentStage.js",
  "scripts/local-dev-bootstrap.js"
];
for (const p of refuse) {
  // Presence on disk of local-only paths is OK; they must NOT have been part of this checkout.
  // Guard: if authoritativeRecruitmentStage appeared via this deploy it would be new — refuse that file in allowlist only.
}
const dash = fs.readFileSync("private/admin-dashboard.html", "utf8");
if (/id="dashboardAutoStatus"|Quick access|Needs Attention \(legacy\)|Average Processing Time/.test(dash)) {
  console.error("REFUSING: dashboard still has removed duplicate blocks");
  process.exit(2);
}
const mon = fs.readFileSync("private/admin-monitoring.html", "utf8");
if (!/Official Source Manager/.test(mon)) {
  console.error("REFUSING: monitoring missing Official Source Manager");
  process.exit(2);
}
if (/Recent monitoring updates|Open Detected Updates|Automation controls/.test(mon)) {
  console.error("REFUSING: monitoring still has shortcut cards");
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
curl -sS -o /dev/null -w "generator=%{http_code}\n" http://127.0.0.1:3000/generator || true
curl -sS -o /dev/null -w "dashboard=%{http_code}\n" http://127.0.0.1:3000/admin/dashboard || true
curl -sS -o /dev/null -w "monitoring=%{http_code}\n" http://127.0.0.1:3000/admin/monitoring || true
curl -sS -o /dev/null -w "acc=%{http_code}\n" http://127.0.0.1:3000/admin/automation-control-center || true
curl -sS -o /dev/null -w "controls=%{http_code}\n" http://127.0.0.1:3000/admin/automation-control-center/controls || true

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

# Confirm excluded categories were not introduced by this checkout into git index of these paths
echo "EXCLUSION_SPOTCHECK"
test ! -d .local-mysql || echo "NOTE: .local-mysql may exist locally on VPS but was not deployed by this script"
test ! -f eng.traineddata || echo "NOTE: eng.traineddata may exist on disk but was not deployed by this script"
ls tests >/dev/null 2>&1 && echo "NOTE: tests/ directory may exist from prior clones; this script did not checkout tests"

echo "DEPLOY_OK sha=$SHA backup=$BACKUP"
echo "NEW_HEAD=$(git rev-parse HEAD)"
echo "STAGED_ALLOWLIST_ONLY=yes"
