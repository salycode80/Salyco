import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getMyWarranties } from "../api/warranty";
import GuaranteeDisk from "../components/warranty/GuaranteeDisk";
import PageBackground from "../components/PageBackground";
import { ShieldOff, Plus, AlertTriangle } from "lucide-react";
import StatusBadge from "../components/warranty/StatusBadge";
import { getProductImageUrl } from "../utils/productImage";
import { formatJalali } from "../utils/jalali";

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
        <header className="mb-12" dir="rtl">
          <p className="font-sans text-sm uppercase tracking-[0.3em] text-text-secondary">
            My Warranties
          </p>
          <h1 className="mt-2 font-persian text-3xl font-bold text-brand-navy md:text-4xl">
            گارانتی‌های من
          </h1>
          <hr className="mt-4 w-24 border-t-2 border-brand-navy" />
        </header>

        <div className="mb-6 flex justify-end" dir="rtl">
          <Link
            to="/productregistration"
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-brand-navy px-6 font-persian font-semibold text-white shadow-[0_1px_4px_rgba(5,46,95,0.06)] transition hover:bg-action-hover focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
          >
            <Plus size={18} strokeWidth={2} />
            ثبت گارانتی جدید
          </Link>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="flex h-14 w-14 items-center justify-center">
              <svg
                className="animate-spin h-12 w-12 text-brand-navy"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
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
            </div>
            <p className="mt-4 font-persian text-sm text-text-secondary">
              در حال بارگذاری...
            </p>
          </div>
        )}

        {error && (
          <div className="overflow-hidden rounded-xl border border-brand-mist bg-white p-8 text-center shadow-[0_1px_4px_rgba(5,46,95,0.06)]">
            <AlertTriangle
              size={48}
              className="mx-auto mb-4 text-status-error"
              strokeWidth={1.5}
            />
            <p className="font-persian text-sm text-text-secondary" dir="rtl">
              {error}
            </p>
          </div>
        )}

        {!loading && !error && warranties.length === 0 && (
          <div className="overflow-hidden rounded-xl border border-brand-mist bg-white p-12 text-center shadow-[0_1px_4px_rgba(5,46,95,0.06)]">
            <ShieldOff
              size={56}
              className="mx-auto mb-4 text-text-secondary"
              strokeWidth={1.5}
            />
            <h2
              className="font-persian text-xl font-semibold text-text-primary"
              dir="rtl"
            >
              هیچ گارانتی ثبت‌شده‌ای وجود ندارد
            </h2>
            <p
              className="mt-2 font-persian text-sm text-text-secondary"
              dir="rtl"
            >
              شماره سریال محصول خود را وارد کنید تا گارانتی را فعال کنید.
            </p>
            <Link
              to="/productregistration"
              className="mt-6 inline-flex h-12 items-center gap-2 rounded-lg bg-brand-navy px-6 font-persian font-semibold text-white shadow-[0_1px_4px_rgba(5,46,95,0.06)] transition hover:bg-action-hover focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
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
              const status = item.warranty_status || "UNREGISTERED";
              // Only an approved warranty can be expired; for the other states
              // the badge's own label is the whole story.
              const expired =
                status === "APPROVED" && !item.is_under_warranty;

              return (
                <Link
                  key={item.serial_number}
                  to={`/warranty/mattress/${item.serial_number}`}
                  className="group overflow-hidden rounded-xl border border-brand-mist bg-white p-6 shadow-[0_1px_4px_rgba(5,46,95,0.06)] transition-all duration-200 hover:shadow-[0_4px_16px_rgba(5,46,95,0.1)]"
                >
                  <div className="mb-4 flex items-start gap-3" dir="rtl">
                    <img
                      src={getProductImageUrl(item.mattress?.image)}
                      alt={product.name}
                      className="h-16 w-16 shrink-0 rounded-xl border border-brand-mist bg-brand-warm-white object-contain"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-persian text-lg font-semibold text-text-primary">
                        {product.name}
                      </h3>
                      <p
                        className="mt-1 font-mono text-xs text-text-secondary"
                        dir="ltr"
                      >
                        {item.serial_number}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 flex" dir="rtl">
                    <StatusBadge status={status} expired={expired} />
                  </div>

                  {status === "REJECTED" && item.warranty_rejection_reason && (
                    <p
                      className="mb-4 rounded-lg border border-status-error bg-status-error-bg px-4 py-2 font-persian text-xs leading-6 text-status-error"
                      dir="rtl"
                    >
                      {item.warranty_rejection_reason}
                    </p>
                  )}

                  {status === "APPROVED" ? (
                    <div className="flex items-center gap-4 rounded-xl border border-brand-mist bg-brand-warm-white p-3">
                      <GuaranteeDisk product={product} />
                      <div dir="rtl" className="text-sm">
                        {item.activation_date && (
                          <p className="font-persian text-text-secondary">
                            فعال‌سازی: {formatJalali(item.activation_date) || "—"}
                          </p>
                        )}
                        {item.warranty_expiration_date && (
                          <p className="font-persian text-text-secondary">
                            انقضا:{" "}
                            {formatJalali(item.warranty_expiration_date) || "—"}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    // activation_date is set at submission, so the expiration
                    // properties return real-looking dates while a request is
                    // still pending. Showing the coverage dial here would tell
                    // the customer their warranty had started. See the spec's
                    // "Known sharp edge".
                    <p
                      className="rounded-xl border border-brand-mist bg-brand-warm-white p-3 font-persian text-sm text-text-secondary"
                      dir="rtl"
                    >
                      {status === "PENDING"
                        ? "پس از تأیید کارشناسان، پوشش گارانتی از تاریخ ثبت درخواست محاسبه می‌شود."
                        : "برای ثبت مجدد درخواست، این محصول را انتخاب کنید."}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
