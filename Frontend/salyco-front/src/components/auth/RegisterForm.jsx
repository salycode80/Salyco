import { useState, useEffect, useRef } from "react";
import { InputField } from "./InputField";
import { AuthAlert } from "./AuthAlert";
import { registerUser, verifyRegistrationOtp, resendRegistrationOtp } from "../../api/auth";
import { useAuth } from "../../hooks/UseAuth";

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const PhoneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);
const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const OtpIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const ArrowLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);
const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

const OTP_DURATION_SECONDS = 120;

function OtpInput({ value, onChange, onComplete, loading }) {
  const inputRefs = useRef([]);

  useEffect(() => {
    if (value.length === 4) {
      onComplete(value);
    }
  }, [value, onComplete]);

  const handleChange = (index, digit) => {
    if (!/^\d*$/.test(digit)) return;
    const newValue = value.slice(0, index) + digit + value.slice(index + 1);
    onChange(newValue);
    if (digit && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 4 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (inputRefs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ""}
          disabled={loading}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="h-14 w-12 rounded-lg border border-[#CBD2D6] text-center text-[24px] font-bold text-[#1A1A2E] focus:border-[#003087] focus:ring-2 focus:ring-[#009CDE]/20 outline-none transition-all"
        />
      ))}
    </div>
  );
}

function OtpCountdown({ expiresAt, onResend, onResendReady }) {
  const [remaining, setRemaining] = useState(null);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;

    const update = () => {
      const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        setCanResend(true);
        onResendReady();
      }
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, onResendReady]);

  if (remaining === null) return null;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-[13px] text-[#687173]">
        کد تأیید تا {" "}
        <span className="font-medium text-[#1A1A2E]">
          {minutes}:{seconds.toString().padStart(2, "0")}
        </span>{" "}معتبر است
      </p>
      {canResend && (
        <button
          type="button"
          onClick={onResend}
          className="flex items-center gap-1 text-[13px] font-medium text-[#003087] hover:underline"
        >
          <RefreshIcon />
          ارسال مجدد کد
        </button>
      )}
    </div>
  );
}

