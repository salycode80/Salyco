"""Seed demo products for the non-mattress categories.

Idempotent: keyed on slug via get_or_create, so re-running tops up anything
missing without duplicating rows or editing products you have since hand-tuned.
Existing mattresses are never touched.

    python manage.py seed_products
    python manage.py seed_products --reset   # delete seeded rows first
"""

from __future__ import annotations

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from mattress.models import (
    Mattress,
    MattressFAQ,
    MattressFeature,
    MattressProCon,
    MattressSize,
    MattressSpecification,
)

# The six canonical bed footprints, mirroring STANDARD_SIZES in the frontend's
# ProductDetail page. Bedbox and topper are sized to the bed, so they reuse these.
BED_SIZES = [
    ("یک‌نفره استاندارد", 90, 200),
    ("یک‌نفره بزرگ", 120, 200),
    ("دو نفره کوچک", 140, 200),
    ("دو نفره کوئین", 160, 200),
    ("دو نفره کینگ", 180, 200),
    ("دو نفره سوپر کینگ", 200, 200),
]

# Duvets are cut oversized relative to the mattress they dress — a 160×200 bed
# takes a 220×240 duvet — so they get their own table rather than BED_SIZES.
DUVET_SIZES = [
    ("یک‌نفره", 140, 220),
    ("دو نفره", 200, 220),
    ("دو نفره بزرگ", 220, 240),
]


def _bed_sizes(base: int, step: int) -> list[dict]:
    """Price the canonical bed sizes from `base`, adding `step` per width jump."""
    return [
        {
            "label": label,
            "width": width,
            "length": length,
            "price": Decimal(base + step * index),
        }
        for index, (label, width, length) in enumerate(BED_SIZES)
    ]


def _duvet_sizes(base: int, step: int) -> list[dict]:
    return [
        {
            "label": label,
            "width": width,
            "length": length,
            "price": Decimal(base + step * index),
        }
        for index, (label, width, length) in enumerate(DUVET_SIZES)
    ]


