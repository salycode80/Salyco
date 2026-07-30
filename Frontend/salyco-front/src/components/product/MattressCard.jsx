import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Moon, Star, Plus, Check, Tag } from "lucide-react";
import { getProductImageUrl } from "../../utils/productImage";
import { useCart } from "../../context/CartContext";

// Persian number converter
const toPersianNumber = (num) => {
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return num.toString().replace(/\d/g, (d) => persianDigits[parseInt(d)]);
};

// Format price in Persian style
const formatPersianPrice = (price) => {
  return toPersianNumber(Number(price).toLocaleString());
};

export default function MattressCard({ mattress }) {
  const warrantyYears = Math.round(mattress.warranty_months / 12);
  // `rating` is the server-side display score: the approved-review average, or
  // 5 for a product nobody has reviewed yet. Fall back to 5 here too, so an
  // older cached API response can't render an unrated product as zero stars.
  const stars = Math.round(Number(mattress.rating ?? 5));
  const [imageSrc, setImageSrc] = useState(getProductImageUrl(mattress.image));
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const discountPrice = mattress.discount_price ?? null;
  const isOnSale =
    mattress.is_on_off && mattress.off_percentage > 0 && discountPrice != null;

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
      await addItem(mattress, null, 1);
    } catch {
      setAdded(false);
    }
  };

  return (
    <Link to={`/products/mattress/${mattress.slug}`}>
      <article
        dir="rtl"
        className="@container group flex flex-col overflow-hidden rounded-xl border border-[#CBD2D6] bg-white shadow-[0_1px_4px_rgba(0,48,135,0.06)] transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-[0_4px_16px_rgba(0,48,135,0.1)]"
      >
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-[#003087]">
          <img
            src={imageSrc}
            alt={mattress.name}
            onError={() => setImageSrc("/matress.png")}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#003087]/60 via-[#003087]/5 to-transparent" />

          {/* Quick add-to-cart */}
          <button
            type="button"
            onClick={handleAdd}
            aria-label="افزودن به سبد خرید"
            className={`absolute left-2 bottom-2 flex h-9 w-9 items-center justify-center rounded-full shadow-[0_4px_16px_rgba(0,48,135,0.1)] transition-all @[280px]:left-4 @[280px]:bottom-4 @[280px]:h-10 @[280px]:w-10 ${
              added
                ? "bg-[#019C34] text-white"
                : "bg-white text-[#003087] hover:bg-[#003087] hover:text-white"
            }`}
          >
            {added ? <Check size={18} /> : <Plus size={18} />}
          </button>

          {/* Sale badge - top right corner */}
          {isOnSale && (
            <div className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-red-500 px-2 py-1 shadow-lg @[280px]:right-4 @[280px]:top-4 @[280px]:gap-1.5 @[280px]:px-3 @[280px]:py-1.5">
              <Tag size={12} className="shrink-0 text-white @[280px]:size-4" />
              <span className="font-persian text-[9px] font-bold text-white @[280px]:text-xs">
                {toPersianNumber(mattress.off_percentage)}٪ تخفیف
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
              {toPersianNumber(warrantyYears)} سال گارانتی
            </span>
          </div>

          <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white/90 backdrop-blur-sm @[280px]:left-4 @[280px]:top-4 @[280px]:h-8 @[280px]:w-8">
            <Moon size={14} strokeWidth={1.75} />
          </span>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col px-3 py-3 @[280px]:px-6 @[280px]:py-6">
          <h3 className="line-clamp-2 mb-1 font-persian font-[600] text-sm leading-snug tracking-tight text-[#003087] @[280px]:mb-2 @[280px]:text-[1.35rem]">
            {mattress.name}
          </h3>

          <p className="line-clamp-2 mb-2 h-[2.8rem] font-persian text-xs leading-[1.7] text-[#687173] @[280px]:line-clamp-3 @[280px]:mb-3 @[280px]:h-[3.8rem] @[280px]:text-[0.925rem] @[280px]:leading-[1.9]">
            {mattress.subtitle}
          </p>

          {/* Divider row — half-width line on the right, stars fill the left */}
          <div className="mb-1 flex items-center gap-3">
            <div className="h-px w-1/2 bg-[#CBD2D6]" />
            <div
              dir="ltr"
              className="flex flex-1 items-center justify-end gap-0.5"
            >
              {[0, 1, 2, 3, 4].map((i) => (
                <Star
                  key={i}
                  size={14}
                  strokeWidth={1.5}
                  className={
                    i < stars
                      ? "fill-[#F5B301] text-[#F5B301] @[280px]:size-4"
                      : "fill-[#E5E9EB] text-[#E5E9EB] @[280px]:size-4"
                  }
                />
              ))}
            </div>
          </div>

          {/* Price — full width below the divider */}
          <div dir="rtl" className="min-w-0 pt-1 text-center h-[3.5rem]">
            <p className="truncate text-[0.65rem] font-medium tracking-[0.05em] text-[#687173]">
              قیمت / Price
            </p>
            {isOnSale ? (
              <div className="flex flex-col items-center -mt-0.5">
                <p className="truncate font-persian text-xs font-medium text-gray-400 line-through decoration-red-500 @[280px]:text-sm">
                  {formatPersianPrice(mattress.price)}
                  <span className="mr-1 text-[10px] @[280px]:text-xs">
                    تومان
                  </span>
                </p>
                <p className="truncate font-persian text-base font-bold tracking-tight text-[#003087] @[280px]:text-2xl">
                  {formatPersianPrice(discountPrice)}
                  <span className="mr-1 text-xs font-normal text-[#003087] @[280px]:text-base">
                    تومان
                  </span>
                </p>
              </div>
            ) : (
              <div className="mt-0.5">
                <p className="truncate font-persian text-base font-bold tracking-tight text-[#003087] @[280px]:text-2xl">
                  <span className="ml-1 text-xs font-normal text-[#687173] @[280px]:text-base">
                    از
                  </span>
                  {formatPersianPrice(mattress.price)}
                  <span className="mr-1 text-xs font-normal text-[#687173] @[280px]:text-base">
                    تومان
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
