#!/usr/bin/env bash
# Selective production deploy: approved Generator + Editorial Review UI only.
# Does NOT touch automation flags, workers, migrations, or unrelated WIP.
# Usage on VPS: GEN_ER_UI_DEPLOY_SHA=<sha> bash scripts/_generator_editorial_ui_prod_deploy.sh
set -euo pipefail

ROOT="${1:-/root/sarkari-suchna-india}"
SHA="${GEN_ER_UI_DEPLOY_SHA:?GEN_ER_UI_DEPLOY_SHA required}"
cd "$ROOT"

FILES=(
  private/generator.html
  private/admin-editorial-review.html
  public/assets/css/admin/admin-design-system.css
  public/assets/css/admin/admin-workspace-polish.css
  public/assets/css/admin/generator-saas.css
  public/assets/css/admin/generator.css
  public/assets/js/admin-editorial-review.js
  public/assets/js/admin-generator-drafts.js
  public/assets/js/admin-generator-ui.js
  public/assets/js/generator.js
  public/assets/js/sectionEditor.js
  scripts/_generator_editorial_ui_prod_deploy.sh
)

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="/root/backups/generator_editorial_ui_${TS}"
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
NODE_ENV=production node <<'NODE'
const f = require("./server/config/automationFlags");
const g = f.getAutomationFlags();
const out = {
  LIVE_CRAWLER_ENABLED: g.LIVE_CRAWLER_ENABLED,
  RECRUITMENT_PIPELINE_ENABLED: g.RECRUITMENT_PIPELINE_ENABLED,
  AUTO_DRAFT_ENABLED: g.AUTO_DRAFT_ENABLED,
  AUTO_PUBLISH_ENABLED: g.AUTO_PUBLISH_ENABLED,
  TELEGRAM_DELIVERY_ENABLED: g.TELEGRAM_DELIVERY_ENABLED,
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
  "TELEGRAM_DELIVERY_ENABLED","NOTIFICATION_GATEWAY_ENABLED","WORKER_ACTIVATION_ENABLED",
  "RECRUITMENT_PIPELINE_ENABLED"
]) {
  if (g[key] === true) {
    console.error("REFUSING: unexpected true BEFORE deploy:", key);
    process.exit(2);
  }
}
if (f.isAutomationDormant() !== true || f.isAutoPublishBlocked() !== true) {
  console.error("REFUSING: automation not dormant/locked BEFORE deploy");
  process.exit(2);
}
NODE

git fetch origin main
git checkout "$SHA" -- "${FILES[@]}"
echo "CHECKOUT_DONE sha=$SHA"

echo "LOCAL_BLOBS"
git hash-object \
  private/generator.html \
  private/admin-editorial-review.html \
  public/assets/js/sectionEditor.js \
  public/assets/js/admin-generator-ui.js \
  public/assets/js/admin-generator-drafts.js \
  public/assets/js/admin-editorial-review.js \
  public/assets/js/generator.js \
  public/assets/css/admin/generator-saas.css \
  public/assets/css/admin/generator.css \
  public/assets/css/admin/admin-design-system.css \
  public/assets/css/admin/admin-workspace-polish.css

