import Hero from "../components/Hero";
import MobileHero from "../components/home/MobileHero";
import BrandSlogan from "../components/home/BrandSlogan";
import QuickActions from "../components/home/QuickActions";
import WarrantyBanner from "../components/home/WarrantyBanner";
import BannerCarousel from "../components/BannerCarousel";
import FeaturedProducts from "../components/FeaturedProducts";
import FeaturedArticles from "../components/FeaturedArticles";
import CategoriesSection from "../components/CategoriesSection";

/**
 * The home page in two compositions.
 *
 * Below lg the order is the phone brief's: photography, slogan, three quick
 * actions, warranty banner — and no text on the hero image at all. From lg up it
 * is the desktop hero and the sections it always had.
 *
 * lg is the seam because that is where App.jsx already swaps the chrome
 * (MobileTopBar and MobileTabBar below it, Navbar above), so the page and the
 * bars around it change over together. §13's narrower mobile breakpoint, 768,
 * would leave 768–1023 on the phone composition with desktop navigation.
 */
export default function Home() {
  return (
    <>
      <div className="lg:hidden">
        <MobileHero />
        <BrandSlogan />
        <QuickActions />
        <WarrantyBanner />
      </div>

      <Hero />
      <BannerCarousel />
      <FeaturedProducts />
      <FeaturedArticles />
      <CategoriesSection />
    </>
  );
}
