# Wagtail Article CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve Salyco's articles as server-rendered Django pages under `/articles/`, edited in a Wagtail CMS at `/cms/`, so the body text, headings, metadata, canonical tags and JSON-LD are in the first byte of the response.

**Architecture:** Wagtail 7.4.3 is added to the existing Django project as a CMS only. `ArticleIndexPage` and `ArticlePage` are Wagtail `Page` subclasses in the existing flat `articles` app; Django templates render them. Wagtail's `Site.root_page` stays the Wagtail `Root` page, with the index as its child, so page URLs come out as `/articles/<slug>/`. nginx routes `/articles/`, `/cms/`, `/sitemap.xml` and `/robots.txt` to Django and everything else to the React SPA, which is otherwise untouched. The legacy `articles.Article` table stays as the migration source and the rollback path.

**Tech Stack:** Django 6.0.6, DRF 3.17.1 (unchanged), Wagtail 7.4.3, PostgreSQL, Django templates, Tailwind v4 (frontend only), nginx, React 19 + Vite (unchanged apart from link changes).

**Spec:** `docs/superpowers/specs/2026-09-22-wagtail-article-cms-design.md`

## Global Constraints

- **Wagtail is pinned exactly: `wagtail==7.4.3`.** Not `>=7.4` — an unpinned floor picks up 8.0 on the next uncached install and forces a DRF upgrade.
- **Do not upgrade Django or DRF.** DRF stays at 3.17.1. No `django-ninja`, no `pydantic`.
- **Do not touch the `Mattress` models, the cart, orders, payments, users, banners, gallery or search apps.** Read them; do not migrate them.
- **Do not delete or modify `articles.Article`.** Its model, table, migration and Django admin registration all stay exactly as they are.
- **No `RawHTMLBlock`, and no arbitrary HTML or iframe block anywhere.**
- `SITE_URL` defaults to `https://salyco.ir` and is read as `(os.getenv("SITE_URL") or DEFAULT).rstrip("/")` — the `or` matters, because Docker Compose substitutes an unset variable to an empty string, and `os.getenv("SITE_URL", default)` returns `""` when the variable exists but is empty.
- **Never build a canonical URL, `og:url`, `mainEntityOfPage` or sitemap entry from the request host.** `localhost`, `127.0.0.1` and `backend:8000` must be impossible in output.
- **Block groups are exactly: متن / رسانه / ساختاری / سالیکو.**
- **Heading levels available to editors are H2 and H3 only.** No block may emit an `<h1>`; the page title is the only one.
- **Reading measure is 640px**, per `Design.md` — not the brief's suggested 720–820px.
- **Persian slugs come from `_slugmap.txt`** at the repo root. Do not invent slugs.
- **`python manage.py test articles` must pass**, and `python manage.py check` must be clean, at the end of every task.
- Every user-facing string added to the CMS or the templates is Persian.
- The frontend has **no test runner**. Verify CSS and layout changes by inspecting the built output and a real browser — a green build is not evidence.

## Note on two deliberate consolidations

The spec's template sketch lists `category_page.html` and `tag_page.html`. Both render the same thing — a heading and a paginated grid — so this plan uses one `articles/archive.html` driven by an `archive` context dict. Same for `article_card.html`, which lives at `articles/partials/article_card.html` alongside the other partials. Nothing else in the spec's file list changes.

The spec also describes `wagtailcore/root.html` returning 404 as insurance for a misconfigured proxy sending `/` to Django. A template cannot set a response status, so this plan does it with an explicit `^$` route in `core/urls.py` before the Wagtail catch-all, which is testable and does the same job.

---

### Task 1: Install Wagtail and bring up `/cms/`

**Files:**
- Modify: `Backend/requirements.txt`
- Modify: `Backend/core/settings.py`
- Modify: `Backend/core/urls.py`
- Modify: `docker-compose.yml`
- Test: `Backend/core/tests_cms.py` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `settings.SITE_URL` (str, no trailing slash). `/cms/` reachable. `wagtail.*` in `INSTALLED_APPS`. `SITE_ID = 1`.

- [x] **Step 1: Add the pin**

Append to `Backend/requirements.txt`:

```
# Article CMS. Pinned exactly: wagtail>=7.4 resolves to 8.0, which requires
# djangorestframework>=3.18 and would force an upgrade of the framework every
# existing endpoint in this project is built on. 7.4.3 is the LTS line (support
# to 2027-11-02) and needs only DRF>=3.15.1, which 3.17.1 satisfies.
wagtail==7.4.3
```

- [x] **Step 2: Install it**

Run, from `Backend/`:

```bash
python -m pip install -r requirements.txt
python -c "import wagtail, django; print(wagtail.VERSION, django.__version__)"
```

Expected: `(7, 4, 3, 'final', 0) 6.0.6`. If the second command reports a different interpreter than the one that runs `manage.py`, install again with that interpreter — this repo has both a global Python and an ignored `Backend/env/`, and mixing them produces an import error much later.

- [x] **Step 3: Write the failing test**

Create `Backend/core/tests_cms.py`:

```python
"""The CMS surface exists and is not public.

These are deliberately shallow. They answer "did the install and the settings
land" — the questions that are otherwise discovered by opening a browser — so a
broken settings edit fails here instead of in production.
"""
from django.conf import settings
from django.test import TestCase
from django.urls import reverse


class CmsSettingsTests(TestCase):
    def test_wagtail_is_installed(self):
        self.assertIn("wagtail.admin", settings.INSTALLED_APPS)
        self.assertIn("wagtail.contrib.settings", settings.INSTALLED_APPS)
        self.assertIn("django.contrib.sites", settings.INSTALLED_APPS)

    def test_site_url_has_no_trailing_slash(self):
        # Every caller concatenates a path onto this value, so a trailing slash
        # would produce "https://salyco.ir//articles/".
        self.assertTrue(settings.SITE_URL.startswith("https://"))
        self.assertFalse(settings.SITE_URL.endswith("/"))

    def test_redirect_middleware_is_installed(self):
        # Without it the legacy-slug 301s in Task 15 never fire.
        self.assertIn(
            "wagtail.contrib.redirects.middleware.RedirectMiddleware",
            settings.MIDDLEWARE,
        )

    def test_cms_requires_a_login(self):
        response = self.client.get("/cms/")
        self.assertIn(response.status_code, (301, 302))
        self.assertIn("/cms/login/", response["Location"])

    def test_existing_django_admin_still_answers(self):
        response = self.client.get("/admin/")
        self.assertIn(response.status_code, (301, 302))
        self.assertIn("/admin/login/", response["Location"])
```

- [x] **Step 4: Run it and watch it fail**

Run: `python manage.py test core.tests_cms -v 2`

Expected: FAIL — `ImportError`/`AttributeError` on `settings.SITE_URL`, and 404 on `/cms/`.

- [x] **Step 5: Wire the settings and mount the CMS at `/cms/`**

In `Backend/core/settings.py`, add `'django.contrib.sites',` to `INSTALLED_APPS` immediately after `'django.contrib.staticfiles',`, then append the Wagtail apps after `"gallery",`:

```python
    # ── Wagtail (article CMS only) ────────────────────────────────────────────
    # Wagtail is the CMS for articles, not the website: the catalogue, cart,
    # warranty and account pages stay on the existing DRF API and the React SPA.
    # See docs/superpowers/specs/2026-09-22-wagtail-article-cms-design.md.
    #
    # wagtail.contrib.forms is deliberately absent — this project has no
    # Wagtail form pages, and an unused app is an unused migration.
    #
    # "wagtail" and "modelcluster" are listed separately from the wagtail.* apps
    # because they are apps in their own right: "wagtail" provides the wagtailcore
    # models (Page, Site, Locale), so omitting it makes every wagtail.models
    # import raise "doesn't declare an explicit app_label". Verified the hard way.
    "wagtail",
    "modelcluster",
    "taggit",
    "wagtail.contrib.redirects",
    "wagtail.contrib.routable_page",
    "wagtail.contrib.settings",
    "wagtail.embeds",
    "wagtail.sites",
    "wagtail.users",
    "wagtail.snippets",
    "wagtail.documents",
    "wagtail.images",
    "wagtail.search",
    "wagtail.admin",
```

Add to `MIDDLEWARE`, after `'django.middleware.clickjacking.XFrameOptionsMiddleware',`:

```python
    # Makes an old article slug 301 to its new one. Runs on process_request,
    # before URL resolution, so a redirect is found even though no page has that
    # path any more.
    'wagtail.contrib.redirects.middleware.RedirectMiddleware',
```

Add to `TEMPLATES[0]['OPTIONS']['context_processors']`, after the messages processor:

```python
                'wagtail.contrib.settings.context_processors.settings',
```

Then add a block near the other project configuration, after `ROOT_URLCONF`:

```python
# ── Wagtail (article CMS) ─────────────────────────────────────────────────────
SITE_ID = 1

# The canonical origin for every URL the CMS or the sitemap emits. Read from the
# environment rather than from the request on purpose: host nginx → container
# nginx → gunicorn stand between Django and the client, so one wrong
# X-Forwarded-* header would otherwise put "http://backend:8000/..." into a
# canonical tag and a social card. The `or` (not a getenv default) is load
# bearing — Compose substitutes an unset variable to the empty string, and
# getenv would then return "" rather than the fallback.
SITE_URL = (os.getenv("SITE_URL") or "https://salyco.ir").rstrip("/")

WAGTAIL_SITE_NAME = "مدیریت محتوای سالیکو"
WAGTAILADMIN_BASE_URL = SITE_URL
# The update check calls wagtail.org on every admin page load. The production box
# is a small Iranian host and a slow outbound request there costs more than the
# version notice is worth.
WAGTAIL_ENABLE_UPDATE_CHECK = False
# Unauthenticated visitors to /cms/ go to the Wagtail login. This also changes
# the DRF browsable API's login link, which is harmless — same user accounts.
LOGIN_URL = "/cms/login/"
```

Then mount the CMS in `Backend/core/urls.py`. Add to the imports:

```python
from wagtail.admin import urls as wagtailadmin_urls
from wagtail.documents import urls as wagtaildocs_urls
```

and append to the end of `urlpatterns`, after the last `path("api/", include(...))`:

```python
    # ── Article CMS ───────────────────────────────────────────────────────────
    # The editorial CMS, deliberately NOT at /admin/ — that path stays Django's
    # admin, where the existing models are managed. Both resolve to the same user
    # accounts; only the surface differs.
    #
    # wagtail.documents is installed because Wagtail's admin reverses its URLs,
    # so leaving it unrouted produces NoReverseMatch on pages that merely link to
    # the document chooser.
    path("cms/", include(wagtailadmin_urls)),
    path("documents/", include(wagtaildocs_urls)),
]
```

`wagtail.urls` is deliberately **not** included here. It is the frontend
page-serving URLconf — a separate module from the admin — and its catch-all
pattern matches `^$`, so including it now would make the bare Wagtail Root page
resolve and then 500 on a missing template. It arrives in Task 9 together with
the `^$` guard that prevents exactly that.

Change the internationalization block so the CMS and the existing admin both read Persian:

```python
# Internationalization
# 'fa' rather than 'en-us': this is a Persian-first brand and both admins are
# read by Persian-speaking staff. Note this also translates the pre-existing
# Django admin — see the design doc's "Flagged" note in Section 1.
LANGUAGE_CODE = 'fa'
LANGUAGES = [
    ('fa', 'فارسی'),
    ('en', 'English'),
]
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
```

(`TIME_ZONE` stays `UTC` on purpose. Moving it to `Asia/Tehran` would shift the
presentation of every existing warranty and order timestamp, which is unrelated
to articles.)

- [x] **Step 6: Add `SITE_URL` to the compose environment**

In `docker-compose.yml`, under the `backend` service's `environment:`, after `FRONTEND_BASE_URL: ${FRONTEND_BASE_URL}`:

```yaml
      # Canonical origin for article metadata and the sitemap. Listed here for
      # the same reason as ZIBAL_MERCHANT below: this service enumerates its
      # environment explicitly, so a variable present in .env but absent from
      # this list never reaches the container. The code's fallback is correct,
      # but an explicit value is what makes the deployment self-documenting.
      SITE_URL: ${SITE_URL}
```

Add `SITE_URL=https://salyco.ir` to the repo-root `.env` (it is gitignored; do not commit it). Without the line Compose passes an empty string, which the `or` guard turns back into the default — correct, but only by accident.

- [x] **Step 7: Run the tests and the checks**

Run:

```bash
python manage.py check
python manage.py test core.tests_cms -v 2
```

Expected: `check` reports no issues; all 5 tests PASS.

- [x] **Step 8: Verify migrate and collectstatic still work**

Run:

```bash
python manage.py migrate --noinput
python manage.py collectstatic --noinput
```

Expected: both succeed. `collectstatic` is the risky one — `CompressedManifestStaticFilesStorage` raises on any static file that is referenced but not collected, and the Wagtail admin ships a large JS/CSS surface. If it raises `ValueError: The file '...' could not be found`, replace the `staticfiles` backend with `"whitenoise.storage.CompressedStaticFilesStorage"` in `STORAGES`, re-run, and note it in the commit message: compression is kept, only the manifest's immutable cache-busting for admin assets is given up.

**Observed:** `242 static files copied, 692 post-processed` — the manifest storage
handles the Wagtail admin static without complaint, so that fallback was not
needed and `STORAGES` is unchanged. Before `collectstatic` runs, Django logs
`UserWarning: No directory at: Backend\staticfiles\` from WhiteNoise; it is
harmless and disappears once the directory exists.

- [x] **Step 9: Commit**

```bash
git add Backend/requirements.txt Backend/core/settings.py Backend/core/tests_cms.py docker-compose.yml
git commit -m "feat(cms): install Wagtail 7.4.3 and serve the admin at /cms/

Pinned exactly at 7.4.3: wagtail>=7.4 resolves to 8.0, which requires
djangorestframework>=3.18 and would force an upgrade of the framework every
existing endpoint is built on. 7.4.3 is LTS and needs only DRF>=3.15.1, which
this project already satisfies, so neither Django nor DRF moves.

SITE_URL is read with 'or' rather than a getenv default because Compose
substitutes an unset variable to the empty string, and getenv would return
that empty string instead of the fallback."
```

---

### Task 2: Snippets — categories, authors, global SEO settings

**Files:**
- Create: `Backend/articles/snippets.py`
- Modify: `Backend/articles/models.py` (re-export only)
- Create: `Backend/articles/migrations/0002_*.py` (generated)
- Test: `Backend/articles/tests_snippets.py` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `ArticleCategory` (fields `name`, `slug`, `description`, `image`, `seo_title`, `seo_description`, `is_active`, `sort_order`); `ArticleAuthor` (fields `name`, `slug`, `author_type` — `"Person"` or `"Organization"` — `job_title`, `short_bio`, `avatar`, `linkedin_url`, `instagram_url`, `website_url`, `is_active`); `GlobalSeoSettings` (a `BaseSiteSetting` with `brand_name`, `brand_name_fa`, `default_title_suffix`, `default_meta_description`, `default_og_image`, `organization_logo`, `instagram_url`, `telegram_url`, `linkedin_url`, `aparat_url`).

- [x] **Step 1: Write the failing test**

Create `Backend/articles/tests_snippets.py`:

```python
from django.test import TestCase

from articles.snippets import ArticleAuthor, ArticleCategory, GlobalSeoSettings


class ArticleCategoryTests(TestCase):
    def test_slug_is_generated_from_the_persian_name(self):
        category = ArticleCategory.objects.create(name="راهنمای خرید")
        # allow_unicode keeps the slug readable in Persian rather than reducing
        # it to an empty string, which is what plain slugify() would do here.
        self.assertEqual(category.slug, "راهنمای-خرید")

    def test_an_explicit_slug_is_kept(self):
        category = ArticleCategory.objects.create(name="راهنمای خرید", slug="guide")
        self.assertEqual(category.slug, "guide")

    def test_str_is_the_name(self):
        self.assertEqual(str(ArticleCategory(name="خواب")), "خواب")


class ArticleAuthorTests(TestCase):
    def test_author_type_defaults_to_person(self):
        author = ArticleAuthor.objects.create(name="تحریریه سالیکو")
        self.assertEqual(author.author_type, "Person")

    def test_organization_is_available(self):
        # An Organization emitted in JSON-LD as a Person is a factual error in
        # structured data, so the distinction has to exist.
        author = ArticleAuthor.objects.create(
            name="تحریریه سالیکو", author_type="Organization"
        )
        self.assertEqual(author.author_type, "Organization")


class GlobalSeoSettingsTests(TestCase):
    def test_is_a_registered_setting(self):
        from wagtail.contrib.settings.registry import registry

        self.assertIn(GlobalSeoSettings, registry)
```

- [x] **Step 2: Run it and watch it fail**

Run: `python manage.py test articles.tests_snippets -v 2`

Expected: FAIL — `ModuleNotFoundError: No module named 'articles.snippets'`.

- [x] **Step 3: Write the snippets**

Create `Backend/articles/snippets.py`:

```python
"""Editorial snippets: article categories, authors, and the global SEO defaults.

All three are snippets rather than pages. None of them owns a URL in the page
tree — a category's archive is a sub-route of the articles index, so a
CategoryPage would mean every category existed twice with no rule about which
copy is authoritative. See the design doc's "Structural choices".
"""
from django.db import models
from django.utils.text import slugify
from wagtail.admin.panels import FieldPanel, MultiFieldPanel
from wagtail.contrib.settings.models import BaseSiteSetting, register_setting
from wagtail.snippets.models import register_snippet


class SluggedSnippet(models.Model):
    """A Persian display name and the slug derived from it.

    Shared so both snippets slugify the same way: `allow_unicode=True`, because
    plain slugify() turns «راهنمای خرید» into an empty string and every category
    would collide on "".
    """

    slug = models.SlugField(
        "نشانی", max_length=120, unique=True, allow_unicode=True, blank=True
    )

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name, allow_unicode=True)
        super().save(*args, **kwargs)


