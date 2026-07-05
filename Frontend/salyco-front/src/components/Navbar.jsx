import { useState, useEffect, useRef } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/UseAuth";
import api from "../api";
import {
  Phone,
  Search,
  UserCircle,
  User,
  BedDouble,
  BookOpen,
  Image,
  Info,
  LogOut,
  ClipboardList,
  Settings,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";

const categories = [
  { label: "تشک", icon: BedDouble, to: "/products/mattress" },
  { label: "مقالات", icon: BookOpen, to: "/articles" },
  { label: "گالری", icon: Image, to: "/gallery" },
  { label: "درباره سالیکو", icon: Info, to: "/about" },
];

export default function Navbar() {
  const { isAuthenticated, logout } = useAuth();
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
    navigate("/");
  };

  const closeMenu = () => setMenuOpen(false);
  const toggleUserMenu = () => setIsUserMenuOpen((o) => !o);
  const closeUserMenu = () => setIsUserMenuOpen(false);

  const getUserInitials = (username) => {
    if (!username) return "?";
    return username.charAt(0).toUpperCase();
  };

  const searchField = (
    <div className="relative w-full" dir="ltr">
      <Search
        size={16}
        className="absolute right-3 top-1/2 -translate-y-1/2
                   text-blue-400/70 pointer-events-none"
      />
      <input
        type="text"
        placeholder="جست و جو ..."
        dir="rtl"
        className="w-full pl-4 pr-9 py-[10px] rounded-lg text-sm
                   bg-white/8 border border-blue-400/25 text-blue-100
                   placeholder-blue-400/50
                   focus:outline-none focus:border-blue-400/60
                   focus:bg-white/12 transition-all"
      />
    </div>
  );

  // Shared dropdown menu content (used by both desktop + mobile avatar buttons)
  const userDropdown = (
    <div className="absolute left-0 mt-2 w-56 bg-[#001030] backdrop-blur-sm rounded-xl shadow-xl border border-blue-400/20 py-1 z-50">
      <div className="px-4 py-3 border-b border-blue-400/15">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/25 flex items-center justify-center border border-blue-400/40 flex-shrink-0">
            <span className="text-lg font-bold text-blue-200">
              {getUserInitials(user?.username)}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.username}
            </p>
            <p className="text-xs text-blue-300/70 truncate">
              {user?.email || "کاربر"}
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
        className="flex items-center gap-2 px-4 py-2.5 text-sm text-blue-100 hover:bg-white/5 transition-colors"
      >
        <User size={16} className="text-blue-400" />
        <span>اطلاعات کاربری</span>
      </Link>

      <button
        onClick={() => {
          closeUserMenu();
          handleLogout();
        }}
        className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors w-full border-t border-blue-400/15"
      >
        <LogOut size={16} />
        <span>خروج</span>
      </button>
    </div>
  );

  return (
    <header className="fixed top-0 inset-x-0 z-50 shadow-lg">
      {/* ── TOP ROW ── dark navy */}
      <div
        className="bg-gradient-to-r from-[#000c2e] via-[#001a5c] to-[#00256b]"
        dir="rtl"
      >
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
              {searchField}
            </div>
          </div>

          <div className="flex-1" />

          {/* Desktop actions */}
          <div className="hidden items-center gap-4 lg:flex" dir="rtl">
            <a
              href="#contact"
              className="flex items-center gap-1.5 text-sm font-medium
                         text-blue-200/80 hover:text-white tracking-wide transition-colors"
            >
              <Phone size={15} className="text-blue-300" />
              <span>تماس با ما</span>
            </a>
            <div className="h-5 w-px bg-blue-400/25" />

            {isAuthenticated ? (
              <>
                <Link
                  to="/warranty/my"
                  className="flex items-center gap-1.5 text-sm font-medium
                             text-blue-200/80 hover:text-white tracking-wide transition-colors"
                >
                  <ClipboardList size={16} className="text-blue-300" />
                  <span>گارانتی‌های من</span>
                </Link>

                {user?.is_staff && (
                  <>
                    <div className="h-5 w-px bg-blue-400/25" />
                    <Link
                      to="/admin/instances"
                      className="flex items-center gap-1.5 text-sm font-medium
                                 text-blue-200/80 hover:text-white tracking-wide transition-colors"
                    >
                      <Settings size={16} className="text-blue-300" />
                      <span>پنل مدیریت</span>
                    </Link>
                  </>
                )}

                <div className="h-5 w-px bg-blue-400/25" />

                {/* Avatar + dropdown replaces username + logout button */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={toggleUserMenu}
                    className="flex items-center gap-2 text-sm font-medium text-blue-200/80 hover:text-white transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-400/30">
                      <span className="text-sm font-bold text-blue-200">
                        {getUserInitials(user?.username)}
                      </span>
                    </div>
                    <ChevronDown
                      size={14}
                      className={`text-blue-300 transition-transform duration-200 ${
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
                className="flex items-center gap-1.5 text-sm font-medium
                           text-blue-200/80 hover:text-white tracking-wide transition-colors"
              >
                <UserCircle size={18} className="text-blue-300" />
                <span>ورود / ثبت‌نام</span>
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "بستن منو" : "باز کردن منو"}
            aria-expanded={menuOpen}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg
                       border border-blue-400/25 bg-white/5 text-blue-100
                       transition-colors hover:bg-white/10 lg:hidden"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* ── CATEGORY ROW ── */}
      <nav
        dir="rtl"
        className="flex h-11 max-w-full items-center justify-start gap-0.5
                   overflow-x-auto scrollbar-none border-t border-blue-100
                   bg-white px-3 shadow-sm sm:px-6 lg:px-16"
      >
        {categories.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-md px-3 py-1.5 sm:px-4
               text-sm font-semibold tracking-wide whitespace-nowrap
               transition-all duration-200
               ${
                 isActive
                   ? "bg-blue-50 text-[#2563eb]"
                   : "text-[#000c3e] hover:text-[#2563eb] hover:bg-blue-50"
               }`
            }
          >
            <Icon size={15} strokeWidth={2} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ── MOBILE MENU ── */}
      {menuOpen && (
        <div
          className="bg-gradient-to-b from-[#001a5c] to-[#00256b] px-4 pb-4 pt-3 lg:hidden"
          dir="rtl"
        >
          <div className="mb-3 md:hidden">{searchField}</div>

          <div className="flex flex-col divide-y divide-blue-400/15">
            <a
              href="#contact"
              onClick={closeMenu}
              className="flex items-center gap-2 py-3 text-sm font-medium text-blue-100"
            >
              <Phone size={16} className="text-blue-300" />
              <span>تماس با ما</span>
            </a>
            {isAuthenticated ? (
              <>
                <Link
                  to="/warranty/my"
                  onClick={closeMenu}
                  className="flex items-center gap-2 py-3 text-sm font-medium text-blue-100"
                >
                  <ClipboardList size={16} className="text-blue-300" />
                  <span>گارانتی‌های من</span>
                </Link>

                {user?.is_staff && (
                  <Link
                    to="/admin/instances"
                    onClick={closeMenu}
                    className="flex items-center gap-2 py-3 text-sm font-medium text-blue-100"
                  >
                    <Settings size={16} className="text-blue-300" />
                    <span>پنل مدیریت</span>
                  </Link>
                )}

                <div className="relative py-3">
                  <button
                    onClick={toggleUserMenu}
                    className="flex items-center gap-2 text-sm font-medium text-blue-100 hover:text-white transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-400/30">
                      <span className="text-sm font-bold text-blue-200">
                        {getUserInitials(user?.username)}
                      </span>
                    </div>
                    <span>{user?.username}</span>
                    <ChevronDown
                      size={14}
                      className={`text-blue-300 transition-transform duration-200 ${
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
                onClick={closeMenu}
                className="flex items-center gap-2 py-3 text-sm font-medium text-blue-100"
              >
                <UserCircle size={18} className="text-blue-300" />
                <span>ورود / ثبت‌نام</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
