export function AuthTabs({ active, onChange }) {
  return (
    <div className="flex rounded-lg bg-[#F5F7FA] p-1 mb-7">
      {[
        { key: "login", label: "ورود" },
        { key: "register", label: "ثبت‌نام" },
      ].map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={[
            "flex-1 rounded-lg py-2 text-[14px] font-medium transition-all duration-200",
            active === key
              ? "bg-white text-[#003087] shadow-[0_1px_4px_rgba(0,48,135,0.06)] ring-[0.5px] ring-[#CBD2D6]"
              : "text-[#687173] hover:text-[#1A1A2E]",
          ].join(" ")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
