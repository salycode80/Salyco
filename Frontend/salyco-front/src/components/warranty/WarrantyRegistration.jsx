import { useState } from "react";
import { registerWarranty } from "../../api/warranty";
import ProductHeader from "./ProductHeader";
import GuaranteeDisk from "./GuaranteeDisk";
import StatusBadge from "./StatusBadge";
import ActionButton from "./ActionButton";
import RegistrationForm from "./RegistrationForm";
import MessageToast from "./MessageToast";

const WarrantyRegistration = ({ warrantyData, serialNumber, onRegistrationSuccess }) => {
  const isRegistered = warrantyData.is_warranty_active;

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
      await registerWarranty({
        serial_number: serialNumber,
        ...formData,
      });
      setShowForm(false);
      setMessage({
        type: "success",
        text: `گارانتی برای ${formData.first_name} ${formData.last_name} · ${serialNumber} فعال شد`,
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
      ? new Date(warrantyData.warranty_expiration_date).toLocaleDateString("fa-IR")
      : "—";
    setMessage({
      type: "success",
      text: `گارانتی تا ${expDate} معتبر است · پوشش: ${warrantyData.warranty_months} ماه`,
    });
    setTimeout(() => setMessage({ type: null, text: "" }), 4000);
  };

  const clearMessage = () => setMessage({ type: null, text: "" });

  return (
    <div className="overflow-hidden rounded-2xl border border-blue-400/15 bg-white shadow-sm transition-all duration-300 hover:border-blue-400/25 hover:shadow-lg hover:shadow-blue-900/10">
      <div className="p-6 sm:p-8">
        <ProductHeader product={product} onCopy={clearMessage} />

        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-blue-400/10 bg-[#F5F7FA]/80 p-4 sm:p-5">
          <GuaranteeDisk product={product} />
          <StatusBadge isRegistered={isRegistered} />
        </div>

        <ActionButton
          isRegistered={isRegistered}
          onClick={
            isRegistered ? handleShowWarrantyInfo : () => setShowForm(true)
          }
        />

        {message.type && (
          <MessageToast type={message.type} text={message.text} />
        )}

        {!isRegistered && showForm && (
          <RegistrationForm
            formData={formData}
            setFormData={setFormData}
            onCancel={() => setShowForm(false)}
            onSubmit={handleRegister}
            loading={loading}
          />
        )}

        <div className="mt-6 flex items-center justify-center gap-2 border-t border-blue-400/10 pt-4 text-center text-xs text-[#000c3e]/50">
          <span>اسکن QR یا وارد کردن سریال · پورتال گارانتی سالیکو</span>
        </div>
      </div>
    </div>
  );
};

export default WarrantyRegistration;
