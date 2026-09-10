#!/usr/bin/env bash
# Selective production deploy: Recruitment Lifecycle Hardening (code-only).
# No schema. No automation enable. No DB mutation.
# Usage on VPS: ACC_DEPLOY_SHA=<sha> bash scripts/_lifecycle_hardening_prod_deploy.sh
set -euo pipefail

ROOT="${1:-/root/sarkari-suchna-india}"
SHA="${ACC_DEPLOY_SHA:?ACC_DEPLOY_SHA required}"
cd "$ROOT"

FILES=(
  server/lib/recruitment/lifecyclePublishPolicy.js
  server/lib/recruitment/canonicalPublicPage.js
  server/lib/recruitment/lifecycleAtomicPublish.js
  server/lib/recruitment/publisherDraftValidation.js
  server/lib/recruitment/pageRestore.js
  server/lib/recruitment/productionRuntime/index.js
  server/controllers/admin/generator.controller.js
  server/controllers/admin/enterprisePersistence.controller.js
  server/api/admin/enterprisePersistence.routes.js
  server/services/recruitmentLifecycle.service.js
  server/services/generatorDraft.service.js
  server/repositories/generatorDraft.repository.js
  public/assets/js/generator.js
  public/assets/js/admin-recruitment-review-queue.js
  tests/canonicalPublicPage.test.js
  tests/recruitmentLifecycleEngine.test.js
  tests/recruitmentLifecycle.samePageWiring.test.js
  tests/recruitmentLifecycle.uiClarity.test.js
  tests/packageAMP4B.lifecycleCompatibility.test.js
  tests/recruitmentLifecycle.hardening.test.js
  tests/recruitmentLifecycle.eventRevision.test.js
  scripts/_lifecycle_hardening_prod_deploy.sh
  scripts/_lifecycle_hardening_prod_postcheck.sh
)

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="/root/backups/lifecycle_hardening_${TS}"
mkdir -p "$BACKUP"
echo "BACKUP=$BACKUP"
echo "PREV_PROD_HEAD=$(git rev-parse HEAD 2>/dev/null || true)"

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    mkdir -p "$BACKUP/$(dirname "$f")"
    cp -a "$f" "$BACKUP/$f"
  fi
done
cp -a .env "$BACKUP/.env" 2>/dev/null || true

if [ -x scripts/backup-db.sh ]; then
  BACKUP_ENV_FILE="$ROOT/.env" bash scripts/backup-db.sh || echo "DB_BACKUP_WARN"
  NEWEST="$(ls -1t backups/mysql/*.sql backups/mysql/*.sql.gz 2>/dev/null | head -n 1 || true)"
  if [ -n "${NEWEST:-}" ]; then
    cp -a "$NEWEST" "$BACKUP/"
    echo "DB_BACKUP_COPIED=$NEWEST"
  fi
else
  echo "DB_BACKUP_SCRIPT_MISSING"
fi

git fetch origin main
git checkout "$SHA" -- "${FILES[@]}"
echo "CHECKOUT_DONE sha=$SHA"

echo "LOCAL_BLOBS"
git hash-object \
  server/lib/recruitment/lifecyclePublishPolicy.js \
  server/lib/recruitment/canonicalPublicPage.js \
  server/lib/recruitment/lifecycleAtomicPublish.js \
  server/lib/recruitment/productionRuntime/index.js \
  server/controllers/admin/generator.controller.js \
  server/services/recruitmentLifecycle.service.js \
  public/assets/js/generator.js \
  public/assets/js/admin-recruitment-review-queue.js

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
if (g.AUTO_PUBLISH_ENABLED === true) {
  console.error("REFUSING: AUTO_PUBLISH_ENABLED unexpectedly true");
  process.exit(2);
}
const mustStayFalse = [
  "AUTO_DRAFT_ENABLED",
  "LIVE_CRAWLER_ENABLED",
  "PRODUCTION_MONITORING_ENABLED",
  "RECRUITMENT_PIPELINE_ENABLED",
  "TELEGRAM_DELIVERY_ENABLED",
  "SCHEDULER_ACTIVATION_ENABLED",
  "WORKER_ACTIVATION_ENABLED",
  "CRON_ACTIVATION_ENABLED"
];
for (const k of mustStayFalse) {
  if (g[k] === true) {
    console.error("REFUSING:", k, "unexpectedly true");
    process.exit(2);
  }
}
if (out.dormant !== true || out.blocked !== true) {
  console.error("REFUSING: expected dormant=true and blocked=true");
  process.exit(2);
}
NODE

