import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toPersianNumber } from "../../utils/persian";

// Full-screen image preview. Mounted only while open so the effects below can
// own the body scroll lock and focus restoration without extra bookkeeping.
//
// Zoom model: a single `view` state ({ s, x, y }) drives one CSS transform on
// the image. Every update goes through setView's updater form so wheel/pinch
// events — which fire faster than React re-renders — always read the current
// value instead of a stale closure.

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const SWIPE_THRESHOLD = 60; // px of horizontal travel that counts as a swipe

const IDENTITY = { s: MIN_SCALE, x: 0, y: 0 };

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Control chrome shares one glass treatment; navy-tinted so it reads as Salyco
// rather than a generic black overlay.
const CONTROL =
  "flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 focus-visible:ring-offset-text-primary disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none";

export default function ImageLightbox({
  images,
  index,
  onIndexChange,
  onClose,
  title,
}) {
  const [view, setView] = useState(IDENTITY);
  const [smooth, setSmooth] = useState(true);
  const [entered, setEntered] = useState(false);

  const stageRef = useRef(null);
  const imageRef = useRef(null);
  const closeRef = useRef(null);
  const containerRef = useRef(null);

  const pointers = useRef(new Map());
  const pinch = useRef(null);
  const dragOrigin = useRef(null);
  // Survives past the pointerup that clears dragOrigin, so the synthetic click
  // that follows a drag/swipe can be told apart from a real tap.
  const lastTravel = useRef(0);

  const image = images[index];
  const multiple = images.length > 1;
  const zoomed = view.s > MIN_SCALE;

  // How far the image may travel before its edge pulls away from the stage
  // edge. Uses the *rendered* content box (object-contain letterboxes the img),
  // so panning never drifts into the empty bars.
  const clampPan = useCallback((x, y, s) => {
    const stage = stageRef.current;
    const img = imageRef.current;
    if (!stage || !img) return { x, y };
    const boxW = stage.clientWidth;
    const boxH = stage.clientHeight;
    const { naturalWidth: nw, naturalHeight: nh } = img;
    const fit = nw && nh ? Math.min(boxW / nw, boxH / nh) : 1;
    const contentW = nw ? nw * fit : boxW;
    const contentH = nh ? nh * fit : boxH;
    const maxX = Math.max(0, (contentW * s - boxW) / 2);
    const maxY = Math.max(0, (contentH * s - boxH) / 2);
    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  }, []);

  // Zoom, optionally keeping `focal` (a viewport point) pinned under the
  // cursor/fingers. Solves t' = c - (c - t) * (s'/s) for the new translation.
  const applyZoom = useCallback(
    (next, focal) => {
      setView((v) => {
        const target = typeof next === "function" ? next(v.s) : next;
        const s = clamp(target, MIN_SCALE, MAX_SCALE);
        if (s === v.s) return v;
        if (s === MIN_SCALE) return IDENTITY;

        const stage = stageRef.current;
        let x = (v.x * s) / v.s;
        let y = (v.y * s) / v.s;
        if (focal && stage) {
          const rect = stage.getBoundingClientRect();
          const cx = focal.x - (rect.left + rect.width / 2);
          const cy = focal.y - (rect.top + rect.height / 2);
          x = cx - (cx - v.x) * (s / v.s);
          y = cy - (cy - v.y) * (s / v.s);
        }
        return { s, ...clampPan(x, y, s) };
      });
    },
    [clampPan],
  );

  const reset = useCallback(() => {
    setSmooth(true);
    setView(IDENTITY);
  }, []);

  // Stepping images always returns to the un-zoomed view; carrying a pan offset
  // over to a differently-proportioned photo would land on empty space.
  const step = useCallback(
    (delta) => {
      if (!multiple) return;
      setSmooth(true);
      setView(IDENTITY);
      onIndexChange((index + delta + images.length) % images.length);
    },
    [index, images.length, multiple, onIndexChange],
  );

  // Play the entry transition on the first paint after mount.
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Lock background scroll and hand focus to the close button, restoring both
  // (and the previously focused element) on unmount.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        // The gallery reads right-to-left, so ArrowLeft advances.
        case "ArrowLeft":
          step(1);
          break;
        case "ArrowRight":
          step(-1);
          break;
        case "+":
        case "=":
          setSmooth(true);
          applyZoom((s) => s + 0.5);
          break;
        case "-":
          setSmooth(true);
          applyZoom((s) => s - 0.5);
          break;
        case "0":
          reset();
          break;
        default:
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applyZoom, onClose, reset, step]);

  // React attaches wheel listeners passively at the root, so the page-zoom /
  // scroll default can only be cancelled from a native non-passive listener.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e) => {
      e.preventDefault();
      setSmooth(false);
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      applyZoom((s) => s * factor, { x: e.clientX, y: e.clientY });
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [applyZoom]);

  const midpoint = () => {
    const [a, b] = [...pointers.current.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const handlePointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setSmooth(false);
    if (pointers.current.size === 2) {
      pinch.current = { distance: spread(), scale: view.s };
      dragOrigin.current = null;
    } else if (pointers.current.size === 1) {
      dragOrigin.current = { x: e.clientX, y: e.clientY, moved: 0 };
    }
  };

  const handlePointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    const previous = pointers.current.get(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2 && pinch.current) {
      const distance = spread();
      if (!distance || !pinch.current.distance) return;
      applyZoom(
        pinch.current.scale * (distance / pinch.current.distance),
        midpoint(),
      );
      return;
    }

    const dx = e.clientX - previous.x;
    const dy = e.clientY - previous.y;
    if (dragOrigin.current) {
      dragOrigin.current.moved += Math.abs(dx) + Math.abs(dy);
    }
    // Un-zoomed, a horizontal drag is a swipe between images (handled on
    // release); zoomed, it pans.
    if (view.s > MIN_SCALE) {
      setView((v) => ({ ...v, ...clampPan(v.x + dx, v.y + dy, v.s) }));
    }
  };

  const endPointer = (e) => {
    const start = dragOrigin.current;
    const wasLast = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    lastTravel.current = start?.moved ?? 0;

    if (wasLast && start && view.s === MIN_SCALE && multiple) {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
        // Dragging the image leftwards pulls the next (RTL) image into view.
        step(dx < 0 ? 1 : -1);
      }
    }
    if (pointers.current.size === 0) {
      dragOrigin.current = null;
      setSmooth(true);
    }
  };

  const handleDoubleClick = (e) => {
    setSmooth(true);
    if (view.s > MIN_SCALE) reset();
    else applyZoom(DOUBLE_TAP_SCALE, { x: e.clientX, y: e.clientY });
  };

  const handleImageClick = (e) => {
    // A click that ended a drag, swipe or pinch shouldn't also toggle zoom.
    if (lastTravel.current > 8) {
      lastTravel.current = 0;
      return;
    }
    handleDoubleClick(e);
  };

  // Minimal focus containment: cycle Tab within the dialog.
  const handleKeyDownTrap = (e) => {
    if (e.key !== "Tab") return;
    const focusable = [
      ...(containerRef.current?.querySelectorAll("button:not([disabled])") ||
        []),
    ];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`نمایش تصویر ${title}`}
      dir="rtl"
      onKeyDown={handleKeyDownTrap}
      className={`fixed inset-0 z-[100] flex flex-col bg-text-primary/95 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none ${
        entered ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className={CONTROL}
            aria-label="بستن نمایش تصویر"
          >
            <X size={20} />
          </button>
          <button
            type="button"
            onClick={() => {
              setSmooth(true);
              applyZoom((s) => s - 0.5);
            }}
            disabled={!zoomed}
            className={CONTROL}
            aria-label="کوچک‌نمایی"
          >
            <ZoomOut size={19} />
          </button>
          <button
            type="button"
            onClick={() => {
              setSmooth(true);
              applyZoom((s) => s + 0.5);
            }}
            disabled={view.s >= MAX_SCALE}
            className={CONTROL}
            aria-label="بزرگ‌نمایی"
          >
            <ZoomIn size={19} />
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={!zoomed}
            className={CONTROL}
            aria-label="بازنشانی بزرگ‌نمایی"
          >
            <RotateCcw size={18} />
          </button>
          <span
            className="ms-1 min-w-14 font-persian text-xs font-medium text-white/70 [font-feature-settings:'tnum']"
            aria-live="polite"
          >
            {toPersianNumber(Math.round(view.s * 100))}٪
          </span>
        </div>

        <div className="flex min-w-0 flex-col items-end">
          <span className="max-w-[45vw] truncate font-persian text-sm font-semibold text-white">
            {title}
          </span>
          {multiple && (
            <span className="font-persian text-xs text-white/60 [font-feature-settings:'tnum']">
              {toPersianNumber(index + 1)} از {toPersianNumber(images.length)}
            </span>
          )}
        </div>
      </div>

      {/* Stage — clicking the empty area closes, matching lightbox convention */}
      <div
        ref={stageRef}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{ touchAction: "none" }}
      >
        <img
          ref={imageRef}
          src={image?.src}
          alt={image?.alt || title}
          draggable={false}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onClick={handleImageClick}
          className={`h-full w-full select-none object-contain ${
            smooth
              ? "transition-transform duration-200 ease-out motion-reduce:transition-none"
              : ""
          } ${zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
          style={{
            transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.s})`,
            willChange: "transform",
          }}
        />

        {multiple && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              className={`${CONTROL} absolute right-3 top-1/2 -translate-y-1/2 sm:right-5`}
              aria-label="تصویر قبلی"
            >
              <ChevronRight size={22} />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              className={`${CONTROL} absolute left-3 top-1/2 -translate-y-1/2 sm:left-5`}
              aria-label="تصویر بعدی"
            >
              <ChevronLeft size={22} />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail rail */}
      {multiple && (
        <div className="shrink-0 px-4 pb-4 pt-2 sm:px-6">
          <div className="scrollbar-none mx-auto flex max-w-full gap-2 overflow-x-auto">
            {images.map((img, i) => (
              <button
                key={img.key ?? img.src}
                type="button"
                onClick={() => {
                  setSmooth(true);
                  setView(IDENTITY);
                  onIndexChange(i);
                }}
                aria-label={`تصویر ${toPersianNumber(i + 1)}`}
                aria-current={i === index}
                className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy motion-reduce:transition-none ${
                  i === index
                    ? "border-white"
                    : "border-white/25 opacity-55 hover:opacity-100"
                }`}
              >
                <img
                  src={img.src}
                  alt=""
                  draggable={false}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="hidden shrink-0 pb-3 text-center font-persian text-[11px] text-white/45 sm:block">
        برای بزرگ‌نمایی روی تصویر کلیک کنید یا از چرخ ماوس استفاده کنید — کلید
        Esc برای بستن
      </p>
    </div>,
    document.body,
  );
}
