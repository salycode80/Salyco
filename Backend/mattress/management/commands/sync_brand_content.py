"""Preview/apply approved editorial content without touching commercial data."""
import json

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from mattress.brand_content import MODELS, persian, specifications
from mattress.models import Mattress

ALIASES = {
    "imperial": ("تشک-امپریال", "tsh-slo-mdl-shmrh-1"),
    "prestige": ("تشک-پرستیژ", "mdl-rst"),
    # The live catalogue serves this model as `mdl-hrms-hermes`. The older
    # "hermes" spelling matched nothing, so the command reported
    # "SKIP hermes: no matching product" and left the stale copy on the site.
    "hermes": ("تشک-هرمس", "mdl-hrms-hermes", "hermes"),
}


class Command(BaseCommand):
    help = "Preview Design.md v2 product copy; --apply replaces selected products' editorial fields."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true")
        parser.add_argument("--model", choices=MODELS, action="append")

    @transaction.atomic
    def handle(self, *args, **options):
        for key in options["model"] or MODELS:
            matches = list(Mattress.objects.filter(
                category=Mattress.CATEGORY_MATTRESS, slug__in=ALIASES[key]
            ).select_for_update())
            if len(matches) > 1:
                raise CommandError(f"Ambiguous {key}: multiple aliases exist; no changes committed.")
            if not matches:
                self.stdout.write(f"SKIP {key}: no matching product; no product created.")
                continue
            product = matches[0]
            reference = MODELS[key]
            years = reference["warranty_months"] // 12
            warranty = f"{persian(years)} سال ضمانت طبق شرایط تأییدشدهٔ گارانتی؛ مدت ضمانت به معنی پوشش همهٔ آسیب‌ها نیست."
            fields = {
                "height": reference["height"],
                "warranty_months": reference["warranty_months"],
                "subtitle": reference["subtitle"],
                "description": reference["subtitle"],
                "long_description": "فنر متصل میکرو بونل. " + reference["layers"] + ". " + warranty,
                # The guide specifies relative feel, not a numeric firmness score.
                "firmness": None,
                "material": "فنر متصل میکرو بونل",
            }
            self.stdout.write(json.dumps({
                "product": product.slug,
                "fields": {field: {"before": getattr(product, field), "after": value}
                           for field, value in fields.items() if getattr(product, field) != value},
                "replace_editorial_collections": {
                    "specifications": product.specifications.count(),
                    "features": product.features.count(),
                    "faqs": product.faqs.count(),
                    "pros_cons": product.pros_cons.count(),
                },
                "approved_specs": specifications(key),
            }, ensure_ascii=False))
            if not options["apply"]:
                continue
            for field, value in fields.items():
                setattr(product, field, value)
            product.save(update_fields=list(fields))
            product.specifications.all().delete()
            for order, (label, value) in enumerate(specifications(key)):
                product.specifications.create(key=label, value=value, display_order=order)
            product.features.all().delete()
            for order, (title, icon) in enumerate([
                (reference["feel"], "BedDouble"),
                (f"ارتفاع تقریبی {persian(reference['height'])} سانتی‌متر", "Ruler"),
                (f"تحمل وزن تقریبی {persian(reference['weight_per_person'])} کیلوگرم برای هر نفر", "User"),
                (f"{persian(years)} سال ضمانت طبق شرایط گارانتی", "ShieldCheck"),
            ]):
                product.features.create(title=title, icon_name=icon, display_order=order)
            product.faqs.all().delete()
            product.faqs.create(question="تفاوت ساختار این مدل چیست؟", answer=reference["layers"], display_order=0)
            product.faqs.create(question="ضمانت این مدل چگونه است؟", answer=warranty, display_order=1)
            product.pros_cons.all().delete()
        self.stdout.write("Applied approved editorial content." if options["apply"] else "Preview only. Use --apply after reviewing this diff.")
