#!/usr/bin/env bash
# Prints the deployment status report: versions, health, endpoints, database migrations, resources.
# Usage: ./status.sh
set -uo pipefail

cd "$(dirname "$0")"
# shellcheck source=lib.sh
. ./lib.sh

status_report
