import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { ACCESS_TOKEN } from "../constants";
import {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  mergeCart,
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
  const [loading, setLoading] = useState(false);
  // Track auth so we can detect the logged-out → logged-in transition.
  const wasAuthed = useRef(!!localStorage.getItem(ACCESS_TOKEN));

  const isAuthed = () => !!localStorage.getItem(ACCESS_TOKEN);

  // Load the appropriate cart on mount.
  const refresh = useCallback(async () => {
    if (isAuthed()) {
      setLoading(true);
      try {
        const data = await getCart();
        setItems(data.items || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    } else {
      setItems(normalizeLocal(readLocal()));
    }
  }, []);

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
      setItems(data.items || []);
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
  }, []);

  const updateItem = useCallback(async (id, quantity) => {
    if (isAuthed()) {
      const data = await updateCartItem(id, quantity);
      setItems(data.items || []);
      return;
    }
    const local = readLocal();
    const next =
      quantity < 1
        ? local.filter((i) => i.id !== id)
        : local.map((i) => (i.id === id ? { ...i, quantity } : i));
    writeLocal(next);
    setItems(normalizeLocal(next));
  }, []);

  const removeItem = useCallback(async (id) => {
    if (isAuthed()) {
      const data = await removeCartItem(id);
      setItems(data.items || []);
      return;
    }
    const next = readLocal().filter((i) => i.id !== id);
    writeLocal(next);
    setItems(normalizeLocal(next));
  }, []);

  const clear = useCallback(() => {
    if (!isAuthed()) {
      localStorage.removeItem(LOCAL_KEY);
    }
    setItems([]);
  }, []);

  const count = items.reduce((n, i) => n + i.quantity, 0);
  const total = items.reduce(
    (sum, i) => sum + Number(i.unit_price) * i.quantity,
    0
  );

  const value = {
    items,
    count,
    total,
    loading,
    addItem,
    updateItem,
    removeItem,
    clear,
    refresh,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
