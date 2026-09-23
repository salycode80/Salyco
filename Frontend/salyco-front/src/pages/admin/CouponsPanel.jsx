import { useState, useEffect, useCallback } from "react";
import {
  TicketPercent,
  Plus,
  Trash2,
  Loader2,
  Filter,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
  Pencil,
} from "lucide-react";
import {
  listAdminCoupons,
  createAdminCoupon,
  updateAdminCoupon,
  deleteAdminCoupon,
  listAdminCouponRedemptions,
} from "../../api/admin";
import { listMattresses } from "../../api/warranty";
import JalaliDatePicker from "../../components/JalaliDatePicker";
import { formatJalali, formatJalaliDateTime } from "../../utils/jalali";
import { toPersianNumber, formatPersianPrice } from "../../utils/persian";

const CARD =
  "rounded-xl border border-brand-mist bg-white shadow-[0_1px_4px_rgba(5,46,95,0.06)]";
const INPUT =
  "h-12 w-full rounded-lg border border-brand-mist bg-white px-4 font-persian text-sm " +
  "text-text-primary placeholder-text-secondary outline-none transition " +
  "focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20";
const LABEL = "mb-1.5 block font-persian text-sm font-medium text-text-primary";

const EMPTY_FORM = {
  code: "",
  description: "",
  discount_type: "PERCENT",
  percent: "",
  amount: "",
  max_discount_amount: "",
  min_order_amount: "",
  starts_at: "",
  ends_at: "",
  usage_limit: "",
  per_customer_limit: "",
  applies_to_all_products: true,
  is_active: true,
  product_ids: [],
};

// The admin API never sends these, so the labels live here.
const STATUS_LABELS = {
  ACTIVE: "فعال",
  SCHEDULED: "زمان‌بندی‌شده",
  EXPIRED: "منقضی‌شده",
  EXHAUSTED: "تکمیل‌شده",
  INACTIVE: "غیرفعال",
};

const STATUS_CLASSES = {
  ACTIVE: "bg-status-success-bg text-status-success",
  SCHEDULED: "bg-brand-warm-white text-brand-navy",
  EXPIRED: "bg-status-error-bg text-status-error",
  EXHAUSTED: "bg-status-error-bg text-status-error",
  INACTIVE: "bg-brand-warm-white text-text-secondary",
};

// <input type="date"> wants YYYY-MM-DD; the API sends an ISO datetime or null.
function toDateInput(value) {
  return value ? String(value).slice(0, 10) : "";
}

// An empty string means "unbounded", which the API spells as null. Numbers are
// sent as numbers, not strings, so DRF does not have to coerce them.
function optionalInt(value) {
  const trimmed = String(value).trim();
  return trimmed === "" ? null : Number(trimmed);
}

