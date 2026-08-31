#!/usr/bin/env bash
# Read-only postcheck after lifecycle + generator publish deploy.
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
NODE

echo "=== MARKERS ==="
grep -n 'Manual Publish\|generatorSaveState\|data-label-desktop="Manual Publish"' private/generator.html | head -n 8 || true
grep -n 'rrqManualPublishLink\|Attach to existing Recruitment\|Needs Matching' private/admin-recruitment-review-queue.html | head -n 10 || true
grep -n 'One recruitment = one permanent\|Editorial Review (optional QA)\|Event Timeline' private/admin-recruitments.html | head -n 10 || true
grep -n 'already published\|First-time publishing' private/admin-page-manager.html | head -n 6 || true
grep -n 'Optional content QA\|Manual Publish (Generator)' private/admin-editorial-review.html | head -n 8 || true
grep -n 'draftId\|/generator#drafts\|nextStepMessage\|setAttachSelection' public/assets/js/admin-recruitment-review-queue.js | head -n 12 || true

echo "POSTCHECK_OK"
