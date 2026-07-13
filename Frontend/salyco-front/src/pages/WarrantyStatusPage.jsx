import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { checkWarranty } from "../api/warranty";
import { useAuth } from "../hooks/UseAuth";
import WarrantyRegistration from "../components/warranty/WarrantyRegistration";
import PageBackground from "../components/PageBackground";
import { ShieldCheck, LogIn, AlertTriangle } from "lucide-react";

export default function WarrantyStatusPage() {
  const { serialNumber } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [warrantyData, setWarrantyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWarranty = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await checkWarranty(serialNumber);
      setWarrantyData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [serialNumber]);

  useEffect(() => {
    fetchWarranty();
  }, [fetchWarranty]);

  return (
    <section className="relative min-h-screen overflow-hidden bg-white pt-[var(--navbar-height)]">
      <PageBackground />

      <div className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <header className="mb-12" dir="rtl">
          <p className="font-sans text-sm uppercase tracking-[0.3em] text-wood-500/80">
            Warranty
          </p>
          <h1 className="mt-2 font-persian text-4xl font-bold text-[#000c3e] md:text-5xl">
            وضعیت گارانتی
          </h1>
          <hr className="mt-4 w-24 border-t-2 border-wood-400" />
        </header>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <svg
              className="animate-spin h-10 w-10 text-[#001a5c]"
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
            <p className="mt-4 font-persian text-sm text-[#000c3e]/60">
              در حال بارگذاری...
            </p>
          </div>
        )}

        {error && (
          <div className="overflow-hidden rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <AlertTriangle
              size={48}
              className="mx-auto mb-4 text-red-400"
              strokeWidth={1.5}
            />
            <h2
              className="font-persian text-xl font-semibold text-[#000c3e]"
              dir="rtl"
            >
              محصول یافت نشد
            </h2>
            <p
              className="mt-2 font-persian text-sm text-[#000c3e]/60"
              dir="rtl"
            >
              شماره سریال{" "}
              <span className="font-mono text-[#000c3e]" dir="ltr">
                {serialNumber}
              </span>{" "}
              در سیستم ثبت نشده است.
            </p>
            <button
              onClick={() => navigate("/productregistration")}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#000c2e] via-[#001a5c] to-[#00256b] px-6 py-3 font-persian font-semibold text-white shadow-md transition hover:brightness-110"
            >
              <ShieldCheck size={18} strokeWidth={2} />
              بازگشت به ثبت گارانتی
            </button>
          </div>
        )}

        {!loading && !error && warrantyData && (
          <>
            {!warrantyData.is_warranty_active && !isAuthenticated ? (
              <div className="overflow-hidden rounded-2xl border border-blue-400/15 bg-white p-8 text-center shadow-sm">
                <ShieldCheck
                  size={48}
                  className="mx-auto mb-4 text-blue-400"
                  strokeWidth={1.5}
                />
                <h2
                  className="font-persian text-xl font-semibold text-[#000c3e]"
                  dir="rtl"
                >
                  {warrantyData.mattress_name}
                </h2>
                <p
                  className="mt-1 font-mono text-sm text-[#000c3e]/50"
                  dir="ltr"
                >
                  {serialNumber}
                </p>
                <p
                  className="mt-4 font-persian text-sm text-[#000c3e]/60"
                  dir="rtl"
                >
                  گارانتی این محصول هنوز فعال نشده است. برای فعال‌سازی وارد حساب
                  کاربری خود شوید.
                </p>
                <button
                  onClick={() =>
                    navigate(
                      `/auth?redirect=/warranty/mattress/${serialNumber}`,
                    )
                  }
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#000c2e] via-[#001a5c] to-[#00256b] px-6 py-3 font-persian font-semibold text-white shadow-md transition hover:brightness-110"
                >
                  <LogIn size={18} strokeWidth={2} />
                  ورود / ثبت‌نام برای فعال‌سازی گارانتی
                </button>
              </div>
            ) : (
              <WarrantyRegistration
                warrantyData={warrantyData}
                serialNumber={serialNumber}
                onRegistrationSuccess={fetchWarranty}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
