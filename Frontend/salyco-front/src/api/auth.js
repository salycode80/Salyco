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

// POST /api/user/register/ — no auth header needed (public endpoint)
export async function registerUser({ username, email, password, first_name, last_name }) {
  const body = { username, email, password };
  if (first_name) body.first_name = first_name;
  if (last_name) body.last_name = last_name;

  try {
    const res = await api.post("/api/user/register/", body);
    return res.data;
  } catch (err) {
    const data = err.response?.data;
    const firstError =
      data && typeof data === "object"
        ? Object.values(data).flat()[0]
        : null;
    throw new Error(firstError || "خطا در ثبت‌ نام");
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