@register_snippet
class ArticleCategory(SluggedSnippet):
    name = models.CharField("نام", max_length=100, unique=True)
    description = models.TextField(
        "توضیح", max_length=300, blank=True,
        help_text="زیر عنوان صفحه دسته‌بندی نمایش داده می‌شود.",
    )
    image = models.ForeignKey(
        "wagtailimages.Image", verbose_name="تصویر", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    seo_title = models.CharField("عنوان سئو", max_length=70, blank=True)
    seo_description = models.CharField("توضیحات سئو", max_length=160, blank=True)
    is_active = models.BooleanField("فعال", default=True)
    sort_order = models.PositiveSmallIntegerField("ترتیب نمایش", default=0)

    panels = [
        FieldPanel("name"),
        FieldPanel("slug"),
        FieldPanel("description"),
        FieldPanel("image"),
        MultiFieldPanel(
            [FieldPanel("seo_title"), FieldPanel("seo_description")], heading="سئو"
        ),
        MultiFieldPanel(
            [FieldPanel("is_active"), FieldPanel("sort_order")], heading="نمایش"
        ),
    ]

    search_fields = ["name", "description"]

    class Meta:
        verbose_name = "دسته‌بندی مقاله"
        verbose_name_plural = "دسته‌بندی‌های مقاله"
        ordering = ["sort_order", "name"]

    def __str__(self):
        return self.name


@register_snippet
class ArticleAuthor(SluggedSnippet):
    AUTHOR_TYPE_CHOICES = [
        ("Person", "شخص"),
        ("Organization", "سازمان / تحریریه"),
    ]

    name = models.CharField("نام", max_length=120, unique=True)
    author_type = models.CharField(
        "نوع", max_length=20, choices=AUTHOR_TYPE_CHOICES, default="Person",
        help_text="مشخص می‌کند در داده‌های ساختاریافته به‌عنوان شخص معرفی شود یا سازمان.",
    )
    job_title = models.CharField("سمت", max_length=120, blank=True)
    short_bio = models.TextField("معرفی کوتاه", max_length=400, blank=True)
    avatar = models.ForeignKey(
        "wagtailimages.Image", verbose_name="تصویر", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    linkedin_url = models.URLField("لینکدین", blank=True)
    instagram_url = models.URLField("اینستاگرام", blank=True)
    website_url = models.URLField("وب‌سایت", blank=True)
    is_active = models.BooleanField("فعال", default=True)

    panels = [
        FieldPanel("name"),
        FieldPanel("slug"),
        FieldPanel("author_type"),
        FieldPanel("job_title"),
        FieldPanel("short_bio"),
        FieldPanel("avatar"),
        MultiFieldPanel(
            [
                FieldPanel("linkedin_url"),
                FieldPanel("instagram_url"),
                FieldPanel("website_url"),
            ],
            heading="شبکه‌های اجتماعی",
        ),
        FieldPanel("is_active"),
    ]

    search_fields = ["name", "job_title"]

    class Meta:
        verbose_name = "نویسنده"
        verbose_name_plural = "نویسندگان"
        ordering = ["name"]

    def __str__(self):
        return self.name


@register_setting(icon="cog")
class GlobalSeoSettings(BaseSiteSetting):
    """Site-wide values the article metadata falls back to.

    The same Instagram handle the SEO design spec confirmed as
    instagram.com/salyco.ir lives here, which is what fills Organization.sameAs
    that spec noted would otherwise ship empty.
    """

    brand_name = models.CharField("نام برند", max_length=80, default="Salyco")
    brand_name_fa = models.CharField("نام برند (فارسی)", max_length=80, default="سالیکو")
    default_title_suffix = models.CharField(
        "پسوند پیش‌فرض عنوان", max_length=40, default="سالیکو",
        help_text="به انتهای عنوان صفحه‌هایی که عنوان سئوی اختصاصی ندارند اضافه می‌شود.",
    )
    default_meta_description = models.CharField(
        "توضیحات پیش‌فرض", max_length=160, blank=True
    )
    default_og_image = models.ForeignKey(
        "wagtailimages.Image", verbose_name="تصویر پیش‌فرض اشتراک‌گذاری",
        null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
    )
    organization_logo = models.ForeignKey(
        "wagtailimages.Image", verbose_name="لوگوی سازمان", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    instagram_url = models.URLField("اینستاگرام", blank=True)
    telegram_url = models.URLField("تلگرام", blank=True)
    linkedin_url = models.URLField("لینکدین", blank=True)
    aparat_url = models.URLField("آپارات", blank=True)

    panels = [
        MultiFieldPanel(
            [
                FieldPanel("brand_name"),
                FieldPanel("brand_name_fa"),
                FieldPanel("default_title_suffix"),
                FieldPanel("default_meta_description"),
            ],
            heading="برند",
        ),
        MultiFieldPanel(
            [FieldPanel("default_og_image"), FieldPanel("organization_logo")],
            heading="تصاویر",
        ),
        MultiFieldPanel(
            [
                FieldPanel("instagram_url"),
                FieldPanel("telegram_url"),
                FieldPanel("linkedin_url"),
                FieldPanel("aparat_url"),
            ],
            heading="شبکه‌های اجتماعی",
        ),
    ]

    class Meta:
        verbose_name = "تنظیمات سئو"
        verbose_name_plural = "تنظیمات سئو"
```

- [x] **Step 4: Register the snippets with the app and migrate**

`makemigrations` will report **"No changes detected in app 'articles'"** until
`models.py` imports the new module. Django's autodetector only sees models
reachable from the app's `models` module, so a snippet in a module nothing
imports is not part of the app at all — no table, no admin registration, no
error. Add to the top of `Backend/articles/models.py`, above the existing
`Article` class:

```python
# Re-exported so Django's app registry sees them. Snippets live in their own
# module to keep this file readable, but a model in a module that models.py never
# imports is not part of the app at all: makemigrations reports "No changes
# detected" and the tables are never created. The dependency runs one way only —
# snippets.py imports nothing from here.
from .snippets import ArticleAuthor, ArticleCategory, GlobalSeoSettings  # noqa: F401
```

Then generate and apply the migration:

```bash
python manage.py makemigrations articles
python manage.py migrate
```

Expected: `0002_articleauthor_articlecategory_globalseosettings.py`, creating the
three models. Do not rename it. A second `makemigrations` must report no changes.

- [x] **Step 5: Run the tests**

Run: `python manage.py test articles.tests_snippets -v 2`

Expected: PASS (6 tests).

**Observed:** `Ran 6 tests in 0.009s / OK`, and
`slugify("راهنمای خرید", allow_unicode=True) == "راهنمای-خرید"` held. The first
run of this suite produced four `no such table: articles_articlecategory` errors
from `django.db.utils.OperationalError` — that is what a missing migration looks
like from inside a test, and it is the failure Step 4 prevents.

- [x] **Step 6: Commit**

```bash
git add Backend/articles/snippets.py Backend/articles/tests_snippets.py \
        Backend/articles/models.py Backend/articles/migrations/0002_articleauthor_articlecategory_globalseosettings.py
git commit -m "feat(cms): article category, author and global SEO snippets

Slugs are generated with allow_unicode=True: plain slugify() reduces
«راهنمای خرید» to an empty string, which would collide every Persian
category onto the same slug.

models.py re-exports the three models. A model in a module that models.py
never imports is invisible to Django's app registry — makemigrations
reports 'No changes detected' and no table is ever created, with no error
to explain why."
```

---

### Task 3: StreamField blocks and their templates

**Files:**
- Create: `Backend/articles/blocks.py`
- Create: `Backend/articles/templates/articles/blocks/{heading,paragraph,quote,image,callout,faq,cta}.html`
- Test: `Backend/articles/tests_blocks.py` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `BodyBlock` (a `StreamBlock` whose child attribute names are the stored block type names: `heading`, `paragraph`, `quote`, `image`, `callout`, `faq`, `cta`). `ArticleLinkBlock` (fields `page`, `url`, `label`). Each block declares `Meta.template`, so `{% include_block block %}` renders it with no dispatch chain in the page template.

- [ ] **Step 1: Write the failing test**

Create `Backend/articles/tests_blocks.py`:

```python
from django.core.exceptions import ValidationError
from django.test import TestCase
from wagtail.blocks import StreamValue

from articles.blocks import ArticleLinkBlock, BodyBlock, HeadingBlock, ParagraphBlock


class HeadingBlockTests(TestCase):
    def test_h1_is_not_an_available_level(self):
        # The page title is the only h1 on the page. A choice that must never be
        # taken should not be offered, rather than validated against later.
        choices = dict(HeadingBlock().child_blocks["level"].field.choices)
        self.assertEqual(sorted(choices), ["h2", "h3"])


class ParagraphBlockTests(TestCase):
    def test_heading_features_are_not_available(self):
        # Without this, an editor can produce an <h2> inside a paragraph and
        # break the document outline the HeadingBlock exists to control.
        features = ParagraphBlock().features
        self.assertNotIn("h2", features)
        self.assertNotIn("h3", features)
        self.assertNotIn("h4", features)

    def test_inline_emphasis_and_links_are_available(self):
        features = ParagraphBlock().features
        for feature in ("bold", "italic", "link", "ol", "ul", "blockquote"):
            self.assertIn(feature, features)


class ArticleLinkBlockTests(TestCase):
    def test_a_block_with_neither_target_is_rejected(self):
        with self.assertRaises(ValidationError):
            ArticleLinkBlock().clean({"page": None, "url": "", "label": "بیشتر"})

    def test_a_block_with_both_targets_is_rejected(self):
        # Both set is ambiguous: the template would silently prefer one and the
        # editor would never learn which.
        with self.assertRaises(ValidationError):
            ArticleLinkBlock().clean(
                {"page": 1, "url": "https://example.com", "label": "بیشتر"}
            )

    def test_a_page_target_is_accepted(self):
        value = ArticleLinkBlock().clean({"page": 1, "url": "", "label": "بیشتر"})
        self.assertEqual(value["page"], 1)


class BodyBlockTests(TestCase):
    def test_the_declared_block_types_are_the_stored_names(self):
        # These strings are what the migration writes and what block_text()
        # dispatches on, so they are an interface, not an implementation detail.
        self.assertEqual(
            sorted(BodyBlock().child_blocks),
            ["callout", "cta", "faq", "heading", "image", "paragraph", "quote"],
        )

    def test_no_raw_html_block_exists(self):
        for name, block in BodyBlock().child_blocks.items():
            self.assertNotEqual(
                type(block).__name__, "RawHTMLBlock", f"{name} is a RawHTMLBlock"
            )
```

- [ ] **Step 2: Run it and watch it fail**

Run: `python manage.py test articles.tests_blocks -v 2`

Expected: FAIL — `ModuleNotFoundError: No module named 'articles.blocks'`.

- [ ] **Step 3: Write the blocks**

Create `Backend/articles/blocks.py`:

```python
"""StreamField blocks for article bodies.

Grouped the way an editor scans a menu — متن / رسانه / ساختاری / سالیکو — rather
than as one flat list of twenty entries.

There is deliberately no RawHTMLBlock and no arbitrary iframe block: structure
is expressed with named blocks, so an editor never has to write markup to get a
layout, and nothing an editor types can become executable markup on the page.
"""
from django.core.exceptions import ValidationError
from django.forms.utils import ErrorList
from wagtail import blocks
from wagtail.images.blocks import ImageChooserBlock


class HeadingBlock(blocks.StructBlock):
    text = blocks.CharBlock(label="متن عنوان")
    level = blocks.ChoiceBlock(
        choices=[("h2", "H2"), ("h3", "H3")],
        default="h2",
        label="سطح عنوان",
        help_text="H1 فقط برای عنوان خود مقاله است.",
    )
    anchor_id = blocks.CharBlock(
        required=False,
        label="شناسه لنگر",
        help_text="برای پیوند مستقیم به این بخش. خالی بگذارید تا از متن ساخته شود.",
    )

    class Meta:
        label = "عنوان"
        icon = "title"
        group = "متن"
        template = "articles/blocks/heading.html"


class ParagraphBlock(blocks.RichTextBlock):
    """Body copy, with the feature list as the whole point.

    No heading features: hierarchy comes from HeadingBlock alone, so a paragraph
    cannot smuggle in an <h2> and break the document outline.
    """

    def __init__(self, **kwargs):
        kwargs.setdefault(
            "features", ["bold", "italic", "link", "ol", "ul", "blockquote"]
        )
        super().__init__(**kwargs)

    class Meta:
        label = "پاراگراف"
        icon = "pilcrow"
        group = "متن"
        template = "articles/blocks/paragraph.html"


class QuoteBlock(blocks.StructBlock):
    quote = blocks.TextBlock(label="متن نقل‌قول")
    source_name = blocks.CharBlock(required=False, label="نام گوینده")
    source_title = blocks.CharBlock(required=False, label="سمت یا منبع")
    source_url = blocks.URLBlock(required=False, label="نشانی منبع")

    class Meta:
        label = "نقل‌قول"
        icon = "openquote"
        group = "متن"
        template = "articles/blocks/quote.html"


class ImageBlock(blocks.StructBlock):
    image = ImageChooserBlock(label="تصویر")
    alt_text = blocks.CharBlock(
        required=False,
        label="متن جایگزین",
        help_text="توضیح تصویر برای صفحه‌خوان‌ها و موتورهای جست‌وجو.",
    )
    decorative = blocks.BooleanBlock(
        required=False,
        label="تصویر تزئینی است",
        help_text="اگر تصویر فقط تزئینی است، متن جایگزین لازم نیست.",
    )
    caption = blocks.CharBlock(required=False, label="توضیح زیر تصویر")
    credit = blocks.CharBlock(required=False, label="عکس از")

    def clean(self, value):
        result = super().clean(value)
        # An image with neither alt text nor a decorative flag is the single most
        # common accessibility defect in editorial content, and the editor is the
        # only person who can fix it — so it is refused at the point of entry.
        if value.get("image") and not value.get("decorative") and not value.get("alt_text"):
            raise ValidationError(
                "متن جایگزین را وارد کنید یا تصویر را تزئینی علامت بزنید.",
                params={"alt_text": ErrorList(["این فیلد الزامی است."])},
            )
        return result

    class Meta:
        label = "تصویر"
        icon = "image"
        group = "رسانه"
        template = "articles/blocks/image.html"


class CalloutBlock(blocks.StructBlock):
    VARIANT_CHOICES = [
        ("info", "اطلاعات"),
        ("tip", "نکته"),
        ("warning", "هشدار"),
        ("important", "مهم"),
    ]

    variant = blocks.ChoiceBlock(
        choices=VARIANT_CHOICES, default="info", label="نوع"
    )
    title = blocks.CharBlock(required=False, label="عنوان")
    content = blocks.TextBlock(label="متن")

    class Meta:
        label = "کادر تأکید"
        icon = "warning"
        group = "ساختاری"
        template = "articles/blocks/callout.html"


class FAQItemBlock(blocks.StructBlock):
    question = blocks.CharBlock(label="پرسش")
    answer = blocks.TextBlock(label="پاسخ")

    class Meta:
        label = "پرسش و پاسخ"
        icon = "help"


class FAQBlock(blocks.StructBlock):
    items = blocks.ListBlock(FAQItemBlock(), min_num=1, label="پرسش‌ها")

    class Meta:
        label = "پرسش‌های متداول"
        icon = "help"
        group = "ساختاری"
        template = "articles/blocks/faq.html"


class ArticleLinkBlock(blocks.StructBlock):
    """A link to a page or an external URL, never a hardcoded domain.

    A page chooser stores a page id and Wagtail resolves it to a relative URL at
    render time, so the link survives a slug change. A pasted absolute URL would
    not — and would also put a domain in the content that a staging deploy would
    then serve.
    """

    page = blocks.PageChooserBlock(required=False, label="صفحه داخلی")
    url = blocks.URLBlock(required=False, label="نشانی بیرونی")
    label = blocks.CharBlock(label="متن پیوند")

    def clean(self, value):
        result = super().clean(value)
        has_page = bool(value.get("page"))
        has_url = bool(value.get("url"))
        if has_page == has_url:
            message = (
                "دقیقاً یکی از «صفحه داخلی» یا «نشانی بیرونی» را پر کنید."
            )
            raise ValidationError(
                message,
                params={
                    "page": ErrorList([message]),
                    "url": ErrorList([message]),
                },
            )
        return result

    class Meta:
        label = "پیوند"
        icon = "link"


class CTABlock(blocks.StructBlock):
    VARIANT_CHOICES = [
        ("primary", "اصلی"),
        ("soft", "ملایم"),
        ("product", "محصول"),
        ("contact", "تماس"),
    ]

    eyebrow = blocks.CharBlock(required=False, label="پیش‌عنوان")
    title = blocks.CharBlock(label="عنوان")
    description = blocks.TextBlock(required=False, label="توضیح")
    link = ArticleLinkBlock(label="پیوند")
    variant = blocks.ChoiceBlock(
        choices=VARIANT_CHOICES, default="primary", label="نوع"
    )

    class Meta:
        label = "فراخوان"
        icon = "plus"
        group = "سالیکو"
        template = "articles/blocks/cta.html"


class BodyBlock(blocks.StreamBlock):
    """The article body.

    The attribute names below — not the class names — are what is stored in the
    `body` JSON and what block_text() dispatches on.
    """

    heading = HeadingBlock()
    paragraph = ParagraphBlock()
    quote = QuoteBlock()

    image = ImageBlock()

    callout = CalloutBlock()
    faq = FAQBlock()

    cta = CTABlock()

    class Meta:
        label = "متن مقاله"
```

- [ ] **Step 4: Write the block templates**

Create `Backend/articles/templates/articles/blocks/heading.html`:

```html
{% load article_tags %}
{% with anchor=value.anchor_id|default:value.text|heading_anchor %}
  <{{ value.level }} id="{{ anchor }}" class="article-body__heading article-body__heading--{{ value.level }}">
    {{ value.text }}
  </{{ value.level }}>
{% endwith %}
```

Create `Backend/articles/templates/articles/blocks/paragraph.html`:

```html
<div class="article-body__paragraph">{{ value }}</div>
```

Create `Backend/articles/templates/articles/blocks/quote.html`:

```html
<figure class="article-quote">
  <blockquote class="article-quote__text">
    {{ value.quote }}
  </blockquote>
  {% if value.source_name %}
    <figcaption class="article-quote__source">
      {% if value.source_url %}<a href="{{ value.source_url }}" rel="nofollow noopener" target="_blank">{% endif %}
      {{ value.source_name }}{% if value.source_title %}، {{ value.source_title }}{% endif %}
      {% if value.source_url %}</a>{% endif %}
    </figcaption>
  {% endif %}
</figure>
```

Create `Backend/articles/templates/articles/blocks/image.html`:

```html
{% load wagtailimages_tags %}
<figure class="article-figure">
  {% if value.decorative %}
    {% image value.image width-1200 class="article-figure__img" alt="" %}
  {% else %}
    {% image value.image width-1200 class="article-figure__img" alt=value.alt_text %}
  {% endif %}
  {% if value.caption or value.credit %}
    <figcaption class="article-figure__caption">
      {{ value.caption }}{% if value.credit %} <span class="article-figure__credit">{{ value.credit }}</span>{% endif %}
    </figcaption>
  {% endif %}
</figure>
```

Create `Backend/articles/templates/articles/blocks/callout.html`:

```html
<aside class="article-callout article-callout--{{ value.variant }}">
  {% if value.title %}<p class="article-callout__title">{{ value.title }}</p>{% endif %}
  <p class="article-callout__body">{{ value.content }}</p>
</aside>
```

Create `Backend/articles/templates/articles/blocks/faq.html`:

```html
{# <details> rather than a scripted accordion: it is keyboard accessible for
   free, and the answers are in the served HTML, so a crawler and a reader with
   JavaScript off get the same content a browser does. #}
<section class="article-faq">
  <h2 class="article-faq__heading">پرسش‌های متداول</h2>
  {% for item in value.items %}
    <details class="article-faq__item">
      <summary class="article-faq__question">{{ item.question }}</summary>
      <p class="article-faq__answer">{{ item.answer }}</p>
    </details>
  {% endfor %}
</section>
```

Create `Backend/articles/templates/articles/blocks/cta.html`:

```html
{% load article_tags %}
<aside class="article-cta article-cta--{{ value.variant }}">
  {% if value.eyebrow %}<p class="article-cta__eyebrow">{{ value.eyebrow }}</p>{% endif %}
  <p class="article-cta__title">{{ value.title }}</p>
  {% if value.description %}<p class="article-cta__description">{{ value.description }}</p>{% endif %}
  <a class="article-cta__link" href="{% link_href value.link %}">{{ value.link.label }}</a>
</aside>
```

- [ ] **Step 5: Write the `article_tags` template tag module**

Create `Backend/articles/templatetags/__init__.py` (empty file).

Create `Backend/articles/templatetags/article_tags.py`:

```python
"""Template helpers for the article pages."""
import json

from django import template
from django.utils.safestring import mark_safe
from django.utils.text import slugify

register = template.Library()


@register.filter
def heading_anchor(text):
    """A usable fragment id for a Persian heading.

    allow_unicode keeps the id readable instead of stripping every character and
    leaving an empty string, which would give every heading on the page the same
    (empty) id.
    """
    return slugify(text or "", allow_unicode=True)


@register.simple_tag
def link_href(link):
    """The href for an ArticleLinkBlock value.

    A page target is resolved through the page tree, so the link keeps working
    after a slug change; only a genuinely external target is used verbatim.
    """
    page = link.get("page")
    if page is not None:
        return page.get_url()
    return link.get("url") or ""


@register.simple_tag
def json_ld_script(data):
    """Serialise a JSON-LD dict into a script tag that cannot be broken out of.

    json.dumps leaves "<", ">" and "&" as literal characters, so a title
    containing "</script>" would close the tag early and everything after it
    would be parsed as markup. Escaping them to \\u003c, \\u003e and \\u0026 is
    exactly what Django's own json_script filter does; it is invisible to any
    JSON parser, so the structured data a crawler reads is unchanged.
    """
    if not data:
        return ""
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    for char, escaped in (("<", "\\u003c"), (">", "\\u003e"), ("&", "\\u0026")):
        raw = raw.replace(char, escaped)
    return mark_safe(f'<script type="application/ld+json">{raw}</script>')
```

- [ ] **Step 6: Run the block tests**

Run: `python manage.py test articles.tests_blocks -v 2`

Expected: PASS (8 tests).

- [ ] **Step 7: Commit**

```bash
git add Backend/articles/blocks.py Backend/articles/templates/articles/blocks Backend/articles/templatetags Backend/articles/tests_blocks.py
git commit -m "feat(cms): article StreamField blocks, grouped and with no raw HTML

Heading levels are H2 and H3 only and ParagraphBlock has no heading features,
so nothing but the page title can emit an h1. ImageBlock refuses to save an
image with neither alt text nor a decorative flag.

json_ld_script escapes <, > and & the way Django's own json_script does, so a
title containing </script> cannot break out of the structured-data tag."
```

---

### Task 4: Page models and migrations

**Files:**
- Modify: `Backend/articles/models.py`
- Create: `Backend/articles/migrations/0002_articlepages.py` (generated)
- Test: `Backend/articles/tests_pages.py` (create)

**Interfaces:**
- Consumes: `BodyBlock` (Task 3), `ArticleCategory` / `ArticleAuthor` (Task 2).
- Produces: `ArticleIndexPage` (fields `intro`, `hero_title`, `hero_description`, `featured_article`, `featured_categories`; methods `published_articles()`, `paginate(request, queryset)`; `route()` methods for `category/<slug>/` and `tag/<slug>/`, added in Task 8) and `ArticlePage` (fields `subtitle`, `excerpt`, `hero_image`, `hero_image_alt`, `category`, `author`, `tags`, `body`, `is_featured`, `featured_order`, `estimated_reading_time`, `legacy_id`, `canonical_url_override`, `allow_indexing`, `allow_following`, `og_title`, `og_description`, `og_image`; properties `category_archive_url`, `tag_archive_url`). `ArticlePageTag` is the taggit through model. `ARTICLES_PER_PAGE = 12`.

- [ ] **Step 1: Write the failing test**

Create `Backend/articles/tests_pages.py`:

```python
from django.core.exceptions import ValidationError
from django.test import TestCase
from wagtail.models import Page, Site

from articles.models import ArticleIndexPage, ArticlePage
from articles.snippets import ArticleAuthor, ArticleCategory


def make_index():
    """The index under the real Wagtail root, the way the site is arranged.

    Built here rather than through setup_salyco_cms so each test controls its own
    tree and a bug in the management command cannot make the model tests pass.
    """
    root = Page.objects.get(depth=1)
    index = ArticleIndexPage(title="مقالات", slug="articles")
    root.add_child(instance=index)
    return index


def make_article(index, **kwargs):
    defaults = {
        "title": "راهنمای انتخاب تشک",
        "slug": "rahnama",
        "excerpt": "چگونه تشک مناسب را انتخاب کنیم.",
        "body": [],
    }
    defaults.update(kwargs)
    article = ArticlePage(**defaults)
    index.add_child(instance=article)
    return article


class PageTreeTests(TestCase):
    def test_an_article_cannot_live_outside_the_index(self):
        root = Page.objects.get(depth=1)
        with self.assertRaises(ValidationError):
            root.add_child(instance=ArticlePage(title="x", slug="x", excerpt="y"))

    def test_the_index_refuses_a_non_article_child(self):
        index = make_index()
        with self.assertRaises(ValidationError):
            index.add_child(instance=Page(title="other", slug="other"))

    def test_only_one_index_can_exist(self):
        make_index()
        with self.assertRaises(ValidationError):
            Page.objects.get(depth=1).add_child(
                instance=ArticleIndexPage(title="again", slug="articles-2")
            )

    def test_the_index_parent_type_is_the_wagtail_root(self):
        self.assertEqual(ArticleIndexPage.parent_page_types, ["wagtailcore.Page"])

    def test_an_article_has_a_subpage_of_nothing(self):
        self.assertEqual(ArticlePage.subpage_types, [])


class ArticleUrlTests(TestCase):
    def test_the_index_url_is_prefixed_with_its_slug(self):
        # This is the whole reason Site.root_page stays the Wagtail Root: if the
        # index were the site root its own URL would be "/" and every article
        # would sit at "/<slug>/", and every canonical tag would be wrong.
        index = make_index()
        self.assertEqual(index.get_url(), "/articles/")

    def test_an_article_url_sits_under_the_index(self):
        index = make_index()
        article = make_article(index)
        self.assertEqual(article.get_url(), "/articles/rahnama/")

    def test_the_default_site_uses_the_canonical_hostname(self):
        from urllib.parse import urlparse

        from django.conf import settings

        site = Site.objects.get(is_default_site=True)
        self.assertEqual(site.hostname, urlparse(settings.SITE_URL).hostname)
```

That last test needs a site to exist, and no site does until Task 14 runs
`setup_salyco_cms`. Decorate it for now and remove the decorator in Task 14:

```python
from unittest import skip

    @skip("site created by setup_salyco_cms in Task 14")
    def test_the_default_site_uses_the_canonical_hostname(self):
```

- [ ] **Step 2: Run it and watch it fail**

Run: `python manage.py test articles.tests_pages -v 2`

Expected: FAIL — `ImportError: cannot import name 'ArticleIndexPage'`.

- [ ] **Step 3: Write the page models**

Append to `Backend/articles/models.py` (leaving the existing `Article` class and its imports untouched; add the new imports at the top of the file):

```python
from urllib.parse import urlparse

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from modelcluster.contrib.taggit import ClusterTaggableManager
from modelcluster.fields import ParentalKey, ParentalManyToManyField
from taggit.models import TaggedItemBase
from wagtail.admin.panels import FieldPanel, MultiFieldPanel, ObjectList, TabbedInterface
from wagtail.fields import RichTextField, StreamField
from wagtail.models import Page

from .blocks import BodyBlock
from .services import estimate_reading_time
from .snippets import ArticleAuthor, ArticleCategory

ARTICLES_PER_PAGE = 12

# Hosts that must never appear in a canonical URL, an og:url or a sitemap entry.
# The design doc's §68 failure mode is an environment detail leaking into a
# public document; catching it here means the editor is told while typing rather
# than a crawler finding it weeks later.
_BLOCKED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "backend", "web", "django"}


def is_public_url(value: str) -> bool:
    parsed = urlparse(value or "")
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return False
    host = (parsed.hostname or "").lower()
    if host in _BLOCKED_HOSTS or host.startswith(("192.168.", "10.", "172.16.")):
        return False
    return "." in host


class ArticlePageTag(TaggedItemBase):
    content_object = ParentalKey(
        "articles.ArticlePage", on_delete=models.CASCADE, related_name="tagged_items"
    )


class ArticleIndexPage(Page):
    """The one page articles live under, at /articles/.

    Carries the category and tag archives as sub-routes rather than as page
    types, so a category exists once as a snippet and once as a URL rather than
    twice as a record with no rule about which copy is authoritative.
    """

    template = "articles/article_index_page.html"
    parent_page_types = ["wagtailcore.Page"]
    subpage_types = ["articles.ArticlePage"]
    max_count = 1

    intro = models.CharField("معرفی", max_length=300, blank=True)
    hero_title = models.CharField("عنوان سرصفحه", max_length=120, blank=True)
    hero_description = models.TextField("توضیح سرصفحه", max_length=300, blank=True)
    featured_article = models.ForeignKey(
        "articles.ArticlePage", verbose_name="مقاله ویژه", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    featured_categories = ParentalManyToManyField(
        ArticleCategory, verbose_name="دسته‌بندی‌های منتخب", blank=True
    )

    content_panels = Page.content_panels + [
        FieldPanel("hero_title"),
        FieldPanel("hero_description"),
        FieldPanel("intro"),
        FieldPanel("featured_article"),
        FieldPanel("featured_categories"),
    ]

    class Meta:
        verbose_name = "فهرست مقالات"

    def published_articles(self):
        """Live articles under this index, newest first, with their joins done.

        select_related here is what keeps an index page at a fixed number of
        queries instead of one per card.
        """
        return (
            ArticlePage.objects.live()
            .public()
            .child_of(self)
            .select_related("category", "author", "hero_image")
            .order_by("-first_published_at", "-id")
        )

    def paginate(self, request, queryset):
        from django.core.paginator import Paginator

        return Paginator(queryset, ARTICLES_PER_PAGE).get_page(request.GET.get("page"))

    def get_context(self, request, *args, **kwargs):
        from .seo import breadcrumb_json_ld, page_meta_context

        context = super().get_context(request, *args, **kwargs)
        context.update(page_meta_context(self, request))
        context["json_ld"] = [breadcrumb_json_ld(self)]
        return context


class ArticlePage(Page):
    template = "articles/article_page.html"
    parent_page_types = ["articles.ArticleIndexPage"]
    subpage_types = []

    subtitle = models.CharField("زیرعنوان", max_length=255, blank=True)
    excerpt = models.TextField("خلاصه", max_length=500)
    hero_image = models.ForeignKey(
        "wagtailimages.Image", verbose_name="تصویر شاخص", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    hero_image_alt = models.CharField("متن جایگزین تصویر شاخص", max_length=255, blank=True)
    category = models.ForeignKey(
        ArticleCategory, verbose_name="دسته‌بندی", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="articles",
    )
    author = models.ForeignKey(
        ArticleAuthor, verbose_name="نویسنده", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="articles",
    )
    tags = ClusterTaggableManager(
        through=ArticlePageTag, blank=True, verbose_name="برچسب‌ها"
    )
    body = StreamField(BodyBlock(), verbose_name="متن مقاله")

    is_featured = models.BooleanField("ویژه", default=False)
    featured_order = models.PositiveSmallIntegerField("ترتیب ویژه", default=0)
    estimated_reading_time = models.PositiveSmallIntegerField(
        "زمان مطالعه (دقیقه)", default=1, editable=False
    )
    legacy_id = models.PositiveIntegerField(
        "شناسه مقاله قدیمی", null=True, blank=True, unique=True, editable=False,
        help_text="ردیابی مقاله‌های منتقل‌شده از جدول قدیمی.",
    )

    # ── SEO ──
    canonical_url_override = models.URLField(
        "نشانی کانونیکال جایگزین", max_length=500, blank=True,
        help_text="فقط اگر این مقاله جای دیگری منتشر شده است.",
    )
    allow_indexing = models.BooleanField("اجازه ایندکس شدن", default=True)
    allow_following = models.BooleanField("اجازه دنبال کردن پیوندها", default=True)
    og_title = models.CharField("عنوان اشتراک‌گذاری", max_length=120, blank=True)
    og_description = models.CharField("توضیحات اشتراک‌گذاری", max_length=200, blank=True)
    og_image = models.ForeignKey(
        "wagtailimages.Image", verbose_name="تصویر اشتراک‌گذاری", null=True,
        blank=True, on_delete=models.SET_NULL, related_name="+",
    )

    content_panels = Page.content_panels + [
        FieldPanel("subtitle"),
        FieldPanel("excerpt"),
        FieldPanel("category"),
        FieldPanel("author"),
        FieldPanel("tags"),
        MultiFieldPanel(
            [FieldPanel("hero_image"), FieldPanel("hero_image_alt")], heading="تصویر شاخص"
        ),
        FieldPanel("body"),
    ]

    promote_panels = Page.promote_panels + [
        MultiFieldPanel(
            [
                FieldPanel("canonical_url_override"),
                FieldPanel("allow_indexing"),
                FieldPanel("allow_following"),
            ],
            heading="ایندکس و نشانی",
        ),
        MultiFieldPanel(
            [
                FieldPanel("og_title"),
                FieldPanel("og_description"),
                FieldPanel("og_image"),
            ],
            heading="شبکه‌های اجتماعی",
        ),
    ]

    settings_panels = Page.settings_panels + [
        MultiFieldPanel(
            [FieldPanel("is_featured"), FieldPanel("featured_order")], heading="نمایش"
        ),
    ]

    edit_handler = TabbedInterface(
        [
            ObjectList(content_panels, heading="محتوا"),
            ObjectList(promote_panels, heading="سئو"),
            ObjectList(settings_panels, heading="تنظیمات"),
        ]
    )

    class Meta:
        verbose_name = "مقاله"

    def clean(self):
        super().clean()
        errors = {}
        if self.live and not (self.excerpt or "").strip():
            errors["excerpt"] = "برای انتشار مقاله، خلاصه الزامی است."
        override = (self.canonical_url_override or "").strip()
        if override and not is_public_url(override):
            errors["canonical_url_override"] = (
                "نشانی باید کامل و با https:// آغاز شود و نمی‌تواند به "
                "localhost یا شبکه داخلی اشاره کند."
            )
        if errors:
            raise ValidationError({field: [message] for field, message in errors.items()})

    def save(self, *args, **kwargs):
        # Recomputed on save rather than in a signal so a body edited through the
        # admin, a management command or a data migration all get the same
        # number. Stored rather than computed per card, so an index page showing
        # twelve articles does not walk twelve StreamFields.
        self.estimated_reading_time = estimate_reading_time(self.body)
        super().save(*args, **kwargs)

    @property
    def category_archive_url(self):
        if self.category_id is None:
            return ""
        return f"{self.get_parent().get_url()}category/{self.category.slug}/"

    @property
    def tag_archive_url_base(self):
        return f"{self.get_parent().get_url()}tag/"

    def get_context(self, request, *args, **kwargs):
        from .seo import (
            article_json_ld,
            breadcrumb_json_ld,
            faq_json_ld,
            page_meta_context,
        )

        context = super().get_context(request, *args, **kwargs)
        context.update(page_meta_context(self, request))
        # One list so the template has a single loop; each entry becomes its own
        # <script type="application/ld+json"> tag.
        context["json_ld"] = [
            block
            for block in (
                article_json_ld(self, request),
                breadcrumb_json_ld(self),
                faq_json_ld(self),
            )
            if block
        ]
        return context
```

Delete the now-duplicated `from django.db import models` line that already exists at the top of the file — keep one. `RichTextField` is imported but unused; remove it from the import list.

- [ ] **Step 4: Generate and apply the migrations**

Run:

```bash
python manage.py makemigrations articles
python manage.py migrate
```

Expected: a new `articles/migrations/0002_*.py` (the autodetector names it; do not rename it) plus migrations for `taggit`, `wagtailcore`, `wagtailimages`, `wagtaildocs`, `wagtailredirects`, `wagtailsites`, `wagtailusers`, `wagtailforms`-adjacent apps and `django.contrib.sites`. `makemigrations` must report no missing migrations when run a second time.

- [ ] **Step 5: Run the page tests**

Run: `python manage.py test articles.tests_pages -v 2`

Expected: PASS (8 tests, 1 skipped). The skip is
`test_the_default_site_uses_the_canonical_hostname` — no site exists until Task
14 runs `setup_salyco_cms`. Task 14 Step 5 removes the decorator.

- [ ] **Step 6: Commit**

```bash
git add Backend/articles/models.py Backend/articles/migrations Backend/articles/tests_pages.py
git commit -m "feat(cms): ArticleIndexPage and ArticlePage

The index is a child of the Wagtail Root rather than the site root, so its own
URL is /articles/ and every article sits at /articles/<slug>/. Making the index
the site root would put it at / and every canonical tag would be wrong.

articles.Article is untouched: it stays as the migration source and the
rollback path."
```

---

### Task 5: Reading time and plain-text extraction

**Files:**
- Create: `Backend/articles/services.py`
- Test: `Backend/articles/tests_services.py` (create)

**Interfaces:**
- Consumes: `BodyBlock` (Task 3).
- Produces: `block_text(block) -> str`, `body_to_text(body) -> str`, `estimate_reading_time(body) -> int`, `WORDS_PER_MINUTE = 200`.

- [ ] **Step 1: Write the failing test**

Create `Backend/articles/tests_services.py`:

```python
from django.test import TestCase
from wagtail.blocks import StreamValue

from articles.blocks import BodyBlock
from articles.services import WORDS_PER_MINUTE, body_to_text, estimate_reading_time


def body(*blocks):
    """Build a StreamValue the way the database would hand one back."""
    return StreamValue(BodyBlock(), list(blocks))


class ReadingTimeTests(TestCase):
    def test_an_empty_body_still_reads_as_one_minute(self):
        # "۰ دقیقه مطالعه" reads as broken, not as "very short".
        self.assertEqual(estimate_reading_time(body()), 1)

    def test_a_short_article_is_one_minute(self):
        self.assertEqual(
            estimate_reading_time(body(("paragraph", "<p>سلام دنیا</p>"))), 1
        )

    def test_a_long_article_is_rounded_up(self):
        words = " ".join(["کلمه"] * (WORDS_PER_MINUTE * 2 + 1))
        result = estimate_reading_time(body(("paragraph", f"<p>{words}</p>")))
        self.assertEqual(result, 3)

    def test_markup_is_not_counted_as_words(self):
        plain = estimate_reading_time(body(("paragraph", "<p>یک دو سه</p>")))
        markup = estimate_reading_time(
            body(("paragraph", '<p><a href="https://example.com/a/b/c">یک</a> دو سه</p>'))
        )
        # The URL lives in an attribute, not in the text, so it must not inflate
        # the count — the design doc excludes URLs and link targets explicitly.
        self.assertEqual(plain, markup)

    def test_image_alt_text_is_not_counted(self):
        with_alt = body(
            ("paragraph", "<p>یک دو سه</p>"),
            ("image", {"image": None, "alt_text": " ".join(["توضیح"] * 400),
                       "decorative": False, "caption": "", "credit": ""}),
        )
        self.assertEqual(estimate_reading_time(with_alt), 1)


class BodyTextTests(TestCase):
    def test_blocks_are_joined_with_a_blank_line(self):
        text = body_to_text(
            body(("paragraph", "<p>اول</p>"), ("paragraph", "<p>دوم</p>"))
        )
        self.assertEqual(text, "اول\n\nدوم")

    def test_html_is_stripped(self):
        text = body_to_text(body(("paragraph", "<p>متن <strong>مهم</strong></p>")))
        self.assertEqual(text, "متن مهم")

    def test_headings_and_quotes_are_included(self):
        text = body_to_text(
            body(("heading", {"text": "عنوان", "level": "h2", "anchor_id": ""}),
                 ("quote", {"quote": "نقل", "source_name": "", "source_title": "",
                            "source_url": ""}))
        )
        self.assertEqual(text, "عنوان\n\nنقل")

    def test_an_empty_body_is_an_empty_string(self):
        self.assertEqual(body_to_text(body()), "")
```

- [ ] **Step 2: Run it and watch it fail**

Run: `python manage.py test articles.tests_services -v 2`

Expected: FAIL — `ModuleNotFoundError: No module named 'articles.services'`.

- [ ] **Step 3: Write the service**

Create `Backend/articles/services.py`:

```python
"""Plain-text extraction and reading time.

Both callers want the same thing — the words an editor actually wrote — so the
block walk lives here once: the API's `content` field and the reading-time
estimate are the same traversal with different consumers.
"""
import math
import re

from django.utils.html import strip_tags

# Words per minute for Persian prose, lower than the 200-250 usually quoted for
# English: Vazirmatn at the sizes Design.md specifies fits fewer words to a line
# and Persian readers measure slightly slower.
WORDS_PER_MINUTE = 200

_WHITESPACE_RE = re.compile(r"\s+")


def _clean(text):
    return _WHITESPACE_RE.sub(" ", strip_tags(text or "")).strip()


def block_text(block):
    """The editor-visible prose of one StreamField block.

    Returns "" for blocks that carry no prose. An image's alt text and a CTA's
    button label are not part of what a reader reads as the article, and counting
    them would inflate both the API's `content` and the reading time.
    """
    kind = block.block_type
    value = block.value

    if kind == "heading":
        return _clean(value.get("text"))
    if kind == "paragraph":
        return _clean(str(value))
    if kind == "quote":
        return _clean(value.get("quote"))
    if kind == "callout":
        return _clean(f"{value.get('title', '')} {value.get('content', '')}")
    if kind == "faq":
        return _clean(
            " ".join(
                f"{item.get('question', '')} {item.get('answer', '')}"
                for item in value.get("items", [])
            )
        )
    return ""


def body_to_text(body):
    """The body as plain text, one paragraph per block.

    This is what the legacy API's `content` field always was, so consumers of
    /api/articles/<slug>/ keep seeing the same shape they always did.
    """
    return "\n\n".join(text for text in (block_text(b) for b in body) if text)


def estimate_reading_time(body):
    """Minutes to read, rounded up, never below one.

    Counts only prose, which is why it walks blocks rather than rendering the
    body and stripping tags: rendered output includes the FAQ heading and the
    CTA copy, which are chrome, not article.
    """
    words = sum(len(block_text(block).split()) for block in body)
    return max(1, math.ceil(words / WORDS_PER_MINUTE))
```

`value.get(...)` works because Wagtail's `StructValue` is a dict subclass, and a
`RichText` object passed to `_clean` goes through `strip_tags`, which calls
`str()` on it — that yields the stored HTML source.

- [ ] **Step 4: Run the tests**

Run: `python manage.py test articles.tests_services -v 2`

Expected: PASS (9 tests). If `test_image_alt_text_is_not_counted` fails, the
`image` branch is missing from `block_text` — it must return `""` and the
`assertEqual` is the guard.

- [ ] **Step 5: Commit**

```bash
git add Backend/articles/services.py Backend/articles/tests_services.py
git commit -m "feat(cms): reading time and plain-text body extraction

One traversal serves both: the API's content field and the reading-time estimate
want the same words. URLs, image alt text and CTA copy are excluded, so neither
count is inflated by markup or chrome."
```

---

### Task 6: SEO module — metadata and JSON-LD

**Files:**
- Create: `Backend/articles/seo.py`
- Test: `Backend/articles/tests_seo.py` (create)

**Interfaces:**
- Consumes: `ArticlePage` / `ArticleIndexPage` (Task 4), `GlobalSeoSettings` (Task 2), `article_tags.json_ld_script` (Task 3).
- Produces: `absolute_url(path) -> str`, `meta_title(page, site_settings=None) -> str`, `meta_description(page, site_settings=None) -> str`, `canonical_url(page) -> str`, `robots_directive(page, request=None) -> str`, `social_image(page, site_settings=None) -> str`, `build_meta(page, request=None) -> dict`, `site_settings_for(request) -> GlobalSeoSettings | None`, `page_meta_context(page, request=None) -> dict` (keys `meta`, `seo_settings`), `article_json_ld(page, request=None) -> dict`, `breadcrumb_json_ld(page) -> dict`, `faq_json_ld(page) -> dict | None`.

- [ ] **Step 1: Write the failing test**

Create `Backend/articles/tests_seo.py`:

```python
import json

from django.template import Context, Template
from django.test import TestCase
from wagtail.models import Page, Site

from articles.models import ArticleIndexPage, ArticlePage
from articles.seo import (
    absolute_url,
    breadcrumb_json_ld,
    build_meta,
    canonical_url,
    meta_title,
    robots_directive,
)
from articles.snippets import ArticleAuthor, GlobalSeoSettings


def make_index():
    root = Page.objects.get(depth=1)
    index = ArticleIndexPage(title="مقالات", slug="articles")
    root.add_child(instance=index)
    return index


def make_article(index, **kwargs):
    defaults = {"title": "راهنمای تشک", "slug": "a", "excerpt": "خلاصه", "body": []}
    defaults.update(kwargs)
    article = ArticlePage(**defaults)
    index.add_child(instance=article)
    return article


class TitleTests(TestCase):
    def test_the_suffix_is_appended_once(self):
        index = make_index()
        article = make_article(index)
        self.assertEqual(meta_title(article), "راهنمای تشک | سالیکو")

    def test_the_suffix_is_not_doubled(self):
        index = make_index()
        article = make_article(index, seo_title="راهنمای تشک | سالیکو")
        self.assertEqual(meta_title(article), "راهنمای تشک | سالیکو")

    def test_seo_title_wins_over_the_page_title(self):
        index = make_index()
        article = make_article(index, seo_title="عنوان سئو")
        self.assertEqual(meta_title(article), "عنوان سئو | سالیکو")


class CanonicalTests(TestCase):
    def test_the_canonical_uses_the_site_url_not_the_request(self):
        index = make_index()
        article = make_article(index)
        self.assertEqual(canonical_url(article), "https://salyco.ir/articles/a/")

    def test_the_override_wins(self):
        index = make_index()
        article = make_article(index, canonical_url_override="https://example.com/x")
        self.assertEqual(canonical_url(article), "https://example.com/x")

    def test_no_canonical_can_contain_a_local_host(self):
        # The whole reason SITE_URL exists rather than request.build_absolute_uri.
        index = make_index()
        article = make_article(index)
        for forbidden in ("localhost", "127.0.0.1", "backend:8000"):
            self.assertNotIn(forbidden, canonical_url(article))


class RobotsTests(TestCase):
    def test_a_live_indexable_article_is_index_follow(self):
        index = make_index()
        article = make_article(index)
        article.save_revision().publish()
        self.assertEqual(robots_directive(article), "index,follow")

    def test_allow_indexing_false_is_noindex(self):
        index = make_index()
        article = make_article(index, allow_indexing=False)
        article.save_revision().publish()
        self.assertEqual(robots_directive(article), "noindex,follow")

    def test_a_draft_is_noindex_nofollow(self):
        index = make_index()
        article = make_article(index)
        self.assertEqual(robots_directive(article), "noindex,nofollow")


class JsonLdScriptTests(TestCase):
    def render(self, data):
        template = Template(
            "{% load article_tags %}{% json_ld_script data %}"
        )
        return template.render(Context({"data": data}))

    def test_a_script_tag_is_produced(self):
        html = self.render({"@type": "Article"})
        self.assertIn('<script type="application/ld+json">', html)
        self.assertIn('"@type":"Article"', html)

    def test_a_closing_script_tag_in_a_title_cannot_escape(self):
        html = self.render({"headline": "</script><img src=x onerror=alert(1)>"})
        self.assertEqual(html.count("</script>"), 1)
        self.assertNotIn("<img", html)
        self.assertIn("\\u003c/script\\u003e", html)

    def test_persian_is_not_escaped_into_ascii(self):
        # ensure_ascii=False keeps the payload readable for a human debugging a
        # rich-result problem in view-source.
        self.assertIn("سالیکو", self.render({"headline": "سالیکو"}))


class StructuredDataTests(TestCase):
    def test_the_breadcrumb_walks_the_real_tree(self):
        index = make_index()
        article = make_article(index)
        data = breadcrumb_json_ld(article)
        names = [item["name"] for item in data["itemListElement"]]
        self.assertEqual(names, ["مقالات", "راهنمای تشک"])

    def test_the_breadcrumb_entries_are_absolute(self):
        index = make_index()
        article = make_article(index)
        data = breadcrumb_json_ld(article)
        for item in data["itemListElement"]:
            self.assertTrue(item["item"].startswith("https://salyco.ir/"))

    def test_the_breadcrumb_is_valid_json_when_serialised(self):
        index = make_index()
        article = make_article(index)
        template = Template("{% load article_tags %}{% json_ld_script data %}")
        html = template.render(Context({"data": breadcrumb_json_ld(article)}))
        payload = html.split(">", 1)[1].rsplit("<", 1)[0]
        json.loads(payload)
```

- [ ] **Step 2: Run it and watch it fail**

Run: `python manage.py test articles.tests_seo -v 2`

Expected: FAIL — `ModuleNotFoundError: No module named 'articles.seo'`.

- [ ] **Step 3: Write the SEO module**

Create `Backend/articles/seo.py`:

```python
"""Metadata and structured data for article pages.

Every function here is pure over a page (and optionally a request), so each
fallback chain can be tested without going through a view — and so the sitemap
and the tests call exactly what the template calls.

Nothing in this module reads the request's host. Behind host nginx → container
nginx → gunicorn one wrong X-Forwarded-* header would put "backend:8000" into a
canonical tag and a social card, so the origin comes from settings.SITE_URL.
"""
from django.conf import settings
from wagtail.models import Site

from .snippets import GlobalSeoSettings

# Must match the rendition filter used in social_image(). The two values are
# only valid together: og:image:width/height that disagree with the actual file
# are worse than no dimensions at all.
OG_IMAGE_WIDTH = 1200
OG_IMAGE_HEIGHT = 630
OG_IMAGE_FILTER = f"fill-{OG_IMAGE_WIDTH}x{OG_IMAGE_HEIGHT}"

DEFAULT_TITLE_SUFFIX = "سالیکو"
DEFAULT_BRAND_FA = "سالیکو"


def absolute_url(path):
    """Join a site-relative path onto SITE_URL."""
    if not path:
        return f"{settings.SITE_URL}/"
    if path.startswith(("http://", "https://")):
        return path
    return f"{settings.SITE_URL}{path}"


def site_settings_for(request):
    """Global SEO settings for the request's site, or None.

    Returns None rather than raising: a management command, a test and a request
    with no matching Site all reach here, and every caller already has a
    sensible default for each field.
    """
    if request is None:
        return None
    site = Site.find_for_request(request)
    if site is None:
        return None
    return GlobalSeoSettings.for_site(site)


def meta_title(page, site_settings=None):
    raw = (page.seo_title or page.title or "").strip()
    suffix = (
        getattr(site_settings, "default_title_suffix", "") or DEFAULT_TITLE_SUFFIX
    ).strip()
    if not suffix or raw.endswith(suffix):
        # "عنوان | سالیکو | سالیکو" is what a crawler sees as a keyword-stuffed
        # title, so an editor who typed the suffix by hand is not punished for it.
        return raw
    return f"{raw} | {suffix}"


def meta_description(page, site_settings=None):
    text = (
        getattr(page, "search_description", "") or getattr(page, "excerpt", "") or ""
    ).strip()
    if text:
        return text
    return (getattr(site_settings, "default_meta_description", "") or "").strip()


def canonical_url(page):
    override = (getattr(page, "canonical_url_override", "") or "").strip()
    if override:
        return override
    return absolute_url(page.get_url())


def robots_directive(page, request=None):
    if request is not None and getattr(request, "is_preview", False):
        return "noindex,nofollow"
    if not page.live:
        return "noindex,nofollow"
    index = "index" if getattr(page, "allow_indexing", True) else "noindex"
    follow = "follow" if getattr(page, "allow_following", True) else "nofollow"
    return f"{index},{follow}"


def social_image(page, site_settings=None):
    image = (
        getattr(page, "og_image", None)
        or getattr(page, "hero_image", None)
        or getattr(site_settings, "default_og_image", None)
    )
    if image is None:
        return ""
    return absolute_url(image.get_rendition(OG_IMAGE_FILTER).url)


def build_meta(page, request=None, site_settings=None):
    if site_settings is None:
        site_settings = site_settings_for(request)
    title = meta_title(page, site_settings)
    description = meta_description(page, site_settings)
    image = social_image(page, site_settings)
    return {
        "title": title,
        "description": description,
        "canonical": canonical_url(page),
        "robots": robots_directive(page, request),
        "og_type": "article",
        "og_locale": "fa_IR",
        "og_title": (getattr(page, "og_title", "") or title).strip(),
        "og_description": (getattr(page, "og_description", "") or description).strip(),
        "og_image": image,
        "og_image_width": OG_IMAGE_WIDTH,
        "og_image_height": OG_IMAGE_HEIGHT,
        "twitter_card": "summary_large_image",
    }


def page_meta_context(page, request=None):
    """Everything base_article.html needs to render <head>.

    One place, so no page can ship a canonical tag while forgetting og:url —
    and so the tests assert against the same dict the template renders.
    """
    site_settings = site_settings_for(request)
    return {
        "meta": build_meta(page, request, site_settings),
        "seo_settings": site_settings,
    }


def _publisher(site_settings):
    publisher = {
        "@type": "Organization",
        "name": (getattr(site_settings, "brand_name_fa", "") or DEFAULT_BRAND_FA),
        "url": settings.SITE_URL,
    }
    logo = getattr(site_settings, "organization_logo", None)
    if logo is not None:
        publisher["logo"] = {
            "@type": "ImageObject",
            "url": absolute_url(logo.get_rendition("width-512").url),
        }
    same_as = [
        value
        for value in (
            (getattr(site_settings, field, "") or "").strip()
            for field in ("instagram_url", "telegram_url", "linkedin_url", "aparat_url")
        )
        if value
    ]
    if same_as:
        publisher["sameAs"] = same_as
    return publisher


def article_json_ld(page, request=None):
    site_settings = site_settings_for(request)
    data = {
        "@context": "https://schema.org",
        "@type": "Article",
        "mainEntityOfPage": {"@type": "WebPage", "@id": canonical_url(page)},
        "headline": page.title,
        "description": meta_description(page, site_settings),
        "inLanguage": "fa-IR",
        "publisher": _publisher(site_settings),
    }
    author = page.author
    if author is not None:
        # author_type decides whether this is a Person or an Organization. An
        # Organization described as a Person is a factual error in structured
        # data, not a cosmetic one, which is why the field exists at all.
        entry = {"@type": author.author_type, "name": author.name}
        if author.author_type == "Person" and author.job_title:
            entry["jobTitle"] = author.job_title
        if author.website_url:
            entry["url"] = author.website_url
        data["author"] = entry
    if page.first_published_at:
        data["datePublished"] = page.first_published_at.isoformat()
    if page.last_published_at:
        data["dateModified"] = page.last_published_at.isoformat()
    image = social_image(page, site_settings)
    if image:
        data["image"] = [image]
    return data


def breadcrumb_json_ld(page):
    """A BreadcrumbList built by walking the page's real ancestors.

    Walking the tree rather than using a hand-written list is what makes it
    impossible for a breadcrumb item to point at a URL that does not exist.
    """
    chain = [item for item in page.get_ancestors(inclusive=True) if item.depth > 1]
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": position,
                "name": item.title,
                "item": absolute_url(item.get_url()),
            }
            for position, item in enumerate(chain, start=1)
        ],
    }


def faq_json_ld(page):
    """FAQPage data, or None when the article has no FAQ block."""
    body = getattr(page, "body", None)
    if not body:
        return None
    pairs = []
    for block in body:
        if block.block_type != "faq":
            continue
        for item in block.value.get("items", []):
            question = (item.get("question") or "").strip()
            answer = (item.get("answer") or "").strip()
            if question and answer:
                pairs.append((question, answer))
    if not pairs:
        return None
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": question,
                "acceptedAnswer": {"@type": "Answer", "text": answer},
            }
            for question, answer in pairs
        ],
    }
