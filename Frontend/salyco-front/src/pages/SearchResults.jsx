import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Search,
  BedDouble,
  BookOpen,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { search as searchApi } from "../api/search";
import { getProductImageUrl } from "../utils/productImage";
import { toPersianDigitsInText } from "../utils/persian";
import PageBackground from "../components/PageBackground";

const TYPE_ICON = {
  mattress: BedDouble,
  article: BookOpen,
};
const iconFor = (type) => TYPE_ICON[type] || Search;

const MIN_CHARS = 2;
// Larger per-provider cap for the full page than the navbar dropdown.
const PAGE_LIMIT = 24;

export default function SearchResults() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const query = (params.get("q") || "").trim();
  const activeType = params.get("type") || "";

  const [term, setTerm] = useState(query);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Keep the input in sync when navigating with a new ?q= (e.g. from navbar).
  useEffect(() => {
    setTerm(query);
  }, [query]);

  useEffect(() => {
    if (query.length < MIN_CHARS) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchApi(query, { limit: PAGE_LIMIT, type: activeType || undefined })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setData({ count: 0, groups: [] });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, activeType]);

  const submit = (e) => {
    e.preventDefault();
    const q = term.trim();
    if (q.length < MIN_CHARS) return;
    const next = { q };
    if (activeType) next.type = activeType;
    setParams(next);
  };

  const setTypeFilter = (type) => {
    const next = { q: query };
    if (type) next.type = type;
    setParams(next);
  };

  return (
    <section className="relative min-h-screen overflow-hidden bg-brand-warm-white pt-[var(--navbar-height)]">
      <PageBackground />

      <div className="relative mx-auto max-w-[1120px] px-6 py-10 sm:py-14">
        <header className="mb-12" dir="rtl">
          <p className="font-sans text-sm uppercase tracking-[0.3em] text-text-secondary">
            Search
          </p>
          <h1 className="mt-2 font-persian text-3xl font-bold text-brand-navy md:text-4xl">
            جست و جو
          </h1>
          <hr className="mt-4 w-24 border-t-2 border-brand-navy" />

          {/* Search input */}
          <form onSubmit={submit} className="mt-6 relative max-w-xl" dir="ltr">
            <Search
              size={18}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
            />
            <input
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="جست و جو در محصولات و مقالات ..."
              dir="rtl"
              className="w-full rounded-lg border border-brand-mist bg-white pl-4 pr-11 py-3 text-sm text-text-primary placeholder-text-secondary shadow-[0_1px_4px_rgba(5,46,95,0.06)] focus:border-2 focus:border-brand-navy focus:outline-none"
            />
          </form>
        </header>

        {/* Type filter chips */}
        {query.length >= MIN_CHARS && (
          <div dir="rtl" className="mb-6 flex flex-wrap items-center gap-2">
            <Chip active={!activeType} onClick={() => setTypeFilter("")}>
              همه
            </Chip>
            <Chip
              active={activeType === "mattress"}
              onClick={() => setTypeFilter("mattress")}
            >
              محصولات
            </Chip>
            <Chip
              active={activeType === "article"}
              onClick={() => setTypeFilter("article")}
            >
              مقالات
            </Chip>
          </div>
        )}

        {/* States */}
        {query.length < MIN_CHARS && (
          <p dir="rtl" className="font-persian text-text-secondary">
            برای جست و جو حداقل دو حرف وارد کنید.
          </p>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-brand-navy">
            <Loader2 size={20} className="animate-spin" />
            <span className="font-persian text-sm">در حال جست و جو ...</span>
          </div>
        )}

        {!loading && data && data.count === 0 && query.length >= MIN_CHARS && (
          <div dir="rtl" className="py-16 text-center">
            <p className="font-persian text-lg text-text-primary">
              نتیجه‌ای برای «{query}» یافت نشد.
            </p>
            <p className="mt-2 font-persian text-sm text-text-secondary">
              املای عبارت را بررسی کنید یا کلمهٔ دیگری را امتحان کنید.
            </p>
          </div>
        )}

        {!loading && data && data.count > 0 && (
          <div className="space-y-10">
            {data.groups.map((group) => {
              const Icon = iconFor(group.key);
              return (
                <div key={group.key}>
                  <div
                    dir="rtl"
                    className="mb-4 flex items-center gap-2 text-text-primary"
                  >
                    <Icon size={18} className="text-brand-navy" />
                    <h2 className="font-persian text-lg font-bold">
                      {group.label}
                    </h2>
                    <span className="rounded-full bg-brand-warm-white border border-brand-mist px-2.5 py-0.5 text-xs text-text-secondary">
                      {group.results.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {group.results.map((result) => (
                      <ResultCard
                        key={`${result.type}-${result.id}`}
                        result={result}
                        Icon={Icon}
                        onClick={() => navigate(result.url)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-brand-navy text-white"
          : "bg-white border border-brand-mist text-text-secondary hover:bg-brand-warm-white"
      }`}
    >
      {children}
    </button>
  );
}

function ResultCard({ result, Icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      dir="rtl"
      className="group flex items-center gap-4 rounded-xl border border-brand-mist bg-white p-3 text-right shadow-[0_1px_4px_rgba(5,46,95,0.06)] transition-all  hover:shadow-[0_4px_16px_rgba(5,46,95,0.1)]"
    >
      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-brand-warm-white">
        {result.image ? (
          <img
            src={getProductImageUrl(result.image)}
            alt=""
            className={`h-full w-full ${
              // §7: a mattress must read whole, so it is letterboxed; an
              // article's photo is a scene and fills its frame.
              result.type === "mattress" ? "object-contain" : "object-cover"
            }`}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-text-secondary">
            <Icon size={22} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-persian font-semibold text-text-primary">
          {result.title}
        </p>
        {result.subtitle && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-text-secondary">
            {toPersianDigitsInText(result.subtitle)}
          </p>
        )}
      </div>

      <ChevronLeft
        size={18}
        className="flex-shrink-0 text-text-secondary transition-transform group-hover:-translate-x-0.5 group-hover:text-brand-navy"
      />
    </button>
  );
}
