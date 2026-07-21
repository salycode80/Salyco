import { useEffect, useState } from "react";
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
} from "lucide-react";
import { getMattressDetail } from "../api/warranty";
import { getProductImageUrl } from "../utils/productImage";
import PageBackground from "../components/PageBackground";

const toPersianNumber = (num) => {
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return num.toString().replace(/\d/g, (d) => persianDigits[parseInt(d)]);
};

const formatPersianPrice = (price) =>
  toPersianNumber(Number(price).toLocaleString());

// Salyco design tokens
const CARD =
  "rounded-xl border border-[#CBD2D6] bg-white p-6 shadow-[0_1px_4px_rgba(0,48,135,0.06)]";

// The six canonical mattress sizes. Names/dimensions are static; the price for
// each comes from the matching MattressSize on the model (matched by w×l).
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

export default function MattressDetail() {
  const { slug } = useParams();
  const [mattress, setMattress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getMattressDetail(slug)
      .then((data) => {
        setMattress(data);
        const primary = data.images?.find((img) => img.is_primary);
        setSelectedImage(
          primary
            ? getProductImageUrl(primary.image)
            : getProductImageUrl(data.image),
        );
        if (data.sizes?.length > 0) setSelectedSize(data.sizes[0]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

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

  if (error || !mattress) {
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

  const warrantyYears = Math.round(mattress.warranty_months / 12);
  const displayPrice = selectedSize ? selectedSize.price : mattress.price;

  // Merge the six canonical sizes with the model's priced sizes (matched by w×l).
  // A canonical size with no matching MattressSize is shown as unavailable.
  const sizeCards = STANDARD_SIZES.map((std) => {
    const match = mattress.sizes?.find(
      (s) => s.width === std.width && s.length === std.length,
    );
    return {
      ...std,
      image: `/bedicon_${std.width}_${std.length}.png`,
      modelSize: match || null,
      price: match ? match.price : null,
      available: !!match && match.in_stock,
    };
  });
  const pros = mattress.pros_cons?.filter((p) => p.type === "PRO") || [];
  const cons = mattress.pros_cons?.filter((p) => p.type === "CON") || [];

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#F5F7FA] pt-[var(--navbar-height)]">
      <PageBackground />

      <div className="relative mx-auto max-w-[1120px] px-6 py-8 sm:py-10">
        <Link
          to="/products/mattress"
          className="mb-8 inline-flex items-center gap-2 font-persian text-sm font-medium text-[#003087] transition-colors hover:text-[#009CDE]"
          dir="rtl"
        >
          <ArrowRight size={16} />
          بازگشت
        </Link>

        {/* Hero: Image + Info */}
        <div className="grid gap-10 lg:grid-cols-2" dir="rtl">
          {/* Image gallery */}
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-[#CBD2D6] bg-white shadow-[0_1px_4px_rgba(0,48,135,0.06)]">
              <div className="relative aspect-square overflow-hidden bg-[#F5F7FA]">
                <img
                  src={selectedImage}
                  alt={mattress.name}
                  onError={() => setSelectedImage("/matress.png")}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            {mattress.images?.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {mattress.images.map((img) => {
                  const url = getProductImageUrl(img.image);
                  return (
                    <button
                      key={img.id}
                      onClick={() => setSelectedImage(url)}
                      className={`h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                        selectedImage === url
                          ? "border-[#003087]"
                          : "border-[#CBD2D6] opacity-70 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={url}
                        alt={img.alt_text || mattress.name}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4">
              <div className="flex justify-between">
                {/* Rating */}
                {mattress.review_count > 0 && (
                  <div className="order-2 flex items-center gap-3">
                    <StarRating rating={mattress.average_rating} />
                  </div>
                )}
                <h1 className="font-persian text-3xl font-bold text-[#003087] md:text-4xl">
                  {mattress.name}
                </h1>
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
                <span className="text-[14px] font-semibold text-[#003087]">
                  {toPersianNumber(warrantyYears)} سال گارانتی
                </span>
              </div>
            </div>
            {mattress.subtitle && (
              <p className="text-base text-[#687173]">{mattress.subtitle}</p>
            )}

            {/* Availability */}
            {!mattress.is_available && (
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-full bg-[#FDE7E7] px-3 py-1.5">
                  <Package size={16} className="text-[#D20000]" />
                  <span className="text-sm font-medium text-[#D20000]">
                    ناموجود
                  </span>
                </div>
              </div>
            )}

            {/* Size selector */}
            {mattress.sizes?.length > 0 && (
              <div className="space-y-3">
                <span className="block text-sm font-medium text-[#1A1A2E]">
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
                          <span className="absolute -top-2 right-2 rounded-full bg-[#FFF8E1] px-2 py-0.5 text-[10px] font-medium text-[#F5BA2E]">
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
                        <span className="text-[11px] font-medium leading-tight text-[#1A1A2E]">
                          {sz.name}
                        </span>
                        <span className="mt-0.5 text-[10px] text-[#687173] [font-feature-settings:'tnum']">
                          {toPersianNumber(sz.width)} ×{" "}
                          {toPersianNumber(sz.length)} سانتی‌متر
                        </span>
                        {sz.price != null ? (
                          <span className="mt-1 text-[11px] font-semibold text-[#003087] [font-feature-settings:'tnum']">
                            {formatPersianPrice(sz.price)} تومان
                          </span>
                        ) : (
                          <span className="mt-1 text-[10px] text-[#687173]">
                            ناموجود
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Price */}
            <div className="mt-2">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-[#687173]">
                قیمت
              </p>
              <p className="mt-1 font-persian text-3xl font-bold tracking-tight text-[#003087] [font-feature-settings:'tnum']">
                {formatPersianPrice(displayPrice)}
                <span className="mr-2 text-base font-normal text-[#687173]">
                  تومان
                </span>
              </p>
            </div>

            {/* Description */}
            <p className="leading-8 text-[#687173]">{mattress.description}</p>

            {/* Features */}
            {mattress.features?.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {mattress.features.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-2 rounded-full bg-[#F5F7FA] px-3 py-1.5"
                  >
                    <Check size={14} className="text-[#019C34]" />
                    <span className="text-sm text-[#1A1A2E]">{f.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detailed sections */}
        <div className="mt-16 space-y-8" dir="rtl">
          {/* Long description */}
          {mattress.long_description && (
            <div className={CARD}>
              <h2 className="mb-4 font-persian text-xl font-semibold text-[#003087]">
                توضیحات تکمیلی
              </h2>
              <div className="whitespace-pre-wrap leading-8 text-[#687173]">
                {mattress.long_description}
              </div>
            </div>
          )}

          {/* Specifications */}
          {mattress.specifications?.length > 0 && (
            <div className={CARD}>
              <h2 className="mb-4 font-persian text-xl font-semibold text-[#003087]">
                مشخصات فنی
              </h2>
              <div className="divide-y divide-[#CBD2D6]">
                {mattress.specifications.map((spec) => (
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
          {mattress.faqs?.length > 0 && (
            <div className={CARD}>
              <h2 className="mb-2 font-persian text-xl font-semibold text-[#003087]">
                سوالات متداول
              </h2>
              <div>
                {mattress.faqs.map((faq) => (
                  <FAQItem key={faq.id} faq={faq} />
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          {mattress.reviews?.length > 0 && (
            <div className={CARD}>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="font-persian text-xl font-semibold text-[#003087]">
                  نظرات کاربران
                </h2>
                <div className="flex items-center gap-2">
                  <StarRating rating={mattress.average_rating} size={18} />
                  <span className="text-sm text-[#687173]">
                    {toPersianNumber(
                      Number(mattress.average_rating).toFixed(1),
                    )}{" "}
                    از ۵
                  </span>
                </div>
              </div>
              <div className="divide-y divide-[#CBD2D6]">
                {mattress.reviews.map((review) => (
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
        </div>
      </div>
    </section>
  );
}
