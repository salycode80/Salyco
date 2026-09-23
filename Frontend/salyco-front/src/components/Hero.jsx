import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Moon, Sparkles, Download } from "lucide-react";

const highlights = [
  { icon: ShieldCheck, label: "گارانتی معتبر" },
  { icon: Moon, label: "خواب عمیق و آرام" },
  { icon: Sparkles, label: "کیفیت ممتاز" },
];

/* Both hero actions are the same control in two skins, so the geometry lives
   here once and each variant overrides only its fill. Geometry follows §9:
   min-height 48px, horizontal padding 24px, radius 8px, text 16/600. */
const button =
  "inline-flex w-full min-h-12 items-center justify-center gap-2.5 rounded-lg " +
  "border border-brand-navy px-6 py-3 text-base font-semibold no-underline " +
  "transition-colors duration-[180ms] focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-brand-navy " +
  "lg:w-auto";

const buttonPrimary = `${button} bg-brand-navy text-white hover:bg-action-hover`;
const buttonSecondary = `${button} bg-white text-brand-navy hover:bg-brand-warm-white`;

/**
 * The desktop hero, and from lg up only.
 *
 * Below lg the home page is a different composition entirely — photography, then
 * the slogan as its own section, the quick actions and the warranty banner
 * (pages/Home.jsx). Everything here that used to serve phones is gone rather
 * than hidden: the max-lg ordering, the mobile crop on the image, the compact
 * icon tiles (now QuickActions.jsx) and the viewport-clamped slogan, which the
 * mobile slogan section owns instead. §13's lg breakpoint is where the app
 * already swaps its chrome, so the two stay in step.
 *
 * What is left is the desktop arrangement, unchanged: a plain block from lg to
 * 1200px, then from 1200px the image goes full-bleed behind the copy and the
 * crop keeps the bed on the left.
 */
export default function Hero({
  imageSrc = "/salyco-hero-morning.png",
  // Preserves the existing fixed-navbar offset. Pass "0px" if the layout already offsets it.
  navbarOffset = "var(--navbar-height, 0px)",
}) {
  return (
    <section
      className="hidden bg-brand-warm-white font-persian text-brand-navy lg:block"
      dir="rtl"
      aria-labelledby="salyco-hero-title"
      style={{ paddingTop: navbarOffset }}
    >
      {/* Direction is flipped so the grid's first column is the image side; the
          copy column restores rtl. 41.6581vw is the source image's own ratio
          (809/1942), which keeps the band uncropped at any width. */}
      <div
        dir="ltr"
        className="relative isolate min-[1200px]:grid min-[1200px]:min-h-[41.6581vw] min-[1200px]:grid-cols-[62%_38%]"
      >
        <div
          dir="rtl"
          className="relative z-[1] text-center md:text-right max-[1200px]:mx-auto max-[1200px]:max-w-[760px] max-[1200px]:px-8 max-[1200px]:pt-12 max-[1200px]:pb-8 min-[1200px]:col-start-2 min-[1200px]:self-center min-[1200px]:pt-8 min-[1200px]:pb-8 min-[1200px]:ps-[clamp(28px,3vw,64px)] min-[1200px]:pe-5"
        >
          {/* §8: the hero carries one main message, and §3 sizes that message as
              the "تیتر هیرو" — 48/68 from md, weight 700. The brand name used to
              sit above the slogan as a 76px <p>: a second, larger message that
              outranked the real <h1> and matched no row of the type scale. The
              brand mark is in MobileTopBar on phones and the navbar on desktop,
              so here the slogan is the single hero title.

              Below lg this heading moves to BrandSlogan.jsx, which owns it on a
              phone. Only one of the two is ever displayed, so only one is ever
              in the accessibility tree. */}
          <h1
            id="salyco-hero-title"
            className="text-[48px] leading-[68px] font-bold"
          >
            آنجا که خواب بر بال قو آرام میگیرد
          </h1>
          {/* §3 "متن معرفی برجسته": 18/34, weight 400. */}
          <p className="mt-5 text-[18px] leading-[34px] font-normal text-text-secondary">
            خوابی عمیق و دلپذیر، با انتخاب تشک مناسب شما
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/products" className={buttonPrimary}>
              مشاهده مدل‌ها
              <ArrowLeft size={18} aria-hidden="true" className="shrink-0" />
            </Link>
            {/* The catalogue, not the buying guide. Not a route, so an <a>: a
                NavLink would intercept the download. Same asset and attribute as
                the footer's, the account sheet's and the phone's quick action. */}
            <a href="/catalog.pdf" download className={buttonSecondary}>
              <Download size={18} aria-hidden="true" className="shrink-0" />
              دانلود کاتالوگ
            </a>
          </div>
        </div>
        <img
          src={imageSrc}
          alt="تشک امپریال سالیکو در اتاقی روشن با نور صبح و لحاف تاخورده"
          width={1942}
          height={809}
          fetchPriority="high"
          loading="eager"
          decoding="async"
          /* From 1200px the image goes full-bleed behind the copy and the crop
             keeps the bed on the left; below that it leads the page as a band. */
          className="block w-full min-[1200px]:absolute min-[1200px]:inset-0 min-[1200px]:-z-[1] min-[1200px]:h-full min-[1200px]:w-full min-[1200px]:object-cover min-[1200px]:object-left"
        />
      </div>

      {/* Desktop and tablet only, like the hero above it. */}
      <ul className="flex flex-wrap justify-center gap-x-8 gap-y-4 bg-white px-5 py-6">
        {highlights.map(({ icon: Icon, label }) => (
          <li
            key={label}
            className="flex items-center gap-2 text-[14px] leading-[1.8]"
          >
            <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
