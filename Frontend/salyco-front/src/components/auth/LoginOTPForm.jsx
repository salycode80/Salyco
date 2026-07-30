import { useState, useEffect, useRef } from "react";
import { InputField } from "./InputField";
import { AuthAlert } from "./AuthAlert";
import { requestLoginOtp, verifyRegistrationOtp } from "../../api/auth";
import { useAuth } from "../../hooks/UseAuth";

const PhoneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
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
    <div className="flex gap-2 justify-center" dir="ltr">
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
          className="text-[13px] font-medium text-[#003087] hover:underline"
        >
          ارسال مجدد کد
        </button>
      )}
    </div>
  );
}

export function LoginOTPForm({ onSwitchToPassword, onSwitchToRegister }) {
  const { login } = useAuth();
  const [step, setStep] = useState("phone");
  const [pendingPhone, setPendingPhone] = useState(null);
  const [otpExpiry, setOtpExpiry] = useState(null);

  const [phone, setPhone] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [status, setStatus] = useState({ loading: false, error: "", success: false });

  const normalizePhone = (p) => {
    const cleaned = p.replace(/\D/g, "");
    if (cleaned.startsWith("09")) return cleaned;
    if (cleaned.startsWith("9")) return "0" + cleaned;
    if (cleaned.startsWith("0") && cleaned.length > 1) return cleaned;
    return "0" + cleaned;
  };

  const handleRequestOtp = async (e) => {
    e?.preventDefault();

    if (!phone) {
      setStatus({ loading: false, error: "لطفاً شماره موبایل را وارد کنید", success: false });
      return;
    }

    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone.length !== 11 || !normalizedPhone.startsWith("09")) {
      setStatus({ loading: false, error: "شماره موبایل معتبر نیست", success: false });
      return;
    }

    setStatus({ loading: true, error: "", success: false });

    try {
      const data = await requestLoginOtp({ phone_number: normalizedPhone });
      setPendingPhone(normalizedPhone);
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
      const data = await verifyRegistrationOtp({ phone_number: pendingPhone, code });
      // Store tokens
      localStorage.setItem("accessToken", data.access);
      localStorage.setItem("refreshToken", data.refresh);
      setStatus({ loading: false, error: "", success: true });
      // Trigger auth update
      window.location.href = "/";
    } catch (err) {
      setOtpValue("");
      setStatus({ loading: false, error: err.message, success: false });
    }
  };

  const handleResendOtp = async () => {
    if (!pendingPhone) return;
    setStatus({ loading: true, error: "", success: false });
    try {
      await requestLoginOtp({ phone_number: pendingPhone });
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
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
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
            setStep("phone");
            setOtpValue("");
          }}
          className="mt-4 flex items-center gap-1 text-[13px] text-[#687173] hover:text-[#1A1A2E]"
        >
          <ArrowRightIcon />
          ویرایش شماره
        </button>
      </div>
    );
  }

  if (status.success) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center" dir="rtl">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#10B981] text-white">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div>
          <h3 className="text-[18px] font-bold text-[#1A1A2E]">ورود موفق!</h3>
          <p className="mt-1 text-[13px] text-[#687173]">در حال انتقال...</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleRequestOtp} noValidate className="flex flex-col gap-4" dir="rtl">
      <InputField
        id="login-otp-phone"
        label="شماره موبایل"
        type="tel"
        placeholder="09xxxxxxxxx"
        value={phone}
        onChange={(v) => setPhone(normalizePhone(v))}
        icon={<PhoneIcon />}
        dir="ltr"
        autoComplete="tel"
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
            در حال ارسال کد...
          </span>
        ) : "دریافت کد تأیید"}
      </button>

      <div className="text-center text-[13px] text-[#687173]">
        <button
          type="button"
          onClick={onSwitchToPassword}
          className="text-[#003087] hover:underline"
        >
          ورود با رمز عبور
        </button>
      </div>

      <p className="text-center text-[13px] text-[#687173]">
        حساب ندارید؟{" "}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="font-medium text-[#003087] hover:underline"
        >
          ثبت‌نام کنید
        </button>
      </p>
    </form>
  );
}
