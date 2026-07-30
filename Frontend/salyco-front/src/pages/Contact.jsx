import { useState } from "react";
import {
  Phone,
  Mail,
  MapPin,
  Send,
  MessageSquare,
  CheckCircle2,
  User,
  Loader2,
} from "lucide-react";
import api from "../api";
import PageBackground from "../components/PageBackground";

// ─── Static contact info ──────────────────────────────────────────────────────
const CONTACT = {
  phone: "09126847234",
  phoneRaw: "+989126847234",
  email: "thisissalyco@gmail.com",
  address: "نیشابور، خیابان مدرس، خیابان فضل",
  hours: "شنبه تا پنج‌شنبه، ۹ تا ۲۰",
};

// ─── Info card ────────────────────────────────────────────────────────────────
function InfoCard({ icon: Icon, label, value, href }) {
  const inner = (
    <div className="group flex items-center gap-4 rounded-xl bg-white p-5 shadow-[0_1px_4px_rgba(0,48,135,0.06)] ring-1 ring-[#CBD2D6] transition hover:shadow-[0_4px_16px_rgba(0,48,135,0.1)] hover:-translate-y-0.5">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#003087] text-white shadow-inner transition group-hover:scale-105">
        <Icon size={20} />
      </span>
      <div className="min-w-0" dir="rtl">
        <p className="font-persian text-xs text-[#687173]">{label}</p>
        <p className="mt-0.5 truncate font-persian text-sm font-bold text-[#1A1A2E]">
          {value}
        </p>
      </div>
    </div>
  );

  return href ? (
    <a href={href} className="block" dir="ltr">
      {inner}
    </a>
  ) : (
    inner
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Contact() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [status, setStatus] = useState("idle"); // idle | sending | success | error
  const [error, setError] = useState("");

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.email && !form.phone) {
      setError("لطفاً ایمیل یا شماره تماس را وارد کنید.");
      return;
    }

    setStatus("sending");
    try {
      await api.post("/api/contact/", form);
      setStatus("success");
      setForm({ name: "", email: "", phone: "", message: "" });
    } catch (err) {
      const detail =
        err?.response?.data?.non_field_errors?.[0] ||
        "ارسال پیام با خطا مواجه شد. لطفاً دوباره تلاش کنید.";
      setError(detail);
      setStatus("error");
    }
  };

  const inputBase =
    "w-full rounded-lg border border-[#CBD2D6] bg-white px-4 py-3 font-persian text-sm text-[#1A1A2E] placeholder-[#687173] transition focus:border-[#009CDE] focus:outline-none focus:ring-2 focus:ring-[#009CDE]/20";

  return (
    <section
      className="relative min-h-screen overflow-hidden bg-[#F5F7FA] pt-[var(--navbar-height)]"
      dir="rtl"
      id="contact"
    >
      <PageBackground />

      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
        {/* ── Page header ── */}
        <header className="mb-12" dir="rtl">
          <p className="font-sans text-sm uppercase tracking-[0.3em] text-[#687173]">
            Contact Us
          </p>
          <h1 className="mt-2 font-persian text-3xl font-bold text-[#003087] md:text-4xl">
            تماس با ما
          </h1>
          <hr className="mt-4 w-24 border-t-2 border-[#003087]" />
          <p className="mt-4 max-w-xl font-persian text-base text-[#687173]">
            سوال، پیشنهاد یا انتقادی دارید؟ خوشحال می‌شویم صدای شما را بشنویم.
            از راه‌های زیر با ما در ارتباط باشید یا فرم را پر کنید.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.2fr]">
          {/* ── LEFT: contact info + creative panel ── */}
          <div className="flex flex-col gap-6">
            {/* Decorative gradient hero panel */}
            <div className="relative overflow-hidden rounded-xl bg-[#003087] p-7 text-white shadow-[0_4px_16px_rgba(0,48,135,0.1)]">
              {/* soft glows */}
              <div
                className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-40"
                style={{
                  background:
                    "radial-gradient(circle, rgba(245,186,46,0.6) 0%, transparent 70%)",
                }}
              />
              <div
                className="pointer-events-none absolute -bottom-12 -left-6 h-40 w-40 rounded-full opacity-30"
                style={{
                  background:
                    "radial-gradient(circle, rgba(0,156,222,0.7) 0%, transparent 70%)",
                }}
              />
              <div className="relative">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/15">
                  <MessageSquare size={13} />
                  پشتیبانی سالیکو
                </span>
                <h2 className="mt-4 font-persian text-2xl font-bold leading-relaxed">
                  همراه شما، از انتخاب تا خواب راحت
                </h2>
                <p className="mt-3 font-persian text-sm leading-relaxed text-white/80">
                  کارشناسان ما آماده‌اند تا در انتخاب تشک مناسب، ثبت گارانتی و
                  پاسخ به پرسش‌های شما یاری‌تان کنند. در سریع‌ترین زمان ممکن
                  پاسخ‌گوی شما خواهیم بود.
                </p>
              </div>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoCard
                icon={Phone}
                label="تماس تلفنی"
                value={CONTACT.phone}
                href={`tel:${CONTACT.phoneRaw}`}
              />
              <InfoCard
                icon={Mail}
                label="ایمیل"
                value={CONTACT.email}
                href={`mailto:${CONTACT.email}`}
              />
            </div>
          </div>

          {/* ── RIGHT: suggestion form ── */}
          <div className="rounded-xl bg-white p-6 shadow-[0_1px_4px_rgba(0,48,135,0.06)] ring-1 ring-[#CBD2D6] sm:p-8">
            <h2 className="font-persian text-xl font-bold text-[#1A1A2E]">
              ثبت پیشنهاد و انتقاد
            </h2>
            <p className="mt-1 font-persian text-sm text-[#687173]">
              فرم زیر را پر کنید؛ نظر شما برای ما ارزشمند است.
            </p>

            {status === "success" ? (
              <div className="mt-8 flex flex-col items-center justify-center rounded-xl bg-[#E6F4EA] p-8 text-center ring-1 ring-[#019C34]/30">
                <CheckCircle2 className="h-14 w-14 text-[#019C34]" />
                <h3 className="mt-4 font-persian text-lg font-bold text-[#1A1A2E]">
                  پیام شما با موفقیت ارسال شد
                </h3>
                <p className="mt-2 font-persian text-sm text-[#687173]">
                  از اینکه با ما در ارتباط هستید سپاسگزاریم. به‌زودی پاسخ شما را
                  خواهیم داد.
                </p>
                <button
                  onClick={() => setStatus("idle")}
                  className="mt-6 rounded-lg border-2 border-[#003087] px-6 py-2 font-persian text-sm font-medium text-[#003087] transition hover:bg-[#003087] hover:text-white"
                >
                  ارسال پیام جدید
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="mt-6 flex flex-col gap-4"
              >
                {/* name */}
                <div>
                  <label className="mb-1.5 block font-persian text-sm font-medium text-[#1A1A2E]">
                    نام و نام خانوادگی
                  </label>
                  <div className="relative">
                    <User
                      size={16}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#687173]"
                    />
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      required
                      placeholder="نام شما"
                      className={`${inputBase} pr-10`}
                    />
                  </div>
                </div>

                {/* email + phone */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block font-persian text-sm font-medium text-[#1A1A2E]">
                      ایمیل
                    </label>
                    <input
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="example@mail.com"
                      dir="ltr"
                      className={`${inputBase} text-left`}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block font-persian text-sm font-medium text-[#1A1A2E]">
                      شماره تماس
                    </label>
                    <input
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                      dir="ltr"
                      className={`${inputBase} text-left`}
                    />
                  </div>
                </div>

                {/* message */}
                <div>
                  <label className="mb-1.5 block font-persian text-sm font-medium text-[#1A1A2E]">
                    پیام شما
                  </label>
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    required
                    rows={5}
                    placeholder="پیشنهاد، انتقاد یا پرسش خود را بنویسید..."
                    className={`${inputBase} resize-none`}
                  />
                </div>

                {error && (
                  <p className="rounded-lg bg-[#FDE7E7] px-4 py-2.5 font-persian text-sm text-[#D20000]">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-[#003087] px-6 py-3 font-persian text-sm font-bold text-white shadow-[0_1px_4px_rgba(0,48,135,0.06)] transition hover:bg-[#00246B] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {status === "sending" ? (
                    <>
                      <Loader2 size={17} className="animate-spin" />
                      در حال ارسال...
                    </>
                  ) : (
                    <>
                      <Send size={17} />
                      ارسال پیام
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
