# Article CMS on Wagtail — server-rendered articles

Date: 2026-09-22
Status: approved in chat, awaiting spec review

Introduces Wagtail as a focused CMS for articles, keeping Django, DRF,
PostgreSQL and React exactly as they are. Article pages move from
client-rendered to server-rendered under `/articles/`, so their text,
headings, metadata, canonical tags and structured data exist in the first
byte of the response instead of arriving after an API call.

The rest of the site is untouched. Wagtail is the CMS, not the website.

**Citation convention.** `§N` cites the client's specification
(«Salyco Article CMS — Wagtail Integration Specification»). This
document's own sections are written `Section N` — the two are never the
same number, so they are never written the same way.

## Problem

Articles are the pages most likely to be shared and the only pages on the
site carrying pre-purchase intent — «بهترین تشک برای کمردرد» is a query a
customer types *before* choosing a mattress. Today they are the pages a
crawler and a chat client can see least.

`ArticleDetail.jsx` mounts an empty `<div id="root">`, calls
`/api/articles/<slug>/`, and only then renders the body. Every
consequence the brief's crawlability requirements exist to prevent
follows from that:

1. **No crawler sees the content.** The four articles' text, headings and
   links exist only after JavaScript runs. Google may execute it; the
   crawlers that matter for an Iranian consumer brand — Telegram,
   WhatsApp, Instagram DM — do not. A shared article renders as a bare
   grey rectangle.
2. **No metadata exists at all.** `ArticleDetail.jsx` writes nothing to
   `document.head`, so every article shares the single `<title>` and
   `<meta name="description">` in `index.html`. There is no canonical, no
   `og:`, no JSON-LD.
3. **There is nowhere to edit an article that is not a code change.**
   `articles.Article` has `title, slug, excerpt, content, image,
   is_published, created_at, updated_at` — no category, no author, no
   tags, and `content` is a plain `TextField` rendered inside
   `whitespace-pre-wrap`. Marketing cannot structure a post, add an FAQ,
   or link to a product without a developer.
4. **The URLs carry no signal.** All four slugs are hand-typed
   transliterations (`bhtrn-tsh-br-mrdrd-o-ds-mr-dm-st`) that no human can
   read and no keyword search matches.

## Measured baseline

`E:\salyco-fullstack`, branch `master` @ `e9c80bb`, 2026-09-22.

| Signal | State | Evidence |
| --- | --- | --- |
| Django / DRF | 6.0.6 / 3.17.1 | `pip list` |
| Python | 3.14.3 local, **3.12** in image | `Backend/Dockerfile:2` |
| Wagtail | **absent** | not in `requirements.txt` |
| Redis / Celery | **neither** | `requirements.txt` |
| `articles` app layout | flat `Backend/articles` | no `apps/` package exists |
| `Article` fields | 8; **no category, author or tags** | `articles/models.py` |
| Live articles | **4** | `GET https://salyco.ir/api/articles/` |
| Body format | **plain text + newlines, not HTML** | 1198 chars, `'<' not in content` |
| API list shape | **bare JSON array**, unpaginated | `ArticleListCreate` |
| React article routes | `/articles`, `/articles/:slug` | `App.jsx:81-82` |
| Tailwind | **v4**, CSS-configured `@theme` | `src/index.css:46` |
| Static storage | `CompressedManifestStaticFilesStorage` | `core/settings.py` |
| `/robots.txt` | **HTTP 200 `text/html`** (SPA shell) | per 08-25 spec's live measurement |
| `/sitemap.xml` | **HTTP 200 `text/html`** (SPA shell) | same |

Two facts decide much of what follows:

- **The four bodies are plain text, not HTML.** The 08-25 spec assumed a
  sanitisation problem would have to be solved to get in-body links. There
  is no HTML to sanitise — the migration is a clean parse of paragraphs,
  and no `RawHTMLBlock` is needed anywhere (§38).
- **`_slugmap.txt` already exists at the repo root** and contains the
  authored Persian slugs for all four articles, e.g.
  `bhtrn-tsh-br-mrdrd-o-ds-mr-dm-st` → `بهترین-تشک-برای-کمردرد`. The
  migration target is already decided and reviewed, not invented here.

## Decisions taken with the client

1. **Scope is a thin vertical slice.** This spec ships a working,
   deployable path end to end. The remaining Salyco-specific blocks and
   the editorial workflow are separate specs. See *Scope*.
2. **Slugs become Persian, with real 301s.** Matches the 08-25 spec's
   decision, and uses the exact slugs in `_slugmap.txt`.
3. **The React article pages are deleted, and SPA links become `<a>`.**
   A React Router `<Link>` would client-render the deleted component
   instead of reaching Django, so every article link in the SPA must
   become a real anchor.
4. **This spec owns `/sitemap.xml` and `/robots.txt` completely** —
   articles, products and static routes — rather than shipping a sitemap
   that covers half the site.
5. **Tokens get one source of truth.** Extracted to a shared
   `tokens.css`; the frontend's `@theme` maps onto it; Django links it.

## Wagtail version: 7.4.3 LTS

The brief's §1 asks for the newest release compatible with the project's
*existing* Django and Python, and forbids a Django upgrade unless
unavoidable. Checked against PyPI metadata rather than assumed.

