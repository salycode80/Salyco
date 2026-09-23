import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, BedDouble, BookOpen, Loader2, X } from "lucide-react";
import { search as searchApi } from "../api/search";
import { getProductImageUrl } from "../utils/productImage";
import { toPersianDigitsInText } from "../utils/persian";

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
export default function SearchBar({
  variant = "navbar",
  onNavigate,
  autoFocus,
}) {
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
    [navigate, onNavigate, closeAndReset],
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
        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary"
      />

      <input
        type="text"
        name="site-search"
        value={query}
        autoFocus={autoFocus}
        // Password managers scan for a username field to pair with any password
        // field on the page. Without these hints this box — the first unnamed
        // text input in the document — gets filled with the saved username the
        // moment a page with a password form mounts.
        autoComplete="off"
        data-form-type="other"
        data-lpignore="true"
        data-1p-ignore
        enterKeyHint="search"
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
            ? `w-full h-12 pl-9 pr-9 rounded-lg font-persian text-sm bg-brand-warm-white border border-brand-mist text-text-primary placeholder-text-secondary focus:outline-none focus:bg-white focus:border-2 focus:border-brand-navy transition-all`
            : `w-full h-12 pl-9 pr-9 rounded-lg font-persian text-sm bg-brand-warm-white border border-brand-mist text-text-primary placeholder-text-secondary focus:outline-none focus:bg-white focus:border-2 focus:border-brand-navy transition-all`
        }
      />

      {/* Trailing indicator: spinner while loading, clear button when text present */}
      {loading ? (
        <Loader2
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin text-brand-navy"
        />
      ) : query ? (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setData(null);
          }}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
          aria-label="پاک کردن"
        >
          <X size={15} />
        </button>
      ) : null}

      {/* ── Results dropdown ── */}
      {showDropdown && (
        <div
          dir="rtl"
          className="absolute top-full left-0 right-0 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-brand-mist bg-white shadow-[0_4px_16px_rgba(5,46,95,0.1)] z-50"
        >
          {loading && !data && (
            <div className="px-4 py-6 text-center text-sm text-text-secondary font-persian">
              در حال جست و جو ...
            </div>
          )}

          {data && data.count === 0 && (
            <div className="px-4 py-6 text-center text-sm text-text-secondary font-persian">
              نتیجه‌ای برای «{q}» یافت نشد. نام مدل دیگری را امتحان کنید.
            </div>
          )}

          {data &&
            data.groups.map((group) => {
              const Icon = iconFor(group.key);
              return (
                <div
                  key={group.key}
                  className="border-b border-brand-mist last:border-b-0"
                >
                  {/* group.label is Persian ("محصولات" / "مقالات"), so §3 keeps
                      letter-spacing at zero here — no uppercase/tracking. */}
                  <div className="flex items-center gap-1.5 px-4 pt-3 pb-1.5 font-persian text-[11px] font-semibold text-text-secondary">
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
                          active ? "bg-brand-warm-white" : "hover:bg-brand-warm-white"
                        }`}
                      >
                        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-brand-warm-white">
                          {result.image ? (
                            <img
                              src={getProductImageUrl(result.image)}
                              alt=""
                              className={`h-full w-full ${
                                // §7: a mattress must read whole, so it is
                                // letterboxed; an article's photo is a scene
                                // and fills its frame.
                                result.type === "mattress"
                                  ? "object-contain"
                                  : "object-cover"
                              }`}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-text-secondary">
                              <Icon size={16} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text-primary">
                            {result.title}
                          </p>
                          {result.subtitle && (
                            <p className="truncate text-xs text-text-secondary">
                              {toPersianDigitsInText(result.subtitle)}
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
              className="flex w-full items-center justify-center gap-1.5 border-t border-brand-mist bg-brand-warm-white px-4 py-2.5 text-sm font-medium text-brand-navy hover:bg-white transition-colors"
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
