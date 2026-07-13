import { useState, useEffect, useCallback } from "react";
import {
  getAdminStats,
  listAdminInstances,
  getAdminInstance,
  listAdminCustomers,
  exportAdminCsv,
} from "../../api/admin";
import { listMattresses } from "../../api/warranty";
import {
  LayoutDashboard,
  Package,
  Users,
  ShieldCheck,
  ShieldOff,
  Boxes,
  Search,
  Download,
  Filter,
  X,
  QrCode,
  Phone,
  MapPin,
  Mail,
  RotateCcw,
  CheckCircle2,
  Circle,
  Loader2,
} from "lucide-react";

const faNum = (n) => Number(n ?? 0).toLocaleString("fa-IR");

// ── stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, accent = "text-blue-500" }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-blue-400/15 bg-white p-5 shadow-sm">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F5F7FA] ${accent}`}>
        <Icon size={24} strokeWidth={1.75} />
      </div>
      <div dir="rtl">
        <p className="font-persian text-sm text-[#000c3e]/55">{label}</p>
        <p className="mt-0.5 font-persian text-2xl font-bold text-[#000c3e]">{faNum(value)}</p>
      </div>
    </div>
  );
}

function Badge({ ok, yes, no }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
        ok
          ? "bg-emerald-50 text-emerald-600"
          : "bg-[#F5F7FA] text-[#000c3e]/50"
      }`}
    >
      {ok ? <CheckCircle2 size={13} /> : <Circle size={13} />}
      {ok ? yes : no}
    </span>
  );
}

// ── instance detail modal ────────────────────────────────────────────────────
function InstanceModal({ serial, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    getAdminInstance(serial)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [serial]);

  const handleDownloadQR = () => {
    if (!data?.qr_code) return;
    const link = document.createElement("a");
    link.href = data.qr_code;
    link.download = `QR-${data.serial_number}.png`;
    link.click();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#000c3e]/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-blue-400/15 bg-white p-6 shadow-xl sm:p-8"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="font-sans text-xs uppercase tracking-[0.25em] text-wood-500/80">
              Product Instance
            </p>
            <h3 className="mt-1 font-mono text-lg font-bold text-[#000c3e]" dir="ltr">
              {serial}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-[#000c3e]/50 transition hover:bg-[#F5F7FA]"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <p className="font-persian text-sm text-red-600">{error}</p>
        )}

        {!data && !error && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#001a5c]" />
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* QR + status */}
            <div className="flex flex-col items-center gap-4 rounded-2xl bg-[#F5F7FA]/70 p-5 sm:flex-row sm:items-center">
              {data.qr_code && (
                <img
                  src={data.qr_code}
                  alt={`QR ${data.serial_number}`}
                  className="h-36 w-36 rounded-xl border border-blue-400/10 bg-white p-2"
                />
              )}
              <div className="flex-1 space-y-2 text-center sm:text-right">
                <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                  <Badge ok={data.is_sold} yes="فروخته شده" no="در انبار" />
                  <Badge ok={data.is_warranty_active} yes="گارانتی فعال" no="گارانتی غیرفعال" />
                  {data.is_warranty_active && (
                    <Badge ok={data.is_under_warranty} yes="در دوره گارانتی" no="منقضی شده" />
                  )}
                </div>
                {data.qr_code && (
                  <button
                    onClick={handleDownloadQR}
                    className="mt-2 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-white px-4 py-2 font-persian text-sm font-medium text-[#000c3e] transition hover:bg-[#F5F7FA]"
                  >
                    <Download size={15} /> دانلود QR
                  </button>
                )}
              </div>
            </div>

            {/* product & warranty */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="محصول" value={data.mattress?.name} />
              <Field label="برند" value={data.mattress?.brand || "—"} />
              <Field label="مدت گارانتی" value={`${faNum(data.warranty_months)} ماه`} />
              <Field label="تاریخ تولید" value={data.manufacture_date || "—"} />
              <Field label="تاریخ فعال‌سازی" value={data.activation_date || "—"} />
              <Field
                label="تاریخ انقضای گارانتی"
                value={data.warranty_expiration_date || "—"}
              />
              {data.warranty_remaining_days != null && (
                <Field
                  label="روزهای باقی‌مانده"
                  value={faNum(data.warranty_remaining_days)}
                />
              )}
            </div>

            {/* customer */}
            <div>
              <h4 className="mb-3 font-persian text-sm font-semibold text-[#000c3e]/70">
                اطلاعات مشتری
              </h4>
              {data.customer ? (
                <div className="space-y-2 rounded-xl border border-blue-400/10 bg-white p-4">
                  <InfoRow icon={Users} value={`${data.customer.first_name} ${data.customer.last_name}`} />
                  <InfoRow icon={Phone} value={data.customer.phone_number || "—"} ltr />
                  <InfoRow icon={MapPin} value={data.customer.address || "—"} />
                  <InfoRow icon={Mail} value={data.customer.postal_code || "—"} ltr />
                </div>
              ) : (
                <p className="rounded-xl bg-[#F5F7FA]/70 p-4 font-persian text-sm text-[#000c3e]/50">
                  این محصول هنوز به مشتری فروخته نشده است.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="rounded-xl border border-blue-400/10 bg-white p-3">
      <p className="font-persian text-xs text-[#000c3e]/45">{label}</p>
      <p className="mt-0.5 font-persian text-sm font-medium text-[#000c3e]">{value}</p>
    </div>
  );
}

function InfoRow({ icon: Icon, value, ltr }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={15} className="shrink-0 text-blue-400" />
      <span
        className={`font-persian text-sm text-[#000c3e] ${ltr ? "font-mono" : ""}`}
        dir={ltr ? "ltr" : "rtl"}
      >
        {value}
      </span>
    </div>
  );
}

