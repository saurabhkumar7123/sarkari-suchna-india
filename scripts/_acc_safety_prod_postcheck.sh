#!/usr/bin/env bash
# Read-only ACC post-deploy checks on production (no LIVE activation).
set -uo pipefail
cd /root/sarkari-suchna-india

echo "=== ACC MODULE REQUIRE ==="
NODE_ENV=production node <<'NODE'
[
  "./server/config/automationControlPlane",
  "./server/config/automationKillSwitch",
  "./server/services/updates/monitoringHttpSafety",
  "./server/services/updates/monitoringDryRun",
  "./server/services/updates/sourceGovernancePolicy",
  "./server/services/updates/monitoringSecurityAudit",
  "./server/services/automationControlCenter.service"
].forEach((p) => {
  require(p);
  console.log("OK_REQUIRE", p);
});
const f = require("./server/config/automationFlags");
const p = require("./server/config/automationControlPlane");
const s = p.getControlPlaneSnapshot();
console.log(JSON.stringify({
  mode: s.mode,
  live: s.live,
  master: s.masterEnabled,
  dormant: f.isAutomationDormant(),
  blocked: f.isAutoPublishBlocked(),
  telegram: f.getAutomationFlags().TELEGRAM_DELIVERY_ENABLED,
  canEnqueueLive: f.canEnqueueLiveCrawlerJobs(),
  canStartScheduler: f.canStartMonitoringScheduler(),
  canRunWorkers: f.canRunAutomationWorkers(),
  canTelegram: f.canDeliverTelegram(),
  canAutoDraft: f.canAutoDraft()
}, null, 2));
NODE

echo "=== ACC HTML HASHES ==="
git hash-object \
  private/admin-automation-control-center.html \
  public/assets/js/admin-automation-control-center.js \
  public/assets/css/admin/automation-control-center.css \
  server/config/automationControlPlane.js \
  server/services/updates/monitoringDryRun.js

echo "=== MINT + ACC API SNAPSHOT ==="
COOKIE=/tmp/acc_postdeploy_cookie.json
if [ -f scripts/_prod_mint_smoke_session.js ]; then
  node scripts/_prod_mint_smoke_session.js "$COOKIE" >/tmp/acc_mint.out 2>&1 || {
    echo "MINT_FAILED"
    cat /tmp/acc_mint.out | head -n 40
    exit 0
  }
  HDR=$(node -e 'const j=require("/tmp/acc_postdeploy_cookie.json"); const c=(j.cookies||[]).map(x=>x.name+"="+x.value).join("; "); process.stdout.write(c);')
  for path in \
    /api/admin/automation-control-center \
    /api/admin/automation-control-center/dashboard \
    /api/admin/automation-control-center/sources \
    /api/admin/automation-control-center/controls \
    /api/admin/automation-control-center/dry-run \
    /admin/automation-control-center
  do
    code=$(curl -sS -o /tmp/acc_api_body.json -w "%{http_code}" -H "Cookie: $HDR" "http://127.0.0.1:3000$path" || echo ERR)
    echo "GET $path -> $code"
    if [ "$code" = "200" ] && [[ "$path" == /api/* ]]; then
      node -e 'const fs=require("fs"); let j=null; try{j=JSON.parse(fs.readFileSync("/tmp/acc_api_body.json","utf8"));}catch(e){console.log("NON_JSON"); process.exit(0);} const pick=(o,ks)=>ks.reduce((a,k)=>{if(o&&o[k]!==undefined)a[k]=o[k]; return a;},{}); const root=j.data||j; console.log(JSON.stringify(pick(root,["mode","master","controlPlane","systemStatus","publishingControls","dryRun","botCan","botCannot","sourceSummary","sources","status","masterEnabled","emergencyStop"]),null,2).slice(0,2500));'
    fi
  done
  rm -f "$COOKIE"
else
  echo "MINT_SCRIPT_MISSING"
fi

echo "=== AUDIT TAIL (no secrets scan) ==="
NODE_ENV=production node <<'NODE'
const fs = require("fs");
const path = require("path");
const candidates = [
  "logs/pm2-out.log",
  "logs/pm2-error.log",
  "logs/pm2-worker-out.log",
  "server/data/automation-control-plane.json",
  "server/data/automation-master-control.json"
];
const secretRe = /(password|passwd|cookie|authorization|api[_-]?key|jwt|token|secret)\s*[:=]/i;
for (const rel of candidates) {
  const p = path.join("/root/sarkari-suchna-india", rel);
  if (!fs.existsSync(p)) {
    console.log("MISSING", rel);
    continue;
  }
  const raw = fs.readFileSync(p, "utf8");
  const lines = raw.split(/\n/).slice(-80);
  let hits = 0;
  for (const line of lines) {
    if (secretRe.test(line) && !/AUTO_PUBLISH|TELEGRAM_DELIVERY_ENABLED|tokenCount|csrf/i.test(line)) {
      hits += 1;
    }
  }
  console.log(JSON.stringify({ file: rel, bytes: raw.length, recentSecretLikeHits: hits }));
}
try {
  const audit = require("./server/services/updates/monitoringSecurityAudit");
  if (typeof audit.listRecentSecurityEvents === "function") {
    const rows = audit.listRecentSecurityEvents({ limit: 10 });
    console.log("AUDIT_EVENTS", JSON.stringify(rows, null, 2).slice(0, 3000));
  } else if (typeof audit.getRecentAudits === "function") {
    console.log("AUDIT_EVENTS", JSON.stringify(audit.getRecentAudits(10), null, 2).slice(0, 3000));
  } else {
    console.log("AUDIT_API_KEYS", Object.keys(audit));
  }
} catch (e) {
  console.log("AUDIT_LOAD_ERR", e.message);
}
NODE

echo "POSTCHECK_OK"
