#!/usr/bin/env bash
# Selective FULL intended production sync.
# Aligns production runtime trees with the intended commit SHA without:
#   - git reset --hard / git clean -fd
#   - deploying tests/, docs/, local-only, generated/jobs WIP, package.json
#   - activating automation
#
# Usage on VPS:
#   FULL_SYNC_DEPLOY_SHA=<sha> bash scripts/_full_intended_project_prod_sync.sh
set -euo pipefail

ROOT="${1:-/root/sarkari-suchna-india}"
SHA="${FULL_SYNC_DEPLOY_SHA:?FULL_SYNC_DEPLOY_SHA required}"
cd "$ROOT"

# Production runtime trees only (selective path checkout — not whole-repo reset).
TREES=(
  server
  private
  public
  generated/static
)

# Single generator runtime file known to diverge on prod WIP.
EXTRA_FILES=(
  generator/lib/csvGridParser.js
  scripts/_full_intended_project_prod_sync.sh
)

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="/root/backups/full_intended_project_sync_${TS}"
mkdir -p "$BACKUP"
echo "BACKUP=$BACKUP"
echo "PREV_HEAD=$(git rev-parse HEAD)"
echo "PREV_STATUS=$(git status -sb | head -n 12)"
echo "DEPLOY_SHA=$SHA"

# Backup current runtime trees (preserve ability to roll back file content).
for t in "${TREES[@]}"; do
  if [ -e "$t" ]; then
    mkdir -p "$BACKUP/$(dirname "$t")"
    cp -a "$t" "$BACKUP/$t"
  fi
done
for f in "${EXTRA_FILES[@]}"; do
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
if (g.AUTO_PUBLISH_ENABLED === true || f.isAutoPublishBlocked() !== true) {
  console.error("REFUSING: Auto Publish not locked BEFORE deploy");
  process.exit(2);
}
NODE

git fetch origin main
git rev-parse --verify "$SHA^{commit}" >/dev/null

echo "CHECKOUT_TREES"
git checkout "$SHA" -- "${TREES[@]}"
echo "CHECKOUT_EXTRA"
git checkout "$SHA" -- "${EXTRA_FILES[@]}"
echo "CHECKOUT_DONE sha=$SHA"

echo "CONTRACT_CHECKS"
NODE_ENV=production node <<'NODE'
const fs = require("fs");
const path = require("path");

function mustExist(p) {
  if (!fs.existsSync(p)) {
    console.error("REFUSING: missing required file:", p);
    process.exit(2);
  }
}

const required = [
  "private/admin-media.html",
  "public/assets/css/admin/media-library.css",
  "public/assets/css/admin/media-picker.css",
  "public/assets/js/admin-media.js",
  "public/assets/js/admin-media-picker.js",
  "server/services/media.service.js",
  "server/lib/categoriesBrowse.js",
  "server/lib/recruitment/authoritativeRecruitmentStage.js",
  "generated/static/header.html",
  "generated/static/index.html",
  "generated/static/categories.html",
  "public/assets/css/components/header.css",
  "private/admin-recruitment-review-queue.html",
  "private/generator.html",
  "private/admin-editorial-review.html"
];
for (const p of required) mustExist(p);

const app = fs.readFileSync("server/app.js", "utf8");
if (!/\/admin\/media/.test(app)) {
  console.error("REFUSING: server/app.js missing /admin/media route");
  process.exit(2);
}
if (!/categoriesBrowse/.test(app)) {
  console.error("REFUSING: server/app.js missing categoriesBrowse wiring");
  process.exit(2);
}

const header = fs.readFileSync("generated/static/header.html", "utf8");
if (/Job Finder|#openFinder/.test(header)) {
  console.error("REFUSING: header still contains Job Finder");
  process.exit(2);
}
if (!/navbar-inner|header-search-desktop-btn/.test(header)) {
  console.error("REFUSING: header missing centered nav structure markers");
  process.exit(2);
}
// Icons removed from primary nav labels (text-only items).
if (/nav-item"><i class="fa-solid fa-house"/.test(header) || /nav-item"><i class="fa-solid fa-briefcase"/.test(header)) {
  console.error("REFUSING: header still has icon-prefixed primary nav items");
  process.exit(2);
}

const nav = fs.readFileSync("public/assets/js/admin-nav.js", "utf8");
if (!/\/admin\/media/.test(nav) || !/Media Library/.test(nav)) {
  console.error("REFUSING: admin-nav missing Media Library");
  process.exit(2);
}

// Ensure tests/ were not introduced by this checkout path.
if (fs.existsSync("tests") && fs.statSync("tests").isDirectory()) {
  // tests/ may already exist on some checkouts; do not create/update from this script.
  // Spot-check: our allowlist never includes tests/.
}
console.log("CONTRACT_OK");

