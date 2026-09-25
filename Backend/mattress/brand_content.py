"""Approved editorial reference: root Design.md v2, section 10.

Used by content-maintenance commands, never as a storefront price or stock
override. Existing product records remain the API's source of truth.
"""

WARRANTY_NOTE = (
    "مدت ضمانت این مدل ۱۰ سال است. پوشش خدمات تابع شرایط تأییدشدهٔ گارانتی است؛ "
    "مدت ضمانت به معنی پوشش همهٔ آسیب‌ها نیست. برای پیگیری به بخش خدمات پس از فروش مراجعه کنید."
)

MODELS = {
    "imperial": {
        "height": 31, "weight_per_person": 140, "warranty_months": 120,
        "subtitle": "مدل لوکس سه‌نواره با اسفنج ۳ سانتی و پلی‌استر فشرده در هر دو سمت",
        "feel": "دارای لایهٔ اسفنج در هر دو سمت",
        "layers": "اسفنج ۳ سانتی و پلی‌استر فشرده در هر دو سمت",
    },
    "prestige": {
        "height": 26, "weight_per_person": 130, "warranty_months": 120,
        "subtitle": "حس سفت‌تر؛ ساختار امپریال بدون دو لایهٔ اسفنج",
        "feel": "سفت‌تر از امپریال",
        "layers": "ساختار امپریال بدون دو لایهٔ اسفنج",
    },
    "hermes": {
        "height": 28, "weight_per_person": 130, "warranty_months": 96,
        "subtitle": "یک تشک با دو حس خواب متفاوت",
        "feel": "دو سطح با حس خواب متفاوت",
        "layers": "یک سمت اسفنج ۳ سانتی در پد دوخته‌شدهٔ غیرقابل‌جداسازی؛ سمت دیگر پلی‌استر فشرده",
    },
}


def persian(value):
    return str(value).translate(str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹"))


def specifications(model):
    data = MODELS[model]
    return [
        ("نوع اسکلت", "فنر متصل میکرو بونل"),
        ("ارتفاع تقریبی", f"{persian(data['height'])} سانتی‌متر"),
        ("تحمل وزن تقریبی برای هر نفر", f"{persian(data['weight_per_person'])} کیلوگرم"),
        ("حس خواب", data["feel"]),
        ("تفاوت لایه‌ها", data["layers"]),
        ("مدت ضمانت", f"{persian(data['warranty_months'] // 12)} سال، طبق شرایط گارانتی"),
    ]
