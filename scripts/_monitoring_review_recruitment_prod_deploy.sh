#!/usr/bin/env bash
# Selective production deploy: Monitoring → Review → Recruitment workflow.
# Open Review deep-link, ensure-from-update, freeze/unfreeze, reject notes,
# Approve ≠ Publish (Human Publish mandatory). No schema. No automation enable.
# Usage on VPS: ACC_DEPLOY_SHA=<sha> bash scripts/_monitoring_review_recruitment_prod_deploy.sh
set -euo pipefail

ROOT="${1:-/root/sarkari-suchna-india}"
SHA="${ACC_DEPLOY_SHA:?ACC_DEPLOY_SHA required}"
cd "$ROOT"

FILES=(
  private/admin-monitoring.html
  private/admin-monitoring-updates.html
  private/admin-monitoring-activity.html
  private/admin-recruitment-review-queue.html
  public/assets/js/admin-monitoring.js
  public/assets/js/admin-recruitment-review-queue.js
  public/assets/css/admin/recruitment-review-queue.css
  server/api/admin/recruitmentReviewQueue.routes.js
  server/controllers/admin/recruitmentReviewQueue.controller.js
  server/controllers/admin/updates.controller.js
  server/services/recruitmentReview.service.js
  server/services/recruitmentLifecycle.service.js
  server/repositories/recruitmentReview.repository.js
  server/validations/admin.validation.js
  server/lib/recruitment/reviewComparison.js
  tests/reviewComparison.test.js
  tests/monitoringReviewWorkflow.e2eWiring.test.js
  scripts/_monitoring_review_recruitment_prod_deploy.sh
)

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="/root/backups/monitoring_review_recruitment_${TS}"
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

echo "FLAGS_BEFORE"
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
  console.error("REFUSING: AUTO_PUBLISH_ENABLED unexpectedly true BEFORE deploy");
  process.exit(2);
}
if (g.LIVE_CRAWLER_ENABLED === true || g.PRODUCTION_MONITORING_ENABLED === true) {
  console.error("REFUSING: monitoring crawler flags unexpectedly true BEFORE deploy");
  process.exit(2);
}
NODE

git fetch origin main
git checkout "$SHA" -- "${FILES[@]}"
echo "CHECKOUT_DONE sha=$SHA"

echo "LOCAL_BLOBS"
git hash-object \
  private/admin-monitoring.html \
  public/assets/js/admin-monitoring.js \
  private/admin-recruitment-review-queue.html \
  public/assets/js/admin-recruitment-review-queue.js \
  server/services/recruitmentReview.service.js \
  server/controllers/admin/recruitmentReviewQueue.controller.js \
  server/api/admin/recruitmentReviewQueue.routes.js

echo "FLAGS_AFTER_CHECKOUT"
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
  console.error("REFUSING: AUTO_PUBLISH_ENABLED unexpectedly true AFTER checkout");
  process.exit(2);
}
if (g.LIVE_CRAWLER_ENABLED === true || g.PRODUCTION_MONITORING_ENABLED === true) {
  console.error("REFUSING: monitoring crawler flags unexpectedly true AFTER checkout");
  process.exit(2);
}
NODE

# Ensure no enable-automation controls were introduced in deployed HTML/JS
node - <<'NODE'
const fs = require("fs");
const paths = [
  "public/assets/js/admin-monitoring.js",
  "public/assets/js/admin-recruitment-review-queue.js",
  "private/admin-recruitment-review-queue.html",
  "private/admin-monitoring.html"
];
for (const p of paths) {
  const t = fs.readFileSync(p, "utf8");
  if (/enableAutoPublish|turnOnAutomation|AUTO_PUBLISH_ENABLED\s*=\s*true/i.test(t)) {
    console.error("REFUSING: unsafe automation enable pattern in", p);
    process.exit(2);
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
