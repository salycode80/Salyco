import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { loginUser } from "../api/auth";
import { AuthContext } from "../auth/authContext";
import {
  ACCESS_TOKEN,
  LAST_ACTIVITY,
  IDLE_TIMEOUT_MS,
  IDLE_WARNING_MS,
  KEEPALIVE_INTERVAL_MS,
  ACTIVITY_THROTTLE_MS,
  IDLE_CHECK_INTERVAL_MS,
  assertTimingInvariants,
} from "../constants";
import {
  clearTokens,
  getAccess,
  getRefresh,
  markActivity,
  markKeepAlive,
  readLastActivity,
  readLastKeepAlive,
  saveTokens,
} from "../auth/tokenStorage";

// Auth state plus the 30-minute inactivity timeout. Both live here because the
// provider mounts exactly once: a standalone useIdleTimeout() hook could be
// called by any of the six useAuth() consumers and would then run six timers,
// six keep-alives and six competing redirects.
//
// The session ends IDLE_TIMEOUT_MS after the last user interaction. That is
// enforced here, on the client. The backend backstop is the refresh token's
// 31-minute lifetime, which each keep-alive rotation slides forward — see the
// SIMPLE_JWT comment in Backend/core/settings.py for the exact guarantee.

// [event, passive]. Deliberately no `mousemove`: trackpad jitter alone would
// keep a session alive indefinitely, which defeats the point.
const ACTIVITY_EVENTS = [
  ["pointerdown", false],
  ["keydown", false],
  ["scroll", true],
  ["touchstart", true],
];

