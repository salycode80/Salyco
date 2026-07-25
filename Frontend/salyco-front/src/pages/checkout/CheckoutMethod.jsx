import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Truck, Phone, ArrowRight, ShoppingCart } from "lucide-react";
import { useCart } from "../../context/CartContext";
import PageBackground from "../../components/PageBackground";

const CARD =
  "rounded-xl border border-[#CBD2D6] bg-white shadow-[0_1px_4px_rgba(0,48,135,0.06)]";

export default function CheckoutMethod() {
  const { items } = useCart();
  const navigate = useNavigate();

  // Nothing to check out — bounce back to the cart.
  useEffect(() => {
    if (items.length === 0) navigate("/cart", { replace: true });
  }, [items.length, navigate]);

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#F5F7FA] pt-[var(--navbar-height)]">
      <PageBackground />

      <div
        className="relative mx-auto max-w-[720px] px-6 py-8 sm:py-12"
        dir="rtl"
      >
        <Link
          to="/cart"
          className="mb-8 inline-flex items-center gap-2 font-persian text-sm font-medium text-[#003087] transition-colors hover:text-[#009CDE]"
        >
          <ArrowRight size={16} />
          بازگشت به سبد خرید
        </Link>

        <h1 className="mb-2 font-persian text-2xl font-bold text-[#1A1A2E] md:text-3xl">
          روش سفارش را انتخاب کنید
        </h1>
        <p className="mb-8 font-persian text-sm text-[#687173]">
          سفارش خود را به صورت آنلاین ثبت کنید یا از طریق تماس تلفنی اقدام
          نمایید.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Online - Disabled */}
          <div className="relative cursor-not-allowed">
            <div
              className={`${CARD} flex flex-col items-center p-8 text-center grayscale opacity-60`}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#003087]/10 text-[#003087]">
                <Truck size={30} />
              </div>
              <h2 className="mt-4 font-persian text-lg font-bold text-[#1A1A2E]">
                خرید آنلاین
              </h2>
              <p className="mt-2 font-persian text-sm text-[#687173]">
                وارد کردن آدرس و اطلاعات ارسال و ثبت نهایی سفارش
              </p>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-lg bg-amber-700/90 px-4 py-2 font-persian text-sm font-bold text-white shadow-lg backdrop-blur-sm">
                در حال حاضر فروش آنلاین در دسترس نیست
              </span>
            </div>
          </div>

          {/* Phone */}
          <Link
            to="/checkout/phone"
            className={`${CARD} group flex flex-col items-center p-8 text-center transition-all hover:-translate-y-1 hover:border-[#003087] hover:shadow-[0_4px_16px_rgba(0,48,135,0.1)]`}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#019C34]/10 text-[#019C34] transition-colors group-hover:bg-[#019C34] group-hover:text-white">
              <Phone size={28} />
            </div>
            <h2 className="mt-4 font-persian text-lg font-bold text-[#1A1A2E]">
              خرید تلفنی
            </h2>
            <p className="mt-2 font-persian text-sm text-[#687173]">
              ثبت سفارش و هماهنگی از طریق تماس با کارشناسان فروش
            </p>
          </Link>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 font-persian text-sm text-[#687173]">
          <ShoppingCart size={16} />
          سبد خرید شما تا زمان ثبت سفارش محفوظ می‌ماند.
        </div>
      </div>
    </section>
  );
}
