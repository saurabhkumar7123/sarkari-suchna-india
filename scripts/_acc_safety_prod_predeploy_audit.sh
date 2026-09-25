#!/usr/bin/env bash
# Read-only production pre-deploy audit for ACC/automation safety deploy.
# Does NOT enable LIVE / Master / Telegram / auto-publish.
set -uo pipefail
cd /root/sarkari-suchna-india

echo "=== GIT ==="
echo "PROD_HEAD=$(git rev-parse HEAD)"
git log -3 --oneline
echo "STATUS_SB:"
git status -sb | head -n 20 || true

echo "=== NODE/NPM ==="
node -v
npm -v

echo "=== PM2 ==="
pm2 list || true

echo "=== FLAGS / CONTROL PLANE ==="
NODE_ENV=production node - <<'NODE'
const f = require("./server/config/automationFlags");
const g = f.getAutomationFlags();
let plane = null;
try {
  plane = require("./server/config/automationControlPlane").getControlPlaneSnapshot();
} catch (e) {
  plane = { error: String(e.message) };
}
let master = null;
try {
  master = require("./server/config/automationKillSwitch").isAutomationMasterEnabled();
} catch (e) {
  master = { error: String(e.message) };
}
console.log(JSON.stringify({
  AUTO_PUBLISH_ENABLED: g.AUTO_PUBLISH_ENABLED,
  AUTO_DRAFT_ENABLED: g.AUTO_DRAFT_ENABLED,
  LIVE_CRAWLER_ENABLED: g.LIVE_CRAWLER_ENABLED,
  PRODUCTION_MONITORING_ENABLED: g.PRODUCTION_MONITORING_ENABLED,
  SCHEDULER_ACTIVATION_ENABLED: g.SCHEDULER_ACTIVATION_ENABLED,
  WORKER_ACTIVATION_ENABLED: g.WORKER_ACTIVATION_ENABLED,
  TELEGRAM_DELIVERY_ENABLED: g.TELEGRAM_DELIVERY_ENABLED,
  NOTIFICATION_GATEWAY_ENABLED: g.NOTIFICATION_GATEWAY_ENABLED,
  AUTOMATION_MASTER_ENABLED: g.AUTOMATION_MASTER_ENABLED,
  dormant: f.isAutomationDormant(),
  blocked: f.isAutoPublishBlocked(),
  master,
  plane
}, null, 2));
NODE

echo "=== KEY FILES ==="
for f in \
  server/config/automationControlPlane.js \
  server/config/automationKillSwitch.js \
  server/services/updates/monitoringHttpSafety.js \
  server/services/updates/monitoringDryRun.js \
  server/services/updates/sourceGovernancePolicy.js \
  server/services/updates/monitoringSecurityAudit.js
do
  if [ -f "$f" ]; then echo "PRESENT $f"; else echo "MISSING $f"; fi
done

echo "=== SOURCE REGISTRY COUNTS (readonly) ==="
NODE_ENV=production node - <<'NODE'
require("dotenv").config();
const { fetchSites } = require("./server/services/updates/updates.repository");
(async () => {
  try {
    const sites = await fetchSites();
    const total = sites.length;
    const enabled = sites.filter((s) => s.active === 1 || s.active === true).length;
    const disabled = total - enabled;
    const broken = sites.filter((s) => s.broken === 1 || s.broken === true).length;
    console.log(JSON.stringify({ total, enabled, disabled, broken }, null, 2));
    console.log("SAMPLE_ROWS=" + Math.min(sites.length, 40));
    for (const r of sites.slice(0, 40)) {
      console.log(JSON.stringify({
        id: r.id,
        name: r.name,
        url: r.url,
        active: r.active,
        broken: r.broken,
        selector: r.selector,
        failCount: r.failCount,
        lastCheckedAt: r.lastCheckedAt
      }));
    }
  } catch (e) {
    console.error("SOURCE_QUERY_FAILED", e.message);
    process.exitCode = 2;
  } finally {
    process.exit();
  }
})();
NODE

echo "=== HEALTH ==="
curl -sS -o /dev/null -w "local_health=%{http_code}\n" http://127.0.0.1:3000/health || true
curl -sS -o /dev/null -w "local_ready=%{http_code}\n" http://127.0.0.1:3000/ready || true
curl -sS -o /dev/null -w "public_health=%{http_code}\n" https://www.sarkarisuchnaindia.com/health || true
echo "PREDEPLOY_AUDIT_OK"
