# Marketing content and discoverability

Date: 2026-08-25
Status: approved for planning

Supersedes and corrects
`docs/superpowers/specs/2026-08-24-seo-discoverability-design.md`, whose
Sections 1–7 are carried forward here with six corrections forced by live
production data. That spec was written against the repo; this one was
written against `https://salyco.ir`.

## Problem

The site is live and commercially invisible. A crawler fetching the home
page receives 1259 bytes with **zero characters of body text**, one
`<title>`, and no description — not even the one in the working tree's
`index.html`, because the deployed build predates it. Nothing else in
`<head>` exists: no `og:`, no `twitter:`, no canonical, no JSON-LD.

Four defects were found live that the prior spec's baseline did not cover:

1. **`/robots.txt` returns `text/html`, HTTP 200** — the SPA shell, via
   `try_files … /index.html`. `/sitemap.xml` does the same. A crawler
   asking for crawl directives receives an HTML page. This is worse than a
   404, and it means the prior spec's closing instruction to "submit the
   sitemap in Google Search Console" would have failed in a way that is
   confusing to diagnose.
2. **`/catalog.pdf` is broken in production.** `Hero.jsx:50-57` is the
   above-the-fold secondary CTA. It returns 200, `text/html`, 1355 bytes —
   every visitor who clicks «دانلود کاتالوگ» downloads a 1.3 KB HTML file
   named `catalog.pdf`. It does not fail visibly; it appears to work.
3. **`www.salyco.ir` returns 200 with no redirect.** Every URL on the site
   exists at two hostnames with nothing declaring which is authoritative.
4. **`AboutFooter.jsx:107` links `mailto:info@salyco.com`** under visible
   text `thisissalyco@gmail.com` (line 114). The confirmed address is the
   Gmail one. `salyco.com` resolves to `13.56.33.8` with its own separate
   MX record (`mail.salyco.com`), while `salyco.ir` is `212.23.201.86` with
   `mail.salyco.ir` — strongly suggesting a domain the company does not
   control. Customer enquiries sent through the footer have likely been
   reaching a third party.

Three content and IA problems compound these:

5. **Every slug is a hand-typed transliteration.** `mattress/models.py:89`
   declares `slug = models.SlugField(unique=True)` with no generation
   logic, so slugs are whatever was typed into the admin. The live set
   carries no keyword signal and is unreadable to a human deciding whether
   to click. `tsh-slo-mdl-shmrh-1` is additionally *stale*: it encodes
   «تشک سالیکو مدل شماره ۱» for a product since renamed «مدل امپریال».
6. **Four of five categories are empty but advertised.** `bedbox`,
   `pillow`, `duvet` and `topper` return 0 products from
   `/api/mattresses/?category=<key>`, yet all five appear in the nav — and
   the prior spec would have prerendered and sitemapped all five.
7. **Four strong articles are stranded.** The live article slugs decode to
   «سایز تشک مناسب», «بهترین تشک برای کمردرد», «تشک سفت یا نرم» and
   «راهنمای جامع خرید تشک — فرق تشک طبی و فنری». These are precisely the
   queries that precede a mattress purchase. They are invisible to
   crawlers, unreadable in a URL bar, and contain no path to a product.

## Measured baseline

`https://salyco.ir`, 2026-08-25. Measured against production, not the repo.

| Signal | State | Evidence |
| --- | --- | --- |
| Crawler-visible body text | 0 chars | `curl` home page, 1259 bytes total |
| Distinct `<title>` per route | 1 of 24 | sole occurrence, `index.html:22` |
| `<meta description>` served | **absent** | deployed build older than working tree |
| `og:*` / `twitter:*` / canonical | 0 / 0 / 0 | no match in live HTML |
| JSON-LD blocks | 0 | no `application/ld+json` |
| `/robots.txt` | HTTP 200, `text/html` | returns SPA shell |
| `/sitemap.xml` | HTTP 200, `text/html` | returns SPA shell |
| `/catalog.pdf` | HTTP 200, `text/html`, 1355 B | live broken CTA |
| `www.salyco.ir` | HTTP 200, no redirect | duplicate host |
| Live products | 2 | both `category=mattress` |
| Live categories with stock | 1 of 5 | bedbox/pillow/duvet/topper = 0 |
| Live articles | 4 | plain-text body, no product links |
| Slugs carrying keyword signal | 0 of 6 | all transliterated |

