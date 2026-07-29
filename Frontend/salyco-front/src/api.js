import axios from "axios";
import { clearTokens, getAccess, getRefresh, saveTokens } from "./auth/tokenStorage";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// ── Request interceptor ──────────────────────────────────────────────────────
// Attaches the access token to every request that has one in storage.
api.interceptors.request.use(
  (config) => {
    const token = getAccess();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor ─────────────────────────────────────────────────────
// On 401, attempt a silent token refresh then replay the original request once.
// If the refresh also fails, clear storage and redirect to /auth.

let isRefreshing = false;
let pendingQueue = []; // requests waiting for the new token

const processQueue = (error, token = null) => {
  pendingQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token)
  );
  pendingQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Only attempt refresh on 401 and only once per request (_retry flag)
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // Skip refresh loop for the refresh endpoint itself. A 401 here means the
    // refresh token is gone or past its 31-minute window — i.e. the session
    // expired through inactivity, so say so on the login page.
    if (original.url?.includes("/api/token/refresh/")) {
      clearTokens();
      redirectToAuth("expired");
      return Promise.reject(error);
    }

    original._retry = true;

    if (isRefreshing) {
      // Queue this request until the in-flight refresh resolves
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    isRefreshing = true;

    const refresh = getRefresh();
    if (!refresh) {
      clearTokens();
      redirectToAuth();
      return Promise.reject(error);
    }

    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/token/refresh/`,
        { refresh }
      );

      // ROTATE_REFRESH_TOKENS is on, so the response carries a *new* refresh
      // token whose 31-minute clock starts now. Dropping it here would strand
      // the session on the original token and log the user out mid-session.
      saveTokens(data);
      api.defaults.headers.common.Authorization = `Bearer ${data.access}`;
      processQueue(null, data.access);

      original.headers.Authorization = `Bearer ${data.access}`;
      return api(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearTokens();
      redirectToAuth("expired");
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

function redirectToAuth(reason) {
  if (window.location.pathname !== "/auth") {
    const query = reason ? `?reason=${encodeURIComponent(reason)}` : "";
    window.location.href = `/auth${query}`;
  }
}

export default api;
