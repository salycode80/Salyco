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
          <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-md px-4 py-2 border border-white/20">
            <ShieldCheck size={16} className="text-[#019C34]" />
            <span className="font-persian text-xs font-medium text-white tracking-wide">
              {toPersianNumber(warrantyYears)} سال گارانتی
            </span>
          </div>

          {/* quiet "calm sleep" mark — the signature touch */}
          <span className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white/90 backdrop-blur-sm">
            <Moon size={14} strokeWidth={1.75} />
          </span>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-3 px-6 py-6">
          <h3 className="font-[600] text-[1.35rem] leading-snug tracking-tight text-[#003087]">
            {mattress.name}
          </h3>

          <p className="line-clamp-3 flex-1 text-[0.925rem] leading-[1.9] text-[#687173]">
            {mattress.description}
          </p>

          {/* gentle divider — drawn thin, not harsh */}
          <div className="mt-1 h-px w-full bg-[#CBD2D6]" />

          <div className="flex items-end justify-between pt-1">
            <div dir="ltr" className="text-left">
              <p className="text-[0.65rem] font-medium uppercase tracking-[0.15em] text-[#687173]">
                قیمت / Price
              </p>
              <p className="font-persian text-2xl font-bold text-[#003087] tracking-tight">
                {formatPersianPrice(mattress.price)}
                <span className="text-base font-normal text-[#687173] mr-1">
                  تومان
                </span>
              </p>
            </div>

            {(mattress.width > 0 || mattress.length > 0) && (
              <p className="rounded-full bg-[#F5F7FA] px-3 py-1 text-xs text-[#687173]">
                {mattress.width} × {mattress.length} سانتی‌متر
              </p>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
