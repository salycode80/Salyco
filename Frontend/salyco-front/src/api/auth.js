import api from "../api";
import { REFRESH_TOKEN } from "../constants";

// POST /api/token/ — no auth header needed (public endpoint).
// `username` is the phone number: that is what the account is created with.
export async function loginUser({ username, password }) {
  try {
    const res = await api.post("/api/token/", { username, password });
    return res.data; // { access, refresh }
  } catch (err) {
    const data = err.response?.data;
    const msg =
      data?.detail ||
      data?.non_field_errors?.[0] ||
      "شماره موبایل یا رمز عبور اشتباه است";
    throw new Error(msg);
  }
}

// Pull the first human-readable string out of a DRF error body, which is either
// {field: [msg]}, {detail: msg}, or a bare list.
function firstErrorMessage(err, fallback) {
  const data = err.response?.data;
  if (typeof data === "string") return data || fallback;
  if (Array.isArray(data)) return data.flat()[0] || fallback;
  if (data && typeof data === "object") {
    if (typeof data.detail === "string") return data.detail;
    const first = Object.values(data).flat()[0];
    if (typeof first === "string") return first;
  }
  return fallback;
}

// ── Unified login/registration ───────────────────────────────────────────────
// One flow for both: post a phone number, then a code, and the server says
// which of the two it turned out to be. Nothing here needs to know up front.

// POST /api/user/auth/start/ — send a code, and find out what this number is.
// Returns {detail, mode, phone_number, expires_in} where mode is "login" for a
// registered number or "register" for a new one. `phone_number` comes back
// normalised (09XXXXXXXXX) and is what the verify call must send.
//
// Also the resend call: the server retires the previous code when it issues a
// new one, so calling this again is safe.
export async function startAuth({ phone_number }) {
  try {
    const res = await api.post("/api/user/auth/start/", { phone_number });
    return res.data;
  } catch (err) {
    throw new Error(firstErrorMessage(err, "ارسال کد تأیید ناموفق بود"));
  }
}

// POST /api/user/auth/verify/ — redeem the code.
// Returns {mode: "login", access, refresh} for an existing account, or
// {mode: "register", phone_number, registration_token} for a new number, where
// there is no account to issue tokens for yet. Callers must branch on `mode`.
export async function verifyAuthOtp({ phone_number, code }) {
  try {
    const res = await api.post("/api/user/auth/verify/", { phone_number, code });
    return res.data;
  } catch (err) {
    throw new Error(firstErrorMessage(err, "کد تأیید نادرست است"));
  }
}

// POST /api/user/auth/complete/ — create the account and log in.
// The phone number travels inside registration_token (signed by the server at
// the verify step), not as a field, so it cannot be swapped for another one.
export async function completeRegistration({
  registration_token,
  first_name,
  last_name,
  password,
  password2,
}) {
  try {
    const res = await api.post("/api/user/auth/complete/", {
      registration_token,
      first_name,
      last_name,
      password,
      password2,
    });
    return res.data; // { detail, access, refresh }
  } catch (err) {
    throw new Error(firstErrorMessage(err, "تکمیل ثبت‌نام ناموفق بود"));
  }
}

// POST /api/token/refresh/ — uses stored refresh token
export async function refreshAccessToken() {
  const refresh = localStorage.getItem(REFRESH_TOKEN);
  if (!refresh) throw new Error("توکن یافت نشد");

  try {
    const res = await api.post("/api/token/refresh/", { refresh });
    return res.data; // { access }
  } catch {
    throw new Error("نشست منقضی شده است. لطفاً دوباره وارد شوید");
  }
}
