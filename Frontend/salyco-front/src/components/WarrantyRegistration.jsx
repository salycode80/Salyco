import { useState } from "react";
import ProductHeader from "./ProductHeader";
import GuaranteeDisk from "./GuaranteeDisk";
import StatusBadge from "./StatusBadge";
import ActionButton from "./ActionButton";
import RegistrationForm from "./RegistrationForm";
import MessageToast from "./MessageToast";

const WarrantyRegistration = () => {
  const product = {
    name: "Salyco · LuxeRest Hybrid",
    serial: "SAL-MTR-8274-9X2P",
    totalWarrantyMonths: 36,
    remainingMonths: 29,
  };

  const [isRegistered, setIsRegistered] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [message, setMessage] = useState({ type: null, text: "" });
  const [formData, setFormData] = useState({
    customerName: "Olivia Chen",
    purchaseDate: "2025-12-01",
    retailer: "SleepWell Emporium",
    serialVerification: product.serial,
  });

  const handleRegister = () => {
    setIsRegistered(true);
    setShowForm(false);
    setMessage({
      type: "success",
      text: `گارانتی برای ${formData.customerName} · ${product.serial} فعال شد`,
    });
  };

  const handleShowWarrantyInfo = () => {
    setMessage({
      type: "success",
      text: `گارانتی تا ${new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toLocaleDateString("fa-IR")} معتبر است · پوشش: ${product.totalWarrantyMonths} ماه`,
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
            productSerial={product.serial}
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
