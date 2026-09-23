import { Link } from "react-router-dom";
import { PRODUCT_CATEGORIES } from "../config/productCategories";

/**
 * Home-page category grid. Every category is now a live product line, so these
 * are real links — the greyscale treatment and "به زودی" overlay they used to
 * carry are gone.
 */
export default function CategoriesSection() {
  return (
    <section className="relative overflow-hidden bg-white py-16">
      <div className="relative mx-auto max-w-[1200px] px-6">
        <header className="mb-10" dir="rtl">
          <p className="font-sans text-sm uppercase tracking-[0.3em] text-text-secondary">
            Categories
          </p>
          <h2 className="mt-2 font-persian text-2xl font-bold text-text-primary md:text-3xl">
            دسته‌بندی‌های اصلی
          </h2>
          <hr className="mt-4 w-20 border-t-2 border-brand-mist" />
        </header>

        <div
          className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-5"
          dir="rtl"
        >
          {PRODUCT_CATEGORIES.map(({ key, label, en, icon: Icon }) => (
            <Link
              key={key}
              to={`/products/${key}`}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-brand-mist bg-white shadow-[0_1px_4px_rgba(5,46,95,0.06)] transition-all duration-200  hover:border-brand-navy hover:shadow-[0_4px_16px_rgba(5,46,95,0.1)]"
            >
              <div className="relative flex h-24 items-center justify-center bg-brand-navy transition-colors duration-200 group-hover:bg-action-hover">
                <Icon
                  size={30}
                  strokeWidth={1.5}
                  className="relative text-white"
                />
              </div>

              <div className="flex flex-col p-3.5">
                <p className="font-sans text-[0.65rem] uppercase tracking-[0.2em] text-text-secondary">
                  {en}
                </p>
                <h3 className="mt-1 font-persian text-sm font-bold text-text-primary transition-colors duration-200 group-hover:text-brand-navy">
                  {label}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
