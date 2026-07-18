import { useState } from "react";
import { InputField } from "./InputField";
import { AuthAlert } from "./AuthAlert";
import { useAuth } from "../../hooks/UseAuth";

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
  </svg>
);
const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

export function RegisterForm({ onSwitchToLogin }) {
  const { register } = useAuth();
  const [form, setForm] = useState({
    first_name: "", last_name: "", username: "", email: "", password: "", password2: "",
  });
  const [status, setStatus] = useState({ loading: false, error: "", success: false });

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  const validate = () => {
    if (!form.username || !form.email || !form.password) return "لطفاً همه فیلدهای ضروری را پر کنید";
    if (form.password !== form.password2) return "رمز عبور و تکرار آن یکسان نیستند";
    if (form.password.length < 8) return "رمز عبور باید حداقل ۸ کاراکتر باشد";
    if (!/\S+@\S+\.\S+/.test(form.email)) return "آدرس ایمیل معتبر نیست";
    return null;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const err = validate();
    if (err) { setStatus({ loading: false, error: err, success: false }); return; }
    setStatus({ loading: true, error: "", success: false });
    try {
      await register(form);
      setStatus({ loading: false, error: "", success: true });
    } catch (err) {
      setStatus({ loading: false, error: err.message, success: false });
    }
  };

  if (status.success) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center" dir="rtl">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#003087] text-white">
          <CheckIcon />
        </div>
        <div>
          <h3 className="text-[18px] font-bold text-[#1A1A2E]">ثبت‌نام موفق!</h3>
          <p className="mt-1 text-[13px] text-[#687173]">حساب شما ایجاد شد. اکنون می‌توانید وارد شوید.</p>
        </div>
        <button
          onClick={onSwitchToLogin}
          className="mt-2 h-12 w-full max-w-[220px] rounded-lg bg-[#003087] text-[14px] font-medium text-white hover:bg-[#00246B] active:scale-[0.98] transition-colors"
        >
          رفتن به صفحه ورود
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4" dir="rtl">
      <div className="grid grid-cols-2 gap-3">
        <InputField id="r-first" label="نام" placeholder="نام" value={form.first_name} onChange={set("first_name")} icon={<UserIcon />} />
        <InputField id="r-last" label="نام خانوادگی" placeholder="نام خانوادگی" value={form.last_name} onChange={set("last_name")} icon={<UserIcon />} />
      </div>

      <InputField
        id="r-username" label="نام کاربری *" placeholder="نام کاربری دلخواه"
        value={form.username} onChange={set("username")} icon={<UserIcon />} autoComplete="username"
      />

      <InputField
        id="r-email" label="ایمیل *" type="email" placeholder="example@email.com"
        value={form.email} onChange={set("email")} icon={<MailIcon />}
        dir="ltr" autoComplete="email"
      />

      <InputField
        id="r-password" label="رمز عبور *" type="password" placeholder="حداقل ۸ کاراکتر"
        value={form.password} onChange={set("password")} icon={<LockIcon />} autoComplete="new-password"
      />

      <InputField
        id="r-password2" label="تکرار رمز عبور *" type="password" placeholder="رمز عبور را دوباره وارد کنید"
        value={form.password2} onChange={set("password2")} icon={<LockIcon />} autoComplete="new-password"
      />

      {status.error && <AuthAlert type="error" message={status.error} />}

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
            در حال ثبت‌نام...
          </span>
        ) : "ایجاد حساب کاربری"}
      </button>

      <p className="text-center text-[13px] text-[#687173]">
        حساب دارید؟{" "}
        <button type="button" onClick={onSwitchToLogin} className="font-medium text-[#003087] hover:underline">
          وارد شوید
        </button>
      </p>
    </form>
  );
}
