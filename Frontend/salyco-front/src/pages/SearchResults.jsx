import { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import {
  Search,
  BedDouble,
  BookOpen,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { search as searchApi } from "../api/search";
import { getProductImageUrl } from "../utils/productImage";
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
    <section className="relative min-h-screen overflow-hidden bg-[#F5F7FA] pt-[var(--navbar-height)]">
      <PageBackground />

      <div className="relative mx-auto max-w-[1120px] px-6 py-10 sm:py-14">
        <header className="mb-12" dir="rtl">
          <p className="font-sans text-sm uppercase tracking-[0.3em] text-[#687173]">
            Search
          </p>
          <h1 className="mt-2 font-persian text-3xl font-bold text-[#003087] md:text-4xl">
            جست و جو
          </h1>
          <hr className="mt-4 w-24 border-t-2 border-[#003087]" />

          {/* Search input */}
          <form onSubmit={submit} className="mt-6 relative max-w-xl" dir="ltr">
            <Search
              size={18}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#687173] pointer-events-none"
            />
            <input
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="جست و جو در محصولات و مقالات ..."
              dir="rtl"
              className="w-full rounded-lg border border-[#CBD2D6] bg-white pl-4 pr-11 py-3 text-sm text-[#1A1A2E] placeholder-[#687173] shadow-[0_1px_4px_rgba(0,48,135,0.06)] focus:border-2 focus:border-[#003087] focus:outline-none"
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
          <p dir="rtl" className="font-persian text-[#687173]">
            برای جست و جو حداقل دو حرف وارد کنید.
          </p>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-[#003087]">
            <Loader2 size={20} className="animate-spin" />
            <span className="font-persian text-sm">در حال جست و جو ...</span>
          </div>
        )}

        {!loading && data && data.count === 0 && query.length >= MIN_CHARS && (
          <div dir="rtl" className="py-16 text-center">
            <p className="font-persian text-lg text-[#1A1A2E]">
              نتیجه‌ای برای «{query}» یافت نشد.
            </p>
            <p className="mt-2 font-persian text-sm text-[#687173]">
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
                    className="mb-4 flex items-center gap-2 text-[#1A1A2E]"
                  >
                    <Icon size={18} className="text-[#003087]" />
                    <h2 className="font-persian text-lg font-bold">
                      {group.label}
                    </h2>
                    <span className="rounded-full bg-[#F5F7FA] border border-[#CBD2D6] px-2.5 py-0.5 text-xs text-[#687173]">
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
          ? "bg-[#003087] text-white"
          : "bg-white border border-[#CBD2D6] text-[#687173] hover:bg-[#F5F7FA]"
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
      className="group flex items-center gap-4 rounded-xl border border-[#CBD2D6] bg-white p-3 text-right shadow-[0_1px_4px_rgba(0,48,135,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,48,135,0.1)]"
    >
      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-[#F5F7FA]">
        {result.image ? (
          <img
            src={getProductImageUrl(result.image)}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#687173]">
            <Icon size={22} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-persian font-semibold text-[#1A1A2E]">
          {result.title}
        </p>
        {result.subtitle && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[#687173]">
            {result.subtitle}
          </p>
        )}
      </div>

      <ChevronLeft
        size={18}
        className="flex-shrink-0 text-[#687173] transition-transform group-hover:-translate-x-0.5 group-hover:text-[#003087]"
      />
    </button>
  );
}
