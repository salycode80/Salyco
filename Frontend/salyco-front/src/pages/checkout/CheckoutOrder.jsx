import { BRAND } from "../../config/brand";
import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ClipboardList,
  Loader2,
  AlertCircle,
  MapPin,
  User,
  CreditCard,
} from "lucide-react";
import api from "../../api";
import { useCart } from "../../context/CartContext";
import { getAllowedLocations } from "../../api/orders";
import { startPayment } from "../../api/payments";
import { IRAN_PROVINCES } from "../../constants/provinces";
import { getCitiesForProvince } from "../../constants/cities";
import {
  toPersianNumber,
  formatPersianPrice,
  toLatinDigits,
} from "../../utils/persian";
import PageBackground from "../../components/PageBackground";

const CARD =
  "rounded-xl border border-brand-mist bg-white shadow-[0_1px_4px_rgba(5,46,95,0.06)]";

const inputBase =
  "w-full rounded-lg border border-brand-mist bg-white px-4 py-3 font-persian text-sm text-text-primary placeholder-text-secondary transition focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20";

const inputError =
  "border-status-error bg-status-error-bg focus:border-status-error focus:ring-status-error/20";

// Sales line + calling hours. Adjust to the real contact details as needed.
const SALES_PHONE = BRAND.mobile;

const EMPTY_FORM = {
  recipient_name: "",
  phone_number: "",
  province: "",
  city: "",
  postal_code: "",
  address: "",
};

// Reduce the flat [{province, city}] rows into province -> what is allowed there.
// A blank city means the whole province is serviceable.
function buildAreaMap(rows) {
  const map = new Map();
  for (const row of rows) {
    const province = (row.province || "").trim();
    if (!province) continue;
    const entry = map.get(province) || { provinceWide: false, cities: [] };
    const city = (row.city || "").trim();
    if (city) {
      if (!entry.cities.includes(city)) entry.cities.push(city);
    } else {
      entry.provinceWide = true;
    }
    map.set(province, entry);
  }
  return map;
}

