import { useState, useCallback } from "react";
import { InputField } from "./InputField";
import { AuthAlert } from "./AuthAlert";
import { OtpInput, OtpCountdown } from "./OtpInput";
import { startAuth, verifyAuthOtp, completeRegistration } from "../../api/auth";
import { useAuth } from "../../hooks/UseAuth";
import { useToast } from "../../context/ToastContext";

const PhoneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);
const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
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

const OTP_DURATION_SECONDS = 120;
const IDLE = { loading: false, error: "" };

// What the field shows while typing: digits only, and no more than a pasted
// "0098…" spelling needs. Deliberately does NOT add or move a leading zero. The
// old version normalised on every keystroke, so typing "0" was rewritten to "00"
// and backspacing it produced "00" again — the zero could not be deleted.
function sanitizePhoneInput(input) {
  return input.replace(/\D/g, "").slice(0, 14);
}

// Mirrors normalize_phone() in Backend/users/phone.py closely enough to catch a
// typo before it costs an SMS. The server normalises again and its answer is
// what the verify call echoes back, so the two cannot drift apart.
// Called on submit only — never while typing.
function normalizePhone(input) {
  let digits = input.replace(/\D/g, "");
  for (const prefix of ["0098", "98"]) {
    if (digits.startsWith(prefix) && digits.length === prefix.length + 10) {
      digits = digits.slice(prefix.length);
      break;
    }
  }
  if (digits.length === 10 && digits.startsWith("9")) digits = "0" + digits;
  return digits;
}

const isValidPhone = (p) => /^09\d{9}$/.test(p);

const Spinner = () => (
  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
  </svg>
);

