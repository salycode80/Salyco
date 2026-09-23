import { BRAND } from "../../config/brand";

/**
 * The slogan, in its own centred section directly under the hero image.
 *
 * On desktop the slogan is the hero's <h1>, because the copy column has the room
 * for it (Hero.jsx). On a phone the hero is photography only, so this carries
 * the page's one heading instead. The two never coexist — Hero is hidden below
 * lg and this is hidden from lg up — so exactly one <h1> is ever in the
 * accessibility tree.
 *
 * 7.2vw rather than a fixed size: the string renders ~13.5px wide per px of
 * font size, which at a fixed 28px would run past 90% of a 320px screen and
 * break to three lines. The clamp lands on 28px at 390px — the top of the
 * brief's range — and holds two lines everywhere down to 320.
 *
 * The `!` on the leading is not decoration. index.css sets
 * `h1,h2,h3,h4 { line-height: 1.4 }` outside any @layer, and Tailwind emits
 * utilities inside `@layer utilities`; unlayered declarations beat layered ones
 * outright, so no leading-* utility applies to a heading anywhere in this app
 * until that rule is layered. §3 of Design.md wants ~1.6 for display type, and
 * Persian needs the room, so this one escapes the rule rather than repeating the
 * project-wide bug. Every other `leading-*` on a heading in the codebase is
 * silently inert — worth fixing at the source, but that reaches pages this
 * change has no business touching.
 */
export default function BrandSlogan() {
  return (
    <section dir="rtl" className="bg-white px-4 pt-8 pb-7 text-center">
      <h1 className="mx-auto max-w-[90%] font-persian text-[clamp(23px,7.2vw,28px)] leading-[1.6]! font-bold text-balance text-brand-navy">
        {BRAND.slogan}
      </h1>

      {/* line — swan — line, read as one unit. brand-navy at 15% is a hairline
          on a bright page: visible enough to bracket the mark, far too faint to
          become a second focal point. The swan is the approved asset rather than
          a redrawn glyph, at §6's 24–28px. */}
      <div
        aria-hidden="true"
        className="mt-4 flex items-center justify-center gap-3"
      >
        <span className="h-px w-10 shrink-0 bg-brand-navy/15" />
        <img
          src="/salyco-logo-navy.svg"
          alt=""
          className="h-7 w-auto shrink-0 object-contain opacity-90"
        />
        <span className="h-px w-10 shrink-0 bg-brand-navy/15" />
      </div>
    </section>
  );
}