function optionalMoney(value) {
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function payloadFrom(form) {
  const percent = optionalInt(form.percent);
  const amount = optionalMoney(form.amount);
  return {
    code: form.code.trim(),
    description: form.description.trim(),
    discount_type: form.discount_type,
    // Exactly one of the two is sent: the model rejects a coupon carrying both.
    percent: form.discount_type === "PERCENT" ? percent : null,
    amount: form.discount_type === "FIXED" ? amount : null,
    max_discount_amount:
      form.discount_type === "PERCENT"
        ? optionalMoney(form.max_discount_amount)
        : null,
    min_order_amount: optionalMoney(form.min_order_amount) || "0",
    // Dates are sent as-is; the API stores datetimes and Django parses the
    // date-only string as midnight, which is what a day boundary should mean.
    starts_at: form.starts_at || null,
    expires_at: form.ends_at || null,
    usage_limit: optionalInt(form.usage_limit),
    per_customer_limit: optionalInt(form.per_customer_limit),
    applies_to_all_products: form.applies_to_all_products,
    is_active: form.is_active,
    product_ids: form.applies_to_all_products ? [] : form.product_ids,
  };
}

export default function CouponsPanel() {
  const [rows, setRows] = useState([]);
  const [mattresses, setMattresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  // Redemptions are fetched per row on first expand and cached by id, so the
  // coupon list itself stays a single request.
  const [expandedId, setExpandedId] = useState(null);
  const [redemptions, setRedemptions] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listAdminCoupons());
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred a tick: load() sets the loading flag, and doing that
    // synchronously in the effect body forces a cascading render before the
    // first paint. The spinner shows either way — `loading` starts true.
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  // The product picker's options, from GET /api/mattress/ — the same source the
  // other admin panels read, so no new endpoint.
  useEffect(() => {
    let alive = true;
    listMattresses()
      .then((data) => {
        if (alive) setMattresses(Array.isArray(data) ? data : data.results || []);
      })
      .catch(() => {
        // Not fatal: a catalogue-wide coupon needs no options, and the rest of
        // the panel still works with the picker empty.
      });
    return () => {
      alive = false;
    };
  }, []);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError("");
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setFormError("");
    setForm({
      code: row.code,
      description: row.description || "",
      discount_type: row.discount_type,
      percent: row.percent ?? "",
      amount: row.amount ?? "",
      max_discount_amount: row.max_discount_amount ?? "",
      min_order_amount: row.min_order_amount ?? "",
      // <input type="date"> only accepts YYYY-MM-DD; the API sends an ISO
      // datetime or null.
      starts_at: toDateInput(row.starts_at),
      ends_at: toDateInput(row.expires_at),
      usage_limit: row.usage_limit ?? "",
      per_customer_limit: row.per_customer_limit ?? "",
      applies_to_all_products: row.applies_to_all_products,
      is_active: row.is_active,
      // The write side is reconstructed from the read side's mattress_id.
      product_ids: (row.products || []).map((p) => p.mattress_id),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleProduct = (id) =>
    setForm((f) => ({
      ...f,
      product_ids: f.product_ids.includes(id)
        ? f.product_ids.filter((p) => p !== id)
        : [...f.product_ids, id],
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    // Clear the panel-level error too, or the last failed delete keeps sitting
    // above a form that has since been corrected.
    setError("");
    try {
      const payload = payloadFrom(form);
      if (editingId) await updateAdminCoupon(editingId, payload);
      else await createAdminCoupon(payload);
      resetForm();
      await load();
    } catch (err) {
      // The server's Persian, verbatim: it knows which rule failed.
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (row) => {
    setBusyId(row.id);
    setError("");
    try {
      const updated = await updateAdminCoupon(row.id, {
        is_active: !row.is_active,
      });
      setRows((rs) => rs.map((r) => (r.id === row.id ? updated : r)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  // Unlike AllowedLocationsPanel's, this delete must NOT swallow the error:
  // "این کد تخفیف استفاده شده و قابل حذف نیست" is the message the admin needs,
  // and it is the only way they learn the coupon has to be deactivated instead.
  const handleDelete = async (id) => {
    if (!window.confirm("این کد تخفیف حذف شود؟")) return;
    setBusyId(id);
    setError("");
    try {
      await deleteAdminCoupon(id);
      setRows((rs) => rs.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleExpand = async (row) => {
    if (expandedId === row.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(row.id);
    if (redemptions[row.id]) return; // already fetched
    try {
      const data = await listAdminCouponRedemptions(row.id);
      setRedemptions((r) => ({ ...r, [row.id]: data }));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <p className="flex items-center gap-2 font-sans text-sm uppercase tracking-[0.3em] text-text-secondary">
        <TicketPercent size={16} aria-hidden="true" />
        Discount Codes
      </p>
      <h1 className="mt-2 font-persian text-3xl font-bold text-brand-navy md:text-4xl">
        کدهای تخفیف
      </h1>
      <hr className="mt-4 w-24 border-t-2 border-brand-navy" />
      <p className="mt-4 max-w-2xl font-persian text-sm leading-7 text-text-secondary">
        کدهای تخفیف را تعریف کنید؛ می‌توانید بازهٔ اعتبار، سقف استفاده، حداقل مبلغ
        سفارش و محصولات مشمول را تعیین کنید.
      </p>

      {/* ── create / edit ── */}
      <form onSubmit={handleSubmit} className={`${CARD} mt-6 p-4 md:p-6`}>
        <h2 className="mb-4 font-persian text-lg font-semibold text-brand-navy">
          {editingId ? "ویرایش کد تخفیف" : "افزودن کد تخفیف"}
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="c-code" className={LABEL}>
              کد تخفیف
            </label>
            <input
              id="c-code"
              dir="ltr"
              required
              value={form.code}
              onChange={(e) => set("code", e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="c-desc" className={LABEL}>
              توضیح
            </label>
            <input
              id="c-desc"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className={INPUT}
            />
          </div>
        </div>

        <div className="mt-4">
          <span className={LABEL}>نوع تخفیف</span>
          <div className="flex gap-2">
            {[
              ["PERCENT", "درصدی"],
              ["FIXED", "مبلغ ثابت"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => set("discount_type", value)}
                aria-pressed={form.discount_type === value}
                className={
                  form.discount_type === value
                    ? "rounded-lg bg-brand-navy px-5 py-2.5 font-persian text-sm font-bold text-white"
                    : "rounded-lg border-2 border-brand-navy bg-white px-5 py-2.5 font-persian text-sm font-bold text-brand-navy"
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {form.discount_type === "PERCENT" ? (
            <>
              <div>
                <label htmlFor="c-pct" className={LABEL}>
                  درصد تخفیف
                </label>
                <input
                  id="c-pct"
                  type="number"
                  min="1"
                  max="99"
                  value={form.percent}
                  onChange={(e) => set("percent", e.target.value)}
                  className={INPUT}
                />
              </div>
              <div>
                <label htmlFor="c-max" className={LABEL}>
                  سقف تخفیف (تومان)
                </label>
                <input
                  id="c-max"
                  type="number"
                  min="0"
                  placeholder="بدون سقف"
                  value={form.max_discount_amount}
                  onChange={(e) => set("max_discount_amount", e.target.value)}
                  className={INPUT}
                />
              </div>
            </>
          ) : (
            <div>
              <label htmlFor="c-amt" className={LABEL}>
                مبلغ تخفیف (تومان)
              </label>
              <input
                id="c-amt"
                type="number"
                min="0"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                className={INPUT}
              />
            </div>
          )}
          <div>
            <label htmlFor="c-min" className={LABEL}>
              حداقل مبلغ سفارش (تومان)
            </label>
            <input
              id="c-min"
              type="number"
              min="0"
              placeholder="بدون حداقل"
              value={form.min_order_amount}
              onChange={(e) => set("min_order_amount", e.target.value)}
              className={INPUT}
            />
          </div>
        </div>

        {/* Jalali pickers. The form still holds Gregorian "YYYY-MM-DD" strings —
            that is what payloadFrom() sends and what the API stores — so only
            the face of these two controls changed. */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="c-start" className={LABEL}>
              تاریخ شروع
            </label>
            <JalaliDatePicker
              id="c-start"
              value={form.starts_at}
              onChange={(v) => set("starts_at", v)}
            />
          </div>
          <div>
            <label htmlFor="c-end" className={LABEL}>
              تاریخ پایان
            </label>
            <JalaliDatePicker
              id="c-end"
              value={form.ends_at}
              onChange={(v) => set("ends_at", v)}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="c-uses" className={LABEL}>
              سقف کل استفاده
            </label>
            <input
              id="c-uses"
              type="number"
              min="1"
              placeholder="نامحدود"
              value={form.usage_limit}
              onChange={(e) => set("usage_limit", e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="c-per" className={LABEL}>
              سقف استفاده هر کاربر
            </label>
            <input
              id="c-per"
              type="number"
              min="1"
              placeholder="نامحدود"
              value={form.per_customer_limit}
              onChange={(e) => set("per_customer_limit", e.target.value)}
              className={INPUT}
            />
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-brand-mist p-3">
          <label className="flex cursor-pointer items-center gap-2 font-persian text-sm font-medium text-text-primary">
            <input
              type="checkbox"
              checked={form.applies_to_all_products}
              onChange={(e) => set("applies_to_all_products", e.target.checked)}
              className="h-4 w-4 accent-brand-navy"
            />
            همهٔ محصولات
          </label>

          {!form.applies_to_all_products && (
            <>
              <p className="mt-2 font-persian text-xs text-text-secondary">
                محصولات مشمول را انتخاب کنید (
                {toPersianNumber(form.product_ids.length)} انتخاب‌شده)
              </p>
              <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-brand-mist p-2">
                {mattresses.length === 0 ? (
                  <p className="p-2 font-persian text-sm text-text-secondary">
                    محصولی یافت نشد.
                  </p>
                ) : (
                  mattresses.map((m) => (
                    <label
                      key={m.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 font-persian text-sm text-text-primary hover:bg-brand-warm-white"
                    >
                      <input
                        type="checkbox"
                        checked={form.product_ids.includes(m.id)}
                        onChange={() => toggleProduct(m.id)}
                        className="h-4 w-4 accent-brand-navy"
                      />
                      {m.name}
                    </label>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {formError && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-status-error-bg px-4 py-2.5 font-persian text-sm text-status-error"
          >
            {formError}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-6 py-3 font-persian text-sm font-bold text-white transition hover:bg-action-hover disabled:opacity-60"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Plus size={16} aria-hidden="true" />
            )}
            {editingId ? "ذخیره تغییرات" : "افزودن کد تخفیف"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border-2 border-brand-navy px-6 py-3 font-persian text-sm font-bold text-brand-navy transition hover:bg-brand-warm-white"
            >
              انصراف
            </button>
          )}
        </div>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-lg bg-status-error-bg px-4 py-2.5 font-persian text-sm text-status-error"
        >
          {error}
        </p>
      )}

      {/* ── list ── */}
      <div className="mt-6 flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2
              className="animate-spin text-brand-navy"
              size={28}
              aria-hidden="true"
            />
          </div>
        ) : rows.length === 0 ? (
          <div className={`${CARD} flex flex-col items-center gap-3 py-12`}>
            <Filter size={40} className="text-brand-mist" aria-hidden="true" />
            <p className="font-persian text-sm text-text-secondary">
              هنوز کد تخفیفی تعریف نشده است.
            </p>
          </div>
        ) : (
          rows.map((row) => {
            const busy = busyId === row.id;
            const open = expandedId === row.id;
            return (
              <div key={row.id} className={`${CARD} p-4`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        dir="ltr"
                        className="font-sans text-base font-bold text-brand-navy"
                      >
                        {row.code}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 font-persian text-xs font-medium ${
                          STATUS_CLASSES[row.status] || STATUS_CLASSES.INACTIVE
                        }`}
                      >
                        {STATUS_LABELS[row.status] || row.status}
                      </span>
                    </div>

                    {row.description && (
                      <p className="mt-1 font-persian text-sm text-text-secondary">
                        {row.description}
                      </p>
                    )}

                    <p className="mt-2 font-persian text-sm text-text-primary">
                      {row.discount_type === "PERCENT"
                        ? `٪${toPersianNumber(row.percent)}${
                            row.max_discount_amount
                              ? ` (حداکثر ${formatPersianPrice(
                                  row.max_discount_amount
                                )} تومان)`
                              : ""
                          }`
                        : `${formatPersianPrice(row.amount)} تومان`}
                    </p>

                    <p className="mt-1 font-persian text-xs text-text-secondary">
                      اعتبار:{" "}
                      {row.starts_at || row.expires_at
                        ? `${formatJalali(row.starts_at) || "—"} تا ${
                            formatJalali(row.expires_at) || "—"
                          }`
                        : "بدون محدودیت زمانی"}
                    </p>

                    <p className="mt-1 font-persian text-xs text-text-secondary">
                      استفاده: {toPersianNumber(row.redeemed_count)} از{" "}
                      {row.usage_limit === null
                        ? "نامحدود"
                        : toPersianNumber(row.usage_limit)}
                      {" · "}
                      {row.applies_to_all_products
                        ? "همهٔ محصولات"
                        : `${toPersianNumber((row.products || []).length)} محصول`}
                      {Number(row.min_order_amount) > 0 &&
                        ` · حداقل خرید ${formatPersianPrice(
                          row.min_order_amount
                        )} تومان`}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      className="inline-flex items-center gap-1.5 rounded-lg border-2 border-brand-navy px-3 py-2 font-persian text-sm font-bold text-brand-navy transition hover:bg-brand-warm-white"
                    >
                      <Pencil size={15} aria-hidden="true" />
                      ویرایش
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggle(row)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border-2 border-brand-navy px-3 py-2 font-persian text-sm font-bold text-brand-navy transition hover:bg-brand-warm-white disabled:opacity-60"
                    >
                      {busy ? (
                        <Loader2
                          size={15}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                      ) : row.is_active ? (
                        <ToggleRight size={16} aria-hidden="true" />
                      ) : (
                        <ToggleLeft size={16} aria-hidden="true" />
                      )}
                      {row.is_active ? "غیرفعال کن" : "فعال کن"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(row.id)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border-2 border-status-error px-3 py-2 font-persian text-sm font-bold text-status-error transition hover:bg-status-error-bg disabled:opacity-60"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      حذف
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExpand(row)}
                      aria-expanded={open}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-persian text-sm font-medium text-text-secondary transition hover:bg-brand-warm-white"
                    >
                      {open ? (
                        <ChevronUp size={16} aria-hidden="true" />
                      ) : (
                        <ChevronDown size={16} aria-hidden="true" />
                      )}
                      استفاده‌ها
                    </button>
                  </div>
                </div>

                {open && (
                  <div className="mt-3 border-t border-brand-mist pt-3">
                    {(redemptions[row.id] || []).length === 0 ? (
                      <p className="font-persian text-sm text-text-secondary">
                        هنوز استفاده نشده است.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[420px] text-right font-persian text-sm">
                          <thead>
                            <tr className="text-xs text-text-secondary">
                              <th className="pb-2 font-medium">تاریخ</th>
                              <th className="pb-2 font-medium">مشتری</th>
                              <th className="pb-2 font-medium">موبایل</th>
                              <th className="pb-2 font-medium">مبلغ تخفیف</th>
                            </tr>
                          </thead>
                          <tbody>
                            {redemptions[row.id].map((r) => (
                              <tr key={r.id} className="border-t border-brand-mist">
                                <td className="py-2 [font-feature-settings:'tnum']">
                                  {formatJalaliDateTime(r.created_at)}
                                </td>
                                <td className="py-2">{r.customer_name}</td>
                                <td className="py-2 [font-feature-settings:'tnum']">
                                  {toPersianNumber(r.phone_number)}
                                </td>
                                <td className="py-2 [font-feature-settings:'tnum']">
                                  {formatPersianPrice(r.amount)} تومان
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
