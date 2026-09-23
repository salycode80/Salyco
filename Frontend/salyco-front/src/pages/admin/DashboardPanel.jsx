import { useState, useEffect, useCallback } from "react";
import {
  getAdminStats,
  listAdminInstances,
  getAdminInstance,
  updateAdminInstance,
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
  Clock,
  XCircle,
  Loader2,
  Pencil,
  Check,
  AlertTriangle,
} from "lucide-react";
import { formatJalali, formatJalaliDateTime } from "../../utils/jalali";

const faNum = (n) => Number(n ?? 0).toLocaleString("fa-IR");

// ── stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, accent = "text-brand-navy" }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-brand-mist bg-white p-5 shadow-[0_1px_4px_rgba(5,46,95,0.06)]">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-warm-white ${accent}`}>
        <Icon size={24} strokeWidth={1.75} />
      </div>
      <div dir="rtl">
        <p className="font-persian text-sm text-text-secondary">{label}</p>
        <p className="mt-0.5 font-persian text-2xl font-bold text-text-primary">{faNum(value)}</p>
      </div>
    </div>
  );
}

function Badge({ ok, yes, no }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
        ok
          ? "bg-status-success-bg text-status-success"
          : "bg-brand-warm-white text-text-secondary"
      }`}
    >
      {ok ? <CheckCircle2 size={13} /> : <Circle size={13} />}
      {ok ? yes : no}
    </span>
  );
}

// Four warranty states, not a boolean. An APPROVED instance still distinguishes
// in-period from expired — that was the old Badge's whole job here — while
// PENDING and REJECTED get their own colours so a submitted request is not
// mistaken for an unclaimed serial.
const WARRANTY_STATES = {
  PENDING: {
    label: "در انتظار تأیید",
    fill: "bg-status-info-bg",
    text: "text-brand-navy",
    Icon: Clock,
  },
  REJECTED: {
    label: "رد شده",
    fill: "bg-status-error-bg",
    text: "text-status-error",
    Icon: XCircle,
  },
};

function WarrantyBadge({ row }) {
  if (row.warranty_status === "APPROVED") {
    return <Badge ok={row.is_under_warranty} yes="در دوره گارانتی" no="منقضی" />;
  }

  const state = WARRANTY_STATES[row.warranty_status];
  if (!state) return <Badge ok={false} yes="" no="غیرفعال" />;

  const { Icon } = state;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${state.fill} ${state.text}`}
    >
      <Icon size={13} /> {state.label}
    </span>
  );
}