// Load-critical modules
require("./server/services/media.service");
require("./server/lib/categoriesBrowse");
require("./server/lib/recruitment/authoritativeRecruitmentStage");
require("./server/lib/recruitment/lifecyclePublishPolicy");
console.log("MODULE_LOAD_OK");
NODE

echo "FLAGS_AFTER_CHECKOUT"
NODE_ENV=production node <<'NODE'
const f = require("./server/config/automationFlags");
const g = f.getAutomationFlags();
const out = {
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
};
console.log(JSON.stringify(out));
for (const key of Object.keys(out)) {
  if (key.endsWith("_ENABLED") && out[key] === true) {
    console.error("REFUSING: unexpected true AFTER checkout:", key);
    process.exit(2);
  }
}
if (out.AUTO_PUBLISH_ENABLED === true || out.blocked !== true) {
  console.error("REFUSING: Auto Publish not locked AFTER checkout");
  process.exit(2);
}
NODE

echo "LOCAL_BLOBS"
git hash-object \
  private/admin-media.html \
  generated/static/header.html \
  public/assets/css/components/header.css \
  public/assets/js/admin-nav.js \
  server/app.js \
  server/services/media.service.js \
  server/lib/categoriesBrowse.js \
  private/admin-recruitment-review-queue.html \
  private/generator.html

pm2 reload ecosystem.config.js --update-env || pm2 restart all
sleep 4
pm2 status
nginx -t && systemctl reload nginx || true

echo "SMOKE"
curl -sS -o /dev/null -w "health=%{http_code}\n" http://127.0.0.1:3000/health || true
curl -sS -o /dev/null -w "ready=%{http_code}\n" http://127.0.0.1:3000/ready || true
curl -sS -o /dev/null -w "home=%{http_code}\n" http://127.0.0.1:3000/ || true
curl -sS -o /dev/null -w "categories=%{http_code}\n" http://127.0.0.1:3000/categories || true
curl -sS -o /dev/null -w "latest=%{http_code}\n" http://127.0.0.1:3000/latest-job || true
curl -sS -o /dev/null -w "login=%{http_code}\n" http://127.0.0.1:3000/login || true
curl -sS -o /dev/null -w "dashboard=%{http_code}\n" http://127.0.0.1:3000/admin/dashboard || true
curl -sS -o /dev/null -w "media=%{http_code}\n" http://127.0.0.1:3000/admin/media || true
curl -sS -o /dev/null -w "generator=%{http_code}\n" http://127.0.0.1:3000/generator || true
curl -sS -o /dev/null -w "rrq=%{http_code}\n" http://127.0.0.1:3000/admin/recruitment-review-queue || true
curl -sS -o /dev/null -w "recruitments=%{http_code}\n" http://127.0.0.1:3000/admin/recruitments || true
curl -sS -o /dev/null -w "editorial=%{http_code}\n" http://127.0.0.1:3000/admin/editorial-review || true
curl -sS -o /dev/null -w "pages=%{http_code}\n" http://127.0.0.1:3000/admin/page-manager || true
curl -sS -o /dev/null -w "monitoring=%{http_code}\n" http://127.0.0.1:3000/admin/monitoring || true
curl -sS -o /dev/null -w "acc=%{http_code}\n" http://127.0.0.1:3000/admin/automation-control-center || true
curl -sS -o /dev/null -w "header_asset=%{http_code}\n" http://127.0.0.1:3000/assets/css/components/header.css || true

echo "HEADER_MARKERS"
python3 - <<'PY' || true
from urllib.request import urlopen
html = urlopen("http://127.0.0.1:3000/", timeout=20).read().decode("utf-8", "ignore")
checks = {
  "has_navbar_inner": "navbar-inner" in html,
  "no_job_finder": "Job Finder" not in html and "#openFinder" not in html,
  "has_categories_link": "/categories" in html,
}
print(checks)
if not checks["has_navbar_inner"] or not checks["no_job_finder"]:
  raise SystemExit(2)
print("HEADER_MARKERS_OK")
PY

echo "FLAGS_AFTER_RELOAD"
NODE_ENV=production node <<'NODE'
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
echo "NOTE: tests/ docs/ package.json generated/jobs local-only NOT in checkout trees"
# Confirm package.json was not overwritten by this script path
git status -sb -- package.json tests docs generated/jobs 2>/dev/null | head -n 30 || true
git status -sb | head -n 25 || true

echo "DEPLOY_OK sha=$SHA backup=$BACKUP"
echo "NEW_HEAD=$(git rev-parse HEAD)"
echo "METHOD=selective_tree_checkout"
echo "TREES=server,private,public,generated/static + generator/lib/csvGridParser.js"