Product data available for copy and schema:

| Field | امپریال | پرستیژ |
| --- | --- | --- |
| `slug` | `tsh-slo-mdl-shmrh-1` | `mdl-rst` |
| `price` / `discount_price` | 27,000,000 / 24,300,000 (10%) | 19,000,000 / 16,150,000 (15%) |
| `warranty_months` | 120 | 120 |
| `trial_nights` | **0** | **0** |
| `material` | **blank** | **blank** |
| `average_rating` / `review_count` | **2.00 / 1** | 5.00 / **0** |
| `image` | **already absolute URL** | **already absolute URL** |
| dimensions (l/w/h) | 200/160/31 | 200/160/24 |

`warranty_months: 120` is a hard ten-year claim currently rendered as the
vague «گارانتی معتبر». `trial_nights: 0` means no trial-nights claim is
available — worth recording, because it is the obvious thing to reach for
in mattress copy and it would be false here.

## Confirmed business facts

Supplied by the owner, 2026-08-25:

- **Email:** `thisissalyco@gmail.com` (the visible text is correct; the
  `mailto:` is wrong)
- **Instagram:** `instagram.com/salyco.ir` — fills `Organization.sameAs`,
  which the prior spec noted would ship empty
- **Shipping area: Khorasan only.** Not nationwide.
- **Opening hours:** 10:00–13:00 and 17:00–21:00

**Assumption flagged for confirmation:** opening *days* were not supplied.
`openingHoursSpecification` will be written as شنبه–پنجشنبه with Friday
closed, the Iranian retail norm. If the shop opens Friday or closes
another day, this is a one-line correction in `schema.js`.

## Decisions

Nine choices, each against a more obvious alternative.

### Khorasan-only shipping makes this a local SEO project

This is the decision that reframes everything else. The prior spec
implicitly targeted national queries. With delivery limited to Khorasan,
ranking for «خرید تشک» nationally would attract traffic that cannot be
served — expensive to earn and impossible to convert.

So the geographic target is Khorasan Razavi, and Mashhad specifically:
~3M people, 130 km from Neyshabur, inside the delivery area. Local intent
is also dramatically easier to rank for than national head terms, and
`LocalBusiness` schema with `areaServed` is the mechanism Google already
has for exactly this.

Concretely: `areaServed` is Khorasan Razavi rather than Iran, copy says
«ارسال در خراسان» and never «ارسال به سراسر ایران», and the content
strategy targets «خرید تشک در مشهد» ahead of «خرید تشک».

### Content and URLs are fixed before anything invites indexing

The prior spec's Sections 1–7 are correct engineering aimed at a nearly
empty shelf: they would publish a sitemap of four empty category pages and
two products at unreadable URLs, then ask Search Console to crawl it.

Slugs are the specific reason ordering matters. They are free to change
now and cost a permanent redirect once indexed. So: fix URLs and IA, then
copy, then the crawler surface, then Search Console — in that order.

### Slugs become Persian, with 301s from an nginx map

Google handles percent-encoded Persian slugs and renders them decoded in
results, so `/articles/بهترین-تشک-برای-کمردرد` is both a keyword signal
and a legible click target for a Persian-reading audience.

Redirects live in `nginx.conf` as a `map` of the six old paths to their
new ones, returning real 301s. The alternative — a `slug_history` table
with Django resolving stale slugs and the SPA issuing a client-side
redirect — is more machinery for six URLs and produces a weaker signal
than a 301.

The tradeoff, stated: a future slug change means an nginx edit. Auto-
generation in `Mattress.save()` plus a rule that published slugs are not
renamed should keep that rare.

### Empty categories are hidden and `noindex`ed, not 404ed

A `published` flag in `productCategories.js`, true only for `mattress`.
Nav, `ProductsMenu` and `ProductsIndex` filter on it.

