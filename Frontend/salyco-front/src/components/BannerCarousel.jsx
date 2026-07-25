import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getBanners } from "../api/banners";

export default function BannerCarousel() {
  const [banners, setBanners] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    async function loadBanners() {
      const data = await getBanners();
      setBanners(data);
    }
    loadBanners();
  }, []);

  useEffect(() => {
    if (!isAutoPlaying || banners.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, banners.length]);

  const goToSlide = (index) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const goToPrevious = () => {
    goToSlide(currentIndex === 0 ? banners.length - 1 : currentIndex - 1);
  };

  const goToNext = () => {
    goToSlide((currentIndex + 1) % banners.length);
  };

  if (banners.length === 0) return null;

  return (
    <section className="relative w-full py-6">
      <div className="relative mx-auto max-w-7xl px-[10vw]">
        {/* Announcement-style banner container */}
        <div
          className="relative overflow-hidden rounded-2xl border-4 border-[#003087]/20 bg-gradient-to-r from-[#003087] via-[#00246B] to-[#003087] shadow-2xl"
          style={{ minHeight: "300px" }}
        >
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            <svg
              className="h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <pattern
                id="pattern-circles"
                x="0"
                y="0"
                width="10"
                height="10"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="5" cy="5" r="1" fill="white" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#pattern-circles)" />
            </svg>
          </div>

          {/* Slides */}
          <div
            className="relative z-10 flex h-full transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {banners.map((banner) => (
              <div
                key={banner.id}
                className="relative flex h-[300px] w-full flex-shrink-0 items-center"
              >
                <Link
                  to={banner.link}
                  className="absolute inset-0 z-20 cursor-pointer"
                />

                {/* Left side - Image */}
                <div className="relative z-10 hidden w-1/2 md:block">
                  <img
                    src={banner.image_url || banner.image}
                    alt={banner.title}
                    className="h-full w-full object-cover pr-8"
                  />
                  {/* Decorative elements */}
                  <div className="absolute -right-4 -bottom-8 z-20 h-32 w-32 rounded-full bg-[#003087]/30 blur-2xl" />
                  <div className="absolute -left-8 -top-8 z-20 h-40 w-40 rounded-full bg-[#00246B]/30 blur-2xl" />
                </div>

                {/* Right side - Text Content */}
                <div className="relative z-10 flex flex-col items-start justify-center px-8 pb-8 pt-12 md:w-1/2 md:pl-12 lg:px-16 lg:py-16">
                  <span className="mb-4 inline-flex items-center rounded-full bg-[#003087]/20 px-4 py-1 text-sm font-semibold text-[#003087]">
                    🎉 پیشنهاد ویژه
                  </span>
                  <h2 className="mb-4 text-3xl font-bold leading-tight text-white md:text-4xl lg:text-5xl">
                    {banner.title}
                  </h2>
                  <Link
                    to={banner.link}
                    className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3 font-persian text-base font-semibold text-[#003087] transition-all hover:bg-[#f5f7ff] hover:shadow-lg"
                  >
                    ... ادامه
                    <ChevronLeft size={18} />
                  </Link>
                </div>

                {/* Mobile Image */}
                <div className="absolute bottom-0 right-0 z-10 h-1/3 w-1/2 md:hidden">
                  <img
                    src={banner.image_url || banner.image}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Navigation arrows - bold style */}
          {banners.length > 1 && (
            <>
              <button
                onClick={goToPrevious}
                className="absolute left-4 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#003087] shadow-xl backdrop-blur-sm transition-all hover:bg-white hover:scale-110 hover:shadow-2xl md:left-8"
                aria-label="اسلاید قبلی"
              >
                <ChevronRight size={24} strokeWidth={2.5} />
              </button>
              <button
                onClick={goToNext}
                className="absolute right-4 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#003087] shadow-xl backdrop-blur-sm transition-all hover:bg-white hover:scale-110 hover:shadow-2xl md:right-8"
                aria-label="aslاید بعدی"
              >
                <ChevronLeft size={24} strokeWidth={2.5} />
              </button>
            </>
          )}

          {/* Dots indicator - bold style */}
          {banners.length > 1 && (
            <div className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 gap-3">
              {banners.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === currentIndex
                      ? "w-8 bg-white"
                      : "w-1.5 bg-white/40 hover:bg-white/60"
                  }`}
                  aria-label={`رفتن به اسلاید ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
