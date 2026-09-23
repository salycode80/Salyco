import axios from "axios";
import api from "../api";

export async function getMyOrders() {
  try {
    const res = await api.get("/api/orders/my/");
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در دریافت سفارش‌ها";
    throw new Error(msg);
  }
}

export async function getPublicOrder(token) {
  // Deliberately a bare axios call, not the shared `api` instance. That
  // instance attaches whatever access token is in storage and, on a 401,
  // hard-redirects to /auth — so a visitor arriving from the SMS with an
  // expired session would be bounced to a login page instead of seeing the
  // order the link is for. This endpoint authorises on the URL token alone
  // and must be requested anonymously.
  try {
    const res = await axios.get(
      `${import.meta.env.VITE_API_URL}/api/orders/public/${token}/`,
    );
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) {
      throw new Error("سفارش یافت نشد");
    }
    throw new Error(err.response?.data?.detail || "خطا در دریافت سفارش");
  }
}

export async function cancelPublicOrder(token) {
  // Bare axios for the same reason as getPublicOrder(): the shared `api`
  // instance would attach a stale access token and bounce a 401 to /auth,
  // stranding a customer who is cancelling from the SMS link while signed out.
  try {
    const res = await axios.post(
      `${import.meta.env.VITE_API_URL}/api/orders/public/${token}/cancel/`,
    );
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) {
      throw new Error("سفارش یافت نشد");
    }
    throw new Error(err.response?.data?.detail || "خطا در لغو سفارش");
  }
}

export async function getAllowedLocations() {  try {
    const res = await api.get("/api/locations/allowed/");
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در دریافت مناطق مجاز";
    throw new Error(msg);
  }
}