The four hidden routes keep resolving, to a "coming soon" state rather
than a 404: inbound and shared links do not break, and Section 3.2's
`noindex` plus exclusion from sitemap and prerender is what actually keeps
them out of the index. Restoring a category is one flag.

### `aggregateRating` requires 3+ reviews **and** ≥4.0

The prior spec emitted `aggregateRating` whenever `review_count > 0`.
Against live data that publishes **2.00 stars on the flagship** into
Google's results beside the price. Two stars in a SERP is worse than no
stars — a self-inflicted click-through penalty, and hard to walk back once
cached.

The floor of 3 reviews also guards the opposite failure: `average_rating`
defaults to 5.00 before any review exists (پرستیژ shows 5.00 from zero
reviews), and publishing that is a fabricated rating.

Nothing is faked in either direction — below the threshold the block is
omitted entirely, and the gate re-opens on its own as real reviews arrive.

### Detail pages are prerendered from the live API at build time

The prior spec deferred detail-page meta, leaving the four articles — the
pages most likely to be shared — with no Telegram or WhatsApp card.

Two ways to close it. Django request-time injection is robust and always
fresh, but needs Django to hold the built `index.html` (shared volume, or
an HTTP fetch from the frontend container with cache invalidation) and
changes how the SPA is delivered. Build-time prerender reads the six
detail URLs from the live public API during `npm run build` and writes flat
HTML, reusing the static-route machinery entirely.

At six detail URLs on a site that has published twice in months,
build-time wins on simplicity. It **fails soft**: an unreachable API logs
a warning and leaves those routes on runtime-only meta, so a build never
breaks because production is down.

The tradeoff, stated plainly: **adding a product or article requires a
rebuild before its social card works.** Google executes JavaScript and
sees the runtime meta immediately either way, so the rebuild gates social
cards only — not indexing, not ranking.

### The article funnel is a data-driven block, not inline links

`ArticleDetail.jsx:84-85` renders `{article.content}` as plain text inside
`whitespace-pre-wrap`. In-body contextual links are therefore impossible
without switching to HTML rendering and rewriting all four articles'
stored content.

So the funnel is a related-products CTA block and a related-guides block,
rendered after the article body from data. No content migration, no
`dangerouslySetInnerHTML`, no sanitisation surface.

Acknowledged limitation: in-body contextual links carry more SEO weight
than a block below the fold. Converting article storage to sanitised
HTML/markdown is the natural follow-up and is deliberately out of scope
here — it is a content-model change that deserves its own evaluation.

### Copy is drafted here and reviewed before it ships

Every Persian string in Stage 2 is drafted against the voice already
present in `productCategories.js` and the live product descriptions, and
lands on the branch for review before deploy. No trust claim ships
unreviewed.

The claims are bounded by the data: ten years' warranty because
`warranty_months` is 120; Khorasan delivery because that is the stated
area; no trial-nights claim because `trial_nights` is 0; no `material`
claim because both are blank. Unverifiable superlatives («کیفیت ممتاز»)
are replaced with checkable facts rather than restated.

### `priceCurrency` stays `IRR` at stored × 10

Carried forward unchanged from the prior spec, including its reasoning:
prices render as تومان and are stored as Toman, `schema.org` requires ISO
4217, no Toman code exists, and `IRT` is not real. The conversion stays in
one helper in `src/seo/schema.js`.

## Corrections to the prior spec

Six, all forced by live data. Each would have shipped a defect.

| # | Prior spec | Live reality |
| --- | --- | --- |
| 1 | `Mattress.rating` | field is `average_rating` |
| 2 | `discount_price` is a column | computed property from `is_on_off` / `off_percentage`; a Django-side builder must use the property, not a column |
| 3 | `image` is `/media/…`, join to `SITE_URL` | **already an absolute URL** — a naive join yields `https://salyco.ir/https://salyco.ir/media/…`, silently killing every card |
| 4 | emit `material` in `productSchema` | blank on both products — omit the key when empty rather than emitting `""` |
| 5 | `aggregateRating` when `review_count > 0` | threshold is `>= 3` reviews **and** `average_rating >= 4.0` |
| 6 | prerender + sitemap all 5 categories | `mattress` only; the other four are `noindex` and excluded |

