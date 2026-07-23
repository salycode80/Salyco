import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Phone,
  Clock,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useCart } from "../../context/CartContext";
import { createOrder } from "../../api/orders";
import PageBackground from "../../components/PageBackground";

const CARD =
  "rounded-xl border border-[#CBD2D6] bg-white shadow-[0_1px_4px_rgba(0,48,135,0.06)]";

// Sales line + calling hours. Adjust to the real contact details as needed.
const SALES_PHONE = "۰۲۱–۹۱۰۰۰۰۰۰";
const CALL_HOURS = "شنبه تا چهارشنبه، ۹ صبح تا ۵ بعدازظهر (پنجشنبه تا ۱ بعدازظهر)";

export default function CheckoutPhone() {
  const { items, clear } = useCart();
  const navigate = useNavigate();
  const [status, setStatus] = useState("idle"); // idle | sending | success
  const [error, setError] = useState("");

  useEffect(() => {
    if (items.length === 0 && status !== "success") {
      navigate("/cart", { replace: true });
    }
  }, [items.length, status, navigate]);

  const handleConfirm = async () => {
    setError("");
    setStatus("sending");
    try {
      await createOrder({ method: "PHONE" });
      clear();
      setStatus("success");
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  };

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#F5F7FA] pt-[var(--navbar-height)]">
      <PageBackground />

      <div className="relative mx-auto max-w-[640px] px-6 py-8 sm:py-12" dir="rtl">
        {status !== "success" && (
          <Link
            to="/checkout"
            className="mb-8 inline-flex items-center gap-2 font-persian text-sm font-medium text-[#003087] transition-colors hover:text-[#009CDE]"
          >
            <ArrowRight size={16} />
            بازگشت
          </Link>
        )}

        {status === "success" ? (
          <div className={`${CARD} flex flex-col items-center p-10 text-center`}>
            <CheckCircle2 className="h-16 w-16 text-[#019C34]" />
            <h1 className="mt-4 font-persian text-2xl font-bold text-[#1A1A2E]">
              سفارش تلفنی شما ثبت شد
            </h1>
            <p className="mt-2 font-persian text-sm leading-7 text-[#687173]">
              درخواست شما ثبت شد. لطفاً در ساعات کاری با شماره زیر تماس بگیرید یا
              منتظر تماس کارشناسان ما بمانید.
            </p>
            <div className="mt-4 rounded-lg bg-[#F5F7FA] px-6 py-3 font-persian text-lg font-bold text-[#003087]">
              {SALES_PHONE}
            </div>
            <Link
              to="/products/mattress"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#003087] px-6 py-3 font-persian text-sm font-bold text-white transition hover:bg-[#00246B]"
            >
              ادامه خرید
            </Link>
          </div>
        ) : (
          <div className={`${CARD} p-8`}>
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#019C34]/10 text-[#019C34]">
                <Phone size={30} />
              </div>
              <h1 className="mt-4 font-persian text-2xl font-bold text-[#1A1A2E]">
                خرید تلفنی
              </h1>
              <p className="mt-2 font-persian text-sm leading-7 text-[#687173]">
                برای ثبت نهایی سفارش خود با کارشناسان فروش ما تماس بگیرید. با تأیید
                زیر، سفارش شما در سیستم ثبت شده و کارشناسان ما نیز می‌توانند با شما
                تماس بگیرند.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-4">
              <div className="flex items-center gap-3 rounded-lg border border-[#CBD2D6] bg-[#F5F7FA] px-4 py-3">
                <Phone size={20} className="shrink-0 text-[#003087]" />
                <div>
                  <p className="font-persian text-xs text-[#687173]">
                    شماره تماس فروش
                  </p>
                  <p className="font-persian text-lg font-bold text-[#003087]">
                    {SALES_PHONE}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-[#CBD2D6] bg-[#F5F7FA] px-4 py-3">
                <Clock size={20} className="shrink-0 text-[#003087]" />
                <div>
                  <p className="font-persian text-xs text-[#687173]">
                    ساعات پاسخگویی
                  </p>
                  <p className="font-persian text-sm font-medium text-[#1A1A2E]">
                    {CALL_HOURS}
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-lg bg-[#FDE7E7] px-4 py-3 font-persian text-sm text-[#D20000]">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleConfirm}
              disabled={status === "sending"}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#003087] px-8 py-3 font-persian text-sm font-bold text-white transition hover:bg-[#00246B] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "sending" ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  در حال ثبت...
                </>
              ) : (
                "ثبت سفارش تلفنی"
              )}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
