import { useEffect, useState } from "react";
import api from "../api";
import PageBackground from "../components/PageBackground";

// ─── Utility ────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function truncate(text, max = 100) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "…" : text;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/**
 * HeroCard  – large featured card (used on the right column of the hero)
 */
function HeroCard({ article }) {
  if (!article) return null;
  return (
    <a
      href={`/articles/${article.slug}`}
      className="group relative flex h-full min-h-[340px] flex-col justify-end overflow-hidden rounded-xl"
    >
      {/* background image */}
      {article.image ? (
        <img
          src={article.image}
          alt={article.title}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#003087] to-[#00246B]" />
      )}

      {/* dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* logo badge */}
      <span className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#003087]/80 text-white">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M10 2a8 8 0 100 16A8 8 0 0010 2z" />
        </svg>
      </span>

      {/* content */}
      <div className="relative z-10 p-5" dir="rtl">
        <h2 className="font-persian text-lg font-bold leading-snug text-white drop-shadow">
          {article.title}
        </h2>
        <p className="mt-1 font-persian text-sm text-white/70 line-clamp-2">
          {article.excerpt || article.summary}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#009CDE] px-3 py-1 text-xs font-medium text-white">
            مطالعه بیشتر
          </span>
          <span className="text-xs text-white/50">
            {formatDate(article.published_at || article.created_at)}
          </span>
        </div>
      </div>
    </a>
  );
}

/**
 * SmallHeroCard – compact card for the left column of the hero
 */
