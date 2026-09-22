import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import api from "../../api";
import {
  LayoutDashboard,
  PackagePlus,
  Lock,
  Loader2,
  ShieldCheck,
  MessageSquare,
  Inbox,
  ShoppingBag,
  MapPin,
  TicketPercent,
} from "lucide-react";
import PageBackground from "../../components/PageBackground";

// Admin controls shown in the workspace sidebar. Add new panels here and wire a
// matching nested <Route> in App.jsx — the layout picks them up automatically.
const controls = [
  {
    to: "/admin",
    end: true,
    label: "داشبورد مدیریت",
    hint: "آمار، محصولات و مشتریان",
    icon: LayoutDashboard,
  },
  {
    to: "/admin/create",
    label: "ساخت نمونه محصول",
    hint: "تولید سریال و QR کد",
    icon: PackagePlus,
  },
  {
    to: "/admin/warranty-requests",
    label: "تأیید گارانتی‌ها",
    hint: "بررسی درخواست‌های ثبت گارانتی",
    icon: ShieldCheck,
  },
  {
    to: "/admin/orders",
    label: "مدیریت سفارش‌ها",
    hint: "بررسی و پیگیری سفارش‌ها",
    icon: ShoppingBag,
  },
  {
    to: "/admin/locations",
    label: "مناطق مجاز ارسال",
    hint: "تعیین محدوده خرید آنلاین",
    icon: MapPin,
  },
  {
    to: "/admin/coupons",
    label: "کدهای تخفیف",
    hint: "تعریف و مدیریت کدهای تخفیف",
    icon: TicketPercent,
  },
  {
    to: "/admin/reviews",
    label: "مدیریت نظرات",
    hint: "تأیید یا رد نظرات کاربران",
    icon: MessageSquare,
  },
  {
    to: "/admin/suggestions",
    label: "نظرات و پیشنهادات",
    hint: "پیام‌های فرم تماس با ما",
    icon: Inbox,
  },
];

export default function AdminWorkspace() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(null);

  // Single admin gate for the whole workspace — panels rendered inside can
  // assume the current user is staff.
  useEffect(() => {
    api
      .get("/api/user/me/")
      .then((res) => setIsAdmin(res.data.is_staff === true))
      .catch(() => setIsAdmin(false));
  }, []);

  if (isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white pt-[var(--navbar-height)]">
        <Loader2 className="h-10 w-10 animate-spin text-brand-navy" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white pt-[var(--navbar-height)]">
        <div className="rounded-xl border border-brand-mist bg-white p-12 text-center shadow-[0_1px_4px_rgba(5,46,95,0.06)]">
          <Lock size={56} className="mx-auto mb-4 text-status-error" strokeWidth={1.5} />
          <h2 className="font-persian text-xl font-semibold text-text-primary" dir="rtl">
            دسترسی ندارید
          </h2>
          <p className="mt-2 font-persian text-sm text-text-secondary" dir="rtl">
            فقط مدیران سیستم به پنل مدیریت دسترسی دارند.
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-6 rounded-lg border-2 border-brand-navy bg-white px-6 py-3 font-persian font-medium text-brand-navy transition hover:bg-brand-warm-white"
          >
            بازگشت به صفحه اصلی
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="relative min-h-screen overflow-hidden bg-white pt-[var(--navbar-height)]">
      <PageBackground />

      <div className="relative mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:py-10">
        {/* ── Sidebar: admin controls ── */}
        <aside className="lg:w-72 lg:shrink-0" dir="rtl">
          <div className="lg:sticky lg:top-[calc(var(--navbar-height)+1.5rem)]">
            <div className="mb-4 flex items-center gap-2 px-1">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-navy text-white">
                <ShieldCheck size={18} />
              </span>
              <div>
                <p className="font-sans text-[0.65rem] uppercase tracking-[0.25em] text-text-secondary">
                  Admin Panel
                </p>
                <h2 className="font-persian text-base font-bold text-text-primary">
                  پنل مدیریت
                </h2>
              </div>
            </div>

            <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
              {controls.map(({ to, end, label, hint, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `group flex shrink-0 items-center gap-3 rounded-xl border px-4 py-3 transition ${
                      isActive
                        ? "border-transparent bg-brand-navy text-white shadow-[0_4px_16px_rgba(5,46,95,0.1)]"
                        : "border-brand-mist bg-white text-text-primary hover:bg-brand-warm-white"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          isActive ? "bg-white/15 text-white" : "bg-brand-warm-white text-brand-navy"
                        }`}
                      >
                        <Icon size={20} strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0">
                        <p className="font-persian text-sm font-semibold">{label}</p>
                        <p
                          className={`mt-0.5 truncate font-persian text-xs ${
                            isActive ? "text-white/80" : "text-text-secondary"
                          }`}
                        >
                          {hint}
                        </p>
                      </div>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        </aside>

        {/* ── Active control panel ── */}
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </section>
  );
}
