import { useEffect, useState } from "react";
import api from "../api";
import ArticleCard from "../components/ArticleCard";

export default function Articles() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get("/api/articles/")
      .then((res) => setArticles(res.data))
      .catch(() => setError("بارگذاری مقالات با خطا مواجه شد."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#F5F7FA] pt-[72px]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(100,160,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(100,160,255,0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div
        className="pointer-events-none absolute top-0 right-0 h-96 w-1/2"
        style={{
          background:
            "linear-gradient(to left, rgba(0,50,180,0.12) 0%, transparent 100%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 py-16">
        <header className="mb-12" dir="rtl">
          <p className="font-sans text-sm uppercase tracking-[0.3em] text-blue-400/80">
            Articles
          </p>
          <h1 className="mt-2 font-persian text-4xl font-bold text-[#000c3e] md:text-5xl">
            مقالات
          </h1>
          <hr className="mt-4 w-24 border-t-2 border-[#000c3e]" />
          <p className="mt-4 max-w-xl font-sans text-base text-[#000c3e]/60">
            آخرین مطالب و راهنماهای خواب سالم
          </p>
        </header>

        {loading && (
          <p className="font-persian text-center text-[#000c3e]/60">
            در حال بارگذاری...
          </p>
        )}

        {error && (
          <p className="font-persian text-center text-red-600/80">{error}</p>
        )}

        {!loading && !error && articles.length === 0 && (
          <p className="font-persian text-center text-[#000c3e]/60">
            مقاله‌ای یافت نشد.
          </p>
        )}

        {!loading && articles.length > 0 && (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
