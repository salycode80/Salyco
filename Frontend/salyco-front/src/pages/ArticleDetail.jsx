import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, CalendarDays } from "lucide-react";
import api from "../api";
import { formatArticleDate, getArticleImageUrl } from "../utils/articleImage";
import PageBackground from "../components/PageBackground";

export default function ArticleDetail() {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageSrc, setImageSrc] = useState("/matress.png");

  useEffect(() => {
    setLoading(true);
    setError(null);

    api
      .get(`/api/articles/${slug}/`)
      .then((res) => {
        setArticle(res.data);
        setImageSrc(getArticleImageUrl(res.data.image));
      })
      .catch(() => setError("بارگذاری مقاله با خطا مواجه شد."))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <section className="relative min-h-screen overflow-hidden bg-white pt-[var(--navbar-height)]">
      <PageBackground />

      <div className="relative mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
        <Link
          to="/articles"
          className="mb-8 inline-flex items-center gap-2 font-persian text-sm text-[#001a5c] transition-colors hover:text-blue-500"
          dir="rtl"
        >
          <ArrowRight size={16} />
          بازگشت به مقالات
        </Link>

        {loading && (
          <p className="font-persian text-center text-[#000c3e]/60">
            در حال بارگذاری...
          </p>
        )}

        {error && (
          <p className="font-persian text-center text-red-600/80">{error}</p>
        )}

        {!loading && article && (
          <article className="overflow-hidden rounded-2xl border border-blue-400/15 bg-white shadow-sm">
            <div className="relative aspect-[21/9] overflow-hidden bg-[#000c2e]">
              <img
                src={imageSrc}
                alt={article.title}
                onError={() => setImageSrc("/matress.png")}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#000c2e]/60 via-transparent to-transparent" />
            </div>

            <div className="p-8 md:p-10" dir="rtl">
              <div className="flex items-center gap-1.5 text-sm text-[#000c3e]/50">
                <CalendarDays size={16} className="text-blue-400/70" />
                <time dateTime={article.created_at}>
                  {formatArticleDate(article.created_at)}
                </time>
              </div>

              <h1 className="mt-4 font-persian text-3xl font-bold leading-tight text-[#000c3e] md:text-4xl">
                {article.title}
              </h1>

              {article.excerpt && (
                <p className="mt-4 font-persian text-lg leading-relaxed text-[#000c3e]/70">
                  {article.excerpt}
                </p>
              )}

              <div className="prose prose-slate mt-8 max-w-none">
                <div className="whitespace-pre-wrap font-persian text-base leading-8 text-[#000c3e]/80">
                  {article.content}
                </div>
              </div>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