// The control is nested inside the <label> so the association is implicit —
// the previous sibling <label> had no htmlFor, so clicking it did nothing and
// the field reached screen readers unnamed. On a payment form that matters:
// "شماره تماس" and "کد پستی" must not be announced as just "edit text".
// The error stays outside the label so it isn't read as part of the name.
function Field({ label, error, hint, optional, children }) {
  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block font-persian text-sm font-medium text-text-primary">
          {label}
          {optional && (
            <span className="mr-1 text-xs font-normal text-text-secondary">
              (اختیاری)
            </span>
          )}
        </span>
        {children}
      </label>
      {/* The four things a customer must know before paying used to sit in a
          loud navy-headed box above the form. They are the same sentences,
          each next to the field it is actually about. */}
      {hint && !error && (
        <p className="mt-1 font-persian text-xs leading-6 text-text-secondary">
          {hint}
        </p>
      )}
      {error && (
        <p className="mt-1 font-persian text-xs text-status-error">{error}</p>
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <h2 className="flex items-center gap-2 font-persian text-base font-bold text-brand-navy">
      <Icon size={18} />
      {children}
    </h2>
  );
}

export default function CheckoutOrder() {
  const { items, count, subtotal, discount, coupon, total, refresh } = useCart();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | redirecting
  const [error, setError] = useState("");

  const [areas, setAreas] = useState(null); // Map | null while loading
  const [areasFailed, setAreasFailed] = useState(false);

  // No items — go back to the cart.
  useEffect(() => {
    if (items.length === 0) {
      navigate("/cart", { replace: true });
    }
  }, [items.length, navigate]);

  // Serviceable areas drive the province/city fields.
  useEffect(() => {
    let alive = true;
    getAllowedLocations()
      .then((rows) => {
        if (!alive) return;
        setAreas(buildAreaMap(Array.isArray(rows) ? rows : []));
      })
      .catch(() => {
        // Fall back to the full province list and let the server decide.
        if (!alive) return;
        setAreas(new Map());
        setAreasFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Prefill from the saved profile so returning customers don't retype.
  useEffect(() => {
    let alive = true;
    api
      .get("/api/user/me/")
      .then((res) => {
        if (!alive) return;
        const u = res.data || {};
        const fullName = `${u.first_name || ""} ${u.last_name || ""}`.trim();
        setForm((f) => ({
          ...f,
          recipient_name: f.recipient_name || fullName,
          phone_number: f.phone_number || u.phone_number || "",
          postal_code: f.postal_code || u.postal_code || "",
          address: f.address || u.address || "",
        }));
      })
      .catch(() => {
        /* Prefill is a convenience — ignore failures. */
      });
    return () => {
      alive = false;
    };
  }, []);

  const provinceOptions = useMemo(() => {
    if (areasFailed || !areas) return IRAN_PROVINCES;
    const known = IRAN_PROVINCES.filter((p) => areas.has(p));
    const extra = [...areas.keys()].filter((p) => !IRAN_PROVINCES.includes(p));
    return [...known, ...extra];
  }, [areas, areasFailed]);

  // Cities to offer - use backend allowed locations if available, otherwise use our cities mapping
  const cityOptions = useMemo(() => {
    // If backend has specific cities for this province, use those
    if (!areasFailed && areas && form.province) {
      const entry = areas.get(form.province);
      if (entry && (entry.provinceWide || entry.cities.length === 0)) {
        // Backend says province is fully serviceable - use our cities list
        return getCitiesForProvince(form.province);
      }
      if (entry && entry.cities.length > 0) {
        // Backend has specific allowed cities - use those
        return entry.cities;
      }
    }
    // Fallback to our cities mapping
    if (form.province) {
      return getCitiesForProvince(form.province);
    }
    return null;
  }, [areas, areasFailed, form.province]);

  const loadingAreas = areas === null;
  const noServiceableAreas = !areasFailed && areas !== null && areas.size === 0;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({
      ...f,
      [name]: value,
      // A city only makes sense in the context of its province.
      ...(name === "province" ? { city: "" } : null),
    }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setError("");
  };

  const validate = () => {
    const next = {};
    const phone = toLatinDigits(form.phone_number).replace(/\D/g, "");
    const postal = toLatinDigits(form.postal_code).replace(/\D/g, "");

    if (form.recipient_name.trim().length < 3)
      next.recipient_name = "نام تحویل‌گیرنده را کامل وارد کنید.";
    if (!/^09\d{9}$/.test(phone))
      next.phone_number = "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.";
    if (!form.province) next.province = "لطفاً استان را انتخاب کنید.";
    else if (!areasFailed && areas && !areas.has(form.province))
      next.province = "متأسفانه ارسال به این استان امکان‌پذیر نیست.";
    if (!form.city.trim()) next.city = "لطفاً شهر را وارد کنید.";
    else if (cityOptions && !cityOptions.includes(form.city))
      next.city = "متأسفانه ارسال به این شهر امکان‌پذیر نیست.";
    if (postal.length !== 10) next.postal_code = "کد پستی باید ۱۰ رقم باشد.";
    if (form.address.trim().length < 10)
      next.address = "نشانی را کامل‌تر وارد کنید.";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // The form's only action: validate every field, then hand the browser to
  // Zibal.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (noServiceableAreas || !validate()) return;

    setStatus("redirecting");
    try {
      const { payment_url } = await startPayment({
        recipient_name: form.recipient_name.trim(),
        phone_number: toLatinDigits(form.phone_number).replace(/\D/g, ""),
        province: form.province,
        city: form.city.trim(),
        postal_code: toLatinDigits(form.postal_code).replace(/\D/g, ""),
        address: form.address.trim(),
      });
      // A full-page navigation, deliberately not a router transition: Zibal
      // requires a Referer header whose domain matches the gateway's registered
      // website and will not show the payment page without one. The cart is left
      // intact — nothing is paid yet, and clearing it would strand a customer
      // who abandons the bank page.
      window.location.href = payment_url;
    } catch (err) {
      setError(err.message);
      setStatus("idle");
      // The server clears a coupon it refuses at payment time and says so in
      // `detail`. Re-reading the cart is what makes the summary above the pay
      // button agree with it — one GET, and only on a failed attempt.
      refresh();
    }
  };

  const submitBlocked = status === "redirecting" || loadingAreas || noServiceableAreas;

  return (
    <section className="relative min-h-screen overflow-hidden bg-brand-warm-white pt-[var(--navbar-height)]">
      <PageBackground />

      <div className="relative mx-auto max-w-[1120px] px-6 py-8 sm:py-10" dir="rtl">
        <Link
          to="/cart"
          className="mb-8 inline-flex items-center gap-2 font-persian text-sm font-medium text-brand-navy transition-colors hover:text-brand-navy"
        >
          <ArrowRight size={16} />
          بازگشت به سبد خرید
        </Link>

        <h1 className="mb-2 flex items-center gap-3 font-persian text-2xl font-bold text-text-primary md:text-3xl">
          <ClipboardList size={26} className="text-brand-navy" />
          تکمیل اطلاعات سفارش
        </h1>
        <p className="mb-6 font-persian text-sm text-text-secondary">
          لطفاً اطلاعات زیر را کامل کنید. پس از تکمیل اطلاعات، به درگاه پرداخت
          آنلاین منتقل می‌شوید. سؤالی دارید؟ با {SALES_PHONE} تماس بگیرید.
        </p>

        {/* One card: the form and its invoice summary, split by a seam rather
            than separated into two boxes with a gutter between them. */}
        <div className={`${CARD} grid overflow-hidden lg:grid-cols-3`}>
          {/* Order form */}
          <form
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col gap-6 p-6 lg:col-span-2"
          >
            {/* Contact details */}
            <div className="flex flex-col gap-5">
              <SectionTitle icon={User}>اطلاعات تماس</SectionTitle>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="نام تحویل‌گیرنده"
                  error={errors.recipient_name}
                  hint="این نام روی بارنامهٔ ارسال ثبت می‌شود."
                >
                  <input
                    name="recipient_name"
                    value={form.recipient_name}
                    onChange={handleChange}
                    placeholder="نام و نام خانوادگی"
                    className={`${inputBase} ${
                      errors.recipient_name ? inputError : ""
                    }`}
                  />
                </Field>

                <Field
                  label="شماره تماس"
                  error={errors.phone_number}
                  hint="در صورت نادرست بودن شماره، امکان هماهنگی و ارسال سفارش وجود ندارد."
                >
                  <input
                    name="phone_number"
                    value={form.phone_number}
                    onChange={handleChange}
                    inputMode="tel"
                    dir="ltr"
                    placeholder="09123456789"
                    className={`${inputBase} ${
                      errors.phone_number ? inputError : ""
                    }`}
                  />
                </Field>
              </div>
            </div>

            <div className="border-t border-brand-mist" />

            {/* Delivery address */}
            <div className="flex flex-col gap-5">
              <SectionTitle icon={MapPin}>آدرس تحویل</SectionTitle>

              {noServiceableAreas && (
                <p className="flex items-start gap-2 rounded-lg bg-status-error-bg px-4 py-3 font-persian text-sm text-status-error">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  در حال حاضر ارسال به هیچ منطقه‌ای امکان‌پذیر نیست. لطفاً بعداً
                  دوباره تلاش کنید یا با شماره {SALES_PHONE} تماس بگیرید.
                </p>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="استان"
                  error={errors.province}
                  hint="ارسال فقط به شهرهای این فهرست انجام می‌شود."
                >
                  <select
                    name="province"
                    value={form.province}
                    onChange={handleChange}
                    disabled={loadingAreas || noServiceableAreas}
                    className={`${inputBase} ${
                      errors.province ? inputError : ""
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <option value="">
                      {loadingAreas ? "در حال بارگذاری..." : "انتخاب استان"}
                    </option>
                    {provinceOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="شهر" error={errors.city}>
                  {cityOptions ? (
                    <select
                      name="city"
                      value={form.city}
                      onChange={handleChange}
                      className={`${inputBase} ${errors.city ? inputError : ""}`}
                    >
                      <option value="">انتخاب شهر</option>
                      {cityOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name="city"
                      value={form.city}
                      onChange={handleChange}
                      disabled={noServiceableAreas}
                      placeholder="نام شهر"
                      className={`${inputBase} ${
                        errors.city ? inputError : ""
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    />
                  )}
                </Field>
              </div>

              <Field label="کد پستی" error={errors.postal_code}>
                <input
                  name="postal_code"
                  value={form.postal_code}
                  onChange={handleChange}
                  inputMode="numeric"
                  dir="ltr"
                  placeholder="کد پستی ۱۰ رقمی"
                  className={`${inputBase} ${
                    errors.postal_code ? inputError : ""
                  }`}
                />
              </Field>

              <Field
                label="نشانی کامل"
                error={errors.address}
                hint="کد پستی و نشانی کامل، مبنای ارسال سفارش شماست."
              >
                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  rows={3}
                  placeholder="خیابان، کوچه، پلاک، واحد..."
                  className={`${inputBase} resize-none ${
                    errors.address ? inputError : ""
                  }`}
                />
              </Field>
            </div>

            {error && (
              <p className="flex items-start gap-2 rounded-lg bg-status-error-bg px-4 py-3 font-persian text-sm text-status-error">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}

            <div className="border-t border-brand-mist" />

            {/* Pay — the form's only action; enabled once the fields above are
                valid and a serviceable area is known. */}
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={submitBlocked}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-navy px-6 py-3 font-persian text-sm font-bold text-white transition hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "redirecting" ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    در حال انتقال به درگاه...
                  </>
                ) : (
                  <>
                    <CreditCard size={17} />
                    پرداخت آنلاین
                  </>
                )}
              </button>
              <p className="text-center font-persian text-xs text-text-secondary">
                پرداخت امن از طریق درگاه زیبال
              </p>
            </div>
          </form>

          {/* Invoice summary — the same card's left column, tinted so the seam
              reads as a division of one panel rather than a second panel. */}
          <aside className="border-t border-brand-mist bg-brand-warm-white p-6 lg:col-span-1 lg:border-s lg:border-t-0">
            <h2 className="mb-4 font-persian text-lg font-semibold text-brand-navy">
              خلاصه سفارش
            </h2>
              <div className="flex flex-col gap-3 border-b border-brand-mist pb-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between gap-2 text-sm"
                  >
                    <span className="min-w-0 truncate text-text-primary">
                      {item.mattress_name}
                      <span className="text-text-secondary">
                        {" "}
                        × {toPersianNumber(item.quantity)}
                      </span>
                    </span>
                    <span className="shrink-0 text-text-secondary [font-feature-settings:'tnum']">
                      {formatPersianPrice(item.line_total)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-b border-brand-mist py-3 text-sm">
                <span className="text-text-secondary">تعداد اقلام</span>
                <span className="font-medium text-text-primary">
                  {toPersianNumber(count)}
                </span>
              </div>
              <div className="flex justify-between border-b border-brand-mist py-3 text-sm">
                <span className="text-text-secondary">جمع کل</span>
                <span className="font-medium text-text-primary [font-feature-settings:'tnum']">
                  {formatPersianPrice(subtotal)} تومان
                </span>
              </div>
              {coupon && (
                <div className="flex justify-between border-b border-brand-mist py-3 text-sm">
                  <span className="text-text-secondary">
                    کد تخفیف ({coupon.code})
                  </span>
                  <span className="font-medium text-status-success [font-feature-settings:'tnum']">
                    {formatPersianPrice(discount)}− تومان
                  </span>
                </div>
              )}
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
            </aside>
        </div>
      </div>
    </section>
  );
}
