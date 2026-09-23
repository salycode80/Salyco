import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  ShieldCheck,
  Star,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Package,
  MessageSquarePlus,
  CheckCircle2,
  Loader2,
  LogIn,
  ShoppingCart,
  Tag,
  Droplets,
  Moon,
  Layers,
} from "lucide-react";
import { getMattressDetail, submitReview } from "../api/warranty";
import { getProductImageUrl } from "../utils/productImage";
import {
  toPersianNumber,
  formatPersianPrice,
  toPersianDigitsInText,
} from "../utils/persian";
import { CATEGORY_BY_KEY, isValidCategory } from "../config/productCategories";
import { ACCESS_TOKEN } from "../constants";
import { useCart } from "../context/CartContext";
import PageBackground from "../components/PageBackground";
import ProductGallery from "../components/product/ProductGallery";

// Salyco design tokens
const CARD =
  "rounded-xl border border-brand-mist bg-white p-6 shadow-[0_1px_4px_rgba(5,46,95,0.06)]";

// The six canonical bed sizes, used by categories with sizeMode "standard"
// (mattress, bedbox, topper). Names/dimensions are static; the price for each
// comes from the matching MattressSize on the model (matched by w×l).
const STANDARD_SIZES = [
  { width: 90, length: 200, name: " یک‌نفره استاندارد", note: "استاندارد" },
  { width: 120, length: 200, name: " یک‌نفره بزرگ" },
  { width: 140, length: 200, name: " دو نفره کوچک" },
  { width: 160, length: 200, name: " دو نفره کوئین", note: "استاندارد" },
  { width: 180, length: 200, name: " دو نفره کینگ" },
  { width: 200, length: 200, name: " دو نفره سوپر کینگ" },
];

function StarRating({ rating, size = 16 }) {
  return (
    <div className="flex gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={
            i <= Math.round(rating)
              ? "fill-brand-navy text-brand-navy"
              : "text-brand-mist"
          }
        />
      ))}
    </div>
  );
}

/**
 * Firmness scale — a 10-segment bar, the convention sleep brands use to make a
 * subjective property comparable across a range. Only rendered when the product
 * has a firmness authored (mattresses, pillows, toppers; not duvets/bedboxes).
 */
function FirmnessScale({ value }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="font-persian text-sm font-medium text-text-primary">
          سطح سفتی
        </span>
        <span className="font-persian text-xs text-text-secondary [font-feature-settings:'tnum']">
          {toPersianNumber(value)} از ۱۰
        </span>
      </div>
      <div className="flex gap-1" dir="ltr">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full transition-colors ${
              i < value ? "bg-brand-navy" : "bg-brand-mist"
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between font-persian text-[11px] text-text-secondary">
        <span>نرم</span>
        <span>سخت</span>
      </div>
    </div>
  );
}

function FAQItem({ faq }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-brand-mist last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-4 text-right"
      >
        <span className="font-medium text-text-primary">{faq.question}</span>
        {open ? (
          <ChevronUp size={18} className="shrink-0 text-text-secondary" />
        ) : (
          <ChevronDown size={18} className="shrink-0 text-text-secondary" />
        )}
      </button>
      {open && (
        <p className="pb-4 text-sm leading-7 text-text-secondary">{faq.answer}</p>
      )}
    </div>
  );
}

// Interactive star picker for the review form.
function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110"
          aria-label={`${i} ستاره`}
        >
          <Star
            size={28}
            className={
              i <= (hover || value)
                ? "fill-brand-navy text-brand-navy"
                : "text-brand-mist"
            }
          />
        </button>
      ))}
    </div>
  );
}