| | Wagtail **7.4.3** (chosen) | Wagtail 8.0 |
| --- | --- | --- |
| Support | **LTS, to 2027-11-02** | feature release, 2026-08-25 |
| Django | 5.2, 6.0 | 5.2, 6.0, 6.1 |
| Python | 3.10 – 3.14 | 3.10 – 3.14 |
| `djangorestframework` | **`>=3.15.1`** | **`>=3.18.0`** |
| Extra deps | — | `django-ninja`, `pydantic` |

**No Django upgrade is needed, and no DRF upgrade either.** That second
row is the deciding one: 8.0 would force DRF from 3.17.1 to ≥3.18, and
DRF is the framework every existing endpoint in the project is built on.
A version bump there is a blast radius across `mattress`, `orders`,
`payments`, `users`, `banners`, `gallery` and `search` — for a feature
release four weeks old with a single publication. 7.4 being LTS settles
it: security support until November 2027, four patch releases so far, the
most recent two days before 8.0 shipped.

Sources: `https://pypi.org/pypi/wagtail/json` (classifiers and
`requires_dist` for 7.4.3, 7.3.4 and 8.0), Wagtail release schedule.

## Corrections to prior specs

Three, each a place where this work supersedes something already written
down. None of the three prior specs is implemented (`src/seo/` does not
exist, `/sitemap.xml` still returns the SPA shell), so nothing is being
undone in code — but the reasoning in those documents needs revising.

| # | Prior spec said | This spec |
| --- | --- | --- |
| 1 | 08-24: request-time article metadata is **out of scope**, "judged on its own" | It *is* this spec. The brief's approach is a third option that spec never considered: nginx routes `/articles/` to Django and never touches `index.html`, so the objection that Django would have to hold the built SPA shell does not apply |
| 2 | 08-25: detail pages are **prerendered at build time from the live API**; "adding an article requires a rebuild before its social card works" | Rejected. Server rendering has no rebuild step, and returns the *body*, not just `<head>` |
| 3 | 08-25: "converting article storage to sanitised HTML/markdown is the natural follow-up … deliberately out of scope" | This is that follow-up. The stored bodies turn out to be plain text, so the sanitisation problem the note anticipated does not arise |

Also corrected: the 08-24 spec rejected `django.contrib.sitemaps` because
it requires `django.contrib.sites`, which is not in `INSTALLED_APPS`.
Wagtail requires `django.contrib.sites` and `SITE_ID` regardless, so that
objection disappears — though the sitemap is still written as an explicit
XML view, because it must merge Wagtail pages with `Mattress` rows and
static routes, which the framework's per-model registries do not express
conveniently.

## Structural choices

Six decisions, each against a more obvious alternative.

### The `articles` app is extended, not replaced

`Backend/articles` already exists with `models.py`, `views.py`,
`urls.py`, `serializers.py`, `admin.py` and tests. The brief's §2 sketch
shows an `apps/articles/` package; the project has no `apps/` package and
no other app uses one. Creating one for this feature alone would put a
single app at a different depth from its seven siblings, so the page
models, blocks, templates, static and commands are added to the existing
flat app. §2's closing instruction — adapt to the conventions already in
the project — is the instruction being followed.

### `Site.root_page` is Wagtail's `Root`, and the index is its child

This is the decision the whole URL scheme rests on, and the obvious
choice is wrong.

Wagtail resolves a page's public URL by walking from `Site.root_page`
down the page's ancestry. So:

```
Root  (id=1, is_site_root, no template)
└── Articles   slug="articles"   →  https://salyco.ir/articles/
    └── <article>                →  https://salyco.ir/articles/<slug>/
```

Setting `root_page` to the Articles index instead — the intuitive move,
since that page is the entry point — would make the index's own URL `/`
and every article's URL `/<slug>/`, and every canonical, `og:url` and
sitemap entry would be wrong. Mounting `wagtail_urls` under a
`path("articles/", …)` prefix does not rescue it either: Wagtail walks
the *page tree*, not the URLconf, so a request for `/articles/foo/`
stripped to `foo/` would look for a child of `Root` named `foo`.

So `wagtail_urls` is included at the root, **last**, as §3 requires. It
only ever receives what nginx sends to Django.

A request for `/` cannot reach it in production (nginx sends `/` to the
SPA) or in local development (Vite's dev server serves `/` and proxies
only `/api` and `/media`, `vite.config.js:12-21`). Because a
misconfigured proxy would otherwise turn `/` into a `TemplateDoesNotExist`
500 rather than a 404, a `wagtailcore/root.html` returning 404 is added as
cheap insurance.

### `ArticleIndexPage` carries category, tag and pagination routes

`wagtail.contrib.routable_page` gives the index `route()` methods for
`/articles/category/<slug>/`, `/articles/tag/<slug>/` and `?page=N`.
The alternative — separate `CategoryPage`/`TagPage` page types in the
tree — would mean every category exists twice, once as the `ArticleCategory`
snippet the brief's §7 asks for and once as a Page, with no rule about
which is authoritative. Sub-routes keep one record per category and one
URL, and keep the tree to two levels so an editor cannot get lost in it.

