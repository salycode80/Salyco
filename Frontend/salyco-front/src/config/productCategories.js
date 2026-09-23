import { BedDouble, Bed, Feather, Layers, Shield } from "lucide-react";

/**
 * Single source of truth for all product categories.
 *
 * Keys MUST match the backend Mattress.CATEGORY_CHOICES.  `sizeMode` is the
 * one behavioural difference the detail page needs to handle:
 *
 *   standard — 6 bed-size cards with `/bedicon_{w}_{l}.png` icons
 *   listed   — map `mattress.sizes` rows as simple label chips
 *   none     — no size selector; price comes from the base product
 *
 * `warrantyRegistrable` mirrors the backend's `is_warranty_registrable`
 * property (Mattress models / serializers): categories where it is true
 * support per-unit serial-numbered warranty registration + QR codes.
 */

export const PRODUCT_CATEGORIES = [
  {
    key: "mattress",
    label: "تشک",
    labelPlural: "تشک‌ها",
    en: "Mattresses",
    icon: BedDouble,
    sizeMode: "standard",
    warrantyRegistrable: true,
    heading: "تشک‌های سالیکو",
    // The category holds the three micro-bonell models plus a guest mattress, so
    // this must not name a single filling. Design.md §10 forbids attributing
    // memory foam to the Hermes/Imperial/Prestige line.
    blurb:
      "مجموعه تشک‌های سالیکو؛ از مدل‌های لوکس فنری تا تشک مهمان، با گارانتی معتبر",
  },
  {
    key: "bedbox",
    label: "باکس تخت خواب",
    labelPlural: "باکس‌های تخت خواب",
    en: "Bed Boxes",
    icon: Bed,
    sizeMode: "standard",
    warrantyRegistrable: true,
    heading: "باکس‌های تخت خواب سالیکو",
    blurb: "باکس‌های چوبی با روکش پارچه‌ای و جک‌دار با فضای ذخیره‌سازی",
  },
  {
    key: "pillow",
    label: "بالش",
    labelPlural: "بالش‌ها",
    en: "Pillows",
    icon: Feather,
    sizeMode: "none",
    warrantyRegistrable: false,
    heading: "بالش‌های سالیکو",
    blurb:
      "بالش‌های طبی مموری فوم، لاتکس طبیعی و الیاف میکروفایبر برای خوابی راحت",
  },
  {
    key: "duvet",
    label: "روتختی",
    labelPlural: "روتختی‌ها",
    en: "Duvets",
    icon: Layers,
    sizeMode: "listed",
    warrantyRegistrable: false,
    heading: "روتختی‌های سالیکو",
    blurb: "روتختی‌های پنبه‌ای و میکروفایبر با طراحی زیبا و کیفیت بالا",
  },
  {
    key: "topper",
    label: "محافظ تشک و تاپر",
    labelPlural: "محافظ‌های تشک و تاپر",
    en: "Toppers & Protectors",
    icon: Shield,
    sizeMode: "standard",
    warrantyRegistrable: true,
    heading: "تاپر و محافظ تشک سالیکو",
    blurb:
      "تاپر مموری فوم برای نرم‌تر کردن تشک و محافظ ضدآب برای افزایش عمر تشک",
  },
];

const CATEGORY_BY_KEY = Object.fromEntries(
  PRODUCT_CATEGORIES.map((c) => [c.key, c]),
);

export { CATEGORY_BY_KEY };

/** True when `key` matches one of the five product categories. */
export const isValidCategory = (key) => key in CATEGORY_BY_KEY;

/**
 * Build a product's detail-page URL from its category and slug.
 * Falls back to "mattress" so a stale cached API response without `category`
 * still links somewhere valid.
 */
export const productUrl = (p) =>
  `/products/${p.category ?? "mattress"}/${p.slug}`;
