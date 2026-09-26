#!/usr/bin/env bash
# Selective production deploy: Review Queue exclusive list/detail workspace.
# Presentation/UI only. No schema. No automation enable. Tests not required on VPS.
# Usage on VPS: ACC_DEPLOY_SHA=<sha> bash scripts/_rrq_list_detail_prod_deploy.sh
set -euo pipefail

ROOT="${1:-/root/sarkari-suchna-india}"
SHA="${ACC_DEPLOY_SHA:?ACC_DEPLOY_SHA required}"
cd "$ROOT"

FILES=(
  private/admin-recruitment-review-queue.html
  public/assets/js/admin-recruitment-review-queue.js
  public/assets/css/admin/recruitment-review-queue.css
  public/assets/css/admin/admin-workspace-polish.css
  scripts/_rrq_list_detail_prod_deploy.sh
)

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="/root/backups/rrq_list_detail_${TS}"
mkdir -p "$BACKUP"
echo "BACKUP=$BACKUP"
echo "PREV_HEAD=$(git rev-parse HEAD)"
echo "PREV_STATUS=$(git status -sb | head -n 8)"

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
NODE_ENV=production node <<'NODE'
const f = require("./server/config/automationFlags");
const g = f.getAutomationFlags();
const out = {
  AUTO_PUBLISH_ENABLED: g.AUTO_PUBLISH_ENABLED,
  AUTO_DRAFT_ENABLED: g.AUTO_DRAFT_ENABLED,
  LIVE_CRAWLER_ENABLED: g.LIVE_CRAWLER_ENABLED,
  PRODUCTION_MONITORING_ENABLED: g.PRODUCTION_MONITORING_ENABLED,
  RECRUITMENT_PIPELINE_ENABLED: g.RECRUITMENT_PIPELINE_ENABLED,
  SCHEDULER_ACTIVATION_ENABLED: g.SCHEDULER_ACTIVATION_ENABLED,
  TELEGRAM_DELIVERY_ENABLED: g.TELEGRAM_DELIVERY_ENABLED,
  NOTIFICATION_GATEWAY_ENABLED: g.NOTIFICATION_GATEWAY_ENABLED,
  WORKER_ACTIVATION_ENABLED: g.WORKER_ACTIVATION_ENABLED,
  dormant: f.isAutomationDormant(),
  blocked: f.isAutoPublishBlocked()
};
console.log(JSON.stringify(out));
for (const key of [
  "AUTO_PUBLISH_ENABLED",
  "AUTO_DRAFT_ENABLED",
  "LIVE_CRAWLER_ENABLED",
  "PRODUCTION_MONITORING_ENABLED",
  "SCHEDULER_ACTIVATION_ENABLED",
  "TELEGRAM_DELIVERY_ENABLED",
  "NOTIFICATION_GATEWAY_ENABLED",
  "WORKER_ACTIVATION_ENABLED"
]) {
  if (g[key] === true) {
    console.error("REFUSING: unexpected true BEFORE deploy:", key);
    process.exit(2);
  }
}
NODE

git fetch origin main
git checkout "$SHA" -- "${FILES[@]}"
echo "CHECKOUT_DONE sha=$SHA"
echo "AFTER_HEAD=$(git rev-parse HEAD)"

echo "LOCAL_BLOBS"
git hash-object \
  private/admin-recruitment-review-queue.html \
  public/assets/js/admin-recruitment-review-queue.js \
  public/assets/css/admin/recruitment-review-queue.css \
  public/assets/css/admin/admin-workspace-polish.css

echo "FLAGS_AFTER_CHECKOUT"
NODE_ENV=production node <<'NODE'
const f = require("./server/config/automationFlags");
const g = f.getAutomationFlags();
console.log(JSON.stringify({
  AUTO_PUBLISH_ENABLED: g.AUTO_PUBLISH_ENABLED,
  LIVE_CRAWLER_ENABLED: g.LIVE_CRAWLER_ENABLED,
  PRODUCTION_MONITORING_ENABLED: g.PRODUCTION_MONITORING_ENABLED,
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

node <<'NODE'
const fs = require("fs");
const html = fs.readFileSync("private/admin-recruitment-review-queue.html", "utf8");
const js = fs.readFileSync("public/assets/js/admin-recruitment-review-queue.js", "utf8");
const css = fs.readFileSync("public/assets/css/admin/recruitment-review-queue.css", "utf8");
const polish = fs.readFileSync("public/assets/css/admin/admin-workspace-polish.css", "utf8");

if (!html.includes("recruitment-review-queue.css?v=14")) throw new Error("html missing css?v=14");
if (!html.includes("admin-recruitment-review-queue.js?v=14")) throw new Error("html missing js?v=14");
if (!html.includes("admin-workspace-polish.css?v=5")) throw new Error("html missing polish?v=5");
if (!html.includes("rrq-layout--list-only")) throw new Error("html missing list-only layout class");
if (!html.includes("← Back to Review Queue")) throw new Error("html missing Back to Review Queue");
if (!js.includes("function syncListDetailChrome")) throw new Error("js missing syncListDetailChrome");
if (!js.includes("function syncReviewUrl")) throw new Error("js missing syncReviewUrl");
if (!js.includes("function closeReviewDetail")) throw new Error("js missing closeReviewDetail");
if (!js.includes("rrq-layout--detail-only")) throw new Error("js missing detail-only class toggle");
if (!css.includes(".rrq-layout.rrq-layout--detail-only")) throw new Error("css missing detail-only");
if (!css.includes("body.rrq-detail-active")) throw new Error("css missing rrq-detail-active");
if (!polish.includes(".rrq-layout.rrq-layout--detail-only")) throw new Error("polish missing detail-only");
if (/AUTO_PUBLISH_ENABLED\s*=\s*true/.test(js)) throw new Error("refusing AUTO_PUBLISH enable in RRQ JS");
console.log("DEPLOY_FILE_CONTRACT_OK");
NODE

pm2 reload ecosystem.config.js --update-env || pm2 restart all
sleep 2
pm2 status
nginx -t && systemctl reload nginx || true

echo "HEALTH"
curl -sS -o /dev/null -w "health=%{http_code}\n" http://127.0.0.1:3000/health || true
curl -sS -o /dev/null -w "ready=%{http_code}\n" http://127.0.0.1:3000/ready || true
curl -sS -o /dev/null -w "login=%{http_code}\n" http://127.0.0.1:3000/login || true
curl -sS -o /dev/null -w "rrq=%{http_code}\n" http://127.0.0.1:3000/admin/recruitment-review-queue || true

echo "ASSET_VERSION_PROBE"
curl -sS http://127.0.0.1:3000/login >/dev/null || true
# HTML behind auth usually redirects; probe static assets directly
curl -sS -o /dev/null -w "css14=%{http_code}\n" "http://127.0.0.1:3000/css/admin/recruitment-review-queue.css?v=14" || true
curl -sS -o /dev/null -w "js14=%{http_code}\n" "http://127.0.0.1:3000/js/admin-recruitment-review-queue.js?v=14" || true
curl -sS -o /dev/null -w "polish5=%{http_code}\n" "http://127.0.0.1:3000/css/admin/admin-workspace-polish.css?v=5" || true

echo "CONTENT_PROBE"
curl -sS "http://127.0.0.1:3000/js/admin-recruitment-review-queue.js?v=14" | grep -c "syncListDetailChrome" || true
curl -sS "http://127.0.0.1:3000/css/admin/recruitment-review-queue.css?v=14" | grep -c "rrq-layout--detail-only" || true

echo "DEPLOY_DONE sha=$SHA backup=$BACKUP"
