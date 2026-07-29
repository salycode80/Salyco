import { useEffect, useRef, useState } from "react";
import { Expand, ZoomIn } from "lucide-react";
import { toPersianNumber } from "../../utils/persian";
import ImageLightbox from "./ImageLightbox";

// Product image gallery: hover-lens on pointer devices, click (or Enter) to
// open the full-screen preview. `images` is [{ src, alt, key }] — the caller
// resolves URLs so this component stays transport-agnostic. Callers should key
// this component by product so a new product starts on its first image.

const FALLBACK_IMAGE = "/matress.png";
const LENS_SCALE = 1.9;

export default function ProductGallery({ images, name }) {
  const [index, setIndex] = useState(0);
  const [broken, setBroken] = useState({});
  const [open, setOpen] = useState(false);
  const [lens, setLens] = useState(null);

  // Hover-lens is meaningless on touch (there is no cursor to track) and would
  // leave the image stuck mid-zoom after a tap.
  const finePointer = useRef(false);
  useEffect(() => {
    finePointer.current =
      window.matchMedia?.("(hover: hover) and (pointer: fine)").matches ?? false;
  }, []);

  const resolve = (img) => (img && !broken[img.src] ? img.src : FALLBACK_IMAGE);
  const safeIndex = Math.min(index, Math.max(0, images.length - 1));
  const active = images[safeIndex];
  const multiple = images.length > 1;

  const handleMouseMove = (e) => {
    if (!finePointer.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setLens({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  if (images.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-[#CBD2D6] bg-white shadow-[0_1px_4px_rgba(0,48,135,0.06)]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setLens(null)}
          aria-label={`بزرگ‌نمایی تصویر ${name}`}
          className="group relative block aspect-square w-full cursor-zoom-in overflow-hidden bg-[#F5F7FA] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#009CDE]"
        >
          <img
            src={resolve(active)}
            alt={active?.alt || name}
            draggable={false}
            onError={() =>
              active && setBroken((b) => ({ ...b, [active.src]: true }))
            }
            className="h-full w-full object-cover transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={
              lens
                ? {
                    transform: `scale(${LENS_SCALE})`,
                    transformOrigin: `${lens.x}% ${lens.y}%`,
                  }
                : undefined
            }
          />

          {/* Affordance: the image never looked clickable before. */}
          <span className="pointer-events-none absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-[#1A1A2E]/55 text-white opacity-90 backdrop-blur-md transition duration-200 group-hover:bg-[#003087] group-hover:opacity-100 motion-reduce:transition-none">
            <Expand size={16} />
          </span>

          <span className="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-[#1A1A2E]/65 px-3 py-1.5 font-persian text-[11px] font-medium text-white backdrop-blur-md transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100 motion-reduce:transition-none">
            <ZoomIn size={13} className="shrink-0" />
            برای بزرگ‌نمایی کلیک کنید
          </span>

          {multiple && (
            <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-[#1A1A2E]/65 px-2.5 py-1 font-persian text-[11px] font-medium text-white backdrop-blur-md [font-feature-settings:'tnum']">
              {toPersianNumber(safeIndex + 1)} از {toPersianNumber(images.length)}
            </span>
          )}
        </button>
      </div>

      {multiple && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {images.map((img, i) => (
            <button
              key={img.key ?? img.src}
              type="button"
              onClick={() => setIndex(i)}
              onDoubleClick={() => setOpen(true)}
              aria-label={`نمایش تصویر ${toPersianNumber(i + 1)}`}
              aria-current={i === safeIndex}
              className={`h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009CDE] focus-visible:ring-offset-2 motion-reduce:transition-none ${
                i === safeIndex
                  ? "border-[#003087]"
                  : "border-[#CBD2D6] opacity-70 hover:opacity-100"
              }`}
            >
              <img
                src={resolve(img)}
                alt={img.alt || name}
                draggable={false}
                onError={() => setBroken((b) => ({ ...b, [img.src]: true }))}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {open && (
        <ImageLightbox
          images={images.map((img) => ({ ...img, src: resolve(img) }))}
          index={safeIndex}
          onIndexChange={setIndex}
          onClose={() => setOpen(false)}
          title={name}
        />
      )}
    </div>
  );
}
