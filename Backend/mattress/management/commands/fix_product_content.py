"""Correct the published product content for the two live mattresses.

Why this exists: Emperial's FAQs and pros/cons were written for a MEMORY FOAM
mattress and attached to a spring product. They assert Cool Gel, Open Cell and
OEKO-TEX certification that appear nowhere in the build, and one "complete motion
isolation" claim that its own micro-bonnell coil core contradicts. Its
long_description also credits Prestige's internal pad. Those are representations
to buyers, not copy-polish, so they are fixed in code with an audit trail rather
than hand-edited in the admin.

Full rationale and the source copy: .claude/salyco-product-copy-rewrite.md

Idempotent. Content is keyed on a stable field (question text, spec key, pro/con
text), so re-running converges instead of duplicating. Anything a human has since
hand-edited is reported and left alone unless --overwrite is passed.

    python manage.py fix_product_content --dry-run    # report, change nothing
    python manage.py fix_product_content              # apply
    python manage.py fix_product_content --overwrite  # also replace hand-edits

Reviewed with --dry-run first, always: this rewrites live storefront copy.
"""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction

from mattress.models import (
    Mattress,
    MattressFAQ,
    MattressFeature,
    MattressProCon,
    MattressSpecification,
    Review,
)

EMPERIAL = "tsh-slo-mdl-shmrh-1"
PRESTIGE = "mdl-rst"

# ── Emperial: content to delete ──────────────────────────────────────────────
# Matched on a distinctive substring rather than pk, so this still finds the row
# after an admin edit or a re-seed. Every entry names the false claim it removes.
EMPERIAL_FAQ_DELETE = [
    ("مموری فوم", "asks about memory foam; Emperial is طبی فنری (micro-bonnell)"),
    ("Cool Gel", "claims cooling-gel tech absent from the build"),
    ("OEKO-TEX", "claims a certification not present in the spec sheet"),
]
EMPERIAL_PROCON_DELETE = [
    ("ایزوله‌ی کامل حرکت", "contradicts the build: bonnell coils are interconnected"),
    ("مموری فوم", "credits memory foam the product does not contain"),
    ("ضد حساسیت", "unsubstantiated in the spec sheet"),
    ("لایه‌ی فوم", "references a foam layer the product does not have"),
    ("عمر مفید ۱۲ ساله", "12 years contradicts the 120-month warranty"),
]

# Approved replacement copy from Design.md v2. Prices and inventory are untouched.
from mattress.brand_content import MODELS, WARRANTY_NOTE, specifications

EMPERIAL_FAQS = [
    ("ساختار امپریال چیست؟", "فنر متصل میکرو بونل با اسفنج ۳ سانتی و پلی‌استر فشرده در هر دو سمت."),
    ("تحمل وزن تقریبی برای هر نفر چقدر است؟", "حدود ۱۴۰ کیلوگرم برای هر نفر."),
    ("ارتفاع تقریبی این مدل چقدر است؟", "حدود ۳۱ سانتی‌متر."),
    ("گارانتی ۱۰ ساله دقیقاً چه چیزی را پوشش می‌دهد؟", WARRANTY_NOTE),
]
EMPERIAL_PROS_CONS = [
    (MattressProCon.PRO, MODELS["imperial"]["layers"]),
    (MattressProCon.PRO, "مدل لوکس سه‌نواره با ارتفاع تقریبی ۳۱ سانتی‌متر"),
]
PRESTIGE_FEATURES = [
    ("حس سفت‌تر از امپریال", "BedDouble"),
    ("فنر متصل میکرو بونل", "Layers"),
    ("ارتفاع تقریبی ۲۶ سانتی‌متر", "Ruler"),
    ("۱۰ سال ضمانت طبق شرایط گارانتی", "ShieldCheck"),
]
PRESTIGE_FAQS = [
    ("تفاوت پرستیژ و امپریال چیست؟ کدام را انتخاب کنم؟",
     "پرستیژ ساختار امپریال را بدون دو لایهٔ اسفنج دارد و حس سفت‌تری ارائه می‌کند. "
     "ارتفاع تقریبی پرستیژ ۲۶ و امپریال ۳۱ سانتی‌متر است. انتخاب به ترجیح حس خواب شما بستگی دارد."),
    ("تحمل وزن تقریبی برای هر نفر چقدر است؟", "حدود ۱۳۰ کیلوگرم برای هر نفر."),
    ("گارانتی ۱۰ ساله دقیقاً چه چیزی را پوشش می‌دهد؟", WARRANTY_NOTE),
]
PRESTIGE_PROS_CONS = [
    (MattressProCon.PRO, MODELS["prestige"]["subtitle"]),
    (MattressProCon.PRO, "ارتفاع تقریبی ۲۶ سانتی‌متر"),
]
SPECS = {EMPERIAL: specifications("imperial"), PRESTIGE: specifications("prestige")}
SUBTITLES = {EMPERIAL: MODELS["imperial"]["subtitle"], PRESTIGE: MODELS["prestige"]["subtitle"]}

