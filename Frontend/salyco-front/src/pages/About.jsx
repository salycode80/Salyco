import { useEffect, useState } from "react";
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
import api from "../api";
import { getProductImageUrl } from "../utils/productImage";

// ─── Data ─────────────────────────────────────────────────────────────────────
const VALUES = [
  {
    icon: Award,
    title: "کیفیت ممتاز",
    desc: "دقت در انتخاب مواد اولیه، دوخت و جزئیات ساخت هر تشک.",
  },
  {
    icon: Leaf,
    title: "شناخت مواد",
    desc: "آشنایی با جنس پارچه و لایه‌های هر مدل برای انتخابی آگاهانه.",
  },
  {
    icon: HeartHandshake,
    title: "مشتری‌مداری",
    desc: "پشتیبانی صادقانه و همراهی با شما از لحظه‌ی انتخاب تا سال‌ها بعد.",
  },
  {
    icon: ShieldCheck,
    title: "گارانتی معتبر",
    desc: "مدت و شرایط ضمانت هر مدل را در مشخصات محصول و سامانهٔ خدمات بررسی کنید.",
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

// Simple, frameless gallery — just images, and now served by the API so the
// admin panel can add one without a deploy. See pages/admin/GalleryPanel.jsx.

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function About() {
  // Managed from the admin gallery panel. Empty until images are added, which
  // is also what hides the section.
  const [gallery, setGallery] = useState([]);

  useEffect(() => {
    let alive = true;
    api
      .get("/api/gallery/")
      .then((res) => {
        if (alive) setGallery(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        // A gallery that fails to load is an absent gallery; the rest of the
        // page is the story, and it must still render.
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-brand-warm-white"
      dir="rtl"
    >
      {/* ══ HERO ══ */}
      <section className="relative overflow-hidden bg-brand-navy pt-[calc(var(--navbar-height)+3rem)] pb-24">
        {/* ambient glows */}
        <div
          className="pointer-events-none absolute -right-20 -top-10 h-96 w-96 rounded-full opacity-40"
          style={{
            background:
              "radial-gradient(circle, rgba(228,229,226,0.45) 0%, transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute -left-24 bottom-0 h-96 w-96 rounded-full opacity-30"
          style={{
            background:
              "radial-gradient(circle, rgba(5,46,95,0.6) 0%, transparent 70%)",
          }}
        />

        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 font-persian text-xs font-medium text-white ring-1 ring-white/15">
            <Sparkles size={14} className="text-white" />
            داستان سالیکو
          </span>
          <h1 className="mt-6 font-persian text-4xl font-bold leading-tight text-white md:text-4xl">
            دو دهه تجربه در ساخت تشک و محصولات خواب
          </h1>
          <p className="mx-auto mt-6 max-w-2xl font-persian text-base leading-loose text-white/80 md:text-lg">
            سالیکو از یک کارگاه کوچک در نیشابور آغاز شد و امروز با تکیه بر این
            تجربه، ترکیبی از فناوری مدرن و کیفیت ممتاز و زیبایی را برای خوابی
            آرام و سالم به خانه‌ی شما می‌آورد. باور ما این است که یک خواب خوب،
            آغاز یک زندگی بهتر است.
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
        <div className="relative mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
          <div dir="rtl">
            <p className="font-sans text-sm uppercase tracking-[0.3em] text-text-secondary">
              Our Story
            </p>
            <h2 className="mt-2 font-persian text-3xl font-bold text-brand-navy md:text-4xl">
              رسالت ما، خوابِ راحتِ شماست
            </h2>
            <hr className="mt-4 w-20 border-t-2 border-brand-navy" />
            <p className="mt-6 font-persian text-base leading-loose text-text-secondary">
              از یک کارگاه کوچک آغاز کردیم، با این باور که هر انسان سزاوار یک
              خواب آرام و سالم است. امروز پس از سال‌ها تلاش، سالیکو به برندی
              مورد اعتماد بدل شده که هر تشک را نه یک کالا، بلکه بخشی از سلامت و
              آرامش خانواده‌ها می‌داند.
            </p>
            <p className="mt-4 font-persian text-base leading-loose text-text-secondary">
              تیم ما با وسواس، از انتخاب مواد اولیه تا کنترل کیفیت نهایی، در
              کنار شماست تا خیالتان از انتخابی درست آسوده باشد.
            </p>

            <Link
              to="/products"
              className="group mt-8 inline-flex items-center gap-2 rounded-lg bg-brand-navy px-6 py-3 font-persian text-sm font-bold text-white shadow-[0_1px_4px_rgba(5,46,95,0.06)] transition hover:bg-action-hover"
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
            <div className="overflow-hidden rounded-xl shadow-[0_4px_16px_rgba(5,46,95,0.1)] ring-1 ring-brand-mist">
              <img
                src="/prestige-main.png"
                alt="سالیکو"
                className="h-full w-full object-cover"
              />
            </div>
            <div
              className="absolute -bottom-6 -left-6 hidden items-center gap-3 rounded-xl bg-white p-4 shadow-[0_4px_16px_rgba(5,46,95,0.1)] ring-1 ring-brand-mist sm:flex"
              dir="rtl"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-navy text-white">
                <Moon size={20} />
              </span>
              <div>
                <p className="font-persian text-sm font-bold text-text-primary">
                  خواب سالم
                </p>
                <p className="font-persian text-xs text-text-secondary">
                  تعهد همیشگی ما
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ VALUES ══ */}
      <section className="relative bg-white py-20">
        <PageBackground />
        <div className="relative mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center" dir="rtl">
            <p className="font-sans text-sm uppercase tracking-[0.3em] text-text-secondary">
              Our Values
            </p>
            <h2 className="mt-2 font-persian text-3xl font-bold text-brand-navy md:text-4xl">
              ارزش‌هایی که به آن پایبندیم
            </h2>
            <hr className="mx-auto mt-4 w-20 border-t-2 border-brand-navy" />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group rounded-xl bg-white p-6 text-center shadow-[0_1px_4px_rgba(5,46,95,0.06)] ring-1 ring-brand-mist transition  hover:shadow-[0_4px_16px_rgba(5,46,95,0.1)]"
                dir="rtl"
              >
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-brand-navy text-white shadow-inner transition group-hover:scale-110">
                  <Icon size={24} />
                </span>
                <h3 className="mt-5 font-persian text-lg font-bold text-text-primary">
                  {title}
                </h3>
                <p className="mt-2 font-persian text-sm leading-relaxed text-text-secondary">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ GALLERY — simple, frameless, no cards ══ */}
      {/* Nothing to show until an admin adds images, so the whole section —
          heading included — is absent rather than an empty framed box. */}
      {gallery.length > 0 && (
        <section className="relative bg-white py-20">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
            <div className="mb-10 text-center" dir="rtl">
              <p className="font-sans text-sm uppercase tracking-[0.3em] text-text-secondary">
                Gallery
              </p>
              <h2 className="mt-2 font-persian text-3xl font-bold text-brand-navy md:text-4xl">
                گالری سالیکو
              </h2>
              <hr className="mx-auto mt-4 w-20 border-t-2 border-brand-navy" />
            </div>

            {/* masonry-style columns; plain images, no frame or card */}
            <div className="columns-2 gap-4 md:columns-3 [&>img]:mb-4">
              {gallery.map((item) => (
                <img
                  key={item.id}
                  src={getProductImageUrl(item.image_url)}
                  alt={item.title}
                  loading="lazy"
                  className="w-full rounded-lg object-cover transition duration-200 hover:opacity-90"
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
