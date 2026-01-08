#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)
BACKUP_DIR=${BACKUP_DIR:-"$REPO_ROOT/backups"}
RETENTION_DAYS=${RETENTION_DAYS:-30}
BACKUP_UPLOAD_COMMAND=${BACKUP_UPLOAD_COMMAND:-}
TIMESTAMP=$(date -u +"%Y%m%d-%H%M%S")
SQL_FILE="$BACKUP_DIR/temple_db-$TIMESTAMP.sql"
GZ_FILE="$SQL_FILE.gz"
LOG_FILE="$BACKUP_DIR/backup.log"

mkdir -p "$BACKUP_DIR"
{
  echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] Starting db backup"
  docker compose -p temple_dev exec db pg_dump -U temple_user -d temple_db -Fp > "$SQL_FILE"
  gzip -f "$SQL_FILE"
  ln -sf "$BACKUP_DIR/temple_db-latest.sql.gz" "$GZ_FILE"
  if [ "$RETENTION_DAYS" -gt 0 ]; then
    find "$BACKUP_DIR" -name "temple_db-*.sql.gz" -mtime +"$RETENTION_DAYS" -print0 | xargs -0 rm -f -- || true
  fi
  echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] Backup saved to $GZ_FILE"
  if [ -n "$BACKUP_UPLOAD_COMMAND" ]; then
    echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] Uploading $GZ_FILE using BACKUP_UPLOAD_COMMAND"
    BACKUP_FILE="$GZ_FILE" BACKUP_DIR="$BACKUP_DIR" bash -c "$BACKUP_UPLOAD_COMMAND"
    echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] Upload command completed"
  fi
} >> "$LOG_FILE" 2>&1
