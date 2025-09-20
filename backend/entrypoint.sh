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

gunicorn temple_backend.wsgi:application --bind 0.0.0.0:8000 --workers 3
