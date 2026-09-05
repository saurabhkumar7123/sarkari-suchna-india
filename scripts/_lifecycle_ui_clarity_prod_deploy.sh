#!/usr/bin/env bash
# Selective production deploy: Recruitment/Event/Draft/Public Page lifecycle UI clarity.
# Presentation + draft-list enrichment + page-manager linkage display only.
# No schema. No automation enable. No DB wipe/unlink.
# Usage on VPS: ACC_DEPLOY_SHA=<sha> bash scripts/_lifecycle_ui_clarity_prod_deploy.sh
set -euo pipefail

ROOT="${1:-/root/sarkari-suchna-india}"
SHA="${ACC_DEPLOY_SHA:?ACC_DEPLOY_SHA required}"
cd "$ROOT"

FILES=(
  private/admin-recruitments.html
  private/admin-recruitment-review-queue.html
  private/admin-page-manager.html
  private/generator.html
  public/assets/js/admin-recruitment-operations.js
  public/assets/js/admin-recruitment-review-queue.js
  public/assets/js/admin-page-manager.js
  public/assets/js/admin-generator-drafts.js
  public/assets/js/generator.js
  public/assets/css/admin/recruitment-operations.css
  public/assets/css/admin/generator-saas.css
  server/services/generatorDraft.service.js
  server/controllers/admin/generatorDraft.controller.js
  server/controllers/admin/page.controller.js
  server/repositories/page.repository.js
  tests/recruitmentLifecycle.uiClarity.test.js
  tests/recruitmentLifecycle.samePageWiring.test.js
  tests/adminWorkflowIa.ux.test.js
  scripts/_lifecycle_ui_clarity_prod_deploy.sh
  scripts/_lifecycle_ui_clarity_prod_postcheck.sh
)

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="/root/backups/lifecycle_ui_clarity_${TS}"
mkdir -p "$BACKUP"
echo "BACKUP=$BACKUP"

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    mkdir -p "$BACKUP/$(dirname "$f")"
    cp -a "$f" "$BACKUP/$f"
  fi
done
cp -a .env "$BACKUP/.env" 2>/dev/null || true

if [ -x scripts/backup-db.sh ]; then
  BACKUP_ENV_FILE="$ROOT/.env" bash scripts/backup-db.sh || echo "DB_BACKUP_WARN"
  NEWEST="$(ls -1t backups/mysql/*.sql 2>/dev/null | head -n 1 || true)"
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
  private/admin-recruitments.html \
  private/generator.html \
  public/assets/js/generator.js \
  public/assets/js/admin-recruitment-operations.js \
  public/assets/js/admin-generator-drafts.js \
  server/services/generatorDraft.service.js \
  server/controllers/admin/page.controller.js

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
}));
if (g.AUTO_PUBLISH_ENABLED === true) {
  console.error("REFUSING: AUTO_PUBLISH_ENABLED unexpectedly true");
  process.exit(2);
}
if (
  g.LIVE_CRAWLER_ENABLED === true ||
  g.PRODUCTION_MONITORING_ENABLED === true ||
  g.RECRUITMENT_PIPELINE_ENABLED === true ||
  g.AUTO_DRAFT_ENABLED === true
) {
  console.error("REFUSING: automation/monitoring flags unexpectedly true");
  process.exit(2);
}
NODE

node - <<'NODE'
const fs = require("fs");
const paths = [
  "private/admin-recruitments.html",
  "private/generator.html",
  "private/admin-recruitment-review-queue.html",
  "private/admin-page-manager.html",
  "public/assets/js/generator.js",
  "public/assets/js/admin-recruitment-operations.js",
  "public/assets/js/admin-recruitment-review-queue.js",
  "public/assets/js/admin-generator-drafts.js",
  "public/assets/js/admin-page-manager.js",
  "server/services/generatorDraft.service.js",
  "server/controllers/admin/generatorDraft.controller.js",
  "server/controllers/admin/page.controller.js",
  "server/repositories/page.repository.js"
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
const rec = fs.readFileSync("private/admin-recruitments.html", "utf8");
if (!rec.includes("recruitmentLifecycleOverview") || !rec.includes("draftBindEventSelect")) {
  console.error("REFUSING: Recruitments missing lifecycle overview / draft event selector");
  process.exit(2);
}
const genJs = fs.readFileSync("public/assets/js/generator.js", "utf8");
if (!genJs.includes("UPDATE EXISTING PAGE") || !genJs.includes("CREATE NEW PUBLIC PAGE")) {
  console.error("REFUSING: generator.js missing UPDATE/CREATE mode labels");
  process.exit(2);
}
if (!genJs.includes("Server draft kept open for editing")) {
  console.error("REFUSING: generator.js missing keep-open save draft UX");
  process.exit(2);
}
if (!genJs.includes("applyLinkedPublicPageToGenerator")) {
  console.error("REFUSING: generator.js missing linked public page hydration");
  process.exit(2);
}
const draftsJs = fs.readFileSync("public/assets/js/admin-generator-drafts.js", "utf8");
if (!draftsJs.includes("Saved Draft Management") || !draftsJs.includes("Recruitment:")) {
  console.error("REFUSING: drafts manager missing context labels");
  process.exit(2);
}
const svc = fs.readFileSync("server/services/generatorDraft.service.js", "utf8");
if (!svc.includes("enrichDraftListRows")) {
  console.error("REFUSING: draft service missing list enrichment");
  process.exit(2);
}
const pageRepo = fs.readFileSync("server/repositories/page.repository.js", "utf8");
if (!pageRepo.includes("recruitment_id, recruitment_event_id")) {
  console.error("REFUSING: page list missing recruitment linkage columns");
  process.exit(2);
}
const rrqJs = fs.readFileSync("public/assets/js/admin-recruitment-review-queue.js", "utf8");
if (!rrqJs.includes("Not matched yet") || !rrqJs.includes("/generator?draftId=")) {
  console.error("REFUSING: Review Center missing Not matched yet / draftId deep link");
  process.exit(2);
}
if (rrqJs.includes("Standalone Recruitment created")) {
  console.error("REFUSING: Standalone still claims recruitment created");
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
