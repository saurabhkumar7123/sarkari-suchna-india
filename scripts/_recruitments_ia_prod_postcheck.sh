#!/usr/bin/env bash
set -euo pipefail
echo "=== health/ready ==="
curl -sS -o /dev/null -w "health=%{http_code}\n" http://127.0.0.1:3000/health
curl -sS -o /dev/null -w "ready=%{http_code}\n" http://127.0.0.1:3000/ready
echo "=== public ==="
curl -sS -o /dev/null -w "public_health=%{http_code}\n" https://www.sarkarisuchnaindia.com/health || true
curl -sS -o /dev/null -w "public_ready=%{http_code}\n" https://www.sarkarisuchnaindia.com/ready || true
echo "=== PM2 ==="
pm2 list
echo "=== nginx ==="
nginx -t
echo "=== flags ==="
NODE_ENV=production node -e 'const f=require("./server/config/automationFlags"); const g=f.getAutomationFlags(); console.log(JSON.stringify({AUTO_PUBLISH_ENABLED:g.AUTO_PUBLISH_ENABLED,LIVE_CRAWLER_ENABLED:g.LIVE_CRAWLER_ENABLED,PRODUCTION_MONITORING_ENABLED:g.PRODUCTION_MONITORING_ENABLED}));'
