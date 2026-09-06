import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ClipboardList,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Phone,
  MapPin,
  User,
  Info,
  CreditCard,
} from "lucide-react";
import api from "../../api";
import { useCart } from "../../context/CartContext";
import { createOrder, getAllowedLocations } from "../../api/orders";
import { startPayment } from "../../api/payments";
import { IRAN_PROVINCES } from "../../constants/provinces";
import { IRAN_PROVINCES_CITIES, getCitiesForProvince } from "../../constants/cities";
import {
  toPersianNumber,
  formatPersianPrice,
  toLatinDigits,
} from "../../utils/persian";
import PageBackground from "../../components/PageBackground";

const CARD =
  "rounded-xl border border-[#CBD2D6] bg-white shadow-[0_1px_4px_rgba(0,48,135,0.06)]";

const inputBase =
  "w-full rounded-lg border border-[#CBD2D6] bg-white px-4 py-3 font-persian text-sm text-[#1A1A2E] placeholder-[#687173] transition focus:border-[#009CDE] focus:outline-none focus:ring-2 focus:ring-[#009CDE]/20";

const inputError =
  "border-[#D20000] bg-[#FDE7E7] focus:border-[#D20000] focus:ring-[#D20000]/20";

// Sales line + calling hours. Adjust to the real contact details as needed.
const SALES_PHONE = "09126847234";

// Placeholder copy — replace with the final wording from the business.
const NOTICES = [
  "سفارش خود را می‌توانید به‌صورت آنلاین پرداخت کنید یا به‌صورت تلفنی ثبت کنید. در ثبت سفارش تلفنی، کارشناسان ما برای هماهنگی جزئیات و مبلغ نهایی با شما تماس می‌گیرند و تا پیش از آن مبلغی دریافت نمی‌شود.",
  "شماره تماس خود را با دقت وارد کنید. در صورت نادرست بودن شماره، امکان هماهنگی و ارسال سفارش وجود نخواهد داشت.",
  "ارسال تشک‌ها فقط به مناطقی انجام می‌شود که در فهرست استان‌ها و شهرهای قابل انتخاب نمایش داده شده‌اند. اگر شهر شما در فهرست نیست، لطفاً تلفنی با ما تماس بگیرید.",
  "نام تحویل‌گیرنده، کد پستی و نشانی کامل را دقیق وارد کنید؛ این اطلاعات مبنای ارسال سفارش شماست.",
];