Correction 3 is the most dangerous of the six: it produces markup that
looks right in review and yields no image in any social card or rich
result.

## Approach

Three stages, two deploys. Stage 1 ships alone because it repairs defects
costing conversions today. Stages 2–3 ship together after copy review.
Search Console submission is the last action taken.

---

## Stage 1 — URLs, IA, live defects

### 1.1 Slug generation

`Mattress.save()` gains `slugify(self.name, allow_unicode=True)` when
`slug` is blank, mirroring `articles/models.py:20` exactly. This prevents
future hand-typed drift; it does **not** touch existing rows, whose slugs
are non-blank.

### 1.2 Slug data migration

A data migration sets the six Persian slugs — two products, four articles
— derived from their current live titles. The migration is written with an
explicit old→new mapping rather than recomputing from `name`, so the
result is reviewable in the diff and reproducible.

The two product slugs are already determined:

| Old | New |
| --- | --- |
| `tsh-slo-mdl-shmrh-1` | `تشک-امپریال` |
| `mdl-rst` | `تشک-پرستیژ` |

Both lead with «تشک» — the head keyword — followed by the model name,
which the current slugs omit entirely. The four article slugs are authored
at implementation time from their live `title` fields, which must be read
from `/api/articles/` first: the list serializer returns `slug` but the
titles are needed to derive accurate Persian slugs, and guessing them from
the transliterations would risk a wrong permanent URL.

Because this mapping is also the source of the redirects in 1.3, it lives
in one module imported by both, so the two cannot disagree.

### 1.3 Redirects

`nginx.conf` gains a `map` of the six old paths to new, returning 301.
Frontend links need no change: they are built from API data, so new slugs
propagate automatically.

### 1.4 Category publication

`published: true` on `mattress` only in `productCategories.js`. Nav,
`ProductsMenu` and `ProductsIndex` filter on it. Unpublished category
routes render a "coming soon" state.

### 1.5 Hero CTA

`Hero.jsx:50-57` — the broken `<a href="/catalog.pdf" download>` becomes a
`<Link to="/products/mattress">`. The `Download` import goes with it;
`ArrowLeft` is already imported.

This stops visitors reaching the broken path. The server continues
answering 200 with HTML to anything that asks for it until 3.9 lands,
which is where that defect is actually fixed.

### 1.6 Footer email

`AboutFooter.jsx:107` — `mailto:info@salyco.com` becomes
`mailto:thisissalyco@gmail.com`, matching the visible text at line 114 and
the confirmed address.

### 1.7 Host canonicalisation

`Caddyfile` — `www.salyco.ir` 301s to the apex. Bind-mounted per
`docker-compose.yml`, so this needs a Caddy reload, not a rebuild.

---

## Stage 2 — Marketing copy

All Persian strings drafted for review. Copy targets Khorasan/Mashhad
intent per the Decisions.

### 2.1 Hero

The `h1` currently reads «آنجا که خواب بر بال‌های قو آرام می‌گیرد» —
poetic and commercially silent: no category word, no keyword, no claim.
The line moves to the subhead, and the `h1` carries «تشک» plus the
quantified warranty.

Highlights: «گارانتی معتبر» becomes «۱۰ سال گارانتی» (from
`warranty_months: 120`); «کیفیت ممتاز» becomes «تولید در نیشابور» — a
checkable manufacturing claim rather than an unverifiable superlative, and
the one that carries most weight for a manufacturer selling direct.
Delivery area is stated on `/contact` and in the footer (2.6) rather than
in the hero, where it would compete with the warranty claim for attention.

The live 10%/15% discounts are deliberately **not** hardcoded into the
hero: they change, and a stale price claim above the fold is worse than
none. They surface on product cards, from data.

### 2.2 Route metadata copy

