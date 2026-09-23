import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { formatArticleDate, getArticleImageUrl } from "../utils/articleImage";

export default function ArticleCard({ article }) {
  const [imageSrc, setImageSrc] = useState(getArticleImageUrl(article.image));

  return (
    <Link
      to={`/articles/${article.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-brand-mist bg-white shadow-[0_1px_4px_rgba(5,46,95,0.06)] transition-all duration-200  hover:shadow-[0_4px_16px_rgba(5,46,95,0.1)]"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-brand-navy">
        <img
          src={imageSrc}
          alt={article.title}
          onError={() => setImageSrc("/matress.png")}
          className="h-full w-full object-cover transition-transform duration-500 group-"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/70 via-transparent to-transparent" />
      </div>

      <div className="flex flex-1 flex-col p-5" dir="rtl">
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          <CalendarDays size={14} className="text-text-secondary" />
          <time dateTime={article.created_at}>
            {formatArticleDate(article.created_at)}
          </time>
        </div>

        <h3 className="mt-2 font-persian text-xl font-bold leading-snug text-brand-navy transition-colors group-hover:text-action-hover">
          {article.title}
        </h3>

        <p className="mt-2 line-clamp-3 flex-1 font-persian text-sm leading-relaxed text-text-primary">
          {article.excerpt}
        </p>

        {/* Persian, so §3 keeps it in Vazirmatn at zero letter-spacing. */}
        <span className="mt-4 inline-flex items-center gap-1.5 font-persian text-xs font-medium text-brand-navy transition-colors group-hover:text-brand-navy">
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
