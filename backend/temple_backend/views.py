"""Utility views for the Temple backend."""

import gzip
import logging
import os
import re
import shutil
import subprocess
import tarfile
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Optional

from django.conf import settings
from django.http import FileResponse, JsonResponse
from django.utils import timezone

logger = logging.getLogger(__name__)

DEFAULT_BACKUP_DIR = Path(__file__).resolve().parents[2] / 'backups'
BACKUP_DIR = Path(os.environ.get('BACKUP_DIR', str(DEFAULT_BACKUP_DIR))).resolve(strict=False)
BACKUP_FILE_LIMIT = 5
LIVE_DUMP_FILENAME = 'temple_db-live.sql.gz'
ARCHIVE_NAME_PREFIX = 'temple-database'
LIVE_BACKUP_FILENAME = 'temple_db-latest.sql.gz'
BACKUP_TIMESTAMP_PATTERN = re.compile(r'^temple_db-(\d{8}-\d{6})\.sql\.gz$')
BACKUP_TIMESTAMP_FORMAT = '%Y%m%d-%H%M%S'


def health_check(request):
    """Simple lightweight endpoint used by external keep-alive probes."""
    return JsonResponse(
        {
            "status": "ok",
            "timestamp": timezone.now().isoformat(),
        }
    )


def download_database_backup(request):
    temp_dir = Path(tempfile.mkdtemp(prefix='database-download-'))
    try:
        backup_files = _collect_backup_files()
        live_dump_path: Optional[Path] = _find_existing_live_backup()
        live_dump_error: Optional[BaseException] = None
        if not live_dump_path:
            pg_dump_path = _resolve_pg_dump_path()
            if pg_dump_path:
                try:
                    live_dump_path = _generate_live_database_dump(temp_dir, pg_dump_path)
                except subprocess.CalledProcessError as exc:
                    logger.exception(
                        'pg_dump failed while generating the live database dump; falling back to stored backups',
                        exc_info=exc,
                    )
                    live_dump_error = exc
            else:
                logger.warning('pg_dump is not available when preparing the live database dump; falling back to stored backups')
                live_dump_error = FileNotFoundError('pg_dump binary is not available')

        if not live_dump_path and not backup_files:
            detail = (
                "Database dump tool is not available on the server."
                if isinstance(live_dump_error, FileNotFoundError)
                else "Unable to generate a live database dump right now."
            )
            shutil.rmtree(temp_dir, ignore_errors=True)
            return JsonResponse({"detail": detail}, status=500)

        archive_path = _create_database_archive(temp_dir, live_dump_path, backup_files)
        file_handle = open(archive_path, 'rb')
        response = FileResponse(file_handle, filename=archive_path.name, as_attachment=True)
        response['Content-Type'] = 'application/gzip'
        response['Content-Length'] = str(archive_path.stat().st_size)
        response.add_post_render_callback(lambda resp: _cleanup_temp_resources(temp_dir, file_handle))
        return response
    except (OSError, tarfile.TarError) as exc:
        logger.exception('Filesystem error while preparing the database download')
        shutil.rmtree(temp_dir, ignore_errors=True)
        return JsonResponse(
            {"detail": "Unable to prepare the database download right now."},
            status=500,
        )
    except Exception:
        logger.exception('Unexpected error while preparing the database download')
        shutil.rmtree(temp_dir, ignore_errors=True)
        return JsonResponse(
            {"detail": "Unable to prepare the database download right now."},
            status=500,
        )


def _cleanup_temp_resources(temp_dir: Path, file_handle):
    try:
        file_handle.close()
    except Exception:
        pass
    shutil.rmtree(temp_dir, ignore_errors=True)


