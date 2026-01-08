# Daily/Post-commit Backups

`scripts/db_backup.sh` dumps `temple_db` from the `db` service, compresses the SQL, keeps a `temple_db-latest.sql.gz` symlink, and trims files older than `RETENTION_DAYS` (defaults to 30). The script logs to `backups/backup.log` and can run on any machine that can reach the Docker Compose stack.

If you want each dump to live off Render, configure `BACKUP_UPLOAD_COMMAND` before running the script. The command runs with `BACKUP_FILE` pointing at the freshly-created `.sql.gz` file, so you can push it somewhere durable (`aws s3 cp "$BACKUP_FILE" s3://…/temple-db/` for example).

Run `scripts/install-git-hooks.sh` once per clone to copy the prepared hook (`git-hooks/post-commit`) into `.git/hooks` so commits trigger the backup automatically.

```bash
./scripts/db_backup.sh
```

When you upload to durable storage, download it later via the same tooling (for example, `aws s3 cp s3://my-bucket/backups/temple_db-latest.sql.gz .`). You can also wrap that command in a small helper script on any machine that needs to restore the dump.

Environment overrides:

| Variable | Purpose | Default |
| --- | --- | --- |
| `BACKUP_DIR` | Where the compressed dumps and log live | `$REPO_ROOT/backups` |
| `RETENTION_DAYS` | Remove backups older than this many days (0 = never delete) | `30` |
| `BACKUP_UPLOAD_COMMAND` | Command run after each dump (receives `BACKUP_FILE`, `BACKUP_DIR`) | `""` |
| `BACKUP_GITHUB_REPO` | Git remote used when pushing backups | not set |
| `BACKUP_GITHUB_BRANCH` | Branch within the backup repo | `main` |
| `BACKUP_GITHUB_DIR` | Local checkout used for pushing | `$BACKUP_DIR/github-backups` |
| `BACKUP_GITHUB_COMMIT_NAME` | Git author name for the backup commits | `Temple Backup Bot` |
| `BACKUP_GITHUB_COMMIT_EMAIL` | Git author email for the backup commits | `backup-bot@temple.local` |


### Daily schedule

Install a cron job (or similar scheduler) that runs shortly after midnight. The repository now provides `scripts/setup-backup-cron.sh` to add the line for you:

```
./scripts/setup-backup-cron.sh
```

It adds the following entry to the current user’s crontab:

```
0 2 * * * cd /home/vbs-blr-dt-1064/Documents/Temple_project && ./scripts/db_backup.sh >/dev/null 2>&1
```

Adjust the path for your environment, then confirm with `crontab -l`. After a run, `/home/vbs-blr-dt-1064/Documents/Temple_project/backups/temple_db-*.sql.gz` will include every table dump (`accounts_*`, `auth_*`, `payments_*`, `pooja_*`, etc.).

### Push copies to GitHub

If you want every dump to land inside `https://github.com/VBS-analytics/temple-backups-files`, the repo now includes `scripts/push-backup-to-github.sh`. Simply source it with the upload command by exporting:

```
BACKUP_GITHUB_REPO="https://$GITHUB_TOKEN@github.com/VBS-analytics/temple-backups-files.git"
BACKUP_UPLOAD_COMMAND="./scripts/push-backup-to-github.sh"
```

Render can store `GITHUB_TOKEN` as an environment variable or secret so it never appears in source control. The script clones/pulls the backup repo, copies the new `.sql.gz`, commits it using the configured author name/email, and pushes to the chosen branch; the next job run will push the latest file automatically.

### Backup on every commit

Copy `git-hooks/post-commit` into `.git/hooks/post-commit` and make it executable so the backup script runs after every successful commit:

```bash
cp git-hooks/post-commit .git/hooks/post-commit
chmod +x .git/hooks/post-commit
``` 

The hook runs `scripts/db_backup.sh` but prints a warning rather than failing the commit if something goes wrong. If you share the repo, make sure each contributor installs the hook the same way.

### Next steps

- Rotate/replicate `backups/` to off-site storage (S3, NAS, etc.) by setting `BACKUP_UPLOAD_COMMAND` before running the script (for example `BACKUP_UPLOAD_COMMAND='aws s3 cp "$BACKUP_FILE" s3://my-bucket/backups/'`).
- Document how to restore (e.g., `gunzip -c ... | docker compose exec -T db psql -U temple_user -d temple_db`).
- Consider alerting or notifications when backup logs grow unexpectedly or fail.
- Monitor the `temple-backups-files` GitHub repo (or whatever remote you configured) so you can confirm each nightly run pushes a new `.sql.gz`.