Persian `<title>` and `<meta description>` for each published route,
feeding `routeMeta.js` in 3.1. Titles target ~55–60 characters — Google
truncates on pixel width and Persian glyphs render wider than Latin.

### 2.3 Mattress category page

`/products/mattress` is the commercial money page. It gains a real intro
targeting «خرید تشک» with Mashhad/Khorasan qualifiers, plus a link block
into the four buying guides.

### 2.4 Product depth

~530 characters of description on a 19–27M Toman purchase is thin. The
models already carry slots standing empty: `MattressFAQ` (which becomes
FAQ rich results in 3.3), `MattressProCon`, `MattressSpecification`,
`MattressFeature`. `material` is blank on both products and is needed by
both copy and schema.

FAQ entries target real purchase questions — warranty scope, delivery to
Mashhad, firmness selection.

### 2.5 Article funnel

Each article gains a related-products CTA block and a related-guides
block, per the Decisions — rendered from data after the body, not embedded
in plain-text content. `/articles` becomes a genuine hub for the cluster.

This is the highest-return item in the plan: four guides ranking on
purchase-intent queries, funnelling into two products.

### 2.6 Local copy and hours

Opening hours (10:00–13:00, 17:00–21:00) and the Khorasan delivery area
stated explicitly on `/contact` and in the footer, feeding
`localBusinessSchema` in 3.3.

### 2.7 Warranty terms

A ten-year warranty with no stated terms is a weak claim. Stating what it
covers converts the site's strongest differentiator into something a buyer
can trust.

---

## Stage 3 — Metadata, structured data, crawler surface

Carries the prior spec's Sections 1–7 with the six corrections applied.

### 3.1 `src/seo/routeMeta.js`

Pure data, **no imports**, so both the browser bundle and the Node
prerender script can load it. Deliberately does not reuse
`productCategories.js`, which imports `lucide-react` icons at module
level and would fail under bare `node`.

The duplication is guarded, not tolerated: verification asserts the key
sets match, so adding a category without a `routeMeta` entry fails the
build instead of shipping an untitled page.

Exports `SITE_URL = "https://salyco.ir"` and `OG_DEFAULT`. `og:image` and
`og:url` **must** be absolute — a root-relative path is silently dropped
by every social crawler, and is the most common way an OG implementation
reviews as correct and produces no card.

### 3.2 `src/seo/Seo.jsx`

Props `title`, `description`, `canonical`, `image`, `type`, `noindex`.
Renders `<title>`, description, canonical, the `og:` set (`locale`
`fa_IR`) and the `twitter:` set (`summary_large_image`).

Absolutises `canonical` and `image` against `SITE_URL` **idempotently**
per correction 3 — an input that is already absolute passes through
unchanged.

`noindex` emits `noindex,nofollow` and applies to:

- **Private:** `/auth`, `/user-info`, `/cart`, `/checkout`, `/warranty/my`,
  `/warranty/mattress/:serialNumber`, `/orders/:token`, `/admin/*`
- **Thin or duplicative:** `/search`
- **Unpublished categories:** the four empty ones

`/warranty/mattress/:serialNumber` and `/orders/:token` matter most: both
are public by design — the URL token *is* the credential
(`App.jsx:74-77`) — and both render customer data. They are also blocked
in `robots.txt` (3.6). Two independent mechanisms, because either alone is
a single point of failure for leaking a customer's order into search.

### 3.3 Structured data

`src/seo/JsonLd.jsx` renders the script tag; `src/seo/schema.js` holds
builders.

| Builder | Rendered on | Notes |
| --- | --- | --- |
| `organizationSchema()` | sitewide | logo, `contactPoint` `+985142222687`, `sameAs` → `instagram.com/salyco.ir` |
| `localBusinessSchema()` | `/contact`, `/about` | Neyshabur address, `areaServed` Khorasan Razavi, `openingHoursSpecification` |
| `productSchema(product, sizes)` | product detail | see below |
| `breadcrumbSchema(items)` | catalogue, product, article | |
| `articleSchema(article)` | article detail | `datePublished`, `dateModified` |
| `faqSchema(faqs)` | product detail, when non-empty | from `MattressFAQ` |
| `itemListSchema(products)` | `/products`, `/products/mattress` | |

