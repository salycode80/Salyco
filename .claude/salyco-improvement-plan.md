# Salyco Improvement Plan

Companion to [`salyco-site-audit.md`](./salyco-site-audit.md) (measured evidence) and
[`product-marketing-context.md`](./product-marketing-context.md) (positioning).

**Drafted:** 2026-08-26 · **Target:** https://salyco.ir

---

## The one-paragraph verdict

Salyco has the hard parts already built — a real manufacturer with two decades of
history, a 120-month warranty with a working registration and approval system, an
Enamad badge, a coherent brand voice, and a physical address in Neyshabur. What it
does not have is **any ability to be found, and any ability to load quickly.** The
site is a client-rendered SPA with zero per-route metadata, no sitemap, no
robots.txt, no structured data, no compression, and a 5.2 MB PNG as its largest
paint. The content problem is smaller than it looks: four 230-word plain-text
articles and two products with empty spec fields. **Fix the plumbing first — content
written before the site can be indexed is content written into a void.**

Sequencing below is dependency-ordered, not preference-ordered.

---

## Phase 1 — Stop the bleeding

*Days, not weeks. No architectural change. Highest return per hour in the whole plan.*

### 1.1 Enable compression

`Frontend/salyco-front/nginx.conf` has no `gzip` or `brotli` directive. Add:

```nginx
gzip              on;
gzip_vary         on;
gzip_comp_level   6;
gzip_min_length   256;
gzip_proxied      any;
gzip_types        text/plain text/css application/javascript
                  application/json image/svg+xml application/xml;
```

Ship Brotli too if the nginx build has `ngx_brotli`; otherwise pre-compress at
build time and serve with `gzip_static`/`brotli_static`.

**Effect:** ~610 KB JS → roughly 150–180 KB. The single cheapest win available.
**Verify:** `curl -sSI -H "Accept-Encoding: br" .../assets/index-*.js | grep -i content-encoding` must return a value.

### 1.2 Fix the 5.2 MB hero image

`/layerdimage.png` is the homepage LCP element. Convert to AVIF with WebP and JPEG
fallbacks, and emit three widths (768 / 1440 / 2200). Target **under 200 KB** for
the largest variant.

Replace the bare `<img>` in `Hero.jsx:19` with a `<picture>`, and add explicit
`width`/`height` so the aspect box no longer depends on CSS alone. Keep
`fetchPriority="high"` — that part is already correct.

**Effect:** ~5 MB removed from the critical path. Expect LCP to fall from
multi-second to sub-second on the same connection.

### 1.3 Fix the favicon

`index.html:5` points `rel="icon"` at `/logo3.png` — **675 KB**. `public/favicon.svg`
(9.5 KB) already exists and is unused. Point to it, add a 180×180 PNG for
`apple-touch-icon`, and delete the reference to `logo3.png`.

### 1.4 Shrink the fallback placeholder

`/matress.png` is **1.4 MB** and is the default image across eight call sites
(`utils/productImage.js`, `utils/articleImage.js`, `ProductGallery`, `MattressCard`,
`ProductCard`, `ArticleCard`, `CartPage`, `warranty/ProductPreviewCard`). Replace with
a ~10 KB SVG or a sub-30 KB WebP. Change it once in the two utils and the rest
inherit.

### 1.5 Fix the broken hero CTA

`/catalog.pdf` returns HTTP 200 with `text/html` — the SPA shell. The "دانلود کاتالوگ"
button downloads 1.3 KB of HTML renamed as a PDF. Either **publish a real catalogue
PDF** at that path, or remove the button until one exists. A dead CTA on a
two-CTA homepage is worse than one CTA.

### 1.6 Fix the ratings display

Two contradictory signals are live right now:

- Emperial: **`rating: 2.00`, `review_count: 1`** — a 2-star average on the flagship.
- Prestige: **`rating: 5.00`, `review_count: 0`** — a perfect score from no reviews.

Do three things: **suppress the rating widget entirely below a threshold** (e.g.
`review_count < 3`, show `هنوز امتیازی ثبت نشده` instead); **never render a rating when
`review_count == 0`**; and **investigate the 2.00 review** — if it is a genuine
complaint it is a product/QA signal, if it is test data it should be deleted.

Then start collecting real reviews (§4.1).

### 1.7 Compress the remaining oversized assets