const EMPTY_FORM = {
  recipient_name: "",
  phone_number: "",
  call_time_preference: "",
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

function Field({ label, error, optional, children }) {
  return (
    <div>
      <label className="mb-1.5 block font-persian text-sm font-medium text-[#1A1A2E]">
        {label}
        {optional && (
          <span className="mr-1 text-xs font-normal text-[#687173]">
            (اختیاری)
          </span>
        )}
      </label>
      {children}
      {error && (
        <p className="mt-1 font-persian text-xs text-[#D20000]">{error}</p>
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <h2 className="flex items-center gap-2 font-persian text-base font-bold text-[#003087]">
      <Icon size={18} />
      {children}
    </h2>
  );
}

export default function CheckoutOrder() {
  const { items, count, total, clear } = useCart();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | sending | redirecting | success
  const [error, setError] = useState("");

  const [areas, setAreas] = useState(null); // Map | null while loading
  const [areasFailed, setAreasFailed] = useState(false);

  // No items — go back to the cart (unless we just placed the order).
  useEffect(() => {
    if (items.length === 0 && status !== "success") {
      navigate("/cart", { replace: true });
    }
  }, [items.length, status, navigate]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (noServiceableAreas || !validate()) return;

    setStatus("sending");
    try {
      await createOrder({
        method: "PHONE",
        recipient_name: form.recipient_name.trim(),
        phone_number: toLatinDigits(form.phone_number).replace(/\D/g, ""),
        call_time_preference: form.call_time_preference.trim(),
        province: form.province,
        city: form.city.trim(),
        postal_code: toLatinDigits(form.postal_code).replace(/\D/g, ""),
        address: form.address.trim(),
      });
      clear();
      setStatus("success");
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  };

  // Online payment. Runs the same validation the phone path does, then hands the
  // browser to Zibal.
  const handleOnlinePayment = async () => {
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
              سفارش شما با موفقیت ثبت شد. کارشناسان ما جهت هماهنگی نهایی و ارسال
              با شما تماس خواهند گرفت.
            </p>
            <div className="mt-4 rounded-lg bg-[#F5F7FA] px-6 py-3 font-persian text-lg font-bold text-[#003087]">
              {SALES_PHONE}
            </div>
            <Link
              to="/products"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#003087] px-6 py-3 font-persian text-sm font-bold text-white transition hover:bg-[#00246B]"
            >
              ادامه خرید
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const submitBlocked =
    status === "sending" ||
    status === "redirecting" ||
    loadingAreas ||
    noServiceableAreas;

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#F5F7FA] pt-[var(--navbar-height)]">
      <PageBackground />

      <div className="relative mx-auto max-w-[1120px] px-6 py-8 sm:py-10" dir="rtl">
        <Link
          to="/cart"
          className="mb-8 inline-flex items-center gap-2 font-persian text-sm font-medium text-[#003087] transition-colors hover:text-[#009CDE]"
        >
          <ArrowRight size={16} />
          بازگشت به سبد خرید
        </Link>

        <h1 className="mb-2 flex items-center gap-3 font-persian text-2xl font-bold text-[#1A1A2E] md:text-3xl">
          <ClipboardList size={26} className="text-[#003087]" />
          تکمیل اطلاعات سفارش
        </h1>
        <p className="mb-6 font-persian text-sm text-[#687173]">
          لطفاً اطلاعات زیر را کامل کنید. پس از تکمیل و تأیید اطلاعات، می‌توانید
          روش ثبت سفارش خود را انتخاب کنید.
        </p>

        {/* Intro notice — must be read before ordering, so it is styled loud. */}
        <div className="mb-8 overflow-hidden rounded-xl border-2 border-[#009CDE] bg-white shadow-[0_4px_16px_rgba(0,48,135,0.12)]">
          <div className="flex items-center gap-2 bg-[#003087] px-5 py-3 sm:px-6">
            <Info size={20} className="shrink-0 text-white" />
            <h2 className="font-persian text-base font-bold text-white sm:text-lg">
              پیش از ثبت سفارش این موارد را بخوانید
            </h2>
          </div>

          <ul className="flex flex-col gap-4 bg-[#F0F8FC] px-5 py-5 sm:px-6 sm:py-6">
            {NOTICES.map((notice, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#003087] font-persian text-xs font-bold text-white">
                  {toPersianNumber(i + 1)}
                </span>
                <p className="font-persian text-[15px] font-medium leading-8 text-[#1A1A2E]">
                  {notice}
                </p>
              </li>
            ))}
          </ul>

          <div className="flex flex-col items-center justify-center gap-2 border-t-2 border-[#009CDE]/30 bg-white px-5 py-4 text-center sm:flex-row sm:gap-3 sm:px-6">
            <span className="font-persian text-sm font-medium text-[#1A1A2E]">
              سؤالی دارید؟ پیش از ثبت سفارش با ما تماس بگیرید:
            </span>
            <a
              href={`tel:${SALES_PHONE}`}
              dir="ltr"
              className="inline-flex items-center gap-2 rounded-lg bg-[#003087] px-4 py-2 font-persian text-base font-bold text-white transition hover:bg-[#00246B]"
            >
              <Phone size={16} />
              {SALES_PHONE}
            </a>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Order form */}
          <form
            onSubmit={handleSubmit}
            noValidate
            className={`${CARD} flex flex-col gap-6 p-6 lg:col-span-2`}
          >
            {/* Contact details */}
            <div className="flex flex-col gap-5">
              <SectionTitle icon={User}>اطلاعات تماس</SectionTitle>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="نام تحویل‌گیرنده" error={errors.recipient_name}>
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

                <Field label="شماره تماس" error={errors.phone_number}>
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

              <Field label="بازه زمانی مناسب برای تماس" optional>
                <div className="flex gap-2">
                  <input
                    name="call_time_preference"
                    value={form.call_time_preference}
                    onChange={handleChange}
                    placeholder="مثال: صبح‌ها ۹ تا ۱۲"
                    className={`${inputBase} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, call_time_preference: "هر زمان" }))
                    }
                    className="shrink-0 rounded-lg border-2 border-[#003087] bg-white px-6 py-3 font-persian text-sm font-bold text-[#003087] transition hover:bg-[#003087] hover:text-white"
                  >
                    هر زمان
                  </button>
                </div>
              </Field>
            </div>

            <div className="border-t border-[#CBD2D6]" />

            {/* Delivery address */}
            <div className="flex flex-col gap-5">
              <SectionTitle icon={MapPin}>آدرس تحویل</SectionTitle>

              {noServiceableAreas && (
                <p className="flex items-start gap-2 rounded-lg bg-[#FDE7E7] px-4 py-3 font-persian text-sm text-[#D20000]">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  در حال حاضر ارسال به هیچ منطقه‌ای امکان‌پذیر نیست. لطفاً بعداً
                  دوباره تلاش کنید یا با شماره {SALES_PHONE} تماس بگیرید.
                </p>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="استان" error={errors.province}>
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

              <Field label="نشانی کامل" error={errors.address}>
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
              <p className="flex items-start gap-2 rounded-lg bg-[#FDE7E7] px-4 py-3 font-persian text-sm text-[#D20000]">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}

            <div className="border-t border-[#CBD2D6]" />

            {/* Order method — only available once the form above is valid. */}
            <div className="flex flex-col gap-3">
              <p className="font-persian text-sm text-[#687173]">
                روش ثبت سفارش خود را انتخاب کنید:
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <button
                    type="button"
                    onClick={handleOnlinePayment}
                    disabled={submitBlocked}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#003087] px-6 py-3 font-persian text-sm font-bold text-white transition hover:bg-[#00246B] disabled:cursor-not-allowed disabled:opacity-60"
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
                  <p className="mt-2 text-center font-persian text-xs text-[#687173]">
                    پرداخت امن از طریق درگاه زیبال
                  </p>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={submitBlocked}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#019C34] px-6 py-3 font-persian text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {status === "sending" ? (
                      <>
                        <Loader2 size={17} className="animate-spin" />
                        در حال ثبت...
                      </>
                    ) : (
                      <>
                        <Phone size={17} />
                        ثبت سفارش تلفنی
                      </>
                    )}
                  </button>
                  <p className="mt-2 text-center font-persian text-xs text-[#687173]">
                    کارشناسان ما با شما تماس می‌گیرند
                  </p>
                </div>
              </div>
            </div>
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
              <div className="flex justify-between border-b border-[#CBD2D6] py-3 text-sm">
                <span className="text-[#687173]">تعداد اقلام</span>
                <span className="font-medium text-[#1A1A2E]">
                  {toPersianNumber(count)}
                </span>
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
