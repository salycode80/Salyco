import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import {
  X,
  User,
  ClipboardList,
  ShieldPlus,
  LayoutDashboard,
  LogOut,
  LogIn,
  BookOpen,
  MapPin,
  Phone,
  Info,
  Download,
} from "lucide-react";
import { useAuth } from "../auth/authContext";
import { useToast } from "../context/ToastContext";
import api from "../api";
import { isServerRoute } from "../config/serverRoutes";
import { getDisplayName, getPhoneNumber } from "../utils/user";

/**
 * The mobile account sheet — what the hamburger panel used to be.
 *
 * With the navbar gone below lg this is the only surface that carries warranty,
 * the staff console and the secondary pages on a phone. It matters for parity
 * rather than convenience: Dealers, in particular, is linked from nowhere else.
 *
 * Dialog behaviour mirrors SessionTimeoutModal: portal to <body>, background
 * scroll locked, focus moved in on open and returned to the triggering tab on
 * close, Escape and the backdrop both dismiss (§9).
 */

// §8's "لینکهای اصلی" minus what the tab bar and the account block already
// cover, so no destination the navbar used to offer is lost on mobile.
const MORE_LINKS = [
  { label: "راهنمای انتخاب تشک", to: "/articles/", icon: BookOpen },
  { label: "نمایندگیها", to: "/dealers", icon: MapPin },
  { label: "تماس با ما", to: "/contact", icon: Phone },
  { label: "دربارهٔ سالیکو", to: "/about", icon: Info },
];

// Shared row shape: ≥48px tall, so every row clears §9's touch target.
const rowClass =
  "flex min-h-12 items-center gap-3 px-4 py-3 font-persian text-sm font-medium text-text-primary transition-colors hover:bg-brand-warm-white";

export default function AccountSheet({ onClose, returnFocusTo }) {
  const { isAuthenticated, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const panelRef = useRef(null);

  // Only fetched once the sheet is opened — the profile is display-only here.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    api
      .get("/api/user/me/")
      .then((res) => {
        if (!cancelled) setUser(res.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Lock background scroll, focus the dialog, restore both on close.
  // Mount-only by design: `returnFocusTo` is a ref object, so its identity is
  // stable and this never re-runs mid-session. Its node is read once here rather
  // than in the cleanup, which would read whatever `current` holds by then.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const returnTarget = returnFocusTo?.current ?? null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      const target = returnTarget ?? previouslyFocused;
      if (target instanceof HTMLElement) target.focus();
    };
  }, [returnFocusTo]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleLogout = () => {
    logout();
    onClose();
    showToast("با موفقیت خارج شدید", "success");
    // replace, not push: the page behind this one was usually a protected route.
    navigate("/", { replace: true });
  };

  return createPortal(
    <div dir="rtl" className="fixed inset-0 z-[100] flex flex-col lg:hidden">
      {/* Backdrop. Its own element rather than a click handler on the wrapper, so
          a click that starts inside the panel can never bubble out and close it.
          It fades while the panel rises — both keyframes live in index.css. */}
      <button
        type="button"
        aria-label="بستن"
        onClick={onClose}
        className="sheet-backdrop-enter flex-1 cursor-default bg-text-primary/60 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-sheet-title"
        className="sheet-panel-enter max-h-[80vh] w-full overflow-y-auto rounded-t-2xl border-t border-brand-mist bg-white pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_24px_rgba(5,46,95,0.14)] focus:outline-none"
      >
        <div className="flex items-center justify-between border-b border-brand-mist px-4 py-3">
          <h2
            id="account-sheet-title"
            className="font-persian text-base font-bold text-text-primary"
          >
            حساب من
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-brand-warm-white hover:text-brand-navy"
          >
            <X size={20} />
          </button>
        </div>

        {isAuthenticated ? (
          <>
            <div className="flex items-center gap-3 border-b border-brand-mist px-4 py-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brand-mist bg-brand-navy/10">
                {/* A person glyph, not initials — the account is a phone
                    number, so initials would just print its leading zero. */}
                <User
                  size={20}
                  strokeWidth={1.9}
                  className="text-brand-navy"
                  aria-hidden="true"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate font-persian text-sm font-semibold text-text-primary">
                  {getDisplayName(user)}
                </p>
                {/* Latin/phone digits, so it stays an LTR island in the RTL row.
                    Hidden when the display name already *is* the number, which
                    is the usual shape for an account with no name filled in. */}
                {getPhoneNumber(user) !== getDisplayName(user) && (
                  <p className="truncate text-xs text-text-secondary" dir="ltr">
                    {getPhoneNumber(user)}
                  </p>
                )}
              </div>
            </div>

            <nav className="py-1">
              <Link to="/user-info" onClick={onClose} className={rowClass}>
                <User size={18} className="text-text-secondary" />
                اطلاعات کاربری
              </Link>
              <Link to="/warranty/my" onClick={onClose} className={rowClass}>
                <ClipboardList size={18} className="text-text-secondary" />
                گارانتی‌های من
              </Link>
              <Link
                to="/productregistration"
                onClick={onClose}
                className={rowClass}
              >
                <ShieldPlus size={18} className="text-text-secondary" />
                ثبت گارانتی جدید
              </Link>
              {user?.is_staff && (
                <Link to="/admin" onClick={onClose} className={rowClass}>
                  <LayoutDashboard size={18} className="text-text-secondary" />
                  پنل مدیریت
                </Link>
              )}
            </nav>
          </>
        ) : (
          <div className="border-b border-brand-mist px-4 py-4">
            <Link
              to="/auth"
              onClick={onClose}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-navy font-persian text-sm font-semibold text-white transition-colors hover:bg-action-hover"
            >
              <LogIn size={18} />
              ورود / ثبت‌نام
            </Link>
          </div>
        )}

        <nav className="py-1">
          {MORE_LINKS.map(({ label, to, icon: Icon }) =>
            isServerRoute(to) ? (
              // Django serves this one, so it is a real anchor: a <Link> would
              // client-render a route App.jsx no longer declares. No onClose —
              // the browser is navigating away, and the sheet goes with the page.
              <a key={to} href={to} className={rowClass}>
                <Icon size={18} className="text-text-secondary" />
                {label}
              </a>
            ) : (
              <Link key={to} to={to} onClick={onClose} className={rowClass}>
                <Icon size={18} className="text-text-secondary" />
                {label}
              </Link>
            ),
          )}
          {/* Same asset and attribute as the footer's catalog link. Not a route,
              so it is an <a>: a NavLink would intercept the download. */}
          <a
            href="/catalog.pdf"
            download
            onClick={onClose}
            className={rowClass}
          >
            <Download size={18} className="text-text-secondary" />
            دانلود کاتالوگ
          </a>
        </nav>

        {isAuthenticated && (
          <div className="border-t border-brand-mist py-1">
            <button
              type="button"
              onClick={handleLogout}
              className={`${rowClass} w-full text-status-error hover:bg-status-error-bg`}
            >
              <LogOut size={18} />
              خروج
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
