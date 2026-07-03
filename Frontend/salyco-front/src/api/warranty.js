import api from "../api";

export async function checkWarranty(serialNumber) {
  try {
    const res = await api.get(`/api/warranty/check/${serialNumber}/`);
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "محصول یافت نشد";
    throw new Error(msg);
  }
}

export async function registerWarranty(data) {
  try {
    const res = await api.post("/api/warranty/register/", data);
    return res.data;
  } catch (err) {
    const data_ = err.response?.data;
    const firstError =
      data_ && typeof data_ === "object"
        ? Object.values(data_).flat()[0]
        : null;
    throw new Error(firstError || "خطا در ثبت گارانتی");
  }
}

export async function getMyWarranties() {
  try {
    const res = await api.get("/api/warranty/my/");
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در دریافت لیست گارانتی‌ها";
    throw new Error(msg);
  }
}

export async function createMattressInstance(data) {
  try {
    const res = await api.post("/api/instances/", data);
    return res.data;
  } catch (err) {
    const data_ = err.response?.data;
    const firstError =
      data_ && typeof data_ === "object"
        ? Object.values(data_).flat()[0]
        : null;
    throw new Error(firstError || "خطا در ساخت نمونه محصول");
  }
}

export async function getMattressInstanceQR(serialNumber) {
  try {
    const res = await api.get(`/api/instances/${serialNumber}/qr/?format=json`);
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در دریافت QR کد";
    throw new Error(msg);
  }
}

export async function listMattresses() {
  try {
    const res = await api.get("/api/mattress/");
    return res.data;
  } catch {
    throw new Error("خطا در دریافت لیست محصولات");
  }
}

export async function getMattressDetail(slug) {
  try {
    const res = await api.get(`/api/mattresses/${slug}/`);
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "محصول یافت نشد";
    throw new Error(msg);
  }
}
