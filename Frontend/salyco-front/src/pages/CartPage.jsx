import { Link } from "react-router-dom";
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowLeft,
  Package,
} from "lucide-react";
import { useCart } from "../context/CartContext";
import { getProductImageUrl } from "../utils/productImage";
import { toPersianNumber, formatPersianPrice } from "../utils/persian";
import PageBackground from "../components/PageBackground";

const CARD =
  "rounded-xl border border-[#CBD2D6] bg-white shadow-[0_1px_4px_rgba(0,48,135,0.06)]";

// A single cart line rendered as an order card.
function OrderCard({ item, onQty, onRemove }) {
  return (
    <div className={`${CARD} flex gap-4 p-4`}>
      <Link
        to={`/products/mattress/${item.mattress_slug}`}
        className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-[#CBD2D6] bg-[#F5F7FA]"
      >
        <img
          src={getProductImageUrl(item.mattress_image)}
          alt={item.mattress_name}
          onError={(e) => {
            e.currentTarget.src = "/matress.png";
          }}
          className="h-full w-full object-cover"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={`/products/mattress/${item.mattress_slug}`}
            className="font-persian text-base font-semibold text-[#003087] hover:text-[#009CDE]"
          >
            {item.mattress_name}
          </Link>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label="حذف"
            className="shrink-0 rounded-lg p-1.5 text-[#D20000] transition hover:bg-[#FDE7E7]"
          >
            <Trash2 size={18} />
          </button>
        </div>

        {item.size_label && (
          <span className="mt-0.5 text-xs text-[#687173]">
            سایز: {item.size_label}
          </span>
        )}

        <div className="mt-auto flex items-center justify-between pt-3">
          {/* Quantity stepper */}
          <div className="flex items-center rounded-lg border border-[#CBD2D6]">
            <button
              type="button"
              onClick={() => onQty(item, item.quantity - 1)}
              aria-label="کاهش"
              className="flex h-8 w-8 items-center justify-center text-[#003087] transition hover:bg-[#F5F7FA]"
            >
              <Minus size={15} />
            </button>
            <span className="min-w-[2rem] text-center font-persian text-sm font-medium text-[#1A1A2E] [font-feature-settings:'tnum']">
              {toPersianNumber(item.quantity)}
            </span>
            <button
              type="button"
              onClick={() => onQty(item, item.quantity + 1)}
              aria-label="افزایش"
              className="flex h-8 w-8 items-center justify-center text-[#003087] transition hover:bg-[#F5F7FA]"
            >
              <Plus size={15} />
            </button>
          </div>

          <span className="font-persian text-base font-bold text-[#003087] [font-feature-settings:'tnum']">
            {formatPersianPrice(item.line_total)}
            <span className="mr-1 text-xs font-normal text-[#687173]">تومان</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function CartPage() {
  const { items, count, total, updateItem, removeItem } = useCart();

  const handleQty = (item, next) => {
    if (next < 1) {
      removeItem(item.id);
    } else {
      updateItem(item.id, next);
    }
  };

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#F5F7FA] pt-[var(--navbar-height)]">
      <PageBackground />

      <div className="relative mx-auto max-w-[1120px] px-6 py-8 sm:py-10" dir="rtl">
        <header className="mb-12" dir="rtl">
          <p className="font-sans text-sm uppercase tracking-[0.3em] text-[#687173]">
            Shopping
          </p>
          <h1 className="mt-2 font-persian text-3xl font-bold text-[#003087] md:text-4xl">
            سبد خرید
          </h1>
          <hr className="mt-4 w-24 border-t-2 border-[#003087]" />
        </header>

        {items.length === 0 ? (
          <div className={`${CARD} flex flex-col items-center justify-center p-12 text-center`}>
            <Package size={56} className="text-[#CBD2D6]" />
            <p className="mt-4 font-persian text-lg font-medium text-[#1A1A2E]">
              سبد خرید شما خالی است
            </p>
            <p className="mt-1 font-persian text-sm text-[#687173]">
              محصولات مورد نظر خود را به سبد اضافه کنید.
            </p>
            <Link
              to="/products/mattress"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#003087] px-6 py-3 font-persian text-sm font-bold text-white transition hover:bg-[#00246B]"
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
            </div>

            {/* Invoice summary */}
            <div className="lg:col-span-1">
              <div className={`${CARD} sticky top-24 p-6`}>
                <h2 className="mb-4 font-persian text-lg font-semibold text-[#003087]">
                  فاکتور سفارش
                </h2>
                <div className="flex flex-col gap-3 border-b border-[#CBD2D6] pb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#687173]">تعداد اقلام</span>
                    <span className="font-medium text-[#1A1A2E]">
                      {toPersianNumber(count)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#687173]">جمع کل</span>
                    <span className="font-medium text-[#1A1A2E] [font-feature-settings:'tnum']">
                      {formatPersianPrice(total)} تومان
                    </span>
                  </div>
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

                <Link
                  to="/checkout"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#003087] px-6 py-3 font-persian text-sm font-bold text-white transition hover:bg-[#00246B]"
                >
                  ادامه و تکمیل اطلاعات سفارش
                  <ArrowLeft size={17} />
                </Link>
                <Link
                  to="/products/mattress"
                  className="mt-3 block text-center font-persian text-sm font-medium text-[#003087] hover:text-[#009CDE]"
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