`ArticleIndexPage.Meta.max_count = 1` enforces §5's "normally ONE".

### `ArticlePage` is the single source of truth; the legacy table stays

`articles.Article` is **not deleted, not modified, and not mirrored
into**. It stays exactly as it is, serving two purposes: the source the
migration reads from, and the rollback path if the new pages disappoint.

There is no dual-write signal. Mirroring a Wagtail page into a second
table would mean two records per article that can silently disagree —
the failure §58 warns about in the product context applies identically
here.

The API is reimplemented against `ArticlePage`, preserving the response
shape the SPA already consumes (see Section 11).

### `SITE_URL` is the metadata authority, not the request

Behind host nginx → container nginx → gunicorn, three proxies stand
between Django and the client. `SECURE_PROXY_SSL_HEADER` is already
configured, and host nginx already forwards `Host`, `X-Real-IP`,
`X-Forwarded-For` and `X-Forwarded-Proto` (`deploy/nginx/salyco.conf`),
so `request.is_secure()` is correct — but §16 and §68 forbid `localhost`,
`127.0.0.1` or `backend:8000` reaching metadata under *any*
misconfiguration, and one typo in a proxy header is enough to leak them.

So canonical URLs, `og:url`, JSON-LD `mainEntityOfPage` and sitemap
entries are built from an explicit `SITE_URL` setting
(default `https://salyco.ir`), never from the request. Wagtail's own
`Site` model is still configured (`hostname="salyco.ir"`,
`is_default_site=True`) because the admin's preview and page-URL display
read it.

### Article styling uses the same tokens through one file

Tailwind v4 here is configured in CSS — `@theme` inside `src/index.css`,
compiled by Vite. Django templates cannot use those utilities.

Three options were on the table: duplicate the hex values into a
standalone stylesheet, add a Node/Tailwind CLI stage to the Python image
so `bg-brand-navy` works in templates, or extract the tokens into one
plain-CSS file both sides read. The first duplicates the palette and
invites silent drift on the next brand tweak. The second puts a Node
toolchain in the Python image and makes adding a CSS class a backend
rebuild — and Tailwind's utilities do not express long-form Persian
leading (16/30, 28/44) any better than plain CSS does.

So the token values move to `Frontend/salyco-front/public/tokens.css` as
real custom properties, and `src/index.css` keeps its `@theme` block but
maps Tailwind's names onto them:

```css
@theme inline {
  --color-brand-navy: var(--salyco-navy);
}
```

Every existing Tailwind class in React keeps working — `bg-brand-navy`
still compiles, it now resolves through the variable. Django links
`/tokens.css` (served by nginx from the SPA root, exactly as `/fonts/…`
already is) plus its own `articles/static/articles/article.css` holding
semantic component styles.

`@theme inline` is required rather than plain `@theme` so the utility
emits `var(--salyco-navy)` rather than an indirection through a
theme-scoped variable that Tailwind may tree-shake. This is verified by
inspecting the built CSS, not assumed.

## Approach

Fourteen sections. 1–4 are the CMS and its content model, 5–7 the public
templates, the styling and the editing experience, 8–10 the crawler
surface and the routing that reaches it, 11–13 the API, reading time and
the legacy migration, and 14 the tests.

## 1. Dependencies and settings

`requirements.txt` gains `wagtail==7.4.3`. Pinned exactly, because
`wagtail>=7.4` would silently pick up 8.0 on the next uncached
`pip install` and force the DRF upgrade this spec exists to avoid.

`core/settings.py`:

```python
SITE_ID = 1
LANGUAGE_CODE = "fa"
LANGUAGES = [("fa", "فارسی"), ("en", "English")]
WAGTAIL_SITE_NAME = "مدیریت محتوای سالیکو"
WAGTAILADMIN_BASE_URL = os.getenv("SITE_URL", "https://salyco.ir")
WAGTAIL_ENABLE_UPDATE_CHECK = False
SITE_URL = os.getenv("SITE_URL", "https://salyco.ir")
```

`INSTALLED_APPS` gains `django.contrib.sites`, `taggit`,
`wagtail.users`, `wagtail.admin`, `wagtail.documents`, `wagtail.images`,
`wagtail.search`, `wagtail.snippets`, `wagtail.sites`,
`wagtail.contrib.redirects`, `wagtail.contrib.routable_page`,
`wagtail.embeds`.

`wagtail.embeds` is included now even though the video block is Spec 2:
it is one line and no risk, and deferring it means a second settings edit
and a stray migration in an unrelated spec.

`MIDDLEWARE` gains
`wagtail.contrib.redirects.middleware.RedirectMiddleware`, which is what
makes §25's 301s work — it runs on `process_request`, before URL
resolution, so an old slug is redirected even though no page has it.

The `/cms/` admin needs a login URL for unauthenticated visitors;
`LOGIN_URL` is set to `/cms/login/` rather than Django admin's.

**Deliberately unchanged:** `TIME_ZONE` stays `UTC`. Moving it to
`Asia/Tehran` would shift every existing warranty-activation and order
timestamp in the database's presentation, which has nothing to do with
articles and deserves its own change.