| File | Now | Target |
|---|---:|---|
| `/media/mattresses/main.png` | 1,303,905 B | < 150 KB AVIF/WebP |
| `/heroimage2.png` | 1,325,810 B | < 120 KB |
| `/logo.png` | 1,069,775 B | SVG, or < 40 KB PNG |
| `/banner.png`, `/banner2.png` | ~540 KB each | < 80 KB each |

The About page currently loads **~3.9 MB of images**. This table takes it under
500 KB.

### 1.8 Self-host Vazirmatn

The site pulls Vazirmatn from `fonts.googleapis.com`. Google Fonts is unreliable
and frequently slow or blocked from Iranian networks — meaning the primary
typeface of a Persian-language site is a third-party dependency that may not
arrive. Self-host the woff2 subset, `font-display: swap`, `preload` the 400 and
600 weights, and drop the two `preconnect` hints.

---

## Phase 2 — Make the site indexable

*1–2 weeks. This is the phase that unlocks every content investment that follows.*

### 2.1 Decide the rendering model

Right now Google receives `1,355` bytes and a `<div id="root">`. Googlebot can
execute JS, but every other consumer cannot: Telegram, WhatsApp and Instagram
link previews, Iranian crawlers, and — increasingly relevant — LLM crawlers that
answer product questions without executing JavaScript.

Three options, in order of recommendation:

| Option | Effort | Notes |
|---|---|---|
| **Prerender at build** (`vite-plugin-ssr`, `react-snap`, or a Puppeteer post-build step) | Low–Medium | Best fit. The catalogue is 2 products and 4 articles — a static snapshot per route is trivial to generate and needs no runtime change. **Recommended.** |
| Migrate to Next.js / Remix SSR | High | Correct long-term if the catalogue grows past a few dozen SKUs. Not justified at current scale. |
| Dynamic rendering for bots only | Medium | Fragile, and Google discourages it. Avoid. |

Start with prerendering. Revisit SSR when the catalogue justifies it.

### 2.2 Per-route metadata

No `react-helmet` equivalent exists in `package.json`, and there are zero
`document.title` assignments in `src/`. Add a metadata layer (React 19 supports
hoisting `<title>`/`<meta>` from components natively — no library strictly needed)
and give every route a real title, description, canonical, and OG image.

Title templates:

| Route | Template |
|---|---|
| `/` | `تشک سالیکو \| تولیدکننده تشک طبی و فنری با ۱۰ سال گارانتی` |
| `/products` | `خرید تشک طبی و فنری سالیکو \| قیمت و مشخصات` |
| `/products/mattress` | `تشک طبی و فنری سالیکو \| لیست قیمت ۱۴۰۵` |
| `/products/mattress/:slug` | `تشک {نام مدل} سالیکو \| قیمت، مشخصات و ۱۰ سال گارانتی` |
| `/articles` | `مجله خواب سالیکو \| راهنمای خرید تشک` |
| `/articles/:slug` | `{عنوان مقاله} \| مجله خواب سالیکو` |
| `/dealers` | `نمایندگی‌های فروش تشک سالیکو در سراسر ایران` |
| `/about` | `درباره سالیکو \| دو دهه تولید تشک و محصولات خواب` |
| `/contact` | `تماس با سالیکو \| مشاوره خرید تشک و ثبت گارانتی` |

Rules: unique per route, 50–60 characters where possible, brand last except on
`/`, and **never** the current global fallback.

Add per-route OG images too — Salyco links shared into Telegram and WhatsApp
currently render as bare URLs with no image, title, or description. For an
Iranian consumer brand where social sharing is a primary discovery channel, this
is a direct loss.

### 2.3 Publish robots.txt and sitemap.xml

Both currently return the SPA shell with HTTP 200. Serve real files ahead of the
SPA fallback in nginx:

```nginx
location = /robots.txt  { root /usr/share/nginx/html; }
location = /sitemap.xml { proxy_pass http://django; }
```

`robots.txt` should allow crawling, disallow `/admin/`, `/checkout/`, `/cart`,
`/auth`, `/user-info`, `/warranty/my`, `/orders/`, and point to the sitemap.

Generate `sitemap.xml` from Django (`django.contrib.sitemaps`) so it stays
accurate as products and articles are added, rather than a static file that rots.

Then submit to **Google Search Console** and, for the Iranian market, **Bing
Webmaster Tools**.

### 2.4 Add structured data (JSON-LD)

Zero JSON-LD blocks exist today. Add per type:

