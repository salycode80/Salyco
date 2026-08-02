import { useState, useEffect } from "react";
import { createMattressInstance, listMattresses } from "../../api/warranty";
import {
  ShieldCheck,
  Plus,
  Download,
  RotateCcw,
  AlertTriangle,
  Loader2,
} from "lucide-react";

// Rendered inside AdminWorkspace, which gates on staff and supplies the page
// chrome — this panel only handles the "create product instance" control.
export default function CreateInstancePanel() {
  const [mattresses, setMattresses] = useState([]);
  const [mattressId, setMattressId] = useState("");
  const [manufactureDate, setManufactureDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    listMattresses()
      .then((d) => {
        const all = Array.isArray(d) ? d : d.results || [];
        // Only serial-numbered lines get instances. Pillows and duvets carry a
        // stated guarantee but are not tracked per unit, and the server rejects
        // them — so don't offer an option that cannot succeed.
        setMattresses(all.filter((m) => m.is_warranty_registrable));
      })
      .catch(() => {});
  }, []);

  // Group the dropdown by category — a flat mixed list of mattresses, boxes,
  // and toppers is hard to scan once the catalogue grows.
  const groupedMattresses = mattresses.reduce((groups, m) => {
    const label = m.category_label || "سایر";
    (groups[label] ||= []).push(m);
    return groups;
  }, {});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await createMattressInstance({
        mattress_id: parseInt(mattressId, 10),
        manufacture_date: manufactureDate,
      });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadQR = () => {
    if (!result?.qr_code) return;
    const link = document.createElement("a");
    link.href = result.qr_code;
    link.download = `QR-${result.serial_number}.png`;
    link.click();
  };

  const handleReset = () => {
    setResult(null);
    setMattressId("");
    setManufactureDate("");
    setError(null);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8" dir="rtl">
        <p className="font-sans text-sm uppercase tracking-[0.3em] text-[#687173]">
          Admin Panel
        </p>
        <h1 className="mt-2 font-persian text-3xl font-bold text-[#003087] md:text-4xl">
          ساخت نمونه محصول
        </h1>
        <hr className="mt-4 w-24 border-t-2 border-[#003087]" />
        <p className="mt-4 max-w-xl font-persian text-base text-[#687173]">
          نوع محصول و تاریخ تولید را انتخاب کنید تا شماره سریال و QR کد تولید
          شود. تنها محصولات سریال‌دار (تشک، باکس تخت خواب و تاپر) در این لیست
          نمایش داده می‌شوند.
        </p>
      </header>

      {!result ? (
        <div className="overflow-hidden rounded-xl border border-[#CBD2D6] bg-white p-8 shadow-[0_1px_4px_rgba(0,48,135,0.06)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div dir="rtl">
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-[#1A1A2E]">
                <ShieldCheck size={16} className="text-[#003087]" strokeWidth={2} />
                <span className="font-persian">نوع محصول</span>
              </label>
              <select
                value={mattressId}
                onChange={(e) => setMattressId(e.target.value)}
                required
                className="h-12 w-full rounded-lg border border-[#CBD2D6] bg-white px-4 text-sm text-[#1A1A2E] outline-none transition focus:border-[#003087] focus:ring-2 focus:ring-[#009CDE]/20"
              >
                <option value="">انتخاب کنید...</option>
                {Object.entries(groupedMattresses).map(([label, items]) => (
                  <optgroup key={label} label={label}>
                    {items.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div dir="rtl">
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-[#1A1A2E]">
                <span className="font-persian">تاریخ تولید</span>
              </label>
              <input
                type="date"
                value={manufactureDate}
                onChange={(e) => setManufactureDate(e.target.value)}
                required
                className="h-12 w-full rounded-lg border border-[#CBD2D6] bg-white px-4 text-sm text-[#1A1A2E] outline-none transition focus:border-[#003087] focus:ring-2 focus:ring-[#009CDE]/20"
              />
            </div>

            {error && (
              <div
                className="flex items-center gap-2 rounded-lg border border-[#CBD2D6] bg-[#FDE7E7] p-3"
                dir="rtl"
              >
                <AlertTriangle size={16} className="text-[#D20000]" />
                <span className="font-persian text-sm text-[#D20000]">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#003087] px-6 font-persian font-semibold text-white transition hover:bg-[#00246B] disabled:bg-[#CBD2D6] disabled:text-[#687173]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال ساخت...
                </span>
              ) : (
                <>
                  <Plus size={18} strokeWidth={2} />
                  ساخت نمونه
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#CBD2D6] bg-white p-8 shadow-[0_1px_4px_rgba(0,48,135,0.06)]">
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#E6F4EA]">
              <ShieldCheck size={32} className="text-[#019C34]" strokeWidth={1.5} />
            </div>
            <h2 className="font-persian text-xl font-semibold text-[#1A1A2E]" dir="rtl">
              نمونه با موفقیت ساخته شد
            </h2>
          </div>

          <div className="mt-8 space-y-4" dir="rtl">
            <div className="flex items-center justify-between rounded-lg border border-[#CBD2D6] bg-[#F5F7FA] p-4">
              <span className="font-persian text-sm font-medium text-[#687173]">
                شماره سریال
              </span>
              <span className="font-mono text-sm font-semibold text-[#1A1A2E]" dir="ltr">
                {result.serial_number}
              </span>
            </div>
            {result.warranty_url && (
              <div className="flex items-center justify-between rounded-lg border border-[#CBD2D6] bg-[#F5F7FA] p-4">
                <span className="font-persian text-sm font-medium text-[#687173]">
                  لینک گارانتی
                </span>
                <span className="font-mono text-xs text-[#009CDE] break-all" dir="ltr">
                  {result.warranty_url}
                </span>
              </div>
            )}
          </div>

          {result.qr_code && (
            <div className="mt-8 flex flex-col items-center">
              <div className="rounded-xl border border-[#CBD2D6] bg-white p-4">
                <img
                  src={result.qr_code}
                  alt={`QR Code - ${result.serial_number}`}
                  className="h-48 w-48"
                />
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={handleDownloadQR}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-[#003087] px-6 font-persian font-semibold text-white transition hover:bg-[#00246B]"
            >
              <Download size={18} strokeWidth={2} />
              دانلود QR
            </button>
            <button
              onClick={handleReset}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border-2 border-[#003087] bg-white px-6 font-persian font-medium text-[#003087] transition hover:bg-[#F5F7FA]"
            >
              <RotateCcw size={18} strokeWidth={2} />
              ساخت نمونه جدید
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
