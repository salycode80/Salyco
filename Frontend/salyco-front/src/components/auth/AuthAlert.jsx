export function AuthAlert({ type, message }) {
  if (!message) return null;

  const styles = {
    success: "bg-status-success-bg border-brand-mist text-status-success",
    error: "bg-status-error-bg border-brand-mist text-status-error",
  };

  const icons = {
    success: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
    error: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
  };

  return (
    <div
      dir="rtl"
      className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px] font-medium ${styles[type]}`}
    >
      <span className="flex-shrink-0">{icons[type]}</span>
      <span>{message}</span>
    </div>
  );
}