// ── panel ─────────────────────────────────────────────────────────────────────
// Rendered inside AdminWorkspace, which already gates on staff and provides the
// page chrome (navbar padding + background), so this component focuses purely on
// the dashboard content.
export default function DashboardPanel() {
  const [stats, setStats] = useState(null);
  const [mattresses, setMattresses] = useState([]);

  const [tab, setTab] = useState("instances"); // "instances" | "customers"
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null); // serial for modal

  // filters
  const [search, setSearch] = useState("");
  const [sold, setSold] = useState("");
  const [warranty, setWarranty] = useState("");
  const [mattressId, setMattressId] = useState("");

  // load stats + mattress models once
  useEffect(() => {
    getAdminStats().then(setStats).catch(() => {});
    listMattresses()
      .then((d) => setMattresses(Array.isArray(d) ? d : d.results || []))
      .catch(() => {});
  }, []);

  const params = useCallback(
    () =>
      tab === "instances"
        ? { search, sold, warranty, mattress: mattressId }
        : { search },
    [tab, search, sold, warranty, mattressId]
  );

  // fetch rows (debounced on filter change)
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      const fetch = tab === "instances" ? listAdminInstances : listAdminCustomers;
      fetch(params())
        .then((d) => setRows(Array.isArray(d) ? d : d.results || []))
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [tab, params]);

  const resetFilters = () => {
    setSearch("");
    setSold("");
    setWarranty("");
    setMattressId("");
  };

  const handleExport = () => {
    exportAdminCsv(tab, params()).catch(() => {});
  };

  const switchTab = (t) => {
    setTab(t);
    resetFilters();
  };

  const hasFilters = search || sold || warranty || mattressId;

  return (
    <>
      {/* header */}
      <header className="mb-8" dir="rtl">
        <p className="flex items-center gap-2 font-sans text-sm uppercase tracking-[0.3em] text-wood-500/80">
          <LayoutDashboard size={16} /> CRM Dashboard
        </p>
        <h1 className="mt-2 font-persian text-3xl font-bold text-[#000c3e] md:text-4xl">
          داشبورد مدیریت
        </h1>
        <hr className="mt-4 w-24 border-t-2 border-wood-400" />
      </header>

      {/* stats */}
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Boxes} label="کل محصولات تولیدی" value={stats?.total_instances} accent="text-blue-500" />
        <StatCard icon={Package} label="فروخته شده" value={stats?.sold_instances} accent="text-emerald-500" />
        <StatCard icon={ShieldCheck} label="گارانتی فعال" value={stats?.active_warranties} accent="text-wood-500" />
        <StatCard icon={Users} label="مشتریان" value={stats?.total_customers} accent="text-indigo-500" />
        <StatCard icon={Boxes} label="موجود در انبار" value={stats?.in_stock_instances} accent="text-slate-400" />
        <StatCard icon={ShieldCheck} label="در دوره گارانتی" value={stats?.under_warranty} accent="text-emerald-500" />
        <StatCard icon={ShieldOff} label="گارانتی منقضی" value={stats?.expired_warranties} accent="text-red-400" />
        <StatCard icon={LayoutDashboard} label="مدل محصولات" value={stats?.by_mattress?.length} accent="text-blue-500" />
      </div>

      {/* tabs */}
      <div className="mb-6 flex flex-wrap items-center gap-2" dir="rtl">
        <TabButton active={tab === "instances"} onClick={() => switchTab("instances")} icon={Package}>
          محصولات تولیدی
        </TabButton>
        <TabButton active={tab === "customers"} onClick={() => switchTab("customers")} icon={Users}>
          مشتریان
        </TabButton>
        <button
          onClick={handleExport}
          className="mr-auto inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#000c2e] via-[#001a5c] to-[#00256b] px-5 py-2.5 font-persian text-sm font-semibold text-white shadow-md transition hover:brightness-110"
        >
          <Download size={16} /> خروجی CSV
        </button>
      </div>

      {/* filters */}
      <div className="mb-6 rounded-2xl border border-blue-400/15 bg-white p-4 shadow-sm" dir="rtl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#000c3e]/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                tab === "instances"
                  ? "جستجوی سریال، نام یا تلفن مشتری..."
                  : "جستجوی نام، تلفن یا کد پستی..."
              }
              className="w-full rounded-full border border-blue-400/20 bg-white py-2.5 pr-11 pl-4 text-sm text-[#000c3e] outline-none transition focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20"
            />
          </div>

          {tab === "instances" && (
            <>
              <Select value={sold} onChange={setSold}>
                <option value="">وضعیت فروش (همه)</option>
                <option value="true">فروخته شده</option>
                <option value="false">در انبار</option>
              </Select>
              <Select value={warranty} onChange={setWarranty}>
                <option value="">گارانتی (همه)</option>
                <option value="active">فعال</option>
                <option value="inactive">غیرفعال</option>
              </Select>
              <Select value={mattressId} onChange={setMattressId}>
                <option value="">مدل محصول (همه)</option>
                {mattresses.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </>
          )}

          {hasFilters && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/20 bg-white px-4 py-2.5 font-persian text-sm text-[#000c3e]/70 transition hover:bg-[#F5F7FA]"
            >
              <RotateCcw size={14} /> پاک کردن
            </button>
          )}
        </div>
      </div>

      {/* table */}
      <div className="overflow-hidden rounded-2xl border border-blue-400/15 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#001a5c]" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center">
            <Filter size={40} className="mx-auto mb-3 text-[#000c3e]/20" />
            <p className="font-persian text-sm text-[#000c3e]/50">موردی یافت نشد.</p>
          </div>
        ) : tab === "instances" ? (
          <InstanceTable rows={rows} onSelect={setSelected} />
        ) : (
          <CustomerTable rows={rows} />
        )}
      </div>

      <p className="mt-4 text-center font-persian text-xs text-[#000c3e]/40" dir="rtl">
        {faNum(rows.length)} مورد نمایش داده شد
      </p>

      {selected && <InstanceModal serial={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-persian text-sm font-semibold transition ${
        active
          ? "bg-[#000c3e] text-white shadow-md"
          : "border border-blue-400/20 bg-white text-[#000c3e]/70 hover:bg-[#F5F7FA]"
      }`}
    >
      <Icon size={16} /> {children}
    </button>
  );
}

function Select({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-full border border-blue-400/20 bg-white px-4 py-2.5 font-persian text-sm text-[#000c3e] outline-none transition focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20"
    >
      {children}
    </select>
  );
}

function Th({ children, className = "" }) {
  return (
    <th className={`whitespace-nowrap px-4 py-3 text-right font-persian text-xs font-semibold text-[#000c3e]/55 ${className}`}>
      {children}
    </th>
  );
}

function InstanceTable({ rows, onSelect }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full" dir="rtl">
        <thead className="border-b border-blue-400/10 bg-[#F5F7FA]/60">
          <tr>
            <Th>شماره سریال</Th>
            <Th>محصول</Th>
            <Th>مشتری</Th>
            <Th>وضعیت فروش</Th>
            <Th>گارانتی</Th>
            <Th>تاریخ تولید</Th>
            <Th className="text-center">جزئیات</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-blue-400/5">
          {rows.map((r) => (
            <tr key={r.serial_number} className="transition hover:bg-[#F5F7FA]/50">
              <td className="px-4 py-3">
                <span className="font-mono text-sm font-medium text-[#000c3e]" dir="ltr">
                  {r.serial_number}
                </span>
              </td>
              <td className="px-4 py-3 font-persian text-sm text-[#000c3e]">{r.mattress_name}</td>
              <td className="px-4 py-3 font-persian text-sm text-[#000c3e]/80">
                {r.customer_name || <span className="text-[#000c3e]/35">—</span>}
              </td>
              <td className="px-4 py-3">
                <Badge ok={r.is_sold} yes="فروخته شده" no="در انبار" />
              </td>
              <td className="px-4 py-3">
                {r.is_warranty_active ? (
                  <Badge ok={r.is_under_warranty} yes="در دوره گارانتی" no="منقضی" />
                ) : (
                  <Badge ok={false} yes="" no="غیرفعال" />
                )}
              </td>
              <td className="px-4 py-3 font-persian text-sm text-[#000c3e]/60">
                {r.manufacture_date || "—"}
              </td>
              <td className="px-4 py-3 text-center">
                <button
                  onClick={() => onSelect(r.serial_number)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/20 bg-white px-3 py-1.5 font-persian text-xs font-medium text-[#000c3e] transition hover:bg-[#F5F7FA]"
                >
                  <QrCode size={14} /> مشاهده
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CustomerTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full" dir="rtl">
        <thead className="border-b border-blue-400/10 bg-[#F5F7FA]/60">
          <tr>
            <Th>نام و نام خانوادگی</Th>
            <Th>تلفن</Th>
            <Th>کد پستی</Th>
            <Th>آدرس</Th>
            <Th className="text-center">محصولات</Th>
            <Th className="text-center">گارانتی فعال</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-blue-400/5">
          {rows.map((c) => (
            <tr key={c.id} className="transition hover:bg-[#F5F7FA]/50">
              <td className="px-4 py-3 font-persian text-sm font-medium text-[#000c3e]">
                {c.full_name || "—"}
              </td>
              <td className="px-4 py-3">
                <span className="font-mono text-sm text-[#000c3e]/80" dir="ltr">
                  {c.phone_number || "—"}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="font-mono text-sm text-[#000c3e]/70" dir="ltr">
                  {c.postal_code || "—"}
                </span>
              </td>
              <td className="max-w-[240px] truncate px-4 py-3 font-persian text-sm text-[#000c3e]/60">
                {c.address || "—"}
              </td>
              <td className="px-4 py-3 text-center font-persian text-sm font-semibold text-[#000c3e]">
                {faNum(c.total_products)}
              </td>
              <td className="px-4 py-3 text-center font-persian text-sm font-semibold text-emerald-600">
                {faNum(c.active_warranties)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