function SmallHeroCard({ article }) {
  if (!article) return null;
  return (
    <a
      href={`/articles/${article.slug}`}
      className="group relative flex flex-row overflow-hidden rounded-xl bg-[#003087] transition hover:brightness-110"
    >
      {/* thumbnail */}
      <div className="relative h-full w-32 shrink-0 overflow-hidden">
        {article.image ? (
          <img
            src={article.image}
            alt={article.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#00246B] to-[#003087]" />
        )}
        <div className="absolute inset-0 bg-black/30" />
        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#003087]/80 text-white">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
            <path d="M10 2a8 8 0 100 16A8 8 0 0010 2z" />
          </svg>
        </span>
      </div>

      {/* text */}
      <div className="flex flex-1 flex-col justify-between p-3" dir="rtl">
        <p className="font-persian text-sm font-bold leading-snug text-white line-clamp-2">
          {article.title}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs font-medium text-[#009CDE]">
            مطالعه بیشتر
          </span>
          <span className="text-xs text-white/40">
            {formatDate(article.published_at || article.created_at)}
          </span>
        </div>
      </div>
    </a>
  );
}

/**
 * ArticleCard – standard grid card for the "latest articles" section
 */
function ArticleCard({ article }) {
  return (
    <a
      href={`/articles/${article.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl bg-white shadow-[0_1px_4px_rgba(0,48,135,0.06)] ring-1 ring-[#CBD2D6] transition hover:shadow-[0_4px_16px_rgba(0,48,135,0.1)] hover:-translate-y-0.5"
    >
      {/* thumbnail */}
      <div className="relative h-48 overflow-hidden bg-[#F5F7FA]">
        {article.image ? (
          <img
            src={article.image}
            alt={article.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#F5F7FA]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#687173"
              strokeWidth="1.5"
              className="h-12 w-12 opacity-50"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18a.75.75 0 00.75-.75V6a.75.75 0 00-.75-.75H3a.75.75 0 00-.75.75v13.5c0 .414.336.75.75.75z"
              />
            </svg>
          </div>
        )}

        {/* logo badge */}
        <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#003087]/80 text-white">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M10 2a8 8 0 100 16A8 8 0 0010 2z" />
          </svg>
        </span>

        {article.category && (
          <span className="absolute left-3 top-3 rounded-full bg-[#009CDE] px-2.5 py-0.5 text-xs text-white">
            {article.category}
          </span>
        )}
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col p-4" dir="rtl">
        <h3 className="font-persian text-sm font-bold leading-snug text-[#1A1A2E] line-clamp-2 group-hover:text-[#009CDE] transition-colors">
          {article.title}
        </h3>
        <p className="mt-2 font-persian text-xs leading-relaxed text-[#687173] line-clamp-3">
          {article.excerpt || article.summary}
        </p>
        <div className="mt-auto pt-4 flex items-center justify-between border-t border-[#CBD2D6]">
          <span className="text-xs font-medium text-[#009CDE]">
            مطالعه بیشتر
          </span>
          <span className="text-xs text-[#687173]">
            {formatDate(article.published_at || article.created_at)}
          </span>
        </div>
      </div>
    </a>
  );
}

/**
 * FeaturedSidebarItem – compact row used in the "مقالات برگزیده" sidebar
 */
function FeaturedSidebarItem({ article, index }) {
  const colors = ["bg-[#009CDE]", "bg-[#003087]", "bg-[#00246B]"];
  return (
    <a
      href={`/articles/${article.slug}`}
      className="group flex items-start gap-3 rounded-xl p-3 transition hover:bg-[#F5F7FA]"
      dir="rtl"
    >
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${colors[index % colors.length]} text-xs font-bold text-white`}
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-persian text-sm font-bold leading-snug text-[#1A1A2E] line-clamp-2 group-hover:text-[#009CDE] transition-colors">
          {article.title}
        </p>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-[#009CDE]">
            مطالعه بیشتر
          </span>
          <span className="text-xs text-[#687173]">
            {formatDate(article.published_at || article.created_at)}
          </span>
        </div>
      </div>
    </a>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function Skeleton({ className }) {
  return (
    <div className={`animate-pulse rounded-lg bg-[#CBD2D6] ${className}`} />
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ArticlesPage() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState("همه");

  useEffect(() => {
    api
      .get("/api/articles/")
      .then((res) => setArticles(res.data))
      .catch(() => setError("بارگذاری مقالات با خطا مواجه شد."))
      .finally(() => setLoading(false));
  }, []);

  // Derive slices
  const heroMain = articles[0] || null;
  const heroSmall = articles.slice(1, 3);
  const latestArticles = articles.slice(3, 9);
  const featuredSidebar = articles.slice(0, 4);

  // Unique categories from data
  const categories = [
    "همه",
    ...Array.from(new Set(articles.map((a) => a.category).filter(Boolean))),
  ];

  const filteredLatest =
    activeCategory === "همه"
      ? latestArticles
      : latestArticles.filter((a) => a.category === activeCategory);

  return (
    <section
      className="relative min-h-screen overflow-hidden bg-[#F5F7FA] pt-[var(--navbar-height)] "
      dir="rtl"
    >
      <PageBackground />
      {/* subtle grid */}
      {/* <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(100,160,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(100,160,255,0.05) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      /> */}

      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* ── Page header ── */}
        <header className="mb-12" dir="rtl">
          <p className="font-sans text-sm uppercase tracking-[0.3em] text-[#687173]">
            Blog & Articles
          </p>
          <h1 className="mt-2 font-persian text-3xl font-bold text-[#003087] md:text-4xl">
            وبلاگ و مقالات
          </h1>
          <hr className="mt-4 w-24 border-t-2 border-[#003087]" />
          {/* <p className="mt-4 max-w-xl font-sans text-base text-[#000c3e]/60">
            مجموعه محصولات ما را کاوش کنید
          </p> */}
        </header>

        {/* ── Category filter bar ── */}
        {!loading && categories.length > 1 && (
          <div className="mb-8 flex flex-wrap items-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full px-4 py-1.5 font-persian text-sm font-medium transition ${
                  activeCategory === cat
                    ? "bg-[#003087] text-white shadow"
                    : "bg-white text-[#687173] ring-1 ring-[#CBD2D6] hover:bg-[#F5F7FA] hover:text-[#003087]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="mb-8 rounded-xl bg-[#FDE7E7] p-4 text-center font-persian text-[#D20000]">
            {error}
          </div>
        )}

        {/* ── Loading skeletons ── */}
        {loading && (
          <>
            {/* hero skeleton */}
            <div className="mb-12 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
              <div className="flex flex-col gap-4">
                <Skeleton className="h-40" />
                <Skeleton className="h-40" />
              </div>
              <Skeleton className="min-h-[340px]" />
            </div>
            {/* cards skeleton */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-xl bg-white shadow-[0_1px_4px_rgba(0,48,135,0.06)] ring-1 ring-[#CBD2D6]"
                >
                  <Skeleton className="h-48 rounded-none" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && !error && (
          <>
            {/* ── Hero section ── */}
            {articles.length > 0 && (
              <div className="mb-12 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
                {/* left: two small cards */}
                <div className="flex flex-col gap-4">
                  {heroSmall.map((a) => (
                    <SmallHeroCard key={a.slug} article={a} />
                  ))}
                  {heroSmall.length === 0 && (
                    <div className="rounded-xl bg-[#F5F7FA] h-full min-h-[160px]" />
                  )}
                </div>
                {/* right: big card */}
                <HeroCard article={heroMain} />
              </div>
            )}

            {/* ── Divider ── */}
            <div className="mb-8 flex items-center gap-4">
              <h2 className="font-persian text-xl font-bold text-[#003087] whitespace-nowrap">
                آخرین مقالات
              </h2>
              <div className="h-px flex-1 bg-[#CBD2D6]" />
            </div>

            {/* ── Articles grid + sidebar ── */}
            {articles.length === 0 ? (
              <p className="font-persian text-center text-[#687173]">
                مقاله‌ای یافت نشد.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
                {/* main grid */}
                <div>
                  {filteredLatest.length === 0 ? (
                    <p className="font-persian text-[#687173]">
                      مقاله‌ای در این دسته‌بندی یافت نشد.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                      {filteredLatest.map((article) => (
                        <ArticleCard key={article.slug} article={article} />
                      ))}
                    </div>
                  )}

                  {/* load-more / see all */}
                  {articles.length > 9 && (
                    <div className="mt-8 flex justify-center">
                      <a
                        href="/articles/archive"
                        className="rounded-lg border-2 border-[#003087] px-6 py-2 font-persian text-sm font-medium text-[#003087] transition hover:bg-[#003087] hover:text-white"
                      >
                        مشاهده همه مقالات
                      </a>
                    </div>
                  )}
                </div>

                {/* sidebar */}
                <aside>
                  <div className="sticky top-24 rounded-xl bg-white p-5 shadow-[0_1px_4px_rgba(0,48,135,0.06)] ring-1 ring-[#CBD2D6]">
                    <h3 className="font-persian mb-4 text-base font-bold text-[#003087]">
                      مقالات برگزیده
                    </h3>
                    <div className="flex flex-col gap-1">
                      {featuredSidebar.map((article, i) => (
                        <FeaturedSidebarItem
                          key={article.slug}
                          article={article}
                          index={i}
                        />
                      ))}
                    </div>
                  </div>
                </aside>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
