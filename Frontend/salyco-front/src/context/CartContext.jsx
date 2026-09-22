import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { ACCESS_TOKEN } from "../constants";
import {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  mergeCart,
  applyCartCoupon,
  removeCartCoupon,
} from "../api/cart";

const CartContext = createContext(null);

const LOCAL_KEY = "salyco_cart";

// ── local (logged-out) cart helpers ──────────────────────────────────────────
// Shape mirrors the server cart item enough for the UI: a stable local id, the
// mattress/size ids used for the server merge, and denormalized display fields.
function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocal(items) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
}

function normalizeLocal(items) {
  // Derive line_total/count-friendly fields the UI expects.
  return items.map((it) => ({
    ...it,
    line_total: Number(it.unit_price) * it.quantity,
  }));
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [coupon, setCoupon] = useState(null);
  // Toman off, as the server computed it. Kept separate from `items` because
  // which lines are eligible is the server's call, not something the client can
  // derive from the item list alone.
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(false);
  // Track auth so we can detect the logged-out → logged-in transition.
  const wasAuthed = useRef(!!localStorage.getItem(ACCESS_TOKEN));

  const isAuthed = () => !!localStorage.getItem(ACCESS_TOKEN);

  // Every server cart response carries items, coupon and discount_amount
  // together, so they are applied together — there is no state in which the
  // items have arrived and the discount has not.
  const applyCartState = useCallback((data) => {
    setItems(data.items || []);
    setCoupon(data.coupon || null);
    setDiscount(Number(data.discount_amount || 0));
  }, []);

  // Load the appropriate cart on mount.
  const refresh = useCallback(async () => {
    if (isAuthed()) {
      setLoading(true);
      try {
        const data = await getCart();
        applyCartState(data);
      } catch {
        setItems([]);
        setCoupon(null);
        setDiscount(0);
      } finally {
        setLoading(false);
      }
    } else {
      setItems(normalizeLocal(readLocal()));
      setCoupon(null);
      setDiscount(0);
    }
  }, [applyCartState]);

  // When the user logs in, push the local cart to the server then reload.
  const syncOnLogin = useCallback(async () => {
    const local = readLocal();
    try {
      if (local.length > 0) {
        await mergeCart(
          local.map((it) => ({
            mattress_id: it.mattress,
            size_id: it.size || null,
            quantity: it.quantity,
          }))
        );
        localStorage.removeItem(LOCAL_KEY);
      }
    } catch {
      /* keep local cart if merge fails */
    }
    await refresh();
  }, [refresh]);

  // On mount, load the right cart. If the visitor is authed but a non-empty
  // local cart still exists, they just logged in via a full page reload (the
  // login flow does window.location = "/"), so the logged-out → logged-in
  // transition below never fires. Merge the leftover local cart here.
  useEffect(() => {
    if (isAuthed() && readLocal().length > 0) {
      syncOnLogin();
    } else {
      refresh();
    }
  }, [refresh, syncOnLogin]);

  // Poll auth transitions (login/logout happen in other components without a
  // shared event). Cheap: just reads a localStorage flag.
  useEffect(() => {
    const interval = setInterval(() => {
      const now = isAuthed();
      if (now !== wasAuthed.current) {
        wasAuthed.current = now;
        if (now) {
          syncOnLogin();
        } else {
          setItems(normalizeLocal(readLocal()));
          // The coupon lived on the server cart, so it goes with it — leaving
          // it would show a discount against a cart it was never applied to.
          setCoupon(null);
          setDiscount(0);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [syncOnLogin]);

  // ── mutations ──────────────────────────────────────────────────────────────
  const addItem = useCallback(async (mattress, size, quantity = 1) => {
    if (isAuthed()) {
      const data = await addCartItem({
        mattress_id: mattress.id,
        size_id: size?.id || null,
        quantity,
      });
      applyCartState(data);
      return;
    }
    // Logged out: merge into the local cart by (mattress, size).
    const local = readLocal();
    const key = (i) => `${i.mattress}-${i.size || 0}`;
    const incoming = {
      id: `local-${mattress.id}-${size?.id || 0}`,
      mattress: mattress.id,
      mattress_name: mattress.name,
      mattress_slug: mattress.slug,
      // Mirrors the server serializer's mattress_category so a logged-out cart
      // row links to /products/<category>/<slug> like a logged-in one does.
      mattress_category: mattress.category || "mattress",
      mattress_image: mattress.image || null,
      size: size?.id || null,
      size_label: size?.label || "",
      quantity,
      // Mirror the server's CartItem.unit_price: the discounted price when the
      // mattress is on sale, so a local cart totals the same as a server one.
      unit_price: Number(
        size
          ? size.discount_price ?? size.price
          : mattress.discount_price ?? mattress.price
      ),
    };
    const existing = local.find((i) => key(i) === key(incoming));
    const next = existing
      ? local.map((i) =>
          key(i) === key(incoming)
            ? { ...i, quantity: i.quantity + quantity }
            : i
        )
      : [...local, incoming];
    writeLocal(next);
    setItems(normalizeLocal(next));
  }, [applyCartState]);

  const updateItem = useCallback(async (id, quantity) => {
    if (isAuthed()) {
      const data = await updateCartItem(id, quantity);
      applyCartState(data);
      return;
    }
    const local = readLocal();
    const next =
      quantity < 1
        ? local.filter((i) => i.id !== id)
        : local.map((i) => (i.id === id ? { ...i, quantity } : i));
    writeLocal(next);
    setItems(normalizeLocal(next));
  }, [applyCartState]);

  const removeItem = useCallback(async (id) => {
    if (isAuthed()) {
      const data = await removeCartItem(id);
      applyCartState(data);
      return;
    }
    const next = readLocal().filter((i) => i.id !== id);
    writeLocal(next);
    setItems(normalizeLocal(next));
  }, [applyCartState]);

  // Both throw the server's Persian message on failure so the caller can show
  // err.message directly; neither swallows it the way the cart mutations do,
  // because a refused code is the whole point of the interaction.
  const applyCoupon = useCallback(async (code) => {
    applyCartState(await applyCartCoupon(code));
  }, [applyCartState]);

  const removeCoupon = useCallback(async () => {
    applyCartState(await removeCartCoupon());
  }, [applyCartState]);

  const clear = useCallback(() => {
    if (!isAuthed()) {
      localStorage.removeItem(LOCAL_KEY);
    }
    setItems([]);
    setCoupon(null);
    setDiscount(0);
  }, []);

  const count = items.reduce((n, i) => n + i.quantity, 0);
  const subtotal = items.reduce(
    (sum, i) => sum + Number(i.unit_price) * i.quantity,
    0
  );
  // Uniform for both carts: `discount` is always 0 when signed out, because a
  // coupon needs a server-side cart to hang off.
  const total = Math.max(subtotal - discount, 0);

  const value = {
    items,
    count,
    subtotal,
    discount,
    coupon,
    total,
    loading,
    addItem,
    updateItem,
    removeItem,
    clear,
    refresh,
    applyCoupon,
    removeCoupon,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
