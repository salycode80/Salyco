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
    quote = blocks.TextBlock(label="متن نقلقول")
    source_name = blocks.CharBlock(required=False, label="نام گوینده")
    source_title = blocks.CharBlock(required=False, label="سمت یا منبع")
    source_url = blocks.URLBlock(required=False, label="نشانی منبع")

    class Meta:
        label = "نقلقول"
        icon = "openquote"
        group = "متن"
        template = "articles/blocks/quote.html"


class ImageBlock(blocks.StructBlock):
    image = ImageChooserBlock(label="تصویر")
    alt_text = blocks.CharBlock(
        required=False,
        label="متن جایگزین",
        help_text="توضیح تصویر برای صفحهخوانها و موتورهای جستوجو.",
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

    variant = blocks.ChoiceBlock(choices=VARIANT_CHOICES, default="info", label="نوع")
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
    items = blocks.ListBlock(FAQItemBlock(), min_num=1, label="پرسشها")

    class Meta:
        label = "پرسشهای متداول"
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
            message = "دقیقاً یکی از «صفحه داخلی» یا «نشانی بیرونی» را پر کنید."
            raise ValidationError(
                message,
                params={"page": ErrorList([message]), "url": ErrorList([message])},
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

    eyebrow = blocks.CharBlock(required=False, label="پیشعنوان")
    title = blocks.CharBlock(label="عنوان")
    description = blocks.TextBlock(required=False, label="توضیح")
    link = ArticleLinkBlock(label="پیوند")
    variant = blocks.ChoiceBlock(choices=VARIANT_CHOICES, default="primary", label="نوع")

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
