#!/usr/bin/env bash
# Controlled production deploy:
#   1) Phase 1 — Generator as final human publish point
#   2) Final Recruitment Lifecycle / Manual + Automatic workflow UI alignment
# Presentation/runtime UI only. No schema. No automation enable.
# Usage on VPS: ACC_DEPLOY_SHA=<sha> bash scripts/_lifecycle_generator_publish_prod_deploy.sh
set -euo pipefail

ROOT="${1:-/root/sarkari-suchna-india}"
SHA="${ACC_DEPLOY_SHA:?ACC_DEPLOY_SHA required}"
cd "$ROOT"

FILES=(
  private/generator.html
  public/assets/js/generator.js
  public/assets/css/admin/generator-saas.css
  private/admin-editorial-review.html
  private/admin-page-manager.html
  private/admin-dashboard.html
  public/assets/js/admin-workflow-ia.js
  private/admin-recruitments.html
  private/admin-recruitment-review-queue.html
  public/assets/js/admin-recruitment-operations.js
  public/assets/js/admin-recruitment-review-queue.js
  public/assets/css/admin/recruitment-review-queue.css
  tests/adminWorkflowIa.ux.test.js
  tests/recruitmentsIa.simplification.test.js
  tests/generatorDraftId.savePayload.test.js
  tests/recruitmentOperations.integration.test.js
  tests/package4c.integration.test.js
  tests/package4d.integration.test.js
  tests/package4e.integration.test.js
  tests/package4f.integration.test.js
  scripts/_lifecycle_generator_publish_prod_deploy.sh
  scripts/_lifecycle_generator_publish_prod_postcheck.sh
  scripts/_lifecycle_generator_publish_prod_browser_verify.js
  scripts/_phase1_generator_publish_ia_browser.js
)

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="/root/backups/lifecycle_generator_publish_${TS}"
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
  public/assets/js/generator.js \
  public/assets/css/admin/generator-saas.css \
  private/admin-editorial-review.html \
  private/admin-page-manager.html \
  private/admin-dashboard.html \
  public/assets/js/admin-workflow-ia.js \
  private/admin-recruitments.html \
  private/admin-recruitment-review-queue.html \
  public/assets/js/admin-recruitment-operations.js \
  public/assets/js/admin-recruitment-review-queue.js \
  public/assets/css/admin/recruitment-review-queue.css

NODE_ENV=production node - <<'NODE'
const f = require("./server/config/automationFlags");
const g = f.getAutomationFlags();
console.log(JSON.stringify({
  AUTO_PUBLISH_ENABLED: g.AUTO_PUBLISH_ENABLED,
  LIVE_CRAWLER_ENABLED: g.LIVE_CRAWLER_ENABLED,
  PRODUCTION_MONITORING_ENABLED: g.PRODUCTION_MONITORING_ENABLED,
  RECRUITMENT_PIPELINE_ENABLED: g.RECRUITMENT_PIPELINE_ENABLED,
  AUTO_DRAFT_ENABLED: g.AUTO_DRAFT_ENABLED,
  dormant: f.isAutomationDormant(),
  blocked: f.isAutoPublishBlocked()
}));
if (g.AUTO_PUBLISH_ENABLED === true) {
  console.error("REFUSING: AUTO_PUBLISH_ENABLED unexpectedly true");
  process.exit(2);
}
if (
  g.LIVE_CRAWLER_ENABLED === true ||
  g.PRODUCTION_MONITORING_ENABLED === true ||
  g.RECRUITMENT_PIPELINE_ENABLED === true ||
  g.AUTO_DRAFT_ENABLED === true
) {
  console.error("REFUSING: automation/monitoring flags unexpectedly true");
  process.exit(2);
}
NODE

node - <<'NODE'
const fs = require("fs");
const paths = [
  "private/generator.html",
  "public/assets/js/generator.js",
  "private/admin-editorial-review.html",
  "private/admin-page-manager.html",
  "private/admin-recruitments.html",
  "private/admin-recruitment-review-queue.html",
  "public/assets/js/admin-recruitment-review-queue.js",
  "public/assets/js/admin-workflow-ia.js"
];
for (const p of paths) {
  const t = fs.readFileSync(p, "utf8");
  if (/enableAutoPublish|turnOnAutomation|AUTO_PUBLISH_ENABLED\s*=\s*true/i.test(t)) {
    console.error("REFUSING: unsafe automation enable pattern in", p);
    process.exit(2);
  }
}
const gen = fs.readFileSync("private/generator.html", "utf8");
if (!/data-label-desktop="Manual Publish"/.test(gen)) {
  console.error("REFUSING: Generator missing Manual Publish primary CTA");
  process.exit(2);
}
const rrq = fs.readFileSync("private/admin-recruitment-review-queue.html", "utf8");
if (!rrq.includes('id="rrqManualPublishLink"') || !rrq.includes("/generator")) {
  console.error("REFUSING: Review Center Manual Publish link missing Generator target");
  process.exit(2);
}
if (rrq.includes('id="rrqManualPublishLink" href="/admin/page-manager"')) {
  console.error("REFUSING: Review Center publish points at Page Manager");
  process.exit(2);
}
const rrqJs = fs.readFileSync("public/assets/js/admin-recruitment-review-queue.js", "utf8");
if (!rrqJs.includes("/generator?draftId=") || !rrqJs.includes("/generator#drafts")) {
  console.error("REFUSING: RRQ JS missing Generator draft/publish routes");
  process.exit(2);
}
const er = fs.readFileSync("private/admin-editorial-review.html", "utf8");
if (/Publish Page/.test(er) && /page-manager/.test(er) && !/Manage published pages/.test(er)) {
  console.error("REFUSING: Editorial still has misleading Publish Page → Page Manager");
  process.exit(2);
}
const pm = fs.readFileSync("private/admin-page-manager.html", "utf8");
if (!/already published/i.test(pm)) {
  console.error("REFUSING: Page Manager missing already-published copy");
  process.exit(2);
}
const rec = fs.readFileSync("private/admin-recruitments.html", "utf8");
if (!/One recruitment = one permanent public page/i.test(rec)) {
  console.error("REFUSING: Recruitments missing one-page lifecycle messaging");
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