**Flagged:** `LANGUAGE_CODE` changing from `en-us` to `fa` makes the
existing Django admin Persian as well as the new Wagtail one. For a
Persian-first brand that is almost certainly wanted, but it is a change
to a surface this spec was not asked about, so it is called out rather
than slipped in. Reverting it is one line plus per-user language
preferences in Wagtail if the client prefers a split.

## 2. Page models

`ArticleIndexPage(Page)`. `parent_page_types = ["wagtailcore.Page"]`;
`subpage_types = ["articles.ArticlePage"]`, so §5's "prevent arbitrary
unrelated page types below it" is enforced by Wagtail, not by convention.
`max_count = 1`. Fields: `intro`, `hero_title`, `hero_description`,
`featured_article` (PageChooser, limited to ArticlePage),
`featured_categories` (multiple SnippetChooser).

`ArticlePage(Page)`. `parent_page_types = ["articles.ArticleIndexPage"]`,
so an article cannot exist anywhere else. Fields:

| Field | Type | Note |
| --- | --- | --- |
| `subtitle` | CharField | |
| `excerpt` | TextField | the meta-description fallback; `clean()` refuses a save with it empty, so a publish cannot go out without one |
| `hero_image` | FK `wagtailimages.Image` | |
| `hero_image_alt` | CharField | |
| `category` | FK `ArticleCategory` | |
| `tags` | `ClusterTaggableManager` | taggit, not comma-separated text |
| `author` | FK `ArticleAuthor` | |
| `body` | StreamField | see Section 4 |
| `is_featured`, `featured_order` | Bool / PositiveSmallInt | drives the index hero |
| `estimated_reading_time` | PositiveSmallInt | computed on save, Section 12 |
| `legacy_id` | PositiveInteger, unique, null | traceability + migration idempotency |
| `canonical_url_override` | URLField, blank | validated, Section 8 |
| `allow_indexing`, `allow_following` | Bool, default `True` | §17 |
| `og_title`, `og_description`, `og_image` | Char/Char/FK Image | §15 |

`title`, `slug`, `seo_title`, `search_description`, `first_published_at`,
`last_published_at` come from Wagtail's `Page` and are **not duplicated**,
per §6. `edit_handler` is a `TabbedInterface` of **محتوا** / **سئو** /
**شبکههای اجتماعی**, so a non-technical editor meets three named tabs
rather than one wall of fields.

`tags` uses `ClusterTaggableManager` from `modelcluster` (already a
Wagtail dependency) so tags are searchable in the admin.

## 3. Snippets

`ArticleCategory` and `ArticleAuthor` are both `@register_snippet` —
registered as snippets rather than Pages because §7 and §8 say so, and
because neither has a public URL of its own that needs to live in the
page tree (the category archive is a sub-route of the index).

`ArticleCategory`: `name`, `slug` (unique), `description`, `image`,
`seo_title`, `seo_description`, `is_active`, `sort_order`. Persian
`verbose_name`s throughout, `panels` ordered for the admin, listed by
`sort_order`, filtered on `is_active`.

`ArticleAuthor`: `name`, `slug`, `author_type` ∈ `Person` / `Organization`,
`job_title`, `short_bio`, `avatar`, `linkedin_url`, `instagram_url`,
`website_url`, `is_active`. The type field exists because §8 anticipates
«تحریریه سالیکو» publishing some content with no individual attached, and
Schema.org needs to be told which it is — an `Organization` author
emitted as a `Person` is a factual error in structured data, not a
cosmetic one.

Both get `search_fields` so Wagtail's admin search finds them, and
`__str__` returning the name.

## 4. StreamField blocks

Grouped exactly as §11 asks — **متن / رسانه / ساختاری / سالیکو** — using
`StreamBlock` group labels. §11's concern is that twenty ungrouped blocks
is a menu an editor has to read; the groups make it a menu they can scan.

| Group | Block | Fields and behaviour |
| --- | --- | --- |
| متن | `HeadingBlock` | `text`, `level` ∈ {H2, H3} **only**, `anchor_id` optional, auto-generated from the text when blank. H1 is absent from the choices because §10.A requires the page title to be the only H1, and a choice that must never be taken should not be offered |
| متن | `ParagraphBlock` | `RichTextBlock` restricted to bold, italic, links, `ol`, `ul`, blockquote. **No heading features**, so heading level cannot be smuggled in — hierarchy comes from `HeadingBlock` alone |
| متن | `QuoteBlock` | `quote`, `source_name`, `source_title`, `source_url` → `<blockquote>` with `<cite>` when a source is given |
| رسانه | `ImageBlock` | `image`, `alt_text`, `decorative`, `caption`, `credit`. Alt text is required unless `decorative` is ticked; `clean()` refuses an image with neither |
| ساختاری | `CalloutBlock` | `variant` ∈ {info, tip, warning, important}, `title`, `content`; colours come from `Design.md`'s status tokens, which are already defined for exactly this |
| ساختاری | `FAQBlock` | `ListBlock` of question/answer pairs, min 1 |
| سالیکو | `CTABlock` | `eyebrow`, `title`, `description`, `link`, `variant` ∈ {primary, soft, product, contact} |
| سالیکو | `ArticleLinkBlock` | reusable `StructBlock`: `page` (PageChooser) **or** `url` (URLBlock) plus `label`. `clean()` rejects both-set and neither-set |

