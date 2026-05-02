#!/usr/bin/env bash
# Simple VPS deploy: pull latest code, install deps, reload PM2 cluster.
# Usage (from project root): chmod +x deploy.sh && ./deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "[deploy] git pull..."
git pull

echo "[deploy] npm install..."
npm install

if command -v pm2 >/dev/null 2>&1; then
  PM2=(pm2)
else
  PM2=(npx pm2)
fi

echo "[deploy] PM2 (${PM2[*]})..."
if "${PM2[@]}" describe sarkari-suchna >/dev/null 2>&1; then
  "${PM2[@]}" reload ecosystem.config.js --env production
else
  "${PM2[@]}" start ecosystem.config.js --env production
fi

echo "[deploy] done."
