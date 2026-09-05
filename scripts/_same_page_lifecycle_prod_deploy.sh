#!/usr/bin/env bash
# Selective production deploy: same-page recruitment lifecycle finalization.
# Presentation + server guards only. No schema. No automation enable.
# Usage on VPS: ACC_DEPLOY_SHA=<sha> bash scripts/_same_page_lifecycle_prod_deploy.sh
set -euo pipefail

ROOT="${1:-/root/sarkari-suchna-india}"
SHA="${ACC_DEPLOY_SHA:?ACC_DEPLOY_SHA required}"
cd "$ROOT"

FILES=(
  server/lib/recruitment/canonicalPublicPage.js
  server/services/recruitmentPageLink.service.js
  server/services/generatorDraft.service.js
  server/controllers/admin/generator.controller.js
  server/controllers/admin/generatorDraft.controller.js
  server/controllers/admin/recruitmentReviewQueue.controller.js
  private/generator.html
  private/admin-recruitments.html
  public/assets/js/generator.js
  public/assets/js/admin-recruitment-operations.js
  public/assets/js/admin-recruitment-review-queue.js
  tests/canonicalPublicPage.test.js
  tests/recruitmentLifecycle.samePageWiring.test.js
  tests/recruitmentPageLink.service.test.js
  tests/recruitmentReviewQueue.controller.test.js
  tests/generatorDraftId.savePayload.test.js
  scripts/_same_page_lifecycle_prod_deploy.sh
  scripts/_same_page_lifecycle_prod_postcheck.sh
)

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="/root/backups/same_page_lifecycle_${TS}"
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
  server/lib/recruitment/canonicalPublicPage.js \
  server/services/recruitmentPageLink.service.js \
  server/services/generatorDraft.service.js \
  server/controllers/admin/generator.controller.js \
  server/controllers/admin/generatorDraft.controller.js \
  server/controllers/admin/recruitmentReviewQueue.controller.js \
  private/generator.html \
  private/admin-recruitments.html \
  public/assets/js/generator.js \
  public/assets/js/admin-recruitment-operations.js \
  public/assets/js/admin-recruitment-review-queue.js

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
  "server/lib/recruitment/canonicalPublicPage.js",
  "server/controllers/admin/generator.controller.js",
  "public/assets/js/generator.js",
  "public/assets/js/admin-recruitment-review-queue.js",
  "private/admin-recruitments.html",
  "private/generator.html"
];
for (const p of paths) {
  if (!fs.existsSync(p)) {
    console.error("REFUSING: missing required file", p);
    process.exit(2);
  }
  const t = fs.readFileSync(p, "utf8");
  if (/enableAutoPublish|turnOnAutomation|AUTO_PUBLISH_ENABLED\s*=\s*true/i.test(t)) {
    console.error("REFUSING: unsafe automation enable pattern in", p);
    process.exit(2);
  }
}
const canon = fs.readFileSync("server/lib/recruitment/canonicalPublicPage.js", "utf8");
if (!canon.includes("evaluateSamePagePublishGuard") || !canon.includes("ambiguous")) {
  console.error("REFUSING: canonicalPublicPage missing same-page guard");
  process.exit(2);
}
const genCtrl = fs.readFileSync("server/controllers/admin/generator.controller.js", "utf8");
if (!genCtrl.includes("evaluateSamePagePublishGuard") || !genCtrl.includes("status(409)")) {
  console.error("REFUSING: generator controller missing same-page 409 guard");
  process.exit(2);
}
const genJs = fs.readFileSync("public/assets/js/generator.js", "utf8");
if (!genJs.includes("applyLinkedPublicPageToGenerator")) {
  console.error("REFUSING: generator.js missing linked public page hydration");
  process.exit(2);
}
if (!genJs.includes("Updating existing public page") || !genJs.includes("Creating new public page")) {
  console.error("REFUSING: generator.js missing create/update publish copy");
  process.exit(2);
}
const rrqJs = fs.readFileSync("public/assets/js/admin-recruitment-review-queue.js", "utf8");
if (!rrqJs.includes('linked.status || "").toLowerCase() === "published"')) {
  console.error("REFUSING: Review Center missing published-draft routing");
  process.exit(2);
}
if (rrqJs.includes("Standalone Recruitment created")) {
  console.error("REFUSING: Standalone still claims recruitment created");
  process.exit(2);
}
const rec = fs.readFileSync("private/admin-recruitments.html", "utf8");
if (!rec.includes("manualUpdateOpenGenerator") || !rec.includes("openBoundDraftGeneratorBtn")) {
  console.error("REFUSING: Recruitments missing draft Open Generator deep links");
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
