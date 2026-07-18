import { useEffect, useState } from "react";
import api from "../api";
import MattressCard from "../components/product/MattressCard";
import PageBackground from "../components/PageBackground";

export default function Gallery() {
  const [mattresses, setMattresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get("/api/mattress/")
      .then((res) => setMattresses(res.data))
      .catch(() => setError("بارگذاری محصولات با خطا مواجه شد."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#F5F7FA] pt-[var(--navbar-height)]">
      <PageBackground />

      <div className="relative mx-auto max-w-[1120px] px-6 py-10 sm:py-16">
        <header className="mb-12" dir="rtl">
          <p className="font-sans text-sm uppercase tracking-[0.3em] text-[#687173]">
            Gallery
          </p>
          <h1 className="mt-2 font-persian text-4xl font-bold text-[#1A1A2E] md:text-5xl">
            تشک های سالیکو
          </h1>
          <hr className="mt-4 w-24 border-t-2 border-[#003087]" />
          {/* <p className="mt-4 max-w-xl font-sans text-base text-[#000c3e]/60">
            مجموعه محصولات ما را کاوش کنید
          </p> */}
        </header>

        {loading && (
          <p className="font-persian text-center text-[#687173]">
            در حال بارگذاری...
          </p>
        )}

        {error && (
          <p className="font-persian text-center text-[#D20000]">{error}</p>
        )}

        {!loading && !error && mattresses.length === 0 && (
          <p className="font-persian text-center text-[#687173]">
            محصولی یافت نشد.
          </p>
        )}

        {!loading && mattresses.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">
            {mattresses.map((mattress) => (
              <MattressCard key={mattress.slug} mattress={mattress} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
