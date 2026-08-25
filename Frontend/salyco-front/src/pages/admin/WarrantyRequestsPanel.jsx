import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  Search,
  Filter,
  Check,
  X,
  Clock,
  Loader2,
  RotateCcw,
  Phone,
  MapPin,
  Mail,
  User,
  CalendarClock,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import {
  listAdminWarrantyRequests,
  reviewAdminWarrantyRequest,
} from "../../api/admin";
import { getProductImageUrl } from "../../utils/productImage";

const faNum = (n) => Number(n ?? 0).toLocaleString("fa-IR");

const faDateTime = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fa-IR");
  } catch {
    return iso;
  }
};

const STATES = {
  PENDING: {
    label: "در انتظار تأیید",
    fill: "bg-[#E7F3FB]",
    text: "text-[#009CDE]",
    Icon: Clock,
  },
  APPROVED: {
    label: "تأیید شده",
    fill: "bg-[#E6F4EA]",
    text: "text-[#019C34]",
    Icon: CheckCircle2,
  },
  REJECTED: {
    label: "رد شده",
    fill: "bg-[#FDE7E7]",
    text: "text-[#D20000]",
    Icon: XCircle,
  },
};

function StatusPill({ status }) {
  const state = STATES[status] || STATES.PENDING;
  const { Icon } = state;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${state.fill} ${state.text}`}
    >
      <Icon size={13} /> {state.label}
    </span>
  );
}

function InfoRow({ icon: Icon, value, ltr }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={14} className="mt-0.5 shrink-0 text-[#003087]" />
      <span
        className={`font-persian text-sm text-[#1A1A2E] ${ltr ? "font-mono" : ""}`}
        dir={ltr ? "ltr" : "rtl"}
      >
        {value || "—"}
      </span>
    </div>
  );
}