// ── editable product field ───────────────────────────────────────────────────
// Repointing an instance keeps its serial and its printed QR code — only what a
// scan resolves to changes. Because warranty length comes from the model, doing
// this to a unit a customer has already registered rewrites their coverage, so a
// sold or approved instance takes a confirmation step before the PATCH goes out.
function ProductField({ data, mattresses, onSaved, autoOpen = false }) {
  // autoOpen is set when the admin arrived via the row's «ویرایش» button, so the
  // select is already showing rather than hidden behind another click. Safe as an
  // initial value: this component only mounts once the instance has loaded.
  const [editing, setEditing] = useState(autoOpen);
  const [choice, setChoice] = useState(String(data.mattress?.id ?? ""));
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Only serial-numbered lines can back an instance — the server rejects the
  // rest, so don't offer an option that cannot succeed.
  const options = mattresses.filter((m) => m.is_warranty_registrable);
  const grouped = options.reduce((groups, m) => {
    const label = m.category_label || "سایر";
    (groups[label] ||= []).push(m);
    return groups;
  }, {});

  const isSensitive = data.is_sold || data.warranty_status === "APPROVED";
  const changed = choice !== "" && String(choice) !== String(data.mattress?.id);

  const open = () => {
    setChoice(String(data.mattress?.id ?? ""));
    setError(null);
    setConfirming(false);
    setEditing(true);
  };

  const close = () => {
    setEditing(false);
    setConfirming(false);
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAdminInstance(data.serial_number, {
        mattress_id: parseInt(choice, 10),
      });
      onSaved(updated);
      close();
    } catch (err) {
      setError(err.message);
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = () => {
    if (!changed) return close();
    if (isSensitive && !confirming) return setConfirming(true);
    save();
  };

  if (!editing) {
    return (
      <div className="rounded-xl border border-brand-mist bg-white p-3">
        <p className="font-persian text-xs text-text-secondary">محصول</p>
        <p className="mt-0.5 font-persian text-sm font-medium text-text-primary">
          {data.mattress?.name}
        </p>
        <button
          onClick={open}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-brand-navy bg-white px-2.5 py-1 font-persian text-xs font-medium text-brand-navy transition hover:bg-brand-warm-white"
        >
          <Pencil size={13} /> ویرایش مدل
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-brand-navy bg-white p-3 sm:col-span-2">
      <p className="mb-1.5 font-persian text-xs text-text-secondary">
        تغییر مدل محصول
      </p>
      <select
        value={choice}
        onChange={(e) => {
          setChoice(e.target.value);
          setConfirming(false);
        }}
        disabled={saving}
        className="h-11 w-full rounded-lg border border-brand-mist bg-white px-3 font-persian text-sm text-text-primary outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20 disabled:bg-brand-warm-white"
      >
        {Object.entries(grouped).map(([label, items]) => (
          <optgroup key={label} label={label}>
            {items.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <p className="mt-2 font-persian text-xs leading-6 text-text-secondary">
        شماره سریال و QR کد تغییر نمی‌کند؛ فقط مدل محصولی که با اسکن نمایش داده
        می‌شود جابه‌جا می‌شود.
      </p>

      {confirming && (
        <div className="mt-2 rounded-lg border border-status-error bg-status-error-bg p-3">
          <p className="flex items-start gap-2 font-persian text-xs leading-6 text-status-error">
            <AlertTriangle size={14} className="mt-1 shrink-0" />
            <span>
              این محصول به مشتری فروخته شده است. تغییر مدل، محصول ثبت‌شده و مدت
              گارانتی این مشتری را هم تغییر می‌دهد. مطمئن هستید؟
            </span>
          </p>
        </div>
      )}

      {error && (
        <p className="mt-2 font-persian text-xs text-status-error">{error}</p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-navy px-4 font-persian text-sm font-semibold text-white transition hover:bg-action-hover disabled:bg-brand-mist disabled:text-text-secondary"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check size={15} />
          )}
          {confirming ? "تأیید و ذخیره" : "ذخیره"}
        </button>
        <button
          onClick={close}
          disabled={saving}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-brand-mist bg-white px-4 font-persian text-sm font-medium text-text-secondary transition hover:bg-brand-warm-white"
        >
          انصراف
        </button>
      </div>
    </div>
  );
}

// ── instance detail modal ────────────────────────────────────────────────────
function InstanceModal({ serial, mattresses, startEditing, onClose, onSaved }) {
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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-text-primary/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-brand-mist bg-white p-6 shadow-[0_4px_16px_rgba(5,46,95,0.1)] sm:p-8"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="font-sans text-xs uppercase tracking-[0.25em] text-text-secondary">
              Product Instance
            </p>
            <h3 className="mt-1 font-mono text-lg font-bold text-text-primary" dir="ltr">
              {serial}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-text-secondary transition hover:bg-brand-warm-white"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <p className="font-persian text-sm text-status-error">{error}</p>
        )}

        {!data && !error && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-brand-navy" />
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* QR + status */}
            <div className="flex flex-col items-center gap-4 rounded-xl bg-brand-warm-white p-5 sm:flex-row sm:items-center">
              {data.qr_code && (
                <img
                  src={data.qr_code}
                  alt={`QR ${data.serial_number}`}
                  className="h-36 w-36 rounded-xl border border-brand-mist bg-white p-2"
                />
              )}
              <div className="flex-1 space-y-2 text-center sm:text-right">
                <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                  <Badge ok={data.is_sold} yes="فروخته شده" no="در انبار" />
                  <WarrantyBadge row={data} />
                </div>
                {data.warranty_status === "REJECTED" &&
                  data.warranty_rejection_reason && (
                    <p className="rounded-lg border border-status-error bg-status-error-bg px-3 py-2 font-persian text-xs leading-6 text-status-error">
                      دلیل رد: {data.warranty_rejection_reason}
                    </p>
                  )}
                {data.qr_code && (
                  <button
                    onClick={handleDownloadQR}
                    className="mt-2 inline-flex items-center gap-2 rounded-lg border-2 border-brand-navy bg-white px-4 py-2 font-persian text-sm font-medium text-brand-navy transition hover:bg-brand-warm-white"
                  >
                    <Download size={15} /> دانلود QR
                  </button>
                )}
              </div>
            </div>

            {/* product & warranty */}
            <div className="grid gap-3 sm:grid-cols-2">
              <ProductField
                data={data}
                mattresses={mattresses}
                autoOpen={startEditing}
                onSaved={(updated) => {
                  // The PATCH response is the full detail payload, so the
                  // warranty months and expiry below refresh with it.
                  setData(updated);
                  onSaved();
                }}
              />
              <Field label="برند" value={data.mattress?.brand || "—"} />
              <Field label="مدت گارانتی" value={`${faNum(data.warranty_months)} ماه`} />
              <Field label="تاریخ تولید" value={formatJalali(data.manufacture_date) || "—"} />
              <Field label="تاریخ فعال‌سازی" value={formatJalali(data.activation_date) || "—"} />
              <Field
                label="تاریخ انقضای گارانتی"
                value={formatJalali(data.warranty_expiration_date) || "—"}
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
              <h4 className="mb-3 font-persian text-sm font-semibold text-text-secondary">
                اطلاعات مشتری
              </h4>
              {data.customer ? (
                <div className="space-y-2 rounded-xl border border-brand-mist bg-white p-4">
                  <InfoRow icon={Users} value={`${data.customer.first_name} ${data.customer.last_name}`} />
                  <InfoRow icon={Phone} value={data.customer.phone_number || "—"} ltr />
                  <InfoRow icon={MapPin} value={data.customer.address || "—"} />
                  <InfoRow icon={Mail} value={data.customer.postal_code || "—"} ltr />
                </div>
              ) : (
                <p className="rounded-xl bg-brand-warm-white p-4 font-persian text-sm text-text-secondary">
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
    <div className="rounded-xl border border-brand-mist bg-white p-3">
      <p className="font-persian text-xs text-text-secondary">{label}</p>
      <p className="mt-0.5 font-persian text-sm font-medium text-text-primary">{value}</p>
    </div>
  );
}

function InfoRow({ icon: Icon, value, ltr }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={15} className="shrink-0 text-brand-navy" />
      <span
        className={`font-persian text-sm text-text-primary ${ltr ? "font-mono" : ""}`}
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
  // {serial, edit} — `edit` is true when opened via the row's «ویرایش» button, so
  // the modal lands directly on the model select.
  const [selected, setSelected] = useState(null);
  // Bumped when the modal edits an instance, so the table row behind it and the
  // per-model stat counts pick up the new product without a manual reload.
  const [refreshKey, setRefreshKey] = useState(0);

  // filters
  const [search, setSearch] = useState("");
  const [sold, setSold] = useState("");
  const [warranty, setWarranty] = useState("");
  const [mattressId, setMattressId] = useState("");
  // sort — server-side, whitelisted in mattress/admin_views.INSTANCE_ORDERING
  const [ordering, setOrdering] = useState("newest");

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
        ? { search, sold, warranty, mattress: mattressId, ordering }
        : { search },
    [tab, search, sold, warranty, mattressId, ordering]
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
  }, [tab, params, refreshKey]);

  const resetFilters = () => {
    setSearch("");
    setSold("");
    setWarranty("");
    setMattressId("");
    setOrdering("newest");
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
        <p className="flex items-center gap-2 font-sans text-sm uppercase tracking-[0.3em] text-text-secondary">
          <LayoutDashboard size={16} /> CRM Dashboard
        </p>
        <h1 className="mt-2 font-persian text-3xl font-bold text-brand-navy md:text-4xl">
          داشبورد مدیریت
        </h1>
        <hr className="mt-4 w-24 border-t-2 border-brand-navy" />
      </header>

      {/* stats */}
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Boxes} label="کل محصولات تولیدی" value={stats?.total_instances} accent="text-brand-navy" />
        <StatCard icon={Package} label="فروخته شده" value={stats?.sold_instances} accent="text-status-success" />
        <StatCard icon={ShieldCheck} label="گارانتی فعال" value={stats?.active_warranties} accent="text-brand-navy" />
        <StatCard icon={Clock} label="در انتظار تأیید" value={stats?.pending_warranties} accent="text-brand-navy" />
        <StatCard icon={Users} label="مشتریان" value={stats?.total_customers} accent="text-brand-navy" />
        <StatCard icon={Boxes} label="موجود در انبار" value={stats?.in_stock_instances} accent="text-text-secondary" />
        <StatCard icon={ShieldCheck} label="در دوره گارانتی" value={stats?.under_warranty} accent="text-status-success" />
        <StatCard icon={ShieldOff} label="گارانتی منقضی" value={stats?.expired_warranties} accent="text-status-error" />
        <StatCard icon={LayoutDashboard} label="مدل محصولات" value={stats?.by_mattress?.length} accent="text-brand-navy" />
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
          className="mr-auto inline-flex items-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 font-persian text-sm font-semibold text-white transition hover:bg-action-hover"
        >
          <Download size={16} /> خروجی CSV
        </button>
      </div>

      {/* filters */}
      <div className="mb-6 rounded-xl border border-brand-mist bg-white p-4 shadow-[0_1px_4px_rgba(5,46,95,0.06)]" dir="rtl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                tab === "instances"
                  ? "جستجوی سریال، نام یا تلفن مشتری..."
                  : "جستجوی نام، تلفن یا کد پستی..."
              }
              className="h-12 w-full rounded-lg border border-brand-mist bg-white pr-11 pl-4 text-sm text-text-primary outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20"
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
                <option value="pending">در انتظار تأیید</option>
                <option value="rejected">رد شده</option>
                <option value="inactive">غیرفعال (هر وضعیتی جز فعال)</option>
              </Select>
              <Select value={mattressId} onChange={setMattressId}>
                <option value="">مدل محصول (همه)</option>
                {mattresses.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
              <Select value={ordering} onChange={setOrdering}>
                <option value="newest">جدیدترین (زمان ثبت)</option>
                <option value="oldest">قدیمی‌ترین (زمان ثبت)</option>
                <option value="manufacture_desc">تاریخ تولید: جدید به قدیم</option>
                <option value="manufacture_asc">تاریخ تولید: قدیم به جدید</option>
                <option value="activation_desc">فعال‌سازی: جدید به قدیم</option>
                <option value="activation_asc">فعال‌سازی: قدیم به جدید</option>
                <option value="serial_asc">شماره سریال: صعودی</option>
                <option value="serial_desc">شماره سریال: نزولی</option>
              </Select>
            </>
          )}

          {hasFilters && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-brand-navy bg-white px-4 py-2.5 font-persian text-sm text-brand-navy transition hover:bg-brand-warm-white"
            >
              <RotateCcw size={14} /> پاک کردن
            </button>
          )}
        </div>
      </div>

      {/* table */}
      <div className="overflow-hidden rounded-xl border border-brand-mist bg-white shadow-[0_1px_4px_rgba(5,46,95,0.06)]">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-brand-navy" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center">
            <Filter size={40} className="mx-auto mb-3 text-brand-mist" />
            <p className="font-persian text-sm text-text-secondary">موردی یافت نشد.</p>
          </div>
        ) : tab === "instances" ? (
          <InstanceTable
            rows={rows}
            onSelect={(serial, edit) => setSelected({ serial, edit })}
          />
        ) : (
          <CustomerTable rows={rows} />
        )}
      </div>

      <p className="mt-4 text-center font-persian text-xs text-text-secondary" dir="rtl">
        {faNum(rows.length)} مورد نمایش داده شد
      </p>

      {selected && (
        <InstanceModal
          serial={selected.serial}
          startEditing={selected.edit}
          mattresses={mattresses}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setRefreshKey((k) => k + 1);
            getAdminStats().then(setStats).catch(() => {});
          }}
        />
      )}
    </>
  );
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-persian text-sm font-semibold transition ${
        active
          ? "bg-brand-navy text-white shadow-[0_1px_4px_rgba(5,46,95,0.06)]"
          : "border border-brand-mist bg-white text-text-secondary hover:bg-brand-warm-white"
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
      className="h-12 rounded-lg border border-brand-mist bg-white px-4 font-persian text-sm text-text-primary outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20"
    >
      {children}
    </select>
  );
}

