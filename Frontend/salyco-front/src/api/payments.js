import api from "../api";

// Starts a Zibal payment session for the current cart. Returns the gateway URL
// the browser must be sent to. Errors are unwrapped the same way as
// api/orders.js so callers can show err.message directly.
export async function startPayment(data) {
  try {
    const res = await api.post("/api/payments/start/", data);
    return res.data;
  } catch (err) {
    const body = err.response?.data;
    const firstError =
      body && typeof body === "object"
        ? body.detail || Object.values(body).flat()[0]
        : null;
    throw new Error(firstError || "خطا در اتصال به درگاه پرداخت");
  }
}

// The authoritative outcome of one payment, read from the database rather than
// from the query string the gateway redirected with. Used by the result page so
// a reload or a bookmarked URL still shows the truth.
export async function getPaymentStatus(trackId) {
  try {
    const res = await api.get(`/api/payments/${trackId}/status/`);
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در دریافت وضعیت پرداخت";
    throw new Error(msg);
  }
}
