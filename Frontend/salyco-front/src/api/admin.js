import api from "../api";

// Build a query string from a params object, dropping empty values.
function qs(params = {}) {
  const clean = Object.entries(params).filter(
    ([, v]) => v !== "" && v !== null && v !== undefined
  );
  const s = new URLSearchParams(clean).toString();
  return s ? `?${s}` : "";
}

export async function getAdminStats() {
  try {
    const res = await api.get("/api/admin/stats/");
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در دریافت آمار";
    throw new Error(msg);
  }
}

export async function listAdminInstances(params) {
  try {
    const res = await api.get(`/api/admin/instances/${qs(params)}`);
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در دریافت لیست محصولات";
    throw new Error(msg);
  }
}

export async function getAdminInstance(serialNumber) {
  try {
    const res = await api.get(
      `/api/admin/instances/${encodeURIComponent(serialNumber)}/`
    );
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در دریافت جزئیات محصول";
    throw new Error(msg);
  }
}

export async function listAdminCustomers(params) {
  try {
    const res = await api.get(`/api/admin/customers/${qs(params)}`);
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در دریافت لیست مشتریان";
    throw new Error(msg);
  }
}

// Downloads a CSV export as a file. `kind` = "instances" | "customers".
export async function exportAdminCsv(kind, params) {
  try {
    const res = await api.get(`/api/admin/${kind}/export/${qs(params)}`, {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${kind}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch {
    throw new Error("خطا در دریافت خروجی");
  }
}
