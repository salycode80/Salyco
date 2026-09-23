from urllib.parse import urlparse

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.text import slugify
from modelcluster.contrib.taggit import ClusterTaggableManager
from modelcluster.fields import ParentalKey, ParentalManyToManyField
from taggit.models import TaggedItemBase
from wagtail.admin.panels import (
    FieldPanel,
    MultiFieldPanel,
    ObjectList,
    TabbedInterface,
)
from wagtail.fields import StreamField
from wagtail.models import Page

from .blocks import BodyBlock
from .services import estimate_reading_time

# Re-exported so Django's app registry sees them. Snippets live in their own
# module to keep this file readable, but a model in a module that models.py never
# imports is not part of the app at all: makemigrations reports "No changes
# detected" and the tables are never created. The dependency runs one way only —
# snippets.py imports nothing from here.
from .snippets import ArticleAuthor, ArticleCategory, GlobalSeoSettings  # noqa: F401

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


class Article(models.Model):
    title = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, blank=True)
    excerpt = models.TextField(max_length=500, blank=True)
    content = models.TextField()
    image = models.ImageField(upload_to="articles/", blank=True, null=True)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title, allow_unicode=True)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


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
        "articles.ArticlePage",
        verbose_name="مقاله ویژه",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
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
        "wagtailimages.Image",
        verbose_name="تصویر شاخص",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    hero_image_alt = models.CharField("متن جایگزین تصویر شاخص", max_length=255, blank=True)
    category = models.ForeignKey(
        ArticleCategory,
        verbose_name="دسته‌بندی",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="articles",
    )
    author = models.ForeignKey(
        ArticleAuthor,
        verbose_name="نویسنده",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="articles",
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
        "شناسه مقاله قدیمی",
        null=True,
        blank=True,
        unique=True,
        editable=False,
        help_text="ردیابی مقاله‌های منتقل‌شده از جدول قدیمی.",
    )

    # ── SEO ──
    canonical_url_override = models.URLField(
        "نشانی کانونیکال جایگزین",
        max_length=500,
        blank=True,
        help_text="فقط اگر این مقاله جای دیگری منتشر شده است.",
    )
    allow_indexing = models.BooleanField("اجازه ایندکس شدن", default=True)
    allow_following = models.BooleanField("اجازه دنبال کردن پیوندها", default=True)
    og_title = models.CharField("عنوان اشتراک‌گذاری", max_length=120, blank=True)
    og_description = models.CharField("توضیحات اشتراک‌گذاری", max_length=200, blank=True)
    og_image = models.ForeignKey(
        "wagtailimages.Image",
        verbose_name="تصویر اشتراک‌گذاری",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    content_panels = Page.content_panels + [
        FieldPanel("subtitle"),
        FieldPanel("excerpt"),
        FieldPanel("category"),
        FieldPanel("author"),
        FieldPanel("tags"),
        MultiFieldPanel(
            [FieldPanel("hero_image"), FieldPanel("hero_image_alt")],
            heading="تصویر شاخص",
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
