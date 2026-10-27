#!/usr/bin/env bash
# Deploys a release and prints a full status report at the end.
#
# Usage: ./deploy.sh [tag] [--no-backup] [--no-auto-rollback]
#   tag                 Image tag to deploy, for example 2026.10.27 (recommended) or latest (default).
#   --no-backup         Skip the database backup before migrating.
#   --no-auto-rollback  Leave the new version running even if its health checks fail.
#
# Steps: checks -> keep current version as :previous -> pull -> backup -> migrate -> start -> health -> smoke tests.
# If the new version does not become healthy, the previous version is started again automatically.
set -Eeuo pipefail

cd "$(dirname "$0")"
# shellcheck source=lib.sh
. ./lib.sh

APP_TAG="latest"
DO_BACKUP=1
AUTO_ROLLBACK=1
for arg in "$@"; do
  case "$arg" in
    --no-backup) DO_BACKUP=0 ;;
    --no-auto-rollback) AUTO_ROLLBACK=0 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    -*) fail "Unknown option: $arg"; exit 2 ;;
    *) APP_TAG="$arg" ;;
  esac
done
export APP_TAG

STEP_TOTAL=$((7 + DO_BACKUP))
STARTED_AT=$(date +%s)

rule
printf '%s Deploying %s %s%s   %s%s%s\n' "$BOLD" "$APP_NAME" "$APP_TAG" "$RESET" "$DIM" "$(date '+%Y-%m-%d %H:%M:%S %Z')" "$RESET"
rule
[ "$APP_TAG" = "latest" ] && warn "Deploying 'latest'. A version tag (for example 2026.10.27) makes rollbacks exact."

on_error() {
  local line="$1"
  fail "Deployment stopped at line ${line}."
  echo "      Logs: docker compose logs --tail=200 backend frontend"
  status_report "${RED}${BOLD}RESULT: FAILED${RESET} during step ${STEP_NUMBER} of ${STEP_TOTAL}."
}
trap 'on_error $LINENO' ERR

step "Checking the server and settings"
preflight
step_done "Docker, settings and secrets look right"

step "Keeping the running version for rollback"
remember_previous
if docker image inspect "${BACKEND_IMAGE}:previous" >/dev/null 2>&1; then
  step_done "Saved as :previous ($(image_label "${BACKEND_IMAGE}:previous" org.opencontainers.image.version || true))"
else
  step_done "Nothing running yet (first install)"
fi

step "Pulling images ${APP_TAG}"
$COMPOSE pull --quiet migrate backend frontend
info "Backend  $(docker image inspect -f '{{index .RepoDigests 0}}' "${BACKEND_IMAGE}:${APP_TAG}" 2>/dev/null | cut -c1-90)"
info "Frontend $(docker image inspect -f '{{index .RepoDigests 0}}' "${FRONTEND_IMAGE}:${APP_TAG}" 2>/dev/null | cut -c1-90)"
step_done

if [ "$DO_BACKUP" = 1 ]; then
  step "Backing up the database"
  ./backup.sh "before-${APP_TAG}"
  step_done
fi

step "Installing or migrating the database"
$COMPOSE run --rm migrate 2>&1 | sed 's/^/      /'
step_done

step "Starting the new containers"
$COMPOSE up -d --no-deps --remove-orphans backend frontend 2>&1 | sed 's/^/      /'
step_done

step "Waiting for health checks"
trap - ERR
if ! wait_healthy 180; then
  fail "The new version did not become healthy within 3 minutes."
  docker logs --tail 40 "$BACKEND_CONTAINER" 2>&1 | sed 's/^/      be | /' || true
  if [ "$AUTO_ROLLBACK" = 1 ] && docker image inspect "${BACKEND_IMAGE}:previous" >/dev/null 2>&1; then
    warn "Starting the previous version again..."
    APP_TAG=previous $COMPOSE up -d --no-deps --pull never backend frontend >/dev/null 2>&1 || true
    wait_healthy 120 || true
    echo "${APP_TAG} $(date -u +%Y-%m-%dT%H:%M:%SZ) FAILED-rolled-back" >> "$HISTORY_FILE"
    status_report "${RED}${BOLD}RESULT: FAILED${RESET} — ${APP_TAG} was unhealthy; the previous version is running again."
  else
    echo "${APP_TAG} $(date -u +%Y-%m-%dT%H:%M:%SZ) FAILED" >> "$HISTORY_FILE"
    status_report "${RED}${BOLD}RESULT: FAILED${RESET} — ${APP_TAG} is not healthy."
  fi
  exit 1
fi
step_done "Backend and frontend are healthy"

step "Smoke tests"
if smoke_tests; then
  step_done "All endpoints answer"
  RESULT="${GREEN}${BOLD}RESULT: SUCCESS${RESET} — ${APP_TAG} deployed in $(( $(date +%s) - STARTED_AT ))s."
else
  warn "Some endpoints did not answer as expected (see the report)."
  RESULT="${YELLOW}${BOLD}RESULT: DEPLOYED WITH WARNINGS${RESET} — ${APP_TAG} in $(( $(date +%s) - STARTED_AT ))s; check the endpoints below."
fi

version="$(image_label "${BACKEND_IMAGE}:${APP_TAG}" org.opencontainers.image.version || true)"
commit="$(image_label "${BACKEND_IMAGE}:${APP_TAG}" org.opencontainers.image.revision || true)"
echo "${APP_TAG} $(date -u +%Y-%m-%dT%H:%M:%SZ) version=${version:--} commit=${commit:0:7}" >> "$HISTORY_FILE"

status_report "$RESULT"
