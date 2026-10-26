#!/usr/bin/env bash
# Creates the full ERP schema in a NEW, EMPTY PostgreSQL database.
#
# Why this exists: the early migrations were written against a database that already had some tables, so
# `prisma migrate deploy` alone cannot build a new database. This script loads the current schema snapshot
# (prisma/fresh-install/schema.sql), marks every migration in prisma/migrations as applied, and then runs
# `migrate deploy` so later migrations apply normally.
#
# Usage (from the backend folder):
#   DATABASE_URL=postgresql://user:password@host:5432/erp scripts/db-fresh-install.sh        # empty database only
#   DATABASE_URL=postgresql://user:password@host:5432/erp scripts/db-fresh-install.sh auto   # install or migrate
# Needs: psql, and the Prisma CLI (set PRISMA_CMD to override, e.g. inside the backend image).
# Refresh the snapshot after adding migrations: scripts/db-snapshot.sh
set -euo pipefail

cd "$(dirname "$0")/.."

: "${DATABASE_URL:?Set DATABASE_URL to the new, empty database}"
PRISMA_CMD="${PRISMA_CMD:-npx prisma}"
DB_URL="${DATABASE_URL%%\?*}"

table_count="$(psql "$DB_URL" -At -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"
# `auto`: used by the deployment migrate job. Empty database -> full install; existing database -> migrate deploy.
if [ "${1:-}" = "auto" ] && [ "$table_count" != "0" ]; then
  echo "Database already has tables. Applying pending migrations only..."
  $PRISMA_CMD migrate deploy
  exit 0
fi
if [ "$table_count" != "0" ]; then
  echo "Stopped: the database already has ${table_count} table(s). This script only installs into an empty database."
  echo "For an existing database run: ${PRISMA_CMD} migrate deploy"
  exit 1
fi

echo "==> [1/3] Loading schema snapshot..."
psql "$DB_URL" -q -v ON_ERROR_STOP=1 --single-transaction -f prisma/fresh-install/schema.sql >/dev/null

echo "==> [2/3] Marking existing migrations as applied..."
for dir in prisma/migrations/*/; do
  name="$(basename "$dir")"
  $PRISMA_CMD migrate resolve --applied "$name" >/dev/null
  echo "    ${name}"
done

echo "==> [3/3] Applying any newer migrations..."
$PRISMA_CMD migrate deploy

echo "Fresh install finished. Next: create the first Admin user (see DEPLOYMENT.md)."
