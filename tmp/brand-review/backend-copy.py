from pathlib import Path
p = Path('Backend/mattress/management/commands/fix_product_content.py')
s = p.read_text(encoding='utf-8')
start = s.index('# ── Emperial: replacement FAQs')
end = s.index('# Gallery alt text')
s = s[:start] + '''# Approved replacement copy from Design.md v2. Prices and inventory are untouched.
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

''' + s[end:]
# This legacy command must not silently promise that it reconciles all old rows.
s = s.replace('        self.changes = 0', '        self.stdout.write(self.style.WARNING(\n            "Reference: Design.md v2. Existing FAQs/features outside these keys are not "\n            "automatically removed. Review product records and legacy copy before publishing."))\n        self.changes = 0')
p.write_text(s, encoding='utf-8')
