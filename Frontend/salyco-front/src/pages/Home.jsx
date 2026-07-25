import Hero from "../components/Hero";
import BannerCarousel from "../components/BannerCarousel";
import FeaturedProducts from "../components/FeaturedProducts";
import FeaturedArticles from "../components/FeaturedArticles";
import CategoriesSection from "../components/CategoriesSection";

export default function Home() {
  return (
    <>
      <Hero />
      <BannerCarousel />
      <FeaturedProducts />
      <FeaturedArticles />
      <CategoriesSection />
    </>
  );
}
