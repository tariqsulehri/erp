#!/usr/bin/env bash
# Starts a previous release version again. It does not change the database.
# If the failed release ran a migration that the old version cannot work with, restore the backup taken
# before that release first (see "Restore" in DEPLOYMENT.md).
# Usage: ./rollback.sh <previous version>
set -euo pipefail

cd "$(dirname "$0")"

APP_TAG="${1:-}"
if [ -z "$APP_TAG" ]; then
  echo "Usage: ./rollback.sh <previous version>"
  [ -f .deploy-history ] && { echo "Deployed versions:"; tail -n 10 .deploy-history; }
  exit 1
fi
export APP_TAG

COMPOSE="docker compose"
[ -n "${APP_DOMAIN:-}" ] && COMPOSE="docker compose --profile https"

$COMPOSE pull backend frontend
$COMPOSE up -d --no-deps backend frontend
echo "${APP_TAG} $(date -u +%Y-%m-%dT%H:%M:%SZ) rollback" >> .deploy-history
$COMPOSE ps
