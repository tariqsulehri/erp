#!/usr/bin/env bash
# Writes a compressed PostgreSQL backup to ./backups and deletes local backups older than KEEP_DAYS.
# Run before every deploy (deploy.sh does this) and every night from cron, for example:
#   15 1 * * * cd /opt/erp/deployment && APP_TAG=$(tail -1 .deploy-history | cut -d' ' -f1) ./backup.sh nightly >> backups/backup.log 2>&1
# Copy ./backups to storage outside this server as well (see DEPLOYMENT.md); a backup on the same disk is not enough.
set -euo pipefail

cd "$(dirname "$0")"

LABEL="${1:-manual}"
KEEP_DAYS="${KEEP_DAYS:-30}"
export APP_TAG="${APP_TAG:-$(tail -n 1 .deploy-history 2>/dev/null | cut -d' ' -f1)}"
if [ -z "$APP_TAG" ]; then
  echo "Set APP_TAG (any deployed version) so the backup can use the backend image's pg_dump."
  exit 1
fi

mkdir -p backups
file="backups/erp-$(date -u +%Y%m%d-%H%M%S)-${LABEL}.dump"

# pg_dump runs inside the backend image (it has the PostgreSQL client) with the app's DATABASE_URL.
docker compose run --rm --no-deps -T migrate sh -c 'pg_dump --format=custom --no-owner "${DATABASE_URL%%\?*}"' > "$file"

if [ ! -s "$file" ]; then
  rm -f "$file"
  echo "Backup failed: the file is empty. Deployment should not continue."
  exit 1
fi
echo "Backup written: $file ($(du -h "$file" | cut -f1))"

find backups -name 'erp-*.dump' -mtime "+${KEEP_DAYS}" -delete
