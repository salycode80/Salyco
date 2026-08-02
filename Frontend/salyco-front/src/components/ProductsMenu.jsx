import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, LayoutGrid, ShoppingBag } from "lucide-react";
import { PRODUCT_CATEGORIES } from "../config/productCategories";

/**
 * "محصولات" dropdown for the navbar category row.
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
     font-persian text-sm font-semibold tracking-wide whitespace-nowrap
     transition-all duration-200 ${
       isActive
         ? "bg-[#F5F7FA] text-[#003087]"
         : "text-[#1A1A2E] hover:text-[#003087] hover:bg-[#F5F7FA]"
     }`;

  return (
    <>
      {/* Below lg the category row scrolls horizontally (overflow-x-auto), which
          per spec also clips the y axis — an absolutely-positioned panel would be
          cut off. So narrow viewports get a direct link here and the full
          category list inside the hamburger menu (<ProductsMenuMobile />). */}
      <Link to="/products" className={`${triggerClasses} lg:hidden`}>
        <ShoppingBag size={15} strokeWidth={2} />
        <span>محصولات</span>
      </Link>

      <div
        ref={wrapperRef}
        className="relative hidden lg:block"
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
          className="absolute right-0 top-full z-50 w-64 overflow-hidden rounded-xl border border-[#CBD2D6] bg-white py-1 shadow-[0_4px_16px_rgba(0,48,135,0.1)]"
        >
          {PRODUCT_CATEGORIES.map(({ key, label, en, icon: Icon }) => (
            <Link
              key={key}
              to={`/products/${key}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[#F5F7FA]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#003087]/10 text-[#003087]">
                <Icon size={16} strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="block font-persian text-sm font-medium text-[#1A1A2E]">
                  {label}
                </span>
                <span className="block font-sans text-[10px] uppercase tracking-[0.15em] text-[#687173]">
                  {en}
                </span>
              </span>
            </Link>
          ))}

          <Link
            to="/products"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2 border-t border-[#CBD2D6] px-4 py-2.5 font-persian text-sm font-semibold text-[#003087] transition-colors hover:bg-[#F5F7FA]"
          >
            <LayoutGrid size={15} />
            همه محصولات
          </Link>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Mobile variant: an expandable group for the hamburger panel. The desktop
 * dropdown positions absolutely and would be clipped by the mobile menu's
 * overflow-hidden transition, so the two render differently by design.
 */
export function ProductsMenuMobile({ onNavigate }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-3 font-persian text-sm font-medium text-[#1A1A2E] transition-colors hover:text-[#003087]"
      >
        <span className="flex items-center gap-2">
          <ShoppingBag size={16} className="text-[#687173]" />
          محصولات
        </span>
        <ChevronDown
          size={16}
          className={`text-[#687173] transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="pb-2 pr-6">
          {PRODUCT_CATEGORIES.map(({ key, label, icon: Icon }) => (
            <Link
              key={key}
              to={`/products/${key}`}
              onClick={onNavigate}
              className="flex items-center gap-2 py-2 font-persian text-sm text-[#1A1A2E] transition-colors hover:text-[#003087]"
            >
              <Icon size={14} className="text-[#687173]" />
              {label}
            </Link>
          ))}
          <Link
            to="/products"
            onClick={onNavigate}
            className="flex items-center gap-2 py-2 font-persian text-sm font-semibold text-[#003087]"
          >
            <LayoutGrid size={14} />
            همه محصولات
          </Link>
        </div>
      )}
    </div>
  );
}
