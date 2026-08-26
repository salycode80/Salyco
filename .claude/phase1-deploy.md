# Phase 1 — Deploy Runbook

Performance work from [`salyco-improvement-plan.md`](./salyco-improvement-plan.md)
§1.1–1.4. **Nothing here changes what your images look like** — originals are
byte-identical on disk and remain the fallback.

**Status:** implemented locally, **not deployed, not committed.**
**Blocked on:** one decision from you (see [Before you deploy](#before-you-deploy)).

---

## What changed

| File | Change |
|---|---|
| `Frontend/salyco-front/nginx.conf` | gzip for text assets; `Accept`-based AVIF/WebP negotiation; cache headers cleaned up |
| `Frontend/salyco-front/scripts/gen_image_derivatives.py` | **new** — generates `.avif`/`.webp` siblings, adaptive quality |
| `Frontend/salyco-front/Dockerfile` | new stage runs the generator; `nginx -t` now gates the build |
| `Frontend/salyco-front/index.html` | favicon points at a 2.4 KB icon instead of a 675 KB PNG |
| `Frontend/salyco-front/public/favicon*.png`, `favicon.ico`, `apple-touch-icon.png` | **new** — generated from `logo3.png` |

### Measured effect

| | Before | After | Change |
|---|---:|---:|---:|
| JS bundle transferred | 609,955 B | ~180,000 B (gzip) | **−70%** |
| CSS transferred | 67,008 B | ~12,000 B (gzip) | **−82%** |
| Favicon | 675,167 B | 2,449 B | **−99.6%** |
| All `dist/` images, best-case served | 6.9 MB | 544 KB | **−92.3%** |
| Homepage hero (production 3168×1344) | 5,205,266 B | 70,412 B AVIF | **−98.6%** |

Lowest quality across all 36 derivatives: **38.1 dB PSNR**. The floor is 38 dB —
the practical threshold for "no visible difference" on photographic content.

`dist/` grows on disk (7.7 MB → 9.1 MB) because it now holds three formats per
image. **Transferred** bytes fall 92%, since each request gets exactly one.

---

## How the image serving works

Your originals are never modified. The generator writes siblings:

```
layerdimage.png            5,205,266 B   <- untouched, still the fallback
layerdimage.png.avif          70,412 B   <- served to Chrome/Edge/Firefox/Safari 16+
layerdimage.png.webp         116,003 B   <- served to older Safari
```

nginx reads the browser's `Accept` header and picks the best available:

```nginx
map $http_accept $img_sfx {
    default        "";
    "~*image/avif" ".avif";
    "~*image/webp" ".webp";
}
...
try_files $uri$img_sfx $uri =404;
```

If the derivative is missing, or the browser is old, `try_files` falls through to
the original PNG. **Delete every `.avif`/`.webp` file and the site behaves exactly
as it does today** — that is the rollback.

No `<picture>` markup, no JavaScript, no component changes. `Vary: Accept` is set
so caches and CDNs keep the variants separate.

### Adaptive quality

A fixed quality number does not work across mixed content. On your own assets at
quality 50, the hero photo hit 39.9 dB but `matress.png` only reached 34.4 dB —
visibly soft, and it is the placeholder shown on every card with a missing image.

So the script encodes, measures PSNR against the source, and climbs a quality
ladder until it clears the floor. `matress.png` self-selected q=72 (40.1 dB);
everything else stayed at q=50. A derivative that ends up larger than its source,
or that cannot reach acceptable quality, is discarded so nginx serves the original.

---

## Before you deploy

### ⚠ Your production hero will be deleted by the next rebuild

`docker-compose.yml:54-56` mounts only `media_data` and `static_data` into
`frontend`. There is **no volume for `/usr/share/nginx/html`** — the Dockerfile
bakes `dist/` into the image:

```dockerfile
COPY --from=images /work/dist /usr/share/nginx/html
```

The hero you copied into the running container lives only in that container's
filesystem. **`docker compose up -d --build` will replace it** with the repo's
version, which is a different, smaller image:

| | Dimensions | Bytes |
|---|---|---:|
| Production (what you copied in) | 3168×1344 | 5,205,266 |
| `public/layerdimage.png` (repo) | 1456×720 | 1,325,810 |

I downloaded the production file and md5-verified it
(`2315b8cff525ad7ed3507cbc63728ad7`), so it is recoverable — but **I have not
overwritten your repo copy**, because which image you actually want is your call.

**Pick one before deploying:**

- **A — keep the production hero.** Copy the downloaded file over
  `public/layerdimage.png` and commit it. Rebuilds then preserve it. Costs ~5 MB
  in git history, but the served AVIF is 70 KB.
- **B — keep the repo hero.** Do nothing; the next build reverts production to
  1456×720. Served AVIF would be ~66 KB.
- **C — mount a volume** for the web root so manually-copied files persist. More
  moving parts, and it means the repo is no longer the source of truth.

I'd take **A**: one commit, and the repo becomes truthful about what production
serves. Tell me which and I'll wire it up.

### Anything you copy in later needs one command

The generator runs at build time, so a file copied into a live container has no
derivatives — nginx will serve the original, which is correct but slow. After
copying an image in:

```bash
docker compose exec frontend sh -c 'ls /usr/share/nginx/html/*.png'   # confirm it's there
# then, from the host:
docker compose build frontend && docker compose up -d frontend
```

Or run the generator directly against the mounted media volume:

```bash
docker compose exec backend python /app/../gen_image_derivatives.py /app/media
```

(That path assumes you copy the script into the backend image; simplest is to
rebuild.)

---

## Deploy

```bash
# 1. Validate the nginx config in isolation. I could NOT run this -- the Docker
#    daemon was not running on your machine, so it is unverified.
docker run --rm -v "$PWD/Frontend/salyco-front/nginx.conf":/etc/nginx/conf.d/default.conf:ro \
  nginx:1.27-alpine nginx -t

# 2. Build (the Dockerfile also runs `nginx -t`, so a bad config fails the build)
docker compose build frontend

# 3. Deploy
docker compose up -d frontend
```

## Verify after deploy

```bash
# gzip must now report an encoding (this was absent before)
curl -sSI -H "Accept-Encoding: gzip" https://salyco.ir/assets/index-*.js \
  | grep -i content-encoding

# AVIF negotiation: expect content-type: image/avif and ~70 KB
curl -sSI -H "Accept: image/avif,image/webp,*/*" https://salyco.ir/layerdimage.png \
  | grep -iE "content-type|content-length|vary"

# WebP fallback: expect image/webp
curl -sSI -H "Accept: image/webp,*/*" https://salyco.ir/layerdimage.png \
  | grep -iE "content-type|content-length"

# Old browser: must still get the untouched PNG at full size
curl -sSI -H "Accept: */*" https://salyco.ir/layerdimage.png \
  | grep -iE "content-type|content-length"

# Favicon
curl -sS -o /dev/null -w "%{http_code} %{size_download}\n" https://salyco.ir/favicon-32.png

# Media negotiation
curl -sSI -H "Accept: image/avif,*/*" https://salyco.ir/media/mattresses/main.png \
  | grep -iE "content-type|content-length"
```

Expected: `content-encoding: gzip` on the bundle; `image/avif` at ~70 KB for the
hero; `image/png` at 5,205,266 B for `Accept: */*`; `Vary: Accept` on all image
responses.

## Rollback

Any of these, independently:

- **Images only** — delete the `.avif`/`.webp` files, or remove the two
  `try_files $uri$img_sfx ...` lines. Originals are untouched and become the only
  thing served.
- **gzip only** — remove the `gzip` block.
- **Favicon only** — restore `<link rel="icon" type="image/png" href="/logo3.png" />`
  in `index.html`. `logo3.png` was never modified.
- **Everything** — `git checkout Frontend/salyco-front/`, rebuild.

---

## Not done in this phase

Deliberately out of scope, still open:

| Item | Where | Why deferred |
|---|---|---|
| Broken `/catalog.pdf` hero CTA | plan §1.5 | Needs a real PDF from you, or the button removed — your call |
| Memory-foam claims on Emperial | `salyco-product-copy-rewrite.md` §1 | Production DB content; I can't edit it. Django admin or a data migration |
| Test review setting the 2.00 rating | product-copy §4 | Same — production DB |
| Headline price understatement | product-copy §3 | Needs your decision between "from" labelling and Queen pricing |
| Self-host Vazirmatn | plan §1.8 | Small but touches font loading; worth its own change |
| `www` → apex redirect | plan §2.7 | Needs you to choose the canonical hostname; affects live SEO |
| Per-route meta, sitemap, robots.txt, JSON-LD | plan §2 | Phase 2 |

The three DB items are the highest-value things left, and they are the ones I
cannot do from here.
