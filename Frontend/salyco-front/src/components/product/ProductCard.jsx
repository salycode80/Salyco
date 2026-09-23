import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Star, ArrowLeft, Tag, Droplets } from "lucide-react";
import { getProductImageUrl } from "../../utils/productImage";
import { toPersianNumber, formatPersianPrice, toPersianDigitsInText } from "../../utils/persian";
import { CATEGORY_BY_KEY, productUrl } from "../../config/productCategories";

/**
 * Grid/carousel card for any product category.
 *
 * Shared by the per-category listing pages, the combined /products index, and
 * the home-page featured carousel, so it has to stay category-agnostic: the
 * link, corner icon, warranty wording, and price prefix all derive from the
 * product's own `category` rather than assuming a mattress.
 */
export default function ProductCard({ product }) {
  const meta = CATEGORY_BY_KEY[product.category] ?? CATEGORY_BY_KEY.mattress;

  // Warranty is authored in months. Rounding to years reads as "۰ سال گارانتی"
  // for anything under 18 months (a pillow ships with 12), so show months until
  // a full year divides cleanly.
  const warrantyMonths = Number(product.warranty_months ?? 0);
  const showYears = warrantyMonths >= 12 && warrantyMonths % 12 === 0;
  const warrantyText = showYears
    ? `${toPersianNumber(warrantyMonths / 12)} سال گارانتی`
    : `${toPersianNumber(warrantyMonths)} ماه گارانتی`;

  // `rating` is the server-side display score: the approved-review average, or
  // DEFAULT_RATING (5.00) for a product nobody has reviewed yet — the two are
  // deliberately indistinguishable in that one value, so `review_count` is the
  // only thing that tells them apart. Card layout has no room for a "N نظر"
  // caption, so an unreviewed product shows no stars at all rather than five
  // gold ones it has not earned.
  const reviewCount = Number(product.review_count ?? 0);
  const hasReviews = reviewCount > 0;
  const stars = Math.round(Number(product.rating ?? 5));
  const [imageSrc, setImageSrc] = useState(getProductImageUrl(product.image));
  const discountPrice = product.discount_price ?? null;
  const isOnSale =
    product.is_on_off && product.off_percentage > 0 && discountPrice != null;

  // "از" (from) only makes sense when sizes are priced separately. A pillow has
  // one price, so the prefix would be misleading.
  const hasVariablePricing = meta.sizeMode !== "none";

  return (
    <Link
      to={productUrl(product)}
      // Inline by default, so the card didn't fill its grid cell and the focus
      // ring hugged the text rather than the card. h-full evens out row heights.
      className="block h-full rounded-xl"
    >
      <article
        dir="rtl"
        className="@container group flex h-full flex-col overflow-hidden rounded-xl border border-brand-mist bg-white shadow-[0_1px_4px_rgba(5,46,95,0.06)] transition-all duration-200 ease-out  hover:border-brand-navy/25 hover:shadow-[0_4px_16px_rgba(5,46,95,0.1)]"
      >
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-white">
          <img
            src={imageSrc}
            alt={product.name}
            loading="lazy"
            decoding="async"
            onError={() => setImageSrc("/matress.png")}
            className="h-full w-full object-contain p-4"
          />

          {/* The whole card opens details so dimensions are selected before purchase. */}
          <span className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-lg bg-white text-brand-navy border border-brand-mist" aria-hidden="true">
            <ArrowLeft size={20} />
          </span>

          {/* Sale badge - top right corner */}
          {isOnSale && (
            <div className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-brand-navy px-2 py-1 shadow-lg @[280px]:right-4 @[280px]:top-4 @[280px]:gap-1.5 @[280px]:px-3 @[280px]:py-1.5">
              <Tag size={12} className="shrink-0 text-white @[280px]:size-4" />
              <span className="font-persian text-[9px] font-bold text-white @[280px]:text-xs">
                {toPersianNumber(product.off_percentage)}٪ تخفیف
              </span>
            </div>
          )}

          {/* Warranty badge */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg border border-brand-mist bg-white/95 px-2 py-1 backdrop-blur-md @[280px]:bottom-4 @[280px]:right-4 @[280px]:gap-2 @[280px]:px-4 @[280px]:py-2">
            <ShieldCheck
              size={14}
              className="shrink-0 text-status-success @[280px]:size-4"
            />
            <span className="font-persian text-[10px] font-medium text-brand-navy @[280px]:text-xs">
              {warrantyText}
            </span>
          </div>

          {/* Category marker — replaces the old hardcoded moon icon so a pillow
              no longer wears a mattress badge. */}
          
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-4 md:p-6">
          <h3 className="line-clamp-2 mb-1 font-persian text-xl font-semibold leading-8 text-brand-navy @[280px]:mb-2">
            {product.name}
          </h3>

          {/* min-height, not a fixed height: two clamped lines of Vazirmatn are
              taller than the old 2.8rem box, so descenders were being clipped.
              The floor still keeps every card in a row the same height. */}
          <p className="line-clamp-2 mb-2 min-h-[2.9rem] font-persian text-xs leading-[1.7] text-text-secondary @[280px]:line-clamp-3 @[280px]:mb-3 @[280px]:min-h-[4rem] @[280px]:text-[0.925rem] @[280px]:leading-[1.9]">
            {toPersianDigitsInText(product.subtitle)}
          </p>

          {/* Divider row — half-width line on the right, stars fill the left */}
          <div className="mb-1 flex items-center gap-3">
            <div className="h-px w-1/2 bg-brand-mist" />
            {/* The five glyphs are decorative; the score is announced once as
                text so a screen reader doesn't read "star" five times. */}
            {hasReviews ? (
              <div
                dir="ltr"
                role="img"
                aria-label={`امتیاز ${toPersianNumber(stars)} از ۵ از ${toPersianNumber(reviewCount)} نظر`}
                className="flex flex-1 items-center justify-end gap-0.5"
              >
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star
                    key={i}
                    size={14}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className={
                      i < stars
                        ? "fill-brand-navy text-brand-navy @[280px]:size-4"
                        : "fill-brand-mist text-brand-mist @[280px]:size-4"
                    }
                  />
                ))}
              </div>
            ) : (
              <span className="flex-1 text-right font-persian text-[11px] text-text-secondary">
                بدون نظر
              </span>
            )}
          </div>

          {/* Price — full width below the divider. mt-auto pins it to the card
              floor so prices line up across a row even when titles wrap to
              different heights. */}
          <div dir="rtl" className="mt-auto min-w-0 pt-1 text-center">
            <p className="truncate font-persian text-[0.65rem] font-medium text-text-secondary">
              قیمت
            </p>
            {isOnSale ? (
              <div className="flex flex-col items-center -mt-0.5">
                <p className="tnum truncate font-persian text-xs font-medium text-text-secondary line-through decoration-status-error @[280px]:text-sm">
                  {formatPersianPrice(product.price)}
                  <span className="mr-1 text-[10px] @[280px]:text-xs">
                    تومان
                  </span>
                </p>
                <p className="tnum truncate font-persian text-base font-bold text-brand-navy @[280px]:text-2xl">
                  {formatPersianPrice(discountPrice)}
                  <span className="mr-1 text-xs font-normal text-brand-navy @[280px]:text-base">
                    تومان
                  </span>
                </p>
              </div>
            ) : (
              <div className="mt-0.5">
                <p className="tnum truncate font-persian text-base font-bold text-brand-navy @[280px]:text-2xl">
                  {hasVariablePricing && (
                    <span className="ml-1 text-xs font-normal text-text-secondary @[280px]:text-base">
                      از
                    </span>
                  )}
                  {formatPersianPrice(product.price)}
                  <span className="mr-1 text-xs font-normal text-text-secondary @[280px]:text-base">
                    تومان
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Category-specific quick signals, shown only when authored. */}
          {(product.material || product.is_washable) && (
            <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
              {product.material && (
                <span className="rounded-full bg-brand-warm-white px-2 py-0.5 font-persian text-[9px] font-medium text-text-secondary @[280px]:text-[11px]">
                  {product.material}
                </span>
              )}
              {product.is_washable && (
                <span className="inline-flex items-center gap-1 rounded-full bg-status-success-bg px-2 py-0.5 font-persian text-[9px] font-medium text-status-success @[280px]:text-[11px]">
                  <Droplets size={9} className="shrink-0" />
                  قابل شستشو
                </span>
              )}
            </div>
          )}
        </div>
        <span className="mx-4 mb-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-brand-navy px-6 text-base font-semibold text-brand-navy md:mx-6 md:mb-6">مشاهدهٔ مدل <ArrowLeft size={18} aria-hidden="true" /></span>
      </article>
    </Link>
  );
}
