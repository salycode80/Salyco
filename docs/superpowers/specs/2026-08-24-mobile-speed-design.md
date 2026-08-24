# Mobile speed: assets, compression, bundle splitting

Date: 2026-08-24
Status: approved for planning

## Problem

The site is heavier than it needs to be by roughly an order of magnitude,
and almost all of the weight lands on mobile visitors on Iranian mobile
data — the majority of the audience for a consumer mattress brand.

Three independent causes, none of them in application logic:

1. **Nothing is compressed.** Caddy proxies to nginx without an `encode`
   directive and nginx has no `gzip` block, so the JS and CSS bundles are
   served at full uncompressed size. Vite already reports what they would
   compress to; the server just never uses it.
2. **~7 MB of PNGs in `public/`**, none converted to a modern format,
   none resized for mobile, none carrying intrinsic dimensions. Over a
   third of that is either unreferenced or serving a role that warrants a
   few kilobytes.
3. **No code splitting.** `App.jsx` imports all 24 route components
   eagerly, so a visitor landing on the home page downloads the admin
   workspace and the product detail page before seeing anything.

A fourth cause is latent rather than current: admin uploads are stored
and served exactly as received, so a single 5 MB phone photo uploaded
through `CreateInstancePanel` silently undoes the image work.

## Measured baseline

`npm run build` on `feat/mobile-speed`, 2026-08-24:

| Artifact | Size | Vite gzip | Served today |
| --- | --- | --- | --- |
| `assets/index-*.js` | 594.34 kB | 159.70 kB | **594.34 kB** |
| `assets/index-*.css` | 66.58 kB | 11.76 kB | **66.58 kB** |
| `index.html` | 1.35 kB | 0.75 kB | 1.35 kB |
| `public/` images | ~7.0 MB | — | ~7.0 MB, no cache headers |
| **`dist/` total** | **7.7 MB** | — | **7.7 MB** |

The "served today" column is the point. Compression alone accounts for
roughly 490 kB per uncached visit before a single image is touched.

Largest files in `dist/`, with reference counts from `src/` and
`index.html`:

| File | Bytes | Refs | Note |
| --- | --- | --- | --- |
| `matress.png` | 1,402,091 | 12 | broken-image fallback |
| `layerdimage.png` | 1,325,810 | 1 | content image |
| `logo.png` | 1,069,775 | **0** | dead |
| `heroimage2.png` | 961,842 | 1 | content image |
| `logo3.png` | 675,167 | 2 | favicon |
| `banner2.png` | 547,506 | 1 | content image |
| `banner.png` | 537,315 | 1 | content image |
| `locationimage.jpg` | 193,204 | 2 | content image |
| `navbar-logo2.png` | 136,939 | 1 | navbar logo |
| `navbar-logo.png` | 135,017 | **0** | dead |
| `heroimage.png` | 92,489 | 2 | content image |
| `navbar-logo5.png` | 43,002 | **0** | dead |
| `navbar-logo3.svg` | 25,369 | **0** | dead |

## Decisions

Settled during brainstorming; recorded so the plan does not relitigate
them.

- **Speed before interactivity.** Motion layered onto a slow page
  amplifies the jank rather than hiding it. Gestures, transitions, PWA
  and the sticky add-to-cart bar are Phase 2, brainstormed separately
  once this phase is measured and deployed.
- **All three layers are in scope**: frontend code and assets, the
  Caddy/nginx serving config, and Django upload processing.
- **Committed image derivatives, not a build-time plugin.** A one-time
  `sharp` script writing to `public/opt/` keeps `sharp` out of the Docker
  build, so deploy time and image size are unchanged. The cost is ~15
  generated files in git and a manual re-run when images are added. The
  alternative (`vite-imagetools`) would require moving assets out of
  `public/`, rewriting ~20 references, and putting a native binary in the
  deploy path — not worth it for ~15 rarely-changing static images.
- **Verify locally, deploy once.** Measured before/after from
  `npm run build`, plus a local compose run to prove the response headers
  actually land. There is no staging environment; a single deploy at the
  end of the phase.

## Approach

Six changes, ordered by win per unit of effort and risk. Each is
independently revertable.

## 1. Serving layer

No application code. Two config files.

### Caddy compression

```
salyco.ir, www.salyco.ir {
	encode zstd gzip
	reverse_proxy frontend:80
}
```

