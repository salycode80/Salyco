# Salyco Production Audit — Measured Evidence

**Target:** https://salyco.ir (production)
**Audited:** 2026-08-26
**Method:** live HTTP probes (`curl`), live API reads, static analysis of `Frontend/salyco-front/src`, `nginx.conf`, `index.html`.
**Note:** Local `Backend/db.sqlite3` is stale dev data and was NOT used. All catalogue/article facts below come from the live API.

Every number in this file was measured, not estimated. Re-run the commands in
[Verification commands](#verification-commands) to confirm or refresh.

---

## 1. Stack as deployed

| Item | Value |
|---|---|
| Frontend | React 19 + Vite 8 SPA, **client-rendered only** |
| Served HTML | `1,355` bytes, body is `<div id="root"></div>` |
| Server | nginx/1.27.5 behind Caddy |
| Backend | Django + DRF at `/api/`, reverse-proxied |
| Font | Vazirmatn from `fonts.googleapis.com` (remote) |
| Public routes | ~11 of 20 declared in `App.jsx` |
| API health | 200 on all endpoints, ~0.21–0.34 s response, stable across 3 retry rounds |

---

## 2. SEO infrastructure — measured as absent

Counted directly against the HTML served by production:

| Signal | Count on served HTML |
|---|---|
| `<link rel="canonical">` | **0** |
| `og:*` / `twitter:*` tags | **0** |
| `application/ld+json` blocks | **0** |
| Per-route `<title>` | **0** (one global title) |

Global title on every route: `سالیکو | تشک و محصولات خواب`
Global meta description on every route: `سالیکو — تولیدکننده تشک و محصولات خواب با بیش از دو دهه تجربه. تشک طبی و فنری با گارانتی معتبر.`

Static analysis confirms the cause: no `react-helmet` (or equivalent) in
`Frontend/salyco-front/package.json`, and zero `document.title` assignments
anywhere in `src/`.

### Crawl-control files missing

| URL | Result |
|---|---|
| `/robots.txt` | **HTTP 200, `text/html`** — returns the SPA shell, not a robots file |
| `/sitemap.xml` | **HTTP 200, `text/html`** — returns the SPA shell, not a sitemap |

### Host duplication

```
https://salyco.ir/      → md5 19ff6bdd821105144936726ac257a29e
https://www.salyco.ir/  → md5 19ff6bdd821105144936726ac257a29e   (IDENTICAL)
```
Both hostnames serve byte-identical HTML with **no canonical tag** to pick a winner.
`http://salyco.ir` does correctly 308 → https.

### Soft 404s

`/this-page-does-not-exist-12345` → **HTTP 200** + HTML. The nginx SPA fallback
(`try_files $uri $uri/ /index.html`) makes every nonexistent URL return 200, so
any bad or hallucinated link becomes an indexable "page".

---

## 3. Compression — not enabled anywhere

`Frontend/salyco-front/nginx.conf` contains **no `gzip` and no `brotli` directive.**
Confirmed on the wire — no `content-encoding` response header:

| Asset | Bytes served (uncompressed) |
|---|---|
| `/assets/index-pcl4PnIM.js` | **609,955** |
| `/assets/index-jDeo7-u-.css` | **67,008** |
| `/` (HTML) | 1,355 |

Brotli on the JS bundle alone would plausibly land near ~150–180 KB. **~430 KB is
being shipped needlessly on every uncached visit.**

Cache headers are otherwise sane: `/assets/` gets `max-age=31536000, immutable`.
`/media/` and `/static/` get only `expires 7d`.

---

## 4. Images — the single largest performance defect

All live, measured with `curl`:

| File | Bytes | Note |
|---|---:|---|
| `/layerdimage.png` | **5,205,266** | **Homepage LCP element**, `fetchPriority="high"` |
| `/matress.png` | **1,402,091** | **Universal fallback placeholder** (8 call sites) |
| `/heroimage2.png` | 1,325,810 | About page |
| `/media/mattresses/main.png` | 1,303,905 | Flagship product photo |
| `/logo.png` | 1,069,775 | |
| `/logo3.png` | **675,167** | **Used as the favicon** in `index.html` |
| `/banner2.png` | 547,506 | About page |
| `/banner.png` | 537,315 | About page |
| `/locationimage.jpg` | 193,204 | |
| `/heroimage.png` | 92,489 | |

Article images are the one bright spot — correctly sized at 18–39 KB each
(`backpainmattress.jpg` 20,294 B; `matresstypes.png` 17,858 B; `matress1.jpg`
38,668 B; `matresssize.jpg` 32,321 B).

### Three compounding facts

1. **A 5.2 MB PNG is the homepage's largest paint.** `Hero.jsx:19` loads
   `/layerdimage.png` with `fetchPriority="high"` and no lazy-loading — correct
   *intent* for an LCP element, applied to a file ~50× too large. On a typical
   Iranian mobile connection this alone is a multi-second LCP.
2. **The fallback placeholder is 1.4 MB.** `/matress.png` is the default in
   `src/utils/productImage.js`, `src/utils/articleImage.js`,
   `ProductGallery.jsx`, `MattressCard.jsx`, `ProductCard.jsx`,
   `ArticleCard.jsx`, `CartPage.jsx`, and `warranty/ProductPreviewCard.jsx`.
   Every *missing* image costs 1.4 MB.
3. **The favicon is 675 KB.** `index.html:5` points `rel="icon"` at
   `/logo3.png`. A `favicon.svg` (9,522 B) already exists in `public/` unused.

### Delivery attributes

| Metric | Value |
|---|---|
| `<img>` tags in `src/` | 31 |
| with `loading="lazy"` | **5** |
| with `srcset` | **0** |
| with `alt` | 31 ✅ |
| WebP / AVIF assets | **0** — everything is PNG/JPG |

The About page loads `heroimage.png` + `banner.png` + `matress.png` +
`heroimage2.png` + `banner2.png` ≈ **3.9 MB of images**.

---

## 5. Live catalogue (via API, not local DB)

**2 products total.** Both mattresses.

| Field | Emperial (id 1) | Prestige (id 2) |
|---|---|---|
| `name` | مدل اِمپریال (Emperial) | مدل پرستیژ (Prestige) |
| `slug` | `tsh-slo-mdl-shmrh-1` | `mdl-rst` |
| `price` | 27,000,000 | 19,000,000 |
| `discount_price` | 24,300,000 (−10%) | 16,150,000 (−15%) |
| `warranty_months` | 120 | 120 |
| `firmness` | 5 | 3 |
| `material` | **`""` empty** | **`""` empty** |
| `trial_nights` | **0** | **0** |
| `rating` | **2.00** | **5.00** |
| `review_count` | **1** | **0** |

### Social-proof defects

- **The flagship's 2.00 rating is test data left in production.** The sole review:
  `customer_name: "امیررضا سلامت"`, `rating: 2`, `title: "عالی"`, `body: "عالی"`.
  A 2-star score whose text says *"excellent"* — and the name matches the footer
  credit `طراحی و تولید توسط مهندس امیررضا سلامت`. **This is the developer's own
  smoke test, and it is the only input to the flagship's public rating.**
- **Prestige displays 5.00 from `review_count: 0`.** A perfect score with zero
  reviews reads as fabricated and undermines the 2.00 next to it.
- `material` is `""` on both — but see §5b: the `specifications` relation carries
  the material data instead, so this is a redundant/unused field, not missing
  information.
- `trial_nights: 0` — no trial period offered, while the mattress category
  globally competes on exactly this.

### Headline prices are the single-bed price

`price` is the *cheapest size*, not the size the product describes:

| | `width×length` | Headline `price` | Actual price at that size |
|---|---|---:|---:|
| Emperial | 160×200 (Queen) | 27,000,000 (= 90×200 تکنفره) | **34,000,000** |
| Prestige | 160×200 (Queen) | 19,000,000 (= 90×200 یکنفره) | **26,000,000** |

The page presents a Queen-sized product at the single-bed price — understating by
**26%** and **37%**. Either label it `از ... تومان` ("from"), or key the headline
to the declared `width×length`. As-is it is a pricing-expectation trap at
checkout.

---

## 5b. Product content — rich, but partly describing the wrong product

**Correction to an earlier read:** `/api/mattress/` (the list endpoint) omits the
rich relations. `/api/mattresses/<slug>/` (the router's detail route) returns them.
The product content is **not** empty:

| Relation | Emperial | Prestige |
|---|---:|---:|
| `long_description` | ~1,900 chars | ~1,400 chars |
| `sizes` | 6 (27M–41M) | 6 (19M–32M) |
| `specifications` | 6 | 4 |
| `features` | 3 | **0** |
| `faqs` | 3 | **0** |
| `pros_cons` | 5 | **0** |
| gallery `images` | 3 | 1 |
| `reviews` | 1 (test data) | 0 |

The `long_description` on both is **genuinely good technical copy** — micro-bonnell
spring core at 2.2 mm wire, a 4 mm reinforced frame fixed by 10 M-jacks, 1,100 g
thermofelt on both faces, a 1,400 g vertical-fibre polyester pad, a compressed
foam layer, circular-knit anti-perspiration cover, 200 g polyester plus spunbond.
That is exactly the specificity this category needs. **Keep it.**

### The serious problem: Emperial's FAQs and pros/cons are for a memory-foam mattress

Emperial is a **spring** mattress. Its own spec sheet says `نوع تشک: طبی فنری`
and its `long_description` describes a micro-bonnell coil core. But:

| Field | Content | Problem |
|---|---|---|
| FAQ 1 | `آیا تشک مموری فوم برای کمردرد ... مفید است؟` | Asks about **memory foam** |
| FAQ 2 | `آیا تشک مموری فوم در تابستان داغ می‌شود؟` — answer claims `ژل خنک‌کننده (Cool Gel)` and `سلول‌باز (Open Cell)` | Memory foam again; **neither technology appears anywhere in the construction spec** |
| FAQ 3 | claims `گواهینامه‌ی استاندارد OEKO-TEX` | **Not in the spec sheet.** Unverifiable certification claim |
| PRO 1 | `ایزوله‌ی کامل حرکت` (complete motion isolation) | **Contradicts its own build.** Micro-bonnell coils are interconnected — the worst spring type for motion isolation |
| PRO 2 | `قابلیت مموری فوم در تطابق با انحنای بدن` | Credits memory foam the product doesn't contain |
| PRO 3 | `رویه‌ی ضد حساسیت` | Not in spec sheet |
| CON 1 | `لایه‌ی فوم ممکن است جذب کند` | References a foam layer |
| CON 2 | `عمر مفید ۱۲ ساله` | **12 years vs the 120-month (10-year) warranty.** Internally inconsistent |

This is a **memory-foam product template pasted onto a spring product.** It is not
thin content — it is false product content, asserting a certification and two
technologies the mattress does not have, and one performance claim its own
construction contradicts.

It also explains §8: the back-pain article recommends memory foam because **the
same template contaminated the article corpus.** One root cause, two symptoms.

> **Treat this as the highest-priority content fix in the plan.** In a consumer
> market, published specs and certifications are representations to the buyer.

### Emperial's own description names the wrong product

Inside Emperial's `long_description`:

> پد داخلی **پرستیژ** از الیاف فشرده پلی‌استر با وزن ۱۴۰۰ گرم تولید شده است

Emperial's description credits **Prestige's** internal pad — a copy-paste artifact
from building the second product off the first.

### Data-hygiene defects

- **Every gallery image has `alt_text: ""`** (4 images across both products). The
  31 `alt` attributes counted in §4 are the frontend's hardcoded ones; the
  DB-driven gallery alts are all blank.
- **No image is marked `is_primary`** — `is_primary: false` on all 4.
- **Spec keys aren't comparable across products.** Emperial: `نوع فنرها = High Micro`.
  Prestige: `نوع اسکلت = میکرو بونل` + `قطر مفتول فنر = 2.2 mm`. Same spring, three
  different keys and two different names for it. Cross-model comparison is impossible.
- **Units missing or malformed.** Emperial `ضخامت تشک = "31"` (no unit).
  Prestige `پد رویی فنر = "گرم1400 الیاف فشرده پلی استر"` — digits glued to the unit
  in reverse order, and `پلی استر` missing its ZWNJ (`پلی‌استر`).
- **`pros_cons.display_order` is `0` on all five** — render order undefined.
- **Prestige has no features, no FAQs, no pros/cons, and one image.** It is a
  materially weaker page than Emperial for a product only 30% cheaper.

### Empty banners

`GET /api/banners/` → `[]` (2 bytes). `BannerCarousel.jsx` renders nothing in
production. A homepage merchandising slot is live but empty.

---

## 6. Slug migration is written but NOT deployed

`_slugmap.txt` defines a transliterated→Persian slug migration. Production state:

| Probe | Result |
|---|---|
| `GET /api/articles/بهترین-تشک-برای-کمردرد/` (encoded) | **404** |
| `GET /api/articles/bhtrn-tsh-br-mrdrd-o-ds-mr-dm-st/` | **200** |
| `GET /articles/بهترین-تشک-برای-کمردرد` (frontend) | **200** (SPA fallback) |

The frontend route resolves to 200 because of the SPA fallback, then the API
404s — so a Persian-slug URL renders a broken page rather than redirecting.
The migration is half-live: **the worst of both states.**

Live slugs are machine transliterations with vowels stripped
(`bhtrn-tsh-br-mrdrd-o-ds-mr-dm-st`, `rhnm-gmaa-khrd-tsh-frk-tsh-tb-o-fnr-st`) —
unreadable to Persian users and worthless as keyword signal.

---

## 7. Broken hero CTA

`Hero.jsx` renders a download button to `/catalog.pdf`:

```
GET https://salyco.ir/catalog.pdf
  → HTTP 200, content-type: text/html, 1,355 bytes
```

**The file does not exist.** The SPA fallback serves `index.html`, so clicking
"دانلود کاتالوگ" downloads 1.3 KB of HTML named `catalog.pdf`. This is one of only
two CTAs on the homepage.

---

## 8. Article corpus

**4 articles. All created `2026-07-19`. All have `updated_at == created_at`** — none
has been touched since publication.

Deep-read of `bhtrn-tsh-br-mrdrd-o-ds-mr-dm-st`:

| Metric | Value |
|---|---|
| Characters | 2,151 |
| **Words** | **230** |
| **HTML tags in body** | **0** — pure plain text |
| Internal links | **0** |
| `<h2>` in `ArticleDetail.jsx` | **0** |

Consequences:

- **Headings are fake.** `ویژگی‌های یک تشک مناسب برای کمردرد:` is a bare text line,
  not an `<h2>`. The article has no machine-readable structure.
- **Lists are fake.** Steps use Persian numerals `۱. ۲. ۳.` as literal text
  instead of `<ol>`.
- **Zero internal links.** The body says `با کارشناسان ما تماس بگیرید` ("contact our
  experts") and links nowhere. No link to either product, to `/contact`, or to
  the sibling article on طبی-vs-فنری.
- **Brand is anonymous.** Copy says `برند ما` ("our brand") instead of `سالیکو`,
  forfeiting entity reinforcement on the exact page most likely to rank.
- **No E-E-A-T signals** — no author, no medical reviewer, no citation, no visible
  date, no FAQ block.

### Content contradicts the catalogue

The article's core recommendation:

> تشک‌های طبی و تشک‌های مموری فوم برای افرادی که دیسک کمر یا کمردرد مزمن دارند، بهترین انتخاب هستند
> *("medical and **memory foam** mattresses are the best choice for disc/chronic back pain")*

**Salyco sells no memory foam product.** The catalogue is two spring-framed
models (firmness 5 and 3). The highest commercial-intent article on the site
recommends a category the company cannot fulfil, then asks the reader to call.

230 words will not compete for `بهترین تشک برای کمردرد` — a top-of-funnel
commercial Persian query where ranking pages run 1,500–3,000 words.

---

## 9. Brand source-of-truth is the wrong document

`Salyco-DESIGN.md` is the repo's design system. It is a **copy-pasted fintech /
payments design system**, not a mattress brand's. Verbatim from the file:

- *"Transaction cards: left border 4px colored by status"*
- *"Level 3 for modals and **payment confirmation dialogs**"*
- *"Don't clutter **payment forms**; one action per screen"*
- *"tabular numerals for all **financial amounts**"*
- *"Inter provides excellent legibility for **financial data and transaction details**"*

It specifies **Inter** as display and body font. **The site actually loads
Vazirmatn.** The colors are labelled *"PayPal Navy"*, *"PayPal Light Blue"*,
*"PayPal Gold"*.

The prose intro is genuinely on-brand (quiet luxury, five-star hotel suite,
classical elegance). Everything below it describes a different product. Any
designer or agent reading this file for guidance is being misled.

The file does contain one correct warning worth keeping: gold `#F5BA2E` fails
contrast on white and must not be used for text.

---

## 10. Assets that are already right

Not everything is broken — these are working and should be preserved:

- **All 31 `<img>` tags have `alt` text**, and it's meaningful Persian
  (`تشک سالیکو`, `نماد اعتماد الکترونیک`), not filenames.
- **Enamad trust badge** (`نماد اعتماد الکترونیکی`) is present in the footer — the
  single most important trust signal for Iranian e-commerce.
- **Article images are correctly sized** (18–39 KB).
- **`Hero.jsx` has a real, deliberate `<h1>`**, added specifically to fix a missing
  document heading — the code comment shows the reasoning.
- **`fetchPriority="high"` on the LCP image** is the correct technique.
- **Hashed assets are cached hard** (`immutable`, 1 year).
- **`http` → `https` 308 redirect** works.
- **Copy quality on About / Contact / Hero is good** — warm, specific, confident,
  consistent voice. `رسالت ما، خوابِ راحتِ شماست` and
  `همراه شما، از انتخاب تا خواب راحت` are strong lines.
- **Physical address is real and specific** — نیشابور، خیابان مدرس (Neyshabur,
  Khorasan Razavi), with hours `شنبه تا پنج‌شنبه، ۹ تا ۲۰`. Unexploited local-SEO asset.
- **120-month warranty with a registration system** is a genuine, defensible
  differentiator already built.

---

## Severity roll-up

| # | Finding | Severity |
|---|---|---|
| 1 | 5.2 MB PNG as homepage LCP | Critical |
| 2 | No gzip/brotli — 610 KB JS uncompressed | Critical |
| 3 | Broken `/catalog.pdf` hero CTA | Critical |
| 4 | Zero per-route titles/meta/OG/JSON-LD/canonical | Critical |
| 5 | No robots.txt, no sitemap.xml | Critical |
| 6 | Flagship shows 2.00 rating; sibling shows 5.00 from 0 reviews | Critical |
| 7 | 1.4 MB fallback placeholder image | High |
| 8 | 675 KB favicon | High |
| 9 | Persian slug migration half-deployed (API 404s) | High |
| 10 | Articles are 230-word plain text, 0 tags, 0 internal links | High |
| 11 | Article recommends memory foam; no such product exists | High |
| 12 | www + apex serve identical HTML, no canonical | High |
| 13 | Soft 404s return HTTP 200 | High |
| 14 | Homepage H1 contains neither "تشک" nor "سالیکو" | Medium |
| 15 | `material` empty, `trial_nights: 0` on both products | Medium |
| 16 | `/api/banners/` empty — carousel dead | Medium |
| 17 | 0 of 31 images use `srcset`; 5 of 31 lazy; 0 WebP/AVIF | Medium |
| 18 | `Salyco-DESIGN.md` is a fintech doc specifying the wrong font | Medium |
| 19 | Google Fonts loaded remotely (unreliable in Iran) | Medium |
| 20 | Local SEO unexploited despite real Neyshabur address | Medium |

---

## Verification commands

```bash
# SEO signals on served HTML (expect 0 0 0)
curl -sS -L https://salyco.ir/ | grep -ci canonical
curl -sS -L https://salyco.ir/ | grep -ciE "og:|twitter:"
curl -sS -L https://salyco.ir/ | grep -ci "ld+json"

# Crawl files (expect text/html = broken)
curl -sSI -L https://salyco.ir/robots.txt  | grep -i content-type
curl -sSI -L https://salyco.ir/sitemap.xml | grep -i content-type

# Compression (expect NO content-encoding line)
curl -sSI -H "Accept-Encoding: gzip, br" -L \
  https://salyco.ir/assets/index-pcl4PnIM.js | grep -iE "content-encoding|content-length"

# Heaviest assets
for f in layerdimage.png matress.png logo3.png logo.png heroimage2.png; do
  printf "%-20s " "$f"
  curl -sS -o /dev/null -w "%{size_download}\n" -L "https://salyco.ir/$f"
done

# Broken hero CTA (expect text/html)
curl -sS -o /dev/null -w "%{http_code} %{content_type} %{size_download}\n" \
  -L https://salyco.ir/catalog.pdf

# Soft 404 (expect 200)
curl -sS -o /dev/null -w "%{http_code}\n" -L https://salyco.ir/nope-12345

# Host duplication (expect identical hashes)
curl -sS -L https://salyco.ir/     | md5sum
curl -sS -L https://www.salyco.ir/ | md5sum

# Live catalogue + empty banners
curl -sS -L https://salyco.ir/api/mattress/
curl -sS -L https://salyco.ir/api/banners/

# Slug migration state (expect 404 then 200)
curl -sS -o /dev/null -w "persian %{http_code}\n" -L \
  "https://salyco.ir/api/articles/%D8%A8%D9%87%D8%AA%D8%B1%DB%8C%D9%86-%D8%AA%D8%B4%DA%A9-%D8%A8%D8%B1%D8%A7%DB%8C-%DA%A9%D9%85%D8%B1%D8%AF%D8%B1%D8%AF/"
curl -sS -o /dev/null -w "old     %{http_code}\n" -L \
  "https://salyco.ir/api/articles/bhtrn-tsh-br-mrdrd-o-ds-mr-dm-st/"

# Image delivery attributes
cd Frontend/salyco-front
grep -rc '<img' src/            | awk -F: '{s+=$2} END {print "img:    "s}'
grep -rc 'loading="lazy"' src/  | awk -F: '{s+=$2} END {print "lazy:   "s}'
grep -rci 'srcset' src/         | awk -F: '{s+=$2} END {print "srcset: "s}'
```
