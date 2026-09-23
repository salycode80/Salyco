import { useState } from "react";
import { registerWarranty } from "../../api/warranty";
import ProductHeader from "./ProductHeader";
import ProductPreviewCard from "./ProductPreviewCard";
import GuaranteeDisk from "./GuaranteeDisk";
import StatusBadge from "./StatusBadge";
import ActionButton from "./ActionButton";
import RegistrationForm from "./RegistrationForm";
import MessageToast from "./MessageToast";
import { formatJalali } from "../../utils/jalali";

const WarrantyRegistration = ({ warrantyData, serialNumber, onRegistrationSuccess }) => {
  // The one component that needs all four states rather than a boolean — which
  // is why is_warranty_active stayed a property for every other consumer.
  const status = warrantyData.warranty_status || "UNREGISTERED";
  const isApproved = status === "APPROVED";
  const canSubmit = status === "UNREGISTERED" || status === "REJECTED";

  const product = {
    name: warrantyData.mattress_name,
    serial: serialNumber,
    totalWarrantyMonths: warrantyData.warranty_months,
    remainingMonths: Math.max(0, Math.round((warrantyData.warranty_remaining_days || 0) / 30)),
  };

  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState({ type: null, text: "" });
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone_number: "",
    address: "",
    postal_code: "",
  });

  const handleRegister = async () => {
    setLoading(true);
    setMessage({ type: null, text: "" });
    try {
      const result = await registerWarranty({
        serial_number: serialNumber,
        ...formData,
      });
      setShowForm(false);
      setMessage({
        type: "success",
        text:
          result?.detail ||
          "درخواست ثبت گارانتی ارسال شد و پس از تأیید کارشناسان فعال می‌شود",
      });
      onRegistrationSuccess?.();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleShowWarrantyInfo = () => {
    const expDate = warrantyData.warranty_expiration_date
      ? formatJalali(warrantyData.warranty_expiration_date) || "—"
      : "—";
    setMessage({
      type: "success",
      text: `گارانتی تا ${expDate} معتبر است · پوشش: ${warrantyData.warranty_months} ماه`,
    });
    setTimeout(() => setMessage({ type: null, text: "" }), 4000);
  };

  const clearMessage = () => setMessage({ type: null, text: "" });

  return (
    <div className="overflow-hidden rounded-xl border border-brand-mist bg-white shadow-[0_1px_4px_rgba(5,46,95,0.06)] transition-all duration-200 hover:shadow-[0_4px_16px_rgba(5,46,95,0.1)]">
      <div className="p-6 sm:p-8">
        <ProductHeader product={product} onCopy={clearMessage} />

        <ProductPreviewCard warrantyData={warrantyData} />

        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-brand-mist bg-brand-warm-white p-4 sm:p-5">
          {/* activation_date is set at submission, so warranty_remaining_days
              returns a real positive number while a request is still PENDING.
              Rendering the dial then would tell the customer their coverage had
              already started — the spec's "Known sharp edge", which is why the
              rule is to branch on warranty_status and never on
              warranty_remaining_days > 0. Gated on APPROVED, exactly as
              MyWarrantiesPage does. */}
          {isApproved ? (
            <GuaranteeDisk product={product} />
          ) : (
            <p className="font-persian text-sm text-text-secondary" dir="rtl">
              {status === "PENDING"
                ? "پوشش گارانتی پس از تأیید کارشناسان، از تاریخ ثبت درخواست محاسبه می‌شود."
                : status === "REJECTED"
                  ? "برای فعال‌سازی گارانتی، درخواست را دوباره ثبت کنید."
                  : "گارانتی این محصول هنوز ثبت نشده است."}
            </p>
          )}
          <div className="ml-auto">
            <StatusBadge status={status} />
          </div>
        </div>

        {status === "REJECTED" && (
          <div
            className="mb-4 rounded-lg border border-status-error bg-status-error-bg px-5 py-3"
            dir="rtl"
          >
            <p className="font-persian text-sm font-semibold text-status-error">
              درخواست قبلی شما رد شد
            </p>
            {warrantyData.warranty_rejection_reason && (
              <p className="mt-1 font-persian text-sm leading-6 text-status-error">
                {warrantyData.warranty_rejection_reason}
              </p>
            )}
            <p className="mt-1 font-persian text-xs text-status-error/80">
              اطلاعات را اصلاح کنید و درخواست را دوباره ثبت کنید.
            </p>
          </div>
        )}

        <ActionButton
          status={status}
          onClick={
            isApproved ? handleShowWarrantyInfo : () => setShowForm(true)
          }
        />

        {message.type && (
          <MessageToast type={message.type} text={message.text} />
        )}

        {canSubmit && showForm && (
          <RegistrationForm
            formData={formData}
            setFormData={setFormData}
            onCancel={() => setShowForm(false)}
            onSubmit={handleRegister}
            loading={loading}
          />
        )}

        <div className="mt-6 flex items-center justify-center gap-2 border-t border-brand-mist pt-4 text-center text-xs text-text-secondary">
          <span>اسکن QR یا وارد کردن سریال · پورتال گارانتی سالیکو</span>
        </div>
      </div>
    </div>
  );
};

export default WarrantyRegistration;
