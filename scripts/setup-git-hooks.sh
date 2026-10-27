#!/usr/bin/env bash
# Turns on the repo's git hooks (the secret check before every commit). Run once per clone:
#   scripts/setup-git-hooks.sh      (or: npm run setup:hooks)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath .githooks
chmod +x .githooks/*
echo "Git hooks are on: every commit is checked for keys, passwords, tokens, and secret files."
command -v gitleaks >/dev/null 2>&1 || echo "Tip: install gitleaks for a second check (brew install gitleaks)."