def _generate_live_database_dump(temp_dir: Path, pg_dump_path: str) -> Path:
    sql_path = temp_dir / LIVE_DUMP_FILENAME.replace('.gz', '')
    gzip_path = temp_dir / LIVE_DUMP_FILENAME
    env = _build_pg_dump_environment()
    command = [pg_dump_path, '--format=plain', '--no-owner', '--no-privileges']

    with open(sql_path, 'wb') as sql_file:
        subprocess.run(command, stdout=sql_file, stderr=subprocess.PIPE, check=True, env=env)

    with open(sql_path, 'rb') as sql_file, gzip.open(gzip_path, 'wb') as gzip_file:
        shutil.copyfileobj(sql_file, gzip_file)

    try:
        sql_path.unlink()
    except OSError:
        pass

    return gzip_path


def _build_pg_dump_environment() -> dict[str, str]:
    db_config = settings.DATABASES.get('default', {})
    env = os.environ.copy()
    env['PGHOST'] = db_config.get('HOST') or env.get('PGHOST') or 'localhost'
    env['PGPORT'] = str(db_config.get('PORT') or env.get('PGPORT') or '5432')
    env['PGUSER'] = db_config.get('USER') or env.get('PGUSER', '')
    env['PGPASSWORD'] = db_config.get('PASSWORD') or env.get('PGPASSWORD', '')
    env['PGDATABASE'] = db_config.get('NAME') or env.get('PGDATABASE', '')
    return env


def _resolve_pg_dump_path() -> Optional[str]:
    configured_path = os.environ.get('PG_DUMP_PATH')
    if configured_path:
        candidate = Path(configured_path)
        if candidate.exists():
            return str(candidate)
        logger.warning('Configured PG_DUMP_PATH=%s but file does not exist', configured_path)

    binary = shutil.which('pg_dump')
    if binary:
        return binary
    return None


def _find_existing_live_backup() -> Optional[Path]:
    candidate = BACKUP_DIR / LIVE_BACKUP_FILENAME
    try:
        if candidate.exists():
            return candidate
    except OSError as exc:
        logger.warning('Unable to access live backup file %s', candidate, exc_info=exc)
    return None


def _parse_backup_timestamp(name: str) -> Optional[float]:
    match = BACKUP_TIMESTAMP_PATTERN.match(name)
    if not match:
        return None
    try:
        parsed = datetime.strptime(match.group(1), BACKUP_TIMESTAMP_FORMAT)
    except ValueError:
        return None
    return parsed.timestamp()


def _backup_sort_key(path: Path) -> float:
    timestamp_value = _parse_backup_timestamp(path.name)
    if timestamp_value is not None:
        return timestamp_value
    try:
        return path.stat().st_mtime
    except OSError:
        return 0.0


def _collect_backup_files(limit: int = BACKUP_FILE_LIMIT) -> list[Path]:
    if not BACKUP_DIR.exists():
        return []

    candidates = sorted(
        (
            path
            for path in BACKUP_DIR.glob('temple_db-*.sql.gz')
            if path.name != LIVE_BACKUP_FILENAME
        ),
        key=_backup_sort_key,
        reverse=True,
    )

    collected = []
    seen_targets = set()
    for candidate in candidates:
        try:
            if not candidate.exists():
                continue
        except OSError:
            continue

        target = candidate.resolve(strict=False)
        if target in seen_targets:
            continue
        seen_targets.add(target)
        collected.append(candidate)
        if len(collected) >= limit:
            break

    return collected


def _create_database_archive(
    temp_dir: Path, live_dump_path: Optional[Path], backup_files: list[Path]
) -> Path:
    timestamp = timezone.localtime(timezone.now()).strftime('%Y%m%d-%H%M%S')
    archive_path = temp_dir / f'{ARCHIVE_NAME_PREFIX}-{timestamp}.tar.gz'
    with tarfile.open(archive_path, 'w:gz', dereference=True) as archive:
        if live_dump_path:
            archive.add(live_dump_path, arcname=LIVE_DUMP_FILENAME)
        for backup_path in backup_files:
            archive.add(backup_path, arcname=backup_path.name)
    return archive_path
