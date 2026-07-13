import Hero from "../components/Hero";
import FeaturedProducts from "../components/FeaturedProducts";
import FeaturedArticles from "../components/FeaturedArticles";
import CategoriesSection from "../components/CategoriesSection";

export default function Home() {
  return (
    <>
      <Hero />
      <FeaturedProducts />
      <FeaturedArticles />
      <CategoriesSection />
    </>
  );
}
