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
  phone: "۰۵۱-۸۸۷۷۶۶۵۵",
  phoneRaw: "+985188776655",
  email: "info@salyco.com",
  address: "نیشابور، خیابان مدرس، خیابان فضل",
  hours: "شنبه تا پنج‌شنبه، ۹ تا ۲۰",
};

// ─── Info card ────────────────────────────────────────────────────────────────
function InfoCard({ icon: Icon, label, value, href }) {
  const inner = (
    <div className="group flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#e2e8f0] transition hover:shadow-md hover:-translate-y-0.5">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#000c2e] via-[#001a5c] to-[#00256b] text-white shadow-inner transition group-hover:scale-105">
        <Icon size={20} />
      </span>
      <div className="min-w-0" dir="rtl">
        <p className="font-persian text-xs text-[#8a9ab8]">{label}</p>
        <p className="mt-0.5 truncate font-persian text-sm font-bold text-[#000c3e]">
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
    "w-full rounded-xl border border-[#d1d9eb] bg-white px-4 py-3 font-persian text-sm text-[#000c3e] placeholder-[#8a9ab8] transition focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20";

  return (
    <section
      className="relative min-h-screen overflow-hidden bg-white pt-[var(--navbar-height)]"
      dir="rtl"
      id="contact"
    >
      <PageBackground />

      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
        {/* ── Page header ── */}
        <header className="mb-12" dir="rtl">
          <p className="font-sans text-sm uppercase tracking-[0.3em] text-wood-500/80">
            Contact Us
          </p>
          <h1 className="mt-2 font-persian text-4xl font-bold text-[#000c3e] md:text-5xl">
            تماس با ما
          </h1>
          <hr className="mt-4 w-24 border-t-2 border-wood-400" />
          <p className="mt-4 max-w-xl font-persian text-base text-[#000c3e]/60">
            سوال، پیشنهاد یا انتقادی دارید؟ خوشحال می‌شویم صدای شما را بشنویم.
            از راه‌های زیر با ما در ارتباط باشید یا فرم را پر کنید.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.2fr]">
          {/* ── LEFT: contact info + creative panel ── */}
          <div className="flex flex-col gap-6">
            {/* Decorative gradient hero panel */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#000c2e] via-[#001a5c] to-[#00256b] p-7 text-white shadow-lg">
              {/* soft glows */}
              <div
                className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-40"
                style={{
                  background:
                    "radial-gradient(circle, rgba(193,154,107,0.6) 0%, transparent 70%)",
                }}
              />
              <div
                className="pointer-events-none absolute -bottom-12 -left-6 h-40 w-40 rounded-full opacity-30"
                style={{
                  background:
                    "radial-gradient(circle, rgba(37,99,235,0.7) 0%, transparent 70%)",
                }}
              />
              <div className="relative">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-blue-100 ring-1 ring-white/15">
                  <MessageSquare size={13} />
                  پشتیبانی سالیکو
                </span>
                <h2 className="mt-4 font-persian text-2xl font-bold leading-relaxed">
                  همراه شما، از انتخاب تا خواب راحت
                </h2>
                <p className="mt-3 font-persian text-sm leading-relaxed text-blue-100/80">
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
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#e2e8f0] sm:p-8">
            <h2 className="font-persian text-xl font-bold text-[#000c3e]">
              ثبت پیشنهاد و انتقاد
            </h2>
            <p className="mt-1 font-persian text-sm text-[#4b5a78]">
              فرم زیر را پر کنید؛ نظر شما برای ما ارزشمند است.
            </p>

            {status === "success" ? (
              <div className="mt-8 flex flex-col items-center justify-center rounded-2xl bg-[#f0fdf4] p-8 text-center ring-1 ring-green-200">
                <CheckCircle2 className="h-14 w-14 text-green-500" />
                <h3 className="mt-4 font-persian text-lg font-bold text-[#000c3e]">
                  پیام شما با موفقیت ارسال شد
                </h3>
                <p className="mt-2 font-persian text-sm text-[#4b5a78]">
                  از اینکه با ما در ارتباط هستید سپاسگزاریم. به‌زودی پاسخ شما را
                  خواهیم داد.
                </p>
                <button
                  onClick={() => setStatus("idle")}
                  className="mt-6 rounded-full border border-[#000c3e] px-6 py-2 font-persian text-sm font-medium text-[#000c3e] transition hover:bg-[#000c3e] hover:text-white"
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
                  <label className="mb-1.5 block font-persian text-sm font-medium text-[#000c3e]">
                    نام و نام خانوادگی
                  </label>
                  <div className="relative">
                    <User
                      size={16}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a9ab8]"
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
                    <label className="mb-1.5 block font-persian text-sm font-medium text-[#000c3e]">
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
                    <label className="mb-1.5 block font-persian text-sm font-medium text-[#000c3e]">
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
                  <label className="mb-1.5 block font-persian text-sm font-medium text-[#000c3e]">
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
                  <p className="rounded-lg bg-red-50 px-4 py-2.5 font-persian text-sm text-red-600">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#001a5c] to-[#00256b] px-6 py-3 font-persian text-sm font-bold text-white shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
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
