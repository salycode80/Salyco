import api from "../api";
import { REFRESH_TOKEN } from "../constants";

// POST /api/token/ — no auth header needed (public endpoint)
export async function loginUser({ username, password }) {
  try {
    const res = await api.post("/api/token/", { username, password });
    return res.data; // { access, refresh }
  } catch (err) {
    const data = err.response?.data;
    const msg =
      data?.detail ||
      data?.non_field_errors?.[0] ||
      "نام کاربری یا رمز عبور اشتباه است";
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

// POST /api/user/register/ — phone + password only (public endpoint).
// Returns {detail, phone_number, expires_in}: no tokens, because the account is
// inactive until the OTP is verified. `phone_number` is the server's normalised
// form (09XXXXXXXXX) and is what the verify call must send back.
export async function registerUser({ phone_number, password, password2 }) {
  try {
    const res = await api.post("/api/user/register/", {
      phone_number,
      password,
      password2,
    });
    return res.data;
  } catch (err) {
    throw new Error(firstErrorMessage(err, "خطا در ثبت‌ نام"));
  }
}

// POST /api/user/verify-otp/ — redeem the registration code.
// Returns {access, refresh} so the user lands logged in.
export async function verifyRegistrationOtp({ phone_number, code }) {
  try {
    const res = await api.post("/api/user/verify-otp/", { phone_number, code });
    return res.data;
  } catch (err) {
    throw new Error(firstErrorMessage(err, "کد تأیید نادرست است"));
  }
}

// POST /api/user/resend-otp/ — a fresh code for a signup awaiting verification.
export async function resendRegistrationOtp({ phone_number }) {
  try {
    const res = await api.post("/api/user/resend-otp/", { phone_number });
    return res.data; // { detail, expires_in }
  } catch (err) {
    throw new Error(firstErrorMessage(err, "ارسال مجدد کد ناموفق بود"));
  }
}

// POST /api/user/login-otp/ — always rejects for now.
// The backend answers 503 while the OTP code is a static stand-in: issuing
// tokens to anyone who types it would let a stranger sign in as the owner of
// any phone number. Kept as a real call so the flow works unchanged the day an
// SMS provider is added.
export async function requestLoginOtp({ phone_number }) {
  try {
    const res = await api.post("/api/user/login-otp/", { phone_number });
    return res.data;
  } catch (err) {
    throw new Error(
      firstErrorMessage(
        err,
        "ورود با رمز یک‌بار مصرف هنوز فعال نشده است. لطفاً با رمز عبور وارد شوید.",
      ),
    );
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
