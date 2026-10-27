#!/usr/bin/env bash
# Shared helpers for deploy.sh, status.sh, rollback.sh and backup.sh. Not run on its own.

APP_NAME="${APP_NAME:-ERP}"
BACKEND_CONTAINER="erp_be"
FRONTEND_CONTAINER="erp_fe"
BACKEND_IMAGE="tariqsulehri/erp-be"
FRONTEND_IMAGE="tariqsulehri/erp-fe"
HISTORY_FILE=".deploy-history"

# Ports published on this server (must match docker-compose.yml).
FRONTEND_PORT="${FRONTEND_PORT:-3070}"
BACKEND_PORT="${BACKEND_PORT:-3071}"
PUBLIC_HOST="${PUBLIC_HOST:-$( (hostname -I 2>/dev/null || true) | awk '{print $1}')}"
PUBLIC_HOST="${PUBLIC_HOST:-localhost}"

COMPOSE="docker compose"
[ -n "${APP_DOMAIN:-}" ] && COMPOSE="docker compose --profile https"

# ── Output ────────────────────────────────────────────────────
if [ -t 1 ]; then
  BOLD=$'\e[1m'; DIM=$'\e[2m'; RED=$'\e[31m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'; BLUE=$'\e[34m'; RESET=$'\e[0m'
else
  BOLD=''; DIM=''; RED=''; GREEN=''; YELLOW=''; BLUE=''; RESET=''
fi

STEP_NUMBER=0
STEP_TOTAL="${STEP_TOTAL:-0}"
STEP_STARTED=0

step() {
  STEP_NUMBER=$((STEP_NUMBER + 1))
  STEP_STARTED=$(date +%s)
  printf '\n%s[%d/%d]%s %s%s%s\n' "$BLUE" "$STEP_NUMBER" "$STEP_TOTAL" "$RESET" "$BOLD" "$1" "$RESET"
}
step_done() { printf '      %s✓%s %s %s(%ss)%s\n' "$GREEN" "$RESET" "${1:-Done}" "$DIM" "$(( $(date +%s) - STEP_STARTED ))" "$RESET"; }
info() { printf '      %s\n' "$1"; }
warn() { printf '      %s! %s%s\n' "$YELLOW" "$1" "$RESET"; }
fail() { printf '\n%s✗ %s%s\n' "$RED" "$1" "$RESET" >&2; }
rule() { printf '%s\n' "────────────────────────────────────────────────────────────────────────────"; }

# ── Checks ────────────────────────────────────────────────────
env_value() { # env_value <file> <KEY>  -> value without quotes (never printed by callers)
  grep -E "^$2=" "$1" 2>/dev/null | tail -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

preflight() {
  local problems=0 value
  command -v docker >/dev/null || { fail "Docker is not installed."; return 1; }
  docker compose version >/dev/null 2>&1 || { fail "Docker Compose v2 is not available."; return 1; }
  for file in .env.backend .env.frontend docker-compose.yml; do
    [ -f "$file" ] || { fail "Missing $file (copy ${file}.example and fill it in)."; problems=1; }
  done
  [ "$problems" = 0 ] || return 1

  [ -n "$(env_value .env.backend DATABASE_URL)" ] || { fail ".env.backend: DATABASE_URL is empty."; problems=1; }
  value="$(env_value .env.backend JWT_SECRET)"
  [ "${#value}" -ge 32 ] || { fail ".env.backend: JWT_SECRET must be at least 32 characters."; problems=1; }
  value="$(env_value .env.frontend NEXTAUTH_SECRET)"
  [ "${#value}" -ge 32 ] || { fail ".env.frontend: NEXTAUTH_SECRET must be at least 32 characters."; problems=1; }
  [ -n "$(env_value .env.frontend NEXTAUTH_URL)" ] || { fail ".env.frontend: NEXTAUTH_URL is empty."; problems=1; }

  local free_mb
  free_mb="$(df -Pm . | awk 'NR==2 {print $4}')"
  if [ "${free_mb:-0}" -lt 2048 ]; then warn "Only ${free_mb} MB free disk space."; fi
  return "$problems"
}

# ── Facts about what is running ───────────────────────────────
container_field() { docker inspect -f "$2" "$1" 2>/dev/null || true; }
image_label() { docker image inspect -f "{{ index .Config.Labels \"$2\" }}" "$1" 2>/dev/null | sed 's/<no value>//' || true; }
health_of() { local h; h="$(container_field "$1" '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}')"; echo "${h:-missing}"; }

wait_healthy() { # wait_healthy <seconds>
  local deadline=$(( $(date +%s) + $1 )) be fe
  while [ "$(date +%s)" -lt "$deadline" ]; do
    be="$(health_of "$BACKEND_CONTAINER")"; fe="$(health_of "$FRONTEND_CONTAINER")"
    [ "$be" = healthy ] && [ "$fe" = healthy ] && return 0
    case "$be$fe" in *unhealthy*|*exited*|*dead*) ;; esac
    sleep 3
  done
  return 1
}

# Keeps the images that are running now as :previous so a rollback needs no registry.
remember_previous() {
  local image
  image="$(container_field "$BACKEND_CONTAINER" '{{.Image}}')"
  [ -n "$image" ] && docker tag "$image" "${BACKEND_IMAGE}:previous" >/dev/null 2>&1 || true
  image="$(container_field "$FRONTEND_CONTAINER" '{{.Image}}')"
  [ -n "$image" ] && docker tag "$image" "${FRONTEND_IMAGE}:previous" >/dev/null 2>&1 || true
}

