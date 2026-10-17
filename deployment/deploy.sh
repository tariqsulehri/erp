#!/usr/bin/env bash
set -e

# Always run from the directory where the script and docker-compose file live
cd "$(dirname "$0")"

# Set application image tag from argument or default to 'latest'
APP_TAG="${1:-latest}"
export APP_TAG

echo "========================================="
echo " Deploying containers with APP_TAG: ${APP_TAG}"
echo "========================================="

# ── Pre-flight: ensure pgvector extension exists ──────────────
# Prisma's `db push` issues CREATE EXTENSION, which always requires a
# superuser -- the app user can never do it. Create it out-of-band here so
# the backend doesn't crash-loop on a fresh environment. Idempotent.
echo "==> [1/4] Pre-flight: ensuring 'vector' extension exists..."
if command -v psql >/dev/null 2>&1 && [ -f .env.backend ]; then
  DATABASE_URL="$(sed -n 's#^DATABASE_URL=\(.*\)#\1#p' .env.backend | head -1 | tr -d '"')"
  if [ -n "$DATABASE_URL" ]; then
    if psql "$DATABASE_URL" -c 'CREATE EXTENSION IF NOT EXISTS vector;' >/dev/null 2>&1; then
      echo "    OK: 'vector' present"
    else
      echo "    WARN: could not ensure 'vector' extension (continuing)."
      echo "          If the backend crash-loops on CREATE EXTENSION, run manually:"
      echo "          psql \"\$DATABASE_URL\" -c 'CREATE EXTENSION IF NOT EXISTS vector;'"
    fi
  else
    echo "    SKIP: could not parse DATABASE_URL from .env.backend"
  fi
else
  echo "    SKIP: psql not available locally, or .env.backend missing"
fi

echo "==> [2/4] Pulling latest images..."
docker compose pull

echo "==> [3/4] Stopping and removing existing containers..."
docker compose down

echo "==> [4/4] Starting new containers..."
docker compose up -d

echo "========================================="
echo " Container Status:"
echo "========================================="
docker compose ps
echo "========================================="
echo " Deployment completed successfully! 🎉"
echo "========================================="
