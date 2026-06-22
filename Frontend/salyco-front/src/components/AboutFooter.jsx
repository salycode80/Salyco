import { Link } from "react-router-dom";
import { Phone, Mail, MapPin } from "lucide-react";

const footerLinks = [
  { label: "محصولات", href: "/gallery" },
  { label: "گالری", href: "/gallery" },
  { label: "مقالات", href: "#" },
  { label: "تماس با ما", href: "#contact" },
];

export default function AboutFooter() {
  return (
    <footer
      id="about"
      className="relative overflow-hidden bg-gradient-to-r from-[#000c2e] via-[#001a5c] to-[#00256b] border-t border-blue-400/20"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(100,160,255,0.12),transparent_50%)]" />

      <div className="relative mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-8">
          {/* Brand & about */}
          <div dir="rtl">
            <Link to="/" className="inline-flex items-center gap-2">
              <span className="font-sans text-2xl font-bold tracking-[0.2em] text-blue-50 uppercase">
                <span className="text-blue-300">S</span>ALYCO
              </span>
              <img
                src="/logo3.png"
                alt="Salyco logo"
                className="h-12 w-12 object-contain"
              />
            </Link>

            <h2 className="mt-6 font-persian text-2xl font-bold text-blue-50">
              درباره سالیکو
            </h2>
            <hr className="mt-3 w-16 border-t-2 border-blue-400/40" />

            <p className="mt-4 font-persian text-sm leading-relaxed text-blue-200/75">
              سالیکو با بیش از دو دهه تجربه در تولید تشک و محصولات خواب،
              ترکیبی از فناوری مدرن و کیفیت ممتاز را برای خوابی آرام و
              سالم ارائه می‌دهد. شعار ما: آن جا که خواب بر بال‌های قو آرام
              می‌گیرد.
            </p>

            <p className="mt-4 font-sans text-sm leading-relaxed text-blue-200/60">
              Salyco brings together modern sleep technology and premium
              craftsmanship — where every night rests on swan wings.
            </p>
          </div>

          {/* Quick links */}
          <div dir="rtl">
            <h3 className="font-persian text-lg font-bold text-blue-50">
              دسترسی سریع
            </h3>
            <hr className="mt-3 w-12 border-t-2 border-blue-400/40" />

            <ul className="mt-5 space-y-3">
              {footerLinks.map(({ label, href }) => (
                <li key={label}>
                  {href.startsWith("/") ? (
                    <Link
                      to={href}
                      className="font-persian text-sm text-blue-200/75 transition-colors hover:text-white"
                    >
                      {label}
                    </Link>
                  ) : (
                    <a
                      href={href}
                      className="font-persian text-sm text-blue-200/75 transition-colors hover:text-white"
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
            <h3 className="font-persian text-lg font-bold text-blue-50">
              تماس با ما
            </h3>
            <hr className="mt-3 w-12 border-t-2 border-blue-400/40" />

            <ul className="mt-5 space-y-4">
              <li>
                <a
                  href="tel:+982112345678"
                  className="flex items-center gap-3 font-persian text-sm text-blue-200/75 transition-colors hover:text-white"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-400/20 bg-white/5">
                    <Phone size={16} className="text-blue-300" />
                  </span>
                  ۰۲۱-۱۲۳۴۵۶۷۸
                </a>
              </li>
              <li>
                <a
                  href="mailto:info@salyco.com"
                  className="flex items-center gap-3 font-persian text-sm text-blue-200/75 transition-colors hover:text-white"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-400/20 bg-white/5">
                    <Mail size={16} className="text-blue-300" />
                  </span>
                  info@salyco.com
                </a>
              </li>
              <li className="flex items-start gap-3 font-persian text-sm text-blue-200/75">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-400/20 bg-white/5">
                  <MapPin size={16} className="text-blue-300" />
                </span>
                تهران، ایران
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-blue-400/20 pt-8 sm:flex-row">
          <p className="font-sans text-xs tracking-wide text-blue-400/60">
            © {new Date().getFullYear()} Salyco. All rights reserved.
          </p>
          <p
            className="font-persian text-xs text-blue-400/60"
            dir="rtl"
          >
            طراحی و تولید با عشق برای خواب بهتر
          </p>
        </div>
      </div>
    </footer>
  );
}
