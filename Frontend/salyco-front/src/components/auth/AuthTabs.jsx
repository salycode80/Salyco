export function AuthTabs({ active, onChange }) {
  return (
    <div className="flex rounded-[10px] bg-[#F5F7FA] p-1 mb-7">
      {[
        { key: "login", label: "ورود" },
        { key: "register", label: "ثبت‌نام" },
      ].map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={[
            "flex-1 rounded-[8px] py-2 text-[14px] font-medium transition-all duration-200",
            active === key
              ? "bg-white text-[#000c3e] shadow-sm ring-[0.5px] ring-[#000c3e]/10"
              : "text-[#000c3e]/50 hover:text-[#000c3e]/80",
          ].join(" ")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
