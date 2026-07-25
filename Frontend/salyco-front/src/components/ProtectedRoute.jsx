import { Navigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/UseAuth";
import { ACCESS_TOKEN } from "../constants";

function ProtectedRoute({ children }) {
  const { isAuthenticated, refresh, logout } = useAuth();
  const [checking, setChecking] = useState(true);
  const location = useLocation();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem(ACCESS_TOKEN);

    if (!token) {
      logout();
      setChecking(false);
      return;
    }

    try {
      const { exp } = jwtDecode(token);
      const isExpired = exp < Date.now() / 1000;

      if (isExpired) {
        await refresh(); // interceptor already handles this, but explicit check on mount
      }
    } catch {
      logout();
    } finally {
      setChecking(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FA]">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="animate-spin h-8 w-8 text-[#003087]"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-20"
              cx="12" cy="12" r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-80"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8z"
            />
          </svg>
          <p className="text-[13px] text-[#687173] font-[Vazirmatn,sans-serif]">
            در حال بررسی...
          </p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) return children;

  // Send the user to login, remembering where they were headed so we can
  // return them there (SPA navigation) instead of dropping them on the home
  // page after a full reload.
  const redirect = encodeURIComponent(location.pathname + location.search);
  return <Navigate to={`/auth?redirect=${redirect}`} replace />;
}

export default ProtectedRoute;