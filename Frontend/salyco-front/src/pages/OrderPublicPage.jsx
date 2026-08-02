import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Package,
  Truck,
  Phone,
  MapPin,
  User,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { getPublicOrder, cancelPublicOrder } from "../api/orders";
import { toPersianNumber, formatPersianPrice } from "../utils/persian";
import PageBackground from "../components/PageBackground";

const faDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fa-IR");
  } catch {
    return iso;
  }
};

// Same palette as the admin OrdersPanel badges, so one order reads the same to
// staff and to the customer.
const STATUS_META = {
  PENDING: {
    label: "در انتظار تأیید",
    cls: "bg-[#FFF8E1] text-[#F5BA2E]",
    icon: Clock,
    note: "سفارش شما ثبت شده و در انتظار بررسی است.",
  },
  CONFIRMED: {
    label: "تأیید شده",
    cls: "bg-[#E6F0FB] text-[#003087]",
    icon: CheckCircle2,
    note: "سفارش شما تأیید شد و به‌زودی آمادهٔ ارسال می‌شود.",
  },
  SHIPPED: {
    label: "ارسال شده",
    cls: "bg-[#E6F4EA] text-[#019C34]",
    icon: Truck,
    note: "سفارش شما ارسال شده است.",
  },
  CANCELLED: {
    label: "لغو شده",
    cls: "bg-[#FDE7E7] text-[#D20000]",
    icon: XCircle,
    note: "این سفارش لغو شده است. در صورت نیاز با پشتیبانی تماس بگیرید.",
  },
};

// The lifecycle a customer is shown. CANCELLED is deliberately absent: it is a
// dead end rather than a stage, and rendering it as the last step of a track
// would imply every order ends there.
const TRACK = ["PENDING", "CONFIRMED", "SHIPPED"];

// Statuses the customer may still cancel from. Mirrors the guard in
// PublicOrderCancelView — the server is the authority, this only decides whether
// to offer a button that would be refused. Once SHIPPED the parcel is moving, so
// cancelling becomes a support conversation rather than a click.
const CANCELLABLE = ["PENDING", "CONFIRMED"];

const CARD =
  "rounded-xl border border-[#CBD2D6] bg-white shadow-[0_1px_4px_rgba(0,48,135,0.06)]";

