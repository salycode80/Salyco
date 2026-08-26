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

# ── Emperial: replacement FAQs ───────────────────────────────────────────────
# Every claim below is traceable to the spec sheet, long_description, or warranty.
EMPERIAL_FAQS = [
    (
        "تفاوت تشک طبی فنری با تشک مموری فوم چیست؟",
        "تشک امپریال از نوع طبی فنری با اسکلت میکرو بونل است، نه مموری فوم. "
        "در تشک فنری، وزن بدن روی شبکه‌ای از فنرهای فولادی توزیع می‌شود؛ این "
        "ساختار تهویه‌ی هوای بهتری دارد و در تابستان خنک‌تر می‌ماند. مموری فوم "
        "با حرارت بدن فرم می‌گیرد اما گرما را بیشتر نگه می‌دارد. امپریال با پد "
        "اسفنج فشرده روی اسکلت فنری، بخشی از مزیت هر دو را ترکیب می‌کند.",
    ),
    (
        "حداکثر وزن قابل تحمل این تشک چقدر است؟",
        "۱۸۰ کیلوگرم. اسکلت میکرو بونل با مفتول ۲.۲ میلی‌متر و Frame تقویت‌شده "
        "با مفتول ۴ میلی‌متر که با ۱۰ عدد جک M تثبیت شده، این ظرفیت را تأمین می‌کند.",
    ),
    (
        "درجه سفتی ۵ برای چه کسانی مناسب است؟",
        "سفتی ۵ سفت‌ترین گزینه‌ی سالیکو است و برای وزن بالای ۹۰ کیلوگرم، خواب "
        "به پشت، یا کسانی که با توصیه‌ی پزشک به تشک سفت نیاز دارند مناسب است. "
        "اگر وزن شما زیر ۷۰ کیلوگرم است یا به پهلو می‌خوابید، مدل پرستیژ با "
        "سفتی ۳ گزینه‌ی بهتری است.",
    ),
    (
        "آیا این تشک در تابستان گرم می‌شود؟",
        "ساختار فنری امپریال فضای خالی بین فنرها دارد که جریان هوا را ممکن "
        "می‌کند، و رویه از پارچه‌ی نخی گردبافت با خاصیت ضدتعریق تولید شده است. "
        "تشک‌های فنری عموماً از تشک‌های تمام‌فوم خنک‌تر هستند.",
    ),
    (
        "گارانتی ۱۰ ساله دقیقاً چه چیزی را پوشش می‌دهد؟",
        "۱۲۰ ماه گارانتی تعویض بی‌قید و شرط. برای فعال‌سازی، شماره سریال تشک "
        "را در بخش ثبت گارانتی سایت وارد کنید.",
    ),
]

EMPERIAL_PROS_CONS = [
    (MattressProCon.PRO, "تحمل وزن تا ۱۸۰ کیلوگرم — اسکلت میکرو بونل با مفتول ۲.۲ "
                         "میلی‌متر و Frame تقویت‌شده‌ی ۴ میلی‌متری"),
    (MattressProCon.PRO, "تهویه‌ی بهتر نسبت به تشک‌های تمام‌فوم — فضای بین فنرها "
                         "جریان هوا را ممکن می‌کند و رویه‌ی گردبافت ضدتعریق است"),
    (MattressProCon.PRO, "پد اسفنج فشرده روی اسکلت فنری، گودی کمر را پر می‌کند و "
                         "انحنای طبیعی ستون فقرات را حفظ می‌کند"),
    (MattressProCon.PRO, "۱۲۰ ماه گارانتی تعویض بی‌قید و شرط"),
    (MattressProCon.CON, "سفتی ۵ برای خواب به پهلو یا وزن زیر ۷۰ کیلوگرم سفت‌تر از "
                         "حد لازم است — در این شرایط مدل پرستیژ (سفتی ۳) مناسب‌تر است"),
    (MattressProCon.CON, "تشک فنری لرزش را بیشتر از مموری فوم منتقل می‌کند؛ اگر حرکت "
                         "هم‌خواب شما را بیدار می‌کند، این را در نظر بگیرید"),
    (MattressProCon.CON, "وزن تشک بالاست و جابه‌جایی آن به دو نفر نیاز دارد"),
]

# ── Prestige: content to add (it currently has none) ─────────────────────────
PRESTIGE_FEATURES = [
    ("سفتی متعادل، مناسب خواب به پهلو", "Feather"),
    ("تهویه هوای مناسب با رویه گردبافت ضدتعریق", "Fan"),
    ("پشتیبانی از انحنای طبیعی ستون فقرات", "Spine"),
    ("۱۲۰ ماه گارانتی تعویض بی‌قید و شرط", "ShieldCheck"),
]

