# ── Backend: Django + Gunicorn ───────────────────────────────────────────────
FROM python:3.12-slim

# Keep Python lean and predictable in containers.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps: build tools + libpq for psycopg2, plus libs Pillow needs.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        libjpeg-dev \
        zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first so this layer is cached across code changes.
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy the application source.
COPY . .

# Collect admin/DRF static assets into STATIC_ROOT (served by WhiteNoise).
# A dummy SECRET_KEY is fine here; collectstatic doesn't need the real one.
RUN SECRET_KEY=build-only DEBUG=False python manage.py collectstatic --noinput

# Media + static dirs live on a mounted volume in production.
RUN mkdir -p /app/media /app/staticfiles

EXPOSE 8000

# entrypoint runs migrations then starts gunicorn.
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