# ── باکس تخت خواب ────────────────────────────────────────────────────────────
BEDBOX_PRODUCTS = [
    {
        "slug": "salyco-box-classic",
        "category": Mattress.CATEGORY_BEDBOX,
        "name": "باکس تخت خواب کلاسیک سالیکو",
        "subtitle": "باکس چوبی با روکش پارچه‌ای و پایه‌های فلزی مقاوم",
        "description": (
            "باکس تخت خواب کلاسیک سالیکو با بدنه تمام‌چوب و روکش پارچه‌ای ضدلک، "
            "پایه‌ای محکم و بی‌صدا برای تشک شما فراهم می‌کند."
        ),
        "long_description": (
            "بدنه این باکس از چوب راش خشک‌شده در کوره ساخته شده و اتصالات آن پیچ و "
            "مهره‌ای است، به همین دلیل در طول سال‌ها استفاده صدا نمی‌دهد.\n\n"
            "روکش پارچه‌ای ضدلک به‌سادگی با دستمال مرطوب تمیز می‌شود و پایه‌های "
            "فلزی با کفی نمدی، کف‌پوش خانه را خط نمی‌اندازند."
        ),
        "price": Decimal("18500000"),
        "warranty_months": 60,
        "material": "چوب راش و روکش پارچه‌ای",
        "is_washable": False,
        "trial_nights": 0,
        "height": 35,
        "specs": [
            ("جنس بدنه", "چوب راش خشک‌شده"),
            ("نوع روکش", "پارچه ضدلک"),
            ("باکس جک‌دار", "خیر"),
            ("ظرفیت تحمل وزن", "۳۵۰ کیلوگرم"),
            ("نوع پایه", "فلزی با کفی نمدی"),
            ("ارتفاع باکس", "۳۵ سانتی‌متر"),
        ],
        "features": [
            ("بدنه تمام‌چوب", "TreePine"),
            ("اتصالات بی‌صدا", "Wrench"),
            ("پایه فلزی مقاوم", "Anchor"),
        ],
        "pros": ["استحکام بالای بدنه", "نصب آسان و سریع", "بدون صدا در طول زمان"],
        "cons": ["فاقد فضای ذخیره‌سازی"],
        "faqs": [
            ("آیا نصب باکس نیاز به ابزار خاصی دارد؟",
             "خیر، آچار مورد نیاز همراه محصول ارسال می‌شود و نصب حدود ۲۰ دقیقه زمان می‌برد."),
            ("آیا باکس با هر تشکی سازگار است؟",
             "بله، تا زمانی که ابعاد تشک با ابعاد باکس یکسان باشد."),
        ],
        "sizes": _bed_sizes(18_500_000, 2_200_000),
    },
    {
        "slug": "salyco-box-storage",
        "category": Mattress.CATEGORY_BEDBOX,
        "name": "باکس تخت خواب جک‌دار سالیکو",
        "subtitle": "باکس جک‌دار با فضای ذخیره‌سازی وسیع زیر تخت",
        "description": (
            "باکس جک‌دار سالیکو با جک‌های گازی آلمانی، دسترسی آسان به فضای "
            "ذخیره‌سازی وسیع زیر تخت را ممکن می‌کند."
        ),
        "long_description": (
            "جک‌های گازی این باکس برای بیش از ۲۰٬۰۰۰ بار باز و بسته شدن آزمایش "
            "شده‌اند و وزن تشک را به‌آرامی مهار می‌کنند؛ درِ باکس هیچ‌گاه ناگهانی "
            "پایین نمی‌افتد.\n\n"
            "کف باکس با پارچه نبافته پوشانده شده تا وسایل داخل آن گردوغبار نگیرند."
        ),
        "price": Decimal("26900000"),
        "warranty_months": 60,
        "material": "چوب راش و جک گازی",
        "is_washable": False,
        "trial_nights": 0,
        "height": 40,
        "specs": [
            ("جنس بدنه", "چوب راش خشک‌شده"),
            ("نوع روکش", "چرم مصنوعی"),
            ("باکس جک‌دار", "بله — جک گازی آلمانی"),
            ("ظرفیت تحمل وزن", "۴۰۰ کیلوگرم"),
            ("نوع پایه", "فلزی تقویت‌شده"),
            ("عمق فضای ذخیره‌سازی", "۳۰ سانتی‌متر"),
        ],
        "features": [
            ("فضای ذخیره‌سازی وسیع", "Archive"),
            ("جک گازی آلمانی", "ArrowUpCircle"),
            ("روکش چرم مصنوعی", "Sparkles"),
        ],
        "pros": ["فضای ذخیره‌سازی زیاد", "باز و بسته شدن آرام", "تمیزکردن آسان روکش"],
        "cons": ["وزن بالاتر نسبت به باکس ساده", "قیمت بیشتر"],
        "faqs": [
            ("آیا جک‌ها قابل تعویض هستند؟",
             "بله، جک‌ها به‌صورت جداگانه قابل سفارش و تعویض هستند."),
            ("چه وسایلی را می‌توان زیر باکس نگهداری کرد؟",
             "لحاف، بالش، رختخواب و لباس‌های فصلی؛ از قرار دادن اجسام مرطوب خودداری کنید."),
        ],
        "sizes": _bed_sizes(26_900_000, 2_800_000),
    },
]


