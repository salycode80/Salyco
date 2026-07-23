import { useState, useEffect, useCallback } from "react";
import {
  Inbox,
  Search,
  Filter,
  Trash2,
  Mail,
  Phone,
  MailOpen,
  Loader2,
  RotateCcw,
  User,
} from "lucide-react";
import {
  listAdminSuggestions,
  updateAdminSuggestion,
  deleteAdminSuggestion,
} from "../../api/admin";

const faDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fa-IR");
  } catch {
    return iso;
  }
};

export default function SuggestionsPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [search, setSearch] = useState("");
  const [read, setRead] = useState(""); // "" | "true" | "false"

  const params = useCallback(
    () => ({ search, is_read: read }),
    [search, read]
  );

  const load = useCallback(() => {
    setLoading(true);
    listAdminSuggestions(params())
      .then((d) => setRows(Array.isArray(d) ? d : d.results || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [params]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const toggleRead = async (row) => {
    setBusyId(row.id);
    try {
      await updateAdminSuggestion(row.id, { is_read: !row.is_read });
      setRows((rs) =>
        rs.map((r) => (r.id === row.id ? { ...r, is_read: !r.is_read } : r))
      );
    } catch {
      /* keep row as-is on error */
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("این پیام حذف شود؟ این عمل قابل بازگشت نیست.")) return;
    setBusyId(id);
    try {
      await deleteAdminSuggestion(id);
      setRows((rs) => rs.filter((r) => r.id !== id));
    } catch {
      /* keep row on error */
    } finally {
      setBusyId(null);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setRead("");
  };

  const hasFilters = search || read;
  const unread = rows.filter((r) => !r.is_read).length;

  return (
    <>
      {/* header */}
      <header className="mb-8" dir="rtl">
        <p className="flex items-center gap-2 font-sans text-sm uppercase tracking-[0.3em] text-[#687173]">
          <Inbox size={16} /> Suggestions Inbox
        </p>
        <h1 className="mt-2 font-persian text-3xl font-bold text-[#003087] md:text-4xl">
          نظرات و پیشنهادات
        </h1>
        <hr className="mt-4 w-24 border-t-2 border-[#003087]" />
        <p className="mt-4 font-persian text-sm text-[#687173]">
          پیام‌های ارسالی از فرم تماس با ما.
          {unread > 0 && (
            <span className="mr-1 font-semibold text-[#003087]">
              ({unread.toLocaleString("fa-IR")} پیام خوانده‌نشده)
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
              placeholder="جستجوی نام، ایمیل، تلفن یا متن..."
              className="h-12 w-full rounded-lg border border-[#CBD2D6] bg-white pr-11 pl-4 text-sm text-[#1A1A2E] outline-none transition focus:border-[#003087] focus:ring-2 focus:ring-[#009CDE]/20"
            />
          </div>

          <select
            value={read}
            onChange={(e) => setRead(e.target.value)}
            className="h-12 rounded-lg border border-[#CBD2D6] bg-white px-4 font-persian text-sm text-[#1A1A2E] outline-none transition focus:border-[#003087] focus:ring-2 focus:ring-[#009CDE]/20"
          >
            <option value="">وضعیت (همه)</option>
            <option value="false">خوانده‌نشده</option>
            <option value="true">خوانده‌شده</option>
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
          <p className="font-persian text-sm text-[#687173]">پیامی یافت نشد.</p>
        </div>
      ) : (
        <div className="space-y-4" dir="rtl">
          {rows.map((r) => (
            <div
              key={r.id}
              className={`rounded-xl border bg-white p-5 shadow-[0_1px_4px_rgba(0,48,135,0.06)] ${
                r.is_read ? "border-[#CBD2D6]" : "border-[#003087]/40"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F7FA] text-[#003087]">
                      <User size={16} />
                    </span>
                    <h3 className="font-persian text-base font-semibold text-[#1A1A2E]">
                      {r.name}
                    </h3>
                    {!r.is_read && (
                      <span className="rounded-full bg-[#003087] px-2 py-0.5 text-[10px] font-medium text-white">
                        جدید
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-4 font-persian text-xs text-[#687173]">
                    {r.email && (
                      <a
                        href={`mailto:${r.email}`}
                        className="inline-flex items-center gap-1 hover:text-[#003087]"
                        dir="ltr"
                      >
                        <Mail size={13} /> {r.email}
                      </a>
                    )}
                    {r.phone && (
                      <a
                        href={`tel:${r.phone}`}
                        className="inline-flex items-center gap-1 hover:text-[#003087]"
                        dir="ltr"
                      >
                        <Phone size={13} /> {r.phone}
                      </a>
                    )}
                    <span>{faDate(r.created_at)}</span>
                  </div>
                </div>
              </div>

              <p className="mt-3 whitespace-pre-wrap font-persian text-sm leading-7 text-[#1A1A2E]">
                {r.message}
              </p>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-[#CBD2D6] pt-4">
                <button
                  onClick={() => toggleRead(r)}
                  disabled={busyId === r.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#003087] bg-white px-4 py-2 font-persian text-sm font-semibold text-[#003087] transition hover:bg-[#F5F7FA] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyId === r.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : r.is_read ? (
                    <Mail size={14} />
                  ) : (
                    <MailOpen size={14} />
                  )}
                  {r.is_read ? "علامت خوانده‌نشده" : "علامت خوانده‌شده"}
                </button>
                <button
                  onClick={() => handleDelete(r.id)}
                  disabled={busyId === r.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#D20000] bg-white px-4 py-2 font-persian text-sm font-semibold text-[#D20000] transition hover:bg-[#FDE7E7] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 size={14} /> حذف
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
        {rows.length.toLocaleString("fa-IR")} پیام نمایش داده شد
      </p>
    </>
  );
}
