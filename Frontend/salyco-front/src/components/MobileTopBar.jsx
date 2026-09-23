import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, UserCircle } from "lucide-react";
import AccountSheet from "./AccountSheet";

/**
 * The mobile top bar: brand on the right, menu + account on the left.
 *
 * Those controls used to be split — the logo lived in the hero and account was
 * the tab bar's fifth slot. Both moved here so a phone always has the brand and
 * the account one tap away on every page, and the tab bar is left with the four
 * destinations that are genuinely navigation: خانه · محصولات · جست‌وجو · سبد خرید.
 *
 * Unlike MobileTabBar this is NOT suppressed on the auth, checkout, admin or
 * order pages — the client asked for it to be constant. Its height is
 * --navbar-height below lg, so the pages that offset their top padding by that
 * variable clear it automatically; the inset is inside that variable, which is
 * why <body> no longer carries its own padding-top.
 *
 * The row is deliberately wide for a phone — six elements across 68px — so every
 * size steps up once from 360px, Design.md §13's narrowest QA width. Sizes are
 * quoted at that 360px step and above.
 */
export default function MobileTopBar() {
  const { pathname } = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  // Returned to on close rather than relying on document.activeElement: a tap
  // does not focus a <button> on iOS Safari, so focus would drop to <body> (§9).
  const accountBtnRef = useRef(null);

  // Close the sheet on navigation. Adjusted during render so the open panel is
  // never committed over the page that was just opened.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setSheetOpen(false);
  }

  return (
    <>
      {/* h-[68px] is what --navbar-height measures below lg. */}
      <header
        className="fixed inset-x-0 top-0 z-40 border-b border-brand-mist bg-white
                   pt-[env(safe-area-inset-top,0px)]
                   shadow-[0_1px_4px_rgba(5,46,95,0.06)] lg:hidden"
      >
        {/* rtl + justify-between puts the first child on the right.

            The row carries six elements, and at the brief's sizes they need
            ~340px of content — more than a 360px screen leaves once the gutter
            is taken. The sizes below are therefore cut in two steps, and every
            value the brief names (mark 46px, wordmark 18px, account label 15px,
            23px glyph) is held at its floor rather than below it; what gives is
            only what the brief leaves unsized — the account disc, the
            hamburger's width, the gaps and the gutter. */}
        <div
          dir="rtl"
          className="flex h-[68px] items-center justify-between gap-2 px-4 min-[380px]:px-[18px]"
        >
          {/* Mark + wordmark as one link: rtl puts the first child on the right,
              so the swan sits right-most and «تشک سالیکو» reads to its left. §6
              asks for clearance of at least a quarter of the mark's height, which
              at 46px is 11.5px — gap-3. The mark alone is the approved asset; the
              words beside it are the client's addition, so the image is
              decorative (alt="") and the visible text is the link's name — that
              also keeps the accessible name identical to the visible label.

              shrink-0, not min-w-0: a squeezed lockup does not clip, it spills
              its text leftward over the account label, which is worse than any
              amount of crowding. The wordmark is dropped below 360px —
              Design.md §13's narrowest mobile width — rather than allowed to
              collide there; the mark carries the brand on its own. */}
          <Link
            to="/"
            className="flex shrink-0 items-center gap-3 rounded-lg
                       focus-visible:outline-2 focus-visible:outline-offset-2
                       focus-visible:outline-brand-navy"
          >
            <img
              src="/salyco-logo-navy.svg"
              alt=""
              aria-hidden="true"
              className="h-[46px] w-auto shrink-0 object-contain min-[380px]:h-12"
            />
            <span className="hidden font-persian text-[18px] font-semibold whitespace-nowrap text-brand-navy min-[360px]:inline min-[380px]:text-[19px]">
              تشک سالیکو
            </span>
          </Link>

          {/* rtl again: text, then glyph, then divider, then the menu — which
              reads right-to-left as label → icon → divider → hamburger, so the
              hamburger lands flush against the left edge as the brief asks. No
              aria-label on either control: the visible label is the accessible
              name where there is one (§2.5.3 Label in Name), and the hamburger
              has no visible label, so it gets one instead. */}
          <div className="flex shrink-0 items-center gap-1 min-[380px]:gap-1.5">
            <button
              ref={accountBtnRef}
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              className="group flex h-12 shrink-0 items-center gap-1 rounded-full
                         font-persian text-brand-navy focus-visible:outline-2
                         focus-visible:outline-offset-2 focus-visible:outline-brand-navy
                         min-[380px]:gap-1.5"
            >
              {/* 15px at every width: the floor of the brief's 15–17px band, and
                  the one size on this row that is not allowed to step down. */}
              <span className="text-[15px] font-semibold whitespace-nowrap">
                حساب کاربری
              </span>
              {/* The disc is the control's only resting surface — the header is
                  otherwise flat — so it carries the tint and the hover deepens
                  it. 1.75 keeps lucide's stroke at ~2px at this size (§6). */}
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-navy/[0.06] transition-colors duration-200 group-hover:bg-brand-navy/[0.12] min-[380px]:h-[34px] min-[380px]:w-[34px]">
                <UserCircle size={23} strokeWidth={1.75} aria-hidden="true" />
              </span>
            </button>

            <span
              aria-hidden="true"
              className="h-7 w-px shrink-0 bg-brand-mist"
            />

            {/* The sheet this opens is the same one the account control opens:
                on a phone that sheet *is* the menu — warranty, the secondary
                pages, the catalogue download and the account rows all live in
                it, so a second drawer would duplicate it rather than add a
                destination. */}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label="منو"
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              className="flex h-12 w-9 shrink-0 items-center justify-center rounded-full
                         text-brand-navy transition-colors hover:bg-brand-warm-white
                         focus-visible:outline-2 focus-visible:outline-offset-2
                         focus-visible:outline-brand-navy min-[380px]:w-10"
            >
              <Menu size={24} strokeWidth={1.9} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {sheetOpen && (
        <AccountSheet
          onClose={() => setSheetOpen(false)}
          returnFocusTo={accountBtnRef}
        />
      )}
    </>
  );
}
