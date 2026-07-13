import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Award,
  Leaf,
  HeartHandshake,
  Sparkles,
  Moon,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import PageBackground from "../components/PageBackground";

// ─── Data ─────────────────────────────────────────────────────────────────────
const STATS = [
  { value: 20, suffix: "+", label: "سال تجربه" },
  { value: 50, suffix: "K+", label: "خواب آرام" },
  { value: 120, suffix: "", label: "ماه گارانتی" },
  { value: 4, suffix: "", label: "نمایندگی فعال" },
];

const VALUES = [
  {
    icon: Award,
    title: "کیفیت ممتاز",
    desc: "استفاده از بهترین مواد اولیه و استانداردهای جهانی در تولید هر تشک.",
  },
  {
    icon: Leaf,
    title: "مواد سالم",
    desc: "فوم‌های ضدحساسیت و پارچه‌های تنفس‌پذیر برای خوابی سالم و بهداشتی.",
  },
  {
    icon: HeartHandshake,
    title: "مشتری‌مداری",
    desc: "پشتیبانی صادقانه و همراهی با شما از لحظه‌ی انتخاب تا سال‌ها بعد.",
  },
  {
    icon: ShieldCheck,
    title: "گارانتی معتبر",
    desc: "تا ۱۲۰ ماه ضمانت واقعی، چون به دوام محصولاتمان ایمان داریم.",
  },
];

const TIMELINE = [
  { year: "۱۳۸۳", title: "آغاز راه", text: "تولد سالیکو با یک کارگاه کوچک و رویایی بزرگ." },
  { year: "۱۳۹۰", title: "رشد و توسعه", text: "افزودن خطوط تولید مدرن و گسترش سبد محصولات." },
  { year: "۱۳۹۸", title: "فناوری نوین", text: "به‌کارگیری فوم‌های نسل جدید و طراحی ارگونومیک." },
  { year: "۱۴۰۳", title: "امروز", text: "برندی مورد اعتماد با شبکه‌ی نمایندگی در سراسر کشور." },
];

// Simple, frameless gallery — just images. Swap these paths for your own.
const GALLERY = [
  "/heroimage.png",
  "/banner.png",
  "/matress.png",
  "/heroimage2.png",
  "/banner2.png",
  "/locationimage.jpg",
];

// ─── Count-up hook (fires when element scrolls into view) ─────────────────────
function useCountUp(target, active, duration = 1400) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf;
    let start;
    const step = (t) => {
      if (start === undefined) start = t;
      const p = Math.min((t - start) / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);
  return n;
}

