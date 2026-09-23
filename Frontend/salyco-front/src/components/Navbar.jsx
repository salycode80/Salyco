import { useState, useEffect, useRef } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/UseAuth";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { toPersianNumber } from "../utils/persian";
import { getDisplayName, getPhoneNumber } from "../utils/user";
import api from "../api";
import SearchBar from "./SearchBar";
import ProductsMenu from "./ProductsMenu";
import {
  Phone,
  UserCircle,
  User,
  BookOpen,
  Info,
  LogOut,
  ClipboardList,
  LayoutDashboard,
  ChevronDown,
  MapPin,
  ShoppingCart,
} from "lucide-react";

// The products entry is a hover/click dropdown listing all five categories, so
// it is flagged rather than given a `to` — the category row renders it as
// <ProductsMenu /> instead of a NavLink.
const categories = [
  { type: "menu", key: "products" },
  { label: "راهنمای انتخاب", icon: BookOpen, to: "/articles" },
  { label: "خدمات پس از فروش", icon: ClipboardList, to: "/warranty/my" },
  { label: "نمایندگی", icon: MapPin, to: "/dealers" },
  { label: "تماس با ما", icon: Phone, to: "/contact" },
  { label: "درباره ما", icon: Info, to: "/about" },
];

/**
 * Desktop navigation.
 *
 * Below lg this renders nothing at all: the header is `hidden lg:block` and
 * MobileTabBar takes over, so every mobile path that used to live here — the
 * hamburger panel, the mobile cart button, the mobile category list — is gone
 * rather than merely hidden. Account links and the secondary pages are in
 * AccountSheet; the catalogue is the tab bar's محصولات tab.
 */
