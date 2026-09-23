import { useState, useEffect, useRef } from "react";

// The 4-digit code box and its countdown. Both were duplicated verbatim in the
// old LoginOTPForm and RegisterForm; the unified flow needs one copy.

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

export function OtpInput({ value, onChange, onComplete, loading }) {
  const inputRefs = useRef([]);
  // Guards against re-submitting the same code. The effect below depends on
  // `onComplete`, which the parent re-creates on every render — without this
  // latch, each submit re-renders the parent, hands down a new callback, and
  // re-fires the effect, so one typed code turns into a burst of requests.
  // Only the first is accepted server-side (the OTP is burned on use); the rest
  // come back 400 and the error they set is what the user ends up seeing.
  const submittedRef = useRef(null);

  useEffect(() => {
    if (value.length !== 4) {
      // Re-arm once the field is cleared, so a corrected code can be sent.
      if (value.length === 0) submittedRef.current = null;
      return;
    }
    if (submittedRef.current === value) return;
    submittedRef.current = value;
    onComplete(value);
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
          aria-label={`رقم ${i + 1} کد تأیید`}
          className="h-14 w-12 rounded-lg border border-brand-mist text-center text-[24px] font-bold text-text-primary focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20 outline-none transition-all"
        />
      ))}
    </div>
  );
}

export function OtpCountdown({ expiresAt, onResend, onResendReady }) {
  const [remaining, setRemaining] = useState(null);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;

    // A new expiry means a new code, so the resend link has to go away again.
    setCanResend(false);

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
      <p className="text-[13px] text-text-secondary">
        کد تأیید تا{" "}
        <span className="font-medium text-text-primary">
          {minutes}:{seconds.toString().padStart(2, "0")}
        </span>{" "}
        معتبر است
      </p>
      {canResend && (
        <button
          type="button"
          onClick={onResend}
          className="flex items-center gap-1 text-[13px] font-medium text-brand-navy hover:underline"
        >
          <RefreshIcon />
          ارسال مجدد کد
        </button>
      )}
    </div>
  );
}