| Page | Schema | Wins |
|---|---|---|
| All | `Organization` + `LocalBusiness` | Brand panel, map presence, Neyshabur address |
| Product pages | `Product` + `Offer` + `AggregateRating`¹ | Price and availability in results |
| Articles | `Article` + `author` + `datePublished` + `dateModified` | Article rich results |
| Articles with FAQ | `FAQPage` | Expanded SERP real estate |
| All | `BreadcrumbList` | Breadcrumb trail in results |

¹ Only emit `AggregateRating` once `review_count >= 3` — see §1.6. Emitting a
5.00 from zero reviews is a structured-data violation, not just bad taste.

`LocalBusiness` is the highest-leverage of these and the most overlooked: Salyco
has a real address (`نیشابور، خیابان مدرس، خیابان فضل`) and real hours
(`شنبه تا پنج‌شنبه، ۹ تا ۲۰`) already in `Contact.jsx`, entirely unexploited.

### 2.5 Finish the Persian slug migration

`_slugmap.txt` defines the migration; production is **half-deployed**. The API
404s on Persian slugs while the frontend returns 200 via SPA fallback — so a
Persian URL renders a broken page instead of redirecting.

Complete it in one deploy:

1. Apply the new slugs to the DB.
2. Keep old slugs as **301 redirects** — never drop them; they are the only
   currently-indexable URLs.
3. Set `canonical` to the Persian slug.
4. Update `sitemap.xml`.

Current slugs are vowel-stripped transliterations
(`bhtrn-tsh-br-mrdrd-o-ds-mr-dm-st`) — unreadable to users and worthless as
keyword signal. Persian slugs are both readable and rank-relevant. Worth
finishing, but **only as an atomic deploy** — the current half-state is worse
than either end.

### 2.6 Return real 404s

`/nope-12345` returns HTTP 200. Every mistyped or hallucinated URL becomes an
indexable page. Have the SPA detect unmatched routes and serve a real 404 status
(via prerendering, or a `<meta name="robots" content="noindex">` injected on the
catch-all route as an interim measure), plus a helpful 404 page that links to
`/products` and `/articles`.

### 2.7 Canonicalize the hostname

`salyco.ir` and `www.salyco.ir` serve **byte-identical HTML** with no canonical
tag. Pick one (recommend apex, `salyco.ir`, matching current branding), 301 the
other in Caddy, and emit `canonical` on every page.

---

## Phase 3 — Content

*Ongoing. Begins the moment Phase 2 ships, not before.*

### 3.1 Rewrite the four existing articles

All four are ~230 words of **plain text with zero HTML tags** and **zero internal
links**. They cannot rank and cannot convert. Rewrite rather than add — four
strong articles beat twelve thin ones.

Target per article: **1,500–2,000 words**, real `<h2>`/`<h3>`, real `<ol>`/`<ul>`,
3–5 internal links, a table where it helps, an FAQ block, a named author, and a
visible `dateModified`.

Worked example — `بهترین تشک برای کمردرد`:

```
H1   بهترین تشک برای کمردرد و دیسک کمر کدام است؟
     [answer box: the 2-sentence direct answer, for featured snippets + LLM citation]
H2   چرا تشک روی کمردرد اثر می‌گذارد؟
H2   سه ویژگی تشک مناسب برای کمردرد
     H3  پشتیبانی از انحنای ستون فقرات
     H3  توزیع یکنواخت وزن
     H3  سفتی متعادل — نه خیلی نرم، نه خیلی سفت
H2   چه درجه سفتی برای وزن شما مناسب است؟
     [table: weight range × recommended firmness 1–5]
H2   تشک طبی یا فنری برای کمردرد؟
     → internal link: /articles/تفاوت-تشک-طبی-و-فنری
H2   کدام مدل سالیکو برای کمردرد مناسب است؟
     → internal link: Emperial (سفتی ۵ — وزن بالا)
     → internal link: Prestige (سفتی ۳ — وزن متوسط)
H2   پنج اشتباه رایج در خرید تشک برای کمردرد
H2   پرسش‌های متداول            [→ FAQPage schema]
     نویسنده · بازبینی‌شده در {date} · مشاوره تلفنی
```

Three specific fixes that apply across all four:

1. **Resolve the memory-foam contradiction.** The current article names memory
   foam as the best option for back pain. **Salyco sells no memory foam
   product.** Either add one to the catalogue, or rewrite the recommendation to
   land on the two models that actually exist. Right now the site's
   highest-intent page sends the reader toward a product it cannot sell.
2. **Replace `برند ما` with `سالیکو`.** Every generic self-reference is a forfeited
   entity signal on the exact pages most likely to rank. Name the brand.
