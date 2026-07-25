import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Moon, Sparkles, Download } from "lucide-react";
import PageBackground from "./PageBackground";

const highlights = [
  { icon: ShieldCheck, label: "گارانتی معتبر" },
  { icon: Moon, label: "خواب عمیق و آرام" },
  { icon: Sparkles, label: "کیفیت ممتاز" },
];
export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      <PageBackground />
      <div className="relative mx-auto max-w-7xl sm:px-6">
        {/* ── Image (full-bleed) ── */}
        <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen">
          <div className="relative aspect-[16/8] w-full overflow-hidden sm:aspect-[16/7] lg:aspect-[21/8]">
            <img
              src="/layerdimage.png"
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
            className="inline-flex items-center gap-2 rounded-lg bg-[#003087] px-7 py-3 font-persian text-sm font-semibold text-white shadow-[0_1px_4px_rgba(0,48,135,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#00246B] hover:shadow-[0_4px_16px_rgba(0,48,135,0.1)]"
          >
            مشاهده محصولات
            <ArrowLeft size={16} />
          </Link>
          <a
            href="/catalog.pdf"
            download
            className="inline-flex items-center gap-2 rounded-lg border-2 border-[#003087] bg-white px-7 py-3 font-persian text-sm font-semibold text-[#003087] transition-colors hover:bg-[#003087]/5"
          >
            <Download size={16} />
            دانلود کاتالوگ
          </a>
        </div>
        {/* ── Highlights ── */}
        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {highlights.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-2 font-persian text-sm font-medium text-[#1A1A2E]"
            >
              <Icon size={18} strokeWidth={1.75} className="text-[#003087]" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
