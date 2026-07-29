import { createContext, useContext } from "react";

// The context object and its hook live apart from <AuthProvider> so that
// context/AuthContext.jsx exports a component and nothing else — Vite's fast
// refresh (and the react-refresh/only-export-components lint rule) requires a
// module not to mix component and non-component exports.
export const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