```

- [ ] **Step 4: Run the tests**

Run: `python manage.py test articles.tests_seo -v 2`

Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add Backend/articles/seo.py Backend/articles/tests_seo.py
git commit -m "feat(cms): article metadata and JSON-LD

The canonical origin is settings.SITE_URL, never the request: three proxies sit
between Django and the client, and one bad X-Forwarded-* header would put
backend:8000 into a canonical tag. canonical_url_override is validated to refuse
localhost outright.

BreadcrumbList walks the page's real ancestors, so it cannot name a URL that
does not exist."
```

---

### Task 7: The article page template

**Files:**
- Create: `Backend/articles/templates/articles/base_article.html`
- Create: `Backend/articles/templates/articles/article_page.html`
- Create: `Backend/articles/templates/articles/partials/{breadcrumb,article_card,faq_section}.html`
- Test: `Backend/articles/tests_rendering.py` (create)

**Interfaces:**
- Consumes: `page_meta_context` (Task 6), `json_ld_script` (Task 3), block templates (Task 3).
- Produces: the public HTML for one article, at `articles/article_page.html`. Later tasks extend `base_article.html`.

- [ ] **Step 1: Write the failing test**

Create `Backend/articles/tests_rendering.py`:

```python
import json

from django.test import TestCase
from wagtail.models import Page

from articles.models import ArticleIndexPage, ArticlePage

ARTICLE_BODY = [
    ("heading", {"text": "چگونه انتخاب کنیم", "level": "h2", "anchor_id": ""}),
    ("paragraph", "<p>اولین نکته این است که <strong>سختی</strong> تشک مهم است.</p>"),
    ("faq", {"items": [{"question": "کدام تشک؟", "answer": "بستگی دارد."}]}),
]


class ArticleRenderingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        root = Page.objects.get(depth=1)
        cls.index = ArticleIndexPage(title="مقالات", slug="articles")
        root.add_child(instance=cls.index)
        cls.article = ArticlePage(
            title="راهنمای انتخاب تشک",
            slug="rahnama",
            excerpt="چگونه تشک مناسب را انتخاب کنیم.",
            body=ARTICLE_BODY,
        )
        cls.index.add_child(instance=cls.article)
        cls.article.save_revision().publish()

    def get(self):
        return self.client.get("/articles/rahnama/")

    def test_the_page_is_served_by_django(self):
        self.assertEqual(self.get().status_code, 200)

    def test_the_body_text_is_in_the_raw_response(self):
        # The whole point of the change: this must hold with no JavaScript run.
        html = self.get().content.decode()
        self.assertIn("اولین نکته این است که", html)
        self.assertIn("بستگی دارد.", html)

    def test_the_document_is_persian_and_rtl(self):
        html = self.get().content.decode()
        self.assertIn('<html lang="fa" dir="rtl">', html)

    def test_there_is_exactly_one_h1(self):
        html = self.get().content.decode()
        self.assertEqual(html.count("<h1"), 1)
        self.assertIn("راهنمای انتخاب تشک", html)

    def test_the_head_carries_the_metadata(self):
        html = self.get().content.decode()
        self.assertIn("<title>راهنمای انتخاب تشک | سالیکو</title>", html)
        self.assertIn(
            '<link rel="canonical" href="https://salyco.ir/articles/rahnama/">', html
        )
        self.assertIn('<meta name="robots" content="index,follow">', html)
        self.assertIn('<meta property="og:type" content="article">', html)

    def test_exactly_one_canonical_is_emitted(self):
        self.assertEqual(self.get().content.decode().count('rel="canonical"'), 1)

    def test_the_json_ld_parses(self):
        html = self.get().content.decode()
        self.assertEqual(html.count("application/ld+json"), 3)  # Article, breadcrumb, FAQ
        for chunk in html.split('application/ld+json">')[1:]:
            json.loads(chunk.split("</script>")[0])

    def test_a_draft_is_not_public(self):
        draft = ArticlePage(title="پیش‌نویس", slug="draft", excerpt="x", body=[])
        self.index.add_child(instance=draft)
        self.assertEqual(self.client.get("/articles/draft/").status_code, 404)

    def test_the_faq_renders_as_details(self):
        html = self.get().content.decode()
        self.assertIn("<details", html)
        self.assertIn("<summary", html)

    def test_the_body_carries_no_tailwind_utility_classes(self):
        # The article CSS is plain semantic CSS, because Django templates cannot
        # compile Tailwind's @theme. A stray bg-brand-navy here would silently do
        # nothing.
        html = self.get().content.decode()
        self.assertNotIn("bg-brand-navy", html)
```

