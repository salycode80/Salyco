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

# Derivative generation is deliberately NOT run. nginx negotiates with
# `try_files $uri$img_sfx $uri`, so a missing .avif/.webp falls through to the
# original PNG/JPEG: the site renders correctly either way, it just serves
# originals instead of AVIF/WebP, which costs bytes on mobile.
#
# To restore, re-add the step here (quality is adaptive per image, PSNR floor
# default 38 dB, so it needs no per-asset tuning):
#   RUN python gen_image_derivatives.py dist

# ── Stage 3: serve with nginx ────────────────────────────────────────────────
FROM nginx:1.27-alpine

# SPA + reverse-proxy config, gzip, and image negotiation.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Compiled assets plus the generated .avif/.webp siblings.
COPY --from=images /work/dist /usr/share/nginx/html

# nginx -t cannot run at build time because the upstream "backend:8000" does not
# exist until Docker Compose creates the network. Nginx will validate on startup
# and fail fast if the config has errors.
# RUN nginx -t

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
