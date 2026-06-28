const Hero = () => {
  return (
    <section className="relative h-screen overflow-hidden">

      {/* Hero image */}
      <img
        src="/banner2.png"
        alt="Salyco Mattress"
        className="absolute inset-0 w-full h-full object-cover object-contain"
      />

      {/* Blue overlay */}
      <div className="absolute inset-0 bg-[#0A2A6B]/20" />

      {/* Soft vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, transparent 30%, rgba(0,0,0,.35) 100%)",
        }}
      />

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 w-full h-40"
        style={{
          background:
            "linear-gradient(to top, #F5F7FA, transparent)",
        }}
      />

      {/* Optional centered content */}
      <div className="relative z-10 flex h-full items-center justify-center">
        {/* Logo or slogan */}
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white animate-bounce">
        ↓
      </div>

    </section>
  );
};

export default Hero;