function SubmitButton({ loading, loadingLabel, children }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="h-12 w-full rounded-lg bg-[#003087] text-[15px] font-medium text-white transition-colors hover:bg-[#00246B] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#009CDE]/20 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <Spinner />
          {loadingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * One entry point for signing in and signing up.
 *
 * The user types a phone number and a code; only then does the server say which
 * of the two this was. `mode` comes back from /auth/verify/ — "login" carries
 * tokens, "register" carries a signed registration_token and sends the user to
 * the name/password form. Nothing here has to guess up front, which is what the
 * two-tab version got wrong: a returning customer could land in the signup form
 * and be told their own number was taken.
 */
export function AuthFlow({ onSuccess }) {
  const { login, loginWithTokens } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState("phone");
  const [status, setStatus] = useState(IDLE);
  const [done, setDone] = useState(null); // "login" | "register" once finished

  const [phone, setPhone] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [otpExpiry, setOtpExpiry] = useState(null);

  // Set by /auth/verify/ when the number is new. Holds the phone server-side, so
  // the completion form never has to send it (and so it can't be swapped).
  const [registrationToken, setRegistrationToken] = useState(null);

  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    password: "",
    password2: "",
  });
  const [credentials, setCredentials] = useState({ phone: "", password: "" });

  const setProfileField = (field) => (value) =>
    setProfile((p) => ({ ...p, [field]: value }));

  const finish = (data, kind) => {
    loginWithTokens(data);
    setDone(kind);
    const message = kind === "register" ? "ثبت‌نام با موفقیت انجام شد!" : "ورود موفقیت‌آمیز بود!";
    // onSuccess may hand off with a full page load, which would discard the
    // toast — see surviveReload in ToastContext.
    showToast(message, "success", { surviveReload: true });
    // Let the confirmation render for a beat before the page changes.
    setTimeout(() => onSuccess?.(data), 900);
  };

  // ── Step 1: phone ──────────────────────────────────────────────────────────
  const sendCode = async (phoneNumber) => {
    const data = await startAuth({ phone_number: phoneNumber });
    // Trust the server's normalised form over the typed one.
    setPhone(data.phone_number || phoneNumber);
    setOtpExpiry(Date.now() + (data.expires_in ?? OTP_DURATION_SECONDS) * 1000);
  };

  const handlePhoneSubmit = async (e) => {
    e?.preventDefault();
    const normalized = normalizePhone(phone);

    if (!normalized) {
      setStatus({ loading: false, error: "لطفاً شماره موبایل را وارد کنید" });
      return;
    }
    if (!isValidPhone(normalized)) {
      setStatus({ loading: false, error: "شماره موبایل معتبر نیست" });
      return;
    }

    setStatus({ loading: true, error: "" });
    try {
      await sendCode(normalized);
      setOtpValue("");
      setStep("otp");
      setStatus(IDLE);
    } catch (err) {
      setStatus({ loading: false, error: err.message });
    }
  };

  // ── Step 2: the code ───────────────────────────────────────────────────────
  // Memoised: OtpInput fires onComplete from an effect that depends on it, so an
  // unstable identity would re-fire the effect on every render.
  const handleOtpComplete = useCallback(
    async (code) => {
      if (code.length !== 4) return;
      setStatus({ loading: true, error: "" });

      try {
        const data = await verifyAuthOtp({ phone_number: phone, code });

        if (data.mode === "login") {
          finish(data, "login");
          return;
        }

        // New number — verified, but there is no account yet.
        setRegistrationToken(data.registration_token);
        setStep("complete");
        setStatus(IDLE);
      } catch (err) {
        setOtpValue("");
        setStatus({ loading: false, error: err.message });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phone],
  );

  const handleResend = async () => {
    setStatus({ loading: true, error: "" });
    try {
      await sendCode(phone);
      setOtpValue("");
      setStatus(IDLE);
    } catch (err) {
      setStatus({ loading: false, error: err.message });
    }
  };

  const clearError = useCallback(() => setStatus((s) => ({ ...s, error: "" })), []);

  // ── Step 3: name + password, for a new account ─────────────────────────────
  const handleCompleteSubmit = async (e) => {
    e?.preventDefault();

    if (!profile.first_name.trim()) {
      setStatus({ loading: false, error: "لطفاً نام خود را وارد کنید" });
      return;
    }
    if (!profile.last_name.trim()) {
      setStatus({ loading: false, error: "لطفاً نام خانوادگی خود را وارد کنید" });
      return;
    }
    if (profile.password.length < 8) {
      setStatus({ loading: false, error: "رمز عبور باید حداقل ۸ کاراکتر باشد" });
      return;
    }
    if (profile.password !== profile.password2) {
      setStatus({ loading: false, error: "رمز عبور و تکرار آن یکسان نیستند" });
      return;
    }

    setStatus({ loading: true, error: "" });
    try {
      const data = await completeRegistration({
        registration_token: registrationToken,
        first_name: profile.first_name.trim(),
        last_name: profile.last_name.trim(),
        password: profile.password,
        password2: profile.password2,
      });
      finish(data, "register");
    } catch (err) {
      setStatus({ loading: false, error: err.message });
    }
  };

  // ── Alternative: password ──────────────────────────────────────────────────
  const handlePasswordSubmit = async (e) => {
    e?.preventDefault();
    const normalized = normalizePhone(credentials.phone);

    if (!normalized || !credentials.password) {
      setStatus({
        loading: false,
        error: "لطفاً شماره موبایل و رمز عبور را وارد کنید",
      });
      return;
    }

    setStatus({ loading: true, error: "" });
    try {
      // The account's username is the phone number, so that is what /api/token/
      // is given.
      const data = await login({
        username: normalized,
        password: credentials.password,
      });
      setDone("login");
      showToast("ورود موفقیت‌آمیز بود!", "success");
      setTimeout(() => onSuccess?.(data), 900);
    } catch (err) {
      setStatus({ loading: false, error: err.message });
    }
  };

  const goToPhoneStep = () => {
    setStep("phone");
    setOtpValue("");
    setStatus(IDLE);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  // Checked first: the confirmation is reached from inside another step, so
  // testing `step` before this would leave it unreachable.
  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center" dir="rtl">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#10B981] text-white">
          <CheckIcon />
        </div>
        <div>
          <h3 className="text-[18px] font-bold text-[#1A1A2E]">
            {done === "register" ? "ثبت‌نام موفق!" : "ورود موفق!"}
          </h3>
          <p className="mt-1 text-[13px] text-[#687173]">در حال انتقال...</p>
        </div>
      </div>
    );
  }

  if (step === "otp") {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center" dir="rtl">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#003087] text-white">
          <OtpIcon />
        </div>
        <div>
          <h3 className="text-[18px] font-bold text-[#1A1A2E]">کد تأیید</h3>
          <p className="mt-1 text-[13px] text-[#687173]">
            کد ۴ رقمی به شماره <span dir="ltr">{phone}</span> ارسال شد
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
          onResend={handleResend}
          onResendReady={clearError}
        />

        {status.error && <AuthAlert type="error" message={status.error} />}

        {status.loading && (
          <p className="text-[13px] text-[#687173]">در حال بررسی کد...</p>
        )}

        <button
          type="button"
          onClick={goToPhoneStep}
          className="mt-4 flex items-center gap-1 text-[13px] text-[#687173] hover:text-[#1A1A2E]"
        >
          <ArrowRightIcon />
          ویرایش شماره
        </button>
      </div>
    );
  }

  if (step === "complete") {
    return (
      <form
        onSubmit={handleCompleteSubmit}
        noValidate
        className="flex flex-col gap-4"
        dir="rtl"
      >
        <div className="text-center">
          <h3 className="text-[18px] font-bold text-[#1A1A2E]">تکمیل ثبت‌نام</h3>
          <p className="mt-1 text-[13px] text-[#687173]">
            شماره <span dir="ltr">{phone}</span> تأیید شد. برای ساخت حساب، اطلاعات
            زیر را وارد کنید.
          </p>
        </div>

        <InputField
          id="signup-first-name"
          label="نام *"
          placeholder="نام خود را وارد کنید"
          value={profile.first_name}
          onChange={setProfileField("first_name")}
          icon={<UserIcon />}
          autoComplete="given-name"
        />

        <InputField
          id="signup-last-name"
          label="نام خانوادگی *"
          placeholder="نام خانوادگی خود را وارد کنید"
          value={profile.last_name}
          onChange={setProfileField("last_name")}
          icon={<UserIcon />}
          autoComplete="family-name"
        />

        <InputField
          id="signup-password"
          label="رمز عبور *"
          type="password"
          placeholder="حداقل ۸ کاراکتر"
          value={profile.password}
          onChange={setProfileField("password")}
          icon={<LockIcon />}
          autoComplete="new-password"
        />

        <InputField
          id="signup-password2"
          label="تکرار رمز عبور *"
          type="password"
          placeholder="رمز عبور را دوباره وارد کنید"
          value={profile.password2}
          onChange={setProfileField("password2")}
          icon={<LockIcon />}
          autoComplete="new-password"
        />

        {status.error && <AuthAlert type="error" message={status.error} />}

        <SubmitButton loading={status.loading} loadingLabel="در حال ثبت‌نام...">
          ایجاد حساب کاربری
        </SubmitButton>
      </form>
    );
  }

  if (step === "password") {
    return (
      <form
        onSubmit={handlePasswordSubmit}
        noValidate
        className="flex flex-col gap-4"
        dir="rtl"
      >
        <InputField
          id="login-phone"
          label="شماره موبایل"
          type="tel"
          placeholder="09xxxxxxxxx"
          value={credentials.phone}
          onChange={(v) =>
            setCredentials((c) => ({ ...c, phone: sanitizePhoneInput(v) }))
          }
          icon={<PhoneIcon />}
          dir="ltr"
          autoComplete="tel"
        />

        <InputField
          id="login-password"
          label="رمز عبور"
          type="password"
          placeholder="رمز عبور را وارد کنید"
          value={credentials.password}
          onChange={(v) => setCredentials((c) => ({ ...c, password: v }))}
          icon={<LockIcon />}
          autoComplete="current-password"
        />

        {status.error && <AuthAlert type="error" message={status.error} />}

        <SubmitButton loading={status.loading} loadingLabel="در حال ورود...">
          ورود به حساب
        </SubmitButton>

        <div className="text-center text-[13px] text-[#687173]">
          <button
            type="button"
            onClick={() => {
              setStep("phone");
              setStatus(IDLE);
            }}
            className="text-[#003087] hover:underline"
          >
            ورود با کد تأیید
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={handlePhoneSubmit}
      noValidate
      className="flex flex-col gap-4"
      dir="rtl"
    >
      <div className="text-center">
        <h3 className="text-[18px] font-bold text-[#1A1A2E]">
          ورود به حساب کاربری
        </h3>
        <p className="mt-1 text-[13px] text-[#687173]">
          شماره موبایل خود را وارد کنید. اگر حساب نداشته باشید، ساخته می‌شود.
        </p>
      </div>

      <InputField
        id="auth-phone"
        label="شماره موبایل"
        type="tel"
        placeholder="09xxxxxxxxx"
        value={phone}
        onChange={(v) => setPhone(sanitizePhoneInput(v))}
        icon={<PhoneIcon />}
        dir="ltr"
        autoComplete="tel"
      />

      {status.error && <AuthAlert type="error" message={status.error} />}

      <SubmitButton loading={status.loading} loadingLabel="در حال ارسال کد...">
        دریافت کد تأیید
      </SubmitButton>

      <div className="text-center text-[13px] text-[#687173]">
        <button
          type="button"
          onClick={() => {
            setStep("password");
            setStatus(IDLE);
          }}
          className="text-[#003087] hover:underline"
        >
          ورود با رمز عبور
        </button>
      </div>
    </form>
  );
}
