import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, XCircle, X } from "lucide-react";

const ToastContext = createContext(null);

// A toast raised immediately before a full page load would be thrown away with
// the rest of the React tree — which is exactly what the login flow does
// (AuthPage sends the user on with window.location.href). Handing the message
// to sessionStorage lets the next document pick it up and show it.
const PENDING_KEY = "salyco_pending_toast";

// Only replay a handed-over message if the reload actually happened, and
// happened just now. Without this, a toast stashed before a client-side
// navigation (no reload, so the key is never consumed) would resurface on the
// next real page load — a stale "login successful" hours later.
const PENDING_MAX_AGE_MS = 10_000;

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

function Toast({ id, type, message, onClose }) {
  const isSuccess = type === "success";

  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-[#CBD2D6] bg-white px-4 py-3 shadow-[0_4px_16px_rgba(0,48,135,0.1)] toast-enter"
      dir="rtl"
    >
      <div className={`flex-shrink-0 ${isSuccess ? "text-[#019C34]" : "text-[#D20000]"}`}>
        {isSuccess ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
      </div>
      <p className="flex-1 font-persian text-sm font-medium text-[#1A1A2E]">
        {message}
      </p>
      <button
        onClick={() => onClose(id)}
        className="flex-shrink-0 rounded p-1 text-[#687173] hover:bg-[#F5F7FA] transition-colors"
        aria-label="بستن"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = "success", options = {}) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);

    // `surviveReload` also hands the message to the next document, for callers
    // that are about to trigger one. Shown here as well, so the toast is
    // correct whether or not the reload actually follows.
    if (options.surviveReload) {
      try {
        sessionStorage.setItem(
          PENDING_KEY,
          JSON.stringify({ message, type, at: Date.now() }),
        );
      } catch {
        // Private-mode sessionStorage can throw; the toast above still showed.
      }
    }

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);

    return id;
  }, []);

  // Pick up a message handed over by the document that just unloaded. Read once
  // on mount, and always cleared, so it can never fire twice.
  useEffect(() => {
    let pending = null;
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      sessionStorage.removeItem(PENDING_KEY);
      if (raw) pending = JSON.parse(raw);
    } catch {
      pending = null;
    }
    if (!pending?.message) return;
    if (Date.now() - (pending.at ?? 0) > PENDING_MAX_AGE_MS) return;

    const id = Date.now() + Math.random();
    setToasts([{ id, message: pending.message, type: pending.type }]);
    const timer = setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      4000,
    );
    return () => clearTimeout(timer);
  }, []);

  const hideToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toasts.length > 0 &&
        createPortal(
          <div className="fixed top-[calc(var(--navbar-height)+1rem)] left-1/2 -translate-x-1/2 z-[120] flex flex-col gap-2 w-full max-w-md px-4">
            {toasts.map((toast) => (
              <Toast
                key={toast.id}
                id={toast.id}
                type={toast.type}
                message={toast.message}
                onClose={hideToast}
              />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}
