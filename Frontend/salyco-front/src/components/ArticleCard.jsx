import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { formatArticleDate, getArticleImageUrl } from "../utils/articleImage";

export default function ArticleCard({ article }) {
  const [imageSrc, setImageSrc] = useState(getArticleImageUrl(article.image));

  return (
    <Link
      to={`/articles/${article.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-blue-400/15 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/30 hover:shadow-lg hover:shadow-blue-900/10"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-[#000c2e]">
        <img
          src={imageSrc}
          alt={article.title}
          onError={() => setImageSrc("/matress.png")}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#000c2e]/70 via-transparent to-transparent" />
      </div>

      <div className="flex flex-1 flex-col p-5" dir="rtl">
        <div className="flex items-center gap-1.5 text-xs text-[#000c3e]/50">
          <CalendarDays size={14} className="text-blue-400/70" />
          <time dateTime={article.created_at}>
            {formatArticleDate(article.created_at)}
          </time>
        </div>

        <h3 className="mt-2 font-persian text-xl font-bold leading-snug text-[#000c3e] transition-colors group-hover:text-[#001a5c]">
          {article.title}
        </h3>

        <p className="mt-2 line-clamp-3 flex-1 font-persian text-sm leading-relaxed text-[#000c3e]/70">
          {article.excerpt}
        </p>

        <span className="mt-4 inline-flex items-center gap-1.5 font-sans text-xs font-medium uppercase tracking-widest text-[#001a5c] transition-colors group-hover:text-blue-500">
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