3. **Add internal links.** `با کارشناسان ما تماس بگیرید` currently links nowhere.
   Every article should link to at least one product and to `/contact`.

### 3.2 Build the topic cluster

Two hubs, spokes beneath each:

**Hub A — `راهنمای خرید تشک`** (pillar, ~3,000 words)
- تفاوت تشک طبی و فنری ✅ *(exists — rewrite)*
- سایز تشک استاندارد ✅ *(exists — rewrite)*
- تشک سفت یا نرم ✅ *(exists — rewrite)*
- قیمت تشک ۱۴۰۵ — چه چیزی قیمت تشک را تعیین می‌کند؟ *(new — high commercial intent)*
- عمر مفید تشک و زمان تعویض آن *(new)*
- گارانتی تشک — چه چیزی پوشش داده می‌شود؟ *(new — leans on the real 120-month differentiator)*

**Hub B — `خواب و سلامت`** (pillar)
- بهترین تشک برای کمردرد ✅ *(exists — rewrite)*
- تشک مناسب برای بارداری *(new)*
- بهترین حالت خواب برای گردن‌درد *(new)*
- دمای اتاق و کیفیت خواب *(new)*

Every spoke links up to its hub; the hub links down to all spokes; both link to
products. This is the structure that compounds — isolated articles do not.

### 3.3 Fix the homepage H1

Current: `آنجا که خواب بر بال‌های قو آرام می‌گیرد` — "Where sleep rests on swan's
wings." It is a beautiful line and it belongs on the page. But it contains
**neither `تشک` nor `سالیکو`**, which makes the single most weighted heading on the
site carry zero search signal.

Keep the poetry, demote it:

```html
<p class="eyebrow">آنجا که خواب بر بال‌های قو آرام می‌گیرد</p>
<h1>تشک طبی و فنری سالیکو — دو دهه تولید، ۱۰ سال گارانتی</h1>
<p class="sub">بیش از دو دهه تجربه در تولید تشک و محصولات خواب،
   با گارانتی معتبر و کیفیتی که به آن ایمان داریم.</p>
```

Brand voice intact, search signal recovered.

### 3.4 Fix the product content

**See [`salyco-product-copy-rewrite.md`](./salyco-product-copy-rewrite.md) for the
full task list with replacement copy written out.** Summary of why it matters:

The product data is **richer than it first appears** — the list endpoint
(`/api/mattress/`) hides the relations; the detail route
(`/api/mattresses/<slug>/`) returns a strong `long_description`, a complete
six-size price ladder, specs, features, FAQs and pros/cons. The construction copy
(micro-bonnell core, 2.2 mm wire, 4 mm reinforced frame, 1,100 g thermofelt,
1,400 g polyester pad) is genuinely good and most Iranian competitors don't publish
anything like it. **Keep it.**

Four items are correctness problems, not copy improvements, and belong in Phase 1
rather than here:

1. **Emperial's FAQs and pros/cons are memory-foam content on a spring product** —
   asserting Cool Gel, Open Cell and OEKO-TEX certification it doesn't have, plus
   "complete motion isolation" that its own interconnected-coil build contradicts.
   This is also the root cause of the article problem in §3.1.
2. **Emperial's `long_description` names Prestige** as the source of its own
   internal pad — a copy-paste artifact on the flagship page.
3. **Headline price is the cheapest size** while `width`/`length` declare a Queen —
   understating by **26%** (Emperial) and **37%** (Prestige), with no `از` prefix.
4. **The 2.00 rating is the developer's test review** (`rating: 2`, body `عالی`,
   name matching the footer credit). Delete it, and suppress ratings below 3
   reviews.

Then, at this phase: bring Prestige to parity (it has **0** features, **0** FAQs,
**0** pros/cons, 1 image), normalize spec keys so the two models are comparable,
express `firmness` in words with a body-weight guide, and fill the four blank
gallery `alt_text` values.

### 3.5 Fill the empty banner slot

`GET /api/banners/` returns `[]`. `BannerCarousel.jsx` renders nothing. A live
merchandising slot on the homepage is sitting empty — use it for the current
discounts (Emperial −10%, Prestige −15%) which are otherwise invisible until a
user reaches a product page.

`docs/marketing/deep-sleep-carousel.html` exists in the repo and looks like an
unshipped start on exactly this.

### 3.6 Fix the design source of truth

