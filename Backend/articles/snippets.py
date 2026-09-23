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