export function AuthProvider({ children }) {
  const navigate = useNavigate();

  const [tokens, setTokens] = useState(() => ({
    access: getAccess(),
    refresh: getRefresh(),
  }));
  const [idleWarningOpen, setIdleWarningOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Last time an activity stamp was written (leading-edge throttle). A ref, not
  // module state, so a StrictMode remount starts clean.
  const lastWriteRef = useRef(0);
  // Latch so the expiry redirect cannot fire twice (StrictMode double-mount, or
  // the check interval racing the storage listener).
  const expiredRef = useRef(false);

  const isAuthenticated = !!tokens.access;

  useEffect(() => {
    assertTimingInvariants();
  }, []);

  const login = useCallback(async (credentials) => {
    const data = await loginUser(credentials);
    saveTokens(data);
    markActivity();
    markKeepAlive();
    setTokens({ access: data.access, refresh: data.refresh });
    return data;
  }, []);

  // Enter a session from a token pair the server already issued. The OTP flows
  // get theirs from /api/user/verify-otp/, so there are no credentials left to
  // post to loginUser() — and for a phone signup there never were any that would
  // work, since the account's username is the phone number, not anything the
  // user typed. Same bookkeeping as login(), minus the credential exchange.
  const loginWithTokens = useCallback((data) => {
    saveTokens(data);
    markActivity();
    markKeepAlive();
    setTokens({ access: data.access, refresh: data.refresh });
    return data;
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setTokens({ access: null, refresh: null });
    setIdleWarningOpen(false);
  }, []);

  // Exchange the refresh token for a fresh pair. Uses a bare axios call rather
  // than the `api` instance on purpose: a 401 through `api` would hit its
  // response interceptor, which fires its own clearTokens + hard redirect and
  // would clobber the ?reason= this module wants to set.
  const refresh = useCallback(async () => {
    const refreshToken = getRefresh();
    if (!refreshToken) throw new Error("توکن یافت نشد");

    const { data } = await axios.post(
      `${import.meta.env.VITE_API_URL}/api/token/refresh/`,
      { refresh: refreshToken },
    );

    // ROTATE_REFRESH_TOKENS is on, so `data.refresh` is a new token with a fresh
    // 31-minute window. Keeping it is what makes the session slide.
    saveTokens(data);
    markKeepAlive();
    setTokens({
      access: data.access,
      refresh: data.refresh ?? refreshToken,
    });
    return data.access;
  }, []);

  const expireSession = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;

    clearTokens();
    setTokens({ access: null, refresh: null });
    setIdleWarningOpen(false);

    // Read the location off window rather than useLocation() so the provider
    // doesn't re-render (and re-render CartProvider and the whole tree) on every
    // navigation just to keep this string current.
    const here = window.location.pathname + window.location.search;
    const params = new URLSearchParams({ reason: "idle" });
    if (here !== "/" && !here.startsWith("/auth")) {
      params.set("redirect", here);
    }
    navigate(`/auth?${params.toString()}`, { replace: true });
  }, [navigate]);

  const continueSession = useCallback(() => {
    markActivity();
    lastWriteRef.current = Date.now();
    setIdleWarningOpen(false);
    // Slide the server window now instead of waiting for the next keep-alive
    // tick, so the very next request is guaranteed a live token. If the token is
    // already past saving, end the session here rather than leaving the user in
    // a zombie state where every request 401s.
    refresh().catch(() => expireSession());
  }, [refresh, expireSession]);

  // ── Idle tracking ────────────────────────────────────────────────────────
  // Nothing below is armed for anonymous visitors, who are most of the traffic.
  useEffect(() => {
    if (!isAuthenticated) return;

    expiredRef.current = false;

    // Never stamp "now" on mount — a page reload would reset the idle clock on
    // every F5 and the timeout would never fire. Seed only when truly absent.
    if (readLastActivity() === null) markActivity();

    const idleFor = () => Date.now() - (readLastActivity() ?? 0);

    const check = () => {
      const idle = idleFor();
      if (idle >= IDLE_TIMEOUT_MS) {
        expireSession();
      } else if (idle >= IDLE_WARNING_MS) {
        setSecondsLeft(Math.max(0, Math.ceil((IDLE_TIMEOUT_MS - idle) / 1000)));
        setIdleWarningOpen(true);
      } else {
        setIdleWarningOpen(false);
      }
    };

    const touch = () => {
      const now = Date.now();
      // Leading edge: write immediately, then ignore for a tick. This can end a
      // session up to ACTIVITY_THROTTLE_MS early, which is the safe direction.
      if (now - lastWriteRef.current < ACTIVITY_THROTTLE_MS) return;
      lastWriteRef.current = now;
      markActivity(now);
      setIdleWarningOpen(false);
    };

    const keepAlive = () => {
      const lastActivity = readLastActivity() ?? 0;
      const lastPing = readLastKeepAlive() ?? 0;
      const now = Date.now();

      // Don't prop up a session that is already over.
      if (now - lastActivity >= IDLE_TIMEOUT_MS) return;
      // Collapse N open tabs to roughly one request per interval.
      if (now - lastPing < KEEPALIVE_INTERVAL_MS) return;
      // No interaction since the last rotation means the window doesn't need to
      // move. This is the gate that ties session length to actual activity: a
      // user reading a long article scrolls but makes no API calls, and without
      // this their refresh token would quietly expire underneath them.
      if (lastActivity <= lastPing) return;

      markKeepAlive(now);
      refresh().catch(() => {
        // Network blip or a dead refresh token; the check interval decides.
      });
    };

    const onStorage = (e) => {
      if (e.key === ACCESS_TOKEN && e.newValue === null) {
        // Another tab logged out or expired. Mirror it locally — that tab owns
        // whatever message its user sees, so don't claim "idle" in this one.
        logout();
        return;
      }
      if (e.key === LAST_ACTIVITY) check();
    };

    // Becoming visible must re-check, never stamp activity: treating it as
    // activity would silently extend the session of someone returning after
    // hours, and the timeout would never fire.
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };

    ACTIVITY_EVENTS.forEach(([name, passive]) =>
      window.addEventListener(name, touch, passive ? { passive: true } : false),
    );
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);

    // Re-testing elapsed time on an interval survives hidden-tab timer clamping
    // and laptop suspend; one long setTimeout(30min) does not.
    const checkTimer = setInterval(check, IDLE_CHECK_INTERVAL_MS);
    const keepAliveTimer = setInterval(keepAlive, KEEPALIVE_INTERVAL_MS);
    // Catch the "reloaded after being away past the timeout" case now rather
    // than up to IDLE_CHECK_INTERVAL_MS later.
    const initialCheck = setTimeout(check, 0);

    return () => {
      ACTIVITY_EVENTS.forEach(([name]) =>
        window.removeEventListener(name, touch),
      );
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(checkTimer);
      clearInterval(keepAliveTimer);
      clearTimeout(initialCheck);
    };
  }, [isAuthenticated, expireSession, logout, refresh]);

  // The 1s countdown runs only while the modal is up, not for 28 minutes.
  useEffect(() => {
    if (!idleWarningOpen) return;
    const timer = setInterval(() => {
      const remaining = IDLE_TIMEOUT_MS - (Date.now() - (readLastActivity() ?? 0));
      setSecondsLeft(Math.max(0, Math.ceil(remaining / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [idleWarningOpen]);

  const value = useMemo(
    () => ({
      tokens,
      isAuthenticated,
      login,
      loginWithTokens,
      refresh,
      logout,
      idleWarningOpen,
      secondsLeft,
      continueSession,
    }),
    [
      tokens,
      isAuthenticated,
      login,
      loginWithTokens,
      refresh,
      logout,
      idleWarningOpen,
      secondsLeft,
      continueSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