`productSchema` specifics:

- **Offers** — priced sizes emit `AggregateOffer` with
  `lowPrice`/`highPrice`; a sizeless product emits a single `Offer`. Both
  use `discount_price ?? price` so the markup matches the page, and both
  convert to `IRR` at ×10 via the single helper.
- **`aggregateRating`** — omitted unless `review_count >= 3` **and**
  `average_rating >= 4.0` (correction 5).
- **`material`** — key omitted when blank (correction 4).
- **`image`** — absolutised idempotently (correction 3).

### 3.4 Static route prerender

`scripts/prerender.mjs`, run after `vite build`. Per published route: read
`dist/index.html`, substitute title/description, inject the absolute
`og:`/`twitter:`/canonical set, write `dist/<path>.html` (`/` stays
`dist/index.html`).

`dist/products/` must **not** contain an `index.html`, or nginx's `$uri/`
clause reappears and `/products` starts 301ing to `/products/`.

The script asserts the tags it replaces were actually found and exits
non-zero otherwise. Without that, an edit to `index.html`'s `<head>` turns
it into a silent no-op that still ships — the failure mode being one grey
rectangle per share, discovered months later.

`package.json` becomes
`"build": "vite build && node scripts/prerender.mjs"`, so the Dockerfile's
existing `RUN npm run build` picks it up unchanged.

### 3.5 Detail route prerender

The same script fetches `/api/mattresses/` and `/api/articles/` from the
live API and writes flat HTML for each product and article, with
per-object title, description and `og:image` (the product image, already
absolute).

Fails soft: unreachable API logs a warning, skips detail routes, exits 0.

### 3.6 `robots.txt`

`public/robots.txt`, copied verbatim into `dist/` by Vite — which also
fixes the HTML-at-`robots.txt` defect, because the file will now exist and
`try_files` will find it before falling through.

`Allow: /`, a `Sitemap:` pointer, and `Disallow` for `/admin/`, `/auth`,
`/user-info`, `/cart`, `/checkout`, `/warranty/my`, `/orders/`, `/search`,
`/warranty/mattress/`, and the four unpublished categories.

`robots.txt` prevents crawling; `noindex` prevents indexing. A URL linked
from elsewhere can be indexed without being crawled, so 3.2 is not
redundant with this.

### 3.7 `sitemap.xml` from Django

`Backend/core/seo_views.py`, routed at `path("sitemap.xml", …)`. Returns
`application/xml` listing published static routes, every `Mattress` as
`/products/{category}/{slug}`, and every `Article` with `is_published=True`
as `/articles/{slug}` with `<lastmod>` from `updated_at`.

Written as plain XML rather than via `django.contrib.sitemaps`, which
requires `django.contrib.sites` — not in `INSTALLED_APPS`
(`core/settings.py:106-123`) — and would mean a migration and a `SITE_ID`
for no gain over ~40 lines.

Two model constraints:

- **Products get no `<lastmod>`.** `Mattress` has no timestamp fields;
  `models.py` puts them on `Review` (line 330) and `MattressInstance`
  (line 445) only. `<lastmod>` is optional, so it is omitted rather than
  faked with `timezone.now()` — which would claim every product changed on
  every fetch and devalue the signal.
- **Products are listed regardless of `is_available`.** An out-of-stock
  page still holds ranking and inbound links. Stock is communicated via
  `Offer.availability`, which is what it is for.

Absolute URLs come from one `SITE_URL` setting so frontend and backend
cannot disagree on scheme or host.

### 3.8 nginx

An exact-match proxy for the sitemap:

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

`= /sitemap.xml` is deliberate: a prefix `location /sitemap` would also
capture a future `/sitemap-images.xml` and is easier to get subtly wrong
than right.

### 3.9 Missing static files must 404, not fall through

