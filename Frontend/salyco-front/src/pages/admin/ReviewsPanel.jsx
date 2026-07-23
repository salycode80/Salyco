import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Star,
  Search,
  Filter,
  Check,
  X,
  Trash2,
  CheckCircle2,
  Clock,
  Loader2,
  RotateCcw,
} from "lucide-react";
import {
  listAdminReviews,
  updateAdminReview,
  deleteAdminReview,
} from "../../api/admin";

const faDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fa-IR");
  } catch {
    return iso;
  }
};

function Stars({ rating }) {
  return (
    <div className="flex gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={14}
          className={
            i <= rating ? "fill-[#F5BA2E] text-[#F5BA2E]" : "text-[#CBD2D6]"
          }
        />
      ))}
    </div>
  );
}

function StatusBadge({ approved }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
        approved
          ? "bg-[#E6F4EA] text-[#019C34]"
          : "bg-[#FFF8E1] text-[#F5BA2E]"
      }`}
    >
      {approved ? <CheckCircle2 size={13} /> : <Clock size={13} />}
      {approved ? "تأیید شده" : "در انتظار تأیید"}
    </span>
  );
}

export default function ReviewsPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [search, setSearch] = useState("");
  const [approved, setApproved] = useState(""); // "" | "true" | "false"

  const params = useCallback(
    () => ({ search, is_approved: approved }),
    [search, approved]
  );

  const load = useCallback(() => {
    setLoading(true);
    listAdminReviews(params())
      .then((d) => setRows(Array.isArray(d) ? d : d.results || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [params]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const handleApprove = async (id) => {
    setBusyId(id);
    try {
      await updateAdminReview(id, { is_approved: true });
      setRows((rs) =>
        rs.map((r) => (r.id === id ? { ...r, is_approved: true } : r))
      );
    } catch {
      /* keep row as-is on error */
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm("این نظر حذف شود؟ این عمل قابل بازگشت نیست.")) return;
    setBusyId(id);
    try {
      await deleteAdminReview(id);
      setRows((rs) => rs.filter((r) => r.id !== id));
    } catch {
      /* keep row on error */
    } finally {
      setBusyId(null);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setApproved("");
  };

  const hasFilters = search || approved;
  const pending = rows.filter((r) => !r.is_approved).length;

  return (
    <>
      {/* header */}
      <header className="mb-8" dir="rtl">
        <p className="flex items-center gap-2 font-sans text-sm uppercase tracking-[0.3em] text-[#687173]">
          <MessageSquare size={16} /> Reviews Moderation
        </p>
        <h1 className="mt-2 font-persian text-3xl font-bold text-[#003087] md:text-4xl">
          مدیریت نظرات
        </h1>
        <hr className="mt-4 w-24 border-t-2 border-[#003087]" />
        <p className="mt-4 font-persian text-sm text-[#687173]">
          نظرات ثبت‌شده توسط کاربران را بررسی کنید. نظرات تأییدشده در صفحه محصول
          نمایش داده می‌شوند.
          {pending > 0 && (
            <span className="mr-1 font-semibold text-[#F5BA2E]">
              ({pending.toLocaleString("fa-IR")} نظر در انتظار تأیید)
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
              placeholder="جستجوی عنوان، متن یا نام کاربر..."
              className="h-12 w-full rounded-lg border border-[#CBD2D6] bg-white pr-11 pl-4 text-sm text-[#1A1A2E] outline-none transition focus:border-[#003087] focus:ring-2 focus:ring-[#009CDE]/20"
            />
          </div>

          <select
            value={approved}
            onChange={(e) => setApproved(e.target.value)}
            className="h-12 rounded-lg border border-[#CBD2D6] bg-white px-4 font-persian text-sm text-[#1A1A2E] outline-none transition focus:border-[#003087] focus:ring-2 focus:ring-[#009CDE]/20"
          >
            <option value="">وضعیت (همه)</option>
            <option value="false">در انتظار تأیید</option>
            <option value="true">تأیید شده</option>
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

      {/* list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#003087]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-[#CBD2D6] bg-white py-20 text-center shadow-[0_1px_4px_rgba(0,48,135,0.06)]">
          <Filter size={40} className="mx-auto mb-3 text-[#CBD2D6]" />
          <p className="font-persian text-sm text-[#687173]">نظری یافت نشد.</p>
        </div>
      ) : (
        <div className="space-y-4" dir="rtl">
          {rows.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-[#CBD2D6] bg-white p-5 shadow-[0_1px_4px_rgba(0,48,135,0.06)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-persian text-base font-semibold text-[#1A1A2E]">
                      {r.title}
                    </h3>
                    <Stars rating={r.rating} />
                    <StatusBadge approved={r.is_approved} />
                  </div>
                  <p className="mt-1 font-persian text-xs text-[#687173]">
                    {r.customer_name} · {r.mattress_name} · {faDate(r.created_at)}
                  </p>
                </div>
              </div>

              <p className="mt-3 font-persian text-sm leading-7 text-[#687173]">
                {r.body}
              </p>

              {(r.pros || r.cons) && (
                <div className="mt-3 flex flex-wrap gap-4 font-persian text-xs">
                  {r.pros && (
                    <span className="text-[#019C34]">
                      <Check size={12} className="ml-1 inline" />
                      {r.pros}
                    </span>
                  )}
                  {r.cons && (
                    <span className="text-[#D20000]">
                      <X size={12} className="ml-1 inline" />
                      {r.cons}
                    </span>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2 border-t border-[#CBD2D6] pt-4">
                {!r.is_approved && (
                  <button
                    onClick={() => handleApprove(r.id)}
                    disabled={busyId === r.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#019C34] px-4 py-2 font-persian text-sm font-semibold text-white transition hover:bg-[#017a29] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyId === r.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    تأیید و نمایش
                  </button>
                )}
                <button
                  onClick={() => handleReject(r.id)}
                  disabled={busyId === r.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#D20000] bg-white px-4 py-2 font-persian text-sm font-semibold text-[#D20000] transition hover:bg-[#FDE7E7] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 size={14} />
                  {r.is_approved ? "حذف" : "رد و حذف"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p
        className="mt-4 text-center font-persian text-xs text-[#687173]"
        dir="rtl"
      >
        {rows.length.toLocaleString("fa-IR")} نظر نمایش داده شد
      </p>
    </>
  );
}
