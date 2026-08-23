from __future__ import annotations
import calendar
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from django.contrib.auth import get_user_model
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Avg, Count
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.utils import timezone
from users.models import Customer

User = get_user_model()

# What a mattress is rated before anyone has reviewed it. A brand-new product
# showing zero stars reads as "rated badly", not "not rated yet", so an
# unreviewed mattress is presented at full marks instead.
DEFAULT_RATING = Decimal("5.00")


def apply_discount(price: Decimal, percentage: int) -> Decimal:
    """Take `percentage` off `price`, rounded to whole cents.

    The percentage is clamped to 0-100: `off_percentage` is only documented as
    0-100 by help_text, nothing validates it, and an out-of-range value would
    otherwise produce a negative price.
    """
    pct = min(max(int(percentage), 0), 100)
    factor = (Decimal(100) - Decimal(pct)) / Decimal(100)
    return (price * factor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def add_months(source_date: date, months: int) -> date:
    month_index = source_date.month - 1 + months
    year = source_date.year + month_index // 12
    month = month_index % 12 + 1
    day = min(source_date.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


class Mattress(models.Model):
    """A sellable sleep product.

    Despite the name — kept because cart, orders, warranty instances, and reviews
    all foreign-key to it — this model backs every product line, discriminated by
    `category`. A pillow is just a row with no MattressSize children; everything
    else (sizes, images, specs, features, FAQs, pros/cons) is shared machinery.
    """

    CATEGORY_MATTRESS = "mattress"
    CATEGORY_BEDBOX = "bedbox"
    CATEGORY_PILLOW = "pillow"
    CATEGORY_DUVET = "duvet"
    CATEGORY_TOPPER = "topper"
    CATEGORY_CHOICES = [
        (CATEGORY_MATTRESS, "تشک"),
        (CATEGORY_BEDBOX, "باکس تخت خواب"),
        (CATEGORY_PILLOW, "بالش"),
        (CATEGORY_DUVET, "روتختی"),
        (CATEGORY_TOPPER, "محافظ تشک و تاپر"),
    ]

    # Categories whose units are serial-numbered and individually warranty-
    # registrable. Pillows and duvets still carry a stated guarantee period
    # (warranty_months, rendered as a badge) but are not tracked per unit, so
    # there is no MattressInstance and no QR code for them.
    WARRANTY_REGISTRABLE_CATEGORIES = {
        CATEGORY_MATTRESS,
        CATEGORY_BEDBOX,
        CATEGORY_TOPPER,
    }

    category = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
        # Every row that existed before this field was added is a mattress, so
        # the default is what keeps the back catalogue correct through migration.
        default=CATEGORY_MATTRESS,
        db_index=True,
        verbose_name="category",
    )
    name = models.CharField(max_length=255, verbose_name="name")
    brand = models.CharField(max_length=100, blank=True, default="", verbose_name="brand")
    subtitle = models.CharField(max_length=255, blank=True, default="", verbose_name="subtitle")
    description = models.TextField(verbose_name="description")
    long_description = models.TextField(blank=True, default="", verbose_name="long description")
    slug = models.SlugField(unique=True, verbose_name="slug")
    warranty_months = models.PositiveIntegerField(verbose_name="warranty months")
    price = models.DecimalField(max_digits=18, decimal_places=2, verbose_name="price")
    image = models.ImageField(upload_to="mattresses/", blank=True, null=True, verbose_name="image")
    width = models.IntegerField(default=0)
    length = models.IntegerField(default=0)
    height = models.IntegerField(default=0, verbose_name="height (cm)")
    is_available = models.BooleanField(default=True, verbose_name="is available")

    # ── Sleep-brand properties ──
    # Only the four that drive dedicated UI live here (a firmness scale bar and
    # three badges). Everything else a sleep brand lists — loft, TOG rating, fill
    # weight, cover fabric, density, certifications — belongs in
    # MattressSpecification rows, which already render as a spec table and need
    # no migration to extend per category.
    firmness = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(10)],
        verbose_name="firmness (1-10)",
        help_text="۱ = بسیار نرم، ۱۰ = بسیار سخت. Leave empty to hide the scale.",
    )
    material = models.CharField(
        max_length=120,
        blank=True,
        default="",
        verbose_name="material",
        help_text="e.g. مموری فوم، الیاف میکروفایبر",
    )
    is_washable = models.BooleanField(default=False, verbose_name="washable")
    trial_nights = models.PositiveIntegerField(
        default=0,
        verbose_name="trial nights",
        help_text="0 hides the trial badge.",
    )
    # Cache of the approved-review aggregate, refreshed by update_rating_cache().
    # Read through the `rating` property rather than directly — that applies the
    # unreviewed fallback. Not editable: it is derived from Review rows, so a
    # hand-typed value here would be silently overwritten by the next review.
    average_rating = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=DEFAULT_RATING,
        editable=False,
        verbose_name="average rating",
    )
    review_count = models.IntegerField(default=0, editable=False, verbose_name="review count")
    is_on_off = models.BooleanField(default=False, verbose_name="on sale")
    off_percentage = models.PositiveIntegerField(default=0, verbose_name="discount percentage", help_text="0-100")

    class Meta:
        verbose_name = "mattress"
        verbose_name_plural = "mattresses"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    @property
    def has_discount(self) -> bool:
        return self.is_on_off and self.off_percentage > 0

    @property
    def discount_price(self) -> Optional[Decimal]:
        """Base price after the active discount, or None when not on sale."""
        if not self.has_discount:
            return None
        return apply_discount(self.price, self.off_percentage)

    @property
    def final_price(self) -> Decimal:
        """What the base product actually costs — the single source of truth for
        pricing, used by the cart and by orders as well as by the serializers."""
        discounted = self.discount_price
        return self.price if discounted is None else discounted

    @property
    def rating(self) -> Decimal:
        """The score to display: the approved-review average, or DEFAULT_RATING
        when nothing has been reviewed yet.

        Reads the cache rather than re-aggregating, so listing a page of
        mattresses stays one query. Pair with `review_count` to tell "5.00
        because it is unreviewed" apart from "5.00 because every reviewer gave
        five stars" — the two are deliberately indistinguishable in this value.
        """
        if self.review_count <= 0:
            return DEFAULT_RATING
        return self.average_rating

    @property
    def is_warranty_registrable(self) -> bool:
        """True when this product line supports per-unit serial-numbered warranty
        registration. Pillows and duvets carry a stated guarantee period but are
        not individually tracked."""
        return self.category in self.WARRANTY_REGISTRABLE_CATEGORIES

    def update_rating_cache(self) -> None:
        """Recompute average_rating/review_count from the approved reviews.

        Called from the Review post_save/post_delete signals, so it runs on
        every path that can change a review — the API, the Django admin, a
        management command, or a shell session. Falls back to DEFAULT_RATING
        when the last approved review goes away.
        """
        stats = self.reviews.filter(is_approved=True).aggregate(
            avg=Avg("rating"), cnt=Count("id")
        )
        count = stats["cnt"] or 0
        average = stats["avg"]
        self.review_count = count
        self.average_rating = (
            DEFAULT_RATING
            if count == 0 or average is None
            else Decimal(average).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        )
        self.save(update_fields=["average_rating", "review_count"])


