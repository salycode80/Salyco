import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import api from "../api";
import MattressCard from "./product/MattressCard";

/**
 * FeaturedProducts — a short, user-friendly preview of the catalogue shown on
 * the home page. Pulls the first few mattresses from the API and drops them into
 * the same MattressCard used on the products page so the look stays consistent.
 */
export default function FeaturedProducts() {
  const [mattresses, setMattresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const trackRef = useRef(null);

  useEffect(() => {
    api
      .get("/api/mattress/")
      .then((res) => setMattresses(res.data.slice(0, 8)))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // Auto-advance the carousel one card at a time, looping back to the start at
  // the end. Scrolls to each child's actual position (via offsetLeft) so it is
  // direction-agnostic — RTL vs LTR scrollLeft sign differences don't matter.
  // Pauses while the user hovers/touches so it never fights manual scrolling.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || mattresses.length === 0) return;

    let paused = false;
    let index = 0;
    const pause = () => (paused = true);
    const resume = () => (paused = false);
    track.addEventListener("pointerenter", pause);
    track.addEventListener("pointerleave", resume);
    track.addEventListener("touchstart", pause, { passive: true });
    track.addEventListener("touchend", resume, { passive: true });

    const id = setInterval(() => {
      if (paused) return;
      const cards = track.children;
      if (cards.length === 0) return;
      index = (index + 1) % cards.length;
      // Assign scrollLeft DIRECTLY (not scrollTo / scrollIntoView). A direct
      // property assignment scrolls only this element and can never move the
      // window — that page-jump-to-section bug came from the smooth scrollTo
      // pulling the whole page. The `scroll-smooth` class keeps it animated.
      track.scrollLeft = cards[index].offsetLeft;
    }, 3500);

    return () => {
      clearInterval(id);
      track.removeEventListener("pointerenter", pause);
      track.removeEventListener("pointerleave", resume);
      track.removeEventListener("touchstart", pause);
      track.removeEventListener("touchend", resume);
    };
  }, [mattresses]);

  // Hide the whole section if there is nothing to show.
  if (!loading && (error || mattresses.length === 0)) return null;

  return (
    <section className="relative overflow-hidden bg-white">
      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <header
          className="mb-12 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end"
          dir="rtl"
        >
          <div>
            <p className="font-sans text-sm uppercase tracking-[0.3em] text-[#003087]">
              Products
            </p>
            <h2 className="mt-2 font-persian text-3xl font-bold text-[#003087] md:text-4xl">
              منتخب تشک‌های سالیکو
            </h2>
            <hr className="mt-4 w-24 border-t-2 border-[#003087]" />
            <p className="mt-4 max-w-xl font-persian text-base text-[#687173]">
              گلچینی از محبوب‌ترین تشک‌های ما؛ برای دیدن همه محصولات وارد گالری
              شوید.
            </p>
          </div>

          <Link
            to="/products/mattress"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border-2 border-[#003087] bg-white px-5 py-2.5 font-persian text-sm font-semibold text-[#003087] transition-colors hover:bg-[#003087]/5"
          >
            مشاهده همه
            <ArrowLeft size={16} />
          </Link>
        </header>

        {loading ? (
          <div className="flex gap-3 overflow-hidden sm:gap-6">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-[240px] w-[calc((100%-1.5rem)/3)] shrink-0 animate-pulse rounded-xl bg-[#CBD2D6] sm:h-[420px] sm:w-[calc((100%-4.5rem)/4)]"
              />
            ))}
          </div>
        ) : (
          <div
            ref={trackRef}
            className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-6"
          >
            {mattresses.map((mattress) => (
              <div
                key={mattress.slug}
                className="w-[calc((100%-1.5rem)/3)] shrink-0 snap-start sm:w-[calc((100%-4.5rem)/4)]"
              >
                <MattressCard mattress={mattress} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
