import React from 'react';

const RegistrationForm = ({ formData, setFormData, onCancel, onSubmit, productSerial }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.serialVerification.trim() !== productSerial) {
      alert('❌ Serial number does not match the product. Please verify.');
      return;
    }
    onSubmit();
  };

  return (
    <div className="mt-6 bg-[#F4F9FE] border border-[#D3E2EE] rounded-2xl p-5 sm:p-6 shadow-inner">
      <h4 className="flex items-center gap-2 text-[#10415A] font-semibold text-lg mb-4">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        Complete registration
      </h4>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-[#1E3F53] mb-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            نام کامل
          </label>
          <input
            type="text"
            name="customerName"
            value={formData.customerName}
            onChange={handleChange}
            className="w-full bg-white border border-[#CBD9E5] rounded-full px-5 py-3 text-sm focus:ring-2 focus:ring-[#6EAAC9] focus:border-[#1D6B8A] outline-none transition"
            placeholder="e.g. Olivia Chen"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-[#1E3F53] mb-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              تاریخ خرید 
            </label>
            <input
              type="date"
              name="purchaseDate"
              value={formData.purchaseDate}
              onChange={handleChange}
              className="w-full bg-white border border-[#CBD9E5] rounded-full px-5 py-3 text-sm focus:ring-2 focus:ring-[#6EAAC9] focus:border-[#1D6B8A] outline-none transition"
              required
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-[#1E3F53] mb-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              فروشنده
            </label>
            <input
              type="text"
              name="retailer"
              value={formData.retailer}
              onChange={handleChange}
              className="w-full bg-white border border-[#CBD9E5] rounded-full px-5 py-3 text-sm focus:ring-2 focus:ring-[#6EAAC9] focus:border-[#1D6B8A] outline-none transition"
              placeholder="Store name"
            />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-[#1E3F53] mb-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
            شماره سریال 
          </label>
          <input
            type="text"
            name="serialVerification"
            value={formData.serialVerification}
            onChange={handleChange}
            className="w-full bg-white border border-[#CBD9E5] rounded-full px-5 py-3 text-sm focus:ring-2 focus:ring-[#6EAAC9] focus:border-[#1D6B8A] outline-none transition font-mono"
            placeholder="Enter product serial"
            required
          />
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-2 bg-white border border-[#B8CDDD] text-[#1A4057] font-medium px-5 py-3 rounded-full hover:bg-slate-100 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            لغو
          </button>
          <button
            type="submit"
            className="flex-[2] flex items-center justify-center gap-2 bg-[#1F6E5A] hover:bg-[#15584A] text-white font-semibold px-5 py-3 rounded-full shadow-md transition border border-[#3A8770]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            فعال سازی گارانتی
          </button>
        </div>
      </form>
    </div>
  );
};

export default RegistrationForm;