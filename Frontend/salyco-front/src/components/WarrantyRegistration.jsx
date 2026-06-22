import React, { useState } from 'react';
import ProductHeader from './ProductHeader';
import GuaranteeDisk from './GuaranteeDisk';
import StatusBadge from './StatusBadge';
import ActionButton from './ActionButton';
import RegistrationForm from './RegistrationForm';
import MessageToast from './MessageToast';

const WarrantyRegistration = () => {
  // Product data (simulates QR/scan result)
  const product = {
    name: 'Salyco · LuxeRest Hybrid',
    serial: 'SAL-MTR-8274-9X2P',
    totalWarrantyMonths: 36,
    remainingMonths: 29,
  };

  const [isRegistered, setIsRegistered] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [message, setMessage] = useState({ type: null, text: '' });
  const [formData, setFormData] = useState({
    customerName: 'Olivia Chen',
    purchaseDate: '2025-12-01',
    retailer: 'SleepWell Emporium',
    serialVerification: product.serial,
  });

  const handleRegister = () => {
    setIsRegistered(true);
    setShowForm(false);
    setMessage({
      type: 'success',
      text: `✅ Warranty activated for ${formData.customerName} · ${product.serial}`,
    });
  };

  const handleShowWarrantyInfo = () => {
    setMessage({
      type: 'success',
      text: `📋 Warranty valid until ${new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toLocaleDateString()} · coverage: ${product.totalWarrantyMonths} months`,
    });
    setTimeout(() => setMessage({ type: null, text: '' }), 4000);
  };

  const clearMessage = () => setMessage({ type: null, text: '' });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/70 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-2xl bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl border border-slate-200/70 p-6 sm:p-8 transition-all">
        
        <ProductHeader product={product} onCopy={clearMessage} />

        <div className="bg-slate-50/80 border border-slate-200/70 rounded-2xl p-4 sm:p-5 mb-6 flex flex-wrap items-center gap-4 shadow-sm">
          <GuaranteeDisk product={product} />
          <StatusBadge isRegistered={isRegistered} />
        </div>

        <ActionButton
          isRegistered={isRegistered}
          onClick={isRegistered ? handleShowWarrantyInfo : () => setShowForm(true)}
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

        <div className="mt-6 text-xs text-[#4B6D82] text-center border-t border-[#DCE8F0] pt-4 flex items-center justify-center gap-2">
          <span className="inline-block w-3.5 h-3.5">📱</span> Scan QR or enter serial · Salyco warranty portal
        </div>
      </div>
    </div>
  );
};

export default WarrantyRegistration;