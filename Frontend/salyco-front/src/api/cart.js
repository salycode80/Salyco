import api from "../api";

// Server-backed cart endpoints. Used only when the visitor is logged in; the
// logged-out cart lives in localStorage (see CartContext).

export async function getCart() {
  try {
    const res = await api.get("/api/cart/");
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در دریافت سبد خرید";
    throw new Error(msg);
  }
}

export async function addCartItem(payload) {
  try {
    const res = await api.post("/api/cart/items/", payload);
    return res.data;
  } catch (err) {
    const data_ = err.response?.data;
    const firstError =
      data_ && typeof data_ === "object"
        ? data_.detail || Object.values(data_).flat()[0]
        : null;
    throw new Error(firstError || "خطا در افزودن به سبد خرید");
  }
}

export async function updateCartItem(id, quantity) {
  try {
    const res = await api.patch(`/api/cart/items/${id}/`, { quantity });
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در بروزرسانی سبد خرید";
    throw new Error(msg);
  }
}

export async function removeCartItem(id) {
  try {
    const res = await api.delete(`/api/cart/items/${id}/`);
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در حذف از سبد خرید";
    throw new Error(msg);
  }
}

// Merge the pre-login local cart into the server cart after login.
export async function mergeCart(items) {
  try {
    const res = await api.post("/api/cart/merge/", { items });
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در همگام‌سازی سبد خرید";
    throw new Error(msg);
  }
}

// Applying and removing a code both answer with the whole cart payload — the
// server owns the money arithmetic (which lines are eligible, how the
// percentage rounds), so the client never recomputes a discount.
export async function applyCartCoupon(code) {
  try {
    const res = await api.post("/api/cart/coupon/", { code });
    return res.data;
  } catch (err) {
    // The server writes these in Persian and they are shown verbatim, which is
    // why the rule wording lives there and not here.
    const msg = err.response?.data?.detail || "خطا در اعمال کد تخفیف";
    // `cause` keeps the axios error (status, request, response) reachable from
    // the console — the message alone is what the customer sees.
    throw new Error(msg, { cause: err });
  }
}

export async function removeCartCoupon() {
  try {
    const res = await api.delete("/api/cart/coupon/");
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در حذف کد تخفیف";
    throw new Error(msg, { cause: err });
  }
}
