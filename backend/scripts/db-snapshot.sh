#!/usr/bin/env bash
# Refreshes prisma/fresh-install/schema.sql from a database that has every migration applied.
# Run after adding a migration, and commit the new snapshot with the migration.
#
# Usage (from the backend folder):
#   SNAPSHOT_DATABASE_URL=postgresql://user:password@localhost:5432/erp_dev scripts/db-snapshot.sh
set -euo pipefail

cd "$(dirname "$0")/.."

: "${SNAPSHOT_DATABASE_URL:?Set SNAPSHOT_DATABASE_URL to a database with all migrations applied}"
DB_URL="${SNAPSHOT_DATABASE_URL%%\?*}"

applied="$(psql "$DB_URL" -At -c "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name")"
expected="$(ls prisma/migrations | grep -v '\.toml$' | sort)"
if [ "$applied" != "$expected" ]; then
  echo "Stopped: the database does not have exactly the migrations in prisma/migrations. Run migrate deploy on it first."
  exit 1
fi

pg_dump --schema-only --no-owner --no-privileges --exclude-table=_prisma_migrations "$DB_URL" > prisma/fresh-install/schema.sql
echo "Snapshot written to prisma/fresh-install/schema.sql"