node - <<'NODE'
const fs = require("fs");
const paths = [
  "server/lib/recruitment/lifecyclePublishPolicy.js",
  "server/lib/recruitment/canonicalPublicPage.js",
  "server/lib/recruitment/lifecycleAtomicPublish.js",
  "server/lib/recruitment/publisherDraftValidation.js",
  "server/lib/recruitment/pageRestore.js",
  "server/lib/recruitment/productionRuntime/index.js",
  "server/controllers/admin/generator.controller.js",
  "server/services/recruitmentLifecycle.service.js",
  "public/assets/js/generator.js",
  "public/assets/js/admin-recruitment-review-queue.js",
  "server/api/admin/enterprisePersistence.routes.js",
  "server/controllers/admin/enterprisePersistence.controller.js"
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
}
const policy = fs.readFileSync("server/lib/recruitment/lifecyclePublishPolicy.js", "utf8");
if (policy.includes('target: PUBLISH_TARGETS.DEDICATED_STATUS_PAGE')) {
  console.error("REFUSING: dedicated status page still a default target");
  process.exit(2);
}
if (!policy.includes("UPDATE_EXISTING_VACANCY_PAGE") || !policy.includes("oneCanonicalPage")) {
  console.error("REFUSING: one-page policy markers missing");
  process.exit(2);
}
const canon = fs.readFileSync("server/lib/recruitment/canonicalPublicPage.js", "utf8");
if (!canon.includes("missing_canonical_page") || !canon.includes("ambiguous_pages")) {
  console.error("REFUSING: canonical guards incomplete");
  process.exit(2);
}
const genCtrl = fs.readFileSync("server/controllers/admin/generator.controller.js", "utf8");
if (!genCtrl.includes("finalizeLifecyclePublish") || !genCtrl.includes("evaluateSamePagePublishGuard")) {
  console.error("REFUSING: generator missing atomic finalize / same-page guard");
  process.exit(2);
}
const runtime = fs.readFileSync("server/lib/recruitment/productionRuntime/index.js", "utf8");
if (!runtime.includes("shouldEnqueueReview") || !runtime.includes("conversionRequired")) {
  console.error("REFUSING: productionRuntime missing NEEDS_MATCHING retention");
  process.exit(2);
}
if (/generatePage|insertPage|updatePageBySlug/.test(runtime)) {
  console.error("REFUSING: productionRuntime appears to call page publish APIs");
  process.exit(2);
}
const life = fs.readFileSync("server/services/recruitmentLifecycle.service.js", "utf8");
if (!life.includes("revision") || !life.includes("superseded")) {
  console.error("REFUSING: event revision/supersession missing");
  process.exit(2);
}
const routes = fs.readFileSync("server/api/admin/enterprisePersistence.routes.js", "utf8");
if (!routes.includes("restorePageVersion") && !routes.includes("/versions/page/")) {
  console.error("REFUSING: page restore route missing");
  process.exit(2);
}
const genJs = fs.readFileSync("public/assets/js/generator.js", "utf8");
if (!genJs.includes("UPDATE EXISTING PAGE") || !genJs.includes("CREATE NEW CANONICAL PAGE")) {
  console.error("REFUSING: generator.js missing UPDATE/CREATE canonical mode labels");
  process.exit(2);
}
const rrq = fs.readFileSync("public/assets/js/admin-recruitment-review-queue.js", "utf8");
if (!rrq.includes("Conversion / Validation") || rrq.includes("Standalone Recruitment created")) {
  console.error("REFUSING: Review Center conversion context / standalone copy issue");
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