- [ ] **Step 2: Run it and watch it fail**

Run: `python manage.py test articles.tests_rendering -v 2`

Expected: FAIL — 500 from `TemplateDoesNotExist: articles/article_page.html`.

- [ ] **Step 3: Write the base template**

Create `Backend/articles/templates/articles/base_article.html`:

```html
{% load static article_tags wagtailcore_tags %}
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <title>{{ meta.title }}</title>
  <meta name="description" content="{{ meta.description }}">
  <link rel="canonical" href="{{ meta.canonical }}">
  <meta name="robots" content="{{ meta.robots }}">

  <meta property="og:type" content="{{ meta.og_type }}">
  <meta property="og:locale" content="{{ meta.og_locale }}">
  <meta property="og:site_name" content="{{ seo_settings.brand_name_fa|default:'سالیکو' }}">
  <meta property="og:title" content="{{ meta.og_title }}">
  <meta property="og:description" content="{{ meta.og_description }}">
  <meta property="og:url" content="{{ meta.canonical }}">
  {% if meta.og_image %}
    <meta property="og:image" content="{{ meta.og_image }}">
    <meta property="og:image:width" content="{{ meta.og_image_width }}">
    <meta property="og:image:height" content="{{ meta.og_image_height }}">
  {% endif %}
  <meta name="twitter:card" content="{{ meta.twitter_card }}">
  <meta name="twitter:title" content="{{ meta.og_title }}">
  <meta name="twitter:description" content="{{ meta.og_description }}">
  {% if meta.og_image %}<meta name="twitter:image" content="{{ meta.og_image }}">{% endif %}

  {# The shared design tokens, extracted so Django and the React app read one
     palette instead of two that drift. Served from the SPA root by nginx,
     exactly as /fonts/ already is. #}
  <link rel="stylesheet" href="/tokens.css">
  <link rel="stylesheet" href="{% static 'articles/article.css' %}">

  {% for block in json_ld %}{% json_ld_script block %}{% endfor %}
  {% block extra_head %}{% endblock %}
</head>
<body class="article-page">
  <a class="article-skip" href="#main">پرش به محتوای اصلی</a>

  <header class="article-header">
    <div class="article-shell article-header__inner">
      <a class="article-header__brand" href="/">
        <img src="/salyco-logo-navy.svg" alt="سالیکو" width="120" height="40">
      </a>
      <nav class="article-header__nav" aria-label="ناوبری اصلی">
        <a href="/">خانه</a>
        <a href="/products">محصولات</a>
        <a href="/articles/" aria-current="page">مقالات</a>
        <a href="/contact">تماس با ما</a>
      </nav>
    </div>
  </header>

  <main id="main">
    {% block content %}{% endblock %}
  </main>

  <footer class="article-footer">
    <div class="article-shell">
      <p>© سالیکو — راهنمای انتخاب تشک و خواب بهتر.</p>
    </div>
  </footer>
</body>
</html>
```

- [ ] **Step 4: Write the partials**

Create `Backend/articles/templates/articles/partials/breadcrumb.html`:

```html
{# Mirrors the BreadcrumbList JSON-LD. Two representations of one chain: this
   one is for the reader, that one for the crawler, and they are built from the
   same page ancestors so they cannot disagree. #}
<nav class="article-breadcrumb" aria-label="مسیر صفحه">
  <ol class="article-breadcrumb__list">
    {% for item in page.get_ancestors %}
      {% if item.depth > 1 %}
        <li class="article-breadcrumb__item">
          <a href="{{ item.get_url }}">{{ item.title }}</a>
        </li>
      {% endif %}
    {% endfor %}
    <li class="article-breadcrumb__item article-breadcrumb__item--current" aria-current="page">
      {{ page.title }}
    </li>
  </ol>
</nav>
```

Create `Backend/articles/templates/articles/partials/article_card.html`:

```html
{% load wagtailimages_tags %}
{# The one card used by the index, the archives and any future "related"
   section, so a change to the card is a change in one file. #}
<article class="article-card">
  <a class="article-card__link" href="{{ article.get_url }}">
    {% if article.hero_image %}
      {% image article.hero_image fill-640x360 class="article-card__image" alt=article.hero_image_alt %}
    {% endif %}
    <div class="article-card__body">
      {% if article.category %}
        <span class="article-card__category">{{ article.category.name }}</span>
      {% endif %}
      <h3 class="article-card__title">{{ article.title }}</h3>
      {% if article.excerpt %}
        <p class="article-card__excerpt">{{ article.excerpt }}</p>
      {% endif %}
      <p class="article-card__meta">
        <span>{{ article.estimated_reading_time }} دقیقه مطالعه</span>
      </p>
    </div>
  </a>
</article>
```

Create `Backend/articles/templates/articles/partials/faq_section.html`:

```html
{# Kept out of the block template so a page can place the FAQ where the layout
   wants it rather than only where the editor inserted it. #}
{% if faq_items %}
  <section class="article-faq">
    <h2 class="article-faq__heading">پرسش‌های متداول</h2>
    {% for item in faq_items %}
      <details class="article-faq__item">
        <summary class="article-faq__question">{{ item.question }}</summary>
        <p class="article-faq__answer">{{ item.answer }}</p>
      </details>
    {% endfor %}
  </section>
{% endif %}
```

- [ ] **Step 5: Write the article template**

Create `Backend/articles/templates/articles/article_page.html`:

```html
{% extends "articles/base_article.html" %}
{% load wagtailcore_tags wagtailimages_tags %}

{% block content %}
  <div class="article-shell">
    {% include "articles/partials/breadcrumb.html" %}

    <article class="article" itemscope itemtype="https://schema.org/Article">
      <header class="article__header">
        {% if page.category %}
          <a class="article__category" href="{{ page.category_archive_url }}">
            {{ page.category.name }}
          </a>
        {% endif %}

        {# The only h1 on the page. No block can emit one. #}
        <h1 class="article__title">{{ page.title }}</h1>

        {% if page.subtitle %}
          <p class="article__subtitle">{{ page.subtitle }}</p>
        {% endif %}

        <p class="article__meta">
          {% if page.author %}
            <span itemprop="author">{{ page.author.name }}</span>
          {% endif %}
          {% if page.first_published_at %}
            <time datetime="{{ page.first_published_at|date:'c' }}">
              {{ page.first_published_at|date:"j F Y" }}
            </time>
          {% endif %}
          <span>{{ page.estimated_reading_time }} دقیقه مطالعه</span>
        </p>

        {% if page.excerpt %}
          <p class="article__excerpt">{{ page.excerpt }}</p>
        {% endif %}
      </header>

      {% if page.hero_image %}
        <figure class="article__hero">
          {% image page.hero_image width-1200 class="article__hero-image" alt=page.hero_image_alt %}
        </figure>
      {% endif %}

      <div class="article-body">
        {% for block in page.body %}
          {% include_block block %}
        {% endfor %}
      </div>

      {% if page.tags.all %}
        <ul class="article-tags">
          {% for tag in page.tags.all %}
            <li class="article-tags__item">
              {# A tag archive is a sub-route of the index, so the URL is the
                 index path plus the tag slug. #}
              <a href="{{ page.tag_archive_url_base }}{{ tag.slug }}/">{{ tag.name }}</a>
            </li>
          {% endfor %}
        </ul>
      {% endif %}
    </article>
  </div>
{% endblock %}
```

Note: `page.first_published_at|date:"j F Y"` uses the `fa` locale set in Task 1, so the month name comes out Persian. If it renders in English, the locale is not active — check `LANGUAGE_CODE` and that `USE_I18N` is `True`.

- [ ] **Step 6: Write the minimal stylesheet so the page is readable**

Create `Backend/articles/static/articles/article.css` with just the layout rules this task needs; Task 10 adds the token-driven typography:

```css
/* Semantic article styles. Plain CSS rather than Tailwind utilities, because
   Django templates cannot compile Tailwind's @theme — see the design doc's
   "Article styling uses the same tokens through one file". */
.article-shell {
  max-width: 1200px;
  margin-inline: auto;
  padding-inline: 16px;
}

.article-body,
.article__header,
.article__excerpt {
  max-width: 640px; /* Design.md's standalone paragraph measure. */
  margin-inline: auto;
}

.article-body__heading {
  scroll-margin-top: 96px;
}
```

- [ ] **Step 7: Run the tests**

Run: `python manage.py test articles.tests_rendering -v 2`

Expected: PASS (10 tests). `test_the_json_ld_parses` expects three blocks; if the FAQ count differs, the `faq_json_ld` walk in Task 6 is not seeing the `faq` block type — check that the StreamValue's `block_type` is `"faq"`.

- [ ] **Step 8: Look at it in a browser**

Run: `python manage.py runserver`, then open `http://127.0.0.1:8000/articles/rahnama/`.

Confirm with **View Source** — not the DevTools Elements panel — that `<title>`, `<link rel="canonical">`, the `<h1>` and the body `<p>` elements are present with JavaScript disabled. Then resize to 360px and confirm no horizontal scroll.

- [ ] **Step 9: Commit**

