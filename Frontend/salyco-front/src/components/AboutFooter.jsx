import { BRAND } from "../config/brand";
import { Link } from "react-router-dom";
import { Phone, Camera, MapPin, Globe } from "lucide-react";
import { isServerRoute } from "../config/serverRoutes";

// Enamad (نماد اعتماد الکترونیکی) seal credentials. Kept as constants so the
// query strings are built in JS — a raw "&Code=" inside a JSX attribute string
// reads as an HTML entity sequence and is easy to mangle on a later edit.
const ENAMAD_ID = "7423184";
const ENAMAD_CODE = "H0l91jYQCDPJ1VyeHuuoxNVNW7vIEOw4";

const footerLinks = [
  { label: "محصولات", href: "/products" },
  { label: "راهنمای انتخاب تشک", href: "/articles/" },
  { label: "خدمات پس از فروش", href: "/warranty/my" },
  { label: "تماس با ما", href: "/contact" },
  { label: "درباره ما", href: "/about" },
];

export default function AboutFooter() {
  return (
    <footer
      id="about"
      className="relative overflow-hidden bg-brand-navy border-t border-white/15"
    >
      {/* Soft sheen at the top-right. Was rgba(5,46,95,.15) — the same navy as
          the footer surface, so it painted nothing. White at low alpha keeps the
          intended glow and stays within §6's low-intensity page-end texture. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.07),transparent_55%)]" />

      <div className="relative mx-auto max-w-[1200px] px-6 py-16">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-8">
          {/* Brand & about */}
          <div dir="rtl">
            <Link to="/" className="inline-flex items-center gap-2">
              <img
                src="/salyco-logo-white.svg"
                alt="لوگوی سالیکو"
                className="h-24 w-auto object-contain"
              />
            </Link>

            <h2 className="mt-6 font-persian text-2xl font-bold text-white">
              درباره سالیکو
            </h2>
            <hr className="mt-3 w-16 border-t-2 border-white/25" />

            <p className="mt-4 font-persian text-sm leading-relaxed text-white/75">
              سالیکو با بیش از دو دهه تجربه در تولید تشک و محصولات خواب، ترکیبی
              از فناوری مدرن و کیفیت ممتاز را برای خوابی آرام و سالم ارائه
              می‌دهد. شعار ما: {BRAND.slogan}.
            </p>

            <p className="mt-4 font-sans text-sm leading-relaxed text-white/60">
              Salyco brings together modern sleep technology and premium
              craftsmanship — where every night rests on swan wings.
            </p>
          </div>

          {/* Quick links */}
          <div dir="rtl">
            <h3 className="font-persian text-lg font-bold text-white">
              دسترسی سریع
            </h3>
            <hr className="mt-3 w-12 border-t-2 border-white/25" />

            <ul className="mt-5 space-y-3">
              <li><a href="/catalog.pdf" download className="font-persian text-sm text-white/75 hover:text-white">دانلود کاتالوگ</a></li>
              {footerLinks.map(({ label, href }) => (
                <li key={label}>
                  {href.startsWith("/") && !isServerRoute(href) ? (
                    <Link
                      to={href}
                      className="font-persian text-sm text-white/75 transition-colors hover:text-white"
                    >
                      {label}
                    </Link>
                  ) : (
                    <a
                      href={href}
                      className="font-persian text-sm text-white/75 transition-colors hover:text-white"
                    >
                      {label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div id="contact" dir="rtl">
            <h3 className="font-persian text-lg font-bold text-white">
              تماس با ما
            </h3>
            <hr className="mt-3 w-12 border-t-2 border-white/25" />

            <ul className="mt-5 space-y-4">
              <li>
                <a
                  href={BRAND.phoneHref}
                  className="flex items-center gap-3 font-persian text-sm text-white/75 transition-colors hover:text-white"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5">
                    <Phone size={20} className="text-white" />
                  </span>
                  <span dir="ltr">{BRAND.phone}</span>
                </a>
              </li>
              <li>
                <a
                  href={`tel:${BRAND.mobile}`}
                  className="flex items-center gap-3 font-persian text-sm text-white/75 transition-colors hover:text-white"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5">
                    <Phone size={20} className="text-white" />
                  </span>
                  <bdi>{BRAND.mobile}</bdi>
                </a>
              </li>
              <li className="flex items-start gap-3 font-persian text-sm text-white/75">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5">
                  <MapPin size={20} className="text-white" />
                </span>
                {BRAND.address}
              </li>
              <li>
                <a
                  href={BRAND.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 font-persian text-sm text-white/75 transition-colors hover:text-white"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5">
                    <Globe size={20} className="text-white" />
                  </span>
                  <span dir="ltr">www.salyco.ir</span>
                </a>
              </li>
              <li>
                <a
                  href={BRAND.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="اینستاگرام سالیکو"
                  className="flex items-center gap-3 font-persian text-sm text-white/75 transition-colors hover:text-white"
                >
                  {/* lucide-react no longer ships brand glyphs, so the Instagram
                      link keeps the generic camera mark with a naming label. */}
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5">
                    <Camera size={20} className="text-white" />
                  </span>
                  <bdi>@salyco.ir</bdi>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 border-t border-white/15 pt-8">
          {/* Enamad trust seal. Three details are load-bearing for their
              automated check, so don't "clean them up":
                • referrerPolicy="origin" — Enamad reads the Referer header to
                  confirm the seal is served from salyco.ir. rel must stay
                  "noopener"; adding "noreferrer" strips the header and fails it.
                • the `code` attribute — read by Enamad's own validator script.
                • no loading="lazy" — a headless checker that never scrolls the
                  footer into view would not fetch the image.
              The white card is needed because the seal artwork assumes a light
              background and reads as a dark smudge on the blue footer. */}
          <div className="flex justify-center">
            <a
              href={`https://trustseal.enamad.ir/?id=${ENAMAD_ID}&Code=${ENAMAD_CODE}`}
              target="_blank"
              rel="noopener"
              referrerPolicy="origin"
              className="inline-flex items-center justify-center rounded-xl bg-white p-2 shadow-lg transition-transform "
            >
              <img
                src={`https://trustseal.enamad.ir/logo.aspx?id=${ENAMAD_ID}&Code=${ENAMAD_CODE}`}
                alt="نماد اعتماد الکترونیکی"
                referrerPolicy="origin"
                code={ENAMAD_CODE}
                className="h-24 w-auto cursor-pointer"
              />
            </a>
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="font-sans text-xs tracking-wide text-white/60">
              © {new Date().getFullYear()} Salyco. All rights reserved.
            </p>
            <p className="font-persian text-xs text-white/60" dir="rtl">
              طراحی و تولید توسط مهندس امیررضا سلامت
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
