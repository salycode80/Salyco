import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { checkWarranty } from "../api/warranty";
import { useAuth } from "../hooks/UseAuth";
import WarrantyRegistration from "../components/warranty/WarrantyRegistration";
import ProductPreviewCard from "../components/warranty/ProductPreviewCard";
import StatusBadge from "../components/warranty/StatusBadge";
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
          <p className="font-sans text-sm uppercase tracking-[0.3em] text-text-secondary">
            Warranty
          </p>
          <h1 className="mt-2 font-persian text-3xl font-bold text-brand-navy md:text-4xl">
            وضعیت گارانتی
          </h1>
          <hr className="mt-4 w-24 border-t-2 border-brand-navy" />
        </header>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <svg
              className="animate-spin h-10 w-10 text-brand-navy"
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
            <h2
              className="font-persian text-xl font-semibold text-text-primary"
              dir="rtl"
            >
              محصول یافت نشد
            </h2>
            <p
              className="mt-2 font-persian text-sm text-text-secondary"
              dir="rtl"
            >
              شماره سریال{" "}
              <span className="font-mono text-text-primary" dir="ltr">
                {serialNumber}
              </span>{" "}
              در سیستم ثبت نشده است.
            </p>
            <button
              onClick={() => navigate("/productregistration")}
              className="mt-6 inline-flex h-12 items-center gap-2 rounded-lg bg-brand-navy px-6 font-persian font-semibold text-white shadow-[0_1px_4px_rgba(5,46,95,0.06)] transition hover:bg-action-hover"
            >
              <ShieldCheck size={18} strokeWidth={2} />
              بازگشت به ثبت گارانتی
            </button>
          </div>
        )}

        {!loading && !error && warrantyData && <WarrantyView
          warrantyData={warrantyData}
          serialNumber={serialNumber}
          isAuthenticated={isAuthenticated}
          onNavigate={navigate}
          onRefresh={fetchWarranty}
        />}
      </div>
    </section>
  );
}

// Signed-in customers get the full registration card. Signed-out ones get a
// login CTA only when logging in would actually let them do something: a
// pending or approved serial is read-only, so the CTA would be a dead end.
function WarrantyView({
  warrantyData,
  serialNumber,
  isAuthenticated,
  onNavigate,
  onRefresh,
}) {
  if (isAuthenticated) {
    return (
      <WarrantyRegistration
        warrantyData={warrantyData}
        serialNumber={serialNumber}
        onRegistrationSuccess={onRefresh}
      />
    );
  }

  const status = warrantyData.warranty_status || "UNREGISTERED";
  const canClaim = status === "UNREGISTERED" || status === "REJECTED";

  const READ_ONLY_MESSAGE = {
    PENDING:
      "درخواست ثبت گارانتی این محصول ارسال شده و در انتظار تأیید کارشناسان است.",
    APPROVED: "گارانتی این محصول فعال است.",
  };

  return (
    <div className="overflow-hidden rounded-xl border border-brand-mist bg-white p-8 text-center shadow-[0_1px_4px_rgba(5,46,95,0.06)]">
      <ProductPreviewCard warrantyData={warrantyData} />

      <p className="mt-1 font-mono text-sm text-text-secondary" dir="ltr">
        {serialNumber}
      </p>

      <div className="mt-4 flex justify-center">
        <StatusBadge status={status} />
      </div>

      {canClaim ? (
        <>
          <p className="mt-4 font-persian text-sm text-text-secondary" dir="rtl">
            برای ثبت درخواست گارانتی وارد حساب کاربری خود شوید.
          </p>
          <button
            onClick={() =>
              onNavigate(`/auth?redirect=/warranty/mattress/${serialNumber}`)
            }
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-lg bg-brand-navy px-6 font-persian font-semibold text-white shadow-[0_1px_4px_rgba(5,46,95,0.06)] transition hover:bg-action-hover"
          >
            <LogIn size={18} strokeWidth={2} />
            ورود / ثبت‌نام برای ثبت گارانتی
          </button>
        </>
      ) : (
        <p className="mt-4 font-persian text-sm text-text-secondary" dir="rtl">
          {READ_ONLY_MESSAGE[status]}
        </p>
      )}
    </div>
  );
}
