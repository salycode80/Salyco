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
      .then((d) => setMattresses(Array.isArray(d) ? d : d.results || []))
      .catch(() => {});
  }, []);

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
        <p className="font-sans text-sm uppercase tracking-[0.3em] text-wood-500/80">
          Admin Panel
        </p>
        <h1 className="mt-2 font-persian text-3xl font-bold text-[#000c3e] md:text-4xl">
          ساخت نمونه محصول
        </h1>
        <hr className="mt-4 w-24 border-t-2 border-wood-400" />
        <p className="mt-4 max-w-xl font-persian text-base text-[#000c3e]/60">
          نوع تشک و تاریخ تولید را انتخاب کنید تا شماره سریال و QR کد تولید شود.
        </p>
      </header>

      {!result ? (
        <div className="overflow-hidden rounded-2xl border border-blue-400/15 bg-white p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div dir="rtl">
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-[#000c3e]">
                <ShieldCheck size={16} className="text-blue-400" strokeWidth={2} />
                <span className="font-persian">نوع تشک</span>
              </label>
              <select
                value={mattressId}
                onChange={(e) => setMattressId(e.target.value)}
                required
                className="w-full rounded-full border border-blue-400/20 bg-white px-5 py-3 text-sm text-[#000c3e] outline-none transition focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20"
              >
                <option value="">انتخاب کنید...</option>
                {mattresses.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div dir="rtl">
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-[#000c3e]">
                <span className="font-persian">تاریخ تولید</span>
              </label>
              <input
                type="date"
                value={manufactureDate}
                onChange={(e) => setManufactureDate(e.target.value)}
                required
                className="w-full rounded-full border border-blue-400/20 bg-white px-5 py-3 text-sm text-[#000c3e] outline-none transition focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20"
              />
            </div>

            {error && (
              <div
                className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3"
                dir="rtl"
              >
                <AlertTriangle size={16} className="text-red-500" />
                <span className="font-persian text-sm text-red-600">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#000c2e] via-[#001a5c] to-[#00256b] px-6 py-3 font-persian font-semibold text-white shadow-md transition hover:brightness-110 disabled:opacity-60"
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
        <div className="overflow-hidden rounded-2xl border border-blue-400/15 bg-white p-8 shadow-sm">
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
              <ShieldCheck size={32} className="text-emerald-500" strokeWidth={1.5} />
            </div>
            <h2 className="font-persian text-xl font-semibold text-[#000c3e]" dir="rtl">
              نمونه با موفقیت ساخته شد
            </h2>
          </div>

          <div className="mt-8 space-y-4" dir="rtl">
            <div className="flex items-center justify-between rounded-xl border border-blue-400/10 bg-[#F5F7FA]/80 p-4">
              <span className="font-persian text-sm font-medium text-[#000c3e]/60">
                شماره سریال
              </span>
              <span className="font-mono text-sm font-semibold text-[#000c3e]" dir="ltr">
                {result.serial_number}
              </span>
            </div>
            {result.warranty_url && (
              <div className="flex items-center justify-between rounded-xl border border-blue-400/10 bg-[#F5F7FA]/80 p-4">
                <span className="font-persian text-sm font-medium text-[#000c3e]/60">
                  لینک گارانتی
                </span>
                <span className="font-mono text-xs text-blue-600 break-all" dir="ltr">
                  {result.warranty_url}
                </span>
              </div>
            )}
          </div>

          {result.qr_code && (
            <div className="mt-8 flex flex-col items-center">
              <div className="rounded-2xl border border-blue-400/10 bg-white p-4">
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
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#000c2e] via-[#001a5c] to-[#00256b] px-6 py-3 font-persian font-semibold text-white shadow-md transition hover:brightness-110"
            >
              <Download size={18} strokeWidth={2} />
              دانلود QR
            </button>
            <button
              onClick={handleReset}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-blue-400/20 bg-white px-6 py-3 font-persian font-medium text-[#000c3e] transition hover:bg-[#F5F7FA]"
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
