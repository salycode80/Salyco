# ── Stage 1: build the Vite/React bundle ─────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# VITE_API_URL is baked in at build time. Empty string => same-origin requests
# (/api, /media, ...) which nginx reverse-proxies to Django. Override only if
# the backend lives on a different host.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

# Install deps from the lockfile for reproducible builds.
COPY package.json package-lock.json ./
RUN npm install

# Build the static site.
COPY . .
RUN npm run build

# ── Stage 2: generate AVIF/WebP derivatives ──────────────────────────────────
# Runs in its own stage so Pillow and its codecs never enter the runtime image.
# Originals are left byte-identical; the script only writes sibling files
# (foo.png.avif, foo.png.webp) that nginx serves via Accept negotiation.
FROM python:3.13-alpine AS images

RUN pip install --no-cache-dir "Pillow>=11.3"

WORKDIR /work
COPY --from=build /app/dist ./dist
COPY scripts/gen_image_derivatives.py ./

# Quality is adaptive per image (PSNR floor, default 38 dB), so this needs no
# per-asset tuning. If a source is already small or compresses badly, the
# derivative is dropped and nginx falls through to the original.
RUN python gen_image_derivatives.py dist

# ── Stage 3: serve with nginx ────────────────────────────────────────────────
FROM nginx:1.27-alpine

# SPA + reverse-proxy config, gzip, and image negotiation.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Compiled assets plus the generated .avif/.webp siblings.
COPY --from=images /work/dist /usr/share/nginx/html

# Fail the build rather than ship a container that would not start.
RUN nginx -t

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
