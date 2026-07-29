import {
  ACCESS_TOKEN,
  REFRESH_TOKEN,
  LAST_ACTIVITY,
  LAST_KEEPALIVE,
} from "../constants";

// Token + activity persistence. Deliberately plain (no React, no axios) so both
// api.js and context/AuthContext.jsx can import it without a cycle.
//
// Note that writing to localStorage fires a `storage` event in *other* tabs only,
// never in the writing tab — that asymmetry is what makes cross-tab session
// syncing work without an echo.

// Storage can throw (Safari private mode, disabled cookies, quota). Auth must
// degrade to "logged out" rather than crash the app on boot.
function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — the in-memory session still works for this tab */
  }
}

function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing to do */
  }
}

export const getAccess = () => read(ACCESS_TOKEN);
export const getRefresh = () => read(REFRESH_TOKEN);

// Persist a token pair. `refresh` is optional because /api/token/refresh/ only
// returns one when ROTATE_REFRESH_TOKENS is on — never clear a good refresh
// token just because a response omitted it.
export function saveTokens({ access, refresh } = {}) {
  if (access) write(ACCESS_TOKEN, access);
  if (refresh) write(REFRESH_TOKEN, refresh);
}

export function clearTokens() {
  remove(ACCESS_TOKEN);
  remove(REFRESH_TOKEN);
  remove(LAST_ACTIVITY);
  remove(LAST_KEEPALIVE);
}

// ── Idle tracking ──────────────────────────────────────────────────────────

// Stamp "the user did something just now". Callers throttle; this is a raw write.
export function markActivity(at = Date.now()) {
  write(LAST_ACTIVITY, String(at));
  return at;
}

// Epoch ms of the last interaction, or null when unknown. Returns null rather
// than Date.now() for a missing/corrupt value so callers decide whether an
// unknown timestamp means "fresh session" or "expired" — defaulting to now here
// would silently extend a session on every reload.
export function readLastActivity() {
  const raw = read(LAST_ACTIVITY);
  if (!raw) return null;
  const at = Number(raw);
  return Number.isFinite(at) ? at : null;
}

export function readLastKeepAlive() {
  const raw = read(LAST_KEEPALIVE);
  if (!raw) return null;
  const at = Number(raw);
  return Number.isFinite(at) ? at : null;
}

export function markKeepAlive(at = Date.now()) {
  write(LAST_KEEPALIVE, String(at));
  return at;
}
