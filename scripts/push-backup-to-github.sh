#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_FILE:?BACKUP_FILE must point to the created .sql.gz file}"
: "${BACKUP_GITHUB_REPO:?Set BACKUP_GITHUB_REPO to the https://.../temple-backups-files.git URL (include PAT/token if needed)}"

BACKUP_DIR=${BACKUP_DIR:-"."}
GIT_WORKTREE=${BACKUP_GITHUB_DIR:-"$BACKUP_DIR/github-backups"}
BRANCH=${BACKUP_GITHUB_BRANCH:-"main"}
COMMIT_NAME=${BACKUP_GITHUB_COMMIT_NAME:-"Temple Backup Bot"}
COMMIT_EMAIL=${BACKUP_GITHUB_COMMIT_EMAIL:-"backup-bot@temple.local"}

mkdir -p "$GIT_WORKTREE"

if [ -d "$GIT_WORKTREE/.git" ]; then
  git -C "$GIT_WORKTREE" fetch origin "$BRANCH"
  git -C "$GIT_WORKTREE" reset --hard "origin/$BRANCH"
else
  git clone --branch "$BRANCH" "$BACKUP_GITHUB_REPO" "$GIT_WORKTREE"
fi

git -C "$GIT_WORKTREE" config user.name "$COMMIT_NAME"
git -C "$GIT_WORKTREE" config user.email "$COMMIT_EMAIL"

cp "$BACKUP_FILE" "$GIT_WORKTREE/"

git -C "$GIT_WORKTREE" add "$(basename "$BACKUP_FILE")"
if git -C "$GIT_WORKTREE" diff --cached --quiet; then
  echo "No new backup to push."
else
  git -C "$GIT_WORKTREE" commit -m "Backup $(basename "$BACKUP_FILE")"
  git -C "$GIT_WORKTREE" push origin "$BRANCH"
fi
