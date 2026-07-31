import { useState, useEffect, useRef } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/UseAuth";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { toPersianNumber } from "../utils/persian";
import api from "../api";
import SearchBar from "./SearchBar";
import {
  Phone,
  UserCircle,
  User,
  BedDouble,
  BookOpen,
  Image,
  Info,
  LogOut,
  ClipboardList,
  LayoutDashboard,
  ChevronDown,
  Menu,
  X,
  MapPin,
  ShoppingCart,
} from "lucide-react";

const categories = [
  { label: "تشک", icon: BedDouble, to: "/products/mattress" },
  { label: "مقالات", icon: BookOpen, to: "/articles" },
  { label: "نمایندگی", icon: MapPin, to: "/dealers" },
  { label: "تماس با ما", icon: Phone, to: "/contact" },
  { label: "درباره ما", icon: Info, to: "/about" },
];

export default function Navbar() {
  const { isAuthenticated, logout } = useAuth();
  const { count: cartCount } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
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

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    setIsUserMenuOpen(false);
    showToast("با موفقیت خارج شدید", "success");
    navigate("/");
  };

  const closeMenu = () => setMenuOpen(false);
  const toggleUserMenu = () => setIsUserMenuOpen((o) => !o);
  const closeUserMenu = () => setIsUserMenuOpen(false);

  // Show first + last name when available, else the username, else a placeholder.
  // For phone-registered accounts, username is the phone number, which is a poor
  // display choice — first_name + last_name is filled in at signup or profile edit.
  const displayName = (u) =>
    [u?.first_name, u?.last_name].filter(Boolean).join(" ") ||
    u?.username ||
    "کاربر";

  const getUserInitials = (u) => {
    // First letter of the first name if available, else first letter of username.
    const initial = u?.first_name?.charAt(0) || u?.username?.charAt(0) || "?";
    return initial.toUpperCase();
  };

  // Shared dropdown menu content (used by both desktop + mobile avatar buttons)
  const userDropdown = (
    <div className="absolute left-0 mt-2 w-56 bg-white rounded-xl shadow-[0_4px_16px_rgba(0,48,135,0.1)] border border-[#CBD2D6] py-1 z-50">
      <div className="px-4 py-3 border-b border-[#CBD2D6]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#003087]/10 flex items-center justify-center border border-[#CBD2D6] flex-shrink-0">
            <span className="text-lg font-bold text-[#003087]">
              {getUserInitials(user)}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-persian text-sm font-medium text-[#1A1A2E] truncate">
              {displayName(user)}
            </p>
            <p className="text-xs text-[#687173] truncate" dir="ltr">
              {user?.phone_number || user?.username || ""}
            </p>
          </div>
        </div>
      </div>

      <Link
        to="/user-info"
        onClick={() => {
          closeUserMenu();
          closeMenu();
        }}
        className="flex items-center gap-2 px-4 py-2.5 font-persian text-sm text-[#1A1A2E] hover:bg-[#F5F7FA] transition-colors"
      >
        <User size={16} className="text-[#687173]" />
        <span>اطلاعات کاربری</span>
      </Link>

      <button
        onClick={() => {
          closeUserMenu();
          handleLogout();
        }}
        className="flex items-center gap-2 px-4 py-2.5 font-persian text-sm text-[#D20000] hover:bg-[#FDE7E7] transition-colors w-full border-t border-[#CBD2D6]"
      >
        <LogOut size={16} />
        <span>خروج</span>
      </button>
    </div>
  );

  return (
    <header className="fixed top-0 inset-x-0 z-50 shadow-[0_1px_4px_rgba(0,48,135,0.06)]">
      {/* ── TOP ROW ── navy surface (contrast against white category row) */}
      <div className="bg-[#003087] border-b border-[#00246B]" dir="rtl">
        <div className="mx-auto flex h-16 max-w-9xl items-center gap-3 px-4 sm:px-6 lg:h-[72px] lg:gap-4">
          <div className="flex items-center gap-6">
            <Link
              to="/"
              onClick={closeMenu}
              className="flex h-16 lg:h-[72px] flex-shrink-0 items-center overflow-hidden"
            >
              <div className="rounded-2xl border-t-indigo-700 p-1 shadow-md sm:p-2">
                <img
                  src="/navbar-logo2.png"
                  alt="سالیکو"
                  className="h-20 sm:h-20 lg:h-28 w-auto rounded-2xl object-contain"
                  style={{
                    imageRendering: "-webkit-optimize-contrast",
                    filter: "drop-shadow(0 0 1px rgba(255,255,255,0.08))",
                  }}
                />
              </div>
            </Link>

            <div className="hidden md:block md:w-64 md:shrink-0 lg:w-[420px]">
              <SearchBar variant="navbar" />
            </div>
          </div>

          <div className="flex-1" />

          {/* Desktop actions */}
          <div className="hidden items-center gap-4 lg:flex" dir="rtl">
            <Link
              to="/cart"
              aria-label="سبد خرید"
              className="relative flex items-center gap-1.5 font-persian text-sm font-medium text-white/90 hover:text-white transition-colors"
            >
              <ShoppingCart size={20} className="text-white/80" />
              {cartCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-[#003087]">
                  {cartCount > 99 ? "۹۹+" : toPersianNumber(cartCount)}
                </span>
              )}
            </Link>

            <div className="h-5 w-px bg-white/20" />

            {isAuthenticated ? (
              <>
                <Link
                  to="/warranty/my"
                  className="flex items-center gap-1.5 font-persian text-sm font-persian font-medium
                             text-white/90 hover:text-white tracking-wide transition-colors"
                >
                  <ClipboardList size={16} className="text-white/70" />
                  <span>گارانتی‌های من</span>
                </Link>

                {user?.is_staff && (
                  <>
                    <div className="h-5 w-px bg-white/20" />
                    <Link
                      to="/admin"
                      className="flex items-center gap-1.5 font-persian text-sm font-medium
                                 text-white/90 hover:text-white tracking-wide transition-colors"
                    >
                      <LayoutDashboard size={16} className="text-white/70" />
                      <span>پنل مدیریت</span>
                    </Link>
                  </>
                )}

                <div className="h-5 w-px bg-white/20" />

                {/* Avatar + dropdown replaces username + logout button */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={toggleUserMenu}
                    className="flex items-center gap-2 font-persian text-sm font-medium text-white/90 hover:text-white transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                      <span className="font-persian text-sm font-bold text-white">
                        {getUserInitials(user)}
                      </span>
                    </div>
                    <ChevronDown
                      size={14}
                      className={`text-white/70 transition-transform duration-200 ${
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
                           text-[#003087] bg-white hover:bg-[#F5F7FA] rounded-lg px-4 h-12 tracking-wide transition-colors"
              >
                <UserCircle size={18} />
                <span>ورود به حساب کاربری</span>
              </Link>
            )}
          </div>

          {/* Mobile cart — always visible, never inside the hamburger menu */}
          <Link
            to="/cart"
            onClick={closeMenu}
            aria-label="سبد خرید"
            className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg
                       border border-white/20 bg-white/10 text-white
                       transition-colors hover:bg-white/20 lg:hidden"
          >
            <ShoppingCart size={20} />
            {cartCount > 0 && (
              <span className="absolute -left-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-[#003087]">
                {cartCount > 99 ? "۹۹+" : toPersianNumber(cartCount)}
              </span>
            )}
          </Link>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "بستن منو" : "باز کردن منو"}
            aria-expanded={menuOpen}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg
                       border border-white/20 bg-white/10 text-white
                       transition-colors hover:bg-white/20 lg:hidden"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* ── CATEGORY ROW ── */}
      <nav
        dir="rtl"
        className="flex h-11 max-w-full items-center justify-start gap-0.5
                   overflow-x-auto scrollbar-none border-t border-[#CBD2D6]
                   bg-white px-3 shadow-[0_1px_4px_rgba(0,48,135,0.06)] sm:px-6 lg:px-16"
      >
        {categories.map(({ label, icon: Icon, to, href }) => {
          const classes = `flex items-center gap-2 rounded-lg px-3 py-1.5 sm:px-4
               font-persian text-sm font-semibold tracking-wide whitespace-nowrap
               transition-all duration-200
               text-[#1A1A2E] hover:text-[#003087] hover:bg-[#F5F7FA]`;

          if (href) {
            return (
              <a key={href} href={href} className={classes}>
                <Icon size={15} strokeWidth={2} />
                <span>{label}</span>
              </a>
            );
          }

          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-1.5 sm:px-4
               font-persian text-sm font-semibold tracking-wide whitespace-nowrap
               transition-all duration-200
               ${
                 isActive
                   ? "bg-[#F5F7FA] text-[#003087]"
                   : "text-[#1A1A2E] hover:text-[#003087] hover:bg-[#F5F7FA]"
               }`
              }
            >
              <Icon size={15} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* ── MOBILE MENU ── */}
      <div
        className={`bg-white border-t border-[#CBD2D6] px-4 lg:hidden overflow-hidden transition-all duration-300 ease-in-out shadow-[0_8px_16px_rgba(0,48,135,0.12)] ${
          menuOpen ? "max-h-[600px] pb-4 pt-3 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
        }`}
        dir="rtl"
        style={menuOpen ? {
          boxShadow: '0 8px 16px rgba(0, 48, 135, 0.12), inset 0 1px 0 rgba(0, 48, 135, 0.05)'
        } : {}}
      >
          <div className="mb-3 md:hidden">
            <SearchBar variant="navbar" onNavigate={closeMenu} />
          </div>

          <div className="flex flex-col divide-y divide-[#CBD2D6]">
            {isAuthenticated ? (
              <>
                <Link
                  to="/warranty/my"
                  onClick={closeMenu}
                  className="flex items-center gap-2 py-3 font-persian text-sm font-medium text-[#1A1A2E] hover:text-[#003087] transition-colors"
                >
                  <ClipboardList size={16} className="text-[#687173]" />
                  <span>گارانتی‌های من</span>
                </Link>

                {user?.is_staff && (
                  <Link
                    to="/admin"
                    onClick={closeMenu}
                    className="flex items-center gap-2 py-3 font-persian text-sm font-medium text-[#1A1A2E] hover:text-[#003087] transition-colors"
                  >
                    <LayoutDashboard size={16} className="text-[#687173]" />
                    <span>پنل مدیریت</span>
                  </Link>
                )}

                <div className="flex items-center gap-3 py-3">
                  <div className="w-9 h-9 rounded-full bg-[#003087]/10 flex items-center justify-center border border-[#CBD2D6] flex-shrink-0">
                    <span className="font-persian text-sm font-bold text-[#003087]">
                      {getUserInitials(user)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-persian text-sm font-medium text-[#1A1A2E] truncate">
                      {displayName(user)}
                    </p>
                    <p className="text-xs text-[#687173] truncate" dir="ltr">
                      {user?.phone_number || user?.username || ""}
                    </p>
                  </div>
                </div>

                <Link
                  to="/user-info"
                  onClick={closeMenu}
                  className="flex items-center gap-2 py-3 font-persian text-sm font-medium text-[#1A1A2E] hover:text-[#003087] transition-colors"
                >
                  <User size={16} className="text-[#687173]" />
                  <span>اطلاعات کاربری</span>
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-2 py-3 font-persian text-sm font-medium text-[#D20000] hover:text-[#00246B] transition-colors w-full text-right"
                >
                  <LogOut size={16} />
                  <span>خروج</span>
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                onClick={closeMenu}
                className="flex items-center gap-2 py-3 font-persian text-sm font-medium text-[#1A1A2E] hover:text-[#003087] transition-colors"
              >
                <UserCircle size={18} className="text-[#687173]" />
                <span>ورود به حساب کاربری</span>
              </Link>
            )}
          </div>
      </div>
    </header>
  );
}
