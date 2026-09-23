/**
 * The phone home page's opening image, and nothing else.
 *
 * Design.md §8 gives the hero one main message in type. On a phone the client's
 * layout strips it back to photography instead — no headline, no CTA, no badge,
 * no overlay — and the slogan it would have carried becomes its own section
 * immediately below (BrandSlogan.jsx). That split is what keeps this image pure,
 * and the order it produces (image → slogan → actions) is the one the phone
 * brief asks for.
 *
 * 72vw is a ratio, not a height, so the crop is identical at every phone width
 * and only object-position has to be aimed. 12% is where the mattress sits in
 * the source frame: at 72vw the visible window runs from 5% to 63% of the
 * original, which is the bed and very little else. The max-height only bites
 * from tablet portrait up, where 72vw would be over 500px tall; no phone
 * reaches it.
 */
export default function MobileHero({ imageSrc = "/salyco-hero-morning.png" }) {
  return (
    <section
      className="bg-brand-white"
      // The top bar is fixed, so without this the image would start behind it.
      style={{ paddingTop: "var(--navbar-height, 0px)" }}
    >
      <img
        src={imageSrc}
        alt="تشک امپریال سالیکو در اتاقی روشن با نور صبح و لحاف تاخورده"
        width={1942}
        height={809}
        fetchPriority="high"
        loading="eager"
        decoding="async"
        className="block h-[72vw] max-h-[26rem] w-full object-cover object-[12%_50%]"
      />
    </section>
  );
}
