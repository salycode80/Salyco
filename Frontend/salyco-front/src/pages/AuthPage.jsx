import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AuthTabs } from "../components/Auth/AuthTabs";
import { LoginForm } from "../components/Auth/LoginForm";
import { RegisterForm } from "../components/Auth/RegisterForm";

export default function AuthPage() {
  const [tab, setTab] = useState("login");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirect = searchParams.get("redirect");

  const handleLoginSuccess = () => {
    if (redirect) {
      navigate(redirect, { replace: true });
    } else {
      window.location.href = "/";
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 pt-[var(--navbar-height)] font-[Vazirmatn,sans-serif]">
      <div className="flex items-center justify-center bg-[#F5F7FA] px-4 py-8 sm:px-5 sm:py-12">
        <div className="w-full max-w-[420px]">
          <div className="rounded-[20px] border border-[rgba(100,160,255,0.15)] bg-white px-8 py-8 shadow-sm">
            <AuthTabs active={tab} onChange={setTab} />

            <div className="overflow-hidden">
              {tab === "login" ? (
                <LoginForm
                  onSwitchToRegister={() => setTab("register")}
                  onSuccess={handleLoginSuccess}
                />
              ) : (
                <RegisterForm onSwitchToLogin={() => setTab("login")} />
              )}
            </div>
          </div>

          <p className="mt-5 text-center text-[12px] text-[#000c3e]/30" dir="rtl">
            © {new Date().getFullYear()} سالیکو — تمامی حقوق محفوظ است
          </p>
        </div>
      </div>
    </div>
  );
}
