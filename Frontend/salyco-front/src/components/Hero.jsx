import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Moon, Sparkles } from "lucide-react";
import PageBackground from "./PageBackground";

const highlights = [
  { icon: ShieldCheck, label: "گارانتی معتبر" },
  { icon: Moon, label: "خواب عمیق و آرام" },
  { icon: Sparkles, label: "کیفیت ممتاز" },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-white pt-[var(--navbar-height)]">
      <PageBackground />

      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* ── Text column ── */}
          <div dir="rtl" className="order-2 text-center lg:order-1 lg:text-right">
            <p className="font-sans text-sm uppercase tracking-[0.3em] text-wood-500/80">
              Salyco Mattress
            </p>
            <h1 className="mt-3 font-persian text-4xl font-bold leading-tight text-[#000c3e] md:text-5xl lg:text-6xl">
              خوابی آرام
              <br />
              روی بال‌های قو
            </h1>
            <hr className="mx-auto mt-5 w-24 border-t-2 border-wood-400 lg:mx-0" />
            <p className="mx-auto mt-6 max-w-xl font-persian text-base leading-relaxed text-[#000c3e]/65 lg:mx-0">
              تشک‌های سالیکو با مرغوب‌ترین مواد اولیه و طراحی ارگونومیک ساخته
              می‌شوند تا هر شب، خوابی عمیق و سالم را تجربه کنید.
            </p>

            {/* Highlights */}
            <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 lg:justify-start">
              {highlights.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-2 font-persian text-sm font-medium text-[#000c3e]/75"
                >
                  <Icon size={18} strokeWidth={1.75} className="text-wood-500" />
                  {label}
                </li>
              ))}
            </ul>

            {/* CTAs */}
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
              <Link
                to="/products/mattress"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#000c2e] via-[#001a5c] to-[#00256b] px-7 py-3 font-persian text-sm font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-900/20"
              >
                مشاهده محصولات
                <ArrowLeft size={16} />
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center gap-2 rounded-full border border-[#000c3e]/20 px-7 py-3 font-persian text-sm font-semibold text-[#000c3e] transition-colors hover:border-[#000c3e]/40 hover:bg-[#000c3e]/5"
              >
                درباره سالیکو
              </Link>
            </div>
          </div>

          {/* ── Image column ── */}
          <div className="order-1 lg:order-2">
            <div className="relative mx-auto max-w-lg overflow-hidden rounded-[32px] border border-[#0a1f4d]/10 bg-white shadow-[0_12px_50px_-12px_rgba(10,31,77,0.25)]">
              <img
                src="/heroimage2.png"
                alt="تشک سالیکو"
                className="h-full w-full object-cover"
              />
              {/* quiet brand mark */}
              <span className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white/90 backdrop-blur-sm">
                <Moon size={16} strokeWidth={1.75} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
