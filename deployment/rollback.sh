#!/usr/bin/env bash
# Starts an earlier version again. It does not change the database.
# If the release being undone ran a migration that the old version cannot work with, restore the backup
# taken before that release first (see "Restore" in DEPLOYMENT.md).
#
# Usage: ./rollback.sh previous      # the version that ran before the last deploy (kept on this server)
#        ./rollback.sh 2026.10.27    # any version tag on Docker Hub
set -euo pipefail

cd "$(dirname "$0")"
# shellcheck source=lib.sh
. ./lib.sh

APP_TAG="${1:-}"
if [ -z "$APP_TAG" ]; then
  echo "Usage: ./rollback.sh previous | <version>"
  [ -f "$HISTORY_FILE" ] && { echo "Recent deployments:"; tail -n 10 "$HISTORY_FILE" | sed 's/^/  /'; }
  exit 1
fi
export APP_TAG
STEP_TOTAL=3

step "Getting version ${APP_TAG}"
if [ "$APP_TAG" = "previous" ]; then
  docker image inspect "${BACKEND_IMAGE}:previous" >/dev/null 2>&1 || { fail "No previous version is kept on this server."; exit 1; }
  PULL="--pull never"
else
  $COMPOSE pull --quiet backend frontend
  PULL=""
fi
step_done

step "Starting it"
# shellcheck disable=SC2086
$COMPOSE up -d --no-deps $PULL backend frontend 2>&1 | sed 's/^/      /'
step_done

step "Waiting for health checks"
if wait_healthy 180; then
  step_done "Healthy"
  echo "${APP_TAG} $(date -u +%Y-%m-%dT%H:%M:%SZ) rollback" >> "$HISTORY_FILE"
  status_report "${GREEN}${BOLD}RESULT: ROLLED BACK${RESET} to ${APP_TAG}."
else
  echo "${APP_TAG} $(date -u +%Y-%m-%dT%H:%M:%SZ) rollback-FAILED" >> "$HISTORY_FILE"
  status_report "${RED}${BOLD}RESULT: ROLLBACK FAILED${RESET} — ${APP_TAG} is not healthy."
  exit 1
fi