Caddy is the TLS edge, so compression belongs there. It also sidesteps a
real constraint: `nginx:alpine` ships without `ngx_brotli`, so brotli in
nginx would mean building a custom image. Caddy's `encode` covers the
same ground with one line — and note Caddy does brotli only for
*pre-compressed* `.br` files on disk, not on-the-fly, so `zstd gzip` is
the correct pair. zstd serves modern browsers, gzip serves the rest, and
Caddy negotiates per request and sets `Vary: Accept-Encoding` itself.

Expected: 661 kB of text assets → roughly 150 kB.

### nginx cache headers

Files in `public/` are copied to the nginx root and currently match only
`location /`, which sets no `expires` and no `Cache-Control`. Every
visitor re-validates them on every navigation.

```nginx
location ^~ /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
}

location ~* \.(png|jpe?g|gif|webp|avif|svg|ico|woff2?)$ {
    expires 30d;
    add_header Cache-Control "public";
    access_log off;
}
```

### The `^~` gotcha

The existing `/assets/` block must become `^~ /assets/` in the same
change, not later.

nginx resolves locations by remembering the longest prefix match, then
trying every regex location — and a regex match **wins over a remembered
prefix match**. The only exception is a prefix declared `^~`, which stops
matching immediately. Without it, Vite's content-hashed
`/assets/hero-a1b2c3.webp` would fall through to the image regex and
quietly get `30d` + `public` instead of `1y` + `immutable`, losing the
strongest caching on exactly the files that can safely have it. The
symptom is invisible in testing and only shows up as repeat-visit
traffic.

## 2. Asset triage

### Dead files

Delete, confirmed zero references from `src/` or `index.html`:

- `public/logo.png` — 1,069,775 B
- `public/navbar-logo.png` — 135,017 B
- `public/navbar-logo5.png` — 43,002 B
- `public/navbar-logo3.svg` — 25,369 B
- `public/icons.svg` — 5,031 B
- `public/navbar-logo.svg` — 4,752 B
- `public/12425791.txt` — 0 B

Roughly 1.28 MB.

### Hazard: `bedicon_*.png` must not be deleted

A literal filename search reports zero references for all six
`bedicon_*.png` files. They are nevertheless live. The paths are built at
runtime:

```js
image: `/bedicon_${std.width}_${std.length}.png`,
```

at `src/pages/ProductDetail.jsx:495` and
`src/pages/MattressDetail.jsx:422`. Deleting them breaks the size picker
on every mattress page with no build error and no console error — just
six broken images.

Any future asset cleanup must grep for the *stem* (`bedicon`), not the
filename. Recorded here because the next person to run a "find unused
assets" pass will hit this trap.

Section 3 changes where these six files live, so the interpolation above
changes with them — see "The `bedicon` files need a deliberate decision".
Nothing in *this* section deletes them.

### The 1.4 MB fallback

`matress.png` is referenced 12 times, in every `onError` handler:

```jsx
onError={() => setImageSrc("/matress.png")}
```

so it is the placeholder shown when a product image fails to load — a
1.4 MB download triggered by a failed download, on the connection that
just proved it was struggling. Replace with an inline SVG placeholder
(brand navy, category glyph, ~1 kB) exported from a single module so all
12 sites share one definition.

### The 660 kB favicon

`index.html:5` is `<link rel="icon" type="image/png" href="/logo3.png">`
— 675 kB fetched on every page load, rendered at 16 px. `public/favicon.svg`
(9.5 kB) already exists and is unreferenced. Switch to it, plus a
180×180 `apple-touch-icon.png` for iOS home-screen use.

The three parts of section 2 together: roughly 3.3 MB.

## 3. Image pipeline

### The script

`scripts/optimize-images.mjs`, `sharp` as a devDependency, exposed as
`npm run images`. Reads a declared target list and writes AVIF + WebP at
each width into `public/opt/`, plus one resized JPEG per image as the
universal `<img src>` fallback. Outputs are committed.

Widths follow actual usage rather than a generic ladder: full-bleed
banners and the hero get `640 / 1024 / 1600`; smaller inline images get
`640 / 1280`. The logo is a fixed display size and needs 1× and 2× only.

The script must be idempotent and must skip regeneration when the source
is older than the output, so re-running it is cheap.

### The originals must leave `public/`

The multi-megabyte source PNGs move to `assets-src/` at the frontend
project root — outside `public/`, so Vite does not copy them into
`dist/`. The script reads from there and writes to `public/opt/`.

