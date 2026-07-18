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
    <section className="relative min-h-screen overflow-hidden bg-[#F5F7FA] pt-[var(--navbar-height)]">
      <PageBackground />

      <div className="relative mx-auto max-w-4xl px-6 py-10 sm:py-16">
        <Link
          to="/articles"
          className="mb-8 inline-flex items-center gap-2 font-persian text-sm font-medium text-[#003087] transition-colors hover:text-[#009CDE]"
          dir="rtl"
        >
          <ArrowRight size={16} />
          بازگشت به مقالات
        </Link>

        {loading && (
          <p className="font-persian text-center text-[#687173]">
            در حال بارگذاری...
          </p>
        )}

        {error && (
          <p className="font-persian text-center text-[#D20000]">{error}</p>
        )}

        {!loading && article && (
          <article className="overflow-hidden rounded-xl border border-[#CBD2D6] bg-white shadow-[0_1px_4px_rgba(0,48,135,0.06)]">
            <div className="relative aspect-[21/9] overflow-hidden bg-[#003087]">
              <img
                src={imageSrc}
                alt={article.title}
                onError={() => setImageSrc("/matress.png")}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#003087]/60 via-transparent to-transparent" />
            </div>

            <div className="p-8 md:p-10" dir="rtl">
              <div className="flex items-center gap-1.5 text-sm text-[#687173]">
                <CalendarDays size={16} className="text-[#687173]" />
                <time dateTime={article.created_at}>
                  {formatArticleDate(article.created_at)}
                </time>
              </div>

              <h1 className="mt-4 font-persian text-3xl font-bold leading-tight text-[#1A1A2E] md:text-4xl">
                {article.title}
              </h1>

              {article.excerpt && (
                <p className="mt-4 font-persian text-lg leading-relaxed text-[#687173]">
                  {article.excerpt}
                </p>
              )}

              <div className="prose prose-slate mt-8 max-w-none">
                <div className="whitespace-pre-wrap font-persian text-base leading-8 text-[#1A1A2E]">
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
