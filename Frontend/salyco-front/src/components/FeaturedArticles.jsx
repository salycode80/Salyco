import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarDays } from "lucide-react";
import api from "../api";
import { getArticleImageUrl, formatArticleDate } from "../utils/articleImage";

/**
 * FeaturedArticles — a compact, editorial preview of the blog on the home page.
 * Deliberately different from both the products grid and the full Articles page:
 * one large featured story on the right, a slim numbered "latest" list on the
 * left. Sits on a soft wheat band so it reads as its own chapter of the page.
 */
export default function FeaturedArticles() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get("/api/articles/")
      .then((res) => setArticles(res.data.slice(0, 4)))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (!loading && (error || articles.length === 0)) return null;

  const featured = articles[0];
  const rest = articles.slice(1, 4);

  return (
    <section className="relative overflow-hidden bg-wheat-50" dir="rtl">
      {/* faint navy tie-in so the brand color still whispers through */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at bottom right, rgba(0,26,92,0.05) 0%, transparent 60%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <header className="mb-12">
          <p className="font-sans text-sm uppercase tracking-[0.3em] text-wood-500/80">
            Journal
          </p>
          <h2 className="mt-2 font-persian text-3xl font-bold text-[#000c3e] md:text-4xl">
            از وبلاگ سالیکو
          </h2>
          <hr className="mt-4 w-24 border-t-2 border-wood-400" />
          <p className="mt-4 max-w-xl font-persian text-base text-[#000c3e]/60">
            نکته‌ها و راهنماهایی برای خوابی بهتر و انتخابی هوشمندانه.
          </p>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.4fr]">
            <div className="flex flex-col gap-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-2xl bg-[#e2e8f0]"
                />
              ))}
            </div>
            <div className="min-h-[360px] animate-pulse rounded-3xl bg-[#e2e8f0]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.4fr]">
            {/* ── Numbered latest list ── */}
            <ol className="flex flex-col gap-3">
              {rest.map((article, i) => (
                <li key={article.slug}>
                  <Link
                    to={`/articles/${article.slug}`}
                    className="group flex items-start gap-4 rounded-2xl bg-white/70 p-4 ring-1 ring-[#000c3e]/5 transition hover:bg-white hover:ring-[#000c3e]/15"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#000c2e] to-[#00256b] font-persian text-sm font-bold text-blue-100">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-persian text-sm font-bold leading-snug text-[#000c3e] line-clamp-2 transition-colors group-hover:text-[#2563eb]">
                        {article.title}
                      </h3>
                      <span className="mt-1.5 flex items-center gap-1.5 font-persian text-xs text-[#000c3e]/45">
                        <CalendarDays size={12} />
                        {formatArticleDate(
                          article.published_at || article.created_at,
                        )}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}

              <Link
                to="/articles"
                className="mt-1 inline-flex items-center gap-2 self-start rounded-full border border-[#000c3e]/20 px-5 py-2.5 font-persian text-sm font-semibold text-[#000c3e] transition-colors hover:border-[#000c3e]/40 hover:bg-[#000c3e]/5"
              >
                همه مقالات
                <ArrowLeft size={16} />
              </Link>
            </ol>

            {/* ── Featured story ── */}
            {featured && (
              <Link
                to={`/articles/${featured.slug}`}
                className="group relative flex min-h-[360px] flex-col justify-end overflow-hidden rounded-3xl shadow-[0_12px_40px_-12px_rgba(10,31,77,0.25)]"
              >
                {featured.image ? (
                  <img
                    src={getArticleImageUrl(featured.image)}
                    alt={featured.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#000c3e] to-[#1a3a8f]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                <div className="relative z-10 p-6 sm:p-8">
                  {featured.category && (
                    <span className="mb-3 inline-block rounded-full bg-[#2563eb] px-3 py-1 font-persian text-xs font-medium text-white">
                      {featured.category}
                    </span>
                  )}
                  <h3 className="font-persian text-xl font-bold leading-snug text-white drop-shadow sm:text-2xl">
                    {featured.title}
                  </h3>
                  <p className="mt-2 max-w-xl font-persian text-sm leading-relaxed text-white/75 line-clamp-2">
                    {featured.excerpt || featured.summary}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 font-persian text-sm font-medium text-blue-200 transition-colors group-hover:text-white">
                    مطالعه بیشتر
                    <ArrowLeft size={16} />
                  </span>
                </div>
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
