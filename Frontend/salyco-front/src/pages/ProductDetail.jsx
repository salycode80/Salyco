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
import { toPersianNumber, formatPersianPrice } from "../utils/persian";
import { CATEGORY_BY_KEY, isValidCategory } from "../config/productCategories";
import { ACCESS_TOKEN } from "../constants";
import { useCart } from "../context/CartContext";
import PageBackground from "../components/PageBackground";
import ProductGallery from "../components/product/ProductGallery";

// Salyco design tokens
const CARD =
  "rounded-xl border border-[#CBD2D6] bg-white p-6 shadow-[0_1px_4px_rgba(0,48,135,0.06)]";

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
              ? "fill-[#F5BA2E] text-[#F5BA2E]"
              : "text-[#CBD2D6]"
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
        <span className="font-persian text-sm font-medium text-[#1A1A2E]">
          سطح سفتی
        </span>
        <span className="font-persian text-xs text-[#687173] [font-feature-settings:'tnum']">
          {toPersianNumber(value)} از ۱۰
        </span>
      </div>
      <div className="flex gap-1" dir="ltr">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full transition-colors ${
              i < value ? "bg-[#003087]" : "bg-[#E5E9EB]"
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between font-persian text-[11px] text-[#687173]">
        <span>نرم</span>
        <span>سخت</span>
      </div>
    </div>
  );
}

