#!/usr/bin/env bash
# Runs on a developer machine: builds both images for the server, tags them, and pushes them to Docker Hub.
# With --deploy it then runs deploy.sh on the server over SSH and shows its status report.
#
# Usage: deployment/build-and-push.sh [version] [--deploy] [--no-backup]
#   version     Defaults to today's date (YYYY.MM.DD); a second release on the same day gets .2, .3 ...
#   --deploy    After pushing, deploy this version on the server.
#   --no-backup Passed to deploy.sh.
# Server settings (override with environment variables):
#   DEPLOY_SSH=root@161.97.110.121  DEPLOY_KEY=~/.ssh/id_aiscripto  DEPLOY_DIR=/deployments/erp
set -euo pipefail

cd "$(dirname "$0")/.."

DEPLOY_SSH="${DEPLOY_SSH:-root@161.97.110.121}"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/id_aiscripto}"
DEPLOY_DIR="${DEPLOY_DIR:-/deployments/erp}"
BACKEND_IMAGE="tariqsulehri/erp-be"
FRONTEND_IMAGE="tariqsulehri/erp-fe"

VERSION=""
DEPLOY=0
DEPLOY_ARGS=""
for arg in "$@"; do
  case "$arg" in
    --deploy) DEPLOY=1 ;;
    --no-backup) DEPLOY_ARGS="$DEPLOY_ARGS --no-backup" ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    -*) echo "Unknown option: $arg"; exit 2 ;;
    *) VERSION="$arg" ;;
  esac
done

tag_exists() { docker manifest inspect "${BACKEND_IMAGE}:$1" >/dev/null 2>&1; }
if [ -z "$VERSION" ]; then
  VERSION="$(date +%Y.%m.%d)"
  if tag_exists "$VERSION"; then
    n=2; while tag_exists "${VERSION}.${n}"; do n=$((n + 1)); done
    VERSION="${VERSION}.${n}"
  fi
fi

COMMIT="$(git rev-parse HEAD)"
if [ -n "$(git status --porcelain)" ]; then
  echo "! The working tree has uncommitted changes; the image will not match commit ${COMMIT:0:7} exactly."
fi

echo "==> Building ${VERSION} (commit ${COMMIT:0:7}) for linux/amd64"
build() { # build <image> <folder>
  docker build --platform linux/amd64 \
    --build-arg "APP_VERSION=${VERSION}" --build-arg "GIT_COMMIT=${COMMIT}" \
    -t "$1:${VERSION}" -t "$1:latest" "$2"
}
build "$BACKEND_IMAGE" backend > /tmp/erp-build-backend.log 2>&1 &
backend_pid=$!
build "$FRONTEND_IMAGE" frontend > /tmp/erp-build-frontend.log 2>&1 &
frontend_pid=$!
wait "$backend_pid" || { echo "Backend build failed: /tmp/erp-build-backend.log"; tail -20 /tmp/erp-build-backend.log; exit 1; }
wait "$frontend_pid" || { echo "Frontend build failed: /tmp/erp-build-frontend.log"; tail -20 /tmp/erp-build-frontend.log; exit 1; }

echo "==> Pushing ${VERSION} and latest"
for image in "$BACKEND_IMAGE" "$FRONTEND_IMAGE"; do
  docker push -q "$image:${VERSION}"
  docker push -q "$image:latest"
done

if [ "$DEPLOY" = 1 ]; then
  echo "==> Deploying ${VERSION} on ${DEPLOY_SSH}"
  # shellcheck disable=SC2086
  ssh -i "$DEPLOY_KEY" -o IdentitiesOnly=yes -t "$DEPLOY_SSH" "cd '${DEPLOY_DIR}' && ./deploy.sh '${VERSION}' ${DEPLOY_ARGS}"
else
  echo "Done. Deploy on the server with: cd ${DEPLOY_DIR} && ./deploy.sh ${VERSION}"
fi
