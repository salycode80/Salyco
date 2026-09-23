import { useSearchParams, useNavigate } from "react-router-dom";
import { AuthAlert } from "../components/auth/AuthAlert";
import { AuthFlow } from "../components/auth/AuthFlow";

// Why the user was sent here, when they didn't come on their own. Both cases mean
// the same thing to the user: the session is gone and they need to sign in again.
// "idle" comes from the inactivity timeout in AuthProvider, "expired" from the
// 401/refresh-failure path in api.js.
const REASON_MESSAGES = {
  idle: "نشست شما به دلیل نداشتن فعالیت پایان یافت. لطفاً دوباره وارد شوید",
  expired: "نشست منقضی شده است. لطفاً دوباره وارد شوید",
};

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirect = searchParams.get("redirect");
  const reasonMessage = REASON_MESSAGES[searchParams.get("reason")];

  const handleSuccess = () => {
    if (redirect) {
      navigate(redirect, { replace: true });
    } else {
      window.location.href = "/";
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 pt-[var(--navbar-height)] font-[Vazirmatn,sans-serif]">
      <div className="flex items-center justify-center bg-brand-warm-white px-4 py-8 sm:px-5 sm:py-12">
        <div className="w-full max-w-[420px]">
          <div className="rounded-xl border border-brand-mist bg-white px-8 py-8 shadow-[0_1px_4px_rgba(5,46,95,0.06)]">
            {reasonMessage && (
              <div className="mb-5">
                <AuthAlert type="error" message={reasonMessage} />
              </div>
            )}

            {/* No login/register tabs: the flow is linear now, and which of the
                two it turns out to be is decided by the server after the code
                is verified. See AuthFlow. */}
            <AuthFlow onSuccess={handleSuccess} />
          </div>

          <p
            className="mt-5 text-center text-[12px] text-text-secondary"
            dir="rtl"
          >
            © {new Date().getFullYear()} سالیکو — تمامی حقوق محفوظ است
          </p>
        </div>
      </div>
    </div>
  );
}