// Review submission form shown at the bottom of the detail page. Requires the
// visitor to be logged in; on success the review is queued for admin approval.
function ReviewForm({ slug, onSubmitted }) {
  const isAuthenticated = !!localStorage.getItem(ACCESS_TOKEN);
  const [form, setForm] = useState({
    rating: 0,
    title: "",
    body: "",
    pros: "",
    cons: "",
  });
  const [status, setStatus] = useState("idle"); // idle | sending | success | error
  const [error, setError] = useState("");

  const inputBase =
    "w-full rounded-lg border border-brand-mist bg-white px-4 py-3 font-persian text-sm text-text-primary placeholder-text-secondary transition focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20";

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.rating < 1) {
      setError("لطفاً امتیاز خود را انتخاب کنید.");
      return;
    }
    setStatus("sending");
    try {
      await submitReview(slug, form);
      setStatus("success");
      setForm({ rating: 0, title: "", body: "", pros: "", cons: "" });
      onSubmitted?.();
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className={CARD}>
        <h2 className="mb-2 font-persian text-xl font-semibold text-brand-navy">
          ثبت نظر
        </h2>
        <p className="mb-4 font-persian text-sm text-text-secondary">
          برای ثبت نظر ابتدا وارد حساب کاربری خود شوید.
        </p>
        <Link
          to="/auth"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-6 py-3 font-persian text-sm font-bold text-white transition hover:bg-action-hover"
        >
          <LogIn size={16} />
          ورود / ثبت‌نام
        </Link>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className={CARD}>
        <div className="flex flex-col items-center justify-center rounded-xl bg-status-success-bg p-8 text-center ring-1 ring-status-success/30">
          <CheckCircle2 className="h-14 w-14 text-status-success" />
          <h3 className="mt-4 font-persian text-lg font-bold text-text-primary">
            نظر شما ثبت شد
          </h3>
          <p className="mt-2 font-persian text-sm text-text-secondary">
            نظر شما پس از تأیید توسط کارشناسان ما نمایش داده خواهد شد.
            سپاسگزاریم.
          </p>
          <button
            onClick={() => setStatus("idle")}
            className="mt-6 rounded-lg border-2 border-brand-navy px-6 py-2 font-persian text-sm font-medium text-brand-navy transition hover:bg-brand-navy hover:text-white"
          >
            ثبت نظر جدید
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={CARD}>
      <h2 className="mb-1 flex items-center gap-2 font-persian text-xl font-semibold text-brand-navy">
        <MessageSquarePlus size={20} />
        ثبت نظر
      </h2>
      <p className="mb-6 font-persian text-sm text-text-secondary">
        تجربه خود از این محصول را با دیگران به اشتراک بگذارید.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* rating */}
        <div>
          <label className="mb-1.5 block font-persian text-sm font-medium text-text-primary">
            امتیاز شما
          </label>
          <StarPicker
            value={form.rating}
            onChange={(r) => setForm((f) => ({ ...f, rating: r }))}
          />
        </div>

        {/* title */}
        <div>
          <label className="mb-1.5 block font-persian text-sm font-medium text-text-primary">
            عنوان نظر
          </label>
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            required
            maxLength={200}
            placeholder="مثلاً: کیفیت عالی و خواب راحت"
            className={inputBase}
          />
        </div>

        {/* body */}
        <div>
          <label className="mb-1.5 block font-persian text-sm font-medium text-text-primary">
            متن نظر
          </label>
          <textarea
            name="body"
            value={form.body}
            onChange={handleChange}
            required
            rows={4}
            placeholder="نظر خود را درباره این محصول بنویسید..."
            className={`${inputBase} resize-none`}
          />
        </div>

        {/* pros + cons */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block font-persian text-sm font-medium text-status-success">
              نقاط مثبت (اختیاری)
            </label>
            <input
              name="pros"
              value={form.pros}
              onChange={handleChange}
              placeholder="مثلاً: راحتی بالا"
              className={inputBase}
            />
          </div>
          <div>
            <label className="mb-1.5 block font-persian text-sm font-medium text-status-error">
              نقاط منفی (اختیاری)
            </label>
            <input
              name="cons"
              value={form.cons}
              onChange={handleChange}
              placeholder="مثلاً: قیمت بالا"
              className={inputBase}
            />
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-status-error-bg px-4 py-2.5 font-persian text-sm text-status-error">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={status === "sending"}
          className="mt-2 inline-flex w-fit items-center justify-center gap-2 rounded-lg bg-brand-navy px-6 py-3 font-persian text-sm font-bold text-white shadow-[0_1px_4px_rgba(5,46,95,0.06)] transition hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "sending" ? (
            <>
              <Loader2 size={17} className="animate-spin" />
              در حال ارسال...
            </>
          ) : (
            <>
              <MessageSquarePlus size={17} />
              ثبت نظر
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default function ProductDetail() {
  const { category, slug } = useParams();
  const validCategory = isValidCategory(category);
  const meta = CATEGORY_BY_KEY[category] ?? CATEGORY_BY_KEY.mattress;

  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!validCategory) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    // Reset the size between products; otherwise navigating from a sized
    // product to another would carry the previous selection into the new page.
    setSelectedSize(null);
    getMattressDetail(slug)
      .then((data) => {
        setProduct(data);
        if (data.sizes?.length > 0) setSelectedSize(data.sizes[0]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug, validCategory]);

  // Gallery images, primary first (the gallery shows index 0 on load), then the
  // remaining images in API order. Products with no gallery fall back to the
  // single `image` field.
  const galleryImages = useMemo(() => {
    if (!product) return [];
    const extra = product.images ?? [];
    if (extra.length === 0) {
      return [
        {
          key: "base",
          src: getProductImageUrl(product.image),
          alt: product.name,
        },
      ];
    }
    const ordered = [
      ...extra.filter((img) => img.is_primary),
      ...extra.filter((img) => !img.is_primary),
    ];
    return ordered.map((img) => ({
      key: img.id,
      src: getProductImageUrl(img.image),
      alt: img.alt_text || product.name,
    }));
  }, [product]);

  if (!validCategory) {
    return (
      <section className="min-h-screen bg-brand-warm-white pt-[var(--navbar-height)]">
        <div
          className="mx-auto max-w-[1200px] px-4 py-10 text-center sm:px-6 sm:py-16"
          dir="rtl"
        >
          <p className="font-persian text-status-error">محصول یافت نشد.</p>
          <Link
            to="/products"
            className="mt-4 inline-flex items-center gap-2 font-persian text-sm font-medium text-brand-navy hover:text-brand-navy"
          >
            <ArrowRight size={16} />
            مشاهده همه محصولات
          </Link>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="min-h-screen bg-brand-warm-white pt-[var(--navbar-height)]">
        <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-16">
          <p className="font-persian text-center text-text-secondary">
            در حال بارگذاری...
          </p>
        </div>
      </section>
    );
  }

  if (error || !product) {
    return (
      <section className="min-h-screen bg-brand-warm-white pt-[var(--navbar-height)]">
        <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-16">
          <p className="font-persian text-center text-status-error">
            {error || "محصول یافت نشد."}
          </p>
        </div>
      </section>
    );
  }

  // Warranty is authored in months. Rounding straight to years reads as
  // "۰ سال گارانتی" for the 12-month guarantee a pillow ships with, so only
  // show years when they divide cleanly.
  const warrantyMonths = Number(product.warranty_months ?? 0);
  const warrantyText =
    warrantyMonths >= 12 && warrantyMonths % 12 === 0
      ? `${toPersianNumber(warrantyMonths / 12)} سال گارانتی`
      : `${toPersianNumber(warrantyMonths)} ماه گارانتی`;

  // Price and discount must come from the same source. Each size is priced
  // independently and carries its own discount_price, so pairing a size's
  // price with the base product's discount would quote a bogus saving.
  const priceSource = selectedSize || product;
  const displayPrice = priceSource.price;
  const discountPrice = priceSource.discount_price ?? null;
  const isOnSale =
    product.is_on_off && product.off_percentage > 0 && discountPrice != null;
  // Once a product has per-size pricing, a bare number is ambiguous — say which
  // price the figure was derived from so the customer can check the arithmetic.
  const priceBasis = selectedSize
    ? `قیمت سایز ${selectedSize.label}`
    : meta.sizeMode === "none"
      ? "قیمت محصول"
      : "قیمت پایه محصول";

  // Can the visitor buy? Either the chosen size is in stock, or (no sizes) the
  // product itself is available.
  const hasSizes = product.sizes?.length > 0;
  const canBuy = hasSizes
    ? !!selectedSize && selectedSize.in_stock
    : product.is_available;

  const handleAddToCart = async () => {
    if (!canBuy) return;
    try {
      await addItem(product, hasSizes ? selectedSize : null, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 1800);
    } catch {
      /* cart errors are non-fatal here */
    }
  };

  // Merge the six canonical bed sizes with the model's priced sizes (matched by
  // w×l). Only meaningful for categories sized to the bed; a canonical size with
  // no matching row is shown as unavailable.
  const sizeCards = STANDARD_SIZES.map((std) => {
    const match = product.sizes?.find(
      (s) => s.width === std.width && s.length === std.length,
    );
    return {
      ...std,
      image: `/bedicon_${std.width}_${std.length}.png`,
      modelSize: match || null,
      price: match ? match.price : null,
      discountPrice: match ? (match.discount_price ?? null) : null,
      available: !!match && match.in_stock,
    };
  });

  const pros = product.pros_cons?.filter((p) => p.type === "PRO") || [];
  const cons = product.pros_cons?.filter((p) => p.type === "CON") || [];

  // `rating` is the score the server wants rendered: the approved-review
  // average, or 5 for a product nobody has reviewed yet. The 5 fallback is
  // repeated here so an older API response missing the field still renders
  // stars instead of NaN. `reviewCount` is what tells the two cases apart, so
  // the caption can say "بدون نظر" rather than implying a perfect score.
  const displayRating = Number(product.rating ?? 5);
  const reviewCount = Number(product.review_count ?? 0);

  return (
    <section className="relative min-h-screen overflow-hidden bg-brand-warm-white pt-[var(--navbar-height)]">
      <PageBackground />

      <div className="relative mx-auto max-w-[1120px] px-6 py-8 sm:py-10">
        <Link
          to={`/products/${category}`}
          className="mb-8 inline-flex items-center gap-2 font-persian text-sm font-medium text-brand-navy transition-colors hover:text-brand-navy"
          dir="rtl"
        >
          <ArrowRight size={16} />
          بازگشت به {meta.labelPlural}
        </Link>

        {/* Hero: Image + Info */}
        <div className="grid gap-10 lg:grid-cols-2" dir="rtl">
          {/* Image gallery */}
          <ProductGallery
            key={slug}
            images={galleryImages}
            name={product.name}
          />

          {/* Product info */}
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4">
              <div className="flex justify-between">
                {/* Rating — always shown; an unreviewed product scores 5 by
                    default, with the count clarifying where the score is from. */}
                <div className="order-2 flex items-center gap-2">
                  <StarRating rating={displayRating} />
                  <span className="whitespace-nowrap font-persian text-xs text-text-secondary">
                    {reviewCount > 0
                      ? `${toPersianNumber(reviewCount)} نظر`
                      : "بدون نظر"}
                  </span>
                </div>
                <div className="min-w-0">
                  {/* Category kicker: with five product lines sharing one layout,
                      the name alone no longer says what you are looking at. */}
                  <p className="mb-1 font-persian text-xs font-medium text-text-secondary">
                    {product.category_label ?? meta.label}
                  </p>
                  <h1 className="font-persian text-3xl font-bold text-brand-navy md:text-4xl">
                    {product.name}
                  </h1>
                </div>
              </div>
              <div
                className="group flex w-fit items-center gap-2 rounded-xl border border-brand-navy/15 bg-brand-warm-white px-4 py-2 transition-all duration-200 ease-out "
                style={{
                  boxShadow: "0 1px 4px rgba(5,46,95,0.06)", // Elevation Level 1
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 4px 16px rgba(5,46,95,0.1)"; // Elevation Level 2 on hover
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 1px 4px rgba(5,46,95,0.06)";
                }}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-xl bg-brand-navy/10 transition-colors duration-200 group-hover:bg-brand-navy/15">
                  <ShieldCheck
                    size={16}
                    className="text-brand-navy"
                    strokeWidth={2.5}
                  />
                </div>
                <span className="text-[14px] font-persian font-semibold text-brand-navy">
                  {warrantyText}
                </span>
              </div>
            </div>
            {product.subtitle && (
              <p className="text-base font-persian text-text-secondary">
                {toPersianDigitsInText(product.subtitle)}
              </p>
            )}

            {/* Sleep-brand property badges — each rendered only when authored. */}
            {(product.material ||
              product.is_washable ||
              product.trial_nights > 0) && (
              <div className="flex flex-wrap gap-2">
                {product.material && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-warm-white px-3 py-1.5 font-persian text-sm text-text-primary">
                    <Layers size={14} className="text-brand-navy" />
                    {product.material}
                  </span>
                )}
                {product.is_washable && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-status-success-bg px-3 py-1.5 font-persian text-sm text-status-success">
                    <Droplets size={14} />
                    قابل شستشو
                  </span>
                )}
                {product.trial_nights > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-status-warning-bg px-3 py-1.5 font-persian text-sm text-status-warning">
                    <Moon size={14} />
                    {toPersianNumber(product.trial_nights)} شب تست رایگان
                  </span>
                )}
              </div>
            )}

            {/* Firmness — the scale sleep brands use to make a subjective
                property comparable. Null for duvets and bedboxes. */}
            {product.firmness != null && (
              <div className="rounded-xl border border-brand-mist bg-white p-4 shadow-[0_1px_4px_rgba(5,46,95,0.06)]">
                <FirmnessScale value={Number(product.firmness)} />
              </div>
            )}

            {/* Availability */}
            {!product.is_available && (
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-full bg-status-error-bg px-3 py-1.5">
                  <Package size={16} className="text-status-error" />
                  <span className="text-sm font-persian font-medium text-status-error">
                    ناموجود
                  </span>
                </div>
              </div>
            )}

            {/* ── Size selector ──
                standard → the six bed-size cards with bed icons
                listed   → plain chips (duvet sizes are not bed-sized, so a bed
                           icon would misrepresent them)
                none     → omitted entirely (pillow ships in one size) */}
            {meta.sizeMode === "standard" && hasSizes && (
              <div className="space-y-3">
                <span className="block text-sm font-persian font-medium text-text-primary">
                  سایز های موجود :
                </span>

                <div className="grid grid-cols-3 gap-3">
                  {sizeCards.map((sz) => {
                    const isSelected =
                      sz.modelSize && selectedSize?.id === sz.modelSize.id;
                    return (
                      <button
                        key={`${sz.width}x${sz.length}`}
                        type="button"
                        disabled={!sz.available}
                        aria-pressed={isSelected}
                        onClick={() =>
                          sz.modelSize && setSelectedSize(sz.modelSize)
                        }
                        className={`group relative flex flex-col items-center rounded-xl border bg-white p-3 text-center transition-all duration-200 ease-out ${
                          isSelected
                            ? "border-brand-navy shadow-[0_4px_16px_rgba(5,46,95,0.1)]"
                            : "border-brand-mist shadow-[0_1px_4px_rgba(5,46,95,0.06)]"
                        } ${
                          sz.available
                            ? "cursor-pointer  hover:border-brand-navy hover:shadow-[0_4px_16px_rgba(5,46,95,0.1)]"
                            : "cursor-not-allowed opacity-50"
                        }`}
                      >
                        {sz.note && (
                          <span className="absolute -top-2 right-2 font-persian rounded-full bg-status-warning-bg px-2 py-0.5 text-[10px] font-medium text-status-warning">
                            {sz.note}
                          </span>
                        )}
                        <img
                          src={sz.image}
                          alt={sz.name}
                          onError={(e) => {
                            e.currentTarget.src = "/matress.png";
                          }}
                          className="mb-2 h-14 w-14 object-contain"
                        />
                        <span className="text-[11px] font-persian font-medium leading-tight text-text-primary">
                          {sz.name}
                        </span>
                        <span className="mt-0.5 font-persian text-[10px] text-text-secondary [font-feature-settings:'tnum']">
                          {toPersianNumber(sz.width)} ×{" "}
                          {toPersianNumber(sz.length)} سانتی‌متر
                        </span>
                        {sz.price == null ? (
                          <span className="mt-1 font-persian text-[10px] text-text-secondary">
                            ناموجود
                          </span>
                        ) : sz.discountPrice != null ? (
                          <>
                            <span className="mt-1 font-persian text-[10px] text-text-secondary line-through decoration-status-error [font-feature-settings:'tnum']">
                              {formatPersianPrice(sz.price)}
                            </span>
                            <span className="font-persian text-[11px] font-semibold text-brand-navy [font-feature-settings:'tnum']">
                              {formatPersianPrice(sz.discountPrice)} تومان
                            </span>
                          </>
                        ) : (
                          <span className="mt-1 font-persian text-[11px] font-semibold text-brand-navy [font-feature-settings:'tnum']">
                            {formatPersianPrice(sz.price)} تومان
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {meta.sizeMode === "listed" && hasSizes && (
              <div className="space-y-3">
                <span className="block text-sm font-persian font-medium text-text-primary">
                  سایز های موجود :
                </span>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((sz) => {
                    const isSelected = selectedSize?.id === sz.id;
                    const szDiscount = sz.discount_price ?? null;
                    return (
                      <button
                        key={sz.id}
                        type="button"
                        disabled={!sz.in_stock}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedSize(sz)}
                        className={`flex flex-col items-start rounded-xl border bg-white px-4 py-2.5 text-right transition-all duration-200 ease-out ${
                          isSelected
                            ? "border-brand-navy shadow-[0_4px_16px_rgba(5,46,95,0.1)]"
                            : "border-brand-mist shadow-[0_1px_4px_rgba(5,46,95,0.06)]"
                        } ${
                          sz.in_stock
                            ? "cursor-pointer  hover:border-brand-navy"
                            : "cursor-not-allowed opacity-50"
                        }`}
                      >
                        <span className="font-persian text-sm font-medium text-text-primary">
                          {sz.label}
                        </span>
                        <span className="font-persian text-[11px] text-text-secondary [font-feature-settings:'tnum']">
                          {toPersianNumber(sz.width)} ×{" "}
                          {toPersianNumber(sz.length)} سانتی‌متر
                        </span>
                        {!sz.in_stock ? (
                          <span className="mt-0.5 font-persian text-[11px] text-status-error">
                            ناموجود
                          </span>
                        ) : szDiscount != null ? (
                          <span className="mt-0.5 font-persian text-[11px] font-semibold text-brand-navy [font-feature-settings:'tnum']">
                            <span className="ml-1 text-text-secondary line-through decoration-status-error">
                              {formatPersianPrice(sz.price)}
                            </span>
                            {formatPersianPrice(szDiscount)} تومان
                          </span>
                        ) : (
                          <span className="mt-0.5 font-persian text-[11px] font-semibold text-brand-navy [font-feature-settings:'tnum']">
                            {formatPersianPrice(sz.price)} تومان
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Price + add to cart */}
            <div className="flex flex-col gap-3 rounded-xl border border-brand-mist bg-white p-4 shadow-[0_1px_4px_rgba(5,46,95,0.06)] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-text-secondary">
                    قیمت
                  </span>
                  {isOnSale && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-status-error-bg px-2 py-0.5 font-persian text-[10px] font-bold text-status-error">
                      <Tag size={11} className="shrink-0" />
                      {toPersianNumber(product.off_percentage)}٪ تخفیف
                    </span>
                  )}
                </div>
                {isOnSale && discountPrice ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-persian text-lg font-medium text-text-secondary line-through decoration-status-error [font-feature-settings:'tnum']">
                      {formatPersianPrice(displayPrice)}
                      <span className="mr-1 text-sm font-normal text-text-secondary">
                        تومان
                      </span>
                    </span>
                    <span className="font-persian text-2xl font-bold text-brand-navy [font-feature-settings:'tnum']">
                      {formatPersianPrice(discountPrice)}
                      <span className="mr-1 text-sm font-normal text-brand-navy">
                        تومان
                      </span>
                    </span>
                  </div>
                ) : (
                  <span className="font-persian text-2xl font-bold text-brand-navy [font-feature-settings:'tnum']">
                    {formatPersianPrice(displayPrice)}
                    <span className="mr-1 text-sm font-normal text-text-secondary">
                      تومان
                    </span>
                  </span>
                )}
                <span className="mt-1 block font-persian text-[11px] leading-5 text-text-secondary">
                  محاسبه بر اساس {priceBasis}
                  {isOnSale &&
                    ` با ${toPersianNumber(product.off_percentage)}٪ تخفیف`}
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!canBuy}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 font-persian text-sm font-bold text-white shadow-[0_1px_4px_rgba(5,46,95,0.06)] transition ${
                  added ? "bg-status-success" : "bg-brand-navy hover:bg-action-hover"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {added ? (
                  <>
                    <Check size={17} />
                    به سبد اضافه شد
                  </>
                ) : (
                  <>
                    <ShoppingCart size={17} />
                    افزودن به سبد خرید
                  </>
                )}
              </button>
            </div>

            {/* Description */}
            <p className="leading-8 text-text-secondary">{product.description}</p>

            {/* Features */}
            {product.features?.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {product.features.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-2 rounded-full bg-brand-warm-white px-3 py-1.5"
                  >
                    <Check size={14} className="text-status-success" />
                    <span className="text-sm font-persian text-text-primary">
                      {f.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detailed sections */}
        <div className="mt-16 space-y-8" dir="rtl">
          {/* Long description */}
          {product.long_description && (
            <div className={CARD}>
              <h2 className="mb-4 font-persian text-xl font-semibold text-brand-navy">
                توضیحات تکمیلی
              </h2>
              <div className="whitespace-pre-wrap leading-8 text-text-secondary">
                {product.long_description}
              </div>
            </div>
          )}

          {/* Specifications */}
          {product.specifications?.length > 0 && (
            <div className={CARD}>
              <h2 className="mb-4 font-persian text-xl font-semibold text-brand-navy">
                مشخصات فنی
              </h2>
              <div className="divide-y divide-brand-mist">
                {product.specifications.map((spec) => (
                  <div key={spec.id} className="flex justify-between py-3">
                    <span className="text-sm font-medium text-text-primary">
                      {spec.key}
                    </span>
                    <span className="text-sm text-text-secondary">{spec.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pros & Cons */}
          {(pros.length > 0 || cons.length > 0) && (
            <div className="grid gap-6 md:grid-cols-2">
              {pros.length > 0 && (
                <div className={CARD}>
                  <h2 className="mb-4 font-persian text-lg font-semibold text-status-success">
                    مزایا
                  </h2>
                  <ul className="space-y-3">
                    {pros.map((p) => (
                      <li key={p.id} className="flex items-start gap-3">
                        <Check
                          size={16}
                          className="mt-1 shrink-0 text-status-success"
                        />
                        <span className="text-sm leading-6 text-text-secondary">
                          {p.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {cons.length > 0 && (
                <div className={CARD}>
                  <h2 className="mb-4 font-persian text-lg font-semibold text-status-error">
                    معایب
                  </h2>
                  <ul className="space-y-3">
                    {cons.map((c) => (
                      <li key={c.id} className="flex items-start gap-3">
                        <X size={16} className="mt-1 shrink-0 text-status-error" />
                        <span className="text-sm leading-6 text-text-secondary">
                          {c.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* FAQs */}
          {product.faqs?.length > 0 && (
            <div className={CARD}>
              <h2 className="mb-2 font-persian text-xl font-semibold text-brand-navy">
                سوالات متداول
              </h2>
              <div>
                {product.faqs.map((faq) => (
                  <FAQItem key={faq.id} faq={faq} />
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          {product.reviews?.length > 0 && (
            <div className={CARD}>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="font-persian text-xl font-semibold text-brand-navy">
                  نظرات کاربران
                </h2>
                <div className="flex items-center gap-2">
                  {/* Same figure as the hero: this block only renders when
                      approved reviews exist, so displayRating is the real
                      average here, not the unreviewed default. */}
                  <StarRating rating={displayRating} size={18} />
                  <span className="text-sm text-text-secondary">
                    {toPersianNumber(displayRating.toFixed(1))} از ۵
                  </span>
                </div>
              </div>
              <div className="divide-y divide-brand-mist">
                {product.reviews.map((review) => (
                  <div key={review.id} className="py-5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-warm-white text-sm font-bold text-brand-navy">
                        {review.customer_name?.charAt(0) || "ک"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {review.customer_name}
                        </p>
                        <StarRating rating={review.rating} size={12} />
                      </div>
                    </div>
                    <h4 className="mt-3 font-medium text-text-primary">
                      {review.title}
                    </h4>
                    <p className="mt-2 text-sm leading-7 text-text-secondary">
                      {review.body}
                    </p>
                    {(review.pros || review.cons) && (
                      <div className="mt-3 flex flex-wrap gap-4 text-xs">
                        {review.pros && (
                          <span className="text-status-success">
                            <Check size={12} className="ml-1 inline" />
                            {review.pros}
                          </span>
                        )}
                        {review.cons && (
                          <span className="text-status-error">
                            <X size={12} className="ml-1 inline" />
                            {review.cons}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Review submission */}
          <ReviewForm slug={slug} />
        </div>
      </div>
    </section>
  );
}
