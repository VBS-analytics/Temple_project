#!/bin/sh
set -e

echo "=== Django startup: begin ==="

# ---- DB + static (fast, required) ----
echo "[1/6] Running migrations..."
python manage.py migrate --noinput

echo "[2/6] Collecting static files..."
python manage.py collectstatic --noinput

# ---- Seed default admin (fast) ----
echo "[3/6] Seeding default admin (if missing)..."
python manage.py shell <<'PYCODE'
from django.contrib.auth import get_user_model
User = get_user_model()
default_admins = [
    {
        "phone_number": "9999999999",
        "name": "Temple Admin",
        "password": "adminpass",
    },
    {
        "phone_number": "9999999998",
        "name": "Temple Admin1",
        "password": "adminpass1",
    },
    {
        "phone_number": "9999999997",
        "name": "Temple Admin2",
        "password": "adminpass2",
    },
]

for admin_payload in default_admins:
    if not User.objects.filter(phone_number=admin_payload["phone_number"]).exists():
        User.objects.create_superuser(**admin_payload)
PYCODE

# ---- Long/optional startup jobs: run in background so Render sees the open port ----
# Set RUN_STARTUP_JOBS=1 to enable optional background jobs (opening-balance import).
startup_jobs() {
  set +e  # don't kill the container if these jobs fail

  echo "[BG] Startup jobs: begin"

  # Import opening balances if workbook exists
  OPENING_BALANCE_WORKBOOK="${OPENING_BALANCE_WORKBOOK:-/app/opening-balance-december.xlsx}"
  if [ -f "$OPENING_BALANCE_WORKBOOK" ]; then
    echo "[BG] Importing donor opening balances from $OPENING_BALANCE_WORKBOOK..."
    python manage.py import_opening_balances "$OPENING_BALANCE_WORKBOOK"
    rc=$?
    if [ $rc -eq 0 ]; then
      echo "[BG] Opening balances imported."
    else
      echo "[BG] Opening balance import failed (exit=$rc); continuing."
    fi
  else
    echo "[BG] Opening balance workbook not found at $OPENING_BALANCE_WORKBOOK, skipping import."
  fi

  echo "[BG] Startup jobs: end"
}

# Passbook regeneration job. This runs independently so every container start
# refreshes passbook data even when optional startup jobs are disabled.
passbook_regen_job() {
  set +e
  echo "[BG] Regenerating passbooks (registrations skipped)..."
  python manage.py regenerate_passbooks
  rc=$?
  if [ $rc -eq 0 ]; then
    echo "[BG] Passbooks regeneration completed."
  else
    echo "[BG] Passbooks regeneration failed (exit=$rc)."
  fi
}

# Control whether optional background jobs run.
RUN_STARTUP_JOBS="${RUN_STARTUP_JOBS:-0}"
if [ "$RUN_STARTUP_JOBS" = "1" ]; then
  echo "[4/6] Launching startup jobs in background..."
  startup_jobs &
else
  echo "[4/6] Skipping startup jobs (RUN_STARTUP_JOBS=$RUN_STARTUP_JOBS)"
fi

# Control passbook regeneration on startup (default: enabled).
RUN_PASSBOOK_REGEN_ON_START="${RUN_PASSBOOK_REGEN_ON_START:-1}"
if [ "$RUN_PASSBOOK_REGEN_ON_START" = "1" ]; then
  echo "[5/6] Launching passbook regeneration in background..."
  passbook_regen_job &
else
  echo "[5/6] Skipping passbook regeneration (RUN_PASSBOOK_REGEN_ON_START=$RUN_PASSBOOK_REGEN_ON_START)"
fi

# ---- Start web server (must happen quickly for Render) ----
APP_PORT="${PORT:-10000}"
echo "[6/6] Starting gunicorn on 0.0.0.0:${APP_PORT} ..."
echo "=== Django startup: web server starting ==="

# IMPORTANT: exec so gunicorn becomes PID 1
exec gunicorn temple_backend.wsgi:application \
  --bind "0.0.0.0:${APP_PORT}" \
  --workers 3 \
  --timeout 300