This is load-bearing, not tidiness. Anything left in `public/` is
deployed whether or not a browser ever requests it, so keeping
`layerdimage.png` (1.33 MB) around "as the fallback" would ship the exact
bytes this section exists to remove. The fallback is the generated
~1024 px JPEG instead, which every browser in use can render.

Keeping the sources in `assets-src/` rather than deleting them means a
future re-encode at a different width or quality does not require
recovering files from git history.

### What stays in `public/` verbatim

Three groups are exempt from the move, for three different reasons:

- **`favicon.svg` and the new `apple-touch-icon.png`.** Referenced from
  `index.html` by literal path, which Vite does not rewrite. They must
  resolve at the document root.
- **SVGs generally.** Already resolution-independent; re-encoding them to
  a raster format would make them larger and worse.
- **The six `bedicon_*.png`.** These are reached by a path built at
  runtime, so they interact with the move in a way the plan must handle
  explicitly — see below.

### The `bedicon` files need a deliberate decision

`src/pages/ProductDetail.jsx:495` builds its path by interpolation:

```js
image: `/bedicon_${std.width}_${std.length}.png`,
```

Moving these six files to `assets-src/` without touching that line
produces six 404s at runtime with no build error — the same silent
failure the hazard note in section 2 describes, arrived at from the
opposite direction.

They total 131 kB across six files, so the saving is small either way.
The plan should take the cheaper correct option: convert them in place to
WebP and update the interpolation to match, in the same commit, e.g.

```js
image: `/opt/bedicon_${std.width}_${std.length}.webp`,
```

`<Picture>` also accepts a runtime-built `name`, so routing them through
it is possible — but for six fixed-size icons behind a single template
string it buys a format-negotiation chain that is not worth the extra
moving parts. Whichever is chosen, the interpolation and the file
locations must change together.

Expected for this section: the ~3.8 MB of content-image originals
(`layerdimage`, `heroimage2`, `banner`, `banner2`, `locationimage`,
`navbar-logo2`, `heroimage`) leave `public/` entirely, replaced by
roughly 1.3–1.5 MB of derivatives spanning every width and format. The
six `bedicon_*` add ~40 kB as WebP, down from 131 kB.

Note that this is not a 3.8 → 0.4 MB reduction on disk, because seven
variants replace one file. The reduction a visitor experiences is much
larger than the reduction `du` reports, which is why both numbers are
stated below.

### Two different numbers, both worth stating

Once derivatives exist, `dist/` size and bytes-per-visit diverge sharply,
and the plan must report both rather than conflating them:

- **`dist/` on disk** — every format at every width, plus the JPEG
  fallbacks and the split JS chunks. Expect roughly **2 MB, down from
  7.7 MB**. Derivatives multiply, so this is a ~4× improvement, not the
  ~8× the raw image arithmetic would suggest.
- **Transferred to one phone on a first visit to `/`** — one width, one
  format, compressed text. Expect roughly **150–250 kB**, against roughly
  2.5–3 MB today (594 kB JS + 67 kB CSS uncompressed, a 675 kB favicon, a
  137 kB logo, and the hero and banner images at full size). A phone
  requesting AVIF at 640 px never downloads the 1600 px WebP or the JPEG
  fallback, so six of the seven variants cost it nothing.

The second number is the one users feel. The first is what `du -sh dist`
reports, so it is the one that will otherwise get quoted by mistake — and
quoting it alone would undersell the change by roughly half.

### The `<Picture>` component

One component, `src/components/Picture.jsx`:

```jsx
<picture>
  <source type="image/avif" srcSet={avifSet} sizes={sizes} />
  <source type="image/webp" srcSet={webpSet} sizes={sizes} />
  <img
    src={fallback}
    width={width}
    height={height}
    alt={alt}
    loading={priority ? "eager" : "lazy"}
    fetchPriority={priority ? "high" : "auto"}
    decoding="async"
  />
</picture>
```

AVIF first, WebP second, original last: the browser takes the first
`type` it supports, so ordering is the negotiation.

`width` and `height` are required props, not optional. They are what
reserves layout space before the bytes arrive, and layout shift is felt
on mobile as text jumping while it is being read — the single most
irritating mobile failure mode and the cheapest to prevent.

`sizes` must describe the CSS layout, not the file. Getting it wrong
makes `srcset` actively harmful: an over-wide `sizes` makes phones pick
the desktop file, which is worse than shipping one medium image.