```bash
git add Backend/articles/templates Backend/articles/static Backend/articles/tests_rendering.py
git commit -m "feat(cms): server-rendered article page

The body text, title, canonical, robots and JSON-LD are all in the response
before any JavaScript runs, which is the entire point of the change. The page
carries exactly one h1 and the FAQ uses <details> so its answers are in the
served HTML."
```

---

### Task 8: Index, archives and pagination

**Files:**
- Create: `Backend/articles/templates/articles/article_index_page.html`
- Create: `Backend/articles/templates/articles/archive.html`
- Create: `Backend/articles/templates/articles/partials/pagination.html`
- Modify: `Backend/articles/models.py` (add the `route()` handlers to `ArticleIndexPage`)
- Test: `Backend/articles/tests_archives.py` (create)

**Interfaces:**
- Consumes: `ArticleIndexPage.published_articles()` and `.paginate()` (Task 4).
- Produces: `/articles/`, `/articles/category/<slug>/`, `/articles/tag/<slug>/`, and `?page=N` on all three. The archive template reads an `archive` context dict with keys `kind` (`"category"` or `"tag"`), `title`, `description`, `noindex`.

- [ ] **Step 1: Write the failing test**

Create `Backend/articles/tests_archives.py`:

```python
from django.test import TestCase
from wagtail.models import Page

from articles.models import ARTICLES_PER_PAGE, ArticleIndexPage, ArticlePage
from articles.snippets import ArticleCategory


class ArchiveTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        root = Page.objects.get(depth=1)
        cls.index = ArticleIndexPage(title="مقالات", slug="articles")
        root.add_child(instance=cls.index)

        cls.guide = ArticleCategory.objects.create(name="راهنما", slug="rahnama")
        cls.other = ArticleCategory.objects.create(name="خواب", slug="khab")

        cls.articles = []
        for i in range(ARTICLES_PER_PAGE + 3):
            article = ArticlePage(
                title=f"مقاله {i}",
                slug=f"a-{i}",
                excerpt="خلاصه",
                category=cls.guide if i % 2 == 0 else cls.other,
                body=[],
            )
            cls.index.add_child(instance=article)
            article.save_revision().publish()
            cls.articles.append(article)

    def test_the_index_lists_articles(self):
        response = self.client.get("/articles/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("مقاله 0", response.content.decode())

    def test_the_index_paginates(self):
        first = self.client.get("/articles/").content.decode()
        second = self.client.get("/articles/?page=2").content.decode()
        self.assertIn("مقاله 0", first)
        self.assertNotIn("مقاله 0", second)

    def test_the_category_archive_filters(self):
        response = self.client.get("/articles/category/rahnama/")
        self.assertEqual(response.status_code, 200)
        body = response.content.decode()
        self.assertIn("مقاله 0", body)
        self.assertNotIn("مقاله 1<", body)

    def test_the_category_archive_is_indexable(self):
        response = self.client.get("/articles/category/rahnama/")
        self.assertIn("index,follow", response.content.decode())

    def test_an_inactive_category_is_404(self):
        self.guide.is_active = False
        self.guide.save()
        self.assertEqual(self.client.get("/articles/category/rahnama/").status_code, 404)

    def test_an_unknown_category_is_404(self):
        self.assertEqual(self.client.get("/articles/category/nope/").status_code, 404)

    def test_the_tag_archive_is_noindex(self):
        article = self.articles[0]
        article.tags.add("تشک")
        response = self.client.get("/articles/tag/تشک/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("noindex,follow", response.content.decode())

    def test_a_draft_never_appears_in_a_listing(self):
        draft = ArticlePage(
            title="منتشرنشده", slug="hidden", excerpt="x", body=[]
        )
        self.index.add_child(instance=draft)
        self.assertNotIn("منتشرنشده", self.client.get("/articles/").content.decode())
```

The test `test_a_draft_never_appears_in_a_listing` creates the draft in `setUpTestData`'s class — move that creation into the test method body (it is already there) but note `setUpTestData` is class-level, so `self.index` is shared across tests; `add_child` inside a test is fine because each test runs in a transaction.

- [ ] **Step 2: Run it and watch it fail**

Run: `python manage.py test articles.tests_archives -v 2`

Expected: FAIL — 404s, because no routes exist and no index template exists.

- [ ] **Step 3: Add the routes to the index page**

In `Backend/articles/models.py`, change the class declaration to mix in the router and add the handlers:

```python
from wagtail.contrib.routable_page.models import RoutablePageMixin, route


class ArticleIndexPage(RoutablePageMixin, Page):
```

Then add these methods to the class, after `get_context`:

```python
    @route(r"^category/(?P<slug>[\w-]+)/$")
    def category_archive(self, request, slug):
        from django.shortcuts import get_object_or_404
        from django.template.response import TemplateResponse

        from .seo import build_meta, site_settings_for

        category = get_object_or_404(ArticleCategory, slug=slug, is_active=True)
        return self._archive_response(
            request,
            queryset=self.published_articles().filter(category=category),
            archive={
                "kind": "category",
                "title": category.name,
                "description": category.description,
                "noindex": False,
            },
        )

    @route(r"^tag/(?P<slug>[\w-]+)/$")
    def tag_archive(self, request, slug):
        # Tag archives are noindex,follow: they duplicate the article list for
        # every tag an editor invents, and a thin duplicate page competes with
        # the articles it points at.
        return self._archive_response(
            request,
            queryset=self.published_articles().filter(tags__slug=slug),
            archive={
                "kind": "tag",
                "title": f"برچسب: {slug}",
                "description": "",
                "noindex": True,
            },
        )

    def _archive_response(self, request, queryset, archive):
        from django.template.response import TemplateResponse

        from .seo import build_meta, site_settings_for

        site_settings = site_settings_for(request)
        context = self.get_context(request)
        context.update(
            {
                "archive": archive,
                "articles": self.paginate(request, queryset),
                "base_url": request.path,
                "seo_settings": site_settings,
            }
        )
        meta = build_meta(self, request, site_settings)
        meta["title"] = f"{archive['title']} | سالیکو"
        meta["description"] = archive["description"]
        meta["canonical"] = f"{settings.SITE_URL}{request.path}"
        if archive["noindex"]:
            meta["robots"] = "noindex,follow"
        context["meta"] = meta
        return TemplateResponse(request, "articles/archive.html", context)
```

`request.path` here is safe to use for the canonical's *path* — the host still
comes from `SITE_URL`, which is the part that matters. Remove the unused
`TemplateResponse`/`build_meta` imports from the `category_archive` handler
(the `from .seo import ...` line inside it is dead once `_archive_response`
owns that work) — the only import that handler needs is `get_object_or_404`.

- [ ] **Step 4: Write the shared archive template**

Create `Backend/articles/templates/articles/archive.html`:

```html
{% extends "articles/base_article.html" %}

{% block content %}
  <div class="article-shell">
    <header class="archive__header">
      <h1 class="archive__title">{{ archive.title }}</h1>
      {% if archive.description %}
        <p class="archive__description">{{ archive.description }}</p>
      {% endif %}
    </header>

    {% if articles %}
      <div class="article-grid">
        {% for article in articles %}
          {% include "articles/partials/article_card.html" %}
        {% endfor %}
      </div>
      {% include "articles/partials/pagination.html" %}
    {% else %}
      <p class="archive__empty">هنوز مقاله‌ای در این بخش منتشر نشده است.</p>
    {% endif %}
  </div>
{% endblock %}
```

- [ ] **Step 5: Write the pagination partial**

Create `Backend/articles/templates/articles/partials/pagination.html`:

```html
{# Server-rendered links, no JavaScript. rel="prev"/"next" are what tell a
   crawler the pages form one sequence rather than duplicates. #}
{% if articles.has_other_pages %}
  <nav class="article-pagination" aria-label="صفحه‌بندی">
    {% if articles.has_previous %}
      <a class="article-pagination__link" rel="prev"
         href="{{ base_url }}?page={{ articles.previous_page_number }}">قبلی</a>
    {% endif %}

    <span class="article-pagination__status">
      صفحه {{ articles.number }} از {{ articles.paginator.num_pages }}
    </span>

    {% if articles.has_next %}
      <a class="article-pagination__link" rel="next"
         href="{{ base_url }}?page={{ articles.next_page_number }}">بعدی</a>
    {% endif %}
  </nav>
{% endif %}
```

- [ ] **Step 6: Write the index template**

Create `Backend/articles/templates/articles/article_index_page.html`:

```html
{% extends "articles/base_article.html" %}

{% block content %}
  <div class="article-shell">
    <header class="index__header">
      <h1 class="index__title">{{ page.hero_title|default:page.title }}</h1>
      {% if page.hero_description %}
        <p class="index__description">{{ page.hero_description }}</p>
      {% endif %}
    </header>

    {% if page.featured_categories %}
      <nav class="index__categories" aria-label="دسته‌بندی‌ها">
        {% for category in page.featured_categories.all %}
          <a class="index__category" href="{{ page.get_url }}category/{{ category.slug }}/">
            {{ category.name }}
          </a>
        {% endfor %}
      </nav>
    {% endif %}

    {% if articles %}
      <div class="article-grid">
        {% for article in articles %}
          {% include "articles/partials/article_card.html" %}
        {% endfor %}
      </div>
      {% include "articles/partials/pagination.html" %}
    {% else %}
      <p class="archive__empty">هنوز مقاله‌ای منتشر نشده است.</p>
    {% endif %}
  </div>
{% endblock %}
```

- [ ] **Step 7: Give the index its own `articles` and `base_url`**

`ArticleIndexPage.get_context` currently only adds metadata. Add the listing:

```python
    def get_context(self, request, *args, **kwargs):
        from .seo import breadcrumb_json_ld, page_meta_context

        context = super().get_context(request, *args, **kwargs)
        context.update(page_meta_context(self, request))
        context["json_ld"] = [breadcrumb_json_ld(self)]
        context["articles"] = self.paginate(request, self.published_articles())
        context["base_url"] = self.get_url()
        return context
```

- [ ] **Step 8: Add the grid CSS**

Append to `Backend/articles/static/articles/article.css`:

```css
.article-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  margin-block: 32px;
}

@media (min-width: 768px) {
  .article-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .article-grid { grid-template-columns: repeat(3, 1fr); }
}

.article-card__link {
  display: block;
  height: 100%;
  border: 1px solid var(--salyco-mist);
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
  text-decoration: none;
}

.article-card__image { width: 100%; height: auto; display: block; }
.article-card__body { padding: 16px; }
```

- [ ] **Step 9: Run the tests**

Run: `python manage.py test articles.tests_archives -v 2`

Expected: PASS (8 tests). `test_the_tag_archive_is_noindex` navigates to a
percent-encoded Persian URL — Django's test client encodes it for you, but if it
404s, check that the `slug` converter in the tag route matches Persian: `[\w-]+`
does not match Persian letters under a non-Unicode regex. Change both routes'
converters to `[^/]+` if so.

- [ ] **Step 10: Commit**

```bash
git add Backend/articles/models.py Backend/articles/templates/articles Backend/articles/static Backend/articles/tests_archives.py
git commit -m "feat(cms): article index, category and tag archives

Category and tag archives are sub-routes of the index rather than page types, so
a category exists once as a snippet and once as a URL. Tag archives are
noindex,follow: they duplicate content per tag and compete with the articles
they link to."
```

---

### Task 9: Sitemap and robots

**Files:**
- Create: `Backend/core/seo_views.py`
- Modify: `Backend/core/urls.py`
- Test: `Backend/core/tests_seo_views.py` (create)

**Interfaces:**
- Consumes: `settings.SITE_URL`, `ArticlePage`, `ArticleCategory`, `Mattress`, `productUrl`'s shape.
- Produces: `GET /sitemap.xml` (`application/xml`) and `GET /robots.txt` (`text/plain`); a `^$` route returning 404.

- [ ] **Step 1: Write the failing test**

Create `Backend/core/tests_seo_views.py`:

```python
from xml.etree import ElementTree

from django.test import TestCase
from wagtail.models import Page

from articles.models import ArticleIndexPage, ArticlePage
from articles.snippets import ArticleCategory
from mattress.models import Mattress

NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}


class SitemapTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        root = Page.objects.get(depth=1)
        cls.index = ArticleIndexPage(title="مقالات", slug="articles")
        root.add_child(instance=cls.index)

        cls.live = ArticlePage(title="منتشرشده", slug="live", excerpt="x", body=[])
        cls.index.add_child(instance=cls.live)
        cls.live.save_revision().publish()

        cls.draft = ArticlePage(title="پیش‌نویس", slug="draft", excerpt="x", body=[])
        cls.index.add_child(instance=cls.draft)

        cls.hidden = ArticlePage(
            title="پنهان", slug="hidden", excerpt="x", body=[], allow_indexing=False
        )
        cls.index.add_child(instance=cls.hidden)
        cls.hidden.save_revision().publish()

        cls.guide = ArticleCategory.objects.create(name="راهنما", slug="rahnama")
        cls.inactive = ArticleCategory.objects.create(
            name="غیرفعال", slug="off", is_active=False
        )
        Mattress.objects.create(
            category="mattress", name="تشک تست", slug="test", price=1000
        )

    def urls(self):
        response = self.client.get("/sitemap.xml")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/xml")
        tree = ElementTree.fromstring(response.content)
        return [loc.text for loc in tree.findall(".//sm:loc", NS)]

    def test_published_articles_are_listed(self):
        self.assertIn("https://salyco.ir/articles/live/", self.urls())

    def test_drafts_are_not_listed(self):
        self.assertNotIn("https://salyco.ir/articles/draft/", self.urls())

    def test_noindex_articles_are_not_listed(self):
        self.assertNotIn("https://salyco.ir/articles/hidden/", self.urls())

    def test_active_categories_are_listed_and_inactive_ones_are_not(self):
        urls = self.urls()
        self.assertIn("https://salyco.ir/articles/category/rahnama/", urls)
        self.assertNotIn("https://salyco.ir/articles/category/off/", urls)

    def test_products_are_listed(self):
        self.assertIn("https://salyco.ir/products/mattress/test", self.urls())

    def test_the_index_and_static_routes_are_listed(self):
        urls = self.urls()
        for path in ("/articles/", "/", "/products", "/about", "/contact", "/dealers"):
            self.assertIn(f"https://salyco.ir{path}", urls)

    def test_no_url_can_contain_a_local_host(self):
        # The reason every URL is built from SITE_URL rather than the request.
        body = self.client.get("/sitemap.xml").content.decode()
        for forbidden in ("localhost", "127.0.0.1", "backend:8000"):
            self.assertNotIn(forbidden, body)


class RobotsTests(TestCase):
    def test_it_is_served_as_plain_text(self):
        response = self.client.get("/robots.txt")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/plain")

    def test_it_disallows_the_cms_and_points_at_the_sitemap(self):
        body = self.client.get("/robots.txt").content.decode()
        self.assertIn("Disallow: /cms/", body)
        self.assertIn("Disallow: /admin/", body)
        self.assertIn("Sitemap: https://salyco.ir/sitemap.xml", body)


class RootPathTests(TestCase):
    def test_a_request_for_the_bare_root_is_a_404_not_a_crash(self):
        # nginx sends "/" to the SPA, so this only happens if a proxy is
        # misconfigured — and a 404 explains itself, where a 500 does not.
        self.assertEqual(self.client.get("/").status_code, 404)
```

- [ ] **Step 2: Run it and watch it fail**

Run: `python manage.py test core.tests_seo_views -v 2`

Expected: FAIL — `/sitemap.xml` and `/robots.txt` 404.

- [ ] **Step 3: Write the views**

Create `Backend/core/seo_views.py`:

```python
"""The crawler surface: /sitemap.xml and /robots.txt.

Both were returning the SPA shell — HTTP 200 with Content-Type text/html — so a
crawler asking for a sitemap was handed a React application.

Every URL here is built from settings.SITE_URL rather than from the request, for
the same reason the article metadata is: three proxies sit between Django and
the client, and a canonical sitemap entry pointing at "http://backend:8000/" is
worse than no sitemap.
"""
from django.conf import settings
from django.http import HttpResponse
from django.utils.html import escape
from django.views.decorators.http import require_GET

from articles.models import ArticleIndexPage, ArticlePage
from articles.snippets import ArticleCategory
from mattress.models import Mattress

# Routes the SPA owns. They are static, so they are listed here rather than
# crawled — there is nothing to enumerate.
STATIC_PATHS = ["/", "/products", "/about", "/contact", "/dealers"]


def _url(loc, lastmod=None):
    parts = [f"<loc>{escape(loc)}</loc>"]
    if lastmod:
        parts.append(f"<lastmod>{lastmod.date().isoformat()}</lastmod>")
    return f"<url>{''.join(parts)}</url>"


@require_GET
def sitemap_xml(request):
    entries = [_url(f"{settings.SITE_URL}{path}") for path in STATIC_PATHS]

    index = ArticleIndexPage.objects.live().first()
    if index is not None:
        entries.append(_url(f"{settings.SITE_URL}{index.get_url()}"))

    for category in ArticleCategory.objects.filter(is_active=True):
        path = f"/articles/category/{category.slug}/"
        entries.append(_url(f"{settings.SITE_URL}{path}"))

    articles = (
        ArticlePage.objects.live()
        .public()
        .filter(allow_indexing=True)
        .order_by("-first_published_at")
    )
    for article in articles:
        entries.append(
            _url(f"{settings.SITE_URL}{article.get_url()}", article.last_published_at)
        )

    # Products carry no <lastmod>. Mattress has no created_at or updated_at, and
    # stamping timezone.now() would claim the whole catalogue changed on every
    # fetch — which devalues the signal for the pages that do carry a real date.
    # is_available is ignored on purpose: an out-of-stock page still holds
    # inbound links, and stock state belongs in Offer.availability.
    for product in Mattress.objects.all().only("category", "slug"):
        path = f"/products/{product.category}/{product.slug}"
        entries.append(_url(f"{settings.SITE_URL}{path}"))

    body = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f"{''.join(entries)}</urlset>"
    )
    return HttpResponse(body, content_type="application/xml")


@require_GET
def robots_txt(request):
    lines = [
        "User-agent: *",
        "Allow: /",
        # The CMS and the legacy Django admin are staff surfaces; the API is not
        # a document.
        "Disallow: /cms/",
        "Disallow: /admin/",
        "Disallow: /api/",
        "",
        f"Sitemap: {settings.SITE_URL}/sitemap.xml",
    ]
    return HttpResponse("\n".join(lines) + "\n", content_type="text/plain")
```

- [ ] **Step 4: Route them**

In `Backend/core/urls.py`, add to the imports:

```python
from django.http import HttpResponseNotFound
from django.views.defaults import page_not_found

from core.seo_views import robots_txt, sitemap_xml
```

Append to the end of `urlpatterns`, after the last `path("api/", include(...))`:

```python
    # ── Crawler surface ───────────────────────────────────────────────────────
    path("sitemap.xml", sitemap_xml, name="sitemap"),
    path("robots.txt", robots_txt, name="robots"),
```

Then, after the `if settings.DEBUG:` block, add the Wagtail catch-all and the
root guard — **last, so every explicit route above wins**:

```python
# ── Article CMS ───────────────────────────────────────────────────────────────
# Mounted at the root, not under "articles/". Wagtail resolves a page's URL by
# walking the page tree from Site.root_page, not by the URLconf, so a request
# for /articles/foo/ stripped to "foo/" by an "articles/" prefix would look for a
# child of the Wagtail Root called "foo" and 404.
#
# The empty pattern below precedes it so a request for "/" is a 404 rather than
# a TemplateDoesNotExist 500. nginx sends "/" to the SPA, so this only fires when
# a proxy is misconfigured — and a 404 explains itself where a 500 does not.
urlpatterns += [
    path("", lambda request: HttpResponseNotFound("Not found")),
    path("", include(wagtail_urls)),
]
```

with `from wagtail import urls as wagtail_urls` added to the imports, and
`page_not_found` removed from the import line above if unused.

- [ ] **Step 5: Run the tests**

Run: `python manage.py test core.tests_seo_views -v 2`

Expected: PASS (10 tests).

If `test_products_are_listed` fails on a required field, check
`Mattress.objects.create(...)` in the test against the model's non-null fields
and fill in whatever it demands — do not loosen the model.

- [ ] **Step 6: Commit**

```bash
git add Backend/core/seo_views.py Backend/core/urls.py Backend/core/tests_seo_views.py
git commit -m "feat(seo): real sitemap.xml and robots.txt, and a route to Wagtail

Both paths were returning the SPA shell — HTTP 200 with Content-Type text/html —
so a crawler asking for a sitemap was handed a React application.

Products carry no lastmod: Mattress has no created_at or updated_at, and
stamping now() would claim the whole catalogue changed on every fetch."
```

---

### Task 10: Shared design tokens and article typography

**Files:**
- Create: `Frontend/salyco-front/public/tokens.css`
- Modify: `Frontend/salyco-front/src/index.css`
- Modify: `Backend/articles/static/articles/article.css`
- Create: `Frontend/salyco-front/verify-tokens.mjs`
- Test: `verify-tokens.mjs` itself, plus a built-CSS inspection

**Interfaces:**
- Consumes: `src/index.css`'s existing `@theme` block.
- Produces: `/tokens.css` at the SPA root, defining `--salyco-*` custom properties that both `src/index.css` and `article.css` read.

- [ ] **Step 1: Extract the tokens**

Read every token out of the `@theme` block in `Frontend/salyco-front/src/index.css`
(the block starting at line 46) and write them to
`Frontend/salyco-front/public/tokens.css` as `--salyco-*` custom properties on
`:root`. Keep the existing names' meanings: `--color-brand-navy: #052e5f`
becomes `--salyco-navy: #052e5f`, `--color-text-primary: #1c2b3a` becomes
`--salyco-text-primary`, and so on. The font families move too:

