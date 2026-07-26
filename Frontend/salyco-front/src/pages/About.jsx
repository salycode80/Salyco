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
  { value: 20, suffix: "Y+", label: "سال تجربه" },
  { value: 50, suffix: "K+", label: "خواب آرام" },
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

// const TIMELINE = [
//   {
//     year: "۱۳۸۳",
//     title: "آغاز راه",
//     text: "تولد سالیکو با یک کارگاه کوچک و رویایی بزرگ.",
//   },
//   {
//     year: "۱۳۹۰",
//     title: "رشد و توسعه",
//     text: "افزودن خطوط تولید مدرن و گسترش سبد محصولات.",
//   },
//   {
//     year: "۱۳۹۸",
//     title: "فناوری نوین",
//     text: "به‌کارگیری فوم‌های نسل جدید و طراحی ارگونومیک.",
//   },
//   {
//     year: "۱۴۰۳",
//     title: "امروز",
//     text: "برندی مورد اعتماد با شبکه‌ی نمایندگی در سراسر کشور.",
//   },
// ];

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
        <span className="text-[#F5BA2E]">{suffix}</span>
      </p>
      <p className="mt-2 font-persian text-sm text-white/70">{label}</p>
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
      { threshold: 0.35 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#F5F7FA]"
      dir="rtl"
    >
      {/* ══ HERO ══ */}
      <section className="relative overflow-hidden bg-[#003087] pt-[calc(var(--navbar-height)+3rem)] pb-24">
        {/* ambient glows */}
        <div
          className="pointer-events-none absolute -right-20 -top-10 h-96 w-96 rounded-full opacity-40"
          style={{
            background:
              "radial-gradient(circle, rgba(245,186,46,0.45) 0%, transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute -left-24 bottom-0 h-96 w-96 rounded-full opacity-30"
          style={{
            background:
              "radial-gradient(circle, rgba(0,156,222,0.6) 0%, transparent 70%)",
          }}
        />

        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 font-persian text-xs font-medium text-white ring-1 ring-white/15">
            <Sparkles size={14} className="text-[#F5BA2E]" />
            داستان سالیکو
          </span>
          <h1 className="mt-6 font-persian text-4xl font-bold leading-tight text-white md:text-6xl">
            آنجا که خواب بر بال‌های قو آرام می‌گیرد
          </h1>
          <p className="mx-auto mt-6 max-w-2xl font-persian text-base leading-loose text-white/80 md:text-lg">
            سالیکو با بیش از دو دهه تجربه در تولید تشک و محصولات خواب، ترکیبی از
            فناوری مدرن و کیفیت ممتاز و زیبایی را برای خوابی آرام و سالم به
            خانه‌ی شما می‌آورد. باور ما این است که یک خواب خوب، آغاز یک زندگی
            بهتر است.
          </p>
          <p className="mx-auto mt-4 max-w-2xl font-sans text-sm italic leading-relaxed text-white/50">
            Where Sleep Rests On Swan Wing
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
            <p className="font-sans text-sm uppercase tracking-[0.3em] text-[#687173]">
              Our Story
            </p>
            <h2 className="mt-2 font-persian text-3xl font-bold text-[#003087] md:text-4xl">
              رسالت ما، خوابِ راحتِ شماست
            </h2>
            <hr className="mt-4 w-20 border-t-2 border-[#003087]" />
            <p className="mt-6 font-persian text-base leading-loose text-[#687173]">
              از یک کارگاه کوچک آغاز کردیم، با این باور که هر انسان سزاوار یک
              خواب آرام و سالم است. امروز پس از سال‌ها تلاش، سالیکو به برندی
              مورد اعتماد بدل شده که هر تشک را نه یک کالا، بلکه بخشی از سلامت و
              آرامش خانواده‌ها می‌داند.
            </p>
            <p className="mt-4 font-persian text-base leading-loose text-[#687173]">
              تیم ما با وسواس، از انتخاب مواد اولیه تا کنترل کیفیت نهایی، در
              کنار شماست تا خیالتان از انتخابی درست آسوده باشد.
            </p>

            <Link
              to="/products/mattress"
              className="group mt-8 inline-flex items-center gap-2 rounded-lg bg-[#003087] px-6 py-3 font-persian text-sm font-bold text-white shadow-[0_1px_4px_rgba(0,48,135,0.06)] transition hover:bg-[#00246B]"
            >
              مشاهده محصولات
              <ArrowLeft
                size={17}
                className="transition-transform group-hover:-translate-x-1"
              />
            </Link>
          </div>

          {/* decorative image stack */}
          <div className="relative" dir="ltr">
            <div className="overflow-hidden rounded-xl shadow-[0_4px_16px_rgba(0,48,135,0.1)] ring-1 ring-[#CBD2D6]">
              <img
                src="/heroimage.png"
                alt="سالیکو"
                className="h-full w-full object-cover"
              />
            </div>
            <div
              className="absolute -bottom-6 -left-6 hidden items-center gap-3 rounded-xl bg-white p-4 shadow-[0_4px_16px_rgba(0,48,135,0.1)] ring-1 ring-[#CBD2D6] sm:flex"
              dir="rtl"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#003087] text-white">
                <Moon size={20} />
              </span>
              <div>
                <p className="font-persian text-sm font-bold text-[#1A1A2E]">
                  خواب سالم
                </p>
                <p className="font-persian text-xs text-[#687173]">
                  تعهد همیشگی ما
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ STATS (count-up) ══ */}
      <section
        ref={statsRef}
        className="relative overflow-hidden bg-[#003087] py-16"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,186,46,0.15),transparent_60%)]" />
        <div className="relative mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 sm:px-6 md:grid-cols-2">
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
            <p className="font-sans text-sm uppercase tracking-[0.3em] text-[#687173]">
              Our Values
            </p>
            <h2 className="mt-2 font-persian text-3xl font-bold text-[#003087] md:text-4xl">
              ارزش‌هایی که به آن پایبندیم
            </h2>
            <hr className="mx-auto mt-4 w-20 border-t-2 border-[#003087]" />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group rounded-xl bg-white p-6 text-center shadow-[0_1px_4px_rgba(0,48,135,0.06)] ring-1 ring-[#CBD2D6] transition hover:-translate-y-1 hover:shadow-[0_4px_16px_rgba(0,48,135,0.1)]"
                dir="rtl"
              >
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-[#003087] text-white shadow-inner transition group-hover:scale-110">
                  <Icon size={24} />
                </span>
                <h3 className="mt-5 font-persian text-lg font-bold text-[#1A1A2E]">
                  {title}
                </h3>
                <p className="mt-2 font-persian text-sm leading-relaxed text-[#687173]">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ GALLERY — simple, frameless, no cards ══ */}
      <section className="relative bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center" dir="rtl">
            <p className="font-sans text-sm uppercase tracking-[0.3em] text-[#687173]">
              Gallery
            </p>
            <h2 className="mt-2 font-persian text-3xl font-bold text-[#003087] md:text-4xl">
              گالری سالیکو
            </h2>
            <hr className="mx-auto mt-4 w-20 border-t-2 border-[#003087]" />
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