# ── بالش ─────────────────────────────────────────────────────────────────────
# Pillows deliberately carry no `sizes`: they ship in one size, so the detail
# page renders no size selector and prices from the base product.
PILLOW_PRODUCTS = [
    {
        "slug": "salyco-pillow-memory",
        "category": Mattress.CATEGORY_PILLOW,
        "name": "بالش طبی مموری فوم سالیکو",
        "subtitle": "بالش طبی با فوم حافظه‌دار و روکش قابل شستشو",
        "description": (
            "بالش طبی مموری فوم سالیکو با فرم‌گیری تدریجی، گردن و ستون فقرات را در "
            "یک راستا نگه می‌دارد و برای خوابیدن به پهلو و پشت مناسب است."
        ),
        "long_description": (
            "فوم حافظه‌دار این بالش با گرمای بدن نرم می‌شود و به شکل گردن شما در "
            "می‌آید؛ پس از برخاستن، به‌آرامی به فرم اولیه بازمی‌گردد.\n\n"
            "روکش بیرونی با زیپ مخفی جدا می‌شود و در ماشین لباسشویی با دمای ۳۰ "
            "درجه قابل شستشو است. خودِ فوم را نشویید؛ فقط در معرض هوا قرار دهید."
        ),
        "price": Decimal("2450000"),
        "warranty_months": 18,
        "firmness": 6,
        "material": "مموری فوم",
        "is_washable": True,
        "trial_nights": 30,
        "width": 70,
        "length": 40,
        "height": 12,
        "specs": [
            ("ارتفاع بالش", "۱۲ سانتی‌متر"),
            ("جنس الیاف", "فوم حافظه‌دار با دانسیته بالا"),
            ("جنس روکش", "پارچه بامبو با زیپ مخفی"),
            ("قابل شستشو", "روکش — ماشین لباسشویی ۳۰ درجه"),
            ("مناسب برای", "خواب به پهلو و پشت"),
            ("ابعاد", "۷۰ × ۴۰ سانتی‌متر"),
        ],
        "features": [
            ("فرم‌گیری طبی", "Activity"),
            ("روکش قابل شستشو", "Droplets"),
            ("ضدحساسیت", "ShieldCheck"),
        ],
        "pros": ["نگه‌داشتن گردن در راستای ستون فقرات", "روکش قابل شستشو", "بدون تغییر فرم در طول زمان"],
        "cons": ["برای خواب به شکم ارتفاع زیادی دارد", "بوی جزئی فوم در روزهای اول"],
        "faqs": [
            ("بوی اولیه بالش طبیعی است؟",
             "بله. بالش را ۴۸ ساعت در محیطی با تهویه مناسب قرار دهید تا بو کاملاً برطرف شود."),
            ("این بالش برای خواب به شکم مناسب است؟",
             "برای خواب به شکم بالش کم‌ارتفاع‌تر مانند بالش پر و الیاف سالیکو را پیشنهاد می‌کنیم."),
        ],
    },
    {
        "slug": "salyco-pillow-fiber",
        "category": Mattress.CATEGORY_PILLOW,
        "name": "بالش الیاف میکروفایبر سالیکو",
        "subtitle": "بالش نرم و سبک با الیاف میکروفایبر، تمام‌شستشو",
        "description": (
            "بالش میکروفایبر سالیکو سبک و نرم است و تمام آن — روکش و الیاف — در "
            "ماشین لباسشویی قابل شستشو است؛ گزینه‌ای مناسب برای خواب به شکم."
        ),
        "long_description": (
            "الیاف میکروفایبر سیلیکونی این بالش پس از هر شستشو با چند تکان به حجم "
            "اولیه بازمی‌گردند، بنابراین بالش بعد از مدتی وارفته و تخت نمی‌شود.\n\n"
            "وزن سبک آن جابه‌جایی و مرتب‌کردن تخت را ساده می‌کند."
        ),
        "price": Decimal("890000"),
        "warranty_months": 12,
        "firmness": 3,
        "material": "الیاف میکروفایبر سیلیکونی",
        "is_washable": True,
        "trial_nights": 0,
        "width": 70,
        "length": 50,
        "height": 9,
        "specs": [
            ("ارتفاع بالش", "۹ سانتی‌متر"),
            ("جنس الیاف", "میکروفایبر سیلیکونی"),
            ("وزن الیاف", "۷۰۰ گرم"),
            ("جنس روکش", "نخ پنبه‌ای"),
            ("قابل شستشو", "کامل — ماشین لباسشویی ۴۰ درجه"),
            ("مناسب برای", "خواب به شکم و پهلو"),
        ],
        "features": [
            ("تمام‌شستشو", "Droplets"),
            ("سبک و نرم", "Feather"),
            ("بازگشت به حجم اولیه", "RefreshCw"),
        ],
        "pros": ["قابلیت شستشوی کامل", "قیمت اقتصادی", "وزن سبک"],
        "cons": ["پشتیبانی طبی کمتر از مدل مموری فوم"],
        "faqs": [
            ("هر چند وقت یک‌بار بالش را بشوییم؟",
             "هر دو تا سه ماه یک‌بار کافی است. پس از شستشو کاملاً خشک کنید."),
        ],
    },
    {
        "slug": "salyco-pillow-latex",
        "category": Mattress.CATEGORY_PILLOW,
        "name": "بالش لاتکس طبیعی سالیکو",
        "subtitle": "بالش لاتکس با تهویه بالا و خنکی در تمام شب",
        "description": (
            "بالش لاتکس طبیعی سالیکو با ساختار مشبک، جریان هوا را برقرار نگه می‌دارد "
            "و در شب‌های گرم خنک می‌ماند."
        ),
        "long_description": (
            "لاتکس طبیعی این بالش از شیره درخت لاستیک تهیه شده و ساختار مشبک آن، "
            "گرمای بدن را به‌جای نگه‌داشتن، از بالش خارج می‌کند.\n\n"
            "لاتکس به‌طور طبیعی ضدباکتری و ضدکنه است، بنابراین برای افراد با "
            "حساسیت‌های فصلی گزینه مناسبی است."
        ),
        "price": Decimal("3200000"),
        "warranty_months": 24,
        "firmness": 7,
        "material": "لاتکس طبیعی",
        "is_washable": True,
        "trial_nights": 30,
        "width": 70,
        "length": 40,
        "height": 13,
        "specs": [
            ("ارتفاع بالش", "۱۳ سانتی‌متر"),
            ("جنس الیاف", "لاتکس طبیعی مشبک"),
            ("جنس روکش", "پارچه تنسل با زیپ"),
            ("قابل شستشو", "روکش — ماشین لباسشویی ۳۰ درجه"),
            ("مناسب برای", "خواب به پهلو و پشت"),
            ("استانداردها", "OEKO-TEX Standard 100"),
        ],
        "features": [
            ("تهویه بالا", "Wind"),
            ("ضدباکتری طبیعی", "ShieldCheck"),
            ("خنک در تمام شب", "Snowflake"),
        ],
        "pros": ["خنکی و تهویه عالی", "ضدحساسیت طبیعی", "عمر طولانی"],
        "cons": ["وزن بیشتر از بالش الیاف", "قیمت بالاتر"],
        "faqs": [
            ("لاتکس طبیعی با فوم مصنوعی چه تفاوتی دارد؟",
             "لاتکس طبیعی خنک‌تر است، سریع‌تر به فرم اولیه بازمی‌گردد و عمر بیشتری دارد."),
            ("آیا این بالش برای افراد حساس مناسب است؟",
             "بله، لاتکس طبیعی به‌طور ذاتی ضدکنه و ضدباکتری است."),
        ],
    },
]