function FAQItem({ faq }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#CBD2D6] last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-4 text-right"
      >
        <span className="font-medium text-[#1A1A2E]">{faq.question}</span>
        {open ? (
          <ChevronUp size={18} className="shrink-0 text-[#687173]" />
        ) : (
          <ChevronDown size={18} className="shrink-0 text-[#687173]" />
        )}
      </button>
      {open && (
        <p className="pb-4 text-sm leading-7 text-[#687173]">{faq.answer}</p>
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
                ? "fill-[#F5BA2E] text-[#F5BA2E]"
                : "text-[#CBD2D6]"
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
    "w-full rounded-lg border border-[#CBD2D6] bg-white px-4 py-3 font-persian text-sm text-[#1A1A2E] placeholder-[#687173] transition focus:border-[#009CDE] focus:outline-none focus:ring-2 focus:ring-[#009CDE]/20";

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
        <h2 className="mb-2 font-persian text-xl font-semibold text-[#003087]">
          ثبت نظر
        </h2>
        <p className="mb-4 font-persian text-sm text-[#687173]">
          برای ثبت نظر ابتدا وارد حساب کاربری خود شوید.
        </p>
        <Link
          to="/auth"
          className="inline-flex items-center gap-2 rounded-lg bg-[#003087] px-6 py-3 font-persian text-sm font-bold text-white transition hover:bg-[#00246B]"
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
        <div className="flex flex-col items-center justify-center rounded-xl bg-[#E6F4EA] p-8 text-center ring-1 ring-[#019C34]/30">
          <CheckCircle2 className="h-14 w-14 text-[#019C34]" />
          <h3 className="mt-4 font-persian text-lg font-bold text-[#1A1A2E]">
            نظر شما ثبت شد
          </h3>
          <p className="mt-2 font-persian text-sm text-[#687173]">
            نظر شما پس از تأیید توسط کارشناسان ما نمایش داده خواهد شد.
            سپاسگزاریم.
          </p>
          <button
            onClick={() => setStatus("idle")}
            className="mt-6 rounded-lg border-2 border-[#003087] px-6 py-2 font-persian text-sm font-medium text-[#003087] transition hover:bg-[#003087] hover:text-white"
          >
            ثبت نظر جدید
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={CARD}>
      <h2 className="mb-1 flex items-center gap-2 font-persian text-xl font-semibold text-[#003087]">
        <MessageSquarePlus size={20} />
        ثبت نظر
      </h2>
      <p className="mb-6 font-persian text-sm text-[#687173]">
        تجربه خود از این محصول را با دیگران به اشتراک بگذارید.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* rating */}
        <div>
          <label className="mb-1.5 block font-persian text-sm font-medium text-[#1A1A2E]">
            امتیاز شما
          </label>
          <StarPicker
            value={form.rating}
            onChange={(r) => setForm((f) => ({ ...f, rating: r }))}
          />
        </div>

        {/* title */}
        <div>
          <label className="mb-1.5 block font-persian text-sm font-medium text-[#1A1A2E]">
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
          <label className="mb-1.5 block font-persian text-sm font-medium text-[#1A1A2E]">
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
            <label className="mb-1.5 block font-persian text-sm font-medium text-[#019C34]">
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
            <label className="mb-1.5 block font-persian text-sm font-medium text-[#D20000]">
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
          <p className="rounded-lg bg-[#FDE7E7] px-4 py-2.5 font-persian text-sm text-[#D20000]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={status === "sending"}
          className="mt-2 inline-flex w-fit items-center justify-center gap-2 rounded-lg bg-[#003087] px-6 py-3 font-persian text-sm font-bold text-white shadow-[0_1px_4px_rgba(0,48,135,0.06)] transition hover:bg-[#00246B] disabled:cursor-not-allowed disabled:opacity-60"
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
      <section className="min-h-screen bg-[#F5F7FA] pt-[var(--navbar-height)]">
        <div
          className="mx-auto max-w-7xl px-4 py-10 text-center sm:px-6 sm:py-16"
          dir="rtl"
        >
          <p className="font-persian text-[#D20000]">محصول یافت نشد.</p>
          <Link
            to="/products"
            className="mt-4 inline-flex items-center gap-2 font-persian text-sm font-medium text-[#003087] hover:text-[#009CDE]"
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
      <section className="min-h-screen bg-[#F5F7FA] pt-[var(--navbar-height)]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16">
          <p className="font-persian text-center text-[#687173]">
            در حال بارگذاری...
          </p>
        </div>
      </section>
    );
  }

  if (error || !product) {
    return (
      <section className="min-h-screen bg-[#F5F7FA] pt-[var(--navbar-height)]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16">
          <p className="font-persian text-center text-[#D20000]">
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
    <section className="relative min-h-screen overflow-hidden bg-[#F5F7FA] pt-[var(--navbar-height)]">
      <PageBackground />

      <div className="relative mx-auto max-w-[1120px] px-6 py-8 sm:py-10">
        <Link
          to={`/products/${category}`}
          className="mb-8 inline-flex items-center gap-2 font-persian text-sm font-medium text-[#003087] transition-colors hover:text-[#009CDE]"
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
                  <span className="whitespace-nowrap font-persian text-xs text-[#687173]">
                    {reviewCount > 0
                      ? `${toPersianNumber(reviewCount)} نظر`
                      : "بدون نظر"}
                  </span>
                </div>
                <div className="min-w-0">
                  {/* Category kicker: with five product lines sharing one layout,
                      the name alone no longer says what you are looking at. */}
                  <p className="mb-1 font-persian text-xs font-medium text-[#687173]">
                    {product.category_label ?? meta.label}
                  </p>
                  <h1 className="font-persian text-3xl font-bold text-[#003087] md:text-4xl">
                    {product.name}
                  </h1>
                </div>
              </div>
              <div
                className="group flex w-fit items-center gap-2 rounded-xl border border-[#003087]/15 bg-[#F5F7FA] px-4 py-2 transition-all duration-300 ease-out hover:-translate-y-0.5"
                style={{
                  boxShadow: "0 1px 4px rgba(0,48,135,0.06)", // Elevation Level 1
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 4px 16px rgba(0,48,135,0.1)"; // Elevation Level 2 on hover
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 1px 4px rgba(0,48,135,0.06)";
                }}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-xl bg-[#003087]/10 transition-colors duration-300 group-hover:bg-[#003087]/15">
                  <ShieldCheck
                    size={16}
                    className="text-[#003087]"
                    strokeWidth={2.5}
                  />
                </div>
                <span className="text-[14px] font-persian font-semibold text-[#003087]">
                  {warrantyText}
                </span>
              </div>
            </div>
            {product.subtitle && (
              <p className="text-base font-persian text-[#687173]">
                {product.subtitle}
              </p>
            )}

            {/* Sleep-brand property badges — each rendered only when authored. */}
            {(product.material ||
              product.is_washable ||
              product.trial_nights > 0) && (
              <div className="flex flex-wrap gap-2">
                {product.material && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5F7FA] px-3 py-1.5 font-persian text-sm text-[#1A1A2E]">
                    <Layers size={14} className="text-[#003087]" />
                    {product.material}
                  </span>
                )}
                {product.is_washable && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F4EA] px-3 py-1.5 font-persian text-sm text-[#019C34]">
                    <Droplets size={14} />
                    قابل شستشو
                  </span>
                )}
                {product.trial_nights > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF8E1] px-3 py-1.5 font-persian text-sm text-[#B8860B]">
                    <Moon size={14} />
                    {toPersianNumber(product.trial_nights)} شب تست رایگان
                  </span>
                )}
              </div>
            )}

            {/* Firmness — the scale sleep brands use to make a subjective
                property comparable. Null for duvets and bedboxes. */}
            {product.firmness != null && (
              <div className="rounded-xl border border-[#CBD2D6] bg-white p-4 shadow-[0_1px_4px_rgba(0,48,135,0.06)]">
                <FirmnessScale value={Number(product.firmness)} />
              </div>
            )}

            {/* Availability */}
            {!product.is_available && (
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-full bg-[#FDE7E7] px-3 py-1.5">
                  <Package size={16} className="text-[#D20000]" />
                  <span className="text-sm font-persian font-medium text-[#D20000]">
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
                <span className="block text-sm font-persian font-medium text-[#1A1A2E]">
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
                        onClick={() =>
                          sz.modelSize && setSelectedSize(sz.modelSize)
                        }
                        className={`group relative flex flex-col items-center rounded-xl border bg-white p-3 text-center transition-all duration-300 ease-out ${
                          isSelected
                            ? "border-[#003087] shadow-[0_4px_16px_rgba(0,48,135,0.1)]"
                            : "border-[#CBD2D6] shadow-[0_1px_4px_rgba(0,48,135,0.06)]"
                        } ${
                          sz.available
                            ? "cursor-pointer hover:-translate-y-0.5 hover:border-[#009CDE] hover:shadow-[0_4px_16px_rgba(0,48,135,0.1)]"
                            : "cursor-not-allowed opacity-50"
                        }`}
                      >
                        {sz.note && (
                          <span className="absolute -top-2 right-2 font-persian rounded-full bg-[#FFF8E1] px-2 py-0.5 text-[10px] font-medium text-[#F5BA2E]">
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
                        <span className="text-[11px] font-persian font-medium leading-tight text-[#1A1A2E]">
                          {sz.name}
                        </span>
                        <span className="mt-0.5 font-persian text-[10px] text-[#687173] [font-feature-settings:'tnum']">
                          {toPersianNumber(sz.width)} ×{" "}
                          {toPersianNumber(sz.length)} سانتی‌متر
                        </span>
                        {sz.price == null ? (
                          <span className="mt-1 font-persian text-[10px] text-[#687173]">
                            ناموجود
                          </span>
                        ) : sz.discountPrice != null ? (
                          <>
                            <span className="mt-1 font-persian text-[10px] text-gray-400 line-through decoration-red-500 [font-feature-settings:'tnum']">
                              {formatPersianPrice(sz.price)}
                            </span>
                            <span className="font-persian text-[11px] font-semibold text-[#003087] [font-feature-settings:'tnum']">
                              {formatPersianPrice(sz.discountPrice)} تومان
                            </span>
                          </>
                        ) : (
                          <span className="mt-1 font-persian text-[11px] font-semibold text-[#003087] [font-feature-settings:'tnum']">
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
                <span className="block text-sm font-persian font-medium text-[#1A1A2E]">
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
                        onClick={() => setSelectedSize(sz)}
                        className={`flex flex-col items-start rounded-xl border bg-white px-4 py-2.5 text-right transition-all duration-300 ease-out ${
                          isSelected
                            ? "border-[#003087] shadow-[0_4px_16px_rgba(0,48,135,0.1)]"
                            : "border-[#CBD2D6] shadow-[0_1px_4px_rgba(0,48,135,0.06)]"
                        } ${
                          sz.in_stock
                            ? "cursor-pointer hover:-translate-y-0.5 hover:border-[#009CDE]"
                            : "cursor-not-allowed opacity-50"
                        }`}
                      >
                        <span className="font-persian text-sm font-medium text-[#1A1A2E]">
                          {sz.label}
                        </span>
                        <span className="font-persian text-[11px] text-[#687173] [font-feature-settings:'tnum']">
                          {toPersianNumber(sz.width)} ×{" "}
                          {toPersianNumber(sz.length)} سانتی‌متر
                        </span>
                        {!sz.in_stock ? (
                          <span className="mt-0.5 font-persian text-[11px] text-[#D20000]">
                            ناموجود
                          </span>
                        ) : szDiscount != null ? (
                          <span className="mt-0.5 font-persian text-[11px] font-semibold text-[#003087] [font-feature-settings:'tnum']">
                            <span className="ml-1 text-gray-400 line-through decoration-red-500">
                              {formatPersianPrice(sz.price)}
                            </span>
                            {formatPersianPrice(szDiscount)} تومان
                          </span>
                        ) : (
                          <span className="mt-0.5 font-persian text-[11px] font-semibold text-[#003087] [font-feature-settings:'tnum']">
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
            <div className="flex flex-col gap-3 rounded-xl border border-[#CBD2D6] bg-white p-4 shadow-[0_1px_4px_rgba(0,48,135,0.06)] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[#687173]">
                    قیمت
                  </span>
                  {isOnSale && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#FDE7E7] px-2 py-0.5 font-persian text-[10px] font-bold text-[#D20000]">
                      <Tag size={11} className="shrink-0" />
                      {toPersianNumber(product.off_percentage)}٪ تخفیف
                    </span>
                  )}
                </div>
                {isOnSale && discountPrice ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-persian text-lg font-medium text-gray-400 line-through decoration-red-500 [font-feature-settings:'tnum']">
                      {formatPersianPrice(displayPrice)}
                      <span className="mr-1 text-sm font-normal text-gray-400">
                        تومان
                      </span>
                    </span>
                    <span className="font-persian text-2xl font-bold text-[#003087] [font-feature-settings:'tnum']">
                      {formatPersianPrice(discountPrice)}
                      <span className="mr-1 text-sm font-normal text-[#003087]">
                        تومان
                      </span>
                    </span>
                  </div>
                ) : (
                  <span className="font-persian text-2xl font-bold text-[#003087] [font-feature-settings:'tnum']">
                    {formatPersianPrice(displayPrice)}
                    <span className="mr-1 text-sm font-normal text-[#687173]">
                      تومان
                    </span>
                  </span>
                )}
                <span className="mt-1 block font-persian text-[11px] leading-5 text-[#687173]">
                  محاسبه بر اساس {priceBasis}
                  {isOnSale &&
                    ` با ${toPersianNumber(product.off_percentage)}٪ تخفیف`}
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!canBuy}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 font-persian text-sm font-bold text-white shadow-[0_1px_4px_rgba(0,48,135,0.06)] transition ${
                  added ? "bg-[#019C34]" : "bg-[#003087] hover:bg-[#00246B]"
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
            <p className="leading-8 text-[#687173]">{product.description}</p>

            {/* Features */}
            {product.features?.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {product.features.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-2 rounded-full bg-[#F5F7FA] px-3 py-1.5"
                  >
                    <Check size={14} className="text-[#019C34]" />
                    <span className="text-sm font-persian text-[#1A1A2E]">
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
              <h2 className="mb-4 font-persian text-xl font-semibold text-[#003087]">
                توضیحات تکمیلی
              </h2>
              <div className="whitespace-pre-wrap leading-8 text-[#687173]">
                {product.long_description}
              </div>
            </div>
          )}

          {/* Specifications */}
          {product.specifications?.length > 0 && (
            <div className={CARD}>
              <h2 className="mb-4 font-persian text-xl font-semibold text-[#003087]">
                مشخصات فنی
              </h2>
              <div className="divide-y divide-[#CBD2D6]">
                {product.specifications.map((spec) => (
                  <div key={spec.id} className="flex justify-between py-3">
                    <span className="text-sm font-medium text-[#1A1A2E]">
                      {spec.key}
                    </span>
                    <span className="text-sm text-[#687173]">{spec.value}</span>
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
                  <h2 className="mb-4 font-persian text-lg font-semibold text-[#019C34]">
                    مزایا
                  </h2>
                  <ul className="space-y-3">
                    {pros.map((p) => (
                      <li key={p.id} className="flex items-start gap-3">
                        <Check
                          size={16}
                          className="mt-1 shrink-0 text-[#019C34]"
                        />
                        <span className="text-sm leading-6 text-[#687173]">
                          {p.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {cons.length > 0 && (
                <div className={CARD}>
                  <h2 className="mb-4 font-persian text-lg font-semibold text-[#D20000]">
                    معایب
                  </h2>
                  <ul className="space-y-3">
                    {cons.map((c) => (
                      <li key={c.id} className="flex items-start gap-3">
                        <X size={16} className="mt-1 shrink-0 text-[#D20000]" />
                        <span className="text-sm leading-6 text-[#687173]">
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
              <h2 className="mb-2 font-persian text-xl font-semibold text-[#003087]">
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
                <h2 className="font-persian text-xl font-semibold text-[#003087]">
                  نظرات کاربران
                </h2>
                <div className="flex items-center gap-2">
                  {/* Same figure as the hero: this block only renders when
                      approved reviews exist, so displayRating is the real
                      average here, not the unreviewed default. */}
                  <StarRating rating={displayRating} size={18} />
                  <span className="text-sm text-[#687173]">
                    {toPersianNumber(displayRating.toFixed(1))} از ۵
                  </span>
                </div>
              </div>
              <div className="divide-y divide-[#CBD2D6]">
                {product.reviews.map((review) => (
                  <div key={review.id} className="py-5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F7FA] text-sm font-bold text-[#003087]">
                        {review.customer_name?.charAt(0) || "ک"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#1A1A2E]">
                          {review.customer_name}
                        </p>
                        <StarRating rating={review.rating} size={12} />
                      </div>
                    </div>
                    <h4 className="mt-3 font-medium text-[#1A1A2E]">
                      {review.title}
                    </h4>
                    <p className="mt-2 text-sm leading-7 text-[#687173]">
                      {review.body}
                    </p>
                    {(review.pros || review.cons) && (
                      <div className="mt-3 flex flex-wrap gap-4 text-xs">
                        {review.pros && (
                          <span className="text-[#019C34]">
                            <Check size={12} className="ml-1 inline" />
                            {review.pros}
                          </span>
                        )}
                        {review.cons && (
                          <span className="text-[#D20000]">
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
