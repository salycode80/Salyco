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

// ── Reviews moderation ────────────────────────────────────────────────────────

export async function listAdminReviews(params) {
  try {
    const res = await api.get(`/api/admin/reviews/${qs(params)}`);
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در دریافت نظرات";
    throw new Error(msg);
  }
}

// Approve a review (is_approved: true) — refreshes the mattress rating cache.
export async function updateAdminReview(id, data) {
  try {
    const res = await api.patch(`/api/admin/reviews/${id}/`, data);
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در بروزرسانی نظر";
    throw new Error(msg);
  }
}

// Reject/remove a review entirely.
export async function deleteAdminReview(id) {
  try {
    await api.delete(`/api/admin/reviews/${id}/`);
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در حذف نظر";
    throw new Error(msg);
  }
}

// ── Suggestions (نظرات و پیشنهادات) ───────────────────────────────────────────

export async function listAdminSuggestions(params) {
  try {
    const res = await api.get(`/api/admin/suggestions/${qs(params)}`);
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در دریافت پیشنهادات";
    throw new Error(msg);
  }
}

// Mark a suggestion read/unread.
export async function updateAdminSuggestion(id, data) {
  try {
    const res = await api.patch(`/api/admin/suggestions/${id}/`, data);
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در بروزرسانی پیام";
    throw new Error(msg);
  }
}

export async function deleteAdminSuggestion(id) {
  try {
    await api.delete(`/api/admin/suggestions/${id}/`);
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در حذف پیام";
    throw new Error(msg);
  }
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function listAdminOrders(params) {
  try {
    const res = await api.get(`/api/admin/orders/${qs(params)}`);
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در دریافت سفارش‌ها";
    throw new Error(msg);
  }
}

// Change an order's status (e.g. PENDING → CONFIRMED → SHIPPED).
export async function updateAdminOrder(id, data) {
  try {
    const res = await api.patch(`/api/admin/orders/${id}/`, data);
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در بروزرسانی سفارش";
    throw new Error(msg);
  }
}

export async function deleteAdminOrder(id) {
  try {
    await api.delete(`/api/admin/orders/${id}/`);
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در حذف سفارش";
    throw new Error(msg);
  }
}

// ── Allowed ordering areas (مناطق مجاز ارسال) ─────────────────────────────────

export async function listAdminLocations() {
  try {
    const res = await api.get("/api/admin/locations/");
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در دریافت مناطق";
    throw new Error(msg);
  }
}

export async function createAdminLocation(data) {
  try {
    const res = await api.post("/api/admin/locations/", data);
    return res.data;
  } catch (err) {
    const data_ = err.response?.data;
    const firstError =
      data_ && typeof data_ === "object"
        ? data_.detail || Object.values(data_).flat()[0]
        : null;
    throw new Error(firstError || "خطا در افزودن منطقه");
  }
}

export async function updateAdminLocation(id, data) {
  try {
    const res = await api.patch(`/api/admin/locations/${id}/`, data);
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در بروزرسانی منطقه";
    throw new Error(msg);
  }
}

export async function deleteAdminLocation(id) {
  try {
    await api.delete(`/api/admin/locations/${id}/`);
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در حذف منطقه";
    throw new Error(msg);
  }
}

// ── Warranty review queue (تأیید گارانتی‌ها) ───────────────────────────────────

export async function listAdminWarrantyRequests(params) {
  try {
    const res = await api.get(`/api/admin/warranty-requests/${qs(params)}`);
    return res.data;
  } catch (err) {
    const msg =
      err.response?.data?.detail || "خطا در دریافت درخواست‌های گارانتی";
    throw new Error(msg);
  }
}

// `data` is {action: "approve"} or {action: "reject", rejection_reason: "..."}.
// Surfaces the field errors too, not just `detail`: a stale queue produces
// "این درخواست قبلاً بررسی شده است" and an empty reason produces a
// rejection_reason error, and the panel shows both to the admin.
export async function reviewAdminWarrantyRequest(serialNumber, data) {
  try {
    const res = await api.patch(
      `/api/admin/warranty-requests/${encodeURIComponent(serialNumber)}/`,
      data
    );
    return res.data;
  } catch (err) {
    const data_ = err.response?.data;
    const firstError =
      data_ && typeof data_ === "object"
        ? data_.detail || Object.values(data_).flat()[0]
        : null;
    throw new Error(firstError || "خطا در بررسی درخواست گارانتی");
  }
}
