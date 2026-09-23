import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, LayoutGrid, ShoppingBag } from "lucide-react";
import { PRODUCT_CATEGORIES } from "../config/productCategories";

/**
 * "محصولات" dropdown for the navbar category row.
 *
 * Desktop-only, like the row itself. On a phone the catalogue is the tab bar's
 * محصولات tab, which lands on /products.
 *
 * Opens on hover for pointer users and on click/Enter for everyone else, so the
 * menu is reachable by keyboard and on touch (where hover does not exist).
 * Closes on Escape, outside click, and route change — the same click-outside
 * pattern the user avatar menu in Navbar.jsx uses.
 */
export default function ProductsMenu() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const location = useLocation();

  const isActive = location.pathname.startsWith("/products");

  // Close whenever the route changes — otherwise the panel stays open over the
  // page you just navigated to.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const triggerClasses = `flex items-center gap-2 rounded-lg px-3 py-1.5 sm:px-4
     font-persian text-sm font-semibold whitespace-nowrap
     transition-all duration-200 ${
       isActive
         ? "bg-brand-warm-white text-brand-navy"
         : "text-text-primary hover:text-brand-navy hover:bg-brand-warm-white"
     }`;

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        // Enter/Space activate a <button> natively (toggling the panel); ArrowDown
        // is the conventional "open and step in" key for a menu button.
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={triggerClasses}
      >
        <ShoppingBag size={15} strokeWidth={2} />
        <span>محصولات</span>
        <ChevronDown
          size={13}
          className={`transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          dir="rtl"
          className="absolute right-0 top-full z-50 w-64 overflow-hidden rounded-xl border border-brand-mist bg-white py-1 shadow-[0_4px_16px_rgba(5,46,95,0.1)]"
        >
          {PRODUCT_CATEGORIES.map(({ key, label, en, icon: Icon }) => (
            <Link
              key={key}
              to={`/products/${key}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-brand-warm-white"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-navy/10 text-brand-navy">
                <Icon size={16} strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="block font-persian text-sm font-medium text-text-primary">
                  {label}
                </span>
                <span className="block font-sans text-[10px] uppercase tracking-[0.15em] text-text-secondary">
                  {en}
                </span>
              </span>
            </Link>
          ))}

          <Link
            to="/products"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2 border-t border-brand-mist px-4 py-2.5 font-persian text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-warm-white"
          >
            <LayoutGrid size={15} />
            همه محصولات
          </Link>
        </div>
      )}
    </div>
  );
}