class MattressImage(models.Model):
    mattress = models.ForeignKey(Mattress, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="mattresses/gallery/")
    alt_text = models.CharField(max_length=255, blank=True, default="")
    is_primary = models.BooleanField(default=False)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["display_order"]
        verbose_name = "mattress image"
        verbose_name_plural = "mattress images"

    def __str__(self):
        return f"{self.mattress.name} - image {self.display_order}"


class MattressSize(models.Model):
    mattress = models.ForeignKey(Mattress, on_delete=models.CASCADE, related_name="sizes")
    label = models.CharField(max_length=50, verbose_name="size label")
    width = models.IntegerField(verbose_name="width (cm)")
    length = models.IntegerField(verbose_name="length (cm)")
    price = models.DecimalField(max_digits=18, decimal_places=2, verbose_name="price")
    in_stock = models.BooleanField(default=True, verbose_name="in stock")

    class Meta:
        ordering = ["width", "length"]
        verbose_name = "mattress size"
        verbose_name_plural = "mattress sizes"

    def __str__(self):
        return f"{self.mattress.name} - {self.width}x{self.length}"

    @property
    def discount_price(self) -> Optional[Decimal]:
        """This size's own price after the parent mattress's discount, or None.

        Each size is priced independently, so the discount has to be applied to
        the size's price — reusing the mattress's discount_price here would
        quote a saving that has nothing to do with the size being bought.
        """
        if not self.mattress.has_discount:
            return None
        return apply_discount(self.price, self.mattress.off_percentage)

    @property
    def final_price(self) -> Decimal:
        discounted = self.discount_price
        return self.price if discounted is None else discounted


