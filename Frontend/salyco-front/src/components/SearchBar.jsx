import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, BedDouble, BookOpen, Loader2, X } from "lucide-react";
import { search as searchApi } from "../api/search";
import { getProductImageUrl } from "../utils/productImage";

// Map a provider `type` to an icon. Unknown/new types fall back to Search,
// so a freshly-added backend provider renders correctly with zero changes here.
const TYPE_ICON = {
  mattress: BedDouble,
  article: BookOpen,
};
const iconFor = (type) => TYPE_ICON[type] || Search;

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

/**
 * General-purpose search box with a live results dropdown.
 *
 * @param {string}   [variant="navbar"]  "navbar" (dark) | "plain" (light)
 * @param {function} [onNavigate]        called after navigating (e.g. close mobile menu)
 * @param {boolean}  [autoFocus]
 */
export default function SearchBar({ variant = "navbar", onNavigate, autoFocus }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [data, setData] = useState(null); // { count, groups }
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const rootRef = useRef(null);
  const abortRef = useRef(null);

  // Flat, ordered list of results for keyboard navigation.
  const flatResults = (data?.groups || []).flatMap((g) => g.results);

  // ── Debounced fetch ────────────────────────────────────────────────
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_CHARS) {
      setData(null);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await searchApi(q, { signal: controller.signal });
        setData(res);
        setActiveIndex(-1);
      } catch (err) {
        if (err.name !== "CanceledError" && err.code !== "ERR_CANCELED") {
          setData({ count: 0, groups: [] });
        }
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  // ── Close on outside click ─────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const closeAndReset = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const goToResult = useCallback(
    (result) => {
      closeAndReset();
      setQuery("");
      navigate(result.url);
      onNavigate?.();
    },
    [navigate, onNavigate, closeAndReset]
  );

  const goToResultsPage = useCallback(() => {
    const q = query.trim();
    if (q.length < MIN_CHARS) return;
    closeAndReset();
    navigate(`/search?q=${encodeURIComponent(q)}`);
    onNavigate?.();
  }, [query, navigate, onNavigate, closeAndReset]);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      closeAndReset();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
      return;
    }
    if (e.key === "Enter") {
      if (activeIndex >= 0 && flatResults[activeIndex]) {
        goToResult(flatResults[activeIndex]);
      } else {
        goToResultsPage();
      }
    }
  };

  const isNavbar = variant === "navbar";
  const q = query.trim();
  const showDropdown = open && q.length >= MIN_CHARS;

  return (
    <div className="relative w-full" ref={rootRef} dir="ltr">
      <Search
        size={16}
        className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${
          isNavbar ? "text-blue-400/70" : "text-[#000c3e]/40"
        }`}
      />

      <input
        type="text"
        value={query}
        autoFocus={autoFocus}
        placeholder="جست و جو در محصولات و مقالات ..."
        dir="rtl"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className={
          isNavbar
            ? `w-full pl-9 pr-9 py-[10px] rounded-lg text-sm bg-white/8 border border-blue-400/25 text-blue-100 placeholder-blue-400/50 focus:outline-none focus:border-blue-400/60 focus:bg-white/12 transition-all`
            : `w-full pl-9 pr-9 py-[11px] rounded-lg text-sm bg-white border border-[#000c3e]/15 text-[#000c3e] placeholder-[#000c3e]/40 focus:outline-none focus:border-[#2563eb]/50 shadow-sm transition-all`
        }
      />

      {/* Trailing indicator: spinner while loading, clear button when text present */}
      {loading ? (
        <Loader2
          size={16}
          className={`absolute left-3 top-1/2 -translate-y-1/2 animate-spin ${
            isNavbar ? "text-blue-300" : "text-[#2563eb]"
          }`}
        />
      ) : query ? (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setData(null);
          }}
          className={`absolute left-3 top-1/2 -translate-y-1/2 ${
            isNavbar ? "text-blue-300/70 hover:text-blue-100" : "text-[#000c3e]/40 hover:text-[#000c3e]"
          }`}
          aria-label="پاک کردن"
        >
          <X size={15} />
        </button>
      ) : null}

      {/* ── Results dropdown ── */}
      {showDropdown && (
        <div
          dir="rtl"
          className="absolute top-full left-0 right-0 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-blue-400/20 bg-white shadow-2xl z-50"
        >
          {loading && !data && (
            <div className="px-4 py-6 text-center text-sm text-[#000c3e]/50 font-persian">
              در حال جست و جو ...
            </div>
          )}

          {data && data.count === 0 && (
            <div className="px-4 py-6 text-center text-sm text-[#000c3e]/50 font-persian">
              نتیجه‌ای برای «{q}» یافت نشد.
            </div>
          )}

          {data &&
            data.groups.map((group) => {
              const Icon = iconFor(group.key);
              return (
                <div key={group.key} className="border-b border-blue-400/10 last:border-b-0">
                  <div className="flex items-center gap-1.5 px-4 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#2563eb]/70">
                    <Icon size={13} />
                    <span>{group.label}</span>
                  </div>

                  {group.results.map((result) => {
                    const flatIdx = flatResults.indexOf(result);
                    const active = flatIdx === activeIndex;
                    return (
                      <button
                        key={`${result.type}-${result.id}`}
                        type="button"
                        onClick={() => goToResult(result)}
                        onMouseEnter={() => setActiveIndex(flatIdx)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-right transition-colors ${
                          active ? "bg-blue-50" : "hover:bg-blue-50/60"
                        }`}
                      >
                        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-[#0a1f4d]/5">
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
                            <div className="flex h-full w-full items-center justify-center text-[#2563eb]/40">
                              <Icon size={16} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[#000c3e]">
                            {result.title}
                          </p>
                          {result.subtitle && (
                            <p className="truncate text-xs text-[#000c3e]/50">
                              {result.subtitle}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}

          {data && data.count > 0 && (
            <button
              type="button"
              onClick={goToResultsPage}
              className="flex w-full items-center justify-center gap-1.5 border-t border-blue-400/10 bg-blue-50/40 px-4 py-2.5 text-sm font-medium text-[#2563eb] hover:bg-blue-50 transition-colors"
            >
              <Search size={14} />
              <span>مشاهده همه نتایج</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