This is the root cause of Problem 1 and Problem 2, and neither is actually
fixed without it. `try_files … /index.html` means *every* unmatched path
returns the SPA shell with HTTP 200 — which is why `/robots.txt`,
`/sitemap.xml` and `/catalog.pdf` all return `text/html` today. Removing
the Hero link in 1.5 stops visitors reaching `/catalog.pdf`; it does not
stop the server answering 200 to anything that asks.

So a location block matching static-asset extensions serves the file or
returns 404, never falling back to `index.html`:

```nginx
location ~* \.(pdf|txt|xml|json|csv|zip|png|jpe?g|gif|svg|webp|ico|css|js|map|woff2?|ttf)$ {
    try_files $uri =404;
}
```

Route paths carry no extension, so this cannot intercept the `$uri.html`
resolution that 3.4's prerendered files depend on.

Ordering matters: this must sit **after** `location = /sitemap.xml`, or the
`\.xml$` pattern would swallow the sitemap proxy and return 404 for it.
That interaction is the one way this block breaks something else, so it is
asserted in check 29.

---

## Testing

Following the existing `verify-footer.mjs` pattern — `esbuild` bundle plus
`renderToStaticMarkup`, since no test runner is configured.

**Stage 1**

1. `Mattress.save()` auto-generates a Persian slug when blank and
   preserves Persian characters.
2. `save()` does **not** overwrite an existing slug.
3. The migration produces the six expected slugs; the old→new map is the
   same object the redirects are built from.
4. Nav, `ProductsMenu` and `ProductsIndex` render only published
   categories.
5. An unpublished category route renders "coming soon", not a 404.
6. `Hero.jsx` contains no reference to `catalog.pdf`.
7. Footer `mailto:` equals the visible email text — the assertion that
   would have caught the original mismatch.

**Stage 3, unit**

8. `<Seo>` renders title, description, canonical, the `og:` set and the
   `twitter:` set.
9. Relative `canonical`/`image` come out absolute; **already-absolute
   inputs pass through unchanged** — the correction-3 guard.
10. `noindex` emits `noindex,nofollow`, and every private route plus all
    four unpublished categories set it.
11. `productSchema` omits `aggregateRating` at `review_count` 1 and
    rating 2.00; omits it at rating 5.00 with 0 reviews; includes it at 3
    reviews and 4.5.
12. `productSchema` omits `material` when blank.
13. `AggregateOffer` carries correct `lowPrice`/`highPrice` for a
    multi-size product; `Offer` for a sizeless one; both at
    `discount_price ?? price`, both ×10 in `IRR`.
14. `routeMeta.js` keys exactly equal `PRODUCT_CATEGORIES` keys — the
    drift guard.
15. Every builder emits valid JSON with `@context` and `@type`.
16. `localBusinessSchema` emits `areaServed` Khorasan Razavi and both
    opening-hours windows.

**Stage 3, post-build against `dist/`**

17. One `dist/*.html` per published route, each with a distinct `<title>`
    and distinct `og:title`.
18. `dist/products/index.html` does **not** exist — the trailing-slash
    regression guard.
19. `dist/robots.txt` exists and names the sitemap.
20. The prerender script exits non-zero against an `index.html` whose
    `<title>` has been renamed.
21. Detail prerender writes one file per live product and article, each
    with an absolute `og:image`.
22. With the API unreachable, the build **still succeeds** and logs a
    warning — the fail-soft guard.

**Backend**

23. `GET /sitemap.xml` returns 200 and `application/xml`.
24. Output is well-formed XML (parsed, not regex-matched) and contains
    every published static route.
25. A created `Mattress` appears as `/products/{category}/{slug}`; a
    published `Article` appears with `<lastmod>`; an unpublished one does
    not.
26. An unavailable product still appears — pinned so a later "cleanup"
    does not quietly reverse the decision.
27. Unpublished categories do not appear.

**Post-deploy, not verifiable locally**

28. `curl -I https://salyco.ir/robots.txt` → 200 and
    `content-type: text/plain`. Asserting the content-type, not just the
    status, is the point: the current defect returns 200 with
    `text/html`.