```css
/* Salyco design tokens, from Design.md v2.
 *
 * This file is the single source of truth for the palette. It is plain CSS
 * custom properties rather than Tailwind's @theme because the article pages are
 * Django templates, which cannot compile Tailwind — and duplicating the hex
 * values into a second stylesheet would drift silently on the next brand tweak.
 *
 * src/index.css maps Tailwind's names onto these; nginx serves this file from
 * the SPA root at /tokens.css, exactly as it already serves /fonts/. */
:root {
  --salyco-navy: #052e5f;
  --salyco-white: #ffffff;
  --salyco-warm-white: #f7f5f0;
  --salyco-mist: #e4e5e2;
  --salyco-action-hover: #032247;
  --salyco-text-primary: #1c2b3a;
  --salyco-text-secondary: #526171;
  --salyco-border-control: #788594;
  --salyco-status-success: #21633e;
  --salyco-status-success-bg: #eef7f0;
  /* … continue for every remaining token in the @theme block, one for one. */

  --salyco-font-persian: "Vazirmatn", sans-serif;
  --salyco-font-sans: "Inter", "Vazirmatn", sans-serif;
}
```

Do not invent a token that is not in `@theme`, and do not drop one.

- [ ] **Step 2: Point `@theme` at the variables**

In `Frontend/salyco-front/src/index.css`, replace the `@theme { ... }` block's
declarations with the same names mapped onto the shared variables, and change
`@theme` to `@theme inline`:

```css
/* `inline` is required, not cosmetic: without it Tailwind declares an
   intermediate theme variable and emits `var(--color-brand-navy)`, which
   resolves to a value Tailwind may tree-shake out of the bundle. With `inline`
   the utility carries `var(--salyco-navy)` directly, so the palette is whatever
   tokens.css says it is. */
@theme inline {
  --font-persian: var(--salyco-font-persian);
  --font-sans: var(--salyco-font-sans);

  --color-brand-navy: var(--salyco-navy);
  --color-brand-white: var(--salyco-white);
  --color-brand-warm-white: var(--salyco-warm-white);
  --color-brand-mist: var(--salyco-mist);
  --color-action-hover: var(--salyco-action-hover);
  --color-text-primary: var(--salyco-text-primary);
  --color-text-secondary: var(--salyco-text-secondary);
  --color-border-control: var(--salyco-border-control);
  --color-status-success: var(--salyco-status-success);
  --color-status-success-bg: var(--salyco-status-success-bg);
  /* … one line per remaining token. */
}
```

- [ ] **Step 3: Write the agreement check**

Create `Frontend/salyco-front/verify-tokens.mjs`:

```js
/**
 * Asserts that public/tokens.css and src/index.css agree.
 *
 * These two files are a mapping, not a source of truth and a copy: tokens.css
 * declares --salyco-x and index.css maps --color-x onto it. A token added to one
 * and not the other is invisible in review and half-repaints the site — the
 * React pages keep the old colour while the article pages take the new one.
 *
 * Safe to delete once this stops being useful.
 */
import { readFileSync } from "node:fs";

const tokens = readFileSync("public/tokens.css", "utf8");
const theme = readFileSync("src/index.css", "utf8");

const declared = new Set(
  [...tokens.matchAll(/--salyco-([a-z0-9-]+)\s*:/g)].map((m) => m[1]),
);

const mapped = [...theme.matchAll(/--(?:color|font)-([a-z0-9-]+)\s*:\s*var\(--salyco-([a-z0-9-]+)\)/g)]
  .map((m) => m[2]);

const failures = [];

for (const name of mapped) {
  if (!declared.has(name)) {
    failures.push(`index.css maps --salyco-${name}, which tokens.css never declares`);
  }
}

for (const name of declared) {
  if (!mapped.includes(name) && !name.startsWith("font-")) {
    failures.push(`tokens.css declares --salyco-${name}, which index.css never maps`);
  }
}

if (failures.length) {
  console.error("Token drift:\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}

console.log(`OK — ${declared.size} tokens declared, ${mapped.length} mapped.`);
```

- [ ] **Step 4: Run it**

Run, from `Frontend/salyco-front/`:

```bash
node verify-tokens.mjs
```

Expected: `OK — N tokens declared, N mapped.` Any line it prints is a real gap
between the two files; fix the file it names.

- [ ] **Step 5: Build and inspect the compiled CSS**

Run:

```bash
npm run build
grep -o 'bg-brand-navy{[^}]*}' dist/assets/*.css | head -3
```

Expected: the rule carries `var(--salyco-navy)`, not `var(--color-brand-navy)` and
not a literal `#052e5f`. If it shows `var(--color-brand-navy)`, `@theme inline`
did not take effect — check for a stray second `@theme` block.

This step is the whole risk of the refactor. A green build proves nothing here;
only the emitted rule does.

- [ ] **Step 6: Check the homepage visually**

Run `npm run dev` and open the homepage. Confirm the navy header, the warm-white
body and the mist borders still render — a broken mapping shows up as
transparent or black surfaces, not as an error. Check at 360px and at 1440px.

- [ ] **Step 7: Write the article typography**

Append to `Backend/articles/static/articles/article.css`, reading the same tokens:

```css
body.article-page {
  margin: 0;
  background: var(--salyco-warm-white);
  color: var(--salyco-text-primary);
  font-family: var(--salyco-font-persian);
  font-size: 16px;
  line-height: 30px;
}

.article-body__paragraph,
.article__excerpt,
.article__subtitle {
  font-size: 16px;
  line-height: 30px;
  margin-block: 0 16px;
}

.article-body__heading--h2 {
  font-size: 28px;
  line-height: 44px;
  color: var(--salyco-navy);
  margin-block: 40px 16px;
}

.article-body__heading--h3 {
  font-size: 20px;
  line-height: 32px;
  color: var(--salyco-navy);
  margin-block: 32px 12px;
}

.article-body__paragraph a { color: var(--salyco-navy); text-underline-offset: 3px; }

.article-quote {
  margin-inline: 0;
  padding-inline-start: 16px;
  border-inline-start: 3px solid var(--salyco-navy);
}

.article-figure { margin-inline: 0; }
.article-figure__img { width: 100%; height: auto; border-radius: 12px; }
.article-figure__caption { font-size: 14px; color: var(--salyco-text-secondary); }

.article-callout {
  border-radius: 12px;
  padding: 16px;
  margin-block: 24px;
  border-inline-start: 4px solid var(--salyco-navy);
  background: var(--salyco-white);
  box-shadow: 0 1px 4px rgba(5, 46, 95, 0.06);
}

.article-callout--warning { border-inline-start-color: var(--salyco-status-error); }
.article-callout--tip { border-inline-start-color: var(--salyco-status-success); }

.article-faq__item {
  border-block-end: 1px solid var(--salyco-mist);
  padding-block: 12px;
}

.article-faq__question { cursor: pointer; font-weight: 600; }

/* Latin text and numerals inside Persian prose need their own direction, or a
   phone number or a model code reorders visually. */
.article-body [dir="ltr"], .article-body code { direction: ltr; unicode-bidi: isolate; }
```

If `--salyco-status-error` is not among the tokens, add it to `tokens.css` and
map it in `index.css` — the `@theme` block has a status-error colour under
whatever name it currently uses; use that exact value.

- [ ] **Step 8: Run the whole backend suite**

Run, from `Backend/`:

```bash
python manage.py test articles core -v 1
```

Expected: PASS. Then view an article at 360px and 1024px and confirm the 640px
measure holds and nothing overflows horizontally.

- [ ] **Step 9: Commit**

```bash
git add Frontend/salyco-front/public/tokens.css Frontend/salyco-front/src/index.css Frontend/salyco-front/verify-tokens.mjs Backend/articles/static/articles/article.css
git commit -m "refactor(css): one source of truth for the design tokens

The palette moves to public/tokens.css as plain custom properties and
src/index.css maps Tailwind's names onto them with @theme inline, so the Django
article templates and the React app read one palette instead of two that drift.
The compiled rule carries var(--salyco-navy) rather than a literal hex, which is
what makes a brand tweak reach both halves of the site.

verify-tokens.mjs fails loudly if a token is added to one file and not the
other, which is otherwise an invisible half-repaint."
```

---

### Task 11: The API, reimplemented over the pages

**Files:**
- Modify: `Backend/articles/views.py`
- Modify: `Backend/articles/serializers.py`
- Test: `Backend/articles/tests_api.py` (create)

**Interfaces:**
- Consumes: `ArticlePage` (Task 4), `body_to_text` (Task 5).
- Produces: unchanged response shapes at `GET /api/articles/` (a bare array of `title`, `slug`, `excerpt`, `image`, `created_at`) and `GET /api/articles/<slug>/` (the same plus `content`, `updated_at`).

- [ ] **Step 1: Write the failing test**

Create `Backend/articles/tests_api.py`:

```python
from django.test import TestCase
from wagtail.models import Page

from articles.models import ArticleIndexPage, ArticlePage


class ArticleApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        root = Page.objects.get(depth=1)
        cls.index = ArticleIndexPage(title="مقالات", slug="articles")
        root.add_child(instance=cls.index)

        cls.article = ArticlePage(
            title="راهنمای تشک",
            slug="rahnama",
            excerpt="خلاصه مقاله",
            body=[("paragraph", "<p>متن کامل مقاله</p>")],
        )
        cls.index.add_child(instance=cls.article)
        cls.article.save_revision().publish()

        cls.draft = ArticlePage(
            title="پیش‌نویس", slug="draft", excerpt="x", body=[("paragraph", "<p>پنهان</p>")]
        )
        cls.index.add_child(instance=cls.draft)

    def test_the_list_is_a_bare_array(self):
        # The React components call .slice(0, 4) on the response, so a pagination
        # wrapper here would break the homepage silently.
        response = self.client.get("/api/articles/")
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.json(), list)

    def test_the_list_keeps_its_field_names(self):
        entry = self.client.get("/api/articles/").json()[0]
        self.assertEqual(
            sorted(entry), ["created_at", "excerpt", "image", "slug", "title"]
        )

    def test_the_detail_keeps_its_field_names(self):
        entry = self.client.get("/api/articles/rahnama/").json()
        self.assertEqual(
            sorted(entry),
            ["content", "created_at", "excerpt", "image", "slug", "title", "updated_at"],
        )

    def test_the_detail_content_is_plain_text(self):
        # The old column was a TextField rendered inside whitespace-pre-wrap, so
        # consumers get text, not HTML. Sending markup here would show literal
        # tags to anyone still reading the field.
        content = self.client.get("/api/articles/rahnama/").json()["content"]
        self.assertEqual(content, "متن کامل مقاله")
        self.assertNotIn("<p>", content)

    def test_drafts_are_not_listed(self):
        slugs = [entry["slug"] for entry in self.client.get("/api/articles/").json()]
        self.assertNotIn("draft", slugs)

    def test_a_draft_detail_is_404(self):
        self.assertEqual(self.client.get("/api/articles/draft/").status_code, 404)

    def test_the_slug_is_the_persian_one(self):
        self.assertEqual(
            self.client.get("/api/articles/rahnama/").json()["slug"], "rahnama"
        )

    def test_the_query_count_does_not_grow_with_the_number_of_articles(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        # The invariant is flatness, not a magic number. An N+1 list is one query
        # per row, so comparing a small list against a large one catches it
        # without pinning a count that a Wagtail upgrade could legitimately
        # change — which would make this test cry wolf and then get deleted.
        with CaptureQueriesContext(connection) as small:
            self.client.get("/api/articles/")

        for i in range(6):
            extra = ArticlePage(
                title=f"مقاله {i}", slug=f"a-{i}", excerpt="x", body=[]
            )
            self.index.add_child(instance=extra)
            extra.save_revision().publish()

        with CaptureQueriesContext(connection) as large:
            self.client.get("/api/articles/")

        self.assertEqual(len(small), len(large))
```

That last test is the one that would otherwise be written wrong: seeding the extra
articles *before* the first capture would compare two identical lists and pass
even with a per-row query.

- [ ] **Step 2: Run it and watch it fail**

Run: `python manage.py test articles.tests_api -v 2`

Expected: FAIL — the list returns empty, because the views still query
`Article.objects` and the test only creates pages.

- [ ] **Step 3: Rewrite the views**

Replace the body of `Backend/articles/views.py`:

```python
"""The article API, now served from the Wagtail pages.

The response shape is unchanged on purpose. FeaturedArticles.jsx and
Articles.jsx read these fields by name and call .slice() on the list, so a
pagination wrapper or a renamed key would break the homepage without a single
test failing — which is why tests_api.py pins both shapes rather than the values.
"""
from rest_framework import generics
from rest_framework.permissions import AllowAny

from .models import ArticlePage
from .serializers import ArticleDetailSerializer, ArticleListSerializer


def published_articles():
    """Live, public articles with their joins done.

    select_related here is what keeps a list request at a fixed number of queries
    instead of one per row; prefetch_related does the same for tags, which the
    serializer does not read today but a later filter will.
    """
    return (
        ArticlePage.objects.live()
        .public()
        .select_related("category", "author", "hero_image")
        .order_by("-first_published_at", "-id")
    )


class ArticleListCreate(generics.ListCreateAPIView):
    serializer_class = ArticleListSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return published_articles()


class ArticleDetail(generics.RetrieveAPIView):
    serializer_class = ArticleDetailSerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"

    def get_queryset(self):
        return published_articles()
```

- [ ] **Step 4: Rewrite the serializers**

Replace the body of `Backend/articles/serializers.py`:

```python
"""Serializers for the public article API.

Deliberately hand-written rather than ModelSerializers: the fields keep the
legacy names (`created_at`, `updated_at`, `content`, `image`) even though the
underlying page uses Wagtail's names, because consumers already read those keys.
"""
from rest_framework import serializers

from .models import ArticlePage
from .services import body_to_text


class ArticleListSerializer(serializers.ModelSerializer):
    created_at = serializers.DateTimeField(source="first_published_at", read_only=True)
    image = serializers.SerializerMethodField()

    class Meta:
        model = ArticlePage
        fields = ["title", "slug", "excerpt", "image", "created_at"]

    def get_image(self, page):
        """An absolute URL, matching what the old ImageField produced.

        The old column serialised to a path the frontend joined onto API_URL;
        getArticleImageUrl() accepts either, so this stays absolute and needs no
        frontend change.
        """
        if not page.hero_image:
            return None
        return page.hero_image.get_rendition("width-1200").url


class ArticleDetailSerializer(ArticleListSerializer):
    content = serializers.SerializerMethodField()
    updated_at = serializers.DateTimeField(source="last_published_at", read_only=True)

    class Meta(ArticleListSerializer.Meta):
        fields = ArticleListSerializer.Meta.fields + ["content", "updated_at"]

    def get_content(self, page):
        # Plain text, one paragraph per line — what the old TextField held and
        # what ArticleDetail.jsx rendered inside whitespace-pre-wrap. HTML here
        # would print literal tags for any consumer still reading this field.
        return body_to_text(page.body)
```

If `first_published_at` is null for a draft-facing request the field serialises
as `None`; that is correct and matches the old `created_at` being present on
every row. For a live article Wagtail always sets it on publish.

- [ ] **Step 5: Run the tests**

Run: `python manage.py test articles.tests_api -v 2`

Expected: PASS (8 tests).

- [ ] **Step 6: Confirm the homepage still works**

Run `python manage.py runserver` and `npm run dev`, then open the homepage and
scroll to «از وبلاگ سالیکو». The four cards must render with titles and dates —
that component reads `published_at || created_at`, and `created_at` is the field
this change kept. Then open `/search?q=تشک`.

- [ ] **Step 7: Commit**

```bash
git add Backend/articles/views.py Backend/articles/serializers.py Backend/articles/tests_api.py
git commit -m "feat(cms): serve the article API from the Wagtail pages

The response shape is unchanged — bare array, same keys — because
FeaturedArticles.jsx and Articles.jsx read those names and call .slice() on the
list, and a pagination wrapper would break the homepage without a test failing.
tests_api.py now pins both shapes.

content stays plain text: that is what the old TextField held and what the React
detail page rendered inside whitespace-pre-wrap, so HTML here would print
literal tags for any consumer still reading the field."
```

---

### Task 12: Frontend — delete the React article pages, make the links real

**Files:**
- Delete: `Frontend/salyco-front/src/pages/Articles.jsx`
- Delete: `Frontend/salyco-front/src/pages/ArticleDetail.jsx`
- Delete: `Frontend/salyco-front/src/components/ArticleCard.jsx` (an orphan — nothing imports it; the `Articles` page defines its own local `ArticleCard`)
- Create: `Frontend/salyco-front/src/config/serverRoutes.js`
- Modify: `Frontend/salyco-front/src/App.jsx`
- Modify: `Frontend/salyco-front/src/components/FeaturedArticles.jsx`
- Modify: `Frontend/salyco-front/src/components/Navbar.jsx`
- Modify: `Frontend/salyco-front/src/components/AccountSheet.jsx`
- Modify: `Frontend/salyco-front/src/components/home/QuickActions.jsx`
- Modify: `Frontend/salyco-front/src/components/AboutFooter.jsx`
- Modify: `Frontend/salyco-front/nginx.conf`

**Interfaces:**
- Consumes: `/articles/` served by Django (Tasks 7, 8) and `/cms/` (Task 1).
- Produces: `SERVER_ROUTES` and `isServerRoute(path)` from `src/config/serverRoutes.js`.

- [ ] **Step 1: Write the helper**

Create `Frontend/salyco-front/src/config/serverRoutes.js`:

```js
/**
 * Routes served by Django, not by the SPA.
 *
 * A React Router <Link to="/articles/…"> would client-render a route that no
 * longer exists and leave the visitor on a blank page instead of fetching the
 * server-rendered article. Every one of these therefore has to be a real anchor,
 * which also means the browser does a full page load and gets the article's
 * title, metadata and body from the server — the entire point of moving the
 * pages to Wagtail.
 */
export const SERVER_ROUTES = ["/articles"];

/** True when `path` is served by Django rather than by React Router. */
export const isServerRoute = (path) =>
  typeof path === "string" &&
  SERVER_ROUTES.some((root) => path === root || path.startsWith(`${root}/`));
```

- [ ] **Step 2: Remove the routes**

In `Frontend/salyco-front/src/App.jsx`:

- Delete the `import Articles from "./pages/Articles";` and
  `import ArticleDetail from "./pages/ArticleDetail";` lines.
- Delete `<Route path="/articles" element={<Articles />} />` and
  `<Route path="/articles/:slug" element={<ArticleDetail />} />`.
- Leave every other route alone.

Delete the two page files and the orphaned card:

```bash
git rm Frontend/salyco-front/src/pages/Articles.jsx \
       Frontend/salyco-front/src/pages/ArticleDetail.jsx \
       Frontend/salyco-front/src/components/ArticleCard.jsx
```

`ArticleDetail.jsx` also carried `getArticleImageUrl` and `formatArticleDate`
from `src/utils/articleImage.js`; `FeaturedArticles.jsx` still imports both, so
that util file stays.

- [ ] **Step 3: Make the homepage links real anchors**

In `Frontend/salyco-front/src/components/FeaturedArticles.jsx`, add the import:

```js
import { isServerRoute } from "../config/serverRoutes";
```

and replace the three `<Link>` elements. The two article links and the
"همه مقالات" link all point at `/articles`, so all three become anchors — the
file's `Link` import stays only if something else in it still uses it; if not,
drop it from the import line.

The featured-story link, before:

```jsx
<Link
  to={`/articles/${featured.slug}`}
  className="group relative flex min-h-[360px] flex-col justify-end overflow-hidden rounded-xl shadow-[0_4px_16px_rgba(5,46,95,0.1)]"
>
```

after:

```jsx
<a
  href={`/articles/${featured.slug}/`}
  className="group relative flex min-h-[360px] flex-col justify-end overflow-hidden rounded-xl shadow-[0_4px_16px_rgba(5,46,95,0.1)]"
>
```

and its closing `</Link>` becomes `</a>`. Apply the same substitution to the two
numbered-list links (`to={`/articles/${article.slug}`}` →
`href={`/articles/${article.slug}/`}`) and to the "همه مقالات" link
(`to="/articles"` → `href="/articles/"`).

Note the trailing slash on every one: Wagtail's `WAGTAIL_APPEND_SLASH` would
301 `/articles/foo` to `/articles/foo/`, and a redirect on every article click is
a needless round trip.

- [ ] **Step 4: Make the nav link a real anchor**

In `Frontend/salyco-front/src/components/Navbar.jsx`, flag the articles entry the
same way the products entry is already flagged:

```js
const categories = [
  { type: "menu", key: "products" },
  // Served by Django, so the row renders an <a> for it rather than a NavLink.
  // A NavLink would client-render a route App.jsx no longer declares.
  { type: "external", label: "راهنمای انتخاب", icon: BookOpen, to: "/articles/" },
  { label: "خدمات پس از فروش", icon: ClipboardList, to: "/warranty/my" },
  { label: "نمایندگی", icon: MapPin, to: "/dealers" },
  { label: "تماس با ما", icon: Phone, to: "/contact" },
  { label: "درباره ما", icon: Info, to: "/about" },
];
```

and add a branch in the row's map, next to the existing `if (type === "menu")`:

```jsx
if (type === "external") {
  return (
    <a
      key={to}
      href={to}
      className="relative flex items-center gap-2 rounded-lg px-3 py-1.5 sm:px-4
                 font-persian text-sm font-semibold whitespace-nowrap
                 transition-all duration-200 text-text-primary
                 hover:bg-brand-warm-white hover:text-brand-navy"
    >
      <Icon size={15} strokeWidth={2} />
      {label}
    </a>
  );
}
```

`Icon` and `label` come from the existing map's destructuring, and the
`className` above is the string the `NavLink` branch already uses — read the
current JSX and copy its classes rather than trusting the transcription here,
because the active-state classes on the `NavLink` branch are driven by its
`isActive` callback and do not belong on an anchor.

- [ ] **Step 5: Make the remaining `/articles` links real anchors**

In `Frontend/salyco-front/src/components/AccountSheet.jsx`, the row map at line
~208 renders `<Link key={to} to={to} onClick={onClose} className={rowClass}>`.
Change it to branch on the helper:

