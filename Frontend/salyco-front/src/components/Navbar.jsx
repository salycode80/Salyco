import { Link, NavLink } from "react-router-dom";
import {
  Phone,
  Search,
  UserCircle,
  BedDouble,
  Wind,
  Layers,
  ShoppingBag,
  ShieldCheck,
  BookOpen,
  Image,
  Info,
} from "lucide-react";

const categories = [
  { label: "تشک",           icon: BedDouble,   to: "/products/mattress"   },
  { label: "بالشت",         icon: Wind,        to: "/products/pillow"     },
  { label: "روتختی",        icon: Layers,      to: "/products/bedcover"   },
  { label: "کالای خواب",    icon: ShoppingBag, to: "/products/sleepware"  },
  { label: "گارانتی",       icon: ShieldCheck, to: "/productregistration" },
  { label: "مقالات",        icon: BookOpen,    to: "/articles"            },
  { label: "گالری",         icon: Image,       to: "/gallery"             },
  { label: "درباره سالیکو", icon: Info,        to: "/about"               },
];

export default function Navbar() {
  return (
    <div className="fixed top-0 w-full z-50 h-[120px] shadow-lg">

      {/* ── TOP ROW ── dark navy */}
      <div
        className="bg-gradient-to-r from-[#000c2e] via-[#001a5c] to-[#00256b]"
        dir="rtl"
      >
        <div className="max-w-9xl mx-auto px-6 h-[80px] flex items-center gap-4">

          {/* Logo */}
          <Link to="/" className="flex-shrink-0 flex items-center">
            <img
              src="/navbar-logo2.png"
              alt="سالیکو"
              className="h-30 w-auto object-contain"
              style={{
                imageRendering: "-webkit-optimize-contrast",
                filter: "drop-shadow(0 0 1px rgba(255,255,255,0.08))",
              }}
            />
          </Link>

          {/* Search — square with slight rounding */}
          <div className="w-[420px] shrink-0" dir="ltr">
            <div className="relative w-full">
              <Search
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2
                           text-blue-400/70 pointer-events-none"
              />
              <input
                type="text"
                placeholder="جست و جو ..."
                dir="rtl"
                className="w-full pl-4 pr-9 py-[10px] rounded-lg text-sm
                           bg-white/8 border border-blue-400/25 text-blue-100
                           placeholder-blue-400/50
                           focus:outline-none focus:border-blue-400/60
                           focus:bg-white/12 transition-all"
              />
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* تماس با ما + Login */}
          <div className="flex items-center gap-4 flex-shrink-0" dir="rtl">
            <a
              href="#contact"
              className="flex items-center gap-1.5 text-sm font-medium
                         text-blue-200/80 hover:text-white tracking-wide transition-colors"
            >
              <Phone size={15} className="text-blue-300" />
              <span>تماس با ما</span>
            </a>
            <div className="h-5 w-px bg-blue-400/25" />
            <a
              href="/login"
              className="flex items-center gap-1.5 text-sm font-medium
                         text-blue-200/80 hover:text-white tracking-wide transition-colors"
            >
              <UserCircle size={18} className="text-blue-300" />
              <span>ورود / ثبت‌نام</span>
            </a>
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW ── white background, navy text */}
      <nav
        dir="rtl"
        className="bg-white border-t border-blue-100 shadow-sm
                   max-w-full h-[40px]
                   flex items-center justify-start
                   overflow-x-auto scrollbar-none px-16 gap-0.5"
      >
        {categories.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-1.5 rounded-md
               text-sm font-semibold tracking-wide whitespace-nowrap
               transition-all duration-200
               ${
                 isActive
                   ? "bg-blue-50 text-[#2563eb]"
                   : "text-[#000c3e] hover:text-[#2563eb] hover:bg-blue-50"
               }`
            }
          >
            <Icon size={15} strokeWidth={2} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

    </div>
  );
}