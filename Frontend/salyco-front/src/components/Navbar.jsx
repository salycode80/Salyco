import { Link, NavLink } from "react-router-dom";
import { Phone, Search } from "lucide-react";

const navLinkClass = ({ isActive }) =>
  `text-sm font-medium tracking-wide transition-colors ${
    isActive
      ? "text-white"
      : "text-blue-200/80 hover:text-white"
  }`;

export default function Navbar() {
  return (
    <div className="fixed top-0 w-full z-50 h-[72px] bg-gradient-to-r from-[#000c2e] via-[#001a5c] to-[#00256b] border-b border-blue-400/20 backdrop-blur-sm">
      <div
        dir="rtl"
        className="max-w-9xl mx-auto px-6 h-full flex items-center justify-between"
      >
        {/* RIGHT GROUP: Logo + Nav links together */}
        <div className="flex items-center gap-8">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2">
            <span className="font-sans text-2xl font-bold tracking-[0.2em] text-blue-50 uppercase">
              <span className="text-blue-300">S</span>ALYCO
            </span>
            <img
              src="/logo3.png"
              alt="Salyco logo"
              className="w-14 h-14 object-contain"
            />
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#contact"
              className="text-sm font-medium text-blue-200/80 hover:text-white tracking-wide transition-colors"
            >
              محصولات
            </a>
            <NavLink
              to="/productregistration"
              className="text-sm font-medium text-blue-200/80 hover:text-white tracking-wide transition-colors"
            >
              گارانتی   
            </NavLink>
            <NavLink
              to="/articles"
              className="text-sm font-medium text-blue-200/80 hover:text-white tracking-wide transition-colors"
            >
              مقالات
            </NavLink>
            
            <NavLink
              to="/gallery"
              className="text-sm font-medium text-blue-200/80 hover:text-white tracking-wide transition-colors"
            >
                گالری    
            </NavLink>
            <a
              href="#about"
              className="text-sm font-medium text-blue-200/80 hover:text-white tracking-wide transition-colors"
            >
              درباره سالیکو
            </a>

 
          </nav>
        </div>

        {/* LEFT GROUP: Contact + Search */}
        <div className="flex items-center gap-4">
          <a
            href="#"
            className="flex items-center gap-1.5 text-sm font-medium text-blue-200/80 hover:text-white tracking-wide transition-colors"
          >
            <Phone size={16} className="text-blue-300" />
            <span>تماس با ما </span>
          </a>
          <div className="h-5 w-px bg-blue-400/30" />
          <div className="relative flex items-center" dir="ltr">
            <Search
              size={15}
              className="absolute left-3 text-blue-400/70 pointer-events-none"
            />
            <input
              type="text"
              placeholder=" ... جست و جو"
              className="pl-9 pr-4 py-1.5 rounded-full text-sm bg-white/5 border border-blue-400/20 text-blue-100 placeholder-blue-400/50 focus:outline-none focus:border-blue-400/50 focus:bg-white/10 transition-all w-48"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
