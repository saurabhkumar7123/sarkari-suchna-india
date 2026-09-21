#!/usr/bin/env bash
# Selective production deploy: Review Queue decision-tree state persistence + UX hardening.
# Approve ≠ Publish. No schema. No automation enable.
# Usage on VPS: ACC_DEPLOY_SHA=<sha> bash scripts/_rrq_decision_tree_state_prod_deploy.sh
set -euo pipefail

ROOT="${1:-/root/sarkari-suchna-india}"
SHA="${ACC_DEPLOY_SHA:?ACC_DEPLOY_SHA required}"
cd "$ROOT"

FILES=(
  private/admin-recruitment-review-queue.html
  private/admin-monitoring.html
  private/admin-monitoring-updates.html
  private/admin-monitoring-activity.html
  public/assets/js/admin-recruitment-review-queue.js
  public/assets/js/admin-rrq-workflow-state.js
  public/assets/js/admin-monitoring.js
  public/assets/css/admin/recruitment-review-queue.css
  server/controllers/admin/recruitmentReviewQueue.controller.js
  server/controllers/public/misc.controller.js
  tests/rrqWorkflowState.test.js
  tests/reviewQueue.decisionTree.hardening.test.js
  tests/combinedPreview.updateWorkflow.static.test.js
  scripts/_rrq_decision_tree_state_prod_deploy.sh
)

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="/root/backups/rrq_decision_tree_state_${TS}"
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
  AUTO_DRAFT_ENABLED: g.AUTO_DRAFT_ENABLED,
  LIVE_CRAWLER_ENABLED: g.LIVE_CRAWLER_ENABLED,
  PRODUCTION_MONITORING_ENABLED: g.PRODUCTION_MONITORING_ENABLED,
  RECRUITMENT_PIPELINE_ENABLED: g.RECRUITMENT_PIPELINE_ENABLED,
  SCHEDULER_ACTIVATION_ENABLED: g.SCHEDULER_ACTIVATION_ENABLED,
  TELEGRAM_DELIVERY_ENABLED: g.TELEGRAM_DELIVERY_ENABLED,
  dormant: f.isAutomationDormant(),
  blocked: f.isAutoPublishBlocked()
}));
if (g.AUTO_PUBLISH_ENABLED === true) {
  console.error("REFUSING: AUTO_PUBLISH_ENABLED unexpectedly true BEFORE deploy");
  process.exit(2);
}
NODE

git fetch origin main
git checkout "$SHA" -- "${FILES[@]}"
echo "CHECKOUT_DONE sha=$SHA"

echo "LOCAL_BLOBS"
git hash-object \
  private/admin-recruitment-review-queue.html \
  public/assets/js/admin-recruitment-review-queue.js \
  public/assets/js/admin-rrq-workflow-state.js \
  public/assets/css/admin/recruitment-review-queue.css \
  server/controllers/admin/recruitmentReviewQueue.controller.js \
  server/controllers/public/misc.controller.js

echo "FLAGS_AFTER_CHECKOUT"
NODE_ENV=production node - <<'NODE'
const f = require("./server/config/automationFlags");
const g = f.getAutomationFlags();
console.log(JSON.stringify({
  AUTO_PUBLISH_ENABLED: g.AUTO_PUBLISH_ENABLED,
  AUTO_DRAFT_ENABLED: g.AUTO_DRAFT_ENABLED,
  LIVE_CRAWLER_ENABLED: g.LIVE_CRAWLER_ENABLED,
  PRODUCTION_MONITORING_ENABLED: g.PRODUCTION_MONITORING_ENABLED,
  RECRUITMENT_PIPELINE_ENABLED: g.RECRUITMENT_PIPELINE_ENABLED,
  SCHEDULER_ACTIVATION_ENABLED: g.SCHEDULER_ACTIVATION_ENABLED,
  TELEGRAM_DELIVERY_ENABLED: g.TELEGRAM_DELIVERY_ENABLED,
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

node - <<'NODE'
const fs = require("fs");
const js = fs.readFileSync("public/assets/js/admin-recruitment-review-queue.js", "utf8");
const state = fs.readFileSync("public/assets/js/admin-rrq-workflow-state.js", "utf8");
const html = fs.readFileSync("private/admin-recruitment-review-queue.html", "utf8");
if (!html.includes("admin-rrq-workflow-state.js")) throw new Error("missing workflow-state script tag");
if (!js.includes("persistMatchIntent") || !js.includes("restoreMatchIntentForItem")) {
  throw new Error("missing match-intent persistence");
}
if (!state.includes("resolvePhase") || !state.includes("match_intent")) {
  throw new Error("workflow-state helper incomplete");
}
if (/AUTO_PUBLISH_ENABLED\s*=\s*true/.test(js)) throw new Error("refusing AUTO_PUBLISH enable in RRQ JS");
console.log("DEPLOY_FILE_CONTRACT_OK");
NODE

pm2 reload ecosystem.config.js --update-env || pm2 restart all
pm2 status

echo "HEALTH"
curl -sS -o /dev/null -w "health=%{http_code}\n" http://127.0.0.1:3000/health || true
curl -sS -o /dev/null -w "ready=%{http_code}\n" http://127.0.0.1:3000/ready || true
curl -sS -o /dev/null -w "root=%{http_code}\n" http://127.0.0.1:3000/ || true
curl -sS -o /dev/null -w "login=%{http_code}\n" http://127.0.0.1:3000/login || true

echo "DEPLOY_DONE sha=$SHA backup=$BACKUP"
