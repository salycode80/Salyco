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

# ── Stage 2: serve with nginx ────────────────────────────────────────────────
FROM nginx:1.27-alpine

# SPA + reverse-proxy config.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the compiled assets from the build stage.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
