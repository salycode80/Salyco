import { Link } from "react-router-dom";
import { BedDouble, Layers, Shield, Sparkles, ArrowLeft } from "lucide-react";

const categories = [
  {
    title: "تشک های سالیکو",
    subtitle: "Mattresses",
    description:
      "تشک‌های فنر متصل، فنر پاکتی و فوم با کیفیت بالا برای خوابی عمیق.",
    icon: BedDouble,
    href: "/gallery",
  },
  {
    title: "تاپر تشک",
    subtitle: "Toppers",
    description: "لایه‌های نرم و طبی برای افزایش راحتی و طول عمر تشک.",
    icon: Layers,
    href: "/gallery",
  },
  {
    title: "تشک طبی",
    subtitle: "Orthopedic",
    description: "طراحی ارگونومیک برای حمایت از ستون فقرات و کاهش فشار.",
    icon: Shield,
    href: "/gallery",
  },
  {
    title: "بالش و ملحفه",
    subtitle: "Bedding",
    description: "بالش‌های ارتوپدیک و ملحفه‌های نرم برای تکمیل تجربه خواب.",
    icon: Sparkles,
    href: "/gallery",
  },
];

export default function CategoriesSection() {
  return (
    <section className="relative overflow-hidden bg-[#F5F7FA] py-20">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(100,160,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(100,160,255,0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div
        className="pointer-events-none absolute bottom-0 left-0 h-64 w-1/2"
        style={{
          background:
            "linear-gradient(to right, rgba(0,50,180,0.08) 0%, transparent 100%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6">
        <header className="mb-12" dir="rtl">
          <p className="font-sans text-sm uppercase tracking-[0.3em] text-blue-400/80">
            Categories
          </p>
          <h2 className="mt-2 font-persian text-3xl font-bold text-[#000c3e] md:text-4xl">
            دسته‌بندی‌های اصلی
          </h2>
          <hr className="mt-4 w-24 border-t-2 border-[#000c3e]" />
          <p className="mt-4 max-w-xl font-sans text-base text-[#000c3e]/60">
            Explore our core product lines, crafted for restful sleep on swan
            wings.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map(
            ({ title, subtitle, description, icon: Icon, href }) => (
              <Link
                key={title}
                to={href}
                className="group flex flex-col overflow-hidden rounded-2xl border border-blue-400/15 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/30 hover:shadow-lg hover:shadow-blue-900/10"
              >
                <div className="relative flex h-36 items-center justify-center bg-gradient-to-br from-[#000c2e] via-[#001a5c] to-[#00256b]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(100,160,255,0.25),transparent_60%)]" />
                  <Icon
                    size={40}
                    strokeWidth={1.5}
                    className="relative text-blue-200/90 transition-transform duration-300 group-hover:scale-110"
                  />
                </div>

                <div className="flex flex-1 flex-col p-5" dir="rtl">
                  <p className="font-sans text-xs uppercase tracking-[0.2em] text-blue-400/70">
                    {subtitle}
                  </p>
                  <h3 className="mt-1 font-persian text-xl font-bold text-[#000c3e]">
                    {title}
                  </h3>
                  <p className="mt-2 flex-1 font-persian text-sm leading-relaxed text-[#000c3e]/65">
                    {description}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 font-sans text-xs font-medium uppercase tracking-widest text-[#001a5c] transition-colors group-hover:text-blue-500">
                    مشاهده
                    <ArrowLeft
                      size={14}
                      className="transition-transform group-hover:-translate-x-1"
                    />
                  </span>
                </div>
              </Link>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