class MattressSpecification(models.Model):
    mattress = models.ForeignKey(Mattress, on_delete=models.CASCADE, related_name="specifications")
    key = models.CharField(max_length=100, verbose_name="specification key")
    value = models.CharField(max_length=255, verbose_name="specification value")
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["display_order"]
        verbose_name = "mattress specification"
        verbose_name_plural = "mattress specifications"

    def __str__(self):
        return f"{self.key}: {self.value}"


class MattressFeature(models.Model):
    mattress = models.ForeignKey(Mattress, on_delete=models.CASCADE, related_name="features")
    title = models.CharField(max_length=100, verbose_name="feature title")
    icon_name = models.CharField(max_length=50, blank=True, default="", verbose_name="lucide icon name")
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["display_order"]
        verbose_name = "mattress feature"
        verbose_name_plural = "mattress features"

    def __str__(self):
        return self.title


class MattressFAQ(models.Model):
    mattress = models.ForeignKey(Mattress, on_delete=models.CASCADE, related_name="faqs")
    question = models.CharField(max_length=255, verbose_name="question")
    answer = models.TextField(verbose_name="answer")
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["display_order"]
        verbose_name = "mattress FAQ"
        verbose_name_plural = "mattress FAQs"

    def __str__(self):
        return self.question


class MattressProCon(models.Model):
    PRO = "PRO"
    CON = "CON"
    TYPE_CHOICES = [(PRO, "Pro"), (CON, "Con")]

    mattress = models.ForeignKey(Mattress, on_delete=models.CASCADE, related_name="pros_cons")
    text = models.CharField(max_length=255, verbose_name="text")
    type = models.CharField(max_length=3, choices=TYPE_CHOICES, verbose_name="type")
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["type", "display_order"]
        verbose_name = "mattress pro/con"
        verbose_name_plural = "mattress pros & cons"

    def __str__(self):
        return f"[{self.type}] {self.text}"


class Review(models.Model):
    mattress = models.ForeignKey(Mattress, on_delete=models.CASCADE, related_name="reviews")
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="reviews")
    rating = models.PositiveIntegerField(verbose_name="rating")
    title = models.CharField(max_length=200, verbose_name="review title")
    body = models.TextField(verbose_name="review body")
    pros = models.TextField(blank=True, default="", verbose_name="pros")
    cons = models.TextField(blank=True, default="", verbose_name="cons")
    created_at = models.DateTimeField(auto_now_add=True)
    is_approved = models.BooleanField(default=False, verbose_name="is approved")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "review"
        verbose_name_plural = "reviews"

    def __str__(self):
        return f"{self.customer} - {self.mattress.name} ({self.rating}/5)"


# Keep Mattress.average_rating/review_count in step with the Review table from
# a single place. Approving, editing the score of, un-approving, or deleting a
# review all change the aggregate, and each of those happens from more than one
# code path (REST API, Django admin, shell), so hooking the model is more
# reliable than remembering to call update_rating_cache() at every call site.
@receiver(post_save, sender=Review)
def _review_saved(sender, instance: Review, **kwargs):
    instance.mattress.update_rating_cache()


@receiver(post_delete, sender=Review)
def _review_deleted(sender, instance: Review, **kwargs):
    # A cascade from Mattress.delete() removes its reviews too; skip the refresh
    # in that case, since the parent row is on its way out.
    try:
        mattress = instance.mattress
    except Mattress.DoesNotExist:
        return
    mattress.update_rating_cache()


