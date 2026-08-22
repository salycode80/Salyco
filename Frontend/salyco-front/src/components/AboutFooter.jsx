import { Link } from "react-router-dom";
import { Phone, Mail, MapPin } from "lucide-react";

// Enamad (نماد اعتماد الکترونیکی) seal credentials. Kept as constants so the
// query strings are built in JS — a raw "&Code=" inside a JSX attribute string
// reads as an HTML entity sequence and is easy to mangle on a later edit.
const ENAMAD_ID = "7415585";
const ENAMAD_CODE = "HpNAQ4zPLtAaN48QS9Usi0lwagPEszdC";

const footerLinks = [
  { label: "محصولات", href: "/products" },
  { label: "مقالات", href: "/articles" },
  { label: "تماس با ما", href: "/contact" },
  { label: "درباره ما", href: "/about" },
];

export default function AboutFooter() {
  return (
    <footer
      id="about"
      className="relative overflow-hidden bg-[#003087] border-t border-white/15"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(0,156,222,0.15),transparent_50%)]" />

      <div className="relative mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-8">
          {/* Brand & about */}
          <div dir="rtl">
            <Link to="/" className="inline-flex items-center gap-2">
              <span className="font-sans text-2xl font-bold tracking-[0.2em] text-white uppercase">
                <span className="text-[#009CDE]">S</span>ALYCO
              </span>
              <img
                src="/logo3.png"
                alt="Salyco logo"
                className="h-12 w-12 object-contain"
              />
            </Link>

            <h2 className="mt-6 font-persian text-2xl font-bold text-white">
              درباره سالیکو
            </h2>
            <hr className="mt-3 w-16 border-t-2 border-[#009CDE]/40" />

            <p className="mt-4 font-persian text-sm leading-relaxed text-white/75">
              سالیکو با بیش از دو دهه تجربه در تولید تشک و محصولات خواب، ترکیبی
              از فناوری مدرن و کیفیت ممتاز را برای خوابی آرام و سالم ارائه
              می‌دهد. شعار ما: آن جا که خواب بر بال‌های قو آرام می‌گیرد.
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
            <hr className="mt-3 w-12 border-t-2 border-[#009CDE]/40" />

            <ul className="mt-5 space-y-3">
              {footerLinks.map(({ label, href }) => (
                <li key={label}>
                  {href.startsWith("/") ? (
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
            <hr className="mt-3 w-12 border-t-2 border-[#009CDE]/40" />

            <ul className="mt-5 space-y-4">
              <li>
                <a
                  href="tel:+985142222687"
                  className="flex items-center gap-3 font-persian text-sm text-white/75 transition-colors hover:text-white"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5">
                    <Phone size={16} className="text-[#009CDE]" />
                  </span>
                  <span dir="ltr">051-42222687</span>
                </a>
              </li>
              <li>
                <a
                  href="mailto:info@salyco.com"
                  className="flex items-center gap-3 font-persian text-sm text-white/75 transition-colors hover:text-white"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5">
                    <Mail size={16} className="text-[#009CDE]" />
                  </span>
                  thisissalyco@gmail.com
                </a>
              </li>
              <li className="flex items-start gap-3 font-persian text-sm text-white/75">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5">
                  <MapPin size={16} className="text-[#009CDE]" />
                </span>
                خراسان رضوی، ایران
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
              className="inline-flex items-center justify-center rounded-xl bg-white p-2 shadow-lg transition-transform hover:scale-105"
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
