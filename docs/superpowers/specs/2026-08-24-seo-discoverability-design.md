# Discoverability: per-route metadata, structured data, sitemap

Date: 2026-08-24
Status: approved for planning

## Problem

Every one of the site's 24 routes serves the same `<title>` and the same
`<meta name="description">`, because `index.html` is the only place either
one is set and nothing in `src/` ever writes to `document.head`. Three
consequences, in descending order of cost:

1. **Nothing is shareable.** There is not one `og:` or `twitter:` tag in
   the codebase. A product link pasted into Telegram, WhatsApp or
   Instagram DM — the dominant discovery channels for an Iranian consumer
   brand — renders as a bare URL with no image, no title and no price.
   Every share the brand earns is spent on a grey rectangle.
2. **No product is eligible for a rich result.** There is no JSON-LD
   anywhere: no `Organization`, no `LocalBusiness`, no `Product`, no
   `Offer`, no `AggregateRating`, no `BreadcrumbList`, no `FAQPage`. The
   API already returns `price`, `discount_price`, `is_available`,
   `rating`, `review_count`, per-size prices and `MattressFAQ` rows. The
   data for price-and-stars search results exists and is simply never
   handed to a crawler.
3. **Nothing tells a crawler what exists.** No `robots.txt`, no
   `sitemap.xml`. Discovery of product and article pages depends entirely
   on a crawler executing the SPA's JavaScript and following React Router
   links.

Two conversion defects found in the same sweep, both one-line fixes, both
on surfaces this work already touches:

- `src/components/Hero.jsx:51` — the above-the-fold secondary CTA is
  `<a href="/catalog.pdf" download>`, and `public/catalog.pdf` does not
  exist. Under the SPA fallback in `nginx.conf` the request resolves to
  `try_files … /index.html`, so the browser silently downloads the HTML
  shell named `catalog.pdf`. It does not 404 — it appears to work and
  produces a corrupt file.
- `src/components/AboutFooter.jsx:108-114` — `href="mailto:info@salyco.com"`
  under visible text `thisissalyco@gmail.com`. Clicking mails an address
  the visitor was never shown.

## Measured baseline

`Frontend/salyco-front`, branch `feat/warranty-admin-approval`, 2026-08-24:

| Signal | Present | Evidence |
| --- | --- | --- |
| Distinct `<title>` per route | 1 of 24 | `index.html:22`, sole occurrence |
| Distinct `<meta description>` | 1 of 24 | `index.html:9-12`, sole occurrence |
| `og:*` tags | 0 | no match in `src/` or `index.html` |
| `twitter:*` tags | 0 | no match |
| `<link rel="canonical">` | 0 | no match |
| JSON-LD blocks | 0 | no `application/ld+json` match |
| `robots.txt` | absent | not in `public/` |
| `sitemap.xml` | absent | not in `public/` |
| Hostname canonicalisation | none | `Caddyfile:5` serves both hosts |

The `grep` hits for `title` inside `ProductDetail.jsx` are the review
form's `title` input field, not document metadata. There is no metadata
handling in the codebase at all.

## Decisions

Five choices, each taken against a more obvious alternative.

### No `react-helmet` — React 19 hoists metadata natively

`package.json` pins `react` and `react-dom` at `^19.2.6`. React 19 hoists
`<title>`, `<meta>` and `<link>` into `document.head` from anywhere in the
tree. A plain component rendering those tags is sufficient, so the
dependency, its provider wrapper and its SSR-collection API are all
unnecessary. **Zero new runtime dependencies.**

### "Prerender" means meta injection, not DOM rendering

The conventional route — `vite-plugin-prerender`, `puppeteer`, `react-snap`
— needs a Chromium binary inside the `node:22-alpine` build stage of
`Frontend/salyco-front/Dockerfile`. That is a large, brittle addition to
the image for a benefit we do not need: the goal is correct `<head>`
content for crawlers that do not execute JavaScript, not server-rendered
body markup.

So the post-build step copies `dist/index.html` once per static route and
substitutes that route's `<title>`, description and OG tags. The `<body>`
is left byte-identical. Because `src/main.jsx` mounts with `createRoot`
rather than `hydrateRoot`, there is no hydration contract to violate — the
app boots from an empty `#root` exactly as it does today, on every route,
prerendered or not.