function StatusTrack({ status }) {
  const currentIndex = TRACK.indexOf(status);
  if (currentIndex === -1) return null;

  return (
    <ol className="mt-6 flex items-center" dir="rtl">
      {TRACK.map((key, i) => {
        const meta = STATUS_META[key];
        const Icon = meta.icon;
        const done = i <= currentIndex;
        return (
          <li key={key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition ${
                  done
                    ? "border-[#003087] bg-[#003087] text-white"
                    : "border-[#CBD2D6] bg-white text-[#CBD2D6]"
                }`}
              >
                <Icon size={17} strokeWidth={2} />
              </span>
              <span
                className={`whitespace-nowrap font-persian text-[11px] ${
                  done ? "font-medium text-[#1A1A2E]" : "text-[#687173]"
                }`}
              >
                {meta.label}
              </span>
            </div>
            {i < TRACK.length - 1 && (
              <span
                className={`mx-1 mb-5 h-0.5 flex-1 rounded-full ${
                  i < currentIndex ? "bg-[#003087]" : "bg-[#CBD2D6]"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-2.5 py-2.5">
      <Icon size={16} className="mt-0.5 shrink-0 text-[#003087]" />
      <div className="min-w-0 flex-1">
        <p className="font-persian text-xs text-[#687173]">{label}</p>
        <p className="mt-0.5 font-persian text-sm text-[#1A1A2E]">{children}</p>
      </div>
    </div>
  );
}

/**
 * The page an order-confirmation SMS links to.
 *
 * Reached by capability token, not by login — see getPublicOrder() and
 * PublicOrderDetailView. The customer opens it on a phone that is usually not
 * signed in, so nothing here may assume an authenticated session.
 */
export default function OrderPublicPage() {
  const { token } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Cancellation is irreversible and reached by a link anyone could tap, so it
  // goes through a confirm step rather than firing on first click.
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPublicOrder(token)
      .then((data) => {
        if (!cancelled) setOrder(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleCancel() {
    setCancelling(true);
    setCancelError(null);
    try {
      // The response is the updated order, so the page re-renders from the
      // server's view of the status instead of a locally assumed one.
      const updated = await cancelPublicOrder(token);
      setOrder(updated);
      setConfirming(false);
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setCancelling(false);
    }
  }

  const meta = order ? STATUS_META[order.status] : null;
  const isPhone = order?.method === "PHONE";
  const canCancel = order ? CANCELLABLE.includes(order.status) : false;

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#F5F7FA] pt-[var(--navbar-height)]">
      <PageBackground />

      <div className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-10" dir="rtl">
          <p className="font-sans text-sm uppercase tracking-[0.3em] text-[#687173]">
            Order
          </p>
          <h1 className="mt-2 font-persian text-3xl font-bold text-[#003087] md:text-4xl">
            پیگیری سفارش
          </h1>
          <hr className="mt-4 w-24 border-t-2 border-[#003087]" />
        </header>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-[#003087]" />
            <p className="mt-4 font-persian text-sm text-[#687173]">
              در حال بارگذاری...
            </p>
          </div>
        )}

        {error && !loading && (
          <div className={`${CARD} p-8 text-center`}>
            <AlertTriangle
              size={48}
              className="mx-auto mb-4 text-[#D20000]"
              strokeWidth={1.5}
            />
            <h2
              className="font-persian text-xl font-semibold text-[#1A1A2E]"
              dir="rtl"
            >
              سفارش یافت نشد
            </h2>
            <p className="mt-2 font-persian text-sm text-[#687173]" dir="rtl">
              این لینک معتبر نیست یا منقضی شده است.
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex h-12 items-center gap-2 rounded-lg bg-[#003087] px-6 font-persian font-semibold text-white transition hover:bg-[#00246B]"
            >
              بازگشت به صفحهٔ اصلی
            </Link>
          </div>
        )}

        {!loading && !error && order && (
          <div className="flex flex-col gap-6" dir="rtl">
            {/* Status */}
            <div className={`${CARD} p-6`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-persian text-lg font-bold text-[#1A1A2E]">
                    سفارش #{toPersianNumber(order.id)}
                  </h2>
                  <p className="mt-1 font-persian text-xs text-[#687173]">
                    ثبت شده در {faDate(order.created_at)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1.5 font-persian text-xs font-medium ${meta?.cls}`}
                >
                  {meta?.label || order.status_display}
                </span>
              </div>

              {meta?.note && (
                <p className="mt-3 font-persian text-sm leading-7 text-[#687173]">
                  {meta.note}
                </p>
              )}

              <StatusTrack status={order.status} />
            </div>

            {/* Items */}
            <div className={`${CARD} p-6`}>
              <h3 className="mb-1 flex items-center gap-2 font-persian text-base font-semibold text-[#003087]">
                <Package size={18} />
                اقلام سفارش
              </h3>
              <div className="divide-y divide-[#CBD2D6]">
                {order.items?.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-persian text-sm font-medium text-[#1A1A2E]">
                        {it.mattress_name}
                      </p>
                      {it.size_label && (
                        <p className="mt-0.5 font-persian text-xs text-[#687173]">
                          سایز: {it.size_label}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-left">
                      <p className="font-persian text-sm text-[#1A1A2E] [font-feature-settings:'tnum']">
                        {formatPersianPrice(it.line_total)}
                      </p>
                      <p className="mt-0.5 font-persian text-xs text-[#687173]">
                        × {toPersianNumber(it.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t-2 border-[#003087] pt-4">
                <span className="font-persian font-bold text-[#1A1A2E]">
                  مبلغ کل
                </span>
                <span className="font-persian text-xl font-bold text-[#003087] [font-feature-settings:'tnum']">
                  {formatPersianPrice(order.total_amount)}
                  <span className="mr-1 text-xs font-normal text-[#687173]">
                    تومان
                  </span>
                </span>
              </div>
            </div>

            {/* Delivery */}
            <div className={`${CARD} divide-y divide-[#CBD2D6] p-6`}>
              <h3 className="mb-1 flex items-center gap-2 font-persian text-base font-semibold text-[#003087]">
                {isPhone ? <Phone size={18} /> : <Truck size={18} />}
                اطلاعات {isPhone ? "تماس" : "ارسال"}
              </h3>

              {order.recipient_name && (
                <Row icon={User} label="تحویل‌گیرنده">
                  {order.recipient_name}
                </Row>
              )}

              {order.phone_number && (
                <Row icon={Phone} label="شماره تماس">
                  <span dir="ltr">{order.phone_number}</span>
                </Row>
              )}

              {(order.province || order.city || order.address) && (
                <Row icon={MapPin} label="نشانی">
                  {[order.province, order.city, order.address]
                    .filter(Boolean)
                    .join("، ")}
                  {order.postal_code
                    ? ` — کد پستی ${toPersianNumber(order.postal_code)}`
                    : ""}
                </Row>
              )}
            </div>

            {/* Cancel */}
            {canCancel && (
              <div className={`${CARD} p-6`}>
                <h3 className="mb-1 flex items-center gap-2 font-persian text-base font-semibold text-[#D20000]">
                  <XCircle size={18} />
                  لغو سفارش
                </h3>

                {cancelError && (
                  <p
                    className="mt-3 rounded-lg bg-[#FDE7E7] px-4 py-3 font-persian text-sm leading-6 text-[#D20000]"
                    role="alert"
                  >
                    {cancelError}
                  </p>
                )}

                {!confirming ? (
                  <>
                    <p className="mt-2 font-persian text-sm leading-7 text-[#687173]">
                      اگر از خرید خود منصرف شده‌اید، می‌توانید سفارش را لغو کنید.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirming(true);
                        setCancelError(null);
                      }}
                      className="mt-4 inline-flex h-12 items-center gap-2 rounded-lg border-2 border-[#D20000] px-6 font-persian font-semibold text-[#D20000] transition hover:bg-[#FDE7E7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D20000]"
                    >
                      <XCircle size={18} />
                      لغو سفارش
                    </button>
                  </>
                ) : (
                  <>
                    <p className="mt-2 font-persian text-sm font-medium leading-7 text-[#1A1A2E]">
                      از لغو این سفارش مطمئن هستید؟ این کار قابل بازگشت نیست.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={cancelling}
                        className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#D20000] px-6 font-persian font-semibold text-white transition hover:bg-[#A80000] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D20000]"
                      >
                        {cancelling ? (
                          <>
                            <Loader2 size={18} className="animate-spin" />
                            در حال لغو...
                          </>
                        ) : (
                          <>
                            <XCircle size={18} />
                            بله، لغو کن
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(false)}
                        disabled={cancelling}
                        className="inline-flex h-12 items-center rounded-lg border border-[#CBD2D6] px-6 font-persian font-semibold text-[#1A1A2E] transition hover:bg-[#F5F7FA] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003087]"
                      >
                        انصراف
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            <p className="text-center font-persian text-xs leading-6 text-[#687173]">
              برای پیگیری یا تغییر سفارش با پشتیبانی تماس بگیرید.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
