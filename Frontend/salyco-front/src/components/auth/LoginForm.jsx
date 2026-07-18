import { useState } from "react";
import { InputField } from "./InputField";
import { AuthAlert } from "./AuthAlert";
import { useAuth } from "../../hooks/UseAuth";

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

export function LoginForm({ onSwitchToRegister, onSuccess }) {
  const { login } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [status, setStatus] = useState({ loading: false, error: "", success: "" });

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!form.username || !form.password) {
      setStatus({ loading: false, error: "لطفاً نام کاربری و رمز عبور را وارد کنید", success: "" });
      return;
    }
    setStatus({ loading: true, error: "", success: "" });
    try {
      const data = await login(form);
      setStatus({ loading: false, error: "", success: "ورود موفق! در حال انتقال..." });
      onSuccess?.(data);
    } catch (err) {
      setStatus({ loading: false, error: err.message, success: "" });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5" dir="rtl">
      <InputField
        id="login-username"
        label="نام کاربری"
        placeholder="نام کاربری خود را وارد کنید"
        value={form.username}
        onChange={set("username")}
        icon={<UserIcon />}
        autoComplete="username"
      />

      <InputField
        id="login-password"
        label="رمز عبور"
        type="password"
        placeholder="رمز عبور را وارد کنید"
        value={form.password}
        onChange={set("password")}
        icon={<LockIcon />}
        autoComplete="current-password"
      />

      {(status.error || status.success) && (
        <AuthAlert
          type={status.error ? "error" : "success"}
          message={status.error || status.success}
        />
      )}

      <button
        type="submit"
        disabled={status.loading}
        className="h-12 w-full rounded-lg bg-[#003087] text-[15px] font-medium text-white transition-colors hover:bg-[#00246B] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status.loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            در حال ورود...
          </span>
        ) : "ورود به حساب"}
      </button>

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
