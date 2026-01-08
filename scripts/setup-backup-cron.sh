#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)
CRON_SCHEDULE="0 2 * * *"
CRON_CMD="cd $REPO_ROOT && ./scripts/db_backup.sh >/dev/null 2>&1"
CRON_ENTRY="$CRON_SCHEDULE $CRON_CMD"

# Preserve existing crontab entries
existing_cron=$(crontab -l 2>/dev/null || true)
if printf '%s\n' "$existing_cron" | grep -Fxq "$CRON_ENTRY"; then
  echo "Nightly backup cron already registered."
  exit 0
fi

printf '%s\n%s\n' "$existing_cron" "$CRON_ENTRY" | crontab -
echo "Installed nightly backup cron"