# ── روتختی ───────────────────────────────────────────────────────────────────
DUVET_PRODUCTS = [
    {
        "slug": "salyco-duvet-cotton",
        "category": Mattress.CATEGORY_DUVET,
        "name": "روتختی نخی سالیکو",
        "subtitle": "روتختی ۱۰۰٪ پنبه با بافت نرم و تنفس‌پذیر",
        "description": (
            "روتختی نخی سالیکو از پنبه خالص با تراکم بافت ۲۰۰ بافته شده؛ نرم، "
            "تنفس‌پذیر و مناسب چهار فصل."
        ),
        "long_description": (
            "پنبه خالص با تراکم بافت ۲۰۰، رطوبت را جذب می‌کند و اجازه می‌دهد پوست در "
            "طول شب نفس بکشد — به همین دلیل در تابستان دم نمی‌کند.\n\n"
            "رنگ‌بندی با رنگ‌های گیاهی و بدون فلزات سنگین اجرا شده و پس از "
            "شستشوهای مکرر رنگ‌پس نمی‌دهد."
        ),
        "price": Decimal("3900000"),
        "warranty_months": 12,
        "material": "۱۰۰٪ پنبه",
        "is_washable": True,
        "trial_nights": 0,
        "specs": [
            ("جنس پارچه", "۱۰۰٪ پنبه"),
            ("تراکم بافت", "۲۰۰ نخ در اینچ مربع"),
            ("درجه گرمی (TOG)", "۴.۵ — چهار فصل"),
            ("تعداد اجزای ست", "۴ تکه — روتختی، ملحفه و دو روبالشی"),
            ("قابل شستشو", "ماشین لباسشویی ۴۰ درجه"),
            ("استانداردها", "OEKO-TEX Standard 100"),
        ],
        "features": [
            ("پنبه خالص", "Leaf"),
            ("تنفس‌پذیر", "Wind"),
            ("رنگ‌ثابت", "Palette"),
        ],
        "pros": ["تنفس‌پذیری بالا", "مناسب چهار فصل", "رنگ‌ثابت پس از شستشو"],
        "cons": ["نیاز به اتوکشی پس از شستشو"],
        "faqs": [
            ("این ست شامل چه اجزایی است؟",
             "روتختی، یک ملحفه کشدار و دو عدد روبالشی."),
            ("آیا پس از شستشو آب می‌رود؟",
             "پارچه پیش‌شرینک شده است؛ با شستشو در دمای ۴۰ درجه تغییر ابعاد محسوسی ندارد."),
        ],
        "sizes": _duvet_sizes(3_900_000, 700_000),
    },
    {
        "slug": "salyco-duvet-microfiber",
        "category": Mattress.CATEGORY_DUVET,
        "name": "روتختی میکروفایبر سالیکو",
        "subtitle": "روتختی میکروفایبر ضدچرک با نگه‌داری آسان",
        "description": (
            "روتختی میکروفایبر سالیکو سبک و ضدچرک است، سریع خشک می‌شود و به "
            "اتوکشی نیاز ندارد."
        ),
        "long_description": (
            "الیاف میکروفایبر با قطر کمتر از یک دنیر بافته شده‌اند؛ نتیجه، پارچه‌ای "
            "است که لک را روی سطح نگه می‌دارد و با یک شستشوی ساده پاک می‌شود.\n\n"
            "این روتختی پس از شستشو چین نمی‌افتد، بنابراین نیازی به اتو ندارد."
        ),
        "price": Decimal("2600000"),
        "warranty_months": 12,
        "material": "میکروفایبر",
        "is_washable": True,
        "trial_nights": 0,
        "specs": [
            ("جنس پارچه", "میکروفایبر پلی‌استر"),
            ("تراکم بافت", "۱۸۰ نخ در اینچ مربع"),
            ("درجه گرمی (TOG)", "۳.۰ — بهار و تابستان"),
            ("تعداد اجزای ست", "۴ تکه"),
            ("قابل شستشو", "ماشین لباسشویی ۴۰ درجه"),
            ("ویژگی", "ضدچرک و بدون نیاز به اتو"),
        ],
        "features": [
            ("ضدچرک", "ShieldCheck"),
            ("خشک‌شدن سریع", "Wind"),
            ("بدون نیاز به اتو", "Sparkles"),
        ],
        "pros": ["نگه‌داری بسیار آسان", "قیمت اقتصادی", "خشک‌شدن سریع"],
        "cons": ["تنفس‌پذیری کمتر از پنبه"],
        "faqs": [
            ("برای تابستان مناسب است؟",
             "بله، اما اگر گرمایی می‌خوابید روتختی نخی سالیکو تنفس‌پذیرتر است."),
        ],
        "sizes": _duvet_sizes(2_600_000, 550_000),
    },
]


