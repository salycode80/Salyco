import { useState, useCallback } from "react";
import { loginUser, registerUser, refreshAccessToken } from "../api/auth";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "../constants";

export function useAuth() {
  const [tokens, setTokens] = useState(() => ({
    access: localStorage.getItem(ACCESS_TOKEN) || null,
    refresh: localStorage.getItem(REFRESH_TOKEN) || null,
  }));

  const login = useCallback(async (credentials) => {
    const data = await loginUser(credentials);
    localStorage.setItem(ACCESS_TOKEN, data.access);
    localStorage.setItem(REFRESH_TOKEN, data.refresh);
    setTokens({ access: data.access, refresh: data.refresh });
    return data;
  }, []);

  const register = useCallback(async (userInfo) => {
    return await registerUser(userInfo);
  }, []);

  const refresh = useCallback(async () => {
    const data = await refreshAccessToken();
    localStorage.setItem(ACCESS_TOKEN, data.access);
    setTokens((prev) => ({ ...prev, access: data.access }));
    return data.access;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(ACCESS_TOKEN);
    localStorage.removeItem(REFRESH_TOKEN);
    setTokens({ access: null, refresh: null });
  }, []);

  return {
    tokens,
    isAuthenticated: !!tokens.access,
    login,
    register,
    refresh,
    logout,
  };
}