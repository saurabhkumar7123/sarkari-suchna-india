#!/usr/bin/env bash
# Read-only postcheck after lifecycle hardening deploy.
set -euo pipefail
cd /root/sarkari-suchna-india

echo "=== HEALTH ==="
curl -sS -o /dev/null -w "health=%{http_code}\n" http://127.0.0.1:3000/health
curl -sS -o /dev/null -w "ready=%{http_code}\n" http://127.0.0.1:3000/ready
curl -sS -o /dev/null -w "public_health=%{http_code}\n" https://www.sarkarisuchnaindia.com/health || true
curl -sS -o /dev/null -w "public_ready=%{http_code}\n" https://www.sarkarisuchnaindia.com/ready || true

echo "=== PM2 ==="
pm2 jlist | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")); for (const p of d) console.log(p.name, p.pm2_env.status, p.pid);'

echo "=== NGINX ==="
nginx -t
systemctl is-active nginx || true

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
  TELEGRAM_DELIVERY_ENABLED: g.TELEGRAM_DELIVERY_ENABLED,
  SCHEDULER_ACTIVATION_ENABLED: g.SCHEDULER_ACTIVATION_ENABLED,
  WORKER_ACTIVATION_ENABLED: g.WORKER_ACTIVATION_ENABLED,
  CRON_ACTIVATION_ENABLED: g.CRON_ACTIVATION_ENABLED,
  dormant: f.isAutomationDormant(),
  blocked: f.isAutoPublishBlocked()
};
console.log(JSON.stringify(out, null, 2));
if (g.AUTO_PUBLISH_ENABLED === true) process.exit(2);
if (
  g.AUTO_DRAFT_ENABLED === true ||
  g.LIVE_CRAWLER_ENABLED === true ||
  g.PRODUCTION_MONITORING_ENABLED === true ||
  g.RECRUITMENT_PIPELINE_ENABLED === true ||
  g.TELEGRAM_DELIVERY_ENABLED === true ||
  g.SCHEDULER_ACTIVATION_ENABLED === true ||
  g.WORKER_ACTIVATION_ENABLED === true ||
  g.CRON_ACTIVATION_ENABLED === true
) process.exit(2);
if (out.dormant !== true || out.blocked !== true) process.exit(2);
NODE

echo "=== MARKERS ==="
test -f server/lib/recruitment/lifecycleAtomicPublish.js
test -f server/lib/recruitment/pageRestore.js
grep -n 'UPDATE_EXISTING_VACANCY_PAGE\|oneCanonicalPage' server/lib/recruitment/lifecyclePublishPolicy.js | head -n 8 || true
grep -n 'missing_canonical_page\|ambiguous_pages\|finalizeLifecyclePublish' server/lib/recruitment/canonicalPublicPage.js server/controllers/admin/generator.controller.js | head -n 16 || true
grep -n 'shouldEnqueueReview\|conversionRequired' server/lib/recruitment/productionRuntime/index.js | head -n 12 || true
grep -n 'superseded\|revision' server/services/recruitmentLifecycle.service.js | head -n 12 || true
grep -n 'CREATE NEW CANONICAL PAGE\|UPDATE EXISTING PAGE\|draftMarkedPublished' public/assets/js/generator.js | head -n 12 || true
grep -n 'Conversion / Validation\|Left standalone' public/assets/js/admin-recruitment-review-queue.js | head -n 12 || true
grep -n 'versions/page\|restorePageVersion' server/api/admin/enterprisePersistence.routes.js server/controllers/admin/enterprisePersistence.controller.js | head -n 12 || true

echo "=== NO PUBLISH PATH IN RUNTIME ==="
if grep -E 'generatePage|insertPage|updatePageBySlug' server/lib/recruitment/productionRuntime/index.js; then
  echo "FAIL: productionRuntime references page publish APIs"
  exit 2
fi
echo "OK: no page-publish API references in productionRuntime"

echo "=== HASHES ==="
git hash-object \
  server/lib/recruitment/lifecyclePublishPolicy.js \
  server/lib/recruitment/canonicalPublicPage.js \
  server/lib/recruitment/lifecycleAtomicPublish.js \
  server/lib/recruitment/productionRuntime/index.js \
  server/controllers/admin/generator.controller.js \
  server/services/recruitmentLifecycle.service.js \
  public/assets/js/generator.js \
  public/assets/js/admin-recruitment-review-queue.js

echo "POSTCHECK_OK"
