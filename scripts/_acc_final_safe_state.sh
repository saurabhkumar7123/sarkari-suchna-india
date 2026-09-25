#!/usr/bin/env bash
cd /root/sarkari-suchna-india
pm2 list
curl -sS -o /dev/null -w "public_health=%{http_code}\n" https://www.sarkarisuchnaindia.com/health || true
curl -sS -o /dev/null -w "public_ready=%{http_code}\n" https://www.sarkarisuchnaindia.com/ready || true
NODE_ENV=production node <<'NODE'
const f = require("./server/config/automationFlags");
const p = require("./server/config/automationControlPlane");
const s = p.getControlPlaneSnapshot();
const g = f.getAutomationFlags();
console.log(JSON.stringify({
  LIVE: s.live === true,
  MASTER: s.masterEnabled === true,
  MODE: s.mode,
  TELEGRAM: g.TELEGRAM_DELIVERY_ENABLED === true,
  AUTO_PUBLISH: g.AUTO_PUBLISH_ENABLED === true,
  AUTO_PUBLISH_LOCKED: f.isAutoPublishBlocked() === true,
  dormant: f.isAutomationDormant() === true
}, null, 2));
NODE
