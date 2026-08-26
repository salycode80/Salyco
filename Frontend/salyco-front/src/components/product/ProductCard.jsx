import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Star, Plus, Check, Tag, Droplets } from "lucide-react";
import { getProductImageUrl } from "../../utils/productImage";
import { toPersianNumber, formatPersianPrice } from "../../utils/persian";
import { CATEGORY_BY_KEY, productUrl } from "../../config/productCategories";
import { useCart } from "../../context/CartContext";

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
  const CategoryIcon = meta.icon;

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
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const discountPrice = product.discount_price ?? null;
  const isOnSale =
    product.is_on_off && product.off_percentage > 0 && discountPrice != null;

  // "از" (from) only makes sense when sizes are priced separately. A pillow has
  // one price, so the prefix would be misleading.
  const hasVariablePricing = meta.sizeMode !== "none";

  // Quick-add the base product (no size chosen) straight from the gallery card.
  const handleAdd = async (e) => {
    // The card is wrapped in a <Link>; keep the click from navigating.
    e.preventDefault();
    e.stopPropagation();
    // Show feedback optimistically so it appears instantly on the logged-in
    // path too (server add awaits a network round-trip). Revert if it fails.
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
    try {
      await addItem(product, null, 1);
    } catch {
      setAdded(false);
    }
  };

  return (
    <Link
      to={productUrl(product)}
      // Inline by default, so the card didn't fill its grid cell and the focus
      // ring hugged the text rather than the card. h-full evens out row heights.
      className="block h-full rounded-xl"
    >
      <article
        dir="rtl"
        className="@container group flex h-full flex-col overflow-hidden rounded-xl border border-[#CBD2D6] bg-white shadow-[0_1px_4px_rgba(0,48,135,0.06)] transition-all duration-300 ease-out hover:-translate-y-1 hover:border-[#003087]/25 hover:shadow-[0_4px_16px_rgba(0,48,135,0.1)]"
      >
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-[#003087]">
          <img
            src={imageSrc}
            alt={product.name}
            loading="lazy"
            decoding="async"
            onError={() => setImageSrc("/matress.png")}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#003087]/60 via-[#003087]/5 to-transparent" />

          {/* Quick add-to-cart — 44px so it clears the minimum touch target. */}
          <button
            type="button"
            onClick={handleAdd}
            aria-label={`افزودن ${product.name} به سبد خرید`}
            className={`absolute left-2 bottom-2 flex h-11 w-11 items-center justify-center rounded-full shadow-[0_4px_16px_rgba(0,48,135,0.1)] transition-all @[280px]:left-4 @[280px]:bottom-4 ${
              added
                ? "bg-[#019C34] text-white"
                : "bg-white text-[#003087] hover:bg-[#003087] hover:text-white"
            }`}
          >
            {added ? <Check size={18} /> : <Plus size={18} />}
          </button>

          {/* Sale badge - top right corner */}
          {isOnSale && (
            <div className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-[#D20000] px-2 py-1 shadow-lg @[280px]:right-4 @[280px]:top-4 @[280px]:gap-1.5 @[280px]:px-3 @[280px]:py-1.5">
              <Tag size={12} className="shrink-0 text-white @[280px]:size-4" />
              <span className="font-persian text-[9px] font-bold text-white @[280px]:text-xs">
                {toPersianNumber(product.off_percentage)}٪ تخفیف
              </span>
            </div>
          )}

          {/* Warranty badge */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2 py-1 backdrop-blur-md @[280px]:bottom-4 @[280px]:right-4 @[280px]:gap-2 @[280px]:px-4 @[280px]:py-2">
            <ShieldCheck
              size={14}
              className="shrink-0 text-[#019C34] @[280px]:size-4"
            />
            <span className="font-persian text-[10px] font-medium tracking-wide text-white @[280px]:text-xs">
              {warrantyText}
            </span>
          </div>

          {/* Category marker — replaces the old hardcoded moon icon so a pillow
              no longer wears a mattress badge. */}
          <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white/90 backdrop-blur-sm @[280px]:left-4 @[280px]:top-4 @[280px]:h-8 @[280px]:w-8">
            <CategoryIcon size={14} strokeWidth={1.75} />
          </span>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col px-3 py-3 @[280px]:px-6 @[280px]:py-6">
          <h3 className="line-clamp-2 mb-1 font-persian text-sm font-semibold leading-snug text-[#003087] @[280px]:mb-2 @[280px]:text-[1.35rem]">
            {product.name}
          </h3>

          {/* min-height, not a fixed height: two clamped lines of Vazirmatn are
              taller than the old 2.8rem box, so descenders were being clipped.
              The floor still keeps every card in a row the same height. */}
          <p className="line-clamp-2 mb-2 min-h-[2.9rem] font-persian text-xs leading-[1.7] text-[#687173] @[280px]:line-clamp-3 @[280px]:mb-3 @[280px]:min-h-[4rem] @[280px]:text-[0.925rem] @[280px]:leading-[1.9]">
            {product.subtitle}
          </p>

          {/* Divider row — half-width line on the right, stars fill the left */}
          <div className="mb-1 flex items-center gap-3">
            <div className="h-px w-1/2 bg-[#CBD2D6]" />
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
                        ? "fill-[#F5BA2E] text-[#F5BA2E] @[280px]:size-4"
                        : "fill-[#E5E9EB] text-[#E5E9EB] @[280px]:size-4"
                    }
                  />
                ))}
              </div>
            ) : (
              <span className="flex-1 text-right font-persian text-[11px] text-[#687173]">
                بدون نظر
              </span>
            )}
          </div>

          {/* Price — full width below the divider. mt-auto pins it to the card
              floor so prices line up across a row even when titles wrap to
              different heights. */}
          <div dir="rtl" className="mt-auto min-w-0 pt-1 text-center">
            <p className="truncate font-persian text-[0.65rem] font-medium tracking-[0.05em] text-[#687173]">
              قیمت
            </p>
            {isOnSale ? (
              <div className="flex flex-col items-center -mt-0.5">
                <p className="tnum truncate font-persian text-xs font-medium text-[#687173] line-through decoration-[#D20000] @[280px]:text-sm">
                  {formatPersianPrice(product.price)}
                  <span className="mr-1 text-[10px] @[280px]:text-xs">
                    تومان
                  </span>
                </p>
                <p className="tnum truncate font-persian text-base font-bold text-[#003087] @[280px]:text-2xl">
                  {formatPersianPrice(discountPrice)}
                  <span className="mr-1 text-xs font-normal text-[#003087] @[280px]:text-base">
                    تومان
                  </span>
                </p>
              </div>
            ) : (
              <div className="mt-0.5">
                <p className="tnum truncate font-persian text-base font-bold text-[#003087] @[280px]:text-2xl">
                  {hasVariablePricing && (
                    <span className="ml-1 text-xs font-normal text-[#687173] @[280px]:text-base">
                      از
                    </span>
                  )}
                  {formatPersianPrice(product.price)}
                  <span className="mr-1 text-xs font-normal text-[#687173] @[280px]:text-base">
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
                <span className="rounded-full bg-[#F5F7FA] px-2 py-0.5 font-persian text-[9px] font-medium text-[#687173] @[280px]:text-[11px]">
                  {product.material}
                </span>
              )}
              {product.is_washable && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#E6F4EA] px-2 py-0.5 font-persian text-[9px] font-medium text-[#019C34] @[280px]:text-[11px]">
                  <Droplets size={9} className="shrink-0" />
                  قابل شستشو
                </span>
              )}
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
