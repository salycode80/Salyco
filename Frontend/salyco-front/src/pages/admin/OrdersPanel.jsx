import { useState, useEffect, useCallback } from "react";
import {
  ShoppingBag,
  Search,
  Filter,
  Trash2,
  Truck,
  Phone,
  Loader2,
  RotateCcw,
  MapPin,
  User,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  listAdminOrders,
  updateAdminOrder,
  deleteAdminOrder,
} from "../../api/admin";
import { toPersianNumber, formatPersianPrice } from "../../utils/persian";

const faDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fa-IR");
  } catch {
    return iso;
  }
};

// Order lifecycle → badge colors.
const STATUS_META = {
  PENDING: { label: "در انتظار", cls: "bg-status-warning-bg text-status-warning" },
  CONFIRMED: { label: "تأیید شده", cls: "bg-status-info-bg text-brand-navy" },
  SHIPPED: { label: "ارسال شده", cls: "bg-status-success-bg text-status-success" },
  CANCELLED: { label: "لغو شده", cls: "bg-status-error-bg text-status-error" },
};
const STATUS_ORDER = ["PENDING", "CONFIRMED", "SHIPPED", "CANCELLED"];

function OrderCard({ order, busy, onStatus, onDelete }) {
  const [open, setOpen] = useState(false);
  const isPhone = order.method === "PHONE";

  return (
    <div className="rounded-xl border border-brand-mist bg-white p-5 shadow-[0_1px_4px_rgba(5,46,95,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-persian text-base font-semibold text-text-primary">
              سفارش #{toPersianNumber(order.id)}
            </h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                isPhone
                  ? "bg-status-success-bg text-status-success"
                  : "bg-status-info-bg text-brand-navy"
              }`}
            >
              {isPhone ? <Phone size={12} /> : <Truck size={12} />}
              {order.method_display}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                STATUS_META[order.status]?.cls || ""
              }`}
            >
              {STATUS_META[order.status]?.label || order.status}
            </span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 font-persian text-xs text-text-secondary">
            <span className="inline-flex items-center gap-1">
              <User size={12} /> {order.customer_name}
            </span>
            {order.phone_number && (
              <span className="inline-flex items-center gap-1" dir="ltr">
                <Phone size={12} /> {order.phone_number}
              </span>
            )}
            {order.customer_phone && order.method === "PHONE" && (
              <span className="inline-flex items-center gap-1" dir="ltr">
                <Phone size={12} /> تماس مشتری: {order.customer_phone}
              </span>
            )}
            {order.call_time_preference && order.method === "PHONE" && (
              <span className="inline-flex items-center gap-1">
                <span className="text-status-success">⏰</span> ترجیح: {order.call_time_preference}
              </span>
            )}
            <span>{faDate(order.created_at)}</span>
          </p>
        </div>

        {/* The discount sits above the total rather than in a row of its own:
            a total below its sum of line items otherwise reads as an error to
            whoever is reconciling the order. */}
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {Number(order.discount_amount) > 0 && (
            <span className="font-persian text-xs font-medium text-status-success [font-feature-settings:'tnum']">
              تخفیف {order.coupon_code && `(${order.coupon_code})`}−
              {formatPersianPrice(order.discount_amount)}
            </span>
          )}
          <span className="font-persian text-base font-bold text-brand-navy [font-feature-settings:'tnum']">
            {formatPersianPrice(order.total_amount)}
            <span className="mr-1 text-xs font-normal text-text-secondary">تومان</span>
          </span>
        </div>
      </div>

      {/* Shipping address for online orders */}
      {!isPhone && (order.province || order.address) && (
        <p className="mt-3 flex items-start gap-1.5 font-persian text-sm text-text-secondary">
          <MapPin size={15} className="mt-0.5 shrink-0 text-brand-navy" />
          {[order.province, order.city, order.address].filter(Boolean).join("، ")}
          {order.postal_code ? ` — کد پستی ${toPersianNumber(order.postal_code)}` : ""}
        </p>
      )}

      {/* Items (collapsible) */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-3 inline-flex items-center gap-1 font-persian text-sm font-medium text-brand-navy hover:text-brand-navy"
      >
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        {toPersianNumber(order.items?.length || 0)} قلم کالا
      </button>
      {open && (
        <div className="mt-2 divide-y divide-brand-mist rounded-lg border border-brand-mist">
          {order.items?.map((it) => (
            <div
              key={it.id}
              className="flex items-center justify-between px-3 py-2 text-sm"
            >
              <span className="text-text-primary">
                {it.mattress_name}
                {it.size_label ? ` (${it.size_label})` : ""}
                <span className="text-text-secondary">
                  {" "}
                  × {toPersianNumber(it.quantity)}
                </span>
              </span>
              <span className="text-text-secondary [font-feature-settings:'tnum']">
                {formatPersianPrice(it.line_total)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-brand-mist pt-4">
        <span className="font-persian text-sm text-text-secondary">تغییر وضعیت:</span>
        <select
          value={order.status}
          disabled={busy}
          onChange={(e) => onStatus(order.id, e.target.value)}
          className="h-9 rounded-lg border border-brand-mist bg-white px-3 font-persian text-sm text-text-primary outline-none transition focus:border-brand-navy disabled:opacity-60"
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
        {busy && <Loader2 size={16} className="animate-spin text-brand-navy" />}
        <button
          onClick={() => onDelete(order.id)}
          disabled={busy}
          className="mr-auto inline-flex items-center gap-1.5 rounded-lg border-2 border-status-error bg-white px-4 py-2 font-persian text-sm font-semibold text-status-error transition hover:bg-status-error-bg disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 size={14} /> حذف
        </button>
      </div>
    </div>
  );
}

export default function OrdersPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  // sort — server-side, whitelisted in orders/admin_views.ORDER_ORDERING
  const [ordering, setOrdering] = useState("newest");

  const params = useCallback(
    () => ({
      search,
      status: statusFilter,
      method: methodFilter,
      ordering,
    }),
    [search, statusFilter, methodFilter, ordering]
  );

  const load = useCallback(() => {
    setLoading(true);
    listAdminOrders(params())
      .then((d) => setRows(Array.isArray(d) ? d : d.results || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [params]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const handleStatus = async (id, status) => {
    setBusyId(id);
    try {
      await updateAdminOrder(id, { status });
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    } catch {
      /* keep row as-is on error */
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("این سفارش حذف شود؟ این عمل قابل بازگشت نیست.")) return;
    setBusyId(id);
    try {
      await deleteAdminOrder(id);
      setRows((rs) => rs.filter((r) => r.id !== id));
    } catch {
      /* keep row on error */
    } finally {
      setBusyId(null);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setMethodFilter("");
    setOrdering("newest");
  };

  const hasFilters = search || statusFilter || methodFilter;
  const pending = rows.filter((r) => r.status === "PENDING").length;

  return (
    <>
      {/* header */}
      <header className="mb-8" dir="rtl">
        <p className="flex items-center gap-2 font-sans text-sm uppercase tracking-[0.3em] text-text-secondary">
          <ShoppingBag size={16} /> Orders
        </p>
        <h1 className="mt-2 font-persian text-3xl font-bold text-brand-navy md:text-4xl">
          مدیریت سفارش‌ها
        </h1>
        <hr className="mt-4 w-24 border-t-2 border-brand-navy" />
        <p className="mt-4 font-persian text-sm text-text-secondary">
          سفارش‌های ثبت‌شده مشتریان را بررسی و وضعیت آن‌ها را مدیریت کنید.
          {pending > 0 && (
            <span className="mr-1 font-semibold text-status-warning">
              ({toPersianNumber(pending)} سفارش در انتظار)
            </span>
          )}
        </p>
      </header>

      {/* filters */}
      <div
        className="mb-6 rounded-xl border border-brand-mist bg-white p-4 shadow-[0_1px_4px_rgba(5,46,95,0.06)]"
        dir="rtl"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search
              size={16}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی نام، تلفن، شهر..."
              className="h-12 w-full rounded-lg border border-brand-mist bg-white pr-11 pl-4 text-sm text-text-primary outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-12 rounded-lg border border-brand-mist bg-white px-4 font-persian text-sm text-text-primary outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20"
          >
            <option value="">وضعیت (همه)</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="h-12 rounded-lg border border-brand-mist bg-white px-4 font-persian text-sm text-text-primary outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20"
          >
            <option value="">روش (همه)</option>
            <option value="ONLINE">آنلاین</option>
            <option value="PHONE">تلفنی</option>
          </select>

          <select
            value={ordering}
            onChange={(e) => setOrdering(e.target.value)}
            className="h-12 rounded-lg border border-brand-mist bg-white px-4 font-persian text-sm text-text-primary outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20"
          >
            <option value="newest">جدیدترین (زمان ثبت)</option>
            <option value="oldest">قدیمی‌ترین (زمان ثبت)</option>
            <option value="amount_desc">مبلغ: بیشترین</option>
            <option value="amount_asc">مبلغ: کمترین</option>
            <option value="status">وضعیت</option>
            <option value="recipient">نام تحویل‌گیرنده</option>
          </select>

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

      {/* list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-brand-navy" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-brand-mist bg-white py-20 text-center shadow-[0_1px_4px_rgba(5,46,95,0.06)]">
          <Filter size={40} className="mx-auto mb-3 text-brand-mist" />
          <p className="font-persian text-sm text-text-secondary">سفارشی یافت نشد.</p>
        </div>
      ) : (
        <div className="space-y-4" dir="rtl">
          {rows.map((r) => (
            <OrderCard
              key={r.id}
              order={r}
              busy={busyId === r.id}
              onStatus={handleStatus}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <p className="mt-4 text-center font-persian text-xs text-text-secondary" dir="rtl">
        {toPersianNumber(rows.length)} سفارش نمایش داده شد
      </p>
    </>
  );
}
