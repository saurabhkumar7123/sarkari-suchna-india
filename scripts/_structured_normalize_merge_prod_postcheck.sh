#!/usr/bin/env bash
# Post-deploy structural checks for Structured PDF Normalize/Merge workflow.
# No live official PDF download. No automation activation. No migrations.
set -euo pipefail
cd /root/sarkari-suchna-india

echo "=== PM2 ==="
pm2 jlist | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")); for (const p of d) console.log(p.name, p.pm2_env.status, p.pid);'

echo "=== FLAGS ==="
NODE_ENV=production node - <<'NODE'
const f = require("./server/config/automationFlags");
const g = f.getAutomationFlags();
const out = {
  AUTO_PUBLISH_ENABLED: g.AUTO_PUBLISH_ENABLED,
  AUTO_DRAFT_ENABLED: g.AUTO_DRAFT_ENABLED,
  LIVE_CRAWLER_ENABLED: g.LIVE_CRAWLER_ENABLED,
  PRODUCTION_MONITORING_ENABLED: g.PRODUCTION_MONITORING_ENABLED,
  RECRUITMENT_PIPELINE_ENABLED: g.RECRUITMENT_PIPELINE_ENABLED,
  SCHEDULER_ACTIVATION_ENABLED: g.SCHEDULER_ACTIVATION_ENABLED,
  WORKER_ACTIVATION_ENABLED: g.WORKER_ACTIVATION_ENABLED,
  dormant: f.isAutomationDormant(),
  blocked: f.isAutoPublishBlocked()
};
console.log(JSON.stringify(out));
if (g.AUTO_PUBLISH_ENABLED === true) process.exit(2);
if (
  g.LIVE_CRAWLER_ENABLED === true ||
  g.PRODUCTION_MONITORING_ENABLED === true ||
  g.AUTO_DRAFT_ENABLED === true ||
  g.SCHEDULER_ACTIVATION_ENABLED === true ||
  g.WORKER_ACTIVATION_ENABLED === true
) process.exit(2);
NODE

echo "=== HEALTH ==="
curl -sS -o /dev/null -w "health=%{http_code}\n" http://127.0.0.1:3000/health
curl -sS -o /dev/null -w "ready=%{http_code}\n" http://127.0.0.1:3000/ready
curl -sS -o /dev/null -w "public_health=%{http_code}\n" https://www.sarkarisuchnaindia.com/health || true
curl -sS -o /dev/null -w "public_ready=%{http_code}\n" https://www.sarkarisuchnaindia.com/ready || true

echo "=== BLOBS ==="
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

echo "=== EXPECTED_BLOBS_FROM_HEAD ==="
git rev-parse HEAD
git ls-tree HEAD -- \
  server/lib/recruitment/preparationPipeline/structuredNormalizeMerge.js \
  server/lib/recruitment/preparationPipeline/updateMergeContext.js \
  server/lib/recruitment/productionRuntime/index.js \
  server/services/generatorDraft.service.js

echo "=== STRUCTURAL ==="
node - <<'NODE'
const fs = require("fs");
const checks = [
  ["structuredNormalizeMerge exports", "server/lib/recruitment/preparationPipeline/structuredNormalizeMerge.js", /normalizeRawToPublisherSections/],
  ["structured merge REMOVE", "server/lib/recruitment/preparationPipeline/structuredNormalizeMerge.js", /REMOVE/],
  ["updateMergeContext structured", "server/lib/recruitment/preparationPipeline/updateMergeContext.js", /structuredNormalizeMerge/],
  ["legacyMerge fallback", "server/lib/recruitment/preparationPipeline/updateMergeContext.js", /legacyMergePublisherSectionText/],
  ["pipeline export", "server/lib/recruitment/preparationPipeline/index.js", /structuredNormalizeMerge/],
  ["runtime structured", "server/lib/recruitment/productionRuntime/index.js", /structuredNormalizeMerge/],
  ["runtime classifications", "server/lib/recruitment/productionRuntime/index.js", /mergeClassifications/],
  ["BLOCKED gate", "server/lib/recruitment/productionRuntime/index.js", /BLOCKED/],
  ["lifecycle eventType", "server/services/recruitmentLifecycle.service.js", /eventType|structured/i],
  ["draft combined preview", "server/services/generatorDraft.service.js", /resolveCombinedPreviewText/],
  ["pdf extractionQuality", "server/services/pdfGeneratorExtract.service.js", /extractionQuality/]
];
for (const [name, path, re] of checks) {
  const t = fs.readFileSync(path, "utf8");
  if (!re.test(t)) {
    console.error("FAIL", name, path);
    process.exit(2);
  }
  console.log("OK", name);
}
NODE

echo "POSTCHECK_OK"
