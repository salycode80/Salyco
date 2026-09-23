import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import api from "../api";
import ProductCard from "../components/product/ProductCard";
import PageBackground from "../components/PageBackground";
import { PRODUCT_CATEGORIES } from "../config/productCategories";

/**
 * Combined catalogue at /products — category cards above every product.
 * The API filter is opt-in, so an unfiltered request returns all categories.
 */

// Shared by the skeleton and the real grid so the two can't drift apart. The
// md step matters: 2→4 columns straight from phone to desktop left tablet
// users with two very wide cards.
const GRID =
  "grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3";

export default function ProductsIndex() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get("/api/mattress/")
      .then((res) => setProducts(res.data))
      .catch(() => setError("بارگذاری محصولات با خطا مواجه شد."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="relative min-h-screen overflow-hidden bg-brand-warm-white pt-[var(--navbar-height)]">
      <PageBackground />

      <div className="relative mx-auto max-w-[1120px] px-6 py-10 sm:py-16">
        <header className="mb-10" dir="rtl">
          <p className="font-sans text-sm uppercase tracking-[0.3em] text-text-secondary">
            Products
          </p>
          <h1 className="mt-2 font-persian text-3xl font-bold text-brand-navy md:text-4xl">
            محصولات سالیکو
          </h1>
          <hr className="mt-4 w-24 border-t-2 border-brand-navy" />
          <p className="mt-4 max-w-xl font-persian text-base text-text-secondary">
            از تشک و باکس تخت خواب تا بالش، روتختی و تاپر — همه آنچه برای خوابی
            آرام نیاز دارید.
          </p>
        </header>

        {/* Category cards */}
        <div
          className="mb-14 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-5"
          dir="rtl"
        >
          {PRODUCT_CATEGORIES.map(({ key, label, en, icon: Icon }) => (
            <Link
              key={key}
              to={`/products/${key}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-brand-mist bg-white shadow-[0_1px_4px_rgba(5,46,95,0.06)] transition-all duration-200  hover:border-brand-navy hover:shadow-[0_4px_16px_rgba(5,46,95,0.1)]"
            >
              <div className="flex h-24 items-center justify-center bg-brand-navy transition-colors duration-200 group-hover:bg-action-hover">
                <Icon size={30} strokeWidth={1.5} className="text-white" />
              </div>
              <div className="flex flex-col p-3.5">
                <p className="font-sans text-[0.65rem] uppercase tracking-[0.2em] text-text-secondary">
                  {en}
                </p>
                <h2 className="mt-1 font-persian text-sm font-bold text-text-primary">
                  {label}
                </h2>
              </div>
            </Link>
          ))}
        </div>

        {/* All products */}
        <header className="mb-8 flex items-end justify-between" dir="rtl">
          <div>
            <h2 className="font-persian text-2xl font-bold text-brand-navy">
              همه محصولات
            </h2>
            <hr className="mt-3 w-16 border-t-2 border-brand-mist" />
          </div>
        </header>

        {/* Skeleton cards in the real grid, so the page keeps its shape while
            the request is in flight instead of collapsing to one line. */}
        {loading && (
          <div className={GRID}>
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse overflow-hidden rounded-xl border border-brand-mist bg-white"
              >
                <div className="aspect-[4/3] w-full bg-brand-mist" />
                <div className="space-y-2 p-3 sm:p-6">
                  <div className="h-4 w-4/5 rounded bg-brand-mist" />
                  <div className="h-3 w-full rounded bg-brand-mist" />
                  <div className="h-3 w-2/3 rounded bg-brand-mist" />
                  <div className="mt-3 h-5 w-1/2 rounded bg-brand-mist" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="font-persian text-center text-status-error">{error}</p>
        )}

        {!loading && !error && products.length === 0 && (
          <div className="text-center" dir="rtl">
            <p className="font-persian text-text-secondary">محصولی یافت نشد.</p>
            <Link
              to="/products/mattress"
              className="mt-4 inline-flex items-center gap-2 font-persian text-sm font-medium text-brand-navy hover:text-brand-navy"
            >
              مشاهده تشک‌ها
              <ArrowLeft size={16} />
            </Link>
          </div>
        )}

        {!loading && products.length > 0 && (
          <div className={GRID}>
            {products.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