# ── محافظ تشک و تاپر ─────────────────────────────────────────────────────────
TOPPER_PRODUCTS = [
    {
        "slug": "salyco-topper-memory",
        "category": Mattress.CATEGORY_TOPPER,
        "name": "تاپر مموری فوم سالیکو",
        "subtitle": "تاپر ۵ سانتی‌متری مموری فوم با کش‌های نگه‌دارنده",
        "description": (
            "تاپر مموری فوم سالیکو یک لایه راحتی ۵ سانتی‌متری به تشک شما اضافه "
            "می‌کند و نقاط فشار را کاهش می‌دهد."
        ),
        "long_description": (
            "این تاپر برای تشک‌هایی مناسب است که کمی سخت‌تر از سلیقه شما هستند؛ "
            "لایه مموری فوم فشار را روی شانه و لگن پخش می‌کند.\n\n"
            "چهار کشِ گوشه، تاپر را روی تشک ثابت نگه می‌دارد تا در طول شب جابه‌جا نشود."
        ),
        "price": Decimal("6800000"),
        "warranty_months": 24,
        "firmness": 4,
        "material": "مموری فوم",
        "is_washable": True,
        "trial_nights": 30,
        "height": 5,
        "specs": [
            ("ضخامت تاپر", "۵ سانتی‌متر"),
            ("جنس لایه راحتی", "مموری فوم"),
            ("دانسیته فوم", "۵۰ کیلوگرم بر مترمکعب"),
            ("نوع اتصال", "کش دور تشک — چهار گوشه"),
            ("جنس روکش", "پارچه تنسل با زیپ"),
            ("قابل شستشو", "روکش — ماشین لباسشویی ۳۰ درجه"),
        ],
        "features": [
            ("کاهش نقاط فشار", "Activity"),
            ("کش نگه‌دارنده", "Anchor"),
            ("روکش قابل شستشو", "Droplets"),
        ],
        "pros": ["نرم‌کردن تشک سخت", "کاهش فشار روی شانه و لگن", "روکش قابل شستشو"],
        "cons": ["گرمای بیشتر نسبت به تاپر لاتکس"],
        "faqs": [
            ("تاپر جایگزین تشک می‌شود؟",
             "خیر. تاپر یک لایه راحتی روی تشک است و پشتیبانی تشک را تغییر نمی‌دهد."),
            ("روی تشک فنری هم قابل استفاده است؟",
             "بله، روی هر تشک سالم با سطح صاف قابل استفاده است."),
        ],
        "sizes": _bed_sizes(6_800_000, 900_000),
    },
    {
        "slug": "salyco-protector-waterproof",
        "category": Mattress.CATEGORY_TOPPER,
        "name": "محافظ تشک ضدآب سالیکو",
        "subtitle": "محافظ ضدآب و تنفس‌پذیر با لایه پلی‌اورتان",
        "description": (
            "محافظ تشک ضدآب سالیکو با لایه پلی‌اورتان تنفس‌پذیر، از تشک در برابر "
            "مایعات و لک محافظت می‌کند بدون آنکه صدای خش‌خش بدهد."
        ),
        "long_description": (
            "لایه پلی‌اورتان پشت پارچه، مایعات را متوقف می‌کند اما بخار آب و هوا را "
            "از خود عبور می‌دهد؛ برخلاف محافظ‌های نایلونی، تشک زیر آن دم نمی‌کند و "
            "هنگام جابه‌جایی صدا نمی‌دهد.\n\n"
            "فرم کشدار آن تا ارتفاع ۳۰ سانتی‌متر تشک را در بر می‌گیرد."
        ),
        "price": Decimal("1950000"),
        "warranty_months": 24,
        "material": "پنبه با لایه پلی‌اورتان",
        "is_washable": True,
        "trial_nights": 0,
        "height": 1,
        "specs": [
            ("ضخامت", "۱ سانتی‌متر"),
            ("جنس رویه", "پارچه پنبه‌ای"),
            ("لایه ضدآب", "پلی‌اورتان تنفس‌پذیر"),
            ("نوع اتصال", "کشدار تا ارتفاع ۳۰ سانتی‌متر"),
            ("قابل شستشو", "کامل — ماشین لباسشویی ۶۰ درجه"),
            ("استانداردها", "OEKO-TEX Standard 100"),
        ],
        "features": [
            ("ضدآب کامل", "Droplets"),
            ("تنفس‌پذیر و بی‌صدا", "Wind"),
            ("ضدکنه و ضدحساسیت", "ShieldCheck"),
        ],
        "pros": ["محافظت کامل از تشک", "بدون صدای خش‌خش", "شستشوی کامل در ۶۰ درجه"],
        "cons": ["لایه راحتی اضافه نمی‌کند"],
        "faqs": [
            ("آیا حس پلاستیکی دارد؟",
             "خیر. رویه پارچه‌ای پنبه‌ای است و لایه ضدآب در پشت آن قرار دارد."),
            ("برای تخت کودک مناسب است؟",
             "بله، این محافظ یکی از پرکاربردترین گزینه‌ها برای تخت کودک است."),
        ],
        "sizes": _bed_sizes(1_950_000, 260_000),
    },
]

