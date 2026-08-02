import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import api from "../api";
import ProductCard from "../components/product/ProductCard";
import PageBackground from "../components/PageBackground";
import {
  CATEGORY_BY_KEY,
  PRODUCT_CATEGORIES,
  isValidCategory,
} from "../config/productCategories";

/**
 * Listing page for one product category — /products/:category.
 *
 * Replaces the old Mattress.jsx: same layout and grid, but the heading, blurb,
 * and API filter all come from the route's category instead of being hardcoded
 * to mattresses.
 */

// Shared by the skeleton and the real grid so the two can't drift apart. The
// md step matters: 2→4 columns straight from phone to desktop left tablet
// users with two very wide cards.
const GRID =
  "grid grid-cols-2 gap-3 sm:gap-8 md:grid-cols-3 lg:grid-cols-4";

export default function ProductList() {
  const { category } = useParams();
  const valid = isValidCategory(category);
  const meta = CATEGORY_BY_KEY[category];

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Don't spend a request on a category that cannot exist.
    if (!valid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .get("/api/mattress/", { params: { category } })
      .then((res) => setProducts(res.data))
      .catch(() => setError("بارگذاری محصولات با خطا مواجه شد."))
      .finally(() => setLoading(false));
  }, [category, valid]);

  if (!valid) {
    return (
      <section className="relative min-h-screen overflow-hidden bg-[#F5F7FA] pt-[var(--navbar-height)]">
        <PageBackground />
        <div
          className="relative mx-auto max-w-[1120px] px-6 py-16 text-center"
          dir="rtl"
        >
          <h1 className="font-persian text-2xl font-bold text-[#003087]">
            این دسته‌بندی وجود ندارد
          </h1>
          <p className="mt-3 font-persian text-sm text-[#687173]">
            آدرس وارد شده معتبر نیست. از میان دسته‌بندی‌های زیر انتخاب کنید:
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {PRODUCT_CATEGORIES.map((c) => (
              <Link
                key={c.key}
                to={`/products/${c.key}`}
                className="inline-flex items-center gap-2 rounded-lg border border-[#CBD2D6] bg-white px-4 py-2 font-persian text-sm font-medium text-[#003087] shadow-[0_1px_4px_rgba(0,48,135,0.06)] transition hover:-translate-y-0.5 hover:border-[#009CDE] hover:shadow-[0_4px_16px_rgba(0,48,135,0.1)]"
              >
                <c.icon size={15} strokeWidth={2} />
                {c.label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#F5F7FA] pt-[var(--navbar-height)]">
      <PageBackground />

      <div className="relative mx-auto max-w-[1120px] px-6 py-10 sm:py-16">
        <header className="mb-12" dir="rtl">
          <Link
            to="/products"
            className="mb-6 inline-flex items-center gap-2 font-persian text-sm font-medium text-[#003087] transition-colors hover:text-[#009CDE]"
          >
            <ArrowRight size={16} />
            همه محصولات
          </Link>
          <p className="font-sans text-sm uppercase tracking-[0.3em] text-[#687173]">
            {meta.en}
          </p>
          <h1 className="mt-2 font-persian text-3xl font-bold text-[#003087] md:text-4xl">
            {meta.heading}
          </h1>
          <hr className="mt-4 w-24 border-t-2 border-[#003087]" />
          <p className="mt-4 max-w-xl font-persian text-base text-[#687173]">
            {meta.blurb}
          </p>
        </header>

        {/* Skeleton cards in the real grid, rather than a centred one-line
            "loading…" that collapses the page and then shoves the grid in. */}
        {loading && (
          <div className={GRID}>
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse overflow-hidden rounded-xl border border-[#CBD2D6] bg-white"
              >
                <div className="aspect-[4/3] w-full bg-[#CBD2D6]" />
                <div className="space-y-2 p-3 sm:p-6">
                  <div className="h-4 w-4/5 rounded bg-[#CBD2D6]" />
                  <div className="h-3 w-full rounded bg-[#E5E9EB]" />
                  <div className="h-3 w-2/3 rounded bg-[#E5E9EB]" />
                  <div className="mt-3 h-5 w-1/2 rounded bg-[#CBD2D6]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="font-persian text-center text-[#D20000]">{error}</p>
        )}

        {!loading && !error && products.length === 0 && (
          <p className="font-persian text-center text-[#687173]">
            محصولی یافت نشد.
          </p>
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
