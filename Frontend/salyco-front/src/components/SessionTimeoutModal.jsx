import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Clock, LogOut, RotateCcw } from "lucide-react";
import { useAuth } from "../auth/authContext";
import { IDLE_TIMEOUT_MS, IDLE_WARNING_MS } from "../constants";
import { toPersianNumber } from "../utils/persian";

// Shown by AuthProvider once the user has been idle past IDLE_WARNING_MS, so a
// half-filled checkout isn't lost to a silent logout. Rendered once in App.jsx;
// it returns null unless the provider says the warning is up.

const WARNING_WINDOW_SECONDS = Math.round(
  (IDLE_TIMEOUT_MS - IDLE_WARNING_MS) / 1000,
);

// mm:ss with Persian digits. The caller must place this in a dir="ltr" element:
// a bare "01:47" inside a dir="rtl" container renders with the parts reversed.
function formatCountdown(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${toPersianNumber(minutes)}:${toPersianNumber(
    String(seconds).padStart(2, "0"),
  )}`;
}

export default function SessionTimeoutModal() {
  const { idleWarningOpen, secondsLeft, continueSession, logout } = useAuth();
  const navigate = useNavigate();
  const [entered, setEntered] = useState(false);
  const continueRef = useRef(null);

  // Play the entry transition on the first paint after the modal appears.
  useEffect(() => {
    if (!idleWarningOpen) return;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => {
      cancelAnimationFrame(id);
      setEntered(false);
    };
  }, [idleWarningOpen]);

  // Lock background scroll, focus the safe action, restore both on close.
  useEffect(() => {
    if (!idleWarningOpen) return;
    const previouslyFocused = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    continueRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [idleWarningOpen]);

  // Escape resolves to the non-destructive action.
  useEffect(() => {
    if (!idleWarningOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") continueSession();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idleWarningOpen, continueSession]);

  if (!idleWarningOpen) return null;

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  // Drains left-to-right as the remaining time runs out.
  const remainingRatio = Math.min(
    100,
    Math.max(0, (secondsLeft / WARNING_WINDOW_SECONDS) * 100),
  );

  return createPortal(
    <div
      dir="rtl"
      className={`fixed inset-0 z-[110] flex items-center justify-center bg-[#1A1A2E]/60 px-4 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none ${
        entered ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-timeout-title"
        aria-describedby="session-timeout-body"
        className={`w-full max-w-[420px] overflow-hidden rounded-2xl border border-[#CBD2D6] bg-white shadow-[0_12px_32px_rgba(0,48,135,0.14)] transition-transform duration-200 ease-out motion-reduce:transition-none ${
          entered ? "translate-y-0" : "translate-y-2"
        }`}
      >
        <div className="flex flex-col items-center gap-3 px-6 pt-7">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F5BA2E]/15 text-[#B8860B]">
            <Clock size={24} strokeWidth={2} />
          </span>

          <h2
            id="session-timeout-title"
            className="font-persian text-base font-bold text-[#1A1A2E]"
          >
            نشست شما در حال پایان است
          </h2>

          <p
            id="session-timeout-body"
            className="text-center font-persian text-[13px] leading-[1.9] text-[#687173]"
          >
            به دلیل نداشتن فعالیت، به‌زودی از حساب خود خارج می‌شوید. برای ادامه،
            دکمهٔ زیر را بزنید.
          </p>

          {/* dir="ltr" so mm:ss keeps its order inside this RTL dialog */}
          <p
            dir="ltr"
            aria-live="polite"
            className="font-persian text-3xl font-bold tabular-nums text-[#003087] [font-feature-settings:'tnum']"
          >
            {formatCountdown(secondsLeft)}
          </p>

          <div
            className="h-1 w-full overflow-hidden rounded-full bg-[#F5F7FA]"
            role="presentation"
          >
            <div
              className="h-full rounded-full bg-[#F5BA2E] transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
              style={{ width: `${remainingRatio}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 py-6">
          <button
            ref={continueRef}
            type="button"
            onClick={continueSession}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#003087] font-persian text-sm font-semibold text-white transition-colors hover:bg-[#00246B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009CDE] focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            <RotateCcw size={16} />
            ادامه نشست
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex h-11 items-center justify-center gap-2 rounded-lg border border-[#CBD2D6] px-4 font-persian text-sm font-medium text-[#D20000] transition-colors hover:bg-[#FDE7E7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009CDE] focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            <LogOut size={16} />
            خروج
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
