/**
 * The warranty banner, under the quick actions.
 *
 * The image is the mattress side with the brand label on it — the brief's
 * "close-up fabric / Salyco label" — and it sits on the right, which is where
 * rtl puts the first flex child. Text takes the rest.
 *
 * The fade over the image's inner edge is there so the crop dissolves into the
 * card instead of stopping on a seam. It is decoration only: the text never sits
 * on the photograph, so nothing is riding on it for readability.
 */
export default function WarrantyBanner() {
  return (
    <section className="bg-white px-4 pb-5">
      <div
        dir="rtl"
        className="relative flex h-[154px] overflow-hidden rounded-[24px] bg-brand-warm-white
                   shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(5,46,95,0.05),0_10px_24px_-14px_rgba(5,46,95,0.25)]"
      >
        <div className="relative w-[42%] shrink-0">
          <img
            src="/matress.png"
            alt="نمای نزدیک پارچه و لیبل سالیکو روی دیوارهٔ تشک"
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover object-center"
          />
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-brand-warm-white to-transparent"
          />
        </div>

        {/* 20/700 is §3's H2 role at card scale: this is the banner's one
            message, so it outranks the qualifier below it. The qualifier stays
            at §3's متن فرعی, 14/26. The leading carries a `!` for the reason
            spelled out in BrandSlogan.jsx — index.css's unlayered heading rule
            would otherwise pin this to 1.4. */}
        <div className="flex flex-1 flex-col justify-center gap-1.5 ps-4 pe-3">
          <h2 className="font-persian text-[20px] leading-[1.55]! font-bold text-brand-navy">
            کیفیت امروز،
            <br />
            آرامش فردا
          </h2>
          <p className="font-persian text-[14px] leading-[1.6] font-normal text-text-secondary">
            با ۱۰ سال گارانتی سالیکو
          </p>
        </div>
      </div>
    </section>
  );
}