function Th({ children, className = "" }) {
  return (
    <th className={`whitespace-nowrap px-4 py-3 text-right font-persian text-xs font-semibold text-text-secondary ${className}`}>
      {children}
    </th>
  );
}

// Creation instant, Jalali, down to the second — the precision is the point of
// sorting by it, so show the time and not just the day.
const fmtDateTime = (iso) => (iso ? formatJalaliDateTime(iso) || "—" : "—");

function InstanceTable({ rows, onSelect }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full" dir="rtl">
        <thead className="border-b border-brand-mist bg-brand-warm-white">
          <tr>
            <Th>شماره سریال</Th>
            <Th>محصول</Th>
            <Th>مشتری</Th>
            <Th>وضعیت فروش</Th>
            <Th>گارانتی</Th>
            <Th>تاریخ تولید</Th>
            <Th>زمان ثبت</Th>
            <Th className="text-center">جزئیات</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-mist">
          {rows.map((r) => (
            <tr key={r.serial_number} className="transition hover:bg-brand-warm-white">
              <td className="px-4 py-3">
                <span className="font-mono text-sm font-medium text-text-primary" dir="ltr">
                  {r.serial_number}
                </span>
              </td>
              <td className="px-4 py-3 font-persian text-sm text-text-primary">{r.mattress_name}</td>
              <td className="px-4 py-3 font-persian text-sm text-text-primary">
                {r.customer_name || <span className="text-text-secondary">—</span>}
              </td>
              <td className="px-4 py-3">
                <Badge ok={r.is_sold} yes="فروخته شده" no="در انبار" />
              </td>
              <td className="px-4 py-3">
                <WarrantyBadge row={r} />
              </td>
              <td className="px-4 py-3 font-persian text-sm text-text-secondary">
                {formatJalali(r.manufacture_date) || "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-persian text-xs text-text-secondary">
                {fmtDateTime(r.created_at)}
              </td>
              <td className="px-4 py-3 text-center">
                <div className="inline-flex items-center gap-2">
                  <button
                    onClick={() => onSelect(r.serial_number, false)}
                    className="inline-flex items-center gap-1.5 rounded-lg border-2 border-brand-navy bg-white px-3 py-1.5 font-persian text-xs font-medium text-brand-navy transition hover:bg-brand-warm-white"
                  >
                    <QrCode size={14} /> مشاهده
                  </button>
                  {/* Opens the same modal already in edit mode. Repointing a
                      serial at another model is a routine correction, so it
                      needs to be reachable from the row, not only after
                      opening the detail view. */}
                  <button
                    onClick={() => onSelect(r.serial_number, true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand-mist bg-white px-3 py-1.5 font-persian text-xs font-medium text-text-secondary transition hover:border-brand-navy hover:bg-brand-warm-white hover:text-brand-navy"
                  >
                    <Pencil size={14} /> ویرایش
                  </button>
                </div>
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
        <thead className="border-b border-brand-mist bg-brand-warm-white">
          <tr>
            <Th>نام و نام خانوادگی</Th>
            <Th>تلفن</Th>
            <Th>کد پستی</Th>
            <Th>آدرس</Th>
            <Th className="text-center">محصولات</Th>
            <Th className="text-center">گارانتی فعال</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-mist">
          {rows.map((c) => (
            <tr key={c.id} className="transition hover:bg-brand-warm-white">
              <td className="px-4 py-3 font-persian text-sm font-medium text-text-primary">
                {c.full_name || "—"}
              </td>
              <td className="px-4 py-3">
                <span className="font-mono text-sm text-text-primary" dir="ltr">
                  {c.phone_number || "—"}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="font-mono text-sm text-text-secondary" dir="ltr">
                  {c.postal_code || "—"}
                </span>
              </td>
              <td className="max-w-[240px] truncate px-4 py-3 font-persian text-sm text-text-secondary">
                {c.address || "—"}
              </td>
              <td className="px-4 py-3 text-center font-persian text-sm font-semibold text-text-primary">
                {faNum(c.total_products)}
              </td>
              <td className="px-4 py-3 text-center font-persian text-sm font-semibold text-status-success">
                {faNum(c.active_warranties)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
