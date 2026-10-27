#!/usr/bin/env bash
# Tests for deployment/lib.sh. Uses a fake `docker` command, so it runs anywhere (CI included).
# Usage: deployment/tests/lib.test.sh
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
PASSED=0
FAILED=0

check() { # check <name> <expected> <actual>
  if [ "$2" = "$3" ]; then PASSED=$((PASSED + 1)); printf '  ✓ %s\n' "$1"
  else FAILED=$((FAILED + 1)); printf '  ✗ %s\n      expected: %s\n      actual:   %s\n' "$1" "$2" "$3"; fi
}

# Fake docker: `docker compose version` works, everything else prints nothing.
mkdir -p "$WORK/bin"
cat > "$WORK/bin/docker" <<'FAKE'
#!/usr/bin/env bash
[ "${1:-}" = "compose" ] && [ "${2:-}" = "version" ] && { echo "Docker Compose version v2"; exit 0; }
exit 0
FAKE
chmod +x "$WORK/bin/docker"
export PATH="$WORK/bin:$PATH"

cd "$WORK"
# shellcheck source=../lib.sh
. "$HERE/../lib.sh"

long_secret="$(printf 'a%.0s' $(seq 1 40))"
write_env() { # write_env <jwt> <nextauth> <database_url> <nextauth_url>
  printf 'DATABASE_URL="%s"\nJWT_SECRET=%s\n' "$3" "$1" > .env.backend
  printf "NEXTAUTH_SECRET='%s'\nNEXTAUTH_URL=%s\n" "$2" "$4" > .env.frontend
  touch docker-compose.yml
}

echo "env_value"
write_env "$long_secret" "$long_secret" "postgresql://u:p@h:5432/db?schema=public" "http://host:3070"
check "reads a double-quoted value" "postgresql://u:p@h:5432/db?schema=public" "$(env_value .env.backend DATABASE_URL)"
check "reads a single-quoted value" "$long_secret" "$(env_value .env.frontend NEXTAUTH_SECRET)"
check "reads an unquoted value" "http://host:3070" "$(env_value .env.frontend NEXTAUTH_URL)"
check "missing key is empty" "" "$(env_value .env.backend NOPE)"
printf 'JWT_SECRET=first\nJWT_SECRET=second\n' > dup.env
check "last duplicate wins (as Docker does)" "second" "$(env_value dup.env JWT_SECRET)"

echo "preflight"
preflight >/dev/null 2>&1; check "passes with complete settings" "0" "$?"

write_env "short" "$long_secret" "postgresql://x" "http://host"
check "rejects a short JWT_SECRET" "1" "$(preflight >/dev/null 2>&1; echo $?)"
check "names the problem" "1" "$(preflight 2>&1 | grep -c 'JWT_SECRET must be at least 32')"

write_env "$long_secret" "$long_secret" "" "http://host"
check "rejects an empty DATABASE_URL" "1" "$(preflight >/dev/null 2>&1; echo $?)"

write_env "$long_secret" "short" "postgresql://x" ""
check "reports every problem at once" "2" "$(preflight 2>&1 | grep -c 'NEXTAUTH_SECRET\|NEXTAUTH_URL')"

rm -f .env.frontend
check "rejects a missing .env.frontend" "1" "$(preflight >/dev/null 2>&1; echo $?)"

echo "output helpers"
STEP_TOTAL=3
check "numbers steps" "[1/3] First" "$(step First | tr -d '\n' | sed 's/^ *//')"
check "health of a missing container is 'missing'" "missing" "$(health_of nothing)"

echo "scripts"
for script in deploy.sh status.sh rollback.sh backup.sh build-and-push.sh lib.sh; do
  bash -n "$HERE/../$script"; check "$script has valid syntax" "0" "$?"
done
check "deploy.sh --help prints usage" "1" "$(bash "$HERE/../deploy.sh" --help | grep -c 'Usage: ./deploy.sh')"
check "deploy.sh rejects unknown options" "2" "$(bash "$HERE/../deploy.sh" --nope >/dev/null 2>&1; echo $?)"
check "rollback.sh without a version explains usage" "1" "$(cd "$WORK" && bash "$HERE/../rollback.sh" 2>/dev/null | grep -c 'Usage: ./rollback.sh')"

echo
echo "${PASSED} passed, ${FAILED} failed"
[ "$FAILED" = 0 ]
