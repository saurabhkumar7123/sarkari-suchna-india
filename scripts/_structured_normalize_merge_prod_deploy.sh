#!/usr/bin/env bash
# Selective production deploy: Structured PDF Normalize/Merge (+ Monitoring→Review→
# Recruitment→Combined Preview→Manual Publish wiring).
# Product/runtime files only. No schema. No migrations. No automation enable.
# Usage on VPS: ACC_DEPLOY_SHA=<sha> bash scripts/_structured_normalize_merge_prod_deploy.sh
set -euo pipefail

ROOT="${1:-/root/sarkari-suchna-india}"
SHA="${ACC_DEPLOY_SHA:?ACC_DEPLOY_SHA required}"
cd "$ROOT"

FILES=(
  server/lib/recruitment/preparationPipeline/structuredNormalizeMerge.js
  server/lib/recruitment/preparationPipeline/updateMergeContext.js
  server/lib/recruitment/preparationPipeline/sectionTaxonomy.js
  server/lib/recruitment/preparationPipeline/index.js
  server/utils/canonicalPublisherFormat.js
  server/lib/recruitment/productionRuntime/index.js
  server/lib/recruitment/productionRuntime/downloadOfficialPdfForGeneratorExtraction.js
  server/lib/recruitment/publisherDraftValidation.js
  server/services/recruitmentLifecycle.service.js
  server/services/generatorDraft.service.js
  server/services/pdfGeneratorExtract.service.js
  scripts/_structured_normalize_merge_prod_deploy.sh
  scripts/_structured_normalize_merge_prod_postcheck.sh
)

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="/root/backups/structured_normalize_merge_${TS}"
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
  server/lib/recruitment/preparationPipeline/structuredNormalizeMerge.js \
  server/lib/recruitment/preparationPipeline/updateMergeContext.js \
  server/lib/recruitment/preparationPipeline/sectionTaxonomy.js \
  server/lib/recruitment/preparationPipeline/index.js \
  server/utils/canonicalPublisherFormat.js \
  server/lib/recruitment/productionRuntime/index.js \
  server/lib/recruitment/productionRuntime/downloadOfficialPdfForGeneratorExtraction.js \
  server/lib/recruitment/publisherDraftValidation.js \
  server/services/recruitmentLifecycle.service.js \
  server/services/generatorDraft.service.js \
  server/services/pdfGeneratorExtract.service.js

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
  WORKER_ACTIVATION_ENABLED: g.WORKER_ACTIVATION_ENABLED,
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
  g.AUTO_DRAFT_ENABLED === true ||
  g.SCHEDULER_ACTIVATION_ENABLED === true ||
  g.WORKER_ACTIVATION_ENABLED === true
) {
  console.error("REFUSING: automation/crawler flags unexpectedly true AFTER checkout");
  process.exit(2);
}
NODE

node - <<'NODE'
const fs = require("fs");
const paths = [
  "server/lib/recruitment/preparationPipeline/structuredNormalizeMerge.js",
  "server/lib/recruitment/preparationPipeline/updateMergeContext.js",
  "server/lib/recruitment/preparationPipeline/sectionTaxonomy.js",
  "server/lib/recruitment/preparationPipeline/index.js",
  "server/utils/canonicalPublisherFormat.js",
  "server/lib/recruitment/productionRuntime/index.js",
  "server/lib/recruitment/productionRuntime/downloadOfficialPdfForGeneratorExtraction.js",
  "server/lib/recruitment/publisherDraftValidation.js",
  "server/services/recruitmentLifecycle.service.js",
  "server/services/generatorDraft.service.js",
  "server/services/pdfGeneratorExtract.service.js"
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
  if (/\.local-mysql|e2e-download|local-only-bootstrap/i.test(t)) {
    console.error("REFUSING: local/test-only content in", p);
    process.exit(2);
  }
}
const snm = fs.readFileSync(
  "server/lib/recruitment/preparationPipeline/structuredNormalizeMerge.js",
  "utf8"
);
if (
  !snm.includes("normalizePublisherDocument") ||
  !snm.includes("mergeStructuredPublisherDocuments") ||
  !snm.includes('REMOVE: "REMOVE"')
) {
  console.error("REFUSING: structuredNormalizeMerge missing core exports/REMOVE handling");
  process.exit(2);
}
const merge = fs.readFileSync(
  "server/lib/recruitment/preparationPipeline/updateMergeContext.js",
  "utf8"
);
if (
  !merge.includes("structuredNormalizeMerge") ||
  !merge.includes("mergePublisherSectionText") ||
  !merge.includes("mergeStructuredPublisherDocuments")
) {
  console.error("REFUSING: updateMergeContext missing structured merge wiring");
  process.exit(2);
}
const runtime = fs.readFileSync("server/lib/recruitment/productionRuntime/index.js", "utf8");
if (
  !runtime.includes("structuredNormalizeMerge") ||
  !runtime.includes("mergeClassifications") ||
  !/toUpperCase\(\)\s*===\s*"BLOCKED"/.test(runtime)
) {
  console.error("REFUSING: productionRuntime missing structured merge / BLOCKED gate");
  process.exit(2);
}
const idx = fs.readFileSync("server/lib/recruitment/preparationPipeline/index.js", "utf8");
if (!idx.includes("structuredNormalizeMerge")) {
  console.error("REFUSING: preparationPipeline index missing structuredNormalizeMerge export");
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
