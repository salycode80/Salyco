import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import api from "../api";
import ProductCard from "./product/ProductCard";

/**
 * FeaturedProducts — a short, user-friendly preview of the catalogue shown on
 * the home page. Pulls the first few products from the API (unfiltered, so the
 * mix spans every category) and drops them into the same ProductCard used on the
 * products pages so the look stays consistent.
 */
export default function FeaturedProducts() {
  const [mattresses, setMattresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const trackRef = useRef(null);

  useEffect(() => {
    api
      .get("/api/mattress/")
      .then((res) => setMattresses(res.data.slice(0, 8)))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // Product browsing stays still until the customer scrolls the track.

  // Hide the whole section if there is nothing to show.
  if (!loading && (error || mattresses.length === 0)) return null;

  return (
    <section className="relative overflow-hidden bg-white">
      <div className="relative mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-20">
        <header
          className="mb-12 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end"
          dir="rtl"
        >
          <div>
            <p className="font-sans text-sm uppercase tracking-[0.3em] text-brand-navy">
              Products
            </p>
            <h2 className="mt-2 font-persian text-3xl font-bold text-brand-navy md:text-4xl">
              منتخب محصولات سالیکو
            </h2>
            <hr className="mt-4 w-24 border-t-2 border-brand-navy" />
            <p className="mt-4 max-w-xl font-persian text-base text-text-secondary">
              گلچینی از محبوب‌ترین محصولات ما؛ برای دیدن همه محصولات وارد گالری
              شوید.
            </p>
          </div>

          <Link
            to="/products"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border-2 border-brand-navy bg-white px-5 py-2.5 font-persian text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-navy/5"
          >
            مشاهده همه
            <ArrowLeft size={16} />
          </Link>
        </header>

        {loading ? (
          <div className="flex gap-3 overflow-hidden sm:gap-6">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-[240px] w-full md:w-[calc((100%-1.5rem)/2)] shrink-0 animate-pulse rounded-xl bg-brand-mist sm:h-[420px] lg:w-[calc((100%-3rem)/3)]"
              />
            ))}
          </div>
        ) : (
          <div
            ref={trackRef}
            className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-6"
          >
            {mattresses.map((mattress) => (
              <div
                key={mattress.slug}
                className="w-full md:w-[calc((100%-1.5rem)/2)] shrink-0 snap-start lg:w-[calc((100%-3rem)/3)]"
              >
                <ProductCard product={mattress} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
