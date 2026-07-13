import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import api from "../../api";
import {
  LayoutDashboard,
  PackagePlus,
  Lock,
  Loader2,
  ShieldCheck,
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
        <Loader2 className="h-10 w-10 animate-spin text-[#001a5c]" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white pt-[var(--navbar-height)]">
        <div className="rounded-2xl border border-red-200 bg-white p-12 text-center shadow-sm">
          <Lock size={56} className="mx-auto mb-4 text-red-400" strokeWidth={1.5} />
          <h2 className="font-persian text-xl font-semibold text-[#000c3e]" dir="rtl">
            دسترسی ندارید
          </h2>
          <p className="mt-2 font-persian text-sm text-[#000c3e]/60" dir="rtl">
            فقط مدیران سیستم به پنل مدیریت دسترسی دارند.
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-6 rounded-full border border-blue-400/20 bg-white px-6 py-3 font-persian font-medium text-[#000c3e] transition hover:bg-[#F5F7FA]"
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

      <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:py-10">
        {/* ── Sidebar: admin controls ── */}
        <aside className="lg:w-72 lg:shrink-0" dir="rtl">
          <div className="lg:sticky lg:top-[calc(var(--navbar-height)+1.5rem)]">
            <div className="mb-4 flex items-center gap-2 px-1">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#000c2e] to-[#00256b] text-white">
                <ShieldCheck size={18} />
              </span>
              <div>
                <p className="font-sans text-[0.65rem] uppercase tracking-[0.25em] text-wood-500/80">
                  Admin Panel
                </p>
                <h2 className="font-persian text-base font-bold text-[#000c3e]">
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
                    `group flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                      isActive
                        ? "border-transparent bg-gradient-to-l from-[#000c2e] via-[#001a5c] to-[#00256b] text-white shadow-md"
                        : "border-blue-400/15 bg-white text-[#000c3e] hover:bg-[#F5F7FA]"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          isActive ? "bg-white/15 text-white" : "bg-[#F5F7FA] text-blue-500"
                        }`}
                      >
                        <Icon size={20} strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0">
                        <p className="font-persian text-sm font-semibold">{label}</p>
                        <p
                          className={`mt-0.5 truncate font-persian text-xs ${
                            isActive ? "text-blue-100/80" : "text-[#000c3e]/45"
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