function StatItem({ value, suffix, label, active }) {
  const n = useCountUp(value, active);
  return (
    <div className="text-center" dir="rtl">
      <p className="font-sans text-4xl font-extrabold text-white md:text-5xl">
        {n.toLocaleString("fa-IR")}
        <span className="text-wood-300">{suffix}</span>
      </p>
      <p className="mt-2 font-persian text-sm text-blue-100/70">{label}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function About() {
  const statsRef = useRef(null);
  const [statsActive, setStatsActive] = useState(false);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setStatsActive(true),
      { threshold: 0.35 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-white" dir="rtl">
      {/* ══ HERO ══ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#000c2e] via-[#001a5c] to-[#00256b] pt-[calc(var(--navbar-height)+3rem)] pb-24">
        {/* ambient glows */}
        <div
          className="pointer-events-none absolute -right-20 -top-10 h-96 w-96 rounded-full opacity-40"
          style={{ background: "radial-gradient(circle, rgba(193,154,107,0.45) 0%, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -left-24 bottom-0 h-96 w-96 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, rgba(37,99,235,0.6) 0%, transparent 70%)" }}
        />

        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 font-persian text-xs font-medium text-blue-100 ring-1 ring-white/15">
            <Sparkles size={14} className="text-wood-300" />
            داستان سالیکو
          </span>
          <h1 className="mt-6 font-persian text-4xl font-bold leading-tight text-white md:text-6xl">
            آنجا که خواب بر بال‌های قو آرام می‌گیرد
          </h1>
          <p className="mx-auto mt-6 max-w-2xl font-persian text-base leading-loose text-blue-100/80 md:text-lg">
            سالیکو با بیش از دو دهه تجربه در تولید تشک و محصولات خواب، ترکیبی از
            فناوری مدرن و کیفیت ممتاز را برای خوابی آرام و سالم به خانه‌ی شما
            می‌آورد. باور ما این است که یک خواب خوب، آغاز یک زندگی بهتر است.
          </p>
          <p className="mx-auto mt-4 max-w-2xl font-sans text-sm italic leading-relaxed text-blue-200/50">
            Where every night rests on swan wings.
          </p>
        </div>

        {/* wave divider */}
        <svg
          className="absolute bottom-0 left-0 w-full text-white"
          viewBox="0 0 1440 100"
          fill="currentColor"
          preserveAspectRatio="none"
        >
          <path d="M0,64 C360,120 1080,0 1440,56 L1440,100 L0,100 Z" />
        </svg>
      </section>

      {/* ══ STORY + MISSION ══ */}
      <section className="relative bg-white py-20">
        <PageBackground />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
          <div dir="rtl">
            <p className="font-sans text-sm uppercase tracking-[0.3em] text-wood-500/80">
              Our Story
            </p>
            <h2 className="mt-2 font-persian text-3xl font-bold text-[#000c3e] md:text-4xl">
              رسالت ما، خوابِ راحتِ شماست
            </h2>
            <hr className="mt-4 w-20 border-t-2 border-wood-400" />
            <p className="mt-6 font-persian text-base leading-loose text-[#4b5a78]">
              از یک کارگاه کوچک آغاز کردیم، با این باور که هر انسان سزاوار یک خواب
              آرام و سالم است. امروز پس از سال‌ها تلاش، سالیکو به برندی مورد
              اعتماد بدل شده که هر تشک را نه یک کالا، بلکه بخشی از سلامت و آرامش
              خانواده‌ها می‌داند.
            </p>
            <p className="mt-4 font-persian text-base leading-loose text-[#4b5a78]">
              تیم ما با وسواس، از انتخاب مواد اولیه تا کنترل کیفیت نهایی، در کنار
              شماست تا خیالتان از انتخابی درست آسوده باشد.
            </p>

            <Link
              to="/products/mattress"
              className="group mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#001a5c] to-[#00256b] px-6 py-3 font-persian text-sm font-bold text-white shadow-md transition hover:brightness-110"
            >
              مشاهده محصولات
              <ArrowLeft size={17} className="transition-transform group-hover:-translate-x-1" />
            </Link>
          </div>

          {/* decorative image stack */}
          <div className="relative" dir="ltr">
            <div className="overflow-hidden rounded-3xl shadow-xl ring-1 ring-[#e2e8f0]">
              <img
                src="/heroimage.png"
                alt="سالیکو"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 hidden items-center gap-3 rounded-2xl bg-white p-4 shadow-lg ring-1 ring-[#e2e8f0] sm:flex" dir="rtl">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#000c2e] to-[#00256b] text-white">
                <Moon size={20} />
              </span>
              <div>
                <p className="font-persian text-sm font-bold text-[#000c3e]">خواب سالم</p>
                <p className="font-persian text-xs text-[#8a9ab8]">تعهد همیشگی ما</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ STATS (count-up) ══ */}
      <section
        ref={statsRef}
        className="relative overflow-hidden bg-gradient-to-r from-[#000c2e] via-[#001a5c] to-[#00256b] py-16"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(193,154,107,0.15),transparent_60%)]" />
        <div className="relative mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 sm:px-6 md:grid-cols-4">
          {STATS.map((s) => (
            <StatItem key={s.label} {...s} active={statsActive} />
          ))}
        </div>
      </section>

      {/* ══ VALUES ══ */}
      <section className="relative bg-white py-20">
        <PageBackground />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center" dir="rtl">
            <p className="font-sans text-sm uppercase tracking-[0.3em] text-wood-500/80">
              Our Values
            </p>
            <h2 className="mt-2 font-persian text-3xl font-bold text-[#000c3e] md:text-4xl">
              ارزش‌هایی که به آن پایبندیم
            </h2>
            <hr className="mx-auto mt-4 w-20 border-t-2 border-wood-400" />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-[#e2e8f0] transition hover:-translate-y-1 hover:shadow-md"
                dir="rtl"
              >
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#000c2e] to-[#00256b] text-white shadow-inner transition group-hover:scale-110">
                  <Icon size={24} />
                </span>
                <h3 className="mt-5 font-persian text-lg font-bold text-[#000c3e]">
                  {title}
                </h3>
                <p className="mt-2 font-persian text-sm leading-relaxed text-[#4b5a78]">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TIMELINE ══ */}
      <section className="relative bg-[#f7f9fd] py-20">
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-14 text-center" dir="rtl">
            <p className="font-sans text-sm uppercase tracking-[0.3em] text-wood-500/80">
              Our Journey
            </p>
            <h2 className="mt-2 font-persian text-3xl font-bold text-[#000c3e] md:text-4xl">
              مسیری که پیموده‌ایم
            </h2>
            <hr className="mx-auto mt-4 w-20 border-t-2 border-wood-400" />
          </div>

          <div className="relative">
            {/* vertical line */}
            <div className="absolute right-4 top-0 h-full w-0.5 bg-gradient-to-b from-[#2563eb] via-[#001a5c] to-transparent md:right-1/2" />

            <div className="flex flex-col gap-10">
              {TIMELINE.map((item, i) => (
                <div
                  key={item.year}
                  className={`relative flex md:w-1/2 ${
                    i % 2 === 0 ? "md:mr-auto md:pl-10" : "md:ml-auto md:pr-10 md:text-left"
                  } pr-12 md:pr-0`}
                  dir="rtl"
                >
                  {/* dot */}
                  <span className="absolute right-2 top-1.5 z-10 h-5 w-5 -translate-y-0 rounded-full border-4 border-white bg-[#2563eb] shadow md:right-auto md:left-[-2.6rem] ltr:md:left-auto" />
                  <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#e2e8f0]">
                    <span className="font-sans text-sm font-bold text-wood-500">
                      {item.year}
                    </span>
                    <h3 className="mt-1 font-persian text-lg font-bold text-[#000c3e]">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 font-persian text-sm leading-relaxed text-[#4b5a78]">
                      {item.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ GALLERY — simple, frameless, no cards ══ */}
      <section className="relative bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center" dir="rtl">
            <p className="font-sans text-sm uppercase tracking-[0.3em] text-wood-500/80">
              Gallery
            </p>
            <h2 className="mt-2 font-persian text-3xl font-bold text-[#000c3e] md:text-4xl">
              گالری سالیکو
            </h2>
            <hr className="mx-auto mt-4 w-20 border-t-2 border-wood-400" />
          </div>

          {/* masonry-style columns; plain images, no frame or card */}
          <div className="columns-2 gap-4 md:columns-3 [&>img]:mb-4">
            {GALLERY.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`گالری سالیکو ${i + 1}`}
                loading="lazy"
                className="w-full rounded-lg object-cover transition duration-300 hover:opacity-90"
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
