import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, Download, Grid2X2 } from "lucide-react";
import { isServerRoute } from "../../config/serverRoutes";

/**
 * The phone's three quick actions, under the slogan.
 *
 * These replace the compact icon tiles that used to close the mobile hero. The
 * destinations are the same three; what changed is that each card now carries a
 * subtitle and an arrow, so the row reads as three decisions rather than three
 * buttons — which is why the catalogue card's subtitle names what is inside the
 * file instead of repeating the title.
 *
 * One primary and two secondaries, so the row never becomes three navy slabs
 * (§2's 60-30-10). The navy card is index 2 rather than the usual first slot
 * because the brief names the order; under rtl that puts it left-most.
 *
 * Depth is the whole point of the treatment and it is all in the shadows: a
 * hairline inner highlight at the top edge, a tight contact shadow, then a wide
 * diffuse one. No dark hard-edged rings — a card should look lifted off the
 * page, not outlined on it.
 */

/* Geometry is written once and each skin overrides only its fill. min-height
   rather than height: the grid stretches all three to the tallest, so the row
   stays level, while a title that wraps on a narrow screen grows the row
   instead of clipping inside it.

   The brief's 125–145px assumes one-line copy. At 390px a card is 113px wide
   and «مشخصات کامل محصولات» cannot fit a single line at any legible size, so
   every subtitle runs to two — which is what sets the real height, ~155px. The
   numbers below are trimmed to the floor of each range the brief gives (48px
   tile, 34px arrow, 2.9vw subtitle) rather than past it. */
const CARD =
  "flex min-h-[142px] flex-col items-start rounded-[24px] p-2 text-start no-underline " +
  "transition-[transform,box-shadow] duration-[200ms] ease-out " +
  "hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-brand-navy active:translate-y-px active:scale-[0.985] " +
  "motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0 motion-reduce:active:scale-100";

const CARD_LIGHT =
  `${CARD} text-brand-navy ring-1 ring-white/70 ` +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(5,46,95,0.05),0_10px_22px_-12px_rgba(5,46,95,0.22)] " +
  "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_4px_rgba(5,46,95,0.07),0_16px_30px_-12px_rgba(5,46,95,0.3)]";

const CARD_NAVY =
  `${CARD} bg-brand-navy text-white ` +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_4px_rgba(5,46,95,0.18),0_18px_34px_-14px_rgba(5,46,95,0.5)] " +
  "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_3px_6px_rgba(5,46,95,0.2),0_24px_40px_-14px_rgba(5,46,95,0.55)]";

/* The tile is raised off the card, so its shadow is the stronger of the two —
   that is the only thing making it read as a physical chip rather than a
   coloured square. */
const TILE =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl";
const TILE_LIGHT = `${TILE} bg-white shadow-[inset_0_1px_0_rgba(255,255,255,1),0_2px_5px_rgba(5,46,95,0.1),0_8px_16px_-8px_rgba(5,46,95,0.24)]`;
const TILE_NAVY = `${TILE} bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_6px_rgba(2,14,30,0.3)]`;

/* mt-auto pins the arrow to the foot of the card and self-end puts it at the
   inline end — the left, under rtl — so it never lands on the text above it.
   It points left, which is forward in this direction. */
const ARROW =
  "mt-auto flex h-[34px] w-[34px] shrink-0 items-center justify-center self-end " +
  "rounded-full bg-brand-warm-white text-brand-navy";
const ARROW_LIGHT = `${ARROW} shadow-[inset_0_1px_0_rgba(255,255,255,1),0_2px_6px_rgba(5,46,95,0.16)]`;
const ARROW_NAVY = `${ARROW} shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_2px_8px_rgba(2,14,30,0.38)]`;

/* Clamped rather than fixed. 14px at 390 is the bottom of the brief's 14–16px
   band and the largest size at which «دانلود کاتالوگ» still holds one line in
   the 97px a card leaves it — one line matters more here than the last pixel of
   size. The vw term takes it to ~12.5px on a 320px screen. */
const TITLE =
  "mt-2 font-persian text-[clamp(12.5px,3.6vw,15px)] leading-[1.4] font-bold";
const SUBTITLE =
  "mt-0.5 font-persian text-[clamp(10.5px,2.9vw,12px)] leading-[1.35] font-medium";

const CARDS = [
  {
    key: "catalog",
    title: "دانلود کاتالوگ",
    subtitle: "مشخصات کامل محصولات",
    icon: Download,
    // Not a route, so an <a>: a NavLink would intercept the download. Same asset
    // and attribute as the footer's and the account sheet's catalog link.
    href: "/catalog.pdf",
    card: `${CARD_LIGHT} bg-brand-warm-white`,
    tile: TILE_LIGHT,
    arrow: ARROW_LIGHT,
    subtitleClass: "text-text-secondary",
  },
  {
    key: "guide",
    title: "انتخاب مناسب",
    subtitle: "با راهنمای خرید",
    icon: BookOpen,
    to: "/articles/",
    // Navy at 5.5%: the brief's "very pale blue", reached by tinting the brand
    // colour rather than introducing a blue the palette does not have. §2 keeps
    // the status tints for status, so #EEF3F8 was not available here.
    card: `${CARD_LIGHT} bg-brand-navy/[0.055]`,
    tile: TILE_LIGHT,
    arrow: ARROW_LIGHT,
    subtitleClass: "text-text-secondary",
  },
  {
    key: "models",
    title: "مشاهده مدل‌ها",
    subtitle: "هر سلیقه، یک آرامش",
    icon: Grid2X2,
    to: "/products",
    card: CARD_NAVY,
    tile: TILE_NAVY,
    arrow: ARROW_NAVY,
    // 70% white on navy still clears 7:1, so the hierarchy is carried by the
    // drop in contrast rather than by dropping below the contrast floor.
    subtitleClass: "text-white/70",
  },
];

export default function QuickActions() {
  return (
    <section className="bg-white px-4 pb-4">
      <div dir="rtl" className="grid grid-cols-3 gap-2.5">
        {CARDS.map(({ key, title, subtitle, icon: Icon, card, tile, arrow, subtitleClass, ...rest }) => {
          const body = (
            <>
              <span className={tile}>
                <Icon size={26} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className={TITLE}>{title}</span>
              <span className={`${SUBTITLE} ${subtitleClass}`}>{subtitle}</span>
              {/* Decorative: the whole card is the control, so the arrow is an
                  affordance for sighted users, not a second target. */}
              <span className={arrow} aria-hidden="true">
                <ArrowLeft size={16} strokeWidth={2} />
              </span>
            </>
          );

          if (rest.href) {
            return (
              <a key={key} href={rest.href} download className={card}>
                {body}
              </a>
            );
          }

          // The guide is a Django page, so it is a real anchor rather than a
          // <Link> into a route App.jsx no longer declares. Same card, same
          // children — only the element changes.
          if (isServerRoute(rest.to)) {
            return (
              <a key={key} href={rest.to} className={card}>
                {body}
              </a>
            );
          }

          return (
            <Link key={key} to={rest.to} className={card}>
              {body}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