```jsx
{isServerRoute(to) ? (
  <a key={to} href={to} className={rowClass}>
    <Icon size={18} />
    {label}
  </a>
) : (
  <Link key={to} to={to} onClick={onClose} className={rowClass}>
    <Icon size={18} />
    {label}
  </Link>
)}
```

Match the existing children rather than the `Icon size={18}` guess above — read
the current JSX and keep it, changing only the element. Add
`import { isServerRoute } from "../config/serverRoutes";` and give the articles
entry the trailing slash: `to: "/articles/"`.

In `Frontend/salyco-front/src/components/home/QuickActions.jsx`, the card map at
line ~144 renders `<Link key={key} to={rest.to} className={card}>`. Apply the
same branch, keeping the existing children exactly. Add the import and change the
guide entry to `to: "/articles/"`.

In `Frontend/salyco-front/src/components/AboutFooter.jsx`, `footerLinks` holds
`{ label: "راهنمای انتخاب تشک", href: "/articles" }` and the render picks `<Link>`
for any `/`-prefixed href. Change the entry to `href: "/articles/"` and extend
the condition:

```jsx
{href.startsWith("/") && !isServerRoute(href) ? (
  <Link to={href} className="font-persian text-sm text-white/75 transition-colors hover:text-white">
    {label}
  </Link>
) : (
  <a href={href} className="font-persian text-sm text-white/75 transition-colors hover:text-white">
    {label}
  </a>
)}
```

with `import { isServerRoute } from "../config/serverRoutes";` added.

- [ ] **Step 6: Prove no React Router article link survives**

Run, from `Frontend/salyco-front/`:

```bash
grep -rn 'to="/articles\|to={`/articles' src/ || echo "clean"
grep -rn "pages/Articles\|pages/ArticleDetail\|components/ArticleCard" src/ || echo "clean"
```

Expected: both print `clean`. Any hit is a link that would client-render a route
`App.jsx` no longer declares.

- [ ] **Step 7: Route the paths to Django in nginx**

In `Frontend/salyco-front/nginx.conf`, add these locations **before** the
image-negotiation regex and the SPA fallback, next to the existing `^~ /api/`
block:

```nginx
    # ── Article CMS (server-rendered by Django) ─────────────────────────────
    # ^~ so the image-negotiation regex below can never intercept these, the
    # same reason /api/ uses it. The bare /articles is an exact match so it 301s
    # to the directory form rather than being proxied with an empty remainder.
    location = /articles {
        return 301 /articles/;
    }

    location ^~ /articles/ {
        proxy_pass http://django;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $forwarded_proto;
    }

    # The Wagtail editorial admin. ^~ for the same reason as /admin/ above.
    location ^~ /cms/ {
        proxy_pass http://django;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $forwarded_proto;
    }

    # Exact matches, so a future /sitemap-images.xml is not silently swallowed.
    location = /sitemap.xml {
        proxy_pass http://django;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-Proto $forwarded_proto;
    }

    location = /robots.txt {
        proxy_pass http://django;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-Proto $forwarded_proto;
    }
```

`/tokens.css` needs no location: it is a file in the SPA's `public/` directory, so
Vite copies it to the document root and the existing `location /` serves it, the
way `/fonts/` is already served.

- [ ] **Step 8: Verify the container config parses**

Run:

```bash
docker compose build frontend
docker compose run --rm frontend nginx -t
```

Expected: `syntax is ok` / `test is successful`. If `nginx -t` is not available
in the image, `docker compose up -d frontend` and check
`docker compose logs frontend` for a config error instead.

- [ ] **Step 9: Build the SPA and check nothing is broken**

Run, from `Frontend/salyco-front/`:

```bash
npm run build
node verify-tokens.mjs
```

Expected: the build succeeds with no unresolved import — a leftover
`pages/Articles` reference fails here — and the token check passes.

- [ ] **Step 10: Commit**

```bash
git add -A Frontend/salyco-front
git commit -m "feat(frontend): articles are Django pages now

Deleting the two React article pages is not enough on its own: a React Router
<Link to=\"/articles/…\"> would client-render a route App.jsx no longer declares
and leave the visitor on a blank page. Every article link therefore becomes a
real anchor, which is also what makes the click a full page load that gets the
server-rendered body, title and metadata.

config/serverRoutes.js is the one place that decides which paths belong to
Django, so a second server-rendered section later is a one-line change.

nginx routes /articles/, /cms/, /sitemap.xml and /robots.txt to Django; the bare
/articles is an exact match that 301s to the directory form."
```

---

### Task 13: Editorial branding for the CMS

**Files:**
- Create: `Backend/articles/wagtail_hooks.py`
- Modify: `Backend/articles/apps.py`
- Test: `Backend/articles/tests_admin.py` (create)

**Interfaces:**
- Consumes: `ArticleIndexPage` (Task 4).
- Produces: a `مقالات` admin menu item pointing at the index, and a branded admin.

- [ ] **Step 1: Write the failing test**

Create `Backend/articles/tests_admin.py`:

```python
from django.contrib.auth import get_user_model
from django.test import TestCase
from wagtail.models import Page

from articles.models import ArticleIndexPage

User = get_user_model()


class AdminAccessTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        root = Page.objects.get(depth=1)
        cls.index = ArticleIndexPage(title="مقالات", slug="articles")
        root.add_child(instance=cls.index)
        cls.staff = User.objects.create_user(
            username="editor", password="x", is_staff=True
        )

    def test_an_anonymous_visitor_is_sent_to_the_cms_login(self):
        response = self.client.get("/cms/")
        self.assertIn("/cms/login/", response["Location"])

    def test_a_staff_user_reaches_the_dashboard(self):
        self.client.force_login(self.staff)
        response = self.client.get("/cms/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("مدیریت محتوای سالیکو", response.content.decode())

    def test_the_articles_pages_are_listed_in_the_explorer(self):
        self.client.force_login(self.staff)
        response = self.client.get("/cms/pages/")
        self.assertEqual(response.status_code, 200)

    def test_an_anonymous_visitor_cannot_reach_the_editor(self):
        response = self.client.get("/cms/pages/")
        self.assertNotEqual(response.status_code, 200)
```

- [ ] **Step 2: Run it and watch it fail**

Run: `python manage.py test articles.tests_admin -v 2`

Expected: `test_a_staff_user_reaches_the_dashboard` FAILS — the admin shows
Wagtail's own name, not the Salyco one.

- [ ] **Step 3: Write the hooks**

Create `Backend/articles/wagtail_hooks.py`:

```python
"""Editorial branding for the CMS.

Everything here goes through a supported Wagtail hook. The design doc's §12 is
explicit that over-customising Wagtail's internals makes upgrades expensive, and
a forked admin is the thing most likely to make the next two specs painful — so
there is no template override and no monkey-patching, only the documented
extension points.
"""
from django.templatetags.static import static
from django.urls import reverse
from wagtail import hooks
from wagtail.admin.menu import MenuItem


@hooks.register("register_admin_menu_item")
def register_articles_menu_item():
    """A direct link to the articles index.

    Without this an editor has to understand Wagtail's page tree to find their
    work. With it, «مقالات» is one click from the dashboard.
    """
    return MenuItem(
        "مقالات",
        reverse("wagtailadmin_pages:edit", args=[_articles_index_id()]),
        icon_name="doc-full-inverse",
        order=100,
    )


def _articles_index_id():
    """The articles index page id, or the page explorer when there is none.

    Resolved lazily and defensively: this runs while the admin menu is built, and
    a database error here would take down the whole CMS — including the screen an
    editor would use to fix the problem.
    """
    from articles.models import ArticleIndexPage

    index = ArticleIndexPage.objects.first()
    if index is None:
        return 1
    return index.id


@hooks.register("construct_main_menu")
def hide_unused_menu_items(request, menu_items):
    """Drop the menu entries this project has no content for.

    Wagtail ships a full editorial surface: Forms, Documents, Reports. None of
    them is used here, and a menu of things an editor cannot use is worse than a
    short one.
    """
    menu_items[:] = [
        item for item in menu_items if item.name not in ("forms", "documents")
    ]


@hooks.register("insert_global_admin_css")
def admin_css():
    return static("articles/admin.css")
```

Add `'docs'` to the filtered names only if the project truly uses no Wagtail
Documents — check `/cms/documents/` after this task and adjust. Leave the filter
list as `("forms", "documents")` for now.

- [ ] **Step 4: Write the admin CSS**

Create `Backend/articles/static/articles/admin.css`:

```css
/* A small amount of branding for the CMS. Not a theme: the goal is that an
   editor recognises the tool as Salyco's, not that it stops looking like
   Wagtail — a heavily restyled admin is what makes an upgrade expensive.

   Direction is set on the editing surfaces only. Setting it on <body> would
   flip the slug, URL and email inputs, which genuinely breaks them. */
:root {
  --w-color-primary: #052e5f;
  --w-color-primary-200: #0a4a94;
}

.article-admin-editor [contenteditable="true"],
.w-draftail-editor__document {
  direction: rtl;
  text-align: right;
}

/* Slugs, URLs and addresses stay left-to-right even inside an RTL form. */
input[type="url"],
input[name$="slug"],
input[name$="url"],
input[type="email"] {
  direction: ltr;
  text-align: left;
}
```

- [ ] **Step 5: Point the app config at the hooks**

In `Backend/articles/apps.py`, add a verbose name so the app reads correctly in
the admin:

```python
class ArticlesConfig(AppConfig):
    name = 'articles'
    verbose_name = 'مقالات'
```

- [ ] **Step 6: Run the tests**

Run: `python manage.py test articles.tests_admin -v 2`

Expected: PASS (4 tests).

Then open `/cms/` in a browser as a staff user and confirm: the word سالیکو
appears in the header, the menu has a «مقالات» entry, and the editor body types
right-to-left while the slug field types left-to-right.

- [ ] **Step 7: Commit**

```bash
git add Backend/articles/wagtail_hooks.py Backend/articles/static/articles/admin.css Backend/articles/apps.py Backend/articles/tests_admin.py
git commit -m "feat(cms): brand the editorial admin and add a direct articles menu item

Branding goes through supported hooks only — no template override, no
monkey-patching — because a forked admin is what makes the next two specs
expensive.

Direction is set on the editing surfaces rather than on <body>: a blanket
direction: rtl flips the slug, URL and email inputs, which breaks them."
```

---

### Task 14: The setup command

**Files:**
- Create: `Backend/articles/management/__init__.py`
- Create: `Backend/articles/management/commands/__init__.py`
- Create: `Backend/articles/management/commands/setup_salyco_cms.py`
- Modify: `Backend/articles/tests_pages.py` (remove the skip from Task 4 Step 5)
- Test: `Backend/articles/tests_setup_command.py` (create)

**Interfaces:**
- Consumes: `ArticleIndexPage` (Task 4), `GlobalSeoSettings` (Task 2), `settings.SITE_URL`.
- Produces: the `setup_salyco_cms` management command. It is idempotent; running it twice changes nothing.

- [ ] **Step 1: Write the failing test**

Create `Backend/articles/tests_setup_command.py`:

```python
from django.conf import settings
from django.core.management import call_command
from django.test import TestCase
from wagtail.models import Collection, Page, Site

from articles.models import ArticleIndexPage
from articles.snippets import GlobalSeoSettings


class SetupCommandTests(TestCase):
    def test_it_creates_the_articles_index_under_the_root(self):
        call_command("setup_salyco_cms")
        index = ArticleIndexPage.objects.get()
        self.assertEqual(index.slug, "articles")
        self.assertEqual(index.get_parent().depth, 1)
        self.assertEqual(index.get_url(), "/articles/")

    def test_it_points_the_default_site_at_the_wagtail_root(self):
        call_command("setup_salyco_cms")
        site = Site.objects.get(is_default_site=True)
        self.assertEqual(site.hostname, "salyco.ir")
        self.assertTrue(site.root_page.is_root())

    def test_it_matches_the_sites_framework_row_to_the_site_url(self):
        from django.contrib.sites.models import Site as DjangoSite

        call_command("setup_salyco_cms")
        row = DjangoSite.objects.get(pk=settings.SITE_ID)
        self.assertEqual(row.domain, "salyco.ir")

    def test_it_creates_the_collections(self):
        call_command("setup_salyco_cms")
        names = set(Collection.objects.values_list("name", flat=True))
        self.assertLessEqual({"مقالات", "محصولات", "عمومی"}, names)

    def test_it_creates_the_seo_settings_with_the_instagram_handle(self):
        call_command("setup_salyco_cms")
        site = Site.objects.get(is_default_site=True)
        seo = GlobalSeoSettings.for_site(site)
        self.assertEqual(seo.brand_name_fa, "سالیکو")
        self.assertEqual(seo.instagram_url, "https://instagram.com/salyco.ir")

    def test_running_it_twice_creates_nothing_new(self):
        call_command("setup_salyco_cms")
        before = (ArticleIndexPage.objects.count(), Site.objects.count(), Collection.objects.count())
        call_command("setup_salyco_cms")
        after = (ArticleIndexPage.objects.count(), Site.objects.count(), Collection.objects.count())
        self.assertEqual(before, after)

    def test_it_does_not_clobber_an_edited_seo_setting(self):
        call_command("setup_salyco_cms")
        site = Site.objects.get(is_default_site=True)
        seo = GlobalSeoSettings.for_site(site)
        seo.brand_name_fa = "سالیکو تشک"
        seo.save()
        call_command("setup_salyco_cms")
        seo.refresh_from_db()
        self.assertEqual(seo.brand_name_fa, "سالیکو تشک")
```

The last test is the important one: a setup command that resets what an editor
configured is a command nobody dares run twice, and this one has to be safe to
run on every deploy.

- [ ] **Step 2: Run it and watch it fail**

Run: `python manage.py test articles.tests_setup_command -v 2`

Expected: FAIL — `CommandError: Unknown command: 'setup_salyco_cms'`.

- [ ] **Step 3: Write the command**

Create `Backend/articles/management/__init__.py` and
`Backend/articles/management/commands/__init__.py` as empty files.

Create `Backend/articles/management/commands/setup_salyco_cms.py`:

```python
"""Arrange Wagtail's tree, site, collections and settings for Salyco.

Idempotent on purpose: this runs on every deploy, so it creates what is missing
and never overwrites what an editor has changed. A setup command that resets
configured values is a command nobody dares run twice.
"""
from urllib.parse import urlparse

from django.conf import settings
from django.contrib.sites.models import Site as DjangoSite
from django.core.management.base import BaseCommand
from django.db import transaction
from wagtail.models import Collection, Page, Site

from articles.models import ArticleIndexPage
from articles.snippets import GlobalSeoSettings

COLLECTIONS = ["مقالات", "محصولات", "عمومی"]

SEO_DEFAULTS = {
    "brand_name": "Salyco",
    "brand_name_fa": "سالیکو",
    "default_title_suffix": "سالیکو",
    "default_meta_description": "راهنمای انتخاب تشک و خرید خواب بهتر از سالیکو.",
    "instagram_url": "https://instagram.com/salyco.ir",
}


class Command(BaseCommand):
    help = "Create the Wagtail site, articles index, collections and SEO settings."

    @transaction.atomic
    def handle(self, *args, **options):
        hostname = urlparse(settings.SITE_URL).hostname
        if not hostname:
            raise ValueError(f"SITE_URL is not a usable URL: {settings.SITE_URL!r}")

        self._sync_sites_framework(hostname)
        root = self._root_page()
        self._ensure_site(root, hostname)
        self._ensure_index(root)
        self._ensure_collections()
        self._ensure_seo_settings()

        self.stdout.write(self.style.SUCCESS("CMS setup complete."))

    def _sync_sites_framework(self, hostname):
        row, _ = DjangoSite.objects.get_or_create(pk=settings.SITE_ID)
        if row.domain != hostname or row.name != hostname:
            row.domain = hostname
            row.name = hostname
            row.save()
            self.stdout.write(f"django.contrib.sites row set to {hostname}")

    def _root_page(self):
        """Wagtail's own Root page, which is what Site.root_page must point at.

        Not the articles index: if the index were the site root its own URL would
        be "/" and every article would sit at "/<slug>/", and every canonical tag
        and sitemap entry would be wrong.
        """
        root = Page.objects.filter(depth=1).first()
        if root is None:
            raise RuntimeError(
                "No Wagtail root page. Run 'manage.py migrate' first — wagtailcore "
                "creates it."
            )
        return root

    def _ensure_site(self, root, hostname):
        site, created = Site.objects.get_or_create(
            hostname=hostname,
            defaults={"port": 443, "is_default_site": True, "root_page": root,
                      "site_name": "سالیکو"},
        )
        if created:
            self.stdout.write(f"Wagtail site {hostname} created")
        elif site.root_page_id != root.id:
            site.root_page = root
            site.save(update_fields=["root_page"])
            self.stdout.write("Wagtail site root reset to the Wagtail root page")

    def _ensure_index(self, root):
        index = ArticleIndexPage.objects.first()
        if index is not None:
            if index.get_parent().id != root.id:
                index.move(root, pos="last-child")
                self.stdout.write("Articles index moved under the Wagtail root")
            return index
        index = ArticleIndexPage(
            title="مقالات",
            slug="articles",
            hero_title="مقالات سالیکو",
            hero_description="راهنماها و نکته‌هایی برای خواب بهتر و انتخابی آگاهانه.",
        )
        root.add_child(instance=index)
        index.save_revision().publish()
        self.stdout.write("Articles index created at /articles/")
        return index

    def _ensure_collections(self):
        root = Collection.get_first_root_node()
        for name in COLLECTIONS:
            if root.get_children().filter(name=name).exists():
                continue
            root.add_child(instance=Collection(name=name))
            self.stdout.write(f"Collection {name} created")

    def _ensure_seo_settings(self):
        site = Site.objects.get(is_default_site=True)
        seo = GlobalSeoSettings.for_site(site)
        if seo.pk is not None:
            # Never overwrite: an editor may have set every one of these.
            return
        for field, value in SEO_DEFAULTS.items():
            setattr(seo, field, value)
        seo.save()
        self.stdout.write("Global SEO settings created with Salyco defaults")
```

`GlobalSeoSettings.for_site(site)` returns an unsaved instance when none exists,
so `seo.pk is None` is the correct "not configured yet" test — verify this
against the installed Wagtail version by running the tests; if `for_site` instead
raises, wrap it in `try/except GlobalSeoSettings.DoesNotExist` and create the row
with `site=site`.

- [ ] **Step 4: Run the tests**

Run: `python manage.py test articles.tests_setup_command -v 2`

Expected: PASS (7 tests).

- [ ] **Step 5: Remove the skip from Task 4**

In `Backend/articles/tests_pages.py`, delete the
`@skip("site created by setup_salyco_cms in Task 14")` decorator and the
`from unittest import skip` import if it is now unused. That test then creates
its own site — if it does not, call `call_command("setup_salyco_cms")` in a
`setUp` for that one class.

- [ ] **Step 6: Run it against the real database**

Run:

```bash
python manage.py setup_salyco_cms
python manage.py setup_salyco_cms
```

Expected: the first run reports each thing it created; the second reports
nothing but `CMS setup complete.` Then open `/cms/pages/` and confirm «مقالات»
appears as a child of the root.

- [ ] **Step 7: Commit**

```bash
git add Backend/articles/management Backend/articles/tests_setup_command.py Backend/articles/tests_pages.py
git commit -m "feat(cms): idempotent setup command for the site, index and collections

Runs on every deploy, so it creates what is missing and never overwrites what an
editor changed — a setup command that resets configured values is one nobody
dares run twice.

Site.root_page points at the Wagtail root, not the articles index: making the
index the site root would put it at / and every canonical tag would be wrong."
```

---

### Task 15: Migrate the four legacy articles

**Files:**
- Create: `Backend/articles/legacy.py`
- Create: `Backend/articles/management/commands/migrate_legacy_articles.py`
- Test: `Backend/articles/tests_legacy_migration.py` (create)

**Interfaces:**
- Consumes: `ArticlePage` (Task 4), `setup_salyco_cms` (Task 14), `services.estimate_reading_time`.
- Produces: `parse_slugmap(text) -> dict[str, str]` mapping an old path to its Persian replacement; `content_to_blocks(text) -> list[tuple[str, dict]]`; the `migrate_legacy_articles [--dry-run]` command.

- [ ] **Step 1: Write the failing test**

Create `Backend/articles/tests_legacy_migration.py`:

```python
from django.core.management import call_command
from django.test import TestCase
from wagtail.contrib.redirects.models import Redirect
from wagtail.images.models import Image
from wagtail.models import Page

from articles.legacy import content_to_blocks, parse_slugmap
from articles.models import ArticlePage
from articles.models import Article as LegacyArticle

SLUGMAP = """OLD : /articles/old-one
NEW : /articles/جدید-یک
ENC : /articles/%D8%AC%D8%AF%DB%8C%D8%AF-%DB%8C%DA%A9

OLD : /articles/old-two
NEW : /articles/جدید-دو
ENC : /articles/%D8%AC%D8%AF%DB%8C%D8%AF-%D8%AF%D9%88
"""

LEGACY_TEXT = """مقدمه‌ای درباره انتخاب تشک.

نکته مهم:

پاراگراف دوم که توضیح می‌دهد چرا سختی تشک مهم است.

پاراگراف سوم."""


class SlugmapTests(TestCase):
    def test_old_paths_map_to_the_persian_replacement(self):
        mapping = parse_slugmap(SLUGMAP)
        self.assertEqual(mapping["/articles/old-one"], "/articles/جدید-یک")

    def test_the_encoded_line_is_ignored(self):
        self.assertEqual(len(parse_slugmap(SLUGMAP)), 2)

    def test_a_malformed_block_is_skipped_not_crashed(self):
        self.assertEqual(parse_slugmap("OLD : /a\n\nNEW : /b\n"), {})


class ContentConversionTests(TestCase):
    def test_paragraphs_become_paragraph_blocks(self):
        blocks = content_to_blocks("اول.\n\nدوم.")
        self.assertEqual([kind for kind, _ in blocks], ["paragraph", "paragraph"])

    def test_a_short_standalone_line_ending_in_a_colon_becomes_a_heading(self):
        blocks = content_to_blocks("مقدمه.\n\nنکته مهم:\n\nبدنه.")
        self.assertEqual(
            [kind for kind, _ in blocks],
            ["paragraph", "heading", "paragraph"],
        )

    def test_no_text_is_lost(self):
        # The command aborts an article whose conversion is shorter than the
        # original, so this is what makes that guard meaningful.
        blocks = content_to_blocks(LEGACY_TEXT)
        joined = " ".join(
            value.get("text") if kind == "heading" else value
            for kind, value in blocks
        )
        for fragment in ("مقدمه‌ای درباره", "نکته مهم", "پاراگراف دوم", "پاراگراف سوم"):
            self.assertIn(fragment, joined)

    def test_whitespace_only_input_produces_nothing(self):
        self.assertEqual(content_to_blocks("\n\n   \n\n"), [])


class MigrationCommandTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.legacy = LegacyArticle.objects.create(
            title="سایز تشک استاندارد",
            slug="sz-tsh-mnsb-st-rhnm-baad-stndrd-nfrh-o-do-nfrh",
            excerpt="راهنمای سایز",
            content=LEGACY_TEXT,
        )

    def setUp(self):
        call_command("setup_salyco_cms", verbosity=0)
        self.index = Page.objects.get(slug="articles").specific

    def run_command(self, *args):
        call_command("migrate_legacy_articles", *args, stdout=self._out())

    def _out(self):
        import io

        return io.StringIO()

    def test_it_creates_a_page_per_legacy_article(self):
        self.run_command()
        self.assertEqual(ArticlePage.objects.count(), 1)

    def test_it_uses_the_slug_from_the_slug_map(self):
        # Reads the expectation out of the real _slugmap.txt rather than
        # hard-coding a Persian string here, which would go stale the moment
        # someone edits the map. This still fails if the command ignores the map
        # and slugifies the title instead — the two values differ.
        from articles.legacy import parse_slugmap
        from articles.management.commands.migrate_legacy_articles import SLUGMAP_PATH

        mapping = parse_slugmap(SLUGMAP_PATH.read_text(encoding="utf-8"))
        expected = mapping[f"/articles/{self.legacy.slug}"].rsplit("/", 1)[-1]

        self.run_command()
        self.assertEqual(ArticlePage.objects.get().slug, expected)

    def test_it_records_the_legacy_id(self):
        self.run_command()
        self.assertEqual(ArticlePage.objects.get().legacy_id, self.legacy.id)

    def test_it_preserves_the_dates(self):
        self.run_command()
        page = ArticlePage.objects.get()
        self.assertEqual(page.first_published_at, self.legacy.created_at)
        self.assertEqual(page.last_published_at, self.legacy.updated_at)

    def test_the_body_carries_the_article_text(self):
        self.run_command()
        page = ArticlePage.objects.get()
        self.assertTrue(any(b.block_type == "paragraph" for b in page.body))

    def test_it_creates_a_permanent_redirect_from_the_old_path(self):
        self.run_command()
        redirect = Redirect.objects.get(old_path=f"/articles/{self.legacy.slug}/")
        self.assertEqual(redirect.redirect_page, ArticlePage.objects.get())
        # Permanent, because the old URL is never coming back. A 302 would tell
        # the crawler to keep the old entry and re-check it forever.
        self.assertTrue(redirect.is_permanent)

    def test_the_old_url_redirects_to_the_new_one(self):
        from urllib.parse import unquote

        from articles.legacy import parse_slugmap
        from articles.management.commands.migrate_legacy_articles import SLUGMAP_PATH

        mapping = parse_slugmap(SLUGMAP_PATH.read_text(encoding="utf-8"))
        expected = mapping[f"/articles/{self.legacy.slug}"]

        self.run_command()
        response = self.client.get(f"/articles/{self.legacy.slug}/")

        self.assertEqual(response.status_code, 301)
        # unquote, because Django runs the Location header through iri_to_uri:
        # the wire form is percent-encoded even though the page's own path is
        # Persian. Asserting the raw Persian here fails on the first run.
        self.assertEqual(unquote(response["Location"]), expected)

    def test_a_second_run_imports_nothing(self):
        self.run_command()
        self.run_command()
        self.assertEqual(ArticlePage.objects.count(), 1)

    def test_dry_run_writes_nothing(self):
        before = (ArticlePage.objects.count(), Redirect.objects.count())
        self.run_command("--dry-run")
        after = (ArticlePage.objects.count(), Redirect.objects.count())
        self.assertEqual(before, after)
        self.assertEqual(before, (0, 0))

    def test_an_unpublished_legacy_article_becomes_a_draft(self):
        unpublished = LegacyArticle.objects.create(
            title="منتشرنشده", slug="hidden", content="متن", is_published=False
        )
        self.run_command()
        # Looked up by legacy_id, not by slug: this article has no _slugmap entry,
        # so its slug comes from the Persian title rather than from "hidden".
        page = ArticlePage.objects.get(legacy_id=unpublished.id)
        self.assertFalse(page.live)

    def test_the_legacy_table_is_left_alone(self):
        self.run_command()
        self.assertEqual(LegacyArticle.objects.count(), 1)
```

No Persian slug is hard-coded anywhere in this test module: the two slug
assertions read the expectation out of the real `_slugmap.txt` through
`parse_slugmap`, so editing the map cannot make the suite fail for the wrong
reason.

18 tests in total.

- [ ] **Step 2: Run it and watch it fail**

Run: `python manage.py test articles.tests_legacy_migration -v 2`

Expected: FAIL — `ModuleNotFoundError: No module named 'articles.legacy'`.

- [ ] **Step 3: Write the conversion helpers**

Create `Backend/articles/legacy.py`:

```python
"""Converting the legacy plain-text articles into structured blocks.

The old `content` column is a TextField of paragraphs separated by blank lines —
NOT HTML. The SEO design spec assumed a sanitisation problem would have to be
solved to get links into article bodies; there is no HTML to sanitise, so this is
a clean parse and no RawHTMLBlock is needed anywhere.
"""
import re

# A standalone line this short that ends in a colon is a section label, not a
# sentence: "نکته مهم:" is a heading, "پس توجه کنید:" at the end of a sentence is
# not — which is why the length bound matters and why the colon must be final.
_HEADING_MAX_WORDS = 8

_SLUGMAP_LINE_RE = re.compile(r"^(OLD|NEW|ENC)\s*:\s*(.+?)\s*$")


def parse_slugmap(text):
    """Parse _slugmap.txt into {old_path: new_path}.

    The file repeats each entry three times — OLD, NEW, and ENC with the
    percent-encoded form. Django's request.path is already decoded, so the ENC
    line is redundant and is skipped; a block missing its OLD or NEW line is
    dropped rather than half-applied.
    """
    mapping = {}
    current = {}
    for line in text.splitlines():
        if not line.strip():
            _flush(current, mapping)
            current = {}
            continue
        match = _SLUGMAP_LINE_RE.match(line)
        if match:
            current[match.group(1)] = match.group(2)
    _flush(current, mapping)
    return mapping


def _flush(current, mapping):
    if "OLD" in current and "NEW" in current:
        mapping[current["OLD"]] = current["NEW"]


def content_to_blocks(text):
    """Turn the legacy plain text into (block_type, value) pairs.

    Only paragraphs and H2 headings are produced. The old format carried no
    other structure — no lists, no images, no links — so inferring any would be
    inventing content the author never wrote.
    """
    blocks = []
    for chunk in re.split(r"\n\s*\n", text or ""):
        chunk = chunk.strip()
        if not chunk:
            continue
        if _is_heading(chunk):
            blocks.append(
                ("heading", {"text": chunk, "level": "h2", "anchor_id": ""})
            )
        else:
            # Escaped and wrapped: the value is a RichTextBlock, which stores
            # HTML source. The text is plain already, but a bare "&" or "<" in
            # the original would otherwise be parsed as markup on render.
            blocks.append(("paragraph", f"<p>{_escape(chunk)}</p>"))
    return blocks


def _is_heading(chunk):
    if not chunk.endswith((":", "：")):
        return False
    if "\n" in chunk:
        return False
    return len(chunk.split()) <= _HEADING_MAX_WORDS


def _escape(text):
    return (
        text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    )
```

- [ ] **Step 4: Write the command**

Create `Backend/articles/management/commands/migrate_legacy_articles.py`:

```python
"""Import the legacy articles.Article rows as Wagtail ArticlePages.

One transaction, idempotent through legacy_id, and --dry-run writes nothing.
The legacy table is left in place: it is both the source and the rollback path,
and removing it is a separate change after this one has been verified in
production.
"""
from pathlib import Path

from django.conf import settings
from django.core.files.images import ImageFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify
from wagtail.contrib.redirects.models import Redirect
from wagtail.images.models import Image
from wagtail.models import Collection

from articles.legacy import content_to_blocks, parse_slugmap
from articles.models import ArticleIndexPage, ArticlePage

from ...models import Article as LegacyArticle

SLUGMAP_PATH = Path(settings.BASE_DIR).parent / "_slugmap.txt"


class Command(BaseCommand):
    help = "Import legacy Article rows into Wagtail ArticlePages."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would happen and write nothing.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        mapping = self._load_slugmap()
        index = ArticleIndexPage.objects.first()
        if index is None:
            self.stderr.write(
                "No articles index. Run 'manage.py setup_salyco_cms' first."
            )
            return

        stats = {"total": 0, "migrated": 0, "skipped": 0, "failed": 0}
        for legacy in LegacyArticle.objects.order_by("id"):
            stats["total"] += 1
            if ArticlePage.objects.filter(legacy_id=legacy.id).exists():
                stats["skipped"] += 1
                continue
            try:
                with transaction.atomic():
                    self._migrate_one(legacy, index, mapping, dry_run)
                stats["migrated"] += 1
            except Exception as error:  # noqa: BLE001 — one bad row must not stop the rest
                stats["failed"] += 1
                # The legacy id and slug, never the body: an editor's draft text
                # has no business in a log file.
                self.stderr.write(
                    f"FAILED legacy_id={legacy.id} slug={legacy.slug!r}: {error}"
                )

        self.stdout.write(
            "total={total} migrated={migrated} skipped={skipped} failed={failed}".format(
                **stats
            )
        )
        if dry_run:
            self.stdout.write("Dry run — nothing was written.")

    def _load_slugmap(self):
        if not SLUGMAP_PATH.exists():
            self.stdout.write(f"No {SLUGMAP_PATH.name} found; slugs will be derived.")
            return {}
        return parse_slugmap(SLUGMAP_PATH.read_text(encoding="utf-8"))

    def _migrate_one(self, legacy, index, mapping, dry_run):
        blocks = content_to_blocks(legacy.content)
        if not self._conversion_kept_everything(legacy.content, blocks):
            # A parsing bug that silently drops half a paragraph is the one
            # failure nobody would notice until a reader did.
            raise ValueError("conversion lost text; refusing to import this article")

        slug = self._slug_for(legacy, mapping)
        page = ArticlePage(
            title=legacy.title,
            slug=slug,
            excerpt=(legacy.excerpt or "")[:500],
            body=blocks,
            legacy_id=legacy.id,
            first_published_at=legacy.created_at,
            last_published_at=legacy.updated_at,
        )
        if dry_run:
            self.stdout.write(f"[dry-run] {legacy.slug} -> {slug}")
            return

        index.add_child(instance=page)
        if legacy.image:
            # Attached before the first publish, so the released revision already
            # carries the hero image rather than needing a second one.
            self._attach_image(page, legacy)
        if legacy.is_published:
            page.save_revision().publish()
        self._replace_redirect(legacy, page)
        self.stdout.write(f"{legacy.slug} -> {slug}")

    def _slug_for(self, legacy, mapping):
        new_path = mapping.get(f"/articles/{legacy.slug}")
        if new_path:
            return new_path.rsplit("/", 1)[-1]
        # No mapping entry: fall back to the title, which is Persian, rather than
        # to the transliterated slug nobody can read.
        return slugify(legacy.title, allow_unicode=True)[:250]

    def _conversion_kept_everything(self, original, blocks):
        source_words = len((original or "").split())
        result_words = sum(
            len(value["text"].split()) if kind == "heading" else len(value.split())
            for kind, value in blocks
        )
        return result_words >= source_words

    def _attach_image(self, page, legacy):
        """Copy the legacy image into the Wagtail image library.

        A copy, not a reference: Wagtail generates renditions from its own store,
        and the legacy file stays where the old table expects it so the rollback
        path still renders.
        """
        collection = Collection.objects.filter(name="مقالات").first()
        image = Image(
            title=legacy.title[:255],
            collection=collection or Collection.get_first_root_node(),
        )
        with legacy.image.open("rb") as handle:
            image.file = ImageFile(handle, name=legacy.image.name.rsplit("/", 1)[-1])
            image.save()
        page.hero_image = image
        page.hero_image_alt = legacy.title[:255]
        # save(), not save_revision().publish(): the caller publishes once after
        # this returns, so publishing here would create a revision per image and
        # leave the first one without it.
        page.save()

    def _replace_redirect(self, legacy, page):
        # Direct and single-hop: a chain of redirects costs a round trip and
        # dilutes what the crawler attributes to the destination.
        Redirect.objects.update_or_create(
            old_path=f"/articles/{legacy.slug}/",
            defaults={
                "redirect_page": page,
                "is_permanent": True,
                "site": page.get_site(),
            },
        )
```

- [ ] **Step 5: Run the tests**

Run: `python manage.py test articles.tests_legacy_migration -v 2`

Expected: PASS (17 tests).

- [ ] **Step 6: Rehearse against the real data, writing nothing**

Run:

```bash
python manage.py migrate_legacy_articles --dry-run
```

Expected: four lines of `[dry-run] <old-slug> -> <persian-slug>` and a summary of
`total=4 migrated=4 skipped=0 failed=0`. Every target slug must match
`_slugmap.txt` — read the file and compare by eye. If any article reports
`failed`, the reason is printed with its legacy id; fix the parse rather than
lowering the guard.

- [ ] **Step 7: Do it for real**

Run `python manage.py migrate_legacy_articles`, then confirm:

```bash
python manage.py migrate_legacy_articles   # must report skipped=4
curl -sI http://127.0.0.1:8000/articles/bhtrn-tsh-br-mrdrd-o-ds-mr-dm-st/
```

Expected: `301` to `/articles/بهترین-تشک-برای-کمردرد/`, and that URL returns 200.
The second command must report `migrated=0 skipped=4` — the idempotency check.

- [ ] **Step 8: Commit**

```bash
git add Backend/articles/legacy.py Backend/articles/management/commands/migrate_legacy_articles.py Backend/articles/tests_legacy_migration.py
git commit -m "feat(cms): import the legacy articles and redirect the old slugs

The old bodies are plain text separated by blank lines, not HTML, so this is a
clean parse into paragraphs and headings — no sanitiser and no RawHTMLBlock
needed. Each article is aborted if the conversion comes out shorter than the
original, so a parsing bug cannot silently truncate someone's writing.

The four Persian target slugs come from _slugmap.txt; the transliterated ones
get a permanent one-hop 301.

articles.Article is left untouched and undeleted: it is the source, the rollback
path, and its removal is a separate change for after this is verified in
production."
```

---

### Task 16: Acceptance pass

**Files:**
- No production files. This task is verification; it may produce one commit fixing whatever it finds.

**Interfaces:**
- Consumes: everything.
- Produces: a verified deployment.

- [ ] **Step 1: Run the whole suite**

Run, from `Backend/`:

```bash
python manage.py check
python manage.py test articles core -v 2
```

Expected: clean check, everything PASS. Then `python manage.py test` with no app
filter — the Wagtail install added `INSTALLED_APPS`, and a pre-existing test in
another app could depend on `LANGUAGE_CODE` or the new middleware. Fix any
failure; do not skip it.

- [ ] **Step 2: Verify the raw HTML, with JavaScript off**

Run `python manage.py runserver` and `curl -s http://127.0.0.1:8000/articles/ | head -60`.

Expected in that output, and none of it requiring a browser:

- `<html lang="fa" dir="rtl">`
- one `<title>`
- one `<link rel="canonical" href="https://salyco.ir/…">`
- the article titles as text
- three `application/ld+json` blocks on a detail page

- [ ] **Step 3: Prove no local host can reach the output**

Run:

```bash
for path in /articles/ /articles/category/راهنما/ /sitemap.xml /robots.txt; do
  curl -s "http://127.0.0.1:8000$path"; done | grep -c 'localhost\|127\.0\.0\.1\|backend:8000'
```

Expected: `0`. Any hit is a metadata bug of the exact class §68 describes.

- [ ] **Step 4: Check the redirect is one hop**

Run:

```bash
curl -sI http://127.0.0.1:8000/articles/bhtrn-tsh-br-mrdrd-o-ds-mr-dm-st/ | grep -i location
curl -sI http://127.0.0.1:8000/articles/بهترین-تشک-برای-کمردرد/ | head -1
```

Expected: one `Location` header naming the final URL, and `200` on it. A second
redirect would mean the redirect target is itself redirecting.

- [ ] **Step 5: Look at every page at every width**

Open each of these in a real browser at **360, 390, 430, 768, 1024 and 1440px**:
`/articles/`, an article page with an image, a callout, an FAQ and a CTA,
`/articles/category/…/`, and `/articles/?page=2`.

At each width confirm: no horizontal scroll, the prose column is 640px or less
and centred, headings do not collide with the sticky header, the FAQ opens
without JavaScript, and Latin text and numerals inside Persian prose read
left-to-right.

- [ ] **Step 6: Verify the two-site split has not broken the SPA**

With `npm run dev` running, check the homepage, the product listing, a product
page, the cart, `/search?q=تشک`, and the account sheet. Then click every article
link on the homepage and in the nav and confirm each does a **full page load**
into the Django-rendered article — a client-side transition would mean a
`<Link>` survived Task 12.

- [ ] **Step 7: Verify the CMS end to end**

In `/cms/`: create a new article, add every block type, set a category and an
author, publish it, and confirm it appears at `/articles/` and at its own URL with
its metadata. Then edit the live article's slug and confirm the old URL 404s
rather than serving a stale page — Wagtail does not create that redirect
automatically, and if the client wants one it belongs in a follow-up.

- [ ] **Step 8: Deploy and verify what cannot be checked locally**

Run `docker compose up -d --build`, then the three commands from the spec's
Deployment section, then:

```bash
curl -sI https://salyco.ir/articles/ | head -3
curl -s https://salyco.ir/robots.txt | head -3
curl -s https://salyco.ir/sitemap.xml | head -5
curl -sI https://salyco.ir/articles/bhtrn-tsh-br-mrdrd-o-ds-mr-dm-st/ | grep -i location
```

Expected: `200 text/html` from Django (not the SPA shell), `text/plain` for
robots, XML with `https://salyco.ir/` URLs and no local host, and a `301`.

Then paste a new article URL into Telegram and confirm the card shows the title,
description and image.

- [ ] **Step 9: Rehearse the rollback once**

Confirm the rollback path works before it is needed: comment out the four nginx
locations, rebuild the frontend, and verify the site still runs — articles then
404 rather than serving stale React pages, which is the expected degraded state.
Restore the locations and rebuild. The legacy table and its Django admin are
still there, so `Article` rows remain readable and re-exportable throughout.

- [ ] **Step 10: Commit anything the pass turned up**

```bash
git add -A
git commit -m "fix(cms): <what the acceptance pass found>"
```

If the pass found nothing, skip this commit rather than making an empty one.

---

## Self-Review

**1. Spec coverage.** Every section of the design doc maps to a task:

| Spec section | Task |
| --- | --- |
| 1. Dependencies and settings | 1 |
| 2. Page models | 4 |
| 3. Snippets | 2 |
| 4. StreamField blocks | 3 |
| 5. Templates | 7, 8 |
| 6. Styling | 10 |
| 7. Editorial experience | 13 |
| 8. SEO | 3, 6 |
| 9. Sitemap and robots | 9 |
| 10. nginx | 12 |
| 11. API | 11 |
| 12. Reading time | 5 |
| 13. Legacy migration | 14, 15 |
| 14. Testing | every task; the acceptance pass is 16 |
| Scope: React deletions and anchors | 12 |
| Deployment | 16 |
| Risks: manifest static storage | 1 Step 8 |
| Risks: `@theme` → `var()` | 10 Steps 3–6 |
| Risks: rendition cost | 15 Step 3 (`_attach_image`) |
| Risks: scheduled publishing | **not implemented** — a host cron entry is documented in the spec's Risks, and the command is Wagtail's own `publish_scheduled`. No task, by design. |

**2. Placeholder scan.** No `TBD`, no "add error handling", no "similar to Task
N". One place deliberately asks the implementer to read a value rather than have
it dictated, and says so and says which file: the full token list in Task 10
Step 1, read from the existing `@theme` block in `src/index.css`. That is a
measurement of the existing stylesheet, not deferred design.

**3. Type consistency.** The names that cross task boundaries:
`estimate_reading_time`, `body_to_text`, `block_text` (Task 5) are used by Tasks
4 and 11; `page_meta_context`, `build_meta`, `canonical_url`, `robots_directive`,
`article_json_ld`, `breadcrumb_json_ld`, `faq_json_ld`, `site_settings_for`,
`absolute_url` (Task 6) are used by Tasks 7 and 8; `published_articles()` and
`paginate()` on `ArticleIndexPage` (Task 4) are used by Task 8; `json_ld_script`,
`heading_anchor` and `link_href` (Task 3) are used by Tasks 7 and 8;
`isServerRoute` (Task 12) is used in four components by the same task; `SLUGMAP_PATH`
and `parse_slugmap` (Task 15) are used by that task's own tests. All consistent.
The block type strings — `heading`, `paragraph`, `quote`, `image`, `callout`,
`faq`, `cta` — are fixed in Task 3, asserted there, and relied on by Tasks 5, 6
and 15.

One rough edge is intentional and flagged inline where it occurs: Task 4's
`test_the_default_site_uses_the_canonical_hostname` carries a `@skip` until Task
14 creates the site, and Task 14 Step 5 removes it.