ALL_PRODUCTS = BEDBOX_PRODUCTS + PILLOW_PRODUCTS + DUVET_PRODUCTS + TOPPER_PRODUCTS

# Fields copied straight onto the Mattress row. Anything absent from a product
# dict falls back to the model default (e.g. firmness stays null for duvets and
# bedboxes, where a softness scale would be meaningless).
SCALAR_DEFAULTS = {
    "brand": "سالیکو",
    "firmness": None,
    "material": "",
    "is_washable": False,
    "trial_nights": 0,
    "width": 0,
    "length": 0,
    "height": 0,
}


class Command(BaseCommand):
    help = "Seed demo bedbox, pillow, duvet, and topper products."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete the seeded products first, then recreate them.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        slugs = [product["slug"] for product in ALL_PRODUCTS]

        if options["reset"]:
            # PROTECT on CartItem/OrderItem/MattressInstance means this refuses to
            # run once a seeded product has been ordered — which is the correct
            # outcome, not a bug to work around.
            deleted, _ = Mattress.objects.filter(slug__in=slugs).delete()
            self.stdout.write(self.style.WARNING(f"Deleted {deleted} row(s)."))

        created_count = 0
        skipped_count = 0

        for product in ALL_PRODUCTS:
            sizes = product.get("sizes", [])
            specs = product.get("specs", [])
            features = product.get("features", [])
            pros = product.get("pros", [])
            cons = product.get("cons", [])
            faqs = product.get("faqs", [])

            fields = {
                key: product.get(key, default)
                for key, default in SCALAR_DEFAULTS.items()
            }
            fields.update(
                category=product["category"],
                name=product["name"],
                subtitle=product["subtitle"],
                description=product["description"],
                long_description=product.get("long_description", ""),
                price=product["price"],
                warranty_months=product["warranty_months"],
                is_available=True,
            )

            mattress, created = Mattress.objects.get_or_create(
                slug=product["slug"], defaults=fields
            )
            if not created:
                # Leave hand-tuned products alone — this command tops up what is
                # missing, it does not overwrite your edits.
                skipped_count += 1
                continue

            created_count += 1

            MattressSize.objects.bulk_create(
                MattressSize(
                    mattress=mattress,
                    label=size["label"],
                    width=size["width"],
                    length=size["length"],
                    price=size["price"],
                    in_stock=True,
                )
                for size in sizes
            )
            MattressSpecification.objects.bulk_create(
                MattressSpecification(
                    mattress=mattress, key=key, value=value, display_order=order
                )
                for order, (key, value) in enumerate(specs)
            )
            MattressFeature.objects.bulk_create(
                MattressFeature(
                    mattress=mattress, title=title, icon_name=icon, display_order=order
                )
                for order, (title, icon) in enumerate(features)
            )
            MattressProCon.objects.bulk_create(
                [
                    MattressProCon(
                        mattress=mattress,
                        text=text,
                        type=MattressProCon.PRO,
                        display_order=order,
                    )
                    for order, text in enumerate(pros)
                ]
                + [
                    MattressProCon(
                        mattress=mattress,
                        text=text,
                        type=MattressProCon.CON,
                        display_order=order,
                    )
                    for order, text in enumerate(cons)
                ]
            )
            MattressFAQ.objects.bulk_create(
                MattressFAQ(
                    mattress=mattress,
                    question=question,
                    answer=answer,
                    display_order=order,
                )
                for order, (question, answer) in enumerate(faqs)
            )

            self.stdout.write(
                f"  + [{mattress.get_category_display()}] {mattress.name} "
                f"({len(sizes)} size(s), {len(specs)} spec(s))"
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone. Created {created_count}, left {skipped_count} existing row(s) untouched."
            )
        )
        if skipped_count:
            self.stdout.write(
                "Re-run with --reset to rebuild the skipped products from scratch."
            )