node <<'NODE'
const fs = require("fs");
const paths = [
  "private/generator.html",
  "private/admin-editorial-review.html",
  "public/assets/js/sectionEditor.js",
  "public/assets/js/admin-generator-ui.js",
  "public/assets/js/admin-editorial-review.js",
  "public/assets/css/admin/generator-saas.css",
  "public/assets/css/admin/admin-design-system.css",
  "public/assets/css/admin/admin-workspace-polish.css"
];
for (const p of paths) {
  const t = fs.readFileSync(p, "utf8");
  if (/enableAutoPublish|turnOnAutomation|AUTO_PUBLISH_ENABLED\s*=\s*true/i.test(t)) {
    console.error("REFUSING: unsafe automation enable pattern in", p);
    process.exit(2);
  }
}
const gen = fs.readFileSync("private/generator.html", "utf8");
if (/Smart workspace|content-analysis-panel|admin-ops-flow/i.test(gen)) {
  console.error("REFUSING: generator still has removed Smart workspace / analysis / ops-flow");
  process.exit(2);
}
if (!/id="pdfExtractSection"/.test(gen) || !/generator-steps/.test(gen)) {
  console.error("REFUSING: generator missing PDF Extract or step nav");
  process.exit(2);
}
if (!/generator-saas\.css\?v=37/.test(gen) || !/admin-design-system\.css\?v=27/.test(gen)) {
  console.error("REFUSING: generator cache-bust versions incorrect");
  process.exit(2);
}
if (!/pageSearchClose/.test(gen)) {
  console.error("REFUSING: generator search close control missing");
  process.exit(2);
}
const er = fs.readFileSync("private/admin-editorial-review.html", "utf8");
if (/admin-ops-flow|Open in Operations|href="\/generator#drafts"|href="\/admin\/recruitments"/.test(er)) {
  console.error("REFUSING: editorial still has removed nav/ops-flow/ops link");
  process.exit(2);
}
if (!/admin-workspace-polish\.css\?v=5/.test(er) || !/admin-editorial-review\.js\?v=4/.test(er)) {
  console.error("REFUSING: editorial cache-bust versions incorrect");
  process.exit(2);
}
const ui = fs.readFileSync("public/assets/js/admin-generator-ui.js", "utf8");
if (!/ensurePreviewClosedByDefault|setSearchOpen|pageSearchClose/.test(ui)) {
  console.error("REFUSING: generator UI missing preview/search controls");
  process.exit(2);
}
const sec = fs.readFileSync("public/assets/js/sectionEditor.js", "utf8");
if (!/SECTION_PRESETS|duplicateSection|data-rich-action="br"/.test(sec)) {
  console.error("REFUSING: section editor missing presets/duplicate/BR");
  process.exit(2);
}
const ds = fs.readFileSync("public/assets/css/admin/admin-design-system.css", "utf8");
if (!/body\[data-admin-hash="drafts"\][\s\S]*#previewBtn/.test(ds) ||
    !/body\[data-admin-hash="drafts"\][\s\S]*#aiConvertBtn/.test(ds) ||
    !/body\[data-admin-hash="drafts"\][\s\S]*\.action-bar/.test(ds)) {
  console.error("REFUSING: drafts sticky action hide CSS missing");
  process.exit(2);
}
const polish = fs.readFileSync("public/assets/css/admin/admin-workspace-polish.css", "utf8");
if (!/\.main:has\(\.er-layout\)[\s\S]*width:\s*calc\(100%\s*-\s*var\(--admin-sidebar-current\)\)/.test(polish)) {
  console.error("REFUSING: editorial sidebar overflow fix missing");
  process.exit(2);
}
if (!/#erRefreshBtn/.test(polish)) {
  console.error("REFUSING: editorial refresh visibility CSS missing");
  process.exit(2);
}
console.log("STATIC_SAFETY_OK");
NODE

