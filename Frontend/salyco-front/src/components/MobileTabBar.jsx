import { NavLink } from "react-router-dom";
import { Home, ShoppingBag, Search, ShoppingCart } from "lucide-react";
import { useCart } from "../context/CartContext";
import { toPersianNumber } from "../utils/persian";

/**
 * The mobile bottom bar, in place of the navbar.
 *
 * Below lg the navbar is hidden outright (Navbar.jsx is `hidden lg:block`), so
 * this is the persistent navigation a phone has. Four destinations, all of them
 * navigation: the account control is the top bar's (MobileTopBar.jsx), which
 * also owns the sheet this component used to open.
 *
 * It floats rather than spanning edge to edge — inset-x-3, a 26px radius and a
 * shadow on all four sides instead of a hairline top border — so the page reads
 * past it at the margins. That is why --tabbar-height carries the bar's own
 * height *plus* the 0.75rem it floats by plus the home indicator: App.jsx pads
 * the page bottom by the sum, and the footer's last row stays clear of it.
 *
 * Every tab is a 56px-tall pill inside the 72px bar, so the target clears §9's
 * 44×44 minimum with room to spare.
 */

const TABS = [
  // `end` on the home tab, or it would read as active on every route.
  { to: "/", label: "خانه", icon: Home, end: true },
  { to: "/products", label: "محصولات", icon: ShoppingBag },
  { to: "/search", label: "جست‌وجو", icon: Search },
  { to: "/cart", label: "سبد خرید", icon: ShoppingCart },
];

export default function MobileTabBar() {
  const { count: cartCount } = useCart();

  return (
    <nav
      dir="rtl"
      aria-label="ناوبری موبایل"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]
                 z-40 grid h-[72px] grid-cols-4 items-stretch rounded-[26px] bg-white
                 px-1.5 shadow-[0_2px_8px_rgba(5,46,95,0.08),0_12px_28px_-8px_rgba(5,46,95,0.22)]
                 lg:hidden"
    >
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          // The active pill marks the current tab; aria-current (set by NavLink)
          // is what actually announces it, and the weight change is the third
          // signal so selection never rests on colour alone (§5).
          className="flex items-center justify-center font-persian"
        >
          {({ isActive }) => (
            <span
              className={`flex h-14 w-full max-w-[78px] flex-col items-center justify-center
                          gap-1 rounded-[24px] text-sm transition-colors duration-200 ${
                            isActive
                              ? "bg-brand-navy/[0.07] font-semibold text-brand-navy"
                              : "font-medium text-text-secondary"
                          }`}
            >
              {to === "/cart" ? (
                <span className="relative">
                  <Icon size={22} strokeWidth={1.9} aria-hidden="true" />
                  {cartCount > 0 && (
                    <span className="absolute -left-2 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-navy px-1 text-[10px] font-bold text-white">
                      {cartCount > 99 ? "۹۹+" : toPersianNumber(cartCount)}
                    </span>
                  )}
                </span>
              ) : (
                <Icon size={22} strokeWidth={1.9} aria-hidden="true" />
              )}
              <span>{label}</span>
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
