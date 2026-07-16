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
      <div className="relative mx-auto max-w-7xl sm:px-6">
        {/* ── Image (full-bleed) ── */}
        <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen">
          <div className="relative aspect-[16/8] w-full overflow-hidden sm:aspect-[16/7] lg:aspect-[21/8]">
            <img
              src="/heroimage2.png"
              alt="تشک سالیکو"
              className="h-full w-full object-cover"
            />
            <span className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white/90 backdrop-blur-sm">
              <Moon size={16} strokeWidth={1.75} />
            </span>
          </div>
        </div>
        {/* ── CTAs ── */}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
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
        {/* ── Highlights ── */}
        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
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
      </div>
    </section>
  );
}