export default function WarrantyRequestsPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  // Defaults to the queue that needs work, not to everything.
  const [statusFilter, setStatusFilter] = useState("PENDING");

  // Serial whose reject form is open, plus the reason typed into it.
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");

  const params = useCallback(
    () => ({ search, status: statusFilter }),
    [search, statusFilter]
  );

  const load = useCallback(() => {
    setLoading(true);
    listAdminWarrantyRequests(params())
      .then((d) => setRows(Array.isArray(d) ? d : d.results || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [params]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const applyDecision = async (serial, payload) => {
    setBusyId(serial);
    setError("");
    try {
      const updated = await reviewAdminWarrantyRequest(serial, payload);
      setRows((rs) =>
        // The decided row usually no longer matches the active filter — the
        // default view is PENDING and it just stopped being pending — so drop
        // it rather than leave a row the filter excludes.
        statusFilter && updated.warranty_status !== statusFilter
          ? rs.filter((r) => r.serial_number !== serial)
          : rs.map((r) => (r.serial_number === serial ? updated : r))
      );
      setRejecting(null);
      setReason("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (serial) => {
    setError("");
    setReason("");
    setRejecting(serial);
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("");
  };

  const hasFilters = search || statusFilter;
  const pending = rows.filter((r) => r.warranty_status === "PENDING").length;

  return (
    <>
      {/* header */}
      <header className="mb-8" dir="rtl">
        <p className="flex items-center gap-2 font-sans text-sm uppercase tracking-[0.3em] text-[#687173]">
          <ShieldCheck size={16} /> Warranty Approvals
        </p>
        <h1 className="mt-2 font-persian text-3xl font-bold text-[#003087] md:text-4xl">
          تأیید گارانتی‌ها
        </h1>
        <hr className="mt-4 w-24 border-t-2 border-[#003087]" />
        <p className="mt-4 font-persian text-sm text-[#687173]">
          درخواست‌های ثبت گارانتی را بررسی کنید. تصویر محصول را با اطلاعات
          خریدار مقایسه کنید؛ گارانتی فقط پس از تأیید شما فعال می‌شود.
          {pending > 0 && (
            <span className="mr-1 font-semibold text-[#009CDE]">
              ({faNum(pending)} درخواست در انتظار تأیید)
            </span>
          )}
        </p>
      </header>

      {/* filters */}
      <div
        className="mb-6 rounded-xl border border-[#CBD2D6] bg-white p-4 shadow-[0_1px_4px_rgba(0,48,135,0.06)]"
        dir="rtl"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search
              size={16}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#687173]"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی سریال، نام یا تلفن خریدار..."
              className="h-12 w-full rounded-lg border border-[#CBD2D6] bg-white pr-11 pl-4 text-sm text-[#1A1A2E] outline-none transition focus:border-[#003087] focus:ring-2 focus:ring-[#009CDE]/20"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-12 rounded-lg border border-[#CBD2D6] bg-white px-4 font-persian text-sm text-[#1A1A2E] outline-none transition focus:border-[#003087] focus:ring-2 focus:ring-[#009CDE]/20"
          >
            <option value="">وضعیت (همه)</option>
            <option value="PENDING">در انتظار تأیید</option>
            <option value="APPROVED">تأیید شده</option>
            <option value="REJECTED">رد شده</option>
          </select>

          {hasFilters && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#003087] bg-white px-4 py-2.5 font-persian text-sm text-[#003087] transition hover:bg-[#F5F7FA]"
            >
              <RotateCcw size={14} /> پاک کردن
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          className="mb-6 rounded-lg border border-[#D20000] bg-[#FDE7E7] px-5 py-3 font-persian text-sm text-[#D20000]"
          dir="rtl"
        >
          {error}
        </div>
      )}

      {/* list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#003087]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-[#CBD2D6] bg-white py-20 text-center shadow-[0_1px_4px_rgba(0,48,135,0.06)]">
          <Filter size={40} className="mx-auto mb-3 text-[#CBD2D6]" />
          <p className="font-persian text-sm text-[#687173]">
            درخواستی یافت نشد.
          </p>
        </div>
      ) : (
        <div className="space-y-4" dir="rtl">
          {rows.map((r) => (
            <div
              key={r.serial_number}
              className="rounded-xl border border-[#CBD2D6] bg-white p-5 shadow-[0_1px_4px_rgba(0,48,135,0.06)]"
            >
              <div className="flex flex-col gap-4 sm:flex-row">
                {/* The photo the customer saw. Approving is a verification
                    decision, so the reviewer needs the same image. */}
                <img
                  src={getProductImageUrl(r.mattress_image)}
                  alt={r.mattress_name}
                  className="h-28 w-28 shrink-0 self-center rounded-xl border border-[#CBD2D6] bg-[#F5F7FA] object-cover"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-persian text-base font-semibold text-[#1A1A2E]">
                      {r.mattress_name}
                    </h3>
                    <StatusPill status={r.warranty_status} />
                    <span className="font-persian text-xs text-[#687173]">
                      {faNum(r.warranty_months)} ماه گارانتی
                    </span>
                  </div>

                  <p
                    className="mt-1 font-mono text-sm text-[#003087]"
                    dir="ltr"
                  >
                    {r.serial_number}
                  </p>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <InfoRow icon={User} value={r.customer_name} />
                    <InfoRow icon={Phone} value={r.customer_phone} ltr />
                    <InfoRow icon={MapPin} value={r.buyer_address} />
                    <InfoRow icon={Mail} value={r.buyer_postal_code} ltr />
                  </div>

                  <p className="mt-3 inline-flex items-center gap-1.5 font-persian text-xs text-[#687173]">
                    <CalendarClock size={13} />
                    ثبت درخواست: {faDateTime(r.warranty_submitted_at)}
                  </p>

                  {r.warranty_status !== "PENDING" && (
                    <p className="mt-1 font-persian text-xs text-[#687173]">
                      بررسی‌شده توسط {r.reviewed_by_name || "—"} ·{" "}
                      {faDateTime(r.warranty_reviewed_at)}
                    </p>
                  )}

                  {r.warranty_rejection_reason && (
                    <p className="mt-3 rounded-lg border border-[#D20000] bg-[#FDE7E7] px-4 py-2 font-persian text-xs leading-6 text-[#D20000]">
                      دلیل رد: {r.warranty_rejection_reason}
                    </p>
                  )}
                </div>
              </div>

              {r.warranty_status === "PENDING" && (
                <div className="mt-4 border-t border-[#CBD2D6] pt-4">
                  {rejecting === r.serial_number ? (
                    <div className="space-y-3">
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        placeholder="دلیل رد درخواست — این متن به مشتری نشان داده می‌شود."
                        className="w-full rounded-lg border border-[#CBD2D6] bg-white p-3 font-persian text-sm text-[#1A1A2E] outline-none transition focus:border-[#003087] focus:ring-2 focus:ring-[#009CDE]/20"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() =>
                            applyDecision(r.serial_number, {
                              action: "reject",
                              rejection_reason: reason.trim(),
                            })
                          }
                          disabled={
                            !reason.trim() || busyId === r.serial_number
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#D20000] px-4 py-2 font-persian text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busyId === r.serial_number ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <X size={14} />
                          )}
                          ثبت رد درخواست
                        </button>
                        <button
                          onClick={() => {
                            setRejecting(null);
                            setReason("");
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#CBD2D6] bg-white px-4 py-2 font-persian text-sm text-[#687173] transition hover:bg-[#F5F7FA]"
                        >
                          انصراف
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          applyDecision(r.serial_number, { action: "approve" })
                        }
                        disabled={busyId === r.serial_number}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#019C34] px-4 py-2 font-persian text-sm font-semibold text-white transition hover:bg-[#017a29] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyId === r.serial_number ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Check size={14} />
                        )}
                        تأیید و فعال‌سازی گارانتی
                      </button>
                      <button
                        onClick={() => openReject(r.serial_number)}
                        disabled={busyId === r.serial_number}
                        className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#D20000] bg-white px-4 py-2 font-persian text-sm font-semibold text-[#D20000] transition hover:bg-[#FDE7E7] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <X size={14} /> رد درخواست
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p
        className="mt-4 text-center font-persian text-xs text-[#687173]"
        dir="rtl"
      >
        {faNum(rows.length)} درخواست نمایش داده شد
      </p>
    </>
  );
}
