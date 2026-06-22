const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#F5F7FA]">
      {/* ── LEFT 2/3 — existing content ── */}
      <div className="relative z-10 flex flex-col items-start justify-center text-left px-6 pt-24 pb-16 w-full lg:w-1/2 min-h-screen">
        {/* Grid background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(100,160,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(100,160,255,0.06) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Square glow */}
        <div
          className="absolute top-0 left-0 w-1/2 h-full pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, rgba(0,50,180,0.35) 0%, transparent 100%)",
          }}
        />

        {/* Heading */}
        <h1 className="relative font-sans text-5xl md:text-6xl lg:text-[40px] font-bold text-[#000c3e] tracking-wide leading-tight mb-2">
          Where Sleep Rests On Swan Wings ...
        </h1>

        <hr className="border-t-2 border-[#000c3e] w-full mb-2" />

        <p
          className="font-persian text-xl lg:text-[40px] text-[#000c3e] tracking-wide w-full"
          style={{ direction: "rtl", textAlign: "right" }}
        >
          آن جا که خواب بر بال‌های قو آرام می‌گیرد ...
        </p>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-blue-200/30 text-[10px] tracking-widest uppercase animate-bounce">
          <div
            className="w-px h-7"
            style={{
              background:
                "linear-gradient(to bottom, rgba(100,160,255,0.4), transparent)",
            }}
          />
          Scroll
        </div>
      </div>

      {/* ── RIGHT 1/3 — image with left-fade overlay ── */}
      <div className="hidden lg:block absolute top-0 right-0 w-1/2 h-full">
        {/* Your image */}
        <img
          src="/matress.png"
          alt="Salyco sleep products"
          className="w-full h-full object-cover object-center"
        />

        {/* Fade from #F5F7FA on the left edge, to transparent on the right */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, #F5F7FA 0%, rgba(245,247,250,0.5) 30%, transparent 70%)",
          }}
        />
      </div>
    </section>
  );
};

export default Hero;