### LCP handling

Exactly one image per page gets `priority` — the largest above-the-fold
image, which on `/` is the hero. Everything else stays lazy.

This is asymmetric and worth stating plainly: lazy-loading the LCP image
delays the metric it defines, so the optimisation inverts into a
regression. The audit must confirm the hero is `eager` +
`fetchPriority="high"` and that no other above-the-fold image claims
`priority`.

## 4. Bundle splitting

### Lazy routes

`React.lazy` for every route except `Home`, with one `<Suspense>`
boundary in `App.jsx`. The fallback reuses the existing skeleton idiom
already present in `ProductList.jsx` and `FeaturedProducts.jsx` rather
than introducing a new loading style.

Deferred from the initial download: the admin workspace and its six
panels (~2,000 lines), `ProductDetail.jsx` (1,015),
`CheckoutOrder.jsx` (610), `UserInfo.jsx` (633), `Articles.jsx` (443),
`OrderPublicPage.jsx` (420).

Providers, `Navbar`, `AboutFooter`, `ScrollToTop` and
`SessionTimeoutModal` stay eager — they render on every route, so
splitting them would add a round trip and buy nothing.

### Vendor chunk

`build.rollupOptions.output.manualChunks` splitting React, React DOM,
React Router, axios and `jwt-decode` into a `vendor` chunk. Dependencies
change far less often than page content, so a stable vendor hash means
repeat visitors re-download only what actually changed instead of the
whole bundle on every deploy.

594 kB is high for this dependency list, so the plan includes one
explicit step to inspect the chunk composition — `lucide-react` is the
prime suspect for failing to tree-shake — and to act on what it shows
rather than assuming.

### Dead route components (hygiene, not a size win)

`MattressDetail.jsx` (841 lines), `Mattress.jsx` (63) and the
`MattressCard.jsx` (180) that only `Mattress.jsx` uses are imported by
nothing and routed nowhere. `ProductDetail.jsx` is a fork of
`MattressDetail.jsx` — both call `getMattressDetail` and both build the
`bedicon` paths.

Because nothing imports them, Rollup already tree-shakes them; deleting
them does **not** reduce the bundle. The reason to delete is that 1,084
lines of near-duplicate page code invites edits to the wrong file. This
is stated explicitly so the before/after measurement is not credited to
it.

Note the ordering constraint: `MattressDetail.jsx:422` is one of the two
`bedicon` references. Delete it and `ProductDetail.jsx:495` becomes the
only one — the hazard note above still applies.

## 5. Sticky positioning fix

`src/index.css:84` sets:

```css
html, body { overflow-x: hidden; }
```

`overflow-x: hidden` makes both elements scroll containers. A
`position: sticky` element sticks within its nearest scrolling ancestor,
so every sticky descendant now sticks to a container that cannot scroll —
which reads as sticky silently not working. It is why these carry bare
`sticky` classes with no offset and no observable effect:

- `src/pages/CartPage.jsx:163` — `sticky p-6`, no `top-*`
- `src/pages/Articles.jsx:419` — `sticky`, no `top-*`

And why this one tucks under the navbar: `src/pages/checkout/CheckoutOrder.jsx:564`
uses `top-24` (96 px) against a navbar that `index.css:21` declares as
108 px.

Fix:

```css
html, body {
  overflow-x: hidden; /* fallback: Safari < 16 */
  overflow-x: clip;
}
```

`overflow: clip` contains overflow without creating a scroll container,
so sticky works again. The duplicated declaration is deliberate
progressive enhancement — browsers that do not know `clip` discard the
second line and keep the current behaviour.

Then give all three the navbar-aware offset already used correctly at
`src/pages/admin/AdminWorkspace.jsx:109`:

```
top-[calc(var(--navbar-height)+1rem)]
```

This is the one change in the phase with a visible behavioural effect
rather than only a size effect, so it needs a look at each of the three
pages at mobile and desktop widths.

## 6. Django upload compression

New `Backend/core/imaging.py`:

```python
def compress_upload(field_file, *, max_width=1600, quality=82):
    """Downscale and re-encode an uploaded image to WebP in place."""
```

Pillow is already in `requirements.txt`, so no new dependency. `core/` is
the existing home for shared backend code.

Called from `save()` on the four models that accept uploads:

