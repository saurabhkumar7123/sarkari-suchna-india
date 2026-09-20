#!/usr/bin/env bash
# Post-deploy structural checks for Update Draft → Combined Preview workflow.
# No live official PDF download. No automation activation.
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

echo "=== BLOBS ==="
git hash-object \
  server/lib/recruitment/preparationPipeline/updateMergeContext.js \
  server/lib/recruitment/productionRuntime/index.js \
  server/controllers/public/misc.controller.js \
  public/assets/js/generator.js \
  public/assets/js/admin-monitoring.js

echo "=== STRUCTURAL ==="
node - <<'NODE'
const fs = require("fs");
const checks = [
  ["updateMergeContext", "server/lib/recruitment/preparationPipeline/updateMergeContext.js", /resolveCombinedPreviewText/],
  ["BLOCKED gate", "server/lib/recruitment/productionRuntime/index.js", /BLOCKED/],
  ["preview markers", "server/controllers/public/misc.controller.js", /injectCombinedPreviewMarkers/],
  ["generator combine", "public/assets/js/generator.js", /combinePreview/],
  ["official site", "public/assets/js/admin-monitoring.js", /Open Official Site/],
  ["RRQ PDF", "public/assets/js/admin-recruitment-review-queue.js", /Open Official PDF|Verify PDF/]
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