29. `curl -s https://salyco.ir/sitemap.xml | head` → XML, confirming
    nginx reaches Django rather than falling through to the SPA. This
    doubles as the ordering assertion for 3.9: if the extension block were
    placed above `location = /sitemap.xml`, this returns 404 instead of
    XML. It is also the change most likely to be wrong in production and
    fine locally, because the Vite dev proxy (`vite.config.js:12-21`)
    forwards only `/api` and `/media`.
30. `curl -I` each old slug → 301 to its new path.
31. `curl -I https://www.salyco.ir/` → 301 to apex.
32. `curl -I https://salyco.ir/catalog.pdf` → 404, not 200 — the 3.9
    guard. Also `curl -I https://salyco.ir/nonexistent.png` → 404.
33. `curl -I https://salyco.ir/products/mattress` → 200 and serves the
    prerendered file, proving 3.9's extension block did not disturb
    `$uri.html` resolution for extensionless route paths.
34. Paste an article URL into Telegram — the end-to-end card check.
    Telegram caches per URL, so use one not yet shared.

## Scope

**In:** Stages 1–3 as specified.

**Out, deliberately:**

- **Analytics and event tracking.** No `dataLayer` exists anywhere, so
  conversion is currently unmeasurable — meaning nothing in this spec can
  be proven to have worked. A real gap, and a separate subsystem; burying
  a GA4 install inside an SEO change would make both harder to evaluate.
  Recommended as the immediate next phase.
- **Article content as HTML/markdown**, which would allow in-body
  contextual links. A content-model change plus rewriting four articles;
  deserves its own evaluation.
- **Django request-time meta injection.** Superseded for now by 3.5;
  becomes worthwhile if publishing cadence rises enough that per-release
  rebuilds are a burden.
- **Performance**, covered by
  `docs/superpowers/specs/2026-08-24-mobile-speed-design.md` — still
  unimplemented, and it touches four files this spec also touches
  (`nginx.conf`, `Caddyfile`, `package.json`, `Hero.jsx`), so it should
  rebase onto this rather than the reverse.

**Out, noted:**

- **The flagship sits at 2.00 stars from one review.** The threshold in
  3.3 keeps it out of Google, which solves the SERP symptom. The
  underlying signal on a 27M Toman product is a business matter, not a
  markup one.
- `Mattress` has no `updated_at`, so product sitemap entries carry no
  `<lastmod>`. A model change plus migration; a genuine crawl-efficiency
  gain, not this phase's.
- `OG_DEFAULT` initially points at `/layerdimage.png` (1456×720, ~1.3 MB)
  as the only existing asset near 1.91:1. A purpose-made 1200×630 under
  ~200 kB is correct; the mobile-speed image pipeline is the natural place
  to produce it. **The path must stay stable and unhashed** — crawlers
  cache OG images aggressively.
- Opening *days* assumed شنبه–پنجشنبه (see Confirmed business facts).

## Deployment

Two pushes.

**Stage 1** — `docker compose up -d --build` (nginx.conf is baked into the
frontend image per `Dockerfile:24`), plus a Caddy reload for the
bind-mounted `Caddyfile`. Then post-deploy checks 30 and 31.

**Stages 2–3** — full rebuild again, since the prerendered HTML is
produced by `npm run build` inside the build stage. Then checks 28, 29,
32, 33 and 34.

**Only then**, submit the sitemap in Google Search Console — after 28 and
29 confirm it parses as XML. Submitting while `/sitemap.xml` still returns
`text/html` is how this fails confusingly.

Also worth doing once Stage 3 is live, given Khorasan-only delivery: claim
and complete the Google Business Profile for the Neyshabur location. It is
the single highest-return local SEO action available and needs no code.

## Branch

`feat/marketing-content-seo`, based on `feat/warranty-admin-approval`
(current `HEAD`, 6 commits ahead of `master`, 0 behind).

Basing here rather than `master` is deliberate, and unchanged in reasoning
from the prior spec: `feat/mobile-speed` is an ancestor of the current
branch and so not a base candidate, and sequencing this phase first keeps
the mobile-speed conflicts to one predictable resolution rather than two.

Stage 1 is a separate commit range from Stages 2–3 so the copy review has
a clean boundary.
