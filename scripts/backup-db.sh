#!/usr/bin/env bash
# Daily MySQL backup — cron example:
#   0 2 * * * /path/to/project/scripts/backup-db.sh >> /var/log/db-backup.log 2>&1
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
: "${DB_NAME:?Set DB_NAME in .env}"
HOST="${DB_HOST:-127.0.0.1}"
USER="${DB_USER:-root}"
DIR="$ROOT/backups/mysql"
mkdir -p "$DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$DIR/${DB_NAME}_${STAMP}.sql"
export MYSQL_PWD="${DB_PASS:-}"
mysqldump -h "$HOST" -u "$USER" \
  --single-transaction --routines --triggers \
  "$DB_NAME" > "$OUT"
echo "Backup written: $OUT"
