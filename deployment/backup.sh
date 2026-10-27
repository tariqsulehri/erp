#!/usr/bin/env bash
# Writes a compressed PostgreSQL backup to ./backups and deletes local backups older than KEEP_DAYS.
# deploy.sh runs it before migrating (skip with --no-backup). Nightly from cron, for example:
#   15 1 * * * cd /deployments/erp && ./backup.sh nightly >> backups/backup.log 2>&1
# Copy ./backups to storage outside this server as well; a backup on the same disk is not enough.
set -euo pipefail

cd "$(dirname "$0")"
# shellcheck source=lib.sh
. ./lib.sh

LABEL="${1:-manual}"
KEEP_DAYS="${KEEP_DAYS:-30}"
DB_URL="$(env_value .env.backend DATABASE_URL)"
DB_URL="${DB_URL%%\?*}"
[ -n "$DB_URL" ] || { fail ".env.backend has no DATABASE_URL."; exit 1; }

mkdir -p backups
file="backups/erp-$(date -u +%Y%m%d-%H%M%S)-${LABEL}.dump"

# pg_dump must be the same major version as the server or newer. Prefer the one installed on this host;
# fall back to the backend image (PostgreSQL 17 client) only when the host has none.
server_major="$(psql "$DB_URL" -At -c 'SHOW server_version_num' 2>/dev/null | cut -c1-2 || true)"
host_major="$(pg_dump --version 2>/dev/null | grep -oE '[0-9]+' | head -n 1 || true)"
if [ -n "$host_major" ] && { [ -z "$server_major" ] || [ "$host_major" -ge "$server_major" ]; }; then
  pg_dump --format=custom --no-owner "$DB_URL" > "$file"
else
  [ -n "$server_major" ] && [ "$server_major" -gt 17 ] && { fail "The database is PostgreSQL ${server_major}; install postgresql-client-${server_major} on this host."; exit 1; }
  APP_TAG="${APP_TAG:-latest}" $COMPOSE run --rm --no-deps -T migrate sh -c 'pg_dump --format=custom --no-owner "${DATABASE_URL%%\?*}"' > "$file"
fi

if [ ! -s "$file" ]; then
  rm -f "$file"
  fail "Backup failed: the file is empty. Deployment should not continue."
  exit 1
fi
info "Backup written: $file ($(du -h "$file" | cut -f1))"

find backups -name 'erp-*.dump' -mtime "+${KEEP_DAYS}" -delete
