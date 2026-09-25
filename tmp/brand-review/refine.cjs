const fs = require('fs');
const root = 'Frontend/salyco-front/';
function edit(file,fn){const p=root+file;fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')));}
edit('src/index.css',s=>s.replace(/  \/\* Warm wheat[\s\S]*?--color-text-secondary: #526171;/,`  /* Shared web tokens from Design.md v2. */
  --color-brand-navy: #052e5f;
  --color-brand-white: #ffffff;
  --color-brand-warm-white: #f7f5f0;
  --color-brand-mist: #e4e5e2;
  --color-action-hover: #032247;
  --color-text-primary: #1c2b3a;
  --color-text-secondary: #526171;
  --color-border-control: #788594;
  --color-status-success: #21633e;
  --color-status-success-bg: #eef7f0;
  --color-status-warning: #81520b;
  --color-status-warning-bg: #fff5e5;
  --color-status-error: #a52a32;
  --color-status-error-bg: #fff0f1;
  --color-status-info: #052e5f;
  --color-status-info-bg: #eef3f8;`).replace('line-height: 1.75;','line-height: 1.875;\n  color: var(--color-text-primary);\n  background: var(--color-brand-white);').replace('#003087','var(--color-brand-navy)')+`
/* Shared control geometry. Utilities can opt into compact icon controls. */
@layer base {
  button, input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), select {
    min-height: 3rem;
  }
  input:not([type="checkbox"]):not([type="radio"]), textarea, select {
    border-color: var(--color-border-control);
    border-radius: .5rem;
  }
  button { font-size: 1rem; font-weight: 600; }
  :lang(fa) { letter-spacing: 0; }
}
footer :focus-visible, .bg-brand-navy :focus-visible { outline-color: white; }
`);
fs.writeFileSync(root+'src/components/PageBackground.jsx',`/** Quiet surface behind forms and specifications, per Design.md v2. */
export default function PageBackground() {
  return <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-brand-warm-white" />;
}
`);
for(const [file,from] of [['src/pages/PaymentResult.jsx','../'],['src/pages/checkout/CheckoutOrder.jsx','../../']]) edit(file,s=>'import { BRAND } from "'+from+'config/brand";\n'+s.replace('const SALES_PHONE = "09126847234";','const SALES_PHONE = BRAND.mobile;'));
edit('src/pages/Contact.jsx',s=>'import { BRAND } from "../config/brand";\n'+s.replace(/const CONTACT = \{[\s\S]*?\};/,`const CONTACT = {
  phone: BRAND.mobile,
  phoneRaw: BRAND.mobile,
  email: "thisissalyco@gmail.com",
};`).replace('mt-0.5 truncate','mt-0.5 break-words').replace('{value}','<bdi>{value}</bdi>').replace('icon={Mail}\n                label="ایمیل"\n                value={CONTACT.email}\n                href={`mailto:${CONTACT.email}`}','icon={Phone}\n                label="تلفن نمایندگی"\n                value={BRAND.phone}\n                href={`tel:${BRAND.phone}`}').replace('  Mail,\n','').replace('            </div>\n          </div>\n\n          {/* ── RIGHT',`            </div>
            <InfoCard icon={MapPin} label="نمایندگی فروش سالیکو" value={BRAND.address} />
            <a href={BRAND.instagram} className="text-brand-navy underline" dir="ltr">Instagram: @salyco.ir</a>
          </div>

          {/* ── RIGHT`).replace(/<label className=/g,'<label className='));
edit('src/components/AboutFooter.jsx',s=>'import { BRAND } from "../config/brand";\n'+s.replace('Phone, Mail, MapPin','Phone, Instagram, MapPin').replace(/\s*<span className="font-sans text-2xl[\s\S]*?<\/span>\s*<img/,'\n              <img').replace('href="tel:+985142222687"','href={`tel:${BRAND.phone}`}').replace('051-42222687','{BRAND.phone}').replace('href="mailto:info@salyco.com"','href={`tel:${BRAND.mobile}`}').replace('<Mail size={16}','<Phone size={16}').replace('thisissalyco@gmail.com','<bdi>{BRAND.mobile}</bdi>').replace('خراسان رضوی، ایران','{BRAND.address}').replace('آن جا که خواب بر بال‌های قو آرام می‌گیرد.','{BRAND.slogan}.').replace(/<Phone size=\{16\} className="text-brand-navy"/g,'<Phone size={20} className="text-white"').replace('<MapPin size={16} className="text-brand-navy"','<MapPin size={20} className="text-white"').replace('            </ul>\n          </div>\n        </div>',`              <li><a href={BRAND.instagram} className="flex items-center gap-3 text-white/90"><Instagram size={20} /><bdi>@salyco.ir</bdi></a></li>
            </ul>
          </div>
        </div>`).replace('{ label: "مقالات", href: "/articles" },','{ label: "راهنمای انتخاب تشک", href: "/articles" },\n  { label: "خدمات پس از فروش", href: "/warranty/my" },'));
edit('src/pages/About.jsx',s=>s.replace('  { value: 50, suffix: "K+", label: "خواب آرام" },\n','').replace('استفاده از بهترین مواد اولیه و استانداردهای جهانی در تولید هر تشک.','دقت در انتخاب مواد اولیه، دوخت و جزئیات ساخت هر تشک.').replace('فوم‌های ضدحساسیت و پارچه‌های تنفس‌پذیر برای خوابی سالم و بهداشتی.','آشنایی با جنس پارچه و لایه‌های هر مدل برای انتخابی آگاهانه.').replace('مواد سالم','شناخت مواد').replace('تا ۱۲۰ ماه ضمانت واقعی، چون به دوام محصولاتمان ایمان داریم.','مدت و شرایط ضمانت هر مدل را در مشخصات محصول و سامانهٔ خدمات بررسی کنید.').replace('آنجا که خواب بر بال‌های قو آرام می‌گیرد','آنجا که خواب بر بال قو آرام میگیرد').replaceAll('text-status-warning','text-white').replace('md:text-6xl','md:text-4xl'));
