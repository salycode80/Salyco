import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Info, CheckCircle2, MessageCircle, Search } from "lucide-react";

const steps = [
  "کد QR روی تشک را اسکن کنید یا شماره سریال را وارد کنید",
  "جزئیات محصول و وضعیت گارانتی را بررسی کنید",
  "ثبت‌نام را تکمیل کنید تا گارانتی فعال شود",
];

const benefits = [
  "گارانتی محدود ۱۰ ساله",
  "تعویض رایگان در صورت نقص",
  "پشتیبانی ۲۴ ساعته",
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
    <section className="relative min-h-screen overflow-hidden bg-[#F5F7FA] pt-[var(--navbar-height)]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(100,160,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(100,160,255,0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div
        className="pointer-events-none absolute top-0 right-0 h-96 w-1/2"
        style={{
          background:
            "linear-gradient(to left, rgba(0,50,180,0.12) 0%, transparent 100%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16">
        <header className="mb-12" dir="rtl">
          <p className="font-sans text-sm uppercase tracking-[0.3em] text-blue-400/80">
            Warranty
          </p>
          <h1 className="mt-2 font-persian text-4xl font-bold text-[#000c3e] md:text-5xl">
            ثبت گارانتی محصول
          </h1>
          <hr className="mt-4 w-24 border-t-2 border-[#000c3e]" />
          <p className="mt-4 max-w-xl font-sans text-base text-[#000c3e]/60">
            محصول خود را اسکن کنید و گارانتی را فعال کنید
          </p>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <div className="overflow-hidden rounded-2xl border border-blue-400/15 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3" dir="rtl">
                <div className="rounded-xl bg-gradient-to-br from-[#000c2e] via-[#001a5c] to-[#00256b] p-2.5">
                  <Info size={20} className="text-blue-200" strokeWidth={1.5} />
                </div>
                <h3 className="font-persian text-lg font-semibold text-[#000c3e]">
                  نحوه کار
                </h3>
              </div>
              <ul className="space-y-3" dir="rtl">
                {steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#001a5c] text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="font-persian text-sm leading-relaxed text-[#000c3e]/70">
                      {step}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="overflow-hidden rounded-2xl border border-blue-400/15 bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-persian text-lg font-semibold text-[#000c3e]" dir="rtl">
                مزایای گارانتی
              </h3>
              <div className="space-y-2.5" dir="rtl">
                {benefits.map((benefit) => (
                  <div key={benefit} className="flex items-center gap-2">
                    <CheckCircle2
                      size={16}
                      className="flex-shrink-0 text-blue-400"
                      strokeWidth={2}
                    />
                    <span className="font-persian text-sm text-[#000c3e]/70">
                      {benefit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-blue-400/20 bg-gradient-to-br from-[#000c2e]/5 via-[#001a5c]/5 to-[#00256b]/5 p-6">
              <div className="flex items-center gap-3" dir="rtl">
                <MessageCircle
                  size={32}
                  className="flex-shrink-0 text-blue-400/80"
                  strokeWidth={1.5}
                />
                <div>
                  <p className="font-persian text-sm font-medium text-[#000c3e]">
                    نیاز به راهنمایی دارید؟
                  </p>
                  <p className="font-persian text-xs text-[#000c3e]/60">
                    با تیم پشتیبانی ما تماس بگیرید
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-2xl border border-blue-400/15 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6 text-center" dir="rtl">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#000c2e] via-[#001a5c] to-[#00256b]">
                  <Search size={28} className="text-blue-200" strokeWidth={1.5} />
                </div>
                <h2 className="font-persian text-xl font-semibold text-[#000c3e]">
                  جستجوی گارانتی
                </h2>
                <p className="mt-2 font-persian text-sm text-[#000c3e]/60">
                  شماره سریال محصول خود را وارد کنید تا وضعیت گارانتی را مشاهده کنید
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div dir="rtl">
                  <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-[#000c3e]">
                    <span className="font-persian">شماره سریال محصول</span>
                  </label>
                  <input
                    type="text"
                    value={serial}
                    onChange={(e) => setSerial(e.target.value)}
                    className="w-full rounded-full border border-blue-400/20 bg-white px-5 py-3 text-sm text-[#000c3e] outline-none transition focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20 font-mono"
                    placeholder="SAL-XXXXXXXX"
                    dir="ltr"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#000c2e] via-[#001a5c] to-[#00256b] px-6 py-3 font-persian font-semibold text-white shadow-md transition hover:brightness-110"
                >
                  <Search size={18} strokeWidth={2} />
                  بررسی گارانتی
                </button>
              </form>

              <div className="mt-6 flex items-center justify-center gap-2 border-t border-blue-400/10 pt-4 text-center text-xs text-[#000c3e]/50">
                <span>اسکن QR یا وارد کردن سریال · پورتال گارانتی سالیکو</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
