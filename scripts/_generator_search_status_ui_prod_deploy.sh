#!/usr/bin/env bash
# Selective production deploy: Generator search/status UI cleanup only.
# Usage on VPS: GEN_UI_DEPLOY_SHA=<sha> bash scripts/_generator_search_status_ui_prod_deploy.sh
set -euo pipefail

ROOT="${1:-/root/sarkari-suchna-india}"
SHA="${GEN_UI_DEPLOY_SHA:?GEN_UI_DEPLOY_SHA required}"
cd "$ROOT"

FILES=(
  private/generator.html
  public/assets/js/admin-generator-ui.js
  public/assets/css/admin/generator-saas.css
  public/assets/css/admin/admin-design-system.css
  scripts/_generator_search_status_ui_prod_deploy.sh
)

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="/root/backups/generator_search_status_ui_${TS}"
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
  private/generator.html \
  public/assets/js/admin-generator-ui.js \
  public/assets/css/admin/generator-saas.css \
  public/assets/css/admin/admin-design-system.css

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

node - <<'NODE'
const fs = require("fs");
const paths = [
  "private/generator.html",
  "public/assets/js/admin-generator-ui.js",
  "public/assets/css/admin/generator-saas.css",
  "public/assets/css/admin/admin-design-system.css"
];
for (const p of paths) {
  const t = fs.readFileSync(p, "utf8");
  if (/enableAutoPublish|turnOnAutomation|AUTO_PUBLISH_ENABLED\s*=\s*true/i.test(t)) {
    console.error("REFUSING: unsafe automation enable pattern in", p);
    process.exit(2);
  }
}
const gen = fs.readFileSync("private/generator.html", "utf8");
if (!/id="pageSearchPanel"/.test(gen)) {
  console.error("REFUSING: generator.html missing pageSearchPanel");
  process.exit(2);
}
if ((gen.match(/id="pageSearch"/g) || []).length !== 1) {
  console.error("REFUSING: expected exactly one pageSearch input");
  process.exit(2);
}
if (!/generator-saas\.css\?v=32/.test(gen) || !/admin-generator-ui\.js\?v=4/.test(gen)) {
  console.error("REFUSING: generator.html cache-bust versions incorrect");
  process.exit(2);
}
const ui = fs.readFileSync("public/assets/js/admin-generator-ui.js", "utf8");
if (/Draft saved locally/.test(ui)) {
  console.error("REFUSING: sticky Draft saved locally still present in UI JS");
  process.exit(2);
}
if (!/syncSearchForHash/.test(ui)) {
  console.error("REFUSING: drafts search hide sync missing");
  process.exit(2);
}
const saas = fs.readFileSync("public/assets/css/admin/generator-saas.css", "utf8");
if (!/data-admin-hash="drafts"\] #pageSearchPanel/.test(saas)) {
  console.error("REFUSING: drafts search hide CSS missing");
  process.exit(2);
}
if (!/#generatorSaveState:not\(\.is-saving\)/.test(saas)) {
  console.error("REFUSING: idle save-state hide CSS missing");
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
