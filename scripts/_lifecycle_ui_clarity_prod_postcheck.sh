#!/usr/bin/env bash
# Read-only postcheck after lifecycle UI clarity deploy.
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
grep -n 'recruitmentLifecycleOverview\|draftBindEventSelect\|Canonical Public Page' private/admin-recruitments.html | head -n 12 || true
grep -n 'UPDATE EXISTING PAGE\|CREATE NEW PUBLIC PAGE\|Server draft kept open\|applyLinkedPublicPageToGenerator' public/assets/js/generator.js | head -n 16 || true
grep -n 'Saved Draft Management\|Recruitment:\|Open Recruitment' public/assets/js/admin-generator-drafts.js | head -n 12 || true
grep -n 'Not matched yet\|rrqNeedsMatchingSummary\|/generator?draftId=' public/assets/js/admin-recruitment-review-queue.js | head -n 12 || true
grep -n 'Open Recruitment\|Canonical Page:\|Current Stage:' public/assets/js/admin-page-manager.js | head -n 12 || true
grep -n 'enrichDraftListRows\|recruitmentTitle' server/services/generatorDraft.service.js | head -n 10 || true
grep -n 'recruitment_id, recruitment_event_id' server/repositories/page.repository.js | head -n 6 || true

echo "=== HASHES ==="
git hash-object \
  private/admin-recruitments.html \
  private/generator.html \
  public/assets/js/generator.js \
  public/assets/js/admin-recruitment-operations.js \
  public/assets/js/admin-generator-drafts.js \
  server/services/generatorDraft.service.js \
  server/controllers/admin/page.controller.js

echo "POSTCHECK_OK"
