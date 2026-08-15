#!/usr/bin/env bash
# Daily MySQL backup — cron example:
#   0 2 * * * /path/to/project/scripts/backup-db.sh >> /var/log/db-backup.log 2>&1
#
# Do NOT `source` .env: values may contain `$` (e.g. `$2`) and `set -u` will abort.
# Parse only DB_* keys as literal text. Never print credentials.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Read KEY=value from .env without shell expansion. Prints the value only.
load_env_key() {
  local want="$1"
  local file="$2"
  local line key val
  [[ -f "$file" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    case "$line" in
      ''|\#*) continue ;;
    esac
    key="${line%%=*}"
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    [[ "$key" == "$want" ]] || continue
    val="${line#*=}"
    case "$val" in
      \"*\") val="${val#\"}"; val="${val%\"}" ;;
      \'*\') val="${val#\'}"; val="${val%\'}" ;;
    esac
    printf '%s' "$val"
    return 0
  done < "$file"
}

ENV_FILE="${BACKUP_ENV_FILE:-$ROOT/.env}"
DB_NAME="$(load_env_key DB_NAME "$ENV_FILE")"
DB_HOST="$(load_env_key DB_HOST "$ENV_FILE")"
DB_PORT="$(load_env_key DB_PORT "$ENV_FILE")"
DB_USER="$(load_env_key DB_USER "$ENV_FILE")"
DB_PASS="$(load_env_key DB_PASS "$ENV_FILE")"
DB_PASSWORD="$(load_env_key DB_PASSWORD "$ENV_FILE")"

: "${DB_NAME:?Set DB_NAME in .env}"
HOST="${DB_HOST:-127.0.0.1}"
PORT="${DB_PORT:-3306}"
USER="${DB_USER:-root}"
PASS="${DB_PASS:-}"
if [[ -z "$PASS" && -n "${DB_PASSWORD:-}" ]]; then
  PASS="$DB_PASSWORD"
fi

DIR="${BACKUP_DIR:-$ROOT/backups/mysql}"
mkdir -p "$DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$DIR/${DB_NAME}_${STAMP}.sql.gz"
SQL_PARTIAL="$DIR/${DB_NAME}_${STAMP}.sql.partial"
GZ_PARTIAL="$OUT.partial"

export MYSQL_PWD="$PASS"
set +e
mysqldump -h "$HOST" -P "$PORT" -u "$USER" \
  --single-transaction --routines --triggers \
  "$DB_NAME" > "$SQL_PARTIAL"
DUMP_STATUS=$?
set -e
unset MYSQL_PWD
PASS=""
DB_PASS=""
DB_PASSWORD=""

if [[ "$DUMP_STATUS" -ne 0 ]]; then
  rm -f "$SQL_PARTIAL" "$GZ_PARTIAL"
  echo "backup-db: mysqldump failed (status=${DUMP_STATUS})" >&2
  exit 1
fi

if [[ ! -s "$SQL_PARTIAL" ]]; then
  rm -f "$SQL_PARTIAL" "$GZ_PARTIAL"
  echo "backup-db: dump is empty" >&2
  exit 1
fi

gzip -c "$SQL_PARTIAL" > "$GZ_PARTIAL"
rm -f "$SQL_PARTIAL"

if [[ ! -s "$GZ_PARTIAL" ]]; then
  rm -f "$GZ_PARTIAL"
  echo "backup-db: compressed dump is empty" >&2
  exit 1
fi

if ! gzip -t "$GZ_PARTIAL" 2>/dev/null; then
  rm -f "$GZ_PARTIAL"
  echo "backup-db: gzip integrity check failed" >&2
  exit 1
fi

if [[ -e "$OUT" ]]; then
  rm -f "$GZ_PARTIAL"
  echo "backup-db: refused to overwrite existing $OUT" >&2
  exit 1
fi
mv "$GZ_PARTIAL" "$OUT"

BYTES="$(wc -c < "$OUT" | tr -d ' ')"
if [[ "${BYTES:-0}" -lt 1 ]]; then
  echo "backup-db: dump size is zero" >&2
  exit 1
fi

echo "Backup written: $OUT"
echo "Database: $DB_NAME"
echo "Size bytes: $BYTES"
echo "Gzip integrity: ok"