The tradeoff, stated plainly: this fixes social cards and crawler-visible
titles for the 12 **statically known** routes. Product and article detail
pages keep runtime-only metadata. Google renders JavaScript and will see
those; Telegram and WhatsApp will not. Closing that gap needs
request-time injection at the Django or nginx layer and is deliberately
deferred (see Scope).

### `sitemap.xml` is served by Django, not generated at build

The frontend builds inside Docker with no route to the database, so a
build-time generator could only ever emit the 12 static and category
routes — omitting precisely the product and article pages that carry the
SEO value. A Django view has ORM access, needs no rebuild to stay fresh,
and cannot drift from the catalogue.

Written as a plain XML view rather than via `django.contrib.sitemaps`,
because that framework wants `django.contrib.sites`, which is not in
`INSTALLED_APPS` (`core/settings.py:106-123`). Adding it means a migration
and a `SITE_ID` for no gain over ~40 lines of explicit XML.

### `try_files` gains `$uri.html`, and routes emit flat files

`nginx.conf:67` is currently `try_files $uri $uri/ /index.html`. Writing
the prerendered output as `dist/products/index.html` would make nginx
match the `$uri/` clause for `/products` and issue a 301 to `/products/`,
appending a trailing slash to URLs that do not have one today. Writing
`dist/products.html` and inserting `$uri.html` before `$uri/` serves the
file directly and leaves every existing URL byte-identical.

### `priceCurrency` is `IRR`, with the stored value multiplied by ten

Prices render as تومان (`ProductCard.jsx:178`, `MattressCard.jsx:152`) and
are stored as plain decimals (`mattress/models.py:91`), so the stored unit
is Toman. `schema.org` requires an ISO 4217 code and none exists for
Toman. Emitting `IRR` against the raw Toman figure would understate every
price tenfold to Google; `IRT` is not a real ISO code and risks the offer
block being discarded. So: `priceCurrency: "IRR"`, `price: stored × 10`.

The conversion lives in exactly one helper in `src/seo/schema.js` so the
assumption has a single home. **If the database is ever migrated to store
Rial, that helper is the only edit.**

## Approach

Eight sections. 1–3 are the frontend metadata layer, 4–7 the crawler
surface, 8 the two conversion defects.

## 1. Route metadata as pure data

`src/seo/routeMeta.js` — the single source of truth for the metadata of
every statically known route, and the one module imported by *both* the
browser bundle and the Node prerender script.

It must therefore have **no imports**. This is the reason it does not
simply reuse `src/config/productCategories.js`: that module imports icon
components from `lucide-react` at its top level, so a bare `node` process
importing it for the prerender step would fail on a dependency it has no
business loading.

The duplication that creates — five category keys listed in two places —
is guarded rather than tolerated: the verification harness asserts the key
sets are identical, so a sixth category added to `productCategories.js`
without a `routeMeta.js` entry fails verification instead of silently
shipping an untitled page.

Twelve routes carry real metadata:

| Path | Note |
| --- | --- |
| `/` | home |
| `/products` | catalogue index |
| `/products/mattress` | تشک |
| `/products/bedbox` | باکس تخت خواب |
| `/products/pillow` | بالش |
| `/products/duvet` | روتختی |
| `/products/topper` | محافظ تشک و تاپر |
| `/about` | |
| `/contact` | |
| `/dealers` | |
| `/articles` | |
| `/productregistration` | warranty registration |

The five category entries take their Persian copy from the `heading` and
`blurb` already written in `productCategories.js`, so the catalogue's
voice is not reinvented.

The module also exports `SITE_URL = "https://salyco.ir"` and
`OG_DEFAULT`. `SITE_URL` is load-bearing beyond canonicals: **`og:image`
and `og:url` must be absolute** — a root-relative path is silently dropped
by every social crawler, which is the single most common way an OG
implementation appears correct in review and produces no card in
practice.

## 2. The `<Seo>` component

`src/seo/Seo.jsx`. One component, props `title`, `description`,
`canonical`, `image`, `type`, `noindex`.

