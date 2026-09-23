import { MapPin, Phone, Clock, ExternalLink } from "lucide-react";
import PageBackground from "../components/PageBackground";
import { BRAND } from "../config/brand";

// ─── Dealer data ──────────────────────────────────────────────────────────────
// Fewer than ~5 dealers, so we keep them inline here instead of a backend model.
// `image` is a cropped location/map snapshot placed in /public/dealers/.
// `mapUrl` opens the location in Google/Neshan maps in a new tab.
const dealers = [
  {
    id: 1,
    name: "نمایندگی مرکزی نیشابور",
    // The central dealership is the brand's own address (§12), so it comes from
    // the shared source rather than a second, truncated copy. No hours have been
    // supplied by the brand, so `hours` below is still unverified placeholder.
    address: BRAND.address,
    // Approved landline from Design.md §12 / the catalogue contact page, taken
    // from the single brand source rather than written out here.
    phone: BRAND.phone,
    hours: "شنبه تا پنج‌شنبه، ۹ تا ۲۰",
    image: "/locationimage.jpg",
    mapUrl: "https://neshan.org/maps/places/2b1QBjPJ82AW",
  },
];

// ─── Dealer card ──────────────────────────────────────────────────────────────
// Full-width rectangle. Physical LEFT quarter = cropped location image,
// RIGHT three-quarters = address details. Stacks vertically on small screens.
function DealerCard({ dealer }) {
  return (
    <article
      dir="ltr"
      className="group flex w-full flex-col overflow-hidden rounded-xl bg-white shadow-[0_1px_4px_rgba(5,46,95,0.06)] ring-1 ring-brand-mist transition hover:shadow-[0_4px_16px_rgba(5,46,95,0.1)]  md:flex-row"
    >
      {/* LEFT: cropped location image (1/4 width on desktop) */}
      <a
        href={dealer.mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="relative h-48 w-full shrink-0 overflow-hidden bg-brand-warm-white md:h-auto md:w-1/4"
      >
        {dealer.image ? (
          <img
            src={dealer.image}
            alt={dealer.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-brand-warm-white">
            <MapPin
              className="h-12 w-12 text-text-secondary opacity-60"
              strokeWidth={1.5}
            />
          </div>
        )}
        {/* subtle overlay + "view on map" hint */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-brand-navy opacity-0 transition group-hover:opacity-100">
          <ExternalLink size={12} />
          مشاهده روی نقشه
        </span>
      </a>

      {/* RIGHT: address details (3/4 width on desktop) */}
      <div
        className="flex flex-1 flex-col justify-center gap-3 p-5 sm:p-6"
        dir="rtl"
      >
        <h3 className="font-persian text-lg font-bold text-text-primary md:text-xl">
          {dealer.name}
        </h3>

        <div className="flex items-start gap-2.5 font-persian text-sm leading-relaxed text-text-secondary">
          <MapPin size={18} className="mt-0.5 shrink-0 text-brand-navy" />
          <span>{dealer.address}</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1">
          {dealer.phone && (
            <a
              href={`tel:${dealer.phone.replace(/[^0-9+]/g, "")}`}
              className="flex items-center gap-2 font-persian text-sm text-text-secondary transition hover:text-brand-navy"
              dir="ltr"
            >
              <Phone size={16} className="text-brand-navy" />
              <span dir="rtl">{dealer.phone}</span>
            </a>
          )}
          {dealer.hours && (
            <div className="flex items-center gap-2 font-persian text-sm text-text-secondary">
              <Clock size={16} className="text-brand-navy" />
              <span>{dealer.hours}</span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Dealers() {
  return (
    <section
      className="relative min-h-screen overflow-hidden bg-brand-warm-white pt-[var(--navbar-height)]"
      dir="rtl"
    >
      <PageBackground />

      <div className="relative mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
        {/* ── Page header ── */}
        <header className="mb-12" dir="rtl">
          <p className="font-sans text-sm uppercase tracking-[0.3em] text-text-secondary">
            Dealers
          </p>
          <h1 className="mt-2 font-persian text-3xl font-bold text-brand-navy md:text-4xl">
            نمایندگی‌های سالیکو
          </h1>
          <hr className="mt-4 w-24 border-t-2 border-brand-navy" />
          <p className="mt-4 max-w-xl font-persian text-base text-text-secondary">
            نزدیک‌ترین نمایندگی سالیکو را پیدا کنید و از نزدیک محصولات ما را
            ببینید.
          </p>
        </header>

        {/* ── Dealer cards (full-width rectangles) ── */}
        {dealers.length === 0 ? (
          <p className="font-persian text-center text-text-secondary">
            در حال حاضر نمایندگی‌ای ثبت نشده است.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {dealers.map((dealer) => (
              <DealerCard key={dealer.id} dealer={dealer} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
