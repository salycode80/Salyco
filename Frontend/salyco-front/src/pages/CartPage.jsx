import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Trash2,
  Plus,
  Minus,
  ArrowLeft,
  Package,
  TicketPercent,
  X,
  Loader2,
} from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../hooks/UseAuth";
import { getProductImageUrl } from "../utils/productImage";
import { toPersianNumber, formatPersianPrice } from "../utils/persian";
import { productUrl } from "../config/productCategories";
import PageBackground from "../components/PageBackground";

const CARD =
  "rounded-xl border border-brand-mist bg-white shadow-[0_1px_4px_rgba(5,46,95,0.06)]";

// A single cart line rendered as an order card.
function OrderCard({ item, onQty, onRemove }) {
  // Cart lines carry the product's category (mattress_category from the server
  // serializer, or the local-cart mirror), so a pillow links to its own page.
  const href = productUrl({
    category: item.mattress_category,
    slug: item.mattress_slug,
  });

  return (
    <div className={`${CARD} flex gap-4 p-4`}>
      <Link
        to={href}
        className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-brand-mist bg-brand-warm-white"
      >
        <img
          src={getProductImageUrl(item.mattress_image)}
          alt={item.mattress_name}
          onError={(e) => {
            e.currentTarget.src = "/matress.png";
          }}
          className="h-full w-full object-contain"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={href}
            className="font-persian text-base font-semibold text-brand-navy hover:text-brand-navy"
          >
            {item.mattress_name}
          </Link>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label="حذف"
            className="shrink-0 rounded-lg p-1.5 text-status-error transition hover:bg-status-error-bg"
          >
            <Trash2 size={18} />
          </button>
        </div>

        {item.size_label && (
          <span className="mt-0.5 text-xs text-text-secondary">
            سایز: {item.size_label}
          </span>
        )}

        <div className="mt-auto flex items-center justify-between pt-3">
          {/* Quantity stepper */}
          <div className="flex items-center rounded-lg border border-brand-mist">
            <button
              type="button"
              onClick={() => onQty(item, item.quantity - 1)}
              aria-label="کاهش"
              className="flex h-8 w-8 items-center justify-center text-brand-navy transition hover:bg-brand-warm-white"
            >
              <Minus size={15} />
            </button>
            <span className="min-w-[2rem] text-center font-persian text-sm font-medium text-text-primary [font-feature-settings:'tnum']">
              {toPersianNumber(item.quantity)}
            </span>
            <button
              type="button"
              onClick={() => onQty(item, item.quantity + 1)}
              aria-label="افزایش"
              className="flex h-8 w-8 items-center justify-center text-brand-navy transition hover:bg-brand-warm-white"
            >
              <Plus size={15} />
            </button>
          </div>

          <span className="font-persian text-base font-bold text-brand-navy [font-feature-settings:'tnum']">
            {formatPersianPrice(item.line_total)}
            <span className="mr-1 text-xs font-normal text-text-secondary">تومان</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/* The code input, its applied state, and the error the server sent back.
   Rendered only for a signed-in cart: applying a code needs a server-side cart
   to persist it on, and the API is authenticated. */
function CouponBox({ coupon, onApply, onRemove }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onApply(code);
      setCode("");
    } catch (err) {
      // Shown verbatim: the server writes the rule wording in Persian.
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (coupon) {
    return (
      <div className={`${CARD} flex items-center justify-between gap-3 p-4`}>
        <span className="flex items-center gap-2 font-persian text-sm text-text-primary">
          <TicketPercent size={18} className="text-brand-navy" aria-hidden="true" />
          کد تخفیف: <strong className="font-bold">{coupon.code}</strong>
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 font-persian text-sm font-medium text-status-error transition hover:bg-status-error-bg"
        >
          <X size={16} aria-hidden="true" />
          حذف
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={`${CARD} p-4`}>
      <label
        htmlFor="coupon-code"
        className="mb-1.5 block font-persian text-sm font-medium text-text-primary"
      >
        کد تخفیف
      </label>
      <div className="flex gap-2">
        <input
          id="coupon-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="کد تخفیف را وارد کنید"
          className="h-12 min-w-0 flex-1 rounded-lg border border-brand-mist bg-white px-4 font-persian text-sm text-text-primary placeholder-text-secondary outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20"
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-lg bg-brand-navy px-5 font-persian text-sm font-bold text-white transition hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          اعمال
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-status-error-bg px-4 py-2.5 font-persian text-sm text-status-error"
        >
          {error}
        </p>
      )}
    </form>
  );
}

export default function CartPage() {
  const {
    items,
    count,
    subtotal,
    discount,
    coupon,
    total,
    updateItem,
    removeItem,
    applyCoupon,
    removeCoupon,
  } = useCart();
  const { isAuthenticated } = useAuth();

  const handleQty = (item, next) => {
    if (next < 1) {
      removeItem(item.id);
    } else {
      updateItem(item.id, next);
    }
  };

  return (
    <section className="relative min-h-screen overflow-hidden bg-brand-warm-white pt-[var(--navbar-height)]">
      <PageBackground />

      <div className="relative mx-auto max-w-[1120px] px-6 py-8 sm:py-10" dir="rtl">
        <header className="mb-12" dir="rtl">
          <p className="font-sans text-sm uppercase tracking-[0.3em] text-text-secondary">
            Shopping
          </p>
          <h1 className="mt-2 font-persian text-3xl font-bold text-brand-navy md:text-4xl">
            سبد خرید
          </h1>
          <hr className="mt-4 w-24 border-t-2 border-brand-navy" />
        </header>

        {items.length === 0 ? (
          <div className={`${CARD} flex flex-col items-center justify-center p-12 text-center`}>
            <Package size={56} className="text-brand-mist" />
            <p className="mt-4 font-persian text-lg font-medium text-text-primary">
              سبد خرید شما خالی است
            </p>
            <p className="mt-1 font-persian text-sm text-text-secondary">
              محصولات مورد نظر خود را به سبد اضافه کنید.
            </p>
            <Link
              to="/products"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-navy px-6 py-3 font-persian text-sm font-bold text-white transition hover:bg-action-hover"
            >
              مشاهده محصولات
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Order cards */}
            <div className="flex flex-col gap-4 lg:col-span-2">
              {items.map((item) => (
                <OrderCard
                  key={item.id}
                  item={item}
                  onQty={handleQty}
                  onRemove={removeItem}
                />
              ))}

              {isAuthenticated && (
                <CouponBox
                  coupon={coupon}
                  onApply={applyCoupon}
                  onRemove={removeCoupon}
                />
              )}
            </div>

            {/* Invoice summary */}
            <div className="lg:col-span-1">
              {/* top-24 (96px) was shorter than the navbar, so the summary slid
                  under the fixed bar when the page scrolled. */}
              <div
                className={`${CARD} sticky p-6`}
                style={{ top: "calc(var(--navbar-height) + 1rem)" }}
              >
                <h2 className="mb-4 font-persian text-lg font-semibold text-brand-navy">
                  فاکتور سفارش
                </h2>
                <div className="flex flex-col gap-3 border-b border-brand-mist pb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">تعداد اقلام</span>
                    <span className="font-medium text-text-primary">
                      {toPersianNumber(count)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">جمع کل</span>
                    <span className="font-medium text-text-primary [font-feature-settings:'tnum']">
                      {formatPersianPrice(subtotal)} تومان
                    </span>
                  </div>
                  {/* Only when there is something to explain: a zero row on
                      every cart reads as a broken discount. */}
                  {discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-status-success">تخفیف</span>
                      <span className="font-medium text-status-success [font-feature-settings:'tnum']">
                        {formatPersianPrice(discount)}− تومان
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between py-4">
                  <span className="font-persian font-bold text-text-primary">
                    مبلغ قابل پرداخت
                  </span>
                  <span className="font-persian text-xl font-bold text-brand-navy [font-feature-settings:'tnum']">
                    {formatPersianPrice(total)}
                    <span className="mr-1 text-xs font-normal text-text-secondary">
                      تومان
                    </span>
                  </span>
                </div>

                <Link
                  to="/checkout"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-navy px-6 py-3 font-persian text-sm font-bold text-white transition hover:bg-action-hover"
                >
                  ادامه و تکمیل اطلاعات سفارش
                  <ArrowLeft size={17} />
                </Link>
                <Link
                  to="/products"
                  className="mt-3 block text-center font-persian text-sm font-medium text-brand-navy hover:text-brand-navy"
                >
                  افزودن محصول دیگر
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
