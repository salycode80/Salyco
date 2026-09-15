# Server migration: Caddy → Ubuntu Nginx, plus SalyLearn launch

Target architecture for 212.23.201.86:

```
                        Internet
                           │
                    212.23.201.86
                           │
                   ┌───────▼────────┐
                   │ Ubuntu Nginx   │
                   │ :80/:443  (TLS)│──► salyco.ir        → 127.0.0.1:8080  (salyco stack)
                   │ :8081          │──► 212.23.201.86    → 127.0.0.1:8081  (salylearn stack)
                   └────────────────┘
  LiveKit (WebRTC media cannot go through the HTTP proxy):
                   7880/tcp, 7881/tcp, 7882/udp  → published directly by the LiveKit container

  Everything else — PostgreSQL, Redis, Django — stays on docker networks only.
```

Two repos are involved:

| Repo | What changes |
|------|--------------|
| `salyco-fullstack` | compose: frontend → `127.0.0.1:8080`, Caddy service removed, `deploy/nginx/salyco.conf` added |
| `salylearn` | new `docker-compose.prod.yml`, `salylearn-frontend/nginx.prod.conf`, `.env.production.example`, `deploy/nginx/salylearn.conf`, `deploy/livekit/{docker-compose.prod.yml,livekit.prod.yaml}` |

Commit and push both repos before starting; every step below assumes the
server can `git pull` the new files.

---

## Part 1 — SALYCO: move the public gateway from Caddy to Nginx

**Order matters.** Caddy currently serves the live salyco.ir. The new compose
file no longer contains Caddy, and a plain `docker compose up -d` would remove
the Caddy container *immediately* — taking the site down before Nginx is
running. The steps below keep the outage to a few seconds.

### 1.1 — Recreate the frontend with the localhost binding (no downtime)

On the server, in the salyco directory:

```bash
git pull
docker compose up -d frontend
```

This recreates the frontend container with `127.0.0.1:8080:80`. Compose prints
a "found orphan containers (caddy)" warning — **expected and correct**: without
`--remove-orphans`, the still-running Caddy container is left alone.

Verify:

```bash
curl -I http://127.0.0.1:8080     # expect: 200 OK from nginx
docker ps --format '{{.Names}}  {{.Ports}}'   # caddy still holds 80/443
```

### 1.2 — Install the host Nginx config (nginx still stopped)

```bash
sudo cp deploy/nginx/salyco.conf /etc/nginx/sites-available/salyco.conf
sudo ln -s /etc/nginx/sites-available/salyco.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t          # config test only — nginx must NOT be started yet
```

### 1.3 — Switchover (a few seconds of downtime)

```bash
# Removes the orphaned Caddy container → ports 80/443 are free.
docker compose up -d --remove-orphans

# Nginx takes over port 80 immediately; the site is back (over HTTP).
sudo systemctl enable --now nginx
```

Check: `curl -I http://salyco.ir` → 200.

### 1.4 — HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d salyco.ir -d www.salyco.ir --redirect
```

certbot rewrites `/etc/nginx/sites-available/salyco.conf` into an
HTTP→HTTPS redirect plus a 443 server block and reloads nginx. Renewal is
automatic (`certbot.timer`).

Check: `curl -I https://salyco.ir` and log into `/admin/`.

### 1.5 — Cleanup

Caddy's leftover volumes (only after HTTPS is confirmed working):

```bash
docker volume ls | grep caddy
docker volume rm <those two volumes>
```

### Rollback (if something is broken)

```bash
sudo systemctl stop nginx
git -C <salyco-dir> revert HEAD   # restores the old compose + Caddyfile
git -C <salyco-dir> pull          # or push the revert from your machine
docker compose up -d              # Caddy returns with its existing certificate
```

The caddy volumes from 1.5 must not have been deleted for the cert to survive;
even if they were, Caddy re-issues it automatically on first request.

---

## Part 2 — SALYLEARN: launch on 212.23.201.86:8081

### 2.1 — Deploy the stack

On the server (e.g. `/opt/salylearn`):

```bash
git pull        # or clone the repo here first
cp .env.production.example .env.production
```

Fill in `.env.production`:

- `SECRET_KEY`, `POSTGRES_PASSWORD`, `HLS_SECRET` — generate fresh random values
- `LIVEKIT_KEYS` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` — one generated pair
  used in all three places (see 2.3)
- `ZARINPAL_MERCHANT_ID` — the real merchant ID (`PAYMENT_GATEWAY=zarinpal`;
  keep `ZARINPAL_SANDBOX=True` until you have tested with real cards)
- `ALLOWED_HOSTS` / `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS` — already
  set for `http://212.23.201.86:8081`

Bring it up:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

The backend entrypoint runs `migrate` and `collectstatic` automatically.
Create the admin user:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

Verify locally:

```bash
curl -I http://127.0.0.1:8081        # SPA
curl -I http://127.0.0.1:8081/api/courses/   # 200 from Django
```

### 2.2 — Expose it through the host Nginx

```bash
sudo cp deploy/nginx/salylearn.conf /etc/nginx/sites-available/salylearn.conf
sudo ln -s /etc/nginx/sites-available/salylearn.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo ufw allow 8081/tcp
```

Open `http://212.23.201.86:8081` from outside and log into
`http://212.23.201.86:8081/admin/`.

### 2.3 — LiveKit

Generate a key pair (use it for `LIVEKIT_KEYS`, `LIVEKIT_API_KEY` and
`LIVEKIT_API_SECRET` in `.env.production`):

```bash
docker run --rm livekit/livekit-server generate-keys
```

Then, from the repo root:

```bash
docker compose --env-file .env.production -f deploy/livekit/docker-compose.prod.yml up -d
sudo ufw allow 7880/tcp
sudo ufw allow 7881/tcp
sudo ufw allow 7882/udp
```

**Known limitation until a domain exists:** browsers only grant camera and
microphone access to secure origins (https/wss). Over `http://…:8081` the
SalyLearn UI and videos work, but live-class participants cannot publish
audio/video. The fix is a domain + TLS — `deploy/nginx/salylearn.conf` has a
comment block with the exact switch-over steps, and `LIVEKIT_URL` then becomes
`wss://…` routed through nginx.

---

## Part 3 — Final verification checklist

```bash
docker ps --format '{{.Names}}\t{{.Ports}}'
```

Expected: no `0.0.0.0` bindings except LiveKit's 7880/7881/7882. SALYCO and
SalyLearn frontends show `127.0.0.1:8080->80` and `127.0.0.1:8081->80`;
databases/redis/backends show only container-network ports (or none).

```bash
curl -I https://salyco.ir                      # 200
curl -I http://212.23.201.86:8081              # 200
curl -I http://212.23.201.86:8081/api/courses/ # 200
sudo systemctl status nginx certbot.timer --no-pager
```

Also worth doing once by hand: upload a product image in salyco admin, upload a
video in salylearn admin (checks `client_max_body_size` on both nginx hops and
the celery media worker), and confirm the certificate renews with
`sudo certbot renew --dry-run`.

## Notes

- **Docker bypasses ufw** for published ports: its iptables NAT rules fire
  before the INPUT chain. That is exactly why this setup publishes nothing but
  loopback bindings (plus LiveKit, which must be directly reachable for WebRTC)
  — ufw stays meaningful for nginx's ports, and nothing else is exposed at all.
- **Server ports convention**: `8080` = salyco (localhost), `8081` = salylearn
  (localhost + public via nginx), `7880–7882` = LiveKit. The next app takes
  `8082` on localhost.