Renders `<title>`, `<meta name="description">`, `<link rel="canonical">`,
the `og:` set (`title`, `description`, `image`, `url`, `type`,
`site_name`, `locale` = `fa_IR`) and the `twitter:` set (`card` =
`summary_large_image`, `title`, `description`, `image`). Absolutises
`canonical` and `image` against `SITE_URL` unconditionally, so a caller
cannot pass a relative path and quietly break the card.

`noindex` emits `<meta name="robots" content="noindex,nofollow">` and is
applied to every route that is either private or thin:

- **Private:** `/auth`, `/user-info`, `/cart`, `/checkout`, `/warranty/my`,
  `/warranty/mattress/:serialNumber`, `/orders/:token`, `/admin/*`
- **Thin or duplicative:** `/search`

`/warranty/mattress/:serialNumber` and `/orders/:token` matter most here.
Both are public by design — the URL token *is* the credential
(`App.jsx:74-77`) — and both render customer data. They must never be
indexed, and Section 5 blocks them in `robots.txt` as well. Two
independent mechanisms, because either alone is a single point of failure
for leaking a customer's order into search results.

## 3. Structured data

`src/seo/JsonLd.jsx` renders a `<script type="application/ld+json">` with
`JSON.stringify`-ed props. `src/seo/schema.js` holds the builders.

| Builder | Rendered on | Notes |
| --- | --- | --- |
| `organizationSchema()` | sitewide, from `App.jsx` | logo, `contactPoint` `+985142222687`, `url` |
| `localBusinessSchema()` | `/contact`, `/about` | address نیشابور، خیابان مدرس، خیابان فضل, خراسان رضوی (`Contact.jsx:20`) |
| `productSchema(product, sizes)` | `/products/:category/:slug` | `brand`, `image`, `description`, `material`, offers |
| `breadcrumbSchema(items)` | catalogue, product, article | |
| `articleSchema(article)` | `/articles/:slug` | `datePublished`, `dateModified` |
| `faqSchema(faqs)` | product detail, when `faqs` non-empty | from `MattressFAQ` |
| `itemListSchema(products)` | `/products`, `/products/:category` | |

Three details in `productSchema` decide whether the rich result is
correct or rejected:

- **Offers.** A product with priced sizes emits `AggregateOffer` with
  `lowPrice`/`highPrice` across `MattressSize` rows; a product without
  them emits a single `Offer`. Both use `discount_price ?? price`, so the
  advertised figure matches what the page shows. `availability` maps
  `is_available` (and per-size `in_stock`) to `InStock`/`OutOfStock`.
- **`aggregateRating` is conditional on `review_count > 0`.**
  `Mattress.rating` defaults to `5.00` before any review exists — the
  serializer comment at `mattress/serializers.py:45-48` says so
  explicitly. Emitting that default is a fabricated five-star rating on
  every unreviewed product: a manual-action risk with Google, and simply
  untrue. The builder omits the block entirely unless real reviews back
  it.
- **Images absolutised.** `image` arrives as `/media/…` and must be
  joined to `SITE_URL`.

## 4. Prerendering the static routes

`scripts/prerender.mjs`, run after `vite build`. For each of the 12 routes
in `routeMeta.js`: read `dist/index.html`, replace the `<title>` and
description, inject the absolute `og:`/`twitter:`/canonical set, write
`dist/<path>.html` (`/` stays `dist/index.html`).

It creates `dist/products.html` alongside the existing
`dist/products/`-less tree; the five category pages become
`dist/products/mattress.html` and siblings, which requires creating
`dist/products/`. That directory must **not** contain an `index.html`, or
the `$uri/` clause reappears and `/products` starts redirecting again.

`package.json` becomes `"build": "vite build && node scripts/prerender.mjs"`,
so the Dockerfile's existing `RUN npm run build` picks it up with no
change to the image.

The script asserts that the tags it is replacing were actually found, and
exits non-zero otherwise. Without that, a future edit to `index.html`'s
`<head>` turns this into a silent no-op that still ships — the failure
mode being one grey rectangle per share, discovered months later.

## 5. `robots.txt`

`public/robots.txt`, copied verbatim into `dist/` by Vite.

