import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getMyWarranties } from "../api/warranty";
import GuaranteeDisk from "../components/warranty/GuaranteeDisk";
import PageBackground from "../components/PageBackground";
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
    <section className="relative min-h-screen overflow-hidden bg-white pt-[var(--navbar-height)]">
      <PageBackground />

      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
        <header className="mb-12 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end" dir="rtl">
          <div>
            <p className="font-sans text-sm uppercase tracking-[0.3em] text-[#009CDE]">
              My Warranties
            </p>
            <h1 className="mt-2 font-persian text-4xl font-bold text-[#1A1A2E] md:text-5xl">
              گارانتی‌های من
            </h1>
            <hr className="mt-4 w-24 border-t-2 border-[#F5BA2E]" />
          </div>

          <Link
            to="/productregistration"
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-lg bg-[#003087] px-6 font-persian font-semibold text-white shadow-[0_1px_4px_rgba(0,48,135,0.06)] transition hover:bg-[#00246B]"
          >
            <Plus size={18} strokeWidth={2} />
            ثبت گارانتی جدید
          </Link>
        </header>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <svg
              className="animate-spin h-10 w-10 text-[#003087]"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              />
            </svg>
            <p className="mt-4 font-persian text-sm text-[#687173]">
              در حال بارگذاری...
            </p>
          </div>
        )}

        {error && (
          <div className="overflow-hidden rounded-xl border border-[#CBD2D6] bg-white p-8 text-center shadow-[0_1px_4px_rgba(0,48,135,0.06)]">
            <AlertTriangle
              size={48}
              className="mx-auto mb-4 text-[#D20000]"
              strokeWidth={1.5}
            />
            <p className="font-persian text-sm text-[#687173]" dir="rtl">
              {error}
            </p>
          </div>
        )}

        {!loading && !error && warranties.length === 0 && (
          <div className="overflow-hidden rounded-xl border border-[#CBD2D6] bg-white p-12 text-center shadow-[0_1px_4px_rgba(0,48,135,0.06)]">
            <ShieldOff
              size={56}
              className="mx-auto mb-4 text-[#687173]"
              strokeWidth={1.5}
            />
            <h2
              className="font-persian text-xl font-semibold text-[#1A1A2E]"
              dir="rtl"
            >
              هیچ گارانتی ثبت‌شده‌ای وجود ندارد
            </h2>
            <p
              className="mt-2 font-persian text-sm text-[#687173]"
              dir="rtl"
            >
              شماره سریال محصول خود را وارد کنید تا گارانتی را فعال کنید.
            </p>
            <Link
              to="/productregistration"
              className="mt-6 inline-flex h-12 items-center gap-2 rounded-lg bg-[#003087] px-6 font-persian font-semibold text-white shadow-[0_1px_4px_rgba(0,48,135,0.06)] transition hover:bg-[#00246B]"
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
                remainingMonths: Math.max(
                  0,
                  Math.round((item.warranty_remaining_days || 0) / 30),
                ),
              };
              const isActive = item.is_under_warranty;

              return (
                <Link
                  key={item.serial_number}
                  to={`/warranty/mattress/${item.serial_number}`}
                  className="group overflow-hidden rounded-xl border border-[#CBD2D6] bg-white p-6 shadow-[0_1px_4px_rgba(0,48,135,0.06)] transition-all duration-300 hover:shadow-[0_4px_16px_rgba(0,48,135,0.1)]"
                >
                  <div
                    className="mb-4 flex items-center justify-between"
                    dir="rtl"
                  >
                    <h3 className="font-persian text-lg font-semibold text-[#1A1A2E]">
                      {product.name}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                        isActive
                          ? "bg-[#E6F4EA] text-[#019C34]"
                          : "bg-[#FFF8E1] text-[#F5BA2E]"
                      }`}
                    >
                      <ShieldCheck size={14} strokeWidth={2} />
                      {isActive ? "فعال" : "منقضی"}
                    </span>
                  </div>

                  <p
                    className="mb-4 font-mono text-xs text-[#687173]"
                    dir="ltr"
                  >
                    {item.serial_number}
                  </p>

                  <div className="flex items-center gap-4 rounded-xl border border-[#CBD2D6] bg-[#F5F7FA] p-3">
                    <GuaranteeDisk product={product} />
                    <div dir="rtl" className="text-sm">
                      {item.activation_date && (
                        <p className="font-persian text-[#687173]">
                          فعال‌سازی:{" "}
                          {new Date(item.activation_date).toLocaleDateString(
                            "fa-IR",
                          )}
                        </p>
                      )}
                      {item.warranty_expiration_date && (
                        <p className="font-persian text-[#687173]">
                          انقضا:{" "}
                          {new Date(
                            item.warranty_expiration_date,
                          ).toLocaleDateString("fa-IR")}
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
