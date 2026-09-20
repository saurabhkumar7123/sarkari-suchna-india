#!/usr/bin/env bash
# Selective production deploy: Update Draft → Combined Preview → Manual Publish workflow.
# PDF/source quality gate, BLOCKED→conversionRequired, CREATE/UPDATE merge, Combined Preview.
# Product/runtime files only. No schema. No automation enable. No live PDF crawl.
# Usage on VPS: ACC_DEPLOY_SHA=<sha> bash scripts/_update_draft_combined_preview_prod_deploy.sh
set -euo pipefail

ROOT="${1:-/root/sarkari-suchna-india}"
SHA="${ACC_DEPLOY_SHA:?ACC_DEPLOY_SHA required}"
cd "$ROOT"

FILES=(
  server/lib/recruitment/preparationPipeline/advisoryValidation.js
  server/lib/recruitment/preparationPipeline/authoritativePath.js
  server/lib/recruitment/preparationPipeline/documentLifecycleClassification.js
  server/lib/recruitment/preparationPipeline/extractionQualityGate.js
  server/lib/recruitment/preparationPipeline/index.js
  server/lib/recruitment/preparationPipeline/sectionTaxonomy.js
  server/lib/recruitment/preparationPipeline/updateMergeContext.js
  server/lib/recruitment/productionRuntime/index.js
  server/services/generatorDraft.service.js
  server/services/recruitmentLifecycle.service.js
  server/services/updates/updates.repository.js
  server/controllers/admin/generatorDraft.controller.js
  server/controllers/public/misc.controller.js
  server/validations/public.validation.js
  private/generator.html
  public/assets/js/generator.js
  public/assets/css/admin/generator.css
  public/assets/js/admin-monitoring.js
  public/assets/js/admin-recruitment-review-queue.js
  scripts/_update_draft_combined_preview_prod_deploy.sh
  scripts/_update_draft_combined_preview_prod_postcheck.sh
)

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="/root/backups/update_draft_combined_preview_${TS}"
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
  WORKER_ACTIVATION_ENABLED: g.WORKER_ACTIVATION_ENABLED,
  dormant: f.isAutomationDormant(),
  blocked: f.isAutoPublishBlocked()
}));
if (g.AUTO_PUBLISH_ENABLED === true) {
  console.error("REFUSING: AUTO_PUBLISH_ENABLED unexpectedly true BEFORE deploy");
  process.exit(2);
}
if (
  g.LIVE_CRAWLER_ENABLED === true ||
  g.PRODUCTION_MONITORING_ENABLED === true ||
  g.AUTO_DRAFT_ENABLED === true ||
  g.RECRUITMENT_PIPELINE_ENABLED === true ||
  g.SCHEDULER_ACTIVATION_ENABLED === true ||
  g.WORKER_ACTIVATION_ENABLED === true
) {
  console.error("REFUSING: automation/crawler flags unexpectedly true BEFORE deploy");
  process.exit(2);
}
NODE

git fetch origin main
git checkout "$SHA" -- "${FILES[@]}"
echo "CHECKOUT_DONE sha=$SHA"

echo "LOCAL_BLOBS"
git hash-object \
  server/lib/recruitment/preparationPipeline/updateMergeContext.js \
  server/lib/recruitment/preparationPipeline/index.js \
  server/lib/recruitment/productionRuntime/index.js \
  server/services/generatorDraft.service.js \
  server/controllers/public/misc.controller.js \
  public/assets/js/generator.js \
  public/assets/js/admin-monitoring.js \
  public/assets/js/admin-recruitment-review-queue.js

echo "FLAGS_AFTER_CHECKOUT"
NODE_ENV=production node - <<'NODE'
const f = require("./server/config/automationFlags");
const g = f.getAutomationFlags();
console.log(JSON.stringify({
  AUTO_PUBLISH_ENABLED: g.AUTO_PUBLISH_ENABLED,
  AUTO_DRAFT_ENABLED: g.AUTO_DRAFT_ENABLED,
  LIVE_CRAWLER_ENABLED: g.LIVE_CRAWLER_ENABLED,
  PRODUCTION_MONITORING_ENABLED: g.PRODUCTION_MONITORING_ENABLED,
  dormant: f.isAutomationDormant(),
  blocked: f.isAutoPublishBlocked()
}));
if (g.AUTO_PUBLISH_ENABLED === true) {
  console.error("REFUSING: AUTO_PUBLISH_ENABLED unexpectedly true AFTER checkout");
  process.exit(2);
}
if (
  g.LIVE_CRAWLER_ENABLED === true ||
  g.PRODUCTION_MONITORING_ENABLED === true ||
  g.AUTO_DRAFT_ENABLED === true
) {
  console.error("REFUSING: automation/crawler flags unexpectedly true AFTER checkout");
  process.exit(2);
}
NODE

node - <<'NODE'
const fs = require("fs");
const paths = [
  "server/lib/recruitment/preparationPipeline/updateMergeContext.js",
  "server/lib/recruitment/productionRuntime/index.js",
  "server/services/generatorDraft.service.js",
  "server/controllers/public/misc.controller.js",
  "public/assets/js/generator.js",
  "public/assets/js/admin-monitoring.js",
  "public/assets/js/admin-recruitment-review-queue.js",
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
const merge = fs.readFileSync("server/lib/recruitment/preparationPipeline/updateMergeContext.js", "utf8");
if (!merge.includes("resolveCombinedPreviewText") || !merge.includes("diffPublisherSections")) {
  console.error("REFUSING: updateMergeContext missing Combined Preview helpers");
  process.exit(2);
}
const runtime = fs.readFileSync("server/lib/recruitment/productionRuntime/index.js", "utf8");
if (!/toUpperCase\(\)\s*===\s*"BLOCKED"/.test(runtime) || !/conversionRequired\s*=\s*true/.test(runtime)) {
  console.error("REFUSING: productionRuntime missing BLOCKED→conversionRequired gate");
  process.exit(2);
}
const misc = fs.readFileSync("server/controllers/public/misc.controller.js", "utf8");
if (!misc.includes("injectCombinedPreviewMarkers") || !misc.includes("X-Combined-Preview")) {
  console.error("REFUSING: misc.controller missing Combined Preview markers");
  process.exit(2);
}
const genJs = fs.readFileSync("public/assets/js/generator.js", "utf8");
if (!genJs.includes("combinePreview") || !genJs.includes("existingText")) {
  console.error("REFUSING: generator.js missing Combined Preview client path");
  process.exit(2);
}
const mon = fs.readFileSync("public/assets/js/admin-monitoring.js", "utf8");
if (!mon.includes("Open Official Site")) {
  console.error("REFUSING: monitoring missing Official Site affordance");
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