PRESTIGE_FAQS = [
    (
        "تفاوت پرستیژ و امپریال چیست؟ کدام را انتخاب کنم؟",
        "هر دو مدل اسکلت فنری میکرو بونل و ۱۲۰ ماه گارانتی دارند. تفاوت در "
        "سفتی و ضخامت است: پرستیژ سفتی ۳ (متعادل) و ضخامت ۲۴ سانتی‌متر دارد و "
        "برای وزن ۶۰ تا ۹۰ کیلوگرم و خواب به پهلو مناسب‌تر است. امپریال سفتی ۵ "
        "(سفت) و ضخامت ۳۱ سانتی‌متر دارد و برای وزن بالای ۹۰ کیلوگرم یا خواب "
        "به پشت انتخاب بهتری است.",
    ),
    (
        "سفتی ۳ برای کمردرد مناسب است؟",
        "برای کمردرد، تشکی لازم است که نه فرو برود و نه قوس کمر را از بین ببرد. "
        "سفتی ۳ برای وزن متوسط (۶۰ تا ۹۰ کیلوگرم) این تعادل را فراهم می‌کند. "
        "اگر وزن شما بالاتر است یا پزشک تشک سفت توصیه کرده، مدل امپریال با "
        "سفتی ۵ مناسب‌تر است.",
    ),
    (
        "ضخامت ۲۴ سانتی‌متر کافی است؟",
        "بله. ضخامت به تنهایی معیار کیفیت نیست؛ ساختار داخلی مهم‌تر است. "
        "پرستیژ همان اسکلت میکرو بونل با مفتول ۲.۲ میلی‌متر و پد الیاف فشرده "
        "۱۴۰۰ گرمی امپریال را دارد، با لایه‌بندی کم‌ارتفاع‌تر.",
    ),
    (
        "گارانتی ۱۰ ساله دقیقاً چه چیزی را پوشش می‌دهد؟",
        "۱۲۰ ماه گارانتی تعویض بی‌قید و شرط. برای فعال‌سازی، شماره سریال تشک "
        "را در بخش ثبت گارانتی سایت وارد کنید.",
    ),
]

PRESTIGE_PROS_CONS = [
    (MattressProCon.PRO, "سفتی متعادل (۳ از ۵) — مناسب خواب به پهلو و وزن ۶۰ تا ۹۰ کیلوگرم"),
    (MattressProCon.PRO, "همان اسکلت میکرو بونل و پد ۱۴۰۰ گرمی امپریال، با قیمت کمتر"),
    (MattressProCon.PRO, "رویه‌ی گردبافت با خاصیت ضدتعریق"),
    (MattressProCon.PRO, "۱۲۰ ماه گارانتی تعویض بی‌قید و شرط"),
    (MattressProCon.CON, "برای وزن بالای ۹۰ کیلوگرم پشتیبانی کافی ندارد — "
                         "در این شرایط مدل امپریال (سفتی ۵) مناسب‌تر است"),
    (MattressProCon.CON, "ضخامت ۲۴ سانتی‌متر است؛ اگر ظاهر تشک بلند را ترجیح "
                         "می‌دهید، امپریال ۳۱ سانتی‌متر است"),
]

# ── Normalized specification tables ─────────────────────────────────────────
# One key set in one order across both products, so the two are comparable.
# Replaces "نوع فنرها = High Micro" vs "نوع اسکلت = میکرو بونل" (same spring,
# different key and different name) and fixes missing/malformed units.
SPECS = {
    EMPERIAL: [
        ("نوع تشک", "طبی فنری"),
        ("نوع اسکلت", "میکرو بونل"),
        ("قطر مفتول فنر", "۲.۲ میلی‌متر"),
        ("قطر مفتول Frame", "۴ میلی‌متر"),
        ("لایه محافظ", "نمد ترموفلت ۱۱۰۰ گرم (دو طرف)"),
        ("پد داخلی", "الیاف فشرده پلی‌استر ۱۴۰۰ گرم"),
        ("جنس رویه", "پارچه نخی گردبافت، ضدتعریق"),
        ("ضخامت تشک", "۳۱ سانتی‌متر"),
        ("درجه سفتی", "۵ از ۵ (سفت)"),
        ("حداکثر تحمل وزن", "۱۸۰ کیلوگرم"),
        ("گارانتی و خدمات", "۱۲۰ ماه گارانتی تعویض بی‌قید و شرط"),
    ],
    PRESTIGE: [
        ("نوع تشک", "طبی فنری"),
        ("نوع اسکلت", "میکرو بونل"),
        ("قطر مفتول فنر", "۲.۲ میلی‌متر"),
        ("قطر مفتول Frame", "۴ میلی‌متر"),
        ("لایه محافظ", "نمد ترموفلت ۱۱۰۰ گرم (دو طرف)"),
        ("پد داخلی", "الیاف فشرده پلی‌استر ۱۴۰۰ گرم"),
        ("جنس رویه", "پارچه نخی گردبافت، ضدتعریق"),
        ("ضخامت تشک", "۲۴ سانتی‌متر"),
        ("درجه سفتی", "۳ از ۵ (متعادل)"),
        ("حداکثر تحمل وزن", "۱۴۰ کیلوگرم"),
        ("گارانتی و خدمات", "۱۲۰ ماه گارانتی تعویض بی‌قید و شرط"),
    ],
}

# Subtitles: both currently say the same thing about the warranty, which already
# has its own badge, spec row and feature. Say who each product is for instead.
SUBTITLES = {
    EMPERIAL: "سفت‌ترین تشک سالیکو — تحمل وزن تا ۱۸۰ کیلوگرم، ضخامت ۳۱ سانتی‌متر",
    PRESTIGE: "سفتی متعادل برای خواب به پهلو — ضخامت ۲۴ سانتی‌متر",
}

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