`Salyco-DESIGN.md` is a **copy-pasted fintech design system**. It contains
"transaction cards", "payment confirmation dialogs", "tabular numerals for
financial amounts", colors labelled "PayPal Navy" / "PayPal Gold", and specifies
**Inter** as the typeface — while the site actually loads **Vazirmatn**.

The opening prose is genuinely on-brand and should be kept verbatim. Everything
below it should be rewritten to describe a mattress brand: product cards, gallery
and lightbox, size selectors, firmness indicators, warranty badges, review
blocks. Fix the font to Vazirmatn. Drop the PayPal color names.

Keep the one accurate warning it contains: gold `#F5BA2E` fails contrast on white
and must not be used for text.

This matters more than it looks — it is the file any designer or coding agent
reads first, and it is currently describing a different product.

---

## Phase 4 — Trust and conversion

### 4.1 Build a review engine

`review_count` is 1 and 0. The warranty registration system already captures
verified buyers — **that is a review pipeline that already exists.** Trigger a
review request 30–60 days after warranty registration (SMS OTP infrastructure is
already in place per `SMS_OTP_INTEGRATION_GUIDE.md`). Verified-purchase reviews
from warranty holders are the highest-credibility proof available, and they feed
`AggregateRating` in §2.4.

### 4.2 Claim local search

Real address, real hours, currently invisible. Create a **Google Business
Profile** for the Neyshabur location, register on Iranian directories
(**Neshan**, **Balad**), and add `LocalBusiness` JSON-LD. Then build the dealer
network into a local-SEO asset: `/dealers` should have a page per province with
its own metadata, targeting `تشک سالیکو در {شهر}`.

### 4.3 Make the warranty the centrepiece

120 months is a genuine, defensible differentiator with a working registration
and admin-approval flow already built. It is currently a chip in the hero
(`گارانتی معتبر`) and little more. Give it a dedicated page explaining coverage in
plain Persian, surface it on every product page, and write the
`گارانتی تشک` article in §3.2 to rank for it.

This is the strongest asset Salyco has and the most under-marketed.

### 4.4 Answer Engine Optimization

Persian-language buyers increasingly ask ChatGPT and Perplexity "بهترین تشک برای
کمردرد" rather than searching. Citation favours: a direct answer in the first
100 words, real `<h2>` question headings, `FAQPage` schema, named authors, and
`dateModified`. The Phase 3 article structure delivers all of these — but **only
if Phase 2 ships first.** LLM crawlers do not execute JavaScript; today they see
`<div id="root"></div>` and nothing else.

---

## What to measure

Baseline these before Phase 1 so the delta is provable.

| Metric | Today (measured) | Target |
|---|---|---|
| Homepage LCP image | 5,205,266 B | < 200,000 B |
| JS transferred | 609,955 B (uncompressed) | < 180,000 B (brotli) |
| Favicon | 675,167 B | < 10,000 B |
| Fallback placeholder | 1,402,091 B | < 30,000 B |
| About page image weight | ~3.9 MB | < 500 KB |
| Routes with unique `<title>` | 0 | all |
| `og:*` tags | 0 | all public routes |
| JSON-LD blocks | 0 | 5 types (§2.4) |
| Indexable URLs in sitemap | no sitemap | all public routes |
| Soft-404 status | 200 | 404 |
| Articles > 1,000 words | 0 of 4 | 4 of 4 |
| Internal links per article | 0 | ≥ 3 |
| Products with `material` filled | 0 of 2 | 2 of 2 |
| Products with ≥ 3 reviews | 0 of 2 | 2 of 2 |

Add: Search Console impressions and clicks, Core Web Vitals (LCP / CLS / INP)
from field data, and organic sessions to `/articles/*`.

---

## Sequencing rationale

| Phase | Why here |
|---|---|
| **1** | Pure win, no dependencies, days of work. Compression and the 5.2 MB image alone change the site's feel. Fixing the dead CTA and the 2.00 rating stops active revenue loss. |
| **2** | Gates everything downstream. Content written before the site is crawlable earns nothing. Prerendering, metadata, sitemap, and structured data are the unlock. |
| **3** | Only compounds once Phase 2 is live. Rewriting four articles before they can be indexed is wasted effort. |
| **4** | Needs Phase 2's schema and Phase 3's content to have somewhere to land. Reviews need volume to accumulate — start collecting during Phase 3. |

**The one thing to do first:** enable gzip and replace `layerdimage.png`. Two
changes, under a day, and they fix the largest measured defect on the site.