- `mattress/models.py:92` — product main image, `upload_to="mattresses/"`
- `mattress/models.py:210` — gallery image, `upload_to="mattresses/gallery/"`
- `articles/models.py:10` — article image, `upload_to="articles/"`
- `banners/models.py:8` — banner image, `upload_to="banners/"`

`articles/models.py:18` already overrides `save()` for slug generation,
so it gains a call rather than a new method.

No migration: `upload_to` and the field type are unchanged, only the
bytes written. Existing media is untouched — this bounds future uploads
and does not retroactively rewrite the current files.

Constraints for the implementation:

- Idempotent. Re-saving a model must not re-encode an already-processed
  image into generational quality loss.
- Non-destructive on failure. A file Pillow cannot open (a bad upload, a
  non-image with an image extension) must save unmodified rather than
  raise, so an admin never loses a product record to an image error.
- Transparency-preserving. WebP handles alpha, but the RGB conversion
  path must not flatten a transparent PNG logo onto black.

## Testing

There is no test framework in the repo. This phase is size-and-config
work, so verification is measurement, and the plan states the commands
and the expected direction for each.

- **Build measurement.** `npm run build` before and after, recording the
  per-chunk table and total `dist/` bytes. Report this alongside the
  per-visit figure, not as the headline on its own — see "Two different
  numbers" in section 3, since committed derivatives make `dist/` size
  understate the improvement by roughly half.
- **Per-visit measurement.** Load `/` in a throttled mobile profile with
  a cold cache and record total transferred bytes from the network panel.
  This is the headline number, because it is the one a customer on mobile
  data actually pays.
- **Header verification.** A local compose run plus
  `curl -sI -H 'Accept-Encoding: zstd, gzip'` against the Caddy port,
  asserting `content-encoding` is present on JS and CSS, and
  `cache-control: public, immutable` on `/assets/*`. Config that looks
  correct but fails to match is the main risk in section 1, and reading
  the file back cannot detect it — only a request can.
- **The `^~` assertion specifically.** Request a hashed asset under
  `/assets/` with an image extension and confirm it returns `immutable`,
  not `30d`. This is the regression the gotcha section describes.
- **`bedicon` integrity.** Load a mattress product page and confirm all
  six size-picker icons render — not by checking the files exist, but by
  looking at the rendered picker, since the failure mode is a 404 on a
  runtime-built path that no build step can catch. Verify all six widths
  (90, 120, 140, 160, 180, 200), because the interpolation could be
  correct for some and wrong for others.
- **Visual check** at 360 / 390 / 768 px: home, a product page, cart,
  checkout. Confirms the sticky change and the `<Picture>` swap did not
  shift layout.
- **Backend.** Upload an oversized image through `CreateInstancePanel`,
  assert the stored file is WebP and ≤1600 px wide; re-save the model and
  assert the bytes are unchanged (idempotence); upload a corrupt file and
  assert the record still saves.

`Frontend/salyco-front/verify-footer.mjs` is the house precedent for a
throwaway verification harness. If the `<Picture>` srcset and `sizes`
output needs asserting, add one in that style and delete it after.

## Scope

**In:** the six sections above.

**Out, deferred to Phase 2 (interactivity), to be brainstormed
separately:** swipe gestures on the product gallery and banner carousel;
a real bottom-sheet mobile menu with backdrop and scroll lock replacing
the current `max-height` transition; sticky mobile add-to-cart bar on
product pages; bottom tab navigation; route transitions; PWA manifest
and installability; the admin `<table>` in `DashboardPanel.jsx` needing a
mobile card fallback.

**Out, noted but not addressed:** 36 `.pyc` files are tracked in git,
which is why `Backend/mattress/__pycache__/` shows as modified in an
otherwise clean tree. Unrelated to this phase; mentioned so it is not
mistaken for a side effect of it.

## Deployment note

One deploy at the end of the phase, after local verification:

```bash
docker compose up -d --build
```

Both changed config files are read at container start — the `Caddyfile`
is bind-mounted (`docker-compose.yml`), and `nginx.conf` is baked into
the frontend image, so the frontend container must actually rebuild
rather than restart.

`docs/superpowers/plans/` is the home for the implementation plan that
follows this spec.

Branch: `feat/mobile-speed`, based on `feat/warranty-admin-approval`
rather than `master`. That branch is a strict fast-forward (3 commits
ahead, 0 behind), and the warranty work touches `mattress/models.py`,
which section 6 also touches — basing here avoids a predictable conflict.
If the warranty branch merges first, this one rebases onto `master`
cleanly.