`ArticleLinkBlock` is what §57 means by internal linking without
hardcoded domains. A page chooser stores a page id, Wagtail resolves it
to a relative URL at render time, and the link survives a slug change —
which a pasted absolute URL would not.

`HeadingBlock.anchor_id` is generated with
`slugify(text, allow_unicode=True)` so Persian headings get a usable
fragment. De-duplication of repeated headings is *not* done here; it
belongs with the table-of-contents feature that would consume the
anchors, and is noted in Scope rather than half-built now.

No `RawHTMLBlock` exists anywhere in the block set, and none is added.
§38 forbids it and §10 forbids handing editors arbitrary HTML; the
structural blocks are what makes that possible without losing layout.

## 5. Templates

Django templates under `articles/templates/articles/`, inheriting
`base_article.html`, which declares `<html lang="fa" dir="rtl">` and
links the shared stylesheet:

```
base_article.html      <html lang dir>, head, header, footer
article_page.html      <main><article> — breadcrumb, h1, meta, hero, body, FAQ, related
article_index_page.html  featured, latest grid, categories, pagination
category_page.html     category h1, description, grid, pagination
tag_page.html          same, noindex
article_card.html      the single card partial used by every list
breadcrumb.html        visual breadcrumb, mirrors the JSON-LD
pagination.html        server-side links, no JS
blocks/*.html          one per block
```

Semantics follow §20 literally: one `<h1>` (the page title) with no other
block able to emit one, real `<p>`, real `<ul>`/`<ol>`, `<figure>` +
`<figcaption>` for captioned images, `<blockquote>` for quotes, a real
`<table>` for the Spec-2 table block.

The FAQ block renders as `<details>`/`<summary>`. That is the whole point
of §10.G: the native element is keyboard-accessible and the answers are in
the served HTML, so a crawler and a no-JS reader get the same content as a
browser, with no accordion script to load.

## 6. Styling

`Frontend/salyco-front/public/tokens.css` holds the palette as plain
custom properties. `src/index.css` keeps its `@theme` block, rewritten
with `@theme inline` to map Tailwind's names onto those variables. The
font-face declarations stay where they are; the fonts are already
self-hosted at `/fonts/` and served from the SPA root, which is also
where `/tokens.css` is served from.

`articles/static/articles/article.css` holds semantic component styles —
`.article-body`, `.article-callout--warning`, `.article-faq`,
`.article-card` and so on — reading the same variables.

Long-form typography comes from `Design.md`: body 16/30, H2 28/44, H3
20/32, 4px spacing scale, radius 8/12/16, shadow level 1 on cards. The
reading measure is `Design.md`'s **640px**, not the brief's suggested
720–820px — `Design.md` is the project's own authority and says «عرض
پاراگراف مستقل معمولاً حداکثر ۶۴۰ پیکسل است». Blocks that need more room
(tables, and the Spec-2 product grids) break out of that measure inside a
wider container rather than widening the prose.

`prefers-reduced-motion` is honoured, logical properties
(`padding-inline`, `margin-inline-start`) are used throughout, and Latin
text and phone numbers are wrapped in `dir="ltr"` or `<bdi>` per
`Design.md`.

A throwaway `verify-tokens.mjs` in the style of the existing
`verify-footer.mjs` asserts that every value in `tokens.css` and the
`@theme` mapping agree, so a brand tweak applied to one file and not the
other fails loudly. The alternative failure is silent: half the site
repaints, half does not.

## 7. Editorial experience

`wagtail_hooks.py` brands the admin as **Salyco Content / مدیریت محتوای
سالیکو** with the existing Salyco logo, sets the page explorer icon, and
registers a direct **مقالات** menu item pointing at the `ArticleIndexPage`
so an editor never has to understand the page tree to find their work.

Branding goes through supported hooks and a small CSS override only. §12
is explicit that over-customising Wagtail internals makes upgrades
expensive, and a fork of the admin is the thing most likely to make
Spec 2 and Spec 3 painful.

Field labels and help text are Persian. Direction is set on the content
editor and preview panes, **not** globally: §12 requires that slugs, URLs
and email inputs stay LTR, and a blanket `direction: rtl` makes those
genuinely unusable.

Preview works through Wagtail's built-in `preview_modes` and renders
`article_page.html` — the real public template, not an approximation — so
§32's "preview must show the real public article design" is satisfied by
construction rather than by keeping two templates in step. Preview URLs
live under `/cms/`, which is authenticated and `Disallow`ed in
`robots.txt`, so §32's "must not be publicly indexable" holds twice over.

Collections `مقالات`, `محصولات` and `عمومی` are created so editorial
imagery is filed separately from product imagery. Group permissions and
the moderation workflow are Spec 3; Spec 1 gives `/cms/` to staff
accounts only.

## 8. SEO

All fallback chains live in `articles/seo.py` as pure functions over a
page, so each is unit-testable without a request:

```
<title>      seo_title → title,  + " | سالیکو" once, never doubled
description  search_description → excerpt
canonical    canonical_url_override → SITE_URL + page.get_url()
robots       allow_indexing/allow_following → "index,follow"
             drafts always noindex; tag pages noindex,follow
og:image     og_image → hero_image → global default
```

`og:type` is `article`, `og:locale` is `fa_IR`, `twitter:card` is
`summary_large_image`, and the social image is a `fill-1200x630`
focal-point crop so §43's landscape ratio is met without distorting the
source.

Exactly one canonical is emitted per page (§16). `canonical_url_override`
is validated on save to reject `localhost`, `127.0.0.1` and `backend:8000`
outright — the failure §68 lists, caught at the point an editor types it
rather than at the point a crawler reads it.

**JSON-LD.** `Article` (or `BlogPosting`) with `author` typed from
`ArticleAuthor.author_type`, `publisher` from the SEO settings, and
`datePublished`/`dateModified` from Wagtail's real publication dates.
`BreadcrumbList` is built by walking the page's actual ancestors, so it
cannot reference a URL that does not exist (§19). `FAQPage` is emitted
only when an FAQ block is present.

Serialisation goes through one `to_json_ld()` helper that replaces `<`,
`>`, `&` with `\u003c`, `\u003e`, `\u0026` and returns a `SafeString` —
the same neutralisation Django's own `json_script` performs. §18's "do not
hand-concatenate unescaped JSON" is enforced by a test that puts
`</script>` in an article title and asserts it cannot escape the script
tag.

**Global SEO settings.** A `BaseSetting` snippet holds brand name, Persian
name, default title suffix, default meta description, default OG image,
organization logo, and the social profiles (§37) — including the
Instagram handle the 08-25 spec confirmed as `instagram.com/salyco.ir`,
which fills `Organization.sameAs` that spec noted would otherwise ship
empty.

**Honest note on FAQ rich results:** Google restricted FAQ rich results to
authoritative sites in 2023, so the `FAQPage` block may not produce one.
It is emitted because it accurately describes the page, not because it is
expected to change the SERP. Nothing is fabricated to chase a rich
result, per §18.

## 9. Sitemap and robots

Two plain Django views in `core/seo_views.py`, routed in `core/urls.py`.

**`GET /sitemap.xml`** → `application/xml`:

- `/articles/` and every `live()` `ArticlePage`, with `<lastmod>` from
  `last_published_at`
- every active `ArticleCategory` archive
- every `Mattress`, as `/products/{category}/{slug}`
- the static routes (`/`, `/products`, `/about`, `/contact`, `/dealers`)

Excluded: drafts and previews (they are not `live()`), articles with
`allow_indexing=False`, inactive categories, tag pages, and search. Every
URL is built from `SITE_URL`, so `localhost` cannot appear even in a
misconfigured environment.

Products get no `<lastmod>`, following the 08-25 spec's reasoning:
`Mattress` has no `created_at` or `updated_at`, and stamping
`timezone.now()` would tell crawlers the whole catalogue changed on every
fetch, devaluing the signal for the pages that do carry a real date.
Products are listed regardless of `is_available`, also per that spec —
an out-of-stock page still holds inbound links, and stock state belongs
in `Offer.availability`, not in the sitemap.

**`GET /robots.txt`** → `text/plain`. `Allow: /`, `Disallow: /cms/`,
`/admin/`, `/api/`, and a `Sitemap:` pointer. Served as real
`text/plain`, which it is not today.

## 10. nginx

Container nginx (`Frontend/salyco-front/nginx.conf`) gains four locations.
Each forwards `Host`, `X-Real-IP`, `X-Forwarded-For` and
`X-Forwarded-Proto` using the `$forwarded_proto` map already defined there,
so Django sees the original scheme and §4's requirement is met:

```nginx
location = /articles  { return 301 /articles/; }
location ^~ /articles/ { proxy_pass http://django; … }
location ^~ /cms/      { proxy_pass http://django; … }
location = /sitemap.xml { proxy_pass http://django; … }
location = /robots.txt  { proxy_pass http://django; … }
```

`^~` on `/articles/` and `/cms/` so the existing image-negotiation regex
locations cannot intercept them — the same reason `/api/` already uses it.
Exact matches on `/sitemap.xml` and `/robots.txt` so a future
`/sitemap-images.xml` is not silently swallowed.

The host nginx (`deploy/nginx/salyco.conf`) needs **no change**: it
already proxies everything to `127.0.0.1:8080`.

## 11. API

`/api/articles/` and `/api/articles/<slug>/` keep their current contract —
the bare array, the same field names, no pagination wrapper — so
`FeaturedArticles.jsx` and `SearchResults.jsx` need no changes at all.
Reimplemented against `ArticlePage` with
`live().public().select_related("category", "author", "hero_image")`, and
`prefetch_related("tags")` on the list, so a list request is a fixed
number of queries rather than one per article (§40).

Anonymous callers see live articles only; drafts are unreachable through
the API as well as the page (§38). §23's optional filters are Spec 3.

**One visible change, stated rather than buried:** because slugs become
Persian and images move to Wagtail's image store, the `image` field
returns a rendition URL under `/media/images/…` rather than
`/media/articles/…`, and `slug` returns the new Persian slug. Both are
served by the existing `/media/` nginx location with no change, and no
frontend file hardcodes an old slug (verified) — but consumers of this
API will see different strings than before.