export function RegisterForm({ onSwitchToLogin }) {
  const { login } = useAuth();
  const [step, setStep] = useState("register");
  const [pendingPhone, setPendingPhone] = useState(null);
  const [otpExpiry, setOtpExpiry] = useState(null);

  const [form, setForm] = useState({
    phone_number: "",
    username: "",
    password: "",
    password2: "",
  });
  const [otpValue, setOtpValue] = useState("");
  const [status, setStatus] = useState({ loading: false, error: "", success: false });

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  const normalizePhone = (phone) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("09")) return cleaned;
    if (cleaned.startsWith("9")) return "0" + cleaned;
    if (cleaned.startsWith("0") && cleaned.length > 1) return cleaned;
    return "0" + cleaned;
  };

  const validate = () => {
    if (!form.phone_number) return "لطفاً شماره موبایل را وارد کنید";
    if (form.phone_number.length !== 11) return "شماره موبایل باید ۱۱ رقم باشد";
    if (!/^09\d{9}$/.test(form.phone_number)) return "شماره موبایل معتبر نیست";
    if (!form.username) return "لطفاً نام کاربری را وارد کنید";
    if (!form.password) return "لطفاً رمز عبور را وارد کنید";
    if (form.password.length < 8) return "رمز عبور باید حداقل ۸ کاراکتر باشد";
    if (form.password !== form.password2) return "رمز عبور و تکرار آن یکسان نیستند";
    return null;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const err = validate();
    if (err) {
      setStatus({ loading: false, error: err, success: false });
      return;
    }

    setStatus({ loading: true, error: "", success: false });
    try {
      await registerUser({
        phone_number: normalizePhone(form.phone_number),
        password: form.password,
        password2: form.password2,
      });
      setPendingPhone(normalizePhone(form.phone_number));
      setOtpExpiry(Date.now() + OTP_DURATION_SECONDS * 1000);
      setStep("otp");
      setStatus({ loading: false, error: "", success: false });
    } catch (err) {
      setStatus({ loading: false, error: err.message, success: false });
    }
  };

  const handleOtpComplete = async (code) => {
    if (code.length !== 4) return;
    setStatus({ loading: true, error: "", success: false });

    try {
      const data = await verifyRegistrationOtp({
        phone_number: pendingPhone,
        code,
      });
      await login({ username: form.username, password: form.password });
      setStatus({ loading: false, error: "", success: true });
    } catch (err) {
      setOtpValue("");
      setStatus({ loading: false, error: err.message, success: false });
    }
  };

  const handleResendOtp = async () => {
    if (!pendingPhone) return;
    setStatus({ loading: true, error: "", success: false });
    try {
      await resendRegistrationOtp({ phone_number: pendingPhone });
      setOtpExpiry(Date.now() + OTP_DURATION_SECONDS * 1000);
      setOtpValue("");
      setStatus({ loading: false, error: "", success: false });
    } catch (err) {
      setStatus({ loading: false, error: err.message, success: false });
    }
  };

  if (step === "otp") {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center" dir="rtl">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#003087] text-white">
          <OtpIcon />
        </div>
        <div>
          <h3 className="text-[18px] font-bold text-[#1A1A2E]">کد تأیید</h3>
          <p className="mt-1 text-[13px] text-[#687173]">
            کد ۴ رقمی به شماره {pendingPhone} ارسال شد
          </p>
        </div>

        <div className="mt-2">
          <OtpInput
            value={otpValue}
            onChange={setOtpValue}
            onComplete={handleOtpComplete}
            loading={status.loading}
          />
        </div>

        <OtpCountdown
          expiresAt={otpExpiry}
          onResend={handleResendOtp}
          onResendReady={() => setStatus(s => ({ ...s, error: "" }))}
        />

        {status.error && <AuthAlert type="error" message={status.error} />}

        {status.loading && (
          <p className="text-[13px] text-[#687173]">در حال بررسی کد...</p>
        )}

        <button
          type="button"
          onClick={() => {
            setStep("register");
            setOtpValue("");
          }}
          className="mt-4 flex items-center gap-1 text-[13px] text-[#687173] hover:text-[#1A1A2E]"
        >
          <ArrowLeftIcon />
          ویرایش شماره
        </button>
      </div>
    );
  }

  if (status.success) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center" dir="rtl">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#10B981] text-white">
          <CheckIcon />
        </div>
        <div>
          <h3 className="text-[18px] font-bold text-[#1A1A2E]">ثبت‌نام موفق!</h3>
          <p className="mt-1 text-[13px] text-[#687173]">حساب شما ایجاد شد و وارد سایت شدید.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4" dir="rtl">
      <InputField
        id="r-phone"
        label="شماره موبایل *"
        type="tel"
        placeholder="09xxxxxxxxx"
        value={form.phone_number}
        onChange={(v) => set("phone_number")(normalizePhone(v))}
        icon={<PhoneIcon />}
        dir="ltr"
        autoComplete="tel"
      />

      <InputField
        id="r-username"
        label="نام کاربری *"
        placeholder="نام کاربری دلخواه"
        value={form.username}
        onChange={set("username")}
        icon={<UserIcon />}
        autoComplete="username"
      />

      <InputField
        id="r-password"
        label="رمز عبور *"
        type="password"
        placeholder="حداقل ۸ کاراکتر"
        value={form.password}
        onChange={set("password")}
        icon={<LockIcon />}
        autoComplete="new-password"
      />

      <InputField
        id="r-password2"
        label="تکرار رمز عبور *"
        type="password"
        placeholder="رمز عبور را دوباره وارد کنید"
        value={form.password2}
        onChange={set("password2")}
        icon={<LockIcon />}
        autoComplete="new-password"
      />

      {status.error && <AuthAlert type="error" message={status.error} />}

      <button
        type="submit"
        disabled={status.loading}
        className="h-12 w-full rounded-lg bg-[#003087] text-[15px] font-medium text-white transition-colors hover:bg-[#00246B] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#009CDE]/20 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status.loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            در حال ثبت‌نام...
          </span>
        ) : "ایجاد حساب کاربری"}
      </button>

      <p className="text-center text-[13px] text-[#687173]">
        حساب دارید؟{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-medium text-[#003087] hover:underline"
        >
          وارد شوید
        </button>
      </p>
    </form>
  );
}
