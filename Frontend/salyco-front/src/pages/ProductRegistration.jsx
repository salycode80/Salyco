import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Info, CheckCircle2, MessageCircle, Search } from "lucide-react";
import PageBackground from "../components/PageBackground";
import { toPersianNumber } from "../utils/persian";

const steps = [
  "کد QR روی تشک را اسکن کنید یا شماره سریال را وارد کنید",
  "جزئیات محصول و وضعیت گارانتی را بررسی کنید",
  "ثبت‌نام را تکمیل کنید تا گارانتی فعال شود",
];

// These must stay claims the system can actually back (§11). The previous copy
// promised "گارانتی محدود ۱۰ ساله", free replacement and 24-hour support — the
// first is wrong for Hermes (§10 gives it 8 years, not 10) and the other two
// appear nowhere in the brand sources. The wording below instead restates what
// the admin queue and MyWarranties already tell the customer.
const benefits = [
  "پوشش گارانتی طبق مشخصات هر مدل",
  "محاسبهٔ پوشش از تاریخ ثبت درخواست",
  "فعال‌سازی پس از تأیید کارشناسان",
];

export default function ProductRegistration() {
  const [serial, setSerial] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = serial.trim();
    if (trimmed) {
      navigate(`/warranty/mattress/${trimmed}`);
    }
  };

  return (
    <section className="relative min-h-screen overflow-hidden bg-white pt-[var(--navbar-height)]">
      <PageBackground />

      <div className="relative mx-auto max-w-[1120px] px-6 py-10 sm:py-16">
        <header className="mb-12" dir="rtl">
          <p className="font-sans text-sm uppercase tracking-[0.3em] text-text-secondary">
            Warranty
          </p>
          <h1 className="mt-2 font-persian text-3xl font-bold text-brand-navy md:text-4xl">
            ثبت گارانتی محصول
          </h1>
          <hr className="mt-4 w-24 border-t-2 border-brand-navy" />
          <p className="mt-4 max-w-xl font-persian text-base text-text-secondary">
            محصول خود را اسکن کنید و گارانتی را فعال کنید
          </p>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <div className="overflow-hidden rounded-xl border border-brand-mist bg-white p-6 shadow-[0_1px_4px_rgba(5,46,95,0.06)]">
              <div className="mb-4 flex items-center gap-3" dir="rtl">
                <div className="rounded-xl bg-brand-navy p-2.5">
                  <Info size={20} className="text-white" strokeWidth={1.5} />
                </div>
                <h3 className="font-persian text-lg font-semibold text-text-primary">
                  نحوه کار
                </h3>
              </div>
              <ul className="space-y-3" dir="rtl">
                {steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-navy text-xs font-bold text-white">
                      {toPersianNumber(i + 1)}
                    </span>
                    <span className="font-persian text-sm leading-relaxed text-text-secondary">
                      {step}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="overflow-hidden rounded-xl border border-brand-mist bg-white p-6 shadow-[0_1px_4px_rgba(5,46,95,0.06)]">
              <h3
                className="mb-4 font-persian text-lg font-semibold text-text-primary"
                dir="rtl"
              >
                مزایای گارانتی
              </h3>
              <div className="space-y-2.5" dir="rtl">
                {benefits.map((benefit) => (
                  <div key={benefit} className="flex items-center gap-2">
                    <CheckCircle2
                      size={16}
                      className="flex-shrink-0 text-status-success"
                      strokeWidth={2}
                    />
                    <span className="font-persian text-sm text-text-secondary">
                      {benefit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-brand-mist bg-brand-warm-white p-6">
              <div className="flex items-center gap-3" dir="rtl">
                <MessageCircle
                  size={32}
                  className="flex-shrink-0 text-brand-navy"
                  strokeWidth={1.5}
                />
                <div>
                  <p className="font-persian text-sm font-medium text-text-primary">
                    نیاز به راهنمایی دارید؟
                  </p>
                  <p className="font-persian text-xs text-text-secondary">
                    با تیم پشتیبانی ما تماس بگیرید
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-xl border border-brand-mist bg-white p-6 shadow-[0_1px_4px_rgba(5,46,95,0.06)] sm:p-8">
              <div className="mb-6 text-center" dir="rtl">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-navy">
                  <Search
                    size={28}
                    className="text-white"
                    strokeWidth={1.5}
                  />
                </div>
                <h2 className="font-persian text-xl font-semibold text-text-primary">
                  جستجوی گارانتی
                </h2>
                <p className="mt-2 font-persian text-sm text-text-secondary">
                  شماره سریال محصول خود را وارد کنید تا وضعیت گارانتی را مشاهده
                  کنید
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div dir="rtl">
                  <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-text-primary">
                    <span className="font-persian">شماره سریال محصول</span>
                  </label>
                  <input
                    type="text"
                    value={serial}
                    onChange={(e) => setSerial(e.target.value)}
                    className="h-12 w-full rounded-lg border border-brand-mist bg-white px-4 text-sm text-text-primary outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20 font-mono"
                    placeholder="SAL-XXXXXXXX"
                    dir="ltr"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-navy px-6 font-persian font-semibold text-white shadow-[0_1px_4px_rgba(5,46,95,0.06)] transition hover:bg-action-hover"
                >
                  <Search size={18} strokeWidth={2} />
                  بررسی گارانتی
                </button>
              </form>

              <div className="mt-6 flex items-center justify-center gap-2 border-t border-brand-mist pt-4 text-center text-xs text-text-secondary">
                <span className="font-persian">
                  اسکن QR یا وارد کردن سریال · پورتال گارانتی سالیکو
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
