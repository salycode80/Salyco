import { useState, useEffect, useCallback } from "react";
import {
  MapPin,
  Plus,
  Trash2,
  Loader2,
  Filter,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  listAdminLocations,
  createAdminLocation,
  updateAdminLocation,
  deleteAdminLocation,
} from "../../api/admin";
import { IRAN_PROVINCES } from "../../constants/provinces";
import { IRAN_PROVINCES_CITIES, getCitiesForProvince } from "../../constants/cities";

export default function AllowedLocationsPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  // Add form
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  // Get available cities for selected province
  const availableCities = province ? getCitiesForProvince(province) : [];
  const [showCitySelect, setShowCitySelect] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listAdminLocations()
      .then((d) => setRows(Array.isArray(d) ? d : d.results || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleProvinceChange = (e) => {
    setProvince(e.target.value);
    setCity(""); // Reset city when province changes
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setError("");
    if (!province) {
      setError("لطفاً استان را انتخاب کنید.");
      return;
    }
    setAdding(true);
    try {
      const created = await createAdminLocation({
        province,
        city: city.trim(),
        is_active: true,
      });
      setRows((rs) => [created, ...rs]);
      setProvince("");
      setCity("");
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (row) => {
    setBusyId(row.id);
    try {
      await updateAdminLocation(row.id, { is_active: !row.is_active });
      setRows((rs) =>
        rs.map((r) => (r.id === row.id ? { ...r, is_active: !r.is_active } : r))
      );
    } catch {
      /* keep row as-is on error */
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("این منطقه حذف شود؟")) return;
    setBusyId(id);
    try {
      await deleteAdminLocation(id);
      setRows((rs) => rs.filter((r) => r.id !== id));
    } catch {
      /* keep row on error */
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      {/* header */}
      <header className="mb-8" dir="rtl">
        <p className="flex items-center gap-2 font-sans text-sm uppercase tracking-[0.3em] text-[#687173]">
          <MapPin size={16} /> Shipping Areas
        </p>
        <h1 className="mt-2 font-persian text-3xl font-bold text-[#003087] md:text-4xl">
          مناطق مجاز ارسال
        </h1>
        <hr className="mt-4 w-24 border-t-2 border-[#003087]" />
        <p className="mt-4 font-persian text-sm text-[#687173]">
          مناطقی که خرید آنلاین در آن‌ها امکان‌پذیر است را تعیین کنید. اگر شهر خالی
          بماند، کل استان مجاز خواهد بود.
        </p>
      </header>

      {/* add form */}
      <form
        onSubmit={handleAdd}
        className="mb-6 rounded-xl border border-[#CBD2D6] bg-white p-4 shadow-[0_1px_4px_rgba(0,48,135,0.06)]"
        dir="rtl"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1.5 block font-persian text-sm font-medium text-[#1A1A2E]">
              استان
            </label>
            <select
              value={province}
              onChange={handleProvinceChange}
              className="h-12 w-full rounded-lg border border-[#CBD2D6] bg-white px-4 font-persian text-sm text-[#1A1A2E] outline-none transition focus:border-[#003087] focus:ring-2 focus:ring-[#009CDE]/20"
            >
              <option value="">انتخاب استان</option>
              {IRAN_PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="mb-1.5 block font-persian text-sm font-medium text-[#1A1A2E]">
              شهر (اختیاری)
            </label>
            {province && availableCities.length > 0 ? (
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="h-12 w-full rounded-lg border border-[#CBD2D6] bg-white px-4 font-persian text-sm text-[#1A1A2E] outline-none transition focus:border-[#003087] focus:ring-2 focus:ring-[#009CDE]/20"
              >
                <option value="">کل استان (همه شهرها)</option>
                {availableCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={province ? "نام شهر را وارد کنید" : "ابتدا استان را انتخاب کنید"}
                disabled={!province}
                className="h-12 w-full rounded-lg border border-[#CBD2D6] bg-white px-4 font-persian text-sm text-[#1A1A2E] placeholder-[#687173] outline-none transition focus:border-[#003087] focus:ring-2 focus:ring-[#009CDE]/20 disabled:cursor-not-allowed disabled:opacity-60"
              />
            )}
          </div>
          <button
            type="submit"
            disabled={adding}
            className="inline-flex h-12 items-center gap-1.5 rounded-lg bg-[#003087] px-6 font-persian text-sm font-bold text-white transition hover:bg-[#00246B] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {adding ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            افزودن منطقه
          </button>
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-[#FDE7E7] px-4 py-2.5 font-persian text-sm text-[#D20000]">
            {error}
          </p>
        )}
      </form>

      {/* list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#003087]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-[#CBD2D6] bg-white py-20 text-center shadow-[0_1px_4px_rgba(0,48,135,0.06)]">
          <Filter size={40} className="mx-auto mb-3 text-[#CBD2D6]" />
          <p className="font-persian text-sm text-[#687173]">
            هنوز منطقه‌ای تعریف نشده است.
          </p>
        </div>
      ) : (
        <div className="space-y-3" dir="rtl">
          {rows.map((r) => (
            <div
              key={r.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 shadow-[0_1px_4px_rgba(0,48,135,0.06)] ${
                r.is_active ? "border-[#CBD2D6]" : "border-[#CBD2D6] opacity-60"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F7FA] text-[#003087]">
                  <MapPin size={16} />
                </span>
                <div>
                  <p className="font-persian text-base font-semibold text-[#1A1A2E]">
                    {r.province}
                    {r.city ? ` — ${r.city}` : ""}
                  </p>
                  <p className="font-persian text-xs text-[#687173]">
                    {r.city ? "شهر مشخص" : "کل استان"}
                    {" · "}
                    {r.is_active ? "فعال" : "غیرفعال"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggle(r)}
                  disabled={busyId === r.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#003087] bg-white px-4 py-2 font-persian text-sm font-semibold text-[#003087] transition hover:bg-[#F5F7FA] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyId === r.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : r.is_active ? (
                    <ToggleRight size={16} />
                  ) : (
                    <ToggleLeft size={16} />
                  )}
                  {r.is_active ? "غیرفعال کردن" : "فعال کردن"}
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
    </>
  );
}
