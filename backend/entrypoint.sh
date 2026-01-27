#!/bin/sh
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput

# Seed default admin if not present
python manage.py shell <<'PYCODE'
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(phone_number='9999999999').exists():
    User.objects.create_superuser(phone_number='9999999999', name='Temple Admin', password='adminpass')
PYCODE

# Automatically seed opening balances on each container start when the workbook is available.
OPENING_BALANCE_WORKBOOK="${OPENING_BALANCE_WORKBOOK:-/app/opening-balance-december.xlsx}"
if [ -f "$OPENING_BALANCE_WORKBOOK" ]; then
  echo "Importing donor opening balances from $OPENING_BALANCE_WORKBOOK..."
  if python manage.py import_opening_balances "$OPENING_BALANCE_WORKBOOK"; then
    echo "Opening balances imported."
  else
    echo "Opening balance import failed; continuing."
  fi
else
  echo "Opening balance workbook not found at $OPENING_BALANCE_WORKBOOK, skipping import."
fi

# Generate passbook entries for all donors
python manage.py regenerate_passbooks

APP_PORT=${PORT:-8000}

gunicorn temple_backend.wsgi:application --bind 0.0.0.0:${APP_PORT} --workers 3 --timeout 300