export default function Navbar() {
  const { isAuthenticated, logout } = useAuth();
  const { count: cartCount } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setUser(null);
      return;
    }
    api
      .get("/api/user/me/")
      .then((res) => setUser(res.data))
      .catch(() => {});
  }, [isAuthenticated]);

  // Close the dropdown when clicking outside of it
  useEffect(() => {
    function handleClickOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // A navigation from inside the dropdown would otherwise leave it painted over
  // the page it just opened. Adjusted during render rather than in an effect:
  // React re-runs the render immediately without committing the stale menu.
  const routeKey = `${location.pathname}${location.search}`;
  const [prevRouteKey, setPrevRouteKey] = useState(routeKey);
  if (prevRouteKey !== routeKey) {
    setPrevRouteKey(routeKey);
    setIsUserMenuOpen(false);
  }

  // Escape closes the dropdown — expected for any dismissible overlay.
  useEffect(() => {
    if (!isUserMenuOpen) return;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      setIsUserMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isUserMenuOpen]);

  const handleLogout = () => {
    logout();
    setIsUserMenuOpen(false);
    showToast("با موفقیت خارج شدید", "success");
    navigate("/");
  };

  const closeUserMenu = () => setIsUserMenuOpen(false);

  // A phone-registered account has no name until the profile is filled in, so
  // the display name *is* the number. Printing both would show it twice.
  const displayName = getDisplayName(user);
  const phone = getPhoneNumber(user);
  const phoneIsRedundant = !phone || phone === displayName;

  // Shared dropdown menu content
  const userDropdown = (
    <div className="absolute left-0 mt-2 w-56 bg-white rounded-xl shadow-[0_4px_16px_rgba(5,46,95,0.1)] border border-brand-mist py-1 z-50">
      <div className="px-4 py-3 border-b border-brand-mist">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-navy/10 flex items-center justify-center border border-brand-mist flex-shrink-0">
            {/* A person glyph, not initials. Every account here is keyed by a
                phone number, so initials would render the leading zero of
                "09…" — a circle containing "0" reads as an empty count. */}
            <User
              size={19}
              strokeWidth={1.9}
              className="text-brand-navy"
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0">
            <p className="font-persian text-sm font-medium text-text-primary truncate">
              {displayName}
            </p>
            {!phoneIsRedundant && (
              <p className="text-xs text-text-secondary truncate" dir="ltr">
                {phone}
              </p>
            )}
          </div>
        </div>
      </div>

      <Link
        to="/user-info"
        onClick={closeUserMenu}
        className="flex items-center gap-2 px-4 py-2.5 font-persian text-sm text-text-primary hover:bg-brand-warm-white transition-colors"
      >
        <User size={16} className="text-text-secondary" />
        <span>اطلاعات کاربری</span>
      </Link>

      <button
        onClick={handleLogout}
        className="flex items-center gap-2 px-4 py-2.5 font-persian text-sm text-status-error hover:bg-status-error-bg transition-colors w-full border-t border-brand-mist"
      >
        <LogOut size={16} />
        <span>خروج</span>
      </button>
    </div>
  );

  return (
    <header className="fixed top-0 inset-x-0 z-50 hidden shadow-[0_1px_4px_rgba(5,46,95,0.06)] lg:block">
      {/* ── TOP ROW ── white brand surface */}
      <div className="bg-white border-b border-brand-mist" dir="rtl">
        <div className="mx-auto flex min-h-[72px] max-w-[1200px] items-center gap-3 px-4 sm:px-6 lg:gap-4">
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="flex h-16 lg:h-[68px] flex-shrink-0 items-center overflow-hidden"
            >
              <div className="p-1">
                <img
                  src="/salyco-logo-navy.svg"
                  alt="سالیکو"
                  className="h-16 w-auto object-contain"
                />
              </div>
            </Link>

            <div className="w-64 shrink-0 lg:w-[420px]">
              <SearchBar variant="plain" />
            </div>
          </div>

          <div className="flex-1" />

          {/* Desktop actions */}
          <div className="flex items-center gap-4" dir="rtl">
            <Link
              to="/cart"
              aria-label="سبد خرید"
              className="relative flex items-center gap-1.5 font-persian text-sm font-medium text-brand-navy hover:text-brand-navy transition-colors"
            >
              <ShoppingCart size={20} className="text-brand-navy" />
              {cartCount > 0 && (
                // Navy on the white navbar. It was a white disc, which on this
                // surface left the count invisible until hover.
                <span className="absolute -right-2 -top-2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-navy px-1 text-[11px] font-bold text-white ring-2 ring-white">
                  {cartCount > 99 ? "۹۹+" : toPersianNumber(cartCount)}
                </span>
              )}
            </Link>

            <div className="h-5 w-px bg-brand-mist" />

            {isAuthenticated ? (
              <>
                <Link
                  to="/warranty/my"
                  className="flex items-center gap-1.5 font-persian text-sm font-medium
                             text-brand-navy hover:text-brand-navy transition-colors"
                >
                  <ClipboardList size={16} className="text-text-secondary" />
                  <span>گارانتی‌های من</span>
                </Link>

                {user?.is_staff && (
                  <>
                    <div className="h-5 w-px bg-brand-mist" />
                    <Link
                      to="/admin"
                      className="flex items-center gap-1.5 font-persian text-sm font-medium
                                 text-brand-navy hover:text-brand-navy transition-colors"
                    >
                      <LayoutDashboard size={16} className="text-text-secondary" />
                      <span>پنل مدیریت</span>
                    </Link>
                  </>
                )}

                <div className="h-5 w-px bg-brand-mist" />

                {/* Avatar + dropdown replaces username + logout button */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen((o) => !o)}
                    aria-haspopup="menu"
                    aria-expanded={isUserMenuOpen}
                    aria-label="منوی حساب کاربری"
                    className="flex items-center gap-2 rounded-lg font-persian text-sm font-medium text-brand-navy hover:text-brand-navy transition-colors"
                  >
                    {/* Number first, so it lands to the right of the circle in
                        this rtl row — the identity leads, the marker follows. */}
                    <span
                      className="font-persian text-sm font-medium text-text-primary [font-feature-settings:'tnum']"
                      dir="ltr"
                    >
                      {phone}
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-mist bg-brand-warm-white">
                      <User
                        size={16}
                        strokeWidth={1.9}
                        className="text-brand-navy"
                        aria-hidden="true"
                      />
                    </span>
                    <ChevronDown
                      size={14}
                      className={`text-text-secondary transition-transform duration-200 ${
                        isUserMenuOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isUserMenuOpen && userDropdown}
                </div>
              </>
            ) : (
              <Link
                to="/auth"
                className="flex items-center gap-1.5 font-persian text-sm font-medium
                           text-brand-navy bg-white hover:bg-brand-warm-white rounded-lg px-4 h-12 transition-colors"
              >
                <UserCircle size={18} />
                <span>ورود به حساب کاربری</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── CATEGORY ROW ── */}
      <nav
        dir="rtl"
        // Centred per §8. The row no longer scrolls: it is desktop-only now, so
        // the horizontal-scroll scaffolding it needed on phones is gone.
        className="flex h-11 items-center justify-center gap-0.5
                   border-t border-brand-mist bg-white px-16
                   shadow-[0_1px_4px_rgba(5,46,95,0.06)]"
      >
        {categories.map(({ type, key, label, icon: Icon, to }) => {
          if (type === "menu") return <ProductsMenu key={key} />;

          return (
            <NavLink
              key={to}
              to={to}
              // `aria-current="page"` is what tells a screen reader which section
              // the visitor is in; the colour change alone is invisible to it.
              className={({ isActive }) =>
                `relative flex items-center gap-2 rounded-lg px-3 py-1.5 sm:px-4
               font-persian text-sm font-semibold whitespace-nowrap
               transition-all duration-200
               after:absolute after:inset-x-3 after:-bottom-px after:h-0.5
               after:rounded-full after:transition-colors sm:after:inset-x-4
               ${
                 isActive
                   ? "bg-brand-warm-white text-brand-navy after:bg-brand-navy"
                   : "text-text-primary after:bg-transparent hover:bg-brand-warm-white hover:text-brand-navy hover:after:bg-brand-navy/30"
               }`
              }
            >
              <Icon size={15} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>
    </header>
  );
}
