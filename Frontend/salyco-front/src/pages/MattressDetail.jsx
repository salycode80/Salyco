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
  Ruler,
  Package,
} from "lucide-react";
import { getMattressDetail } from "../api/warranty";
import { getProductImageUrl } from "../utils/productImage";

const toPersianNumber = (num) => {
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return num.toString().replace(/\d/g, (d) => persianDigits[parseInt(d)]);
};

const formatPersianPrice = (price) =>
  toPersianNumber(Number(price).toLocaleString());

function StarRating({ rating, size = 16 }) {
  return (
    <div className="flex gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={
            i <= Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "text-gray-300"
          }
        />
      ))}
    </div>
  );
}

function FAQItem({ faq }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#0a1f4d]/10 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-4 text-right"
      >
        <span className="font-medium text-[#0a1f4d]">{faq.question}</span>
        {open ? (
          <ChevronUp size={18} className="shrink-0 text-[#0a1f4d]/40" />
        ) : (
          <ChevronDown size={18} className="shrink-0 text-[#0a1f4d]/40" />
        )}
      </button>
      {open && (
        <p className="pb-4 text-sm leading-7 text-[#0a1f4d]/60">
          {faq.answer}
        </p>
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
            : getProductImageUrl(data.image)
        );
        if (data.sizes?.length > 0) setSelectedSize(data.sizes[0]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <section className="min-h-screen bg-[#F5F7FA] pt-[72px]">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <p className="font-persian text-center text-[#000c3e]/60">
            در حال بارگذاری...
          </p>
        </div>
      </section>
    );
  }

  if (error || !mattress) {
    return (
      <section className="min-h-screen bg-[#F5F7FA] pt-[72px]">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <p className="font-persian text-center text-red-600/80">
            {error || "محصول یافت نشد."}
          </p>
        </div>
      </section>
    );
  }

  const warrantyYears = Math.round(mattress.warranty_months / 12);
  const displayPrice = selectedSize
    ? selectedSize.price
    : mattress.price;
  const pros = mattress.pros_cons?.filter((p) => p.type === "PRO") || [];
  const cons = mattress.pros_cons?.filter((p) => p.type === "CON") || [];

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#F5F7FA] pt-[72px]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(100,160,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(100,160,255,0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 py-10">
        <Link
          to="/products/mattress"
          className="mb-8 inline-flex items-center gap-2 font-persian text-sm text-[#001a5c] transition-colors hover:text-blue-500"
          dir="rtl"
        >
          <ArrowRight size={16} />
          بازگشت به محصولات
        </Link>

        {/* Hero: Image + Info */}
        <div
          className="grid gap-10 lg:grid-cols-2"
          dir="rtl"
        >
          {/* Image gallery */}
          <div className="space-y-4">
            <div className="overflow-hidden rounded-[20px] border border-[#0a1f4d]/10 bg-white shadow-sm">
              <div className="relative aspect-square overflow-hidden bg-[#f0f2f5]">
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
                      className={`h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                        selectedImage === url
                          ? "border-blue-500 shadow-md"
                          : "border-transparent opacity-70 hover:opacity-100"
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
            {mattress.brand && (
              <p className="text-sm font-medium uppercase tracking-[0.15em] text-blue-500/80">
                {mattress.brand}
              </p>
            )}
            <h1 className="font-persian text-3xl font-bold text-[#0a1f4d] md:text-4xl">
              {mattress.name}
            </h1>
            {mattress.subtitle && (
              <p className="text-base text-[#0a1f4d]/60">{mattress.subtitle}</p>
            )}

            {/* Rating */}
            {mattress.review_count > 0 && (
              <div className="flex items-center gap-3">
                <StarRating rating={mattress.average_rating} />
                <span className="text-sm text-[#0a1f4d]/50">
                  ({toPersianNumber(mattress.review_count)} نظر)
                </span>
              </div>
            )}

            {/* Warranty + Dimensions */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-2xl bg-blue-50 px-4 py-2">
                <ShieldCheck size={16} className="text-blue-500" />
                <span className="text-sm font-medium text-blue-700">
                  {toPersianNumber(warrantyYears)} سال گارانتی
                </span>
              </div>
              {(mattress.width > 0 || mattress.length > 0) && (
                <div className="flex items-center gap-2 rounded-2xl bg-[#0a1f4d]/5 px-4 py-2">
                  <Ruler size={16} className="text-[#0a1f4d]/50" />
                  <span className="text-sm text-[#0a1f4d]/60">
                    {toPersianNumber(mattress.width)} × {toPersianNumber(mattress.length)}
                    {mattress.height > 0 && ` × ${toPersianNumber(mattress.height)}`} سانتی‌متر
                  </span>
                </div>
              )}
              {!mattress.is_available && (
                <div className="flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-2">
                  <Package size={16} className="text-red-500" />
                  <span className="text-sm font-medium text-red-600">ناموجود</span>
                </div>
              )}
            </div>

            {/* Size selector */}
            {mattress.sizes?.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-[#0a1f4d]/70">انتخاب سایز:</p>
                <div className="flex flex-wrap gap-2">
                  {mattress.sizes.map((size) => (
                    <button
                      key={size.id}
                      onClick={() => setSelectedSize(size)}
                      disabled={!size.in_stock}
                      className={`rounded-xl border px-4 py-2.5 text-sm transition-all ${
                        selectedSize?.id === size.id
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : size.in_stock
                          ? "border-[#0a1f4d]/15 bg-white text-[#0a1f4d]/70 hover:border-blue-300"
                          : "border-[#0a1f4d]/10 bg-gray-100 text-[#0a1f4d]/30 line-through"
                      }`}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Price */}
            <div className="mt-2">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-[#0a1f4d]/40">
                قیمت
              </p>
              <p className="mt-1 font-persian text-3xl font-bold text-[#0a1a3a] tracking-tight">
                {formatPersianPrice(displayPrice)}
                <span className="mr-2 text-base font-normal text-blue-400/60">
                  تومان
                </span>
              </p>
            </div>

            {/* Description */}
            <p className="leading-8 text-[#0a1f4d]/65">{mattress.description}</p>

            {/* Features */}
            {mattress.features?.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {mattress.features.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 border border-[#0a1f4d]/8 shadow-sm"
                  >
                    <Check size={14} className="text-emerald-500" />
                    <span className="text-sm text-[#0a1f4d]/75">{f.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detailed sections */}
        <div className="mt-16 space-y-12" dir="rtl">
          {/* Long description */}
          {mattress.long_description && (
            <div className="rounded-[20px] border border-[#0a1f4d]/10 bg-white p-8 shadow-sm">
              <h2 className="mb-4 font-persian text-xl font-bold text-[#0a1f4d]">
                توضیحات تکمیلی
              </h2>
              <div className="whitespace-pre-wrap leading-8 text-[#0a1f4d]/65">
                {mattress.long_description}
              </div>
            </div>
          )}

          {/* Specifications */}
          {mattress.specifications?.length > 0 && (
            <div className="rounded-[20px] border border-[#0a1f4d]/10 bg-white p-8 shadow-sm">
              <h2 className="mb-6 font-persian text-xl font-bold text-[#0a1f4d]">
                مشخصات فنی
              </h2>
              <div className="divide-y divide-[#0a1f4d]/8">
                {mattress.specifications.map((spec, i) => (
                  <div
                    key={spec.id}
                    className={`flex justify-between py-3 ${
                      i % 2 === 0 ? "bg-[#f8f9fb]" : ""
                    } px-4 rounded-lg`}
                  >
                    <span className="text-sm font-medium text-[#0a1f4d]/70">
                      {spec.key}
                    </span>
                    <span className="text-sm text-[#0a1f4d]/55">{spec.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pros & Cons */}
          {(pros.length > 0 || cons.length > 0) && (
            <div className="grid gap-6 md:grid-cols-2">
              {pros.length > 0 && (
                <div className="rounded-[20px] border border-emerald-200/60 bg-white p-8 shadow-sm">
                  <h2 className="mb-4 font-persian text-lg font-bold text-emerald-700">
                    مزایا
                  </h2>
                  <ul className="space-y-3">
                    {pros.map((p) => (
                      <li key={p.id} className="flex items-start gap-3">
                        <Check
                          size={16}
                          className="mt-1 shrink-0 text-emerald-500"
                        />
                        <span className="text-sm leading-6 text-[#0a1f4d]/70">
                          {p.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {cons.length > 0 && (
                <div className="rounded-[20px] border border-red-200/60 bg-white p-8 shadow-sm">
                  <h2 className="mb-4 font-persian text-lg font-bold text-red-600">
                    معایب
                  </h2>
                  <ul className="space-y-3">
                    {cons.map((c) => (
                      <li key={c.id} className="flex items-start gap-3">
                        <X size={16} className="mt-1 shrink-0 text-red-400" />
                        <span className="text-sm leading-6 text-[#0a1f4d]/70">
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
            <div className="rounded-[20px] border border-[#0a1f4d]/10 bg-white p-8 shadow-sm">
              <h2 className="mb-4 font-persian text-xl font-bold text-[#0a1f4d]">
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
            <div className="rounded-[20px] border border-[#0a1f4d]/10 bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="font-persian text-xl font-bold text-[#0a1f4d]">
                  نظرات کاربران
                </h2>
                <div className="flex items-center gap-2">
                  <StarRating rating={mattress.average_rating} size={18} />
                  <span className="text-sm text-[#0a1f4d]/50">
                    {toPersianNumber(Number(mattress.average_rating).toFixed(1))} از ۵
                  </span>
                </div>
              </div>
              <div className="divide-y divide-[#0a1f4d]/8">
                {mattress.reviews.map((review) => (
                  <div key={review.id} className="py-5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-600">
                        {review.customer_name?.charAt(0) || "ک"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#0a1f4d]">
                          {review.customer_name}
                        </p>
                        <StarRating rating={review.rating} size={12} />
                      </div>
                    </div>
                    <h4 className="mt-3 font-medium text-[#0a1f4d]">
                      {review.title}
                    </h4>
                    <p className="mt-2 text-sm leading-7 text-[#0a1f4d]/60">
                      {review.body}
                    </p>
                    {(review.pros || review.cons) && (
                      <div className="mt-3 flex flex-wrap gap-4 text-xs">
                        {review.pros && (
                          <span className="text-emerald-600">
                            <Check size={12} className="ml-1 inline" />
                            {review.pros}
                          </span>
                        )}
                        {review.cons && (
                          <span className="text-red-500">
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
