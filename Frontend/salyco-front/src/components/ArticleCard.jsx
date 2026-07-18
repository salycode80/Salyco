import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { formatArticleDate, getArticleImageUrl } from "../utils/articleImage";

export default function ArticleCard({ article }) {
  const [imageSrc, setImageSrc] = useState(getArticleImageUrl(article.image));

  return (
    <Link
      to={`/articles/${article.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-[#CBD2D6] bg-white shadow-[0_1px_4px_rgba(0,48,135,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_4px_16px_rgba(0,48,135,0.1)]"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-[#003087]">
        <img
          src={imageSrc}
          alt={article.title}
          onError={() => setImageSrc("/matress.png")}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#003087]/70 via-transparent to-transparent" />
      </div>

      <div className="flex flex-1 flex-col p-5" dir="rtl">
        <div className="flex items-center gap-1.5 text-xs text-[#687173]">
          <CalendarDays size={14} className="text-[#687173]" />
          <time dateTime={article.created_at}>
            {formatArticleDate(article.created_at)}
          </time>
        </div>

        <h3 className="mt-2 font-persian text-xl font-bold leading-snug text-[#003087] transition-colors group-hover:text-[#00246B]">
          {article.title}
        </h3>

        <p className="mt-2 line-clamp-3 flex-1 font-persian text-sm leading-relaxed text-[#1A1A2E]">
          {article.excerpt}
        </p>

        <span className="mt-4 inline-flex items-center gap-1.5 font-sans text-xs font-medium uppercase tracking-widest text-[#003087] transition-colors group-hover:text-[#009CDE]">
          مطالعه مقاله
          <ArrowLeft
            size={14}
            className="transition-transform group-hover:-translate-x-1"
          />
        </span>
      </div>
    </Link>
  );
}
