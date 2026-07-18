#!/bin/sh
set -e

# Apply database migrations. (Waits implicitly — compose only starts this
# service once the Postgres healthcheck passes.)
python manage.py migrate --noinput

# Refresh collected static files in case anything changed since build.
python manage.py collectstatic --noinput

# Launch the WSGI server. 3 workers is a sensible default for a small box;
# tune with (2 * CPU cores) + 1.
exec gunicorn core.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 3 \
    --timeout 120 \
    --forwarded-allow-ips "*"
