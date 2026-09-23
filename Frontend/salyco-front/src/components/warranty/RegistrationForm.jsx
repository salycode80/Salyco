import { ClipboardCheck, User, Phone, MapPin, Hash, X, CheckCircle2 } from "lucide-react";

const inputClass =
  "h-12 w-full rounded-lg border border-brand-mist bg-white px-4 text-sm text-text-primary outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20";

const labelClass =
  "mb-1.5 flex items-center gap-2 text-sm font-medium text-text-primary";

const RegistrationForm = ({ formData, setFormData, onCancel, onSubmit, loading }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="mt-6 rounded-xl border border-brand-mist bg-brand-warm-white p-5 sm:p-6">
      <h4 className="mb-4 flex items-center gap-2 font-persian text-lg font-semibold text-text-primary" dir="rtl">
        <ClipboardCheck size={20} className="text-brand-navy" strokeWidth={2} />
        تکمیل ثبت‌نام
      </h4>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div dir="rtl">
            <label className={labelClass}>
              <User size={16} className="text-text-secondary" strokeWidth={2} />
              <span className="font-persian">نام</span>
            </label>
            <input
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              className={inputClass}
              placeholder="نام"
              required
            />
          </div>
          <div dir="rtl">
            <label className={labelClass}>
              <User size={16} className="text-text-secondary" strokeWidth={2} />
              <span className="font-persian">نام خانوادگی</span>
            </label>
            <input
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              className={inputClass}
              placeholder="نام خانوادگی"
              required
            />
          </div>
        </div>

        <div dir="rtl">
          <label className={labelClass}>
            <Phone size={16} className="text-text-secondary" strokeWidth={2} />
            <span className="font-persian">شماره تلفن</span>
          </label>
          <input
            type="tel"
            name="phone_number"
            value={formData.phone_number}
            onChange={handleChange}
            className={inputClass}
            placeholder="شماره تلفن"
            dir="ltr"
          />
        </div>

        <div dir="rtl">
          <label className={labelClass}>
            <MapPin size={16} className="text-text-secondary" strokeWidth={2} />
            <span className="font-persian">آدرس</span>
          </label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            className={inputClass}
            placeholder="آدرس"
          />
        </div>

        <div dir="rtl">
          <label className={labelClass}>
            <Hash size={16} className="text-text-secondary" strokeWidth={2} />
            <span className="font-persian">کد پستی</span>
          </label>
          <input
            type="text"
            name="postal_code"
            value={formData.postal_code}
            onChange={handleChange}
            className={inputClass}
            placeholder="کد پستی"
            dir="ltr"
          />
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border-2 border-brand-navy bg-white px-5 font-persian font-medium text-brand-navy transition hover:bg-brand-warm-white disabled:opacity-60"
          >
            <X size={16} strokeWidth={2} />
            لغو
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-lg bg-brand-navy px-5 font-persian font-semibold text-white shadow-[0_1px_4px_rgba(5,46,95,0.06)] transition hover:bg-action-hover disabled:bg-brand-mist disabled:text-text-secondary"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                در حال ثبت...
              </span>
            ) : (
              <>
                <CheckCircle2 size={20} strokeWidth={2} />
                فعال‌سازی گارانتی
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RegistrationForm;
