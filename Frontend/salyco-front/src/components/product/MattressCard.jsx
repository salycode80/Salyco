import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Moon } from "lucide-react";
import { getProductImageUrl } from "../../utils/productImage";

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
  const [imageSrc, setImageSrc] = useState(getProductImageUrl(mattress.image));

  return (
    <Link to={`/products/mattress/${mattress.slug}`}>
      <article
        dir="rtl"
        className="group flex flex-col overflow-hidden rounded-xl border border-[#CBD2D6] bg-white shadow-[0_1px_4px_rgba(0,48,135,0.06)] transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-[0_4px_16px_rgba(0,48,135,0.1)]"
      >
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-[#003087]">
          <img
            src={imageSrc}
            alt={mattress.name}
            onError={() => setImageSrc("/matress.png")}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
          {/* soft gradient veil for calm, restful feel */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#003087]/60 via-[#003087]/5 to-transparent" />

          {/* Warranty badge */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2 py-1 backdrop-blur-md sm:bottom-4 sm:right-4 sm:gap-2 sm:px-4 sm:py-2">
            <ShieldCheck
              size={14}
              className="shrink-0 text-[#019C34] sm:size-4"
            />
            <span className="font-persian text-[10px] font-medium tracking-wide text-white sm:text-xs">
              {toPersianNumber(warrantyYears)} سال گارانتی
            </span>
          </div>

          {/* quiet "calm sleep" mark — the signature touch */}
          <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white/90 backdrop-blur-sm sm:left-4 sm:top-4 sm:h-8 sm:w-8">
            <Moon size={14} strokeWidth={1.75} />
          </span>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-2 px-3 py-3 sm:gap-3 sm:px-6 sm:py-6">
          <h3 className="line-clamp-2 min-h-[1lh] font-[600] text-sm leading-snug tracking-tight text-[#003087] sm:text-[1.35rem]">
            {mattress.name}
          </h3>

          <p className="line-clamp-2 min-h-[2lh] flex-1 text-xs leading-[1.7] text-[#687173] sm:line-clamp-3 sm:min-h-[3lh] sm:text-[0.925rem] sm:leading-[1.9]">
            {mattress.description}
          </p>

          {/* gentle divider — drawn thin, not harsh */}
          <div className="mt-1 h-px w-full bg-[#CBD2D6]" />

          <div className="flex items-end justify-between pt-1">
            <div dir="ltr" className="text-left">
              <p className="hidden text-[0.65rem] font-medium uppercase tracking-[0.15em] text-[#687173] sm:block">
                قیمت / Price
              </p>
              <p className="font-persian text-base font-bold tracking-tight text-[#003087] sm:text-2xl">
                {formatPersianPrice(mattress.price)}
                <span className="mr-1 text-xs font-normal text-[#687173] sm:text-base">
                  تومان
                </span>
              </p>
            </div>

            {(mattress.width > 0 || mattress.length > 0) && (
              <p className="hidden rounded-full bg-[#F5F7FA] px-3 py-1 text-xs text-[#687173] sm:block">
                {mattress.width} × {mattress.length} سانتی‌متر
              </p>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