echo "FLAGS_AFTER_CHECKOUT"
NODE_ENV=production node <<'NODE'
const f = require("./server/config/automationFlags");
const g = f.getAutomationFlags();
console.log(JSON.stringify({
  LIVE_CRAWLER_ENABLED: g.LIVE_CRAWLER_ENABLED,
  RECRUITMENT_PIPELINE_ENABLED: g.RECRUITMENT_PIPELINE_ENABLED,
  AUTO_DRAFT_ENABLED: g.AUTO_DRAFT_ENABLED,
  AUTO_PUBLISH_ENABLED: g.AUTO_PUBLISH_ENABLED,
  TELEGRAM_DELIVERY_ENABLED: g.TELEGRAM_DELIVERY_ENABLED,
  NOTIFICATION_GATEWAY_ENABLED: g.NOTIFICATION_GATEWAY_ENABLED,
  PRODUCTION_MONITORING_ENABLED: g.PRODUCTION_MONITORING_ENABLED,
  SCHEDULER_ACTIVATION_ENABLED: g.SCHEDULER_ACTIVATION_ENABLED,
  WORKER_ACTIVATION_ENABLED: g.WORKER_ACTIVATION_ENABLED,
  dormant: f.isAutomationDormant(),
  blocked: f.isAutoPublishBlocked()
}));
for (const key of [
  "AUTO_PUBLISH_ENABLED","AUTO_DRAFT_ENABLED","LIVE_CRAWLER_ENABLED",
  "PRODUCTION_MONITORING_ENABLED","SCHEDULER_ACTIVATION_ENABLED",
  "TELEGRAM_DELIVERY_ENABLED","NOTIFICATION_GATEWAY_ENABLED","WORKER_ACTIVATION_ENABLED",
  "RECRUITMENT_PIPELINE_ENABLED"
]) {
  if (g[key] === true) {
    console.error("REFUSING: unexpected true AFTER checkout:", key);
    process.exit(2);
  }
}
if (f.isAutomationDormant() !== true || f.isAutoPublishBlocked() !== true) {
  console.error("REFUSING: automation not dormant/locked AFTER checkout");
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
curl -sS -o /dev/null -w "editorial=%{http_code}\n" http://127.0.0.1:3000/admin/editorial-review || true

echo "FLAGS_AFTER_RELOAD"
NODE_ENV=production node <<'NODE'
const f = require("./server/config/automationFlags");
const g = f.getAutomationFlags();
console.log(JSON.stringify({
  LIVE_CRAWLER_ENABLED: g.LIVE_CRAWLER_ENABLED,
  RECRUITMENT_PIPELINE_ENABLED: g.RECRUITMENT_PIPELINE_ENABLED,
  AUTO_DRAFT_ENABLED: g.AUTO_DRAFT_ENABLED,
  AUTO_PUBLISH_ENABLED: g.AUTO_PUBLISH_ENABLED,
  TELEGRAM_DELIVERY_ENABLED: g.TELEGRAM_DELIVERY_ENABLED,
  NOTIFICATION_GATEWAY_ENABLED: g.NOTIFICATION_GATEWAY_ENABLED,
  PRODUCTION_MONITORING_ENABLED: g.PRODUCTION_MONITORING_ENABLED,
  SCHEDULER_ACTIVATION_ENABLED: g.SCHEDULER_ACTIVATION_ENABLED,
  WORKER_ACTIVATION_ENABLED: g.WORKER_ACTIVATION_ENABLED,
  dormant: f.isAutomationDormant(),
  blocked: f.isAutoPublishBlocked()
}));
NODE

echo "UI_MARKERS"
node <<'NODE'
const fs = require("fs");
const g = fs.readFileSync("private/generator.html", "utf8");
const e = fs.readFileSync("private/admin-editorial-review.html", "utf8");
console.log(JSON.stringify({
  generator: {
    smartWorkspace: /Smart workspace/i.test(g),
    workflowStrip: /admin-ops-flow/.test(g),
    contentAnalysis: /content-analysis-panel/i.test(g),
    pdfExtract: /id="pdfExtractSection"/.test(g),
    steps: /generator-steps/.test(g),
    searchClose: /pageSearchClose/.test(g)
  },
  editorial: {
    opsFlow: /admin-ops-flow/.test(e),
    draftsNav: /href="\/generator#drafts"/.test(e),
    opsLink: /Open in Operations/.test(e),
    refresh: /id="erRefreshBtn"/.test(e)
  }
}));
NODE

echo "EXCLUSION_SPOTCHECK"
echo "NOTE: server/, package.json, sitemap, lifecycle WIP intentionally not in allowlist"
git status -sb | head -n 20 || true
echo "NEW_HEAD=$(git rev-parse HEAD)"
echo "DEPLOY_OK sha=$SHA backup=$BACKUP"
