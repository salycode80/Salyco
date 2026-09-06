import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  XCircle,
  Info,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { getPaymentStatus } from "../api/payments";
import { toPersianNumber } from "../utils/persian";
import PageBackground from "../components/PageBackground";

const CARD =
  "rounded-xl border border-[#CBD2D6] bg-white shadow-[0_1px_4px_rgba(0,48,135,0.06)]";

const SALES_PHONE = "09126847234";

// Keyed by the `status` the backend redirects with — settlement.py's outcome
// constants. Kept as data so a new outcome is one entry, not a new branch.
const OUTCOMES = {
  success: {
    icon: CheckCircle2,
    tone: "text-[#019C34]",
    title: "پرداخت شما با موفقیت انجام شد",
    body: "سفارش شما ثبت و تأیید شد. جزئیات سفارش از طریق پیامک برای شما ارسال می‌شود.",
  },
  cancelled: {
    icon: Info,
    tone: "text-[#687173]",
    title: "پرداخت لغو شد",
    body: "پرداخت توسط شما لغو شد. سبد خرید شما دست‌نخورده باقی مانده و می‌توانید دوباره تلاش کنید.",
  },
  failed: {
    icon: XCircle,
    tone: "text-[#D20000]",
    title: "پرداخت انجام نشد",
    body: "مبلغی از حساب شما کسر نشده است. می‌توانید دوباره تلاش کنید یا سفارش خود را تلفنی ثبت کنید.",
  },
  pending: {
    icon: Loader2,
    tone: "text-[#009CDE]",
    title: "پرداخت شما در حال بررسی است",
    body: "نتیجه پرداخت شما به‌زودی مشخص می‌شود. در صورت کسر مبلغ، سفارش شما به‌صورت خودکار تأیید خواهد شد.",
  },
  mismatch: {
    icon: XCircle,
    tone: "text-[#D20000]",
    title: "عدم تطابق مبلغ پرداخت",
    body: "مبلغ پرداخت‌شده با مبلغ سفارش مطابقت ندارد. لطفاً با پشتیبانی تماس بگیرید تا بررسی شود.",
  },
  notfound: {
    icon: XCircle,
    tone: "text-[#D20000]",
    title: "اطلاعات پرداخت یافت نشد",
    body: "این پرداخت در سیستم ما ثبت نشده است. اگر مبلغی از حساب شما کسر شده، با پشتیبانی تماس بگیرید.",
  },
};

export default function PaymentResult() {
  const [params] = useSearchParams();
  const outcomeKey = params.get("status") || "failed";
  const orderId = params.get("order");
  const refNumber = params.get("ref");
  const message = params.get("message");
  const trackId = params.get("trackId");

  const outcome = OUTCOMES[outcomeKey] || OUTCOMES.failed;
  const Icon = outcome.icon;

  // The query string is what the gateway redirected with; the database is the
  // authority. Re-read it when a trackId is present so a reloaded or shared URL
  // cannot show a stale — or hand-edited — result.
  const [confirmed, setConfirmed] = useState(null);
  useEffect(() => {
    if (!trackId) return;
    let alive = true;
    getPaymentStatus(trackId)
      .then((data) => alive && setConfirmed(data))
      .catch(() => {
        /* The redirect params are enough to render — this is corroboration. */
      });
    return () => {
      alive = false;
    };
  }, [trackId]);

  const shownRef = confirmed?.ref_number || refNumber;
  const shownOrderId = confirmed?.order_id || orderId;
  const shownMessage = confirmed?.failure_reason || message;

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#F5F7FA] pt-[var(--navbar-height)]">
      <PageBackground />
      <div className="relative mx-auto max-w-[560px] px-6 py-16" dir="rtl">
        <div className={`${CARD} flex flex-col items-center p-10 text-center`}>
          <Icon
            className={`h-16 w-16 ${outcome.tone} ${
              outcomeKey === "pending" ? "animate-spin" : ""
            }`}
          />
          <h1 className="mt-4 font-persian text-2xl font-bold text-[#1A1A2E]">
            {outcome.title}
          </h1>
          <p className="mt-2 font-persian text-sm leading-7 text-[#687173]">
            {outcome.body}
          </p>

          {shownMessage && outcomeKey !== "success" && (
            <p className="mt-4 w-full rounded-lg bg-[#FDE7E7] px-4 py-3 font-persian text-sm text-[#D20000]">
              {shownMessage}
            </p>
          )}

          {(shownOrderId || shownRef) && (
            <dl className="mt-6 w-full divide-y divide-[#CBD2D6] rounded-lg bg-[#F5F7FA] px-4 text-sm">
              {shownOrderId && (
                <div className="flex justify-between py-3">
                  <dt className="font-persian text-[#687173]">شماره سفارش</dt>
                  <dd className="font-persian font-bold text-[#1A1A2E]">
                    {toPersianNumber(shownOrderId)}
                  </dd>
                </div>
              )}
              {shownRef && (
                <div className="flex justify-between py-3">
                  <dt className="font-persian text-[#687173]">شماره پیگیری</dt>
                  <dd
                    className="font-persian font-bold text-[#1A1A2E] [font-feature-settings:'tnum']"
                    dir="ltr"
                  >
                    {shownRef}
                  </dd>
                </div>
              )}
            </dl>
          )}

          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
            {outcomeKey === "success" ? (
              <>
                <Link
                  to="/user-info"
                  className="flex-1 rounded-lg bg-[#003087] px-6 py-3 font-persian text-sm font-bold text-white transition hover:bg-[#00246B]"
                >
                  سفارش‌های من
                </Link>
                <Link
                  to="/products"
                  className="flex-1 rounded-lg border-2 border-[#003087] px-6 py-3 font-persian text-sm font-bold text-[#003087] transition hover:bg-[#003087] hover:text-white"
                >
                  ادامه خرید
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/cart"
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#003087] px-6 py-3 font-persian text-sm font-bold text-white transition hover:bg-[#00246B]"
                >
                  <ArrowRight size={16} />
                  بازگشت به سبد خرید
                </Link>
                <a
                  href={`tel:${SALES_PHONE}`}
                  dir="ltr"
                  className="flex-1 rounded-lg border-2 border-[#003087] px-6 py-3 font-persian text-sm font-bold text-[#003087] transition hover:bg-[#003087] hover:text-white"
                >
                  {SALES_PHONE}
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
