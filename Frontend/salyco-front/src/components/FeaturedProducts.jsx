import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import api from "../api";
import MattressCard from "./product/MattressCard";

/**
 * FeaturedProducts — a short, user-friendly preview of the catalogue shown on
 * the home page. Pulls the first few mattresses from the API and drops them into
 * the same MattressCard used on the products page so the look stays consistent.
 */
export default function FeaturedProducts() {
  const [mattresses, setMattresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get("/api/mattress/")
      .then((res) => setMattresses(res.data.slice(0, 4)))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // Hide the whole section if there is nothing to show.
  if (!loading && (error || mattresses.length === 0)) return null;

  return (
    <section className="relative overflow-hidden bg-white">
      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <header
          className="mb-12 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end"
          dir="rtl"
        >
          <div>
            <p className="font-sans text-sm uppercase tracking-[0.3em] text-wood-500/80">
              Products
            </p>
            <h2 className="mt-2 font-persian text-3xl font-bold text-[#000c3e] md:text-4xl">
              منتخب تشک‌های سالیکو
            </h2>
            <hr className="mt-4 w-24 border-t-2 border-wood-400" />
            <p className="mt-4 max-w-xl font-persian text-base text-[#000c3e]/60">
              گلچینی از محبوب‌ترین تشک‌های ما؛ برای دیدن همه محصولات وارد گالری
              شوید.
            </p>
          </div>

          <Link
            to="/products/mattress"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#000c3e]/20 px-5 py-2.5 font-persian text-sm font-semibold text-[#000c3e] transition-colors hover:border-[#000c3e]/40 hover:bg-[#000c3e]/5"
          >
            مشاهده همه
            <ArrowLeft size={16} />
          </Link>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-[420px] animate-pulse rounded-[28px] bg-[#e2e8f0]"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {mattresses.map((mattress) => (
              <MattressCard key={mattress.slug} mattress={mattress} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
