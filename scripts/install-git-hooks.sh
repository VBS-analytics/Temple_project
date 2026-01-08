#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)
HOOK_SOURCE="$REPO_ROOT/git-hooks/post-commit"
HOOK_TARGET="$REPO_ROOT/.git/hooks/post-commit"

if [ ! -d "$REPO_ROOT/.git" ]; then
  echo "This repository does not appear to be a git repo." >&2
  exit 1
fi

cp "$HOOK_SOURCE" "$HOOK_TARGET"
chmod +x "$HOOK_TARGET"
echo "Installed post-commit backup hook."