`Allow: /`, a `Sitemap: https://salyco.ir/sitemap.xml` pointer, and
`Disallow` for `/admin/`, `/auth`, `/user-info`, `/cart`, `/checkout`,
`/warranty/my`, `/orders/`, `/search`.

`/warranty/mattress/` is disallowed too. Note this is belt-and-braces
with the `noindex` of Section 2 and not a substitute for it: `robots.txt`
prevents crawling, `noindex` prevents indexing, and a URL that is linked
from elsewhere can be indexed without ever being crawled.

## 6. `sitemap.xml` from Django

`Backend/core/seo_views.py`, routed at `path("sitemap.xml", …)` in
`core/urls.py`. Returns `application/xml` listing:

- the 12 static routes from Section 1
- every `Mattress`, as `/products/{category}/{slug}`
- every published `Article` (`is_published=True`), as `/articles/{slug}`,
  with `<lastmod>` from `updated_at`

Two constraints the models impose:

- **Products get no `<lastmod>`.** `Mattress` has no `created_at` or
  `updated_at` field — `models.py` puts timestamps on `Review` (line 330)
  and `MattressInstance` (line 445) but not on the product itself.
  `<lastmod>` is optional, so the entry is simply omitted rather than
  faked with `timezone.now()`, which would tell crawlers every product
  changed on every fetch and devalue the signal.
- **Products are listed regardless of `is_available`.** An out-of-stock
  product page still holds ranking and inbound links; removing it from
  the sitemap discards that. Stock state is communicated through
  `Offer.availability` in Section 3, which is what it is for.

Articles are filtered on `is_published` because unpublished drafts are
not reachable and must not be advertised.

The view builds absolute URLs from a single `SITE_URL` setting so the
frontend constant and the backend constant cannot disagree about scheme
or hostname.

## 7. nginx and Caddy

`nginx.conf`, two edits:

```nginx
location = /sitemap.xml {
    proxy_pass http://django;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $forwarded_proto;
}
```

and line 67 becomes `try_files $uri $uri.html $uri/ /index.html;`.

The `= /sitemap.xml` exact match is deliberate — a prefix `location
/sitemap` would also capture any future `/sitemap-images.xml` and is
easier to get subtly wrong than to get right.

`Caddyfile`, hostname canonicalisation:

```caddy
www.salyco.ir {
    redir https://salyco.ir{uri} permanent
}

salyco.ir {
    reverse_proxy frontend:80
}
```

Today `Caddyfile:5` serves both hostnames from one block, so every page exists
at two addresses with no signal about which is authoritative — split link
equity and duplicate content, on every URL on the site. The canonical
tags from Section 2 declare `salyco.ir`; this makes the server agree
rather than leaving the two in contradiction.

## 8. The two conversion defects

**`Hero.jsx`** — the catalog CTA becomes a React Router `<Link>` to
`/products/mattress` labelled «مشاهده تشک‌ها», replacing the `<a download>`.
The `Download` import from `lucide-react` goes with it; `ArrowLeft` is
already imported for the primary CTA.

**`AboutFooter.jsx`** — the visible text becomes `info@salyco.com`,
matching the `mailto:` that was already there. The Gmail address is
removed.

Deliberately **not** touched here: the hero's headline, its unquantified
highlight labels («گارانتی معتبر» rather than a stated term), and the
Enamad seal's placement in the footer. Those are copy and CRO decisions
that belong with the conversion work, and changing them inside an SEO
change would make both harder to evaluate.

## Testing

**Frontend**, following the existing `verify-footer.mjs` pattern —
`esbuild` bundle plus `renderToStaticMarkup`, since the project has no
test runner configured:

`verify-seo.mjs` asserts:
1. `<Seo>` renders `<title>`, description, canonical, the `og:` set and
   the `twitter:` set.
2. Relative `canonical` and `image` inputs come out absolute against
   `SITE_URL`. This is the assertion that would have caught the most
   likely silent failure.
3. `noindex` emits `noindex,nofollow`, and every route listed as private
   in Section 2 sets it.
4. `productSchema` **omits** `aggregateRating` when `review_count === 0`
   and includes it when positive.
5. `productSchema` emits `AggregateOffer` with correct
   `lowPrice`/`highPrice` for a multi-size product and `Offer` for a
   sizeless one, both at `discount_price ?? price`, both `×10` in `IRR`.
