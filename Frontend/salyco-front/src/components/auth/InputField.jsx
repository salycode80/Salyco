import { useState } from "react";

export function InputField({
  id,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  dir = "rtl",
  icon,
  error,
  autoComplete,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const resolvedType = isPassword ? (showPassword ? "text" : "password") : type;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={id}
          className="text-[13px] font-medium text-[#000c3e]"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {/* right icon */}
        {icon && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#000c3e]/30">
            {icon}
          </span>
        )}

        <input
          id={id}
          type={resolvedType}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir={dir}
          autoComplete={autoComplete}
          className={[
            "w-full h-[42px] rounded-[10px] border bg-white text-[14px] text-[#000c3e]",
            "placeholder:text-[#000c3e]/30 outline-none transition-all duration-200",
            icon ? "pr-9" : "pr-3",
            isPassword ? "pl-9" : "pl-3",
            error
              ? "border-red-400 focus:ring-2 focus:ring-red-100"
              : "border-[#000c3e]/15 focus:border-[#001a5c] focus:ring-2 focus:ring-[#001a5c]/10",
          ].join(" ")}
        />

        {/* password toggle */}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#000c3e]/30 hover:text-[#000c3e]/60 transition-colors"
            aria-label={showPassword ? "پنهان کردن رمز" : "نمایش رمز"}
          >
            {showPassword ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        )}
      </div>

      {error && (
        <p className="text-[12px] text-red-500">{error}</p>
      )}
    </div>
  );
}