class MattressInstance(models.Model):
    # Warranty lifecycle. A submission no longer activates the warranty — it
    # creates a PENDING request for an admin to approve or reject, so a
    # mistyped serial or a mismatched product is caught before coverage
    # starts. REJECTED is not terminal: the customer corrects the details and
    # resubmits, returning the row to PENDING.
    UNREGISTERED = "UNREGISTERED"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    WARRANTY_STATUS_CHOICES = [
        (UNREGISTERED, "Unregistered"),
        (PENDING, "Pending review"),
        (APPROVED, "Approved"),
        (REJECTED, "Rejected"),
    ]

    serial_number = models.CharField(
        max_length=100,
        primary_key=True,
        verbose_name="serial number",
    )
    mattress = models.ForeignKey(
        Mattress,
        on_delete=models.PROTECT,
        related_name="instances",
        verbose_name="mattress",
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mattress_instances",
        verbose_name="customer",
    )
    # Per-sale snapshot of the buyer's details, captured at warranty
    # registration. Kept on the instance (not only on the linked Customer) so
    # that registering a later instance for a different buyer can never rewrite
    # the recorded buyer of an earlier sale — the shared account Customer used
    # to be overwritten in place, which retroactively changed every past sale.
    buyer_first_name = models.CharField(max_length=150, blank=True, default="", verbose_name="buyer first name")
    buyer_last_name = models.CharField(max_length=150, blank=True, default="", verbose_name="buyer last name")
    buyer_phone_number = models.CharField(max_length=20, blank=True, default="", verbose_name="buyer phone number")
    buyer_address = models.TextField(blank=True, default="", verbose_name="buyer address")
    buyer_postal_code = models.CharField(max_length=20, blank=True, default="", verbose_name="buyer postal code")
    warranty_status = models.CharField(
        max_length=12,
        choices=WARRANTY_STATUS_CHOICES,
        default=UNREGISTERED,
        db_index=True,
        verbose_name="warranty status",
    )
    # Second-precision claim time. created_at records when we minted the
    # serial, not when a customer claimed it, and activation_date is only
    # day-precise — neither can order the review queue.
    warranty_submitted_at = models.DateTimeField(
        null=True, blank=True, verbose_name="warranty submitted at"
    )
    warranty_reviewed_at = models.DateTimeField(
        null=True, blank=True, verbose_name="warranty reviewed at"
    )
    warranty_reviewed_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_warranties",
        verbose_name="warranty reviewed by",
    )
    warranty_rejection_reason = models.TextField(
        blank=True, default="", verbose_name="warranty rejection reason"
    )
    activation_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="activation date",
    )
    manufacture_date = models.DateField(verbose_name="manufacture date")
    # Real creation instant, to the second. manufacture_date is only day-precise
    # and is entered by hand, so it can't order instances registered on the
    # same day; this is what the admin list sorts by.
    created_at = models.DateTimeField(
        auto_now_add=True, db_index=True, verbose_name="created at"
    )

    class Meta:
        verbose_name = "mattress instance"
        verbose_name_plural = "mattress instances"
        ordering = ["-created_at", "serial_number"]

    def __str__(self) -> str:
        return self.serial_number

    @property
    def buyer_full_name(self) -> str:
        """The buyer recorded for this specific sale.

        Prefers the per-instance snapshot; falls back to the linked account
        Customer for instances registered before the snapshot fields existed.
        """
        name = f"{self.buyer_first_name} {self.buyer_last_name}".strip()
        if name:
            return name
        if self.customer_id is not None:
            return f"{self.customer.first_name} {self.customer.last_name}".strip()
        return ""

    @property
    def is_warranty_active(self) -> bool:
        """True only for an admin-approved warranty.

        This was a stored BooleanField before the approval flow existed. It is
        kept as a property so serializers, the CSV export, and the admin
        dashboard keep reading the same name while `warranty_status` is the
        only stored truth. It cannot be used in a queryset filter — use
        `warranty_status=MattressInstance.APPROVED` there.
        """
        return self.warranty_status == self.APPROVED

    @property
    def warranty_expiration_date(self) -> Optional[date]:
        if self.activation_date is None:
            return None
        return add_months(self.activation_date, self.mattress.warranty_months)

    @property
    def warranty_remaining_days(self) -> Optional[int]:
        expiration_date = self.warranty_expiration_date
        if expiration_date is None:
            return None
        return (expiration_date - timezone.localdate()).days

    @property
    def is_under_warranty(self) -> bool:
        if not self.is_warranty_active or self.activation_date is None:
            return False
        expiration_date = self.warranty_expiration_date
        if expiration_date is None:
            return False
        return timezone.localdate() <= expiration_date