6. `routeMeta.js` category keys exactly equal `PRODUCT_CATEGORIES` keys —
   the drift guard from Section 1.
7. Every builder's output is valid JSON with an `@context` and a `@type`.

**Post-build**, asserted against `dist/` after `npm run build`:
8. All 12 `dist/*.html` files exist, each with a distinct `<title>` and a
   distinct `og:title`.
9. `dist/products/index.html` does **not** exist — the trailing-slash
   regression guard from Section 4.
10. `dist/robots.txt` exists and names the sitemap.
11. The prerender script exits non-zero against an `index.html` whose
    `<title>` has been renamed.

**Backend**, alongside `mattress/tests.py`:
12. `GET /sitemap.xml` returns 200 and `application/xml`.
13. Output is well-formed XML (parsed, not regex-matched) and contains
    every static route.
14. A created `Mattress` appears as `/products/{category}/{slug}`; a
    published `Article` appears with `<lastmod>`; an unpublished one does
    not appear.
15. An unavailable product still appears — the Section 6 decision, pinned
    so a later "cleanup" does not quietly reverse it.

## Scope

**In:** everything in Sections 1–8.

**Out, deliberately:** request-time meta injection for `/products/:slug`
and `/articles/:slug`, which is what would give those pages real social
cards. It needs Django to serve `index.html` with per-slug meta, changing
how the SPA is delivered, and it should be judged on its own. Sections
1–7 are a prerequisite for it either way; nothing here is thrown away
when it lands.

**Out, other phases:** analytics and event tracking (no `dataLayer`
exists, so conversion is currently unmeasurable — a real gap, but a
separate subsystem). Hero copy, quantified trust claims and Enamad
placement. Performance, which
`docs/superpowers/specs/2026-08-24-mobile-speed-design.md` already covers.

**Out, noted but not addressed:**

- `Mattress` has no `updated_at`. Adding one is a model change plus a
  migration, and would let the sitemap carry `<lastmod>` for products —
  a genuine crawl-efficiency gain, but not this phase's change to make.
- No social profile links exist anywhere in the site, so
  `Organization.sameAs` ships empty. Worth filling once the accounts are
  known.
- `OG_DEFAULT` initially points at `/layerdimage.png` (1456×720, ~2:1,
  1.3 MB) because it is the only existing asset near the 1.91:1 OG
  aspect. A purpose-made 1200×630 under ~200 kB is the correct asset;
  the image pipeline in the mobile-speed spec is the natural place to
  produce it. **The path must stay stable and unhashed**, since crawlers
  cache OG images aggressively.

## Deployment note

```bash
docker compose up -d --build
```

A full rebuild is required, not a restart: `nginx.conf` is baked into the
frontend image (`Dockerfile:24`), and the prerendered HTML is produced by
`npm run build` inside the build stage. The `Caddyfile` is bind-mounted
per `docker-compose.yml` and only needs Caddy to reload.

After deploy, two verifications that cannot be done locally:

1. `curl -s https://salyco.ir/sitemap.xml | head` — confirms the nginx
   proxy reaches Django rather than falling through to the SPA. This is
   the change most likely to be wrong in production and fine locally,
   because the local Vite proxy (`vite.config.js:12-21`) forwards only
   `/api` and `/media`.
2. Paste `https://salyco.ir/products/mattress` into Telegram — the
   end-to-end check that the prerendered card actually renders. Note that
   Telegram caches per URL, so test with a URL not yet shared.

Then submit the sitemap in Google Search Console.

## Branch

`feat/seo-discoverability`, based on `feat/warranty-admin-approval`
(current `HEAD`, 6 commits ahead of `master`, 0 behind).

Basing here rather than on `master` is deliberate. `feat/mobile-speed`
holds only this repo's other spec and is an ancestor of the current
branch, so it is not a base candidate. More importantly, when the
mobile-speed work is implemented it will touch four files this phase also
touches — `nginx.conf`, `Caddyfile`, `package.json` and `Hero.jsx`.
Sequencing this phase first and rebasing mobile-speed onto it keeps the
conflicts to one predictable resolution rather than two.
