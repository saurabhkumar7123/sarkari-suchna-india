#!/usr/bin/env bash
# Deploy Recruitments IA simplification to production (presentation only).
# Usage on VPS: ACC_DEPLOY_SHA=<sha> bash scripts/_recruitments_ia_prod_deploy.sh
set -euo pipefail

ROOT="${1:-/root/sarkari-suchna-india}"
SHA="${ACC_DEPLOY_SHA:?ACC_DEPLOY_SHA required}"
cd "$ROOT"

FILES=(
  private/admin-recruitments.html
  private/admin-recruitment-review-queue.html
  public/assets/js/admin-nav.js
  public/assets/js/admin-recruitment-operations.js
  public/assets/js/admin-recruitment-review-queue.js
  public/assets/js/admin-workflow-ia.js
  public/assets/css/admin/admin-design-system.css
  public/assets/css/admin/recruitment-operations.css
  public/assets/css/admin/recruitment-review-queue.css
  tests/recruitmentsIa.simplification.test.js
  tests/adminWorkflowIa.ux.test.js
  tests/adminUiDashboardNavPolish.test.js
  tests/package4e.integration.test.js
  scripts/_recruitments_ia_prod_deploy.sh
  scripts/_recruitments_ia_prod_postcheck.sh
  scripts/_recruitments_ia_browser_verify.js
)

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="/root/backups/recruitments_ia_${TS}"
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
  private/admin-recruitments.html \
  private/admin-recruitment-review-queue.html \
  public/assets/js/admin-nav.js \
  public/assets/js/admin-recruitment-operations.js \
  public/assets/js/admin-workflow-ia.js

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
  console.error("REFUSING: AUTO_PUBLISH_ENABLED unexpectedly true");
  process.exit(2);
}
if (g.LIVE_CRAWLER_ENABLED === true || g.PRODUCTION_MONITORING_ENABLED === true) {
  console.error("REFUSING: monitoring crawler flags unexpectedly true");
  process.exit(2);
}
NODE

node - <<'NODE'
const fs = require("fs");
const paths = [
  "private/admin-recruitments.html",
  "private/admin-recruitment-review-queue.html",
  "public/assets/js/admin-nav.js",
  "public/assets/js/admin-workflow-ia.js"
];
for (const p of paths) {
  const t = fs.readFileSync(p, "utf8");
  if (/enableAutoPublish|turnOnAutomation|AUTO_PUBLISH_ENABLED\s*=\s*true/i.test(t)) {
    console.error("REFUSING: unsafe automation enable pattern in", p);
    process.exit(2);
  }
}
if (!fs.readFileSync("private/admin-recruitments.html", "utf8").includes("Recruitment Manager")) {
  console.error("REFUSING: recruitments page missing Recruitment Manager");
  process.exit(2);
}
if (fs.readFileSync("public/assets/js/admin-nav.js", "utf8").includes('navLink("/admin/recruitment-review-queue?status=needs_matching"')) {
  console.error("REFUSING: Needs Matching still a sidebar navLink");
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

echo "DEPLOY_OK sha=$SHA backup=$BACKUP"