## 12. Reading time

`services.py` exposes `estimate_reading_time(blocks) -> int`, counting
words across paragraph, quote, FAQ and heading text only. URLs, image alt
text and the surrounding template chrome are excluded, per §30's explicit
list. Persian averages ~200 words per minute; the result is stored on
`ArticlePage.estimated_reading_time` on save rather than recomputed per
card, so an index page showing twenty cards does not re-walk twenty
StreamFields.

The field is a plain integer with the minutes only; «۵ دقیقه مطالعه» is
rendered by the template, so the Persian phrasing lives in one place and
the number stays language-neutral.

## 13. Legacy migration

Two management commands.

**`setup_salyco_cms`** — idempotent, safe to re-run:

- ensure `SITE_ID`'s `django.contrib.sites` row matches `SITE_URL`
- create or update the Wagtail `Site` (`hostname="salyco.ir"`,
  `root_page=Root`, `is_default_site=True`)
- create the `Articles` index under `Root` — page title «مقالات», slug
  `articles` — if absent
- create the `مقالات`, `محصولات`, `عمومی` collections
- create or update the global SEO settings snippet with Salyco defaults

**`migrate_legacy_articles [--dry-run]`** — one `transaction.atomic`,
idempotent through `legacy_id`:

1. For each `articles.Article`, skip when a page with that `legacy_id`
   already exists.
2. Set the slug from `_slugmap.txt` — the already-authored Persian slugs.
3. Convert `content` (plain text) to blocks: `\n\n`-separated chunks
   become `ParagraphBlock`; a short standalone line ending in `:` becomes
   `HeadingBlock(H2)`. Every article's text is preserved — the command
   concatenates the resulting block text and **aborts that article** if it
   is shorter than the original, so a parsing bug cannot silently truncate
   someone's writing.
4. `created_at` → `first_published_at`, `updated_at` →
   `last_published_at`, `image` → a Wagtail `Image` in the «مقالات»
   collection, `is_published=False` → a draft page.
5. Create a permanent Wagtail `Redirect` from each old transliterated path
   to the new page. Direct, single-hop, per §25.
6. Pre-generate the rendition sizes the templates request, so the first
   visitor after deploy does not pay for them.
7. Print a report: total, migrated, skipped, failed, slug collisions,
   missing images — and log `legacy_id`, slug and failure reason per
   failure (§66). No passwords, tokens or session data are logged.

`--dry-run` writes nothing, and a test pins that by counting rows before
and after.

`articles.Article` is **not deleted** by this spec, and its Django admin
registration stays, so the old data remains inspectable and the old admin
remains a rollback path. Removing it is a later, explicit cleanup after
production verification, as §62 requires.

## 14. Testing

Django's test runner — `python manage.py test articles` — alongside
`mattress/tests.py`. SQLite is sufficient; nothing here is
Postgres-specific.

**Models.** An `ArticlePage` cannot be created outside the index; the
index refuses a non-article child; `max_count = 1` holds; slug uniqueness
among siblings.

**Publishing.** A draft 404s publicly; a live article 200s; an
unpublished-after-publish article 404s again.

**SEO.** `<title>`, description, canonical, robots and the OG set are
present and correct; JSON-LD parses as JSON; `datePublished`,
`dateModified` and the breadcrumb list are present; **a title containing
`</script>` cannot break out of the script tag**; no canonical, `og:url`
or sitemap entry ever contains `localhost`, `127.0.0.1` or `backend:8000`;
the title suffix is not doubled.

**HTML.** Exactly one `<h1>`; the article body is present in the raw
response with no JavaScript executed; `lang="fa"` and `dir="rtl"`.

**Redirects.** An old transliterated slug 301s to the new Persian URL in
one hop; the redirect target itself 200s.

**Sitemap and robots.** Published articles included, drafts excluded,
`allow_indexing=False` excluded, inactive categories excluded; correct
content types (`application/xml`, `text/plain`) and well-formed XML
(parsed, not regex-matched).

**API.** Published articles visible to anonymous callers, drafts hidden,
and the response is still a bare array with the same keys — a
regression guard on §23.

**Permissions.** An anonymous request to `/cms/` is redirected to login,
never served.

**Migration.** Dates preserved, the `_slugmap.txt` slug applied, a
redirect created, a second run imports nothing, and `--dry-run` mutates
nothing.

**Reading time.** A URL and an image alt text do not inflate the count.

**Frontend.** `verify-tokens.mjs` asserts `tokens.css` and the `@theme`
mapping agree.

Beyond the suite, the acceptance check §60 asks for: run the Django
server and confirm with **View Source** — not DevTools Elements — that
`<title>`, `<meta name="description">`, `<link rel="canonical">`, `<h1>`,
the body `<p>` elements and the `ld+json` script are all in the response
before any JavaScript runs. The rendered page is then inspected in a real
browser at 360, 390, 430, 768, 1024 and 1440px — `Design.md`'s QC widths
plus the two common phone widths — since this project has no frontend
test runner and a built bundle is not evidence of a correct layout.

## Scope

