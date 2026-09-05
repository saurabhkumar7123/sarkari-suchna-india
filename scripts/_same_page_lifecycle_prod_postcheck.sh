#!/usr/bin/env bash
# Read-only postcheck after same-page lifecycle deploy.
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
console.log(JSON.stringify({
  AUTO_PUBLISH_ENABLED: g.AUTO_PUBLISH_ENABLED,
  LIVE_CRAWLER_ENABLED: g.LIVE_CRAWLER_ENABLED,
  PRODUCTION_MONITORING_ENABLED: g.PRODUCTION_MONITORING_ENABLED,
  RECRUITMENT_PIPELINE_ENABLED: g.RECRUITMENT_PIPELINE_ENABLED,
  AUTO_DRAFT_ENABLED: g.AUTO_DRAFT_ENABLED,
  dormant: f.isAutomationDormant(),
  blocked: f.isAutoPublishBlocked()
}, null, 2));
if (g.AUTO_PUBLISH_ENABLED === true) process.exit(2);
if (g.AUTO_DRAFT_ENABLED === true || g.LIVE_CRAWLER_ENABLED === true || g.PRODUCTION_MONITORING_ENABLED === true || g.RECRUITMENT_PIPELINE_ENABLED === true) process.exit(2);
NODE

echo "=== MARKERS ==="
test -f server/lib/recruitment/canonicalPublicPage.js
grep -n 'evaluateSamePagePublishGuard\|status(409)' server/controllers/admin/generator.controller.js | head -n 8 || true
grep -n 'applyLinkedPublicPageToGenerator\|Updating existing public page\|Creating new public page' public/assets/js/generator.js | head -n 12 || true
grep -n 'linked_draft\|publishedSlug\|Left standalone' public/assets/js/admin-recruitment-review-queue.js | head -n 12 || true
grep -n 'manualUpdateOpenGenerator\|openBoundDraftGeneratorBtn' private/admin-recruitments.html | head -n 8 || true
grep -n 'getDraftWithPublishContext\|linkedPublicPage' server/controllers/admin/generatorDraft.controller.js | head -n 8 || true

echo "=== HASHES ==="
git hash-object \
  server/lib/recruitment/canonicalPublicPage.js \
  server/controllers/admin/generator.controller.js \
  public/assets/js/generator.js \
  public/assets/js/admin-recruitment-review-queue.js \
  private/admin-recruitments.html

echo "POSTCHECK_OK"
