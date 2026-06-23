import { ClipboardCheck, User, CalendarDays, Store, Hash, X, CheckCircle2 } from "lucide-react";

const inputClass =
  "w-full rounded-full border border-blue-400/20 bg-white px-5 py-3 text-sm text-[#000c3e] outline-none transition focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20";

const labelClass =
  "mb-1.5 flex items-center gap-2 text-sm font-medium text-[#000c3e]";

const RegistrationForm = ({
  formData,
  setFormData,
  onCancel,
  onSubmit,
  productSerial,
}) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.serialVerification.trim() !== productSerial) {
      alert("شماره سریال با محصول مطابقت ندارد. لطفاً بررسی کنید.");
      return;
    }
    onSubmit();
  };

  return (
    <div className="mt-6 rounded-2xl border border-blue-400/10 bg-[#F5F7FA]/80 p-5 sm:p-6">
      <h4 className="mb-4 flex items-center gap-2 font-persian text-lg font-semibold text-[#000c3e]" dir="rtl">
        <ClipboardCheck size={20} className="text-blue-400" strokeWidth={2} />
        تکمیل ثبت‌نام
      </h4>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div dir="rtl">
          <label className={labelClass}>
            <User size={16} className="text-blue-400" strokeWidth={2} />
            <span className="font-persian">نام کامل</span>
          </label>
          <input
            type="text"
            name="customerName"
            value={formData.customerName}
            onChange={handleChange}
            className={inputClass}
            placeholder="نام و نام خانوادگی"
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div dir="rtl">
            <label className={labelClass}>
              <CalendarDays size={16} className="text-blue-400" strokeWidth={2} />
              <span className="font-persian">تاریخ خرید</span>
            </label>
            <input
              type="date"
              name="purchaseDate"
              value={formData.purchaseDate}
              onChange={handleChange}
              className={inputClass}
              required
            />
          </div>
          <div dir="rtl">
            <label className={labelClass}>
              <Store size={16} className="text-blue-400" strokeWidth={2} />
              <span className="font-persian">فروشنده</span>
            </label>
            <input
              type="text"
              name="retailer"
              value={formData.retailer}
              onChange={handleChange}
              className={inputClass}
              placeholder="نام فروشگاه"
            />
          </div>
        </div>

        <div dir="rtl">
          <label className={labelClass}>
            <Hash size={16} className="text-blue-400" strokeWidth={2} />
            <span className="font-persian">شماره سریال</span>
          </label>
          <input
            type="text"
            name="serialVerification"
            value={formData.serialVerification}
            onChange={handleChange}
            className={`${inputClass} font-mono`}
            placeholder="شماره سریال محصول"
            dir="ltr"
            required
          />
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-blue-400/20 bg-white px-5 py-3 font-persian font-medium text-[#000c3e] transition hover:bg-[#F5F7FA]"
          >
            <X size={16} strokeWidth={2} />
            لغو
          </button>
          <button
            type="submit"
            className="flex flex-[2] items-center justify-center gap-2 rounded-full border border-blue-400/20 bg-gradient-to-r from-[#000c2e] via-[#001a5c] to-[#00256b] px-5 py-3 font-persian font-semibold text-white shadow-md transition hover:brightness-110"
          >
            <CheckCircle2 size={20} strokeWidth={2} />
            فعال‌سازی گارانتی
          </button>
        </div>
      </form>
    </div>
  );
};

export default RegistrationForm;
