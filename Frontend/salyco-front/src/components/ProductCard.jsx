import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { getProductImageUrl } from "../utils/productImage";

export default function ProductCard({ product }) {
  const warrantyYears = Math.round(product.warranty_months / 12);
  const [imageSrc, setImageSrc] = useState(getProductImageUrl(product.image));

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-blue-400/15 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/30 hover:shadow-lg hover:shadow-blue-900/10">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#000c2e]">
        <img
          src={imageSrc}
          alt={product.name}
          onError={() => setImageSrc("/matress.png")}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#000c2e]/70 via-transparent to-transparent" />
        <span className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-blue-100 backdrop-blur-sm">
          <ShieldCheck size={14} className="text-blue-300" />
          {warrantyYears} سال گارانتی
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5" dir="rtl">
        <h3 className="font-sans text-xl font-bold tracking-wide text-[#000c3e]">
          {product.name}
        </h3>

        <p className="mt-2 line-clamp-3 flex-1 font-persian text-sm leading-relaxed text-[#000c3e]/70">
          {product.description}
        </p>

        <div className="mt-5 flex items-end justify-between border-t border-blue-400/10 pt-4">
          <div className="text-left" dir="ltr">
            <p className="text-xs uppercase tracking-widest text-blue-400/70">
              Price
            </p>
            <p className="font-sans text-2xl font-bold text-[#001a5c]">
              ${Number(product.price).toLocaleString()}
            </p>
          </div>

          {(product.width > 0 || product.length > 0) && (
            <p className="font-persian text-xs text-[#000c3e]/50">
              {product.width} × {product.length} cm
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
