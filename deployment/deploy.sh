#!/usr/bin/env bash
# Deploys one release version: backup -> migrate -> start new containers -> health check.
# Usage: ./deploy.sh <version>        e.g. ./deploy.sh 1.4.0
# Rollback: ./rollback.sh <previous version>   (see DEPLOYMENT.md)
set -euo pipefail

cd "$(dirname "$0")"

APP_TAG="${1:-}"
if [ -z "$APP_TAG" ] || [ "$APP_TAG" = "latest" ]; then
  echo "Usage: ./deploy.sh <version>   (a fixed version tag such as 1.4.0, never 'latest')"
  exit 1
fi
export APP_TAG

for file in .env.backend .env.frontend; do
  [ -f "$file" ] || { echo "Missing $file. Copy ${file}.example and fill it in."; exit 1; }
done

COMPOSE="docker compose"
[ -n "${APP_DOMAIN:-}" ] && COMPOSE="docker compose --profile https"

echo "========================================="
echo " Deploying version ${APP_TAG}"
echo "========================================="

echo "==> [1/5] Pulling images..."
$COMPOSE pull migrate backend frontend

echo "==> [2/5] Backing up the database before any change..."
./backup.sh "before-${APP_TAG}"

echo "==> [3/5] Installing or migrating the database..."
$COMPOSE run --rm migrate

echo "==> [4/5] Starting new containers (only changed containers are recreated)..."
$COMPOSE up -d --remove-orphans

echo "==> [5/5] Waiting for health checks..."
for attempt in $(seq 1 30); do
  backend_health="$(docker inspect -f '{{.State.Health.Status}}' erp_be 2>/dev/null || echo unknown)"
  frontend_health="$(docker inspect -f '{{.State.Health.Status}}' erp_fe 2>/dev/null || echo unknown)"
  if [ "$backend_health" = "healthy" ] && [ "$frontend_health" = "healthy" ]; then
    echo "${APP_TAG} $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> .deploy-history
    $COMPOSE ps
    echo "Deployment of ${APP_TAG} finished."
    exit 0
  fi
  sleep 5
done

echo "Containers did not become healthy. Check: docker compose logs --tail=200 backend frontend"
echo "To go back: ./rollback.sh <previous version>   (previous versions are listed in .deploy-history)"
exit 1