http_check() { # http_check <label> <url>
  local result code time
  result="$(curl -s -o /dev/null -w '%{http_code} %{time_total}' --max-time 10 "$2" 2>/dev/null || echo '000 0')"
  code="${result% *}"; time="${result#* }"
  if [ "${code:0:1}" = 2 ]; then
    printf '  %s●%s %-22s %s%s%s  %4s ms  %s\n' "$GREEN" "$RESET" "$1" "$GREEN" "$code" "$RESET" "$(awk -v t="$time" 'BEGIN{printf "%d", t*1000}')" "$2"
    return 0
  fi
  printf '  %s●%s %-22s %s%s%s           %s\n' "$RED" "$RESET" "$1" "$RED" "$code" "$RESET" "$2"
  return 1
}

smoke_tests() {
  local failed=0
  http_check "Frontend sign-in page" "http://localhost:${FRONTEND_PORT}/login" || failed=1
  http_check "Frontend health" "http://localhost:${FRONTEND_PORT}/api/health" || failed=1
  http_check "Backend health" "http://localhost:${BACKEND_PORT}/health" || failed=1
  http_check "Database connection" "http://localhost:${BACKEND_PORT}/health/database" || failed=1
  return "$failed"
}

# ── The report ────────────────────────────────────────────────
status_report() { # status_report [result text]
  local result="${1:-}"
  echo; rule
  printf '%s %s Deployment Status%s   %s%s · %s%s\n' "$BOLD" "$APP_NAME" "$RESET" "$DIM" "$(hostname)" "$(date '+%Y-%m-%d %H:%M:%S %Z')" "$RESET"
  rule
  [ -n "$result" ] && { printf '%s\n' "$result"; rule; }

  printf '%s%-10s %-26s %-12s %-9s %-17s %-10s %s%s\n' "$BOLD" "Service" "Image" "Version" "Commit" "Started" "Health" "Uptime" "$RESET"
  local name label container image_ref image_id version commit started health uptime color
  for pair in "Frontend:$FRONTEND_CONTAINER" "Backend:$BACKEND_CONTAINER"; do
    label="${pair%%:*}"; container="${pair#*:}"
    image_ref="$(container_field "$container" '{{.Config.Image}}')"
    image_id="$(container_field "$container" '{{.Image}}')"
    version="$(image_label "$image_id" org.opencontainers.image.version)"
    commit="$(image_label "$image_id" org.opencontainers.image.revision)"
    started="$(container_field "$container" '{{.State.StartedAt}}' | cut -c1-16 | tr 'T' ' ')"
    health="$(health_of "$container")"
    uptime="$(docker ps --filter "name=^${container}$" --format '{{.RunningFor}}' 2>/dev/null | sed 's/ ago//')"
    case "$health" in healthy) color="$GREEN" ;; starting) color="$YELLOW" ;; *) color="$RED" ;; esac
    printf '%-10s %-26s %-12s %-9s %-17s %s%-10s%s %s\n' "$label" "${image_ref:-missing}" "${version:--}" "${commit:0:7}" "${started:--}" "$color" "$health" "$RESET" "${uptime:--}"
  done

  echo; printf '%sEndpoints%s\n' "$BOLD" "$RESET"
  smoke_tests || true

  echo; printf '%sDatabase%s\n' "$BOLD" "$RESET"
  local migrations
  migrations="$(docker exec "$BACKEND_CONTAINER" sh -c 'psql "${DATABASE_URL%%\?*}" -At -F "|" -c "SELECT count(*), max(migration_name), to_char(max(finished_at), '"'"'YYYY-MM-DD HH24:MI'"'"') FROM _prisma_migrations WHERE finished_at IS NOT NULL" 2>/dev/null' 2>/dev/null || true)"
  if [ -n "$migrations" ]; then
    IFS='|' read -r count last when <<<"$migrations"
    printf '  Migrations applied    %s   latest %s (%s)\n' "$count" "$last" "$when"
  else
    printf '  %sMigrations could not be read.%s\n' "$YELLOW" "$RESET"
  fi
  local pending
  pending="$(docker exec "$BACKEND_CONTAINER" sh -c 'node node_modules/prisma/build/index.js migrate status 2>&1 | grep -c "have not yet been applied" || true' 2>/dev/null || true)"
  [ "${pending:-0}" != "0" ] && printf '  %sPending migrations exist: run ./deploy.sh again.%s\n' "$YELLOW" "$RESET"

  echo; printf '%sResources%s\n' "$BOLD" "$RESET"
  docker stats --no-stream --format '{{.Name}}  CPU {{.CPUPerc}}  Memory {{.MemUsage}}' "$FRONTEND_CONTAINER" "$BACKEND_CONTAINER" 2>/dev/null | sed 's/^/  /' || true

  echo; printf '%sOpen%s\n' "$BOLD" "$RESET"
  printf '  App      http://%s:%s\n' "$PUBLIC_HOST" "$FRONTEND_PORT"
  printf '  API      http://%s:%s/health\n' "$PUBLIC_HOST" "$BACKEND_PORT"

  if [ -f "$HISTORY_FILE" ]; then
    echo; printf '%sRecent deployments%s %s(newest last)%s\n' "$BOLD" "$RESET" "$DIM" "$RESET"
    tail -n 5 "$HISTORY_FILE" | sed 's/^/  /'
  fi
  if docker image inspect "${BACKEND_IMAGE}:previous" >/dev/null 2>&1; then
    echo; printf '  Roll back to the version before this one: %s./rollback.sh previous%s\n' "$BOLD" "$RESET"
  fi
  rule
}