# Gallery alt text, keyed on the filename fragment. Every image currently has
# alt_text="" and none is flagged is_primary.
GALLERY_ALT = {
    "main": ("تشک طبی فنری سالیکو مدل امپریال، نمای کامل", True),
    "empra5": ("نمای نزدیک رویه گردبافت تشک امپریال سالیکو", False),
    "empralayers": ("برش مقطعی لایه‌های داخلی تشک امپریال: اسکلت میکرو بونل، "
                    "نمد ترموفلت و پد پلی‌استر", False),
    "prestige1": ("تشک طبی فنری سالیکو مدل پرستیژ، نمای کامل", True),
}


class Command(BaseCommand):
    help = "Correct published product copy, specs, FAQs and pros/cons for the live mattresses."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true",
                            help="report every change without writing")
        parser.add_argument("--overwrite", action="store_true",
                            help="also replace rows that differ from the expected text")

    def handle(self, *args, **options):
        self.dry = options["dry_run"]
        self.overwrite = options["overwrite"]
        self.stdout.write(self.style.WARNING(
            "Reference: Design.md v2. Existing FAQs/features outside these keys are not "
            "automatically removed. Review product records and legacy copy before publishing."))
        self.changes = 0
        self.warnings = []

        if self.dry:
            self.stdout.write(self.style.WARNING("DRY RUN — nothing will be written\n"))

        try:
            with transaction.atomic():
                emperial = self._get(EMPERIAL)
                prestige = self._get(PRESTIGE)

                if emperial:
                    self._section("Emperial — remove memory-foam content")
                    self._delete_faqs(emperial, EMPERIAL_FAQ_DELETE)
                    self._delete_procons(emperial, EMPERIAL_PROCON_DELETE)

                    self._section("Emperial — fix long_description")
                    self._fix_emperial_description(emperial)

                    self._section("Emperial — FAQs, pros/cons, specs, subtitle")
                    self._sync_faqs(emperial, EMPERIAL_FAQS)
                    self._sync_procons(emperial, EMPERIAL_PROS_CONS)
                    self._sync_specs(emperial, SPECS[EMPERIAL])
                    self._set_subtitle(emperial, SUBTITLES[EMPERIAL])
                    self._fix_gallery(emperial)
                    self._purge_test_reviews(emperial)

                if prestige:
                    self._section("Prestige — bring to parity")
                    self._sync_features(prestige, PRESTIGE_FEATURES)
                    self._sync_faqs(prestige, PRESTIGE_FAQS)
                    self._sync_procons(prestige, PRESTIGE_PROS_CONS)
                    self._sync_specs(prestige, SPECS[PRESTIGE])
                    self._set_subtitle(prestige, SUBTITLES[PRESTIGE])
                    self._fix_gallery(prestige)

                if self.dry:
                    raise _Rollback()
        except _Rollback:
            pass

        self.stdout.write("")
        if self.warnings:
            self.stdout.write(self.style.WARNING(
                f"{len(self.warnings)} row(s) left alone because they differ from the "
                f"expected text (pass --overwrite to replace):"))
            for w in self.warnings:
                self.stdout.write(f"    · {w}")
            self.stdout.write("")

        verb = "would change" if self.dry else "changed"
        self.stdout.write(self.style.SUCCESS(f"{verb} {self.changes} record(s)."))
        if self.dry:
            self.stdout.write("Re-run without --dry-run to apply.")

    # ── helpers ─────────────────────────────────────────────────────────────

    def _section(self, title):
        self.stdout.write(self.style.MIGRATE_HEADING(f"\n{title}"))

    def _log(self, msg, style=None):
        self.stdout.write(f"  {style(msg) if style else msg}")
        self.changes += 1

    def _get(self, slug):
        try:
            return Mattress.objects.get(slug=slug)
        except Mattress.DoesNotExist:
            self.stdout.write(self.style.ERROR(
                f"no Mattress with slug={slug!r} — skipping. "
                f"Slugs may have been migrated; check _slugmap.txt."))
            return None

    def _delete_faqs(self, m, patterns):
        for needle, reason in patterns:
            for faq in m.faqs.filter(question__icontains=needle):
                self._log(f"DELETE faq  {faq.question[:58]}…", self.style.ERROR)
                self.stdout.write(f"         reason: {reason}")
                if not self.dry:
                    faq.delete()
            # The Cool Gel / OEKO-TEX claims sit in answers, not questions.
            for faq in m.faqs.filter(answer__icontains=needle):
                self._log(f"DELETE faq  {faq.question[:58]}…", self.style.ERROR)
                self.stdout.write(f"         reason: {reason}")
                if not self.dry:
                    faq.delete()

    def _delete_procons(self, m, patterns):
        for needle, reason in patterns:
            for pc in m.pros_cons.filter(text__icontains=needle):
                self._log(f"DELETE {pc.type}  {pc.text[:56]}…", self.style.ERROR)
                self.stdout.write(f"         reason: {reason}")
                if not self.dry:
                    pc.delete()

    def _fix_emperial_description(self, m):
        """Emperial's long_description credits Prestige's internal pad."""
        if "پد داخلی پرستیژ" not in m.long_description:
            self.stdout.write("  long_description: already correct")
            return
        new = m.long_description.replace("پد داخلی پرستیژ", "پد داخلی امپریال")
        self._log("FIX    long_description: 'پد داخلی پرستیژ' → 'پد داخلی امپریال'",
                  self.style.SUCCESS)
        if not self.dry:
            m.long_description = new
            m.save(update_fields=["long_description"])

    def _sync_faqs(self, m, faqs):
        for order, (question, answer) in enumerate(faqs):
            existing = m.faqs.filter(question=question).first()
            if existing:
                if existing.answer == answer and existing.display_order == order:
                    continue
                if existing.answer != answer and not self.overwrite:
                    self.warnings.append(f"FAQ '{question[:44]}…' answer differs")
                    continue
                self._log(f"UPDATE faq  {question[:58]}…")
                if not self.dry:
                    existing.answer = answer
                    existing.display_order = order
                    existing.save(update_fields=["answer", "display_order"])
            else:
                self._log(f"CREATE faq  {question[:58]}…", self.style.SUCCESS)
                if not self.dry:
                    MattressFAQ.objects.create(
                        mattress=m, question=question, answer=answer,
                        display_order=order)

    def _sync_procons(self, m, rows):
        for order, (kind, text) in enumerate(rows):
            if m.pros_cons.filter(text=text, type=kind).exists():
                pc = m.pros_cons.get(text=text, type=kind)
                if pc.display_order != order:
                    self._log(f"ORDER  {kind}  {text[:52]}…")
                    if not self.dry:
                        pc.display_order = order
                        pc.save(update_fields=["display_order"])
                continue
            self._log(f"CREATE {kind}  {text[:52]}…", self.style.SUCCESS)
            if not self.dry:
                MattressProCon.objects.create(
                    mattress=m, text=text, type=kind, display_order=order)

    def _sync_features(self, m, rows):
        for order, (title, icon) in enumerate(rows):
            existing = m.features.filter(title=title).first()
            if existing:
                if existing.display_order == order and existing.icon_name == icon:
                    continue
                self._log(f"UPDATE feat {title[:56]}…")
                if not self.dry:
                    existing.icon_name = icon
                    existing.display_order = order
                    existing.save(update_fields=["icon_name", "display_order"])
            else:
                self._log(f"CREATE feat {title[:56]}…", self.style.SUCCESS)
                if not self.dry:
                    MattressFeature.objects.create(
                        mattress=m, title=title, icon_name=icon, display_order=order)

    def _sync_specs(self, m, rows):
        """Replace the spec table wholesale.

        Keys themselves are being renamed (نوع فنرها → نوع اسکلت), so a
        key-by-key upsert would leave the old rows behind.
        """
        wanted = {k: v for k, v in rows}
        for spec in m.specifications.all():
            if spec.key not in wanted:
                self._log(f"DELETE spec {spec.key} = {spec.value[:36]}",
                          self.style.ERROR)
                if not self.dry:
                    spec.delete()

        for order, (key, value) in enumerate(rows):
            existing = m.specifications.filter(key=key).first()
            if existing:
                if existing.value == value and existing.display_order == order:
                    continue
                if existing.value != value and not self.overwrite:
                    self.warnings.append(
                        f"spec '{key}' is {existing.value!r}, expected {value!r}")
                    continue
                self._log(f"UPDATE spec {key} = {value[:36]}")
                if not self.dry:
                    existing.value = value
                    existing.display_order = order
                    existing.save(update_fields=["value", "display_order"])
            else:
                self._log(f"CREATE spec {key} = {value[:36]}", self.style.SUCCESS)
                if not self.dry:
                    MattressSpecification.objects.create(
                        mattress=m, key=key, value=value, display_order=order)

    def _set_subtitle(self, m, subtitle):
        if m.subtitle == subtitle:
            return
        if m.subtitle and "گارانتی" not in m.subtitle and not self.overwrite:
            self.warnings.append(f"subtitle for {m.slug} looks hand-edited: {m.subtitle!r}")
            return
        self._log(f"UPDATE subtitle → {subtitle[:52]}…")
        if not self.dry:
            m.subtitle = subtitle
            m.save(update_fields=["subtitle"])

    def _fix_gallery(self, m):
        for img in m.images.all():
            name = img.image.name.rsplit("/", 1)[-1].rsplit(".", 1)[0]
            match = next((v for k, v in GALLERY_ALT.items() if k == name), None)
            if match is None:
                if not img.alt_text:
                    self.warnings.append(
                        f"gallery image {img.image.name} has no alt text and no "
                        f"mapping in GALLERY_ALT")
                continue
            alt, primary = match
            fields = []
            if img.alt_text != alt:
                fields.append("alt_text")
            if img.is_primary != primary:
                fields.append("is_primary")
            if not fields:
                continue
            self._log(f"UPDATE image {name}: {', '.join(fields)}", self.style.SUCCESS)
            if not self.dry:
                img.alt_text = alt
                img.is_primary = primary
                img.save(update_fields=fields)

    def _purge_test_reviews(self, m):
        """Drop reviews whose body is a single word repeated from the title.

        The live 2.00 on Emperial comes from one row: rating=2, title='عالی',
        body='عالی' -- a 2-star score whose text says "excellent", left by a
        smoke test. It is the only input to the public rating. Narrow filter so a
        real terse review is never caught: body must equal title AND be under 12
        characters AND have no pros/cons.
        """
        for r in m.reviews.all():
            terse = (r.body.strip() == r.title.strip()
                     and len(r.body.strip()) < 12
                     and not r.pros.strip() and not r.cons.strip())
            if not terse:
                continue
            self._log(f"DELETE review id={r.id} rating={r.rating} "
                      f"title={r.title!r} body={r.body!r}", self.style.ERROR)
            self.stdout.write("         reason: body duplicates title and is "
                              "too short to be a real review (smoke test)")
            if not self.dry:
                r.delete()   # post_delete signal recomputes the rating cache

        if not self.dry:
            m.refresh_from_db()
            m.update_rating_cache()
            m.refresh_from_db()
            self.stdout.write(f"  rating cache now: average={m.average_rating} "
                              f"count={m.review_count}")


class _Rollback(Exception):
    """Aborts the transaction so --dry-run writes nothing."""
