#!/usr/bin/env bash
# Read-only postcheck after Workflow IA deploy. No crawler / publish.
set -euo pipefail
cd /root/sarkari-suchna-india

echo "=== HEALTH ==="
curl -sS -o /dev/null -w "health=%{http_code}\n" http://127.0.0.1:3000/health
curl -sS -o /dev/null -w "ready=%{http_code}\n" http://127.0.0.1:3000/ready

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
  dormant: f.isAutomationDormant(),
  blocked: f.isAutoPublishBlocked()
}));
NODE

echo "=== BLOBS ==="
for f in \
  public/assets/js/admin-workflow-ia.js \
  public/assets/css/admin/admin-design-system.css \
  public/assets/js/admin-nav.js \
  private/admin-dashboard.html \
  private/admin-recruitments.html \
  private/admin-recruitment-review-queue.html \
  private/admin-editorial-review.html \
  private/admin-page-manager.html \
  private/generator.html \
  private/admin-monitoring.html \
  private/admin-monitoring-updates.html \
  private/admin-automation-control-center.html
do
  printf "%s " "$f"
  git hash-object "$f"
done

echo "=== MARKERS ==="
for f in private/admin-dashboard.html private/admin-recruitments.html private/admin-recruitment-review-queue.html private/admin-editorial-review.html private/generator.html private/admin-automation-control-center.html; do
  echo "-- $f"
  grep -E "adm-wf|admin-workflow-ia|admWfScenarios|Needs Matching|Approve" "$f" | head -n 3 || true
done

echo "POSTCHECK_OK"
