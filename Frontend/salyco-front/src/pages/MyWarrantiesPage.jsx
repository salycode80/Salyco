import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getMyWarranties } from "../api/warranty";
import GuaranteeDisk from "../components/warranty/GuaranteeDisk";
import { ShieldCheck, ShieldOff, Plus, AlertTriangle } from "lucide-react";

export default function MyWarrantiesPage() {
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getMyWarranties();
        setWarranties(Array.isArray(data) ? data : data.results || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#F5F7FA] pt-[72px]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(100,160,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(100,160,255,0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div
        className="pointer-events-none absolute top-0 right-0 h-96 w-1/2"
        style={{
          background: "linear-gradient(to left, rgba(0,50,180,0.12) 0%, transparent 100%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 py-16">
        <header className="mb-12" dir="rtl">
          <p className="font-sans text-sm uppercase tracking-[0.3em] text-blue-400/80">
            My Warranties
          </p>
          <h1 className="mt-2 font-persian text-4xl font-bold text-[#000c3e] md:text-5xl">
            گارانتی‌های من
          </h1>
          <hr className="mt-4 w-24 border-t-2 border-[#000c3e]" />
        </header>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <svg className="animate-spin h-10 w-10 text-[#001a5c]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <p className="mt-4 font-persian text-sm text-[#000c3e]/60">در حال بارگذاری...</p>
          </div>
        )}

        {error && (
          <div className="overflow-hidden rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <AlertTriangle size={48} className="mx-auto mb-4 text-red-400" strokeWidth={1.5} />
            <p className="font-persian text-sm text-[#000c3e]/60" dir="rtl">{error}</p>
          </div>
        )}

        {!loading && !error && warranties.length === 0 && (
          <div className="overflow-hidden rounded-2xl border border-blue-400/15 bg-white p-12 text-center shadow-sm">
            <ShieldOff size={56} className="mx-auto mb-4 text-blue-300" strokeWidth={1.5} />
            <h2 className="font-persian text-xl font-semibold text-[#000c3e]" dir="rtl">
              هیچ گارانتی ثبت‌شده‌ای وجود ندارد
            </h2>
            <p className="mt-2 font-persian text-sm text-[#000c3e]/60" dir="rtl">
              شماره سریال محصول خود را وارد کنید تا گارانتی را فعال کنید.
            </p>
            <Link
              to="/productregistration"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#000c2e] via-[#001a5c] to-[#00256b] px-6 py-3 font-persian font-semibold text-white shadow-md transition hover:brightness-110"
            >
              <Plus size={18} strokeWidth={2} />
              ثبت گارانتی
            </Link>
          </div>
        )}

        {!loading && !error && warranties.length > 0 && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {warranties.map((item) => {
              const product = {
                name: item.mattress?.name || "—",
                serial: item.serial_number,
                totalWarrantyMonths: item.mattress?.warranty_months || 0,
                remainingMonths: Math.max(0, Math.round((item.warranty_remaining_days || 0) / 30)),
              };
              const isActive = item.is_under_warranty;

              return (
                <Link
                  key={item.serial_number}
                  to={`/warranty/mattress/${item.serial_number}`}
                  className="group overflow-hidden rounded-2xl border border-blue-400/15 bg-white p-6 shadow-sm transition-all duration-300 hover:border-blue-400/25 hover:shadow-lg hover:shadow-blue-900/10"
                >
                  <div className="mb-4 flex items-center justify-between" dir="rtl">
                    <h3 className="font-persian text-lg font-semibold text-[#000c3e]">
                      {product.name}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                        isActive
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      <ShieldCheck size={14} strokeWidth={2} />
                      {isActive ? "فعال" : "منقضی"}
                    </span>
                  </div>

                  <p className="mb-4 font-mono text-xs text-[#000c3e]/40" dir="ltr">
                    {item.serial_number}
                  </p>

                  <div className="flex items-center gap-4 rounded-xl border border-blue-400/10 bg-[#F5F7FA]/80 p-3">
                    <GuaranteeDisk product={product} />
                    <div dir="rtl" className="text-sm">
                      {item.activation_date && (
                        <p className="font-persian text-[#000c3e]/60">
                          فعال‌سازی: {new Date(item.activation_date).toLocaleDateString("fa-IR")}
                        </p>
                      )}
                      {item.warranty_expiration_date && (
                        <p className="font-persian text-[#000c3e]/60">
                          انقضا: {new Date(item.warranty_expiration_date).toLocaleDateString("fa-IR")}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
