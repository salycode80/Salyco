import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Truck,
  Loader2,
  CheckCircle2,
  MapPin,
} from "lucide-react";
import { useCart } from "../../context/CartContext";
import { createOrder } from "../../api/orders";
import { IRAN_PROVINCES } from "../../constants/provinces";
import { toPersianNumber, formatPersianPrice } from "../../utils/persian";
import PageBackground from "../../components/PageBackground";

const CARD =
  "rounded-xl border border-[#CBD2D6] bg-white shadow-[0_1px_4px_rgba(0,48,135,0.06)]";

const inputBase =
  "w-full rounded-lg border border-[#CBD2D6] bg-white px-4 py-3 font-persian text-sm text-[#1A1A2E] placeholder-[#687173] transition focus:border-[#009CDE] focus:outline-none focus:ring-2 focus:ring-[#009CDE]/20";

export default function CheckoutShipping() {
  const { items, count, total, clear } = useCart();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    recipient_name: "",
    phone_number: "",
    province: "",
    city: "",
    postal_code: "",
    address: "",
  });
  const [status, setStatus] = useState("idle"); // idle | sending | success
  const [error, setError] = useState("");

  // No items — go back to the cart (unless we just placed the order).
  useEffect(() => {
    if (items.length === 0 && status !== "success") {
      navigate("/cart", { replace: true });
    }
  }, [items.length, status, navigate]);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.province) {
      setError("لطفاً استان را انتخاب کنید.");
      return;
    }
    setStatus("sending");
    try {
      await createOrder({ method: "ONLINE", ...form });
      clear();
      setStatus("success");
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  };

  if (status === "success") {
    return (
      <section className="relative min-h-screen overflow-hidden bg-[#F5F7FA] pt-[var(--navbar-height)]">
        <PageBackground />
        <div className="relative mx-auto max-w-[560px] px-6 py-16" dir="rtl">
          <div className={`${CARD} flex flex-col items-center p-10 text-center`}>
            <CheckCircle2 className="h-16 w-16 text-[#019C34]" />
            <h1 className="mt-4 font-persian text-2xl font-bold text-[#1A1A2E]">
              سفارش شما ثبت شد
            </h1>
            <p className="mt-2 font-persian text-sm leading-7 text-[#687173]">
              سفارش شما با موفقیت ثبت شد. کارشناسان ما جهت هماهنگی ارسال با شما
              تماس خواهند گرفت.
            </p>
            <Link
              to="/products/mattress"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#003087] px-6 py-3 font-persian text-sm font-bold text-white transition hover:bg-[#00246B]"
            >
              ادامه خرید
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#F5F7FA] pt-[var(--navbar-height)]">
      <PageBackground />

      <div className="relative mx-auto max-w-[1120px] px-6 py-8 sm:py-10" dir="rtl">
        <Link
          to="/checkout"
          className="mb-8 inline-flex items-center gap-2 font-persian text-sm font-medium text-[#003087] transition-colors hover:text-[#009CDE]"
        >
          <ArrowRight size={16} />
          بازگشت
        </Link>

        <h1 className="mb-8 flex items-center gap-3 font-persian text-2xl font-bold text-[#1A1A2E] md:text-3xl">
          <Truck size={26} className="text-[#003087]" />
          اطلاعات ارسال
        </h1>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className={`${CARD} flex flex-col gap-5 p-6 lg:col-span-2`}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block font-persian text-sm font-medium text-[#1A1A2E]">
                  نام تحویل‌گیرنده
                </label>
                <input
                  name="recipient_name"
                  value={form.recipient_name}
                  onChange={handleChange}
                  required
                  placeholder="نام و نام خانوادگی"
                  className={inputBase}
                />
              </div>
              <div>
                <label className="mb-1.5 block font-persian text-sm font-medium text-[#1A1A2E]">
                  شماره تماس
                </label>
                <input
                  name="phone_number"
                  value={form.phone_number}
                  onChange={handleChange}
                  required
                  inputMode="tel"
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  className={inputBase}
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block font-persian text-sm font-medium text-[#1A1A2E]">
                  استان
                </label>
                <select
                  name="province"
                  value={form.province}
                  onChange={handleChange}
                  required
                  className={inputBase}
                >
                  <option value="">انتخاب استان</option>
                  {IRAN_PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block font-persian text-sm font-medium text-[#1A1A2E]">
                  شهر
                </label>
                <input
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  required
                  placeholder="نام شهر"
                  className={inputBase}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block font-persian text-sm font-medium text-[#1A1A2E]">
                کد پستی
              </label>
              <input
                name="postal_code"
                value={form.postal_code}
                onChange={handleChange}
                required
                inputMode="numeric"
                placeholder="کد پستی ۱۰ رقمی"
                className={inputBase}
              />
            </div>

            <div>
              <label className="mb-1.5 block font-persian text-sm font-medium text-[#1A1A2E]">
                نشانی کامل
              </label>
              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                required
                rows={3}
                placeholder="خیابان، کوچه، پلاک، واحد..."
                className={`${inputBase} resize-none`}
              />
            </div>

            {error && (
              <p className="flex items-start gap-2 rounded-lg bg-[#FDE7E7] px-4 py-3 font-persian text-sm text-[#D20000]">
                <MapPin size={16} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              className="inline-flex w-fit items-center justify-center gap-2 rounded-lg bg-[#003087] px-8 py-3 font-persian text-sm font-bold text-white transition hover:bg-[#00246B] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "sending" ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  در حال ثبت...
                </>
              ) : (
                "ثبت نهایی سفارش"
              )}
            </button>
          </form>

          {/* Invoice summary */}
          <div className="lg:col-span-1">
            <div className={`${CARD} sticky top-24 p-6`}>
              <h2 className="mb-4 font-persian text-lg font-semibold text-[#003087]">
                خلاصه سفارش
              </h2>
              <div className="flex flex-col gap-3 border-b border-[#CBD2D6] pb-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between gap-2 text-sm"
                  >
                    <span className="min-w-0 truncate text-[#1A1A2E]">
                      {item.mattress_name}
                      <span className="text-[#687173]">
                        {" "}
                        × {toPersianNumber(item.quantity)}
                      </span>
                    </span>
                    <span className="shrink-0 text-[#687173] [font-feature-settings:'tnum']">
                      {formatPersianPrice(item.line_total)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between py-4">
                <span className="font-persian font-bold text-[#1A1A2E]">
                  مبلغ قابل پرداخت
                </span>
                <span className="font-persian text-xl font-bold text-[#003087] [font-feature-settings:'tnum']">
                  {formatPersianPrice(total)}
                  <span className="mr-1 text-xs font-normal text-[#687173]">
                    تومان
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
