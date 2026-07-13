import { BedDouble, Layers, Shield, Sparkles } from "lucide-react";

const categories = [
  {
    title: "تشک های سالیکو",
    subtitle: "Mattresses",
    icon: BedDouble,
  },
  {
    title: "تاپر تشک",
    subtitle: "Toppers",
    icon: Layers,
  },
  {
    title: "تشک طبی",
    subtitle: "Orthopedic",
    icon: Shield,
  },
  {
    title: "بالش و ملحفه",
    subtitle: "Bedding",
    icon: Sparkles,
  },
];

export default function CategoriesSection() {
  return (
    <section className="relative overflow-hidden bg-white py-16">
      <div className="relative mx-auto max-w-7xl px-6">
        <header className="mb-10" dir="rtl">
          <p className="font-sans text-sm uppercase tracking-[0.3em] text-neutral-400">
            Categories
          </p>
          <h2 className="mt-2 font-persian text-2xl font-bold text-neutral-700 md:text-3xl">
            دسته‌بندی‌های اصلی
          </h2>
          <hr className="mt-4 w-20 border-t-2 border-neutral-300" />
        </header>

        <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          {categories.map(({ title, subtitle, icon: Icon }) => (
            <div
              key={title}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 grayscale transition-all duration-300 hover:shadow-md"
            >
              {/* icon panel — muted greyscale */}
              <div className="relative flex h-24 items-center justify-center bg-gradient-to-br from-neutral-700 via-neutral-600 to-neutral-800">
                <Icon
                  size={30}
                  strokeWidth={1.5}
                  className="relative text-neutral-300"
                />
              </div>

              {/* label */}
              <div className="flex flex-col p-3.5" dir="rtl">
                <p className="font-sans text-[0.65rem] uppercase tracking-[0.2em] text-neutral-400">
                  {subtitle}
                </p>
                <h3 className="mt-1 font-persian text-sm font-bold text-neutral-600">
                  {title}
                </h3>
              </div>

              {/* ── Coming soon overlay ── */}
              <div className="absolute inset-0 flex items-center justify-center bg-white/55 backdrop-blur-[1px]">
                <span className="rounded-full border border-neutral-300 bg-white/90 px-4 py-1.5 font-persian text-sm font-bold text-neutral-600 shadow-sm">
                  به زودی
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