**In:** everything in Sections 1–14 — Wagtail 7.4.3, the page models and
snippets, the eight-block Spec-1 set, SSR templates and styling, the
editorial branding, SEO and JSON-LD, sitemap and robots, nginx, the
preserved API, reading time, the two management commands and the legacy
migration of four articles, the frontend edits, and the tests.

**Out, to Spec 2:** the Salyco-specific blocks — `ProductCardBlock`,
`ProductComparisonBlock`, `ProsConsBlock`, `TableBlock`, `GalleryBlock`,
`QuoteBlock` refinements, `VideoEmbedBlock` — and §58's product
single-source-of-truth guarantees. These all need the `Mattress` model's
specifications, features, FAQ and pro/con rows wired into block
choosers, which is a self-contained piece of work. The `Mattress`
models are not touched by this spec.

**Out, to Spec 3:** the editorial workflow and role groups (§31),
Wagtail search and `/articles/search/` (§28, §53), related articles (§29),
and the SEO quality checklist (§56). Until Spec 3, `/cms/` is staff-only
and publication is Wagtail's built-in Draft → Publish with no review step.

**Out, deliberately, with reasons:**

- **Table of contents and heading-anchor de-duplication.** `HeadingBlock`
  generates anchors because §10.A asks for them, but nothing consumes
  them yet; de-duplicating repeated headings belongs with the feature that
  renders a TOC.
- **`TIME_ZONE` → `Asia/Tehran`.** Unrelated to articles and it shifts
  every existing timestamp's presentation.
- **Deleting `articles.Article`.** §62 requires verification first.
- **The product half of `_slugmap.txt`.** Those two product slugs are
  the product work's, not this spec's.

### Definition of Done coverage

The brief's §71 lists roughly 45 conditions. This spec satisfies about
thirty. Deferred, so it is not discovered at the end:

| Deferred to | §71 conditions |
| --- | --- |
| Spec 2 | product reference block, FAQ-block product data, comparison, pros/cons, table, gallery, video |
| Spec 3 | workflow, permissions/groups, search, related articles, SEO quality indicator |

## Risks

1. **`CompressedManifestStaticFilesStorage` versus the Wagtail admin.**
   Manifest storage raises on any referenced-but-uncollected static file,
   and Wagtail's admin ships a large JS/CSS surface. This is the first
   thing to verify after install. Mitigation if it bites:
   `CompressedStaticFilesStorage`, which keeps compression and drops only
   the manifest's immutable cache-busting for admin assets.
2. **The `@theme` → `var()` refactor touches CSS that currently works.**
   It may need `@theme inline`, and the *built* CSS must be inspected to
   confirm the utilities still emit real colours. The homepage gets a
   visual check at six widths; a green build is not evidence.
3. **Wagtail 7.4 + Django 6.0** is a supported but young pairing. The
   install and a smoke test of `/cms/` come before any content work.
4. **Persian admin translation coverage.** Wagtail's core Persian is
   good but not total; any gap gets a custom Persian label via the
   supported hooks, never a fork.
5. **Scheduled publishing needs a runner.** Wagtail ships
   `python manage.py publish_scheduled` for go-live and expiry dates, and
   this project has **no Celery and no scheduler**. The fields appear on
   every page for free, but nothing publishes on a timer until the command
   is run. A host cron entry is the honest answer, and it is documented
   rather than solved with a task runner the project does not have (§33).
6. **First-request rendition cost.** Wagtail generates image renditions
   lazily, and `django-tasks`' default backend runs them synchronously, so
   the first visitor to an article pays. Mitigated by pre-generating the
   template's rendition sizes during migration.

## Deployment

```bash
docker compose up -d --build
```

A full rebuild, not a restart: `requirements.txt` changes the backend
image, and `nginx.conf` is baked into the frontend image. `entrypoint.sh`
already runs `migrate` and `collectstatic` on start, so the Wagtail
migrations and admin static are applied automatically.

Then, in this order:

```bash
docker compose exec backend python manage.py setup_salyco_cms
docker compose exec backend python manage.py migrate_legacy_articles --dry-run
docker compose exec backend python manage.py migrate_legacy_articles
```

Three verifications that cannot be done locally, because the local Vite
proxy forwards only `/api` and `/media` and there is no nginx:

1. `curl -sI https://salyco.ir/articles/` — expect `200` and
   `text/html` from Django, not the SPA shell.
2. `curl -s https://salyco.ir/robots.txt` — expect `text/plain`, not
   HTML. This is today's live defect.
3. `curl -s https://salyco.ir/sitemap.xml | head` — expect XML with
   `https://salyco.ir/` URLs and no `localhost` or `backend:8000`.

Then confirm an old slug 301s
(`curl -sI https://salyco.ir/articles/bhtrn-tsh-br-mrdrd-o-ds-mr-dm-st/`),
and paste a new article URL into Telegram to confirm the card renders
end to end.

An editor account needs `is_staff` for `/cms/` access; if the existing
Django admin account already has it, nothing further is required, and
otherwise `docker compose exec backend python manage.py createsuperuser`
creates one.

## Branch

`feat/wagtail-article-cms`, based on `master` @ `e9c80bb`.
