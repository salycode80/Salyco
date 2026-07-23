import api from "../api";

export async function createOrder(data) {
  try {
    const res = await api.post("/api/orders/", data);
    return res.data;
  } catch (err) {
    const data_ = err.response?.data;
    const firstError =
      data_ && typeof data_ === "object"
        ? data_.detail || Object.values(data_).flat()[0]
        : null;
    throw new Error(firstError || "خطا در ثبت سفارش");
  }
}

export async function getMyOrders() {
  try {
    const res = await api.get("/api/orders/my/");
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در دریافت سفارش‌ها";
    throw new Error(msg);
  }
}

export async function getAllowedLocations() {
  try {
    const res = await api.get("/api/locations/allowed/");
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در دریافت مناطق مجاز";
    throw new Error(msg);
  }
}
