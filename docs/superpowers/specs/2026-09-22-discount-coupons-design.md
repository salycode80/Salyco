# Discount codes (coupons) — design

Date: 2026-09-22
Status: approved in chat, awaiting spec review

## Problem

Salyco has a per-product sale (`Mattress.off_percentage`) and nothing else. Staff
cannot run a campaign that is a *code*: they cannot expire it, cap it, limit it to
certain products, require a minimum order, or see who used it. There is also no way
to give a one-off discount to a specific customer without putting the whole
catalogue on sale.

This adds a coupon system with an admin panel, scoped through the existing cart →
order → payment flow so that the amount sent to Zibal, the amount shown on the
order page, and the amount staff see all agree.

## Decisions taken with the client

1. **Both discount types.** A coupon is `PERCENT` (1–99) or `FIXED` (a Toman amount).
2. **Product-scoped coupons discount only the eligible line items.** The
   minimum-order threshold is measured against that same eligible subtotal.
3. **Coupons stack on the sale price.** The cart's `unit_price` already *is* the
   sale price (`CartItem.unit_price` → `Mattress.final_price`), so discounting the
   eligible line totals gives stacking for free. A 20%-off product with a 10% coupon
   lands at 28% off list.
4. **A use counts only when payment is verified.** An abandoned bank page burns
   nothing. The discount is still frozen on the order at redirect, so the price
   cannot move mid-payment.

## Structural choices

**The models live in the `orders` app**, with the eligibility and arithmetic in a
new `orders/promotions.py`. The coupon belongs to the cart → order aggregate
(`Cart.coupon`, `Order.coupon`) and `PaymentStartView` must call the engine; a
separate `promotions` app would import `orders` for those foreign keys while
`orders/checkout.py` imports it back. Keeping the engine in its own module gives
the same separation the checkout module already documents for itself, without the
cycle.

**The applied coupon is persisted on the cart**, not passed in the checkout
payload. The site already keeps one persistent cart per customer and the customer
must see the reduction before deciding to pay. It is re-validated at
`PaymentStartView` so a cart left open overnight cannot carry an expired price into
the gateway.

## Data model

All additions to `orders/models.py`. `Coupon` and `CouponProduct` are declared
above `Order` (so `Order.coupon` can use the class directly); `CouponRedemption` is
declared after `OrderItem`.

```python
class Coupon(models.Model):
    PERCENT = "PERCENT"
    FIXED = "FIXED"
    DISCOUNT_TYPE_CHOICES = [(PERCENT, "Percent"), (FIXED, "Fixed amount")]

    code = models.CharField(max_length=32, unique=True)
    description = models.CharField(max_length=255, blank=True, default="")

    discount_type = models.CharField(
        max_length=10, choices=DISCOUNT_TYPE_CHOICES, default=PERCENT
    )
    percent = models.PositiveIntegerField(null=True, blank=True)          # 1..99
    amount = models.DecimalField(
        max_digits=18, decimal_places=2, null=True, blank=True
    )                                                                     # Toman
    # Bounds a percent coupon. Ignored for FIXED, where `amount` is already the cap.
    max_discount_amount = models.DecimalField(
        max_digits=18, decimal_places=2, null=True, blank=True
    )
    # Measured against the ELIGIBLE subtotal, per decision 2.
    min_order_amount = models.DecimalField(
        max_digits=18, decimal_places=2, default=0
    )

    # Null means unbounded on that side. Both are compared against timezone.now().
    starts_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    # Null means unlimited. Counted over non-cancelled orders only (see Engine).
    usage_limit = models.PositiveIntegerField(null=True, blank=True)
    per_customer_limit = models.PositiveIntegerField(null=True, blank=True)

    applies_to_all_products = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)   # kill switch, independent of dates

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
```

`Coupon.save()` normalises `self.code = " ".join(self.code.split()).upper()` before
writing, so lookups can be a plain `code__iexact` against a trimmed value. Uppercasing
is a no-op for Persian codes, which are allowed; the only rejected input is a code
that is empty or longer than 32 characters after trimming.

`Coupon.clean()` enforces the cross-field rules that a single field cannot:

- `PERCENT` → `percent` required and 1–99, `amount` must be null.
- `FIXED` → `amount` required and greater than zero, `percent` must be null.
- `expires_at` must be after `starts_at` when both are set.
- `applies_to_all_products` false → at least one `CouponProduct` row.

Percent is capped at 99 rather than 100 for a concrete reason: a 100% coupon makes
the payable amount zero, and `PaymentStartView` already refuses an amount at or
below `MIN_AMOUNT_RIAL` because Zibal cannot charge zero. Allowing 100 would create
a coupon that can be created in the panel and can never be redeemed.

```python
class CouponProduct(models.Model):
    """The admin's «محصولات مشمول» list. Scoped per product; all of a product's
    sizes follow it, because a size has no independent campaign meaning here."""
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name="products")
    mattress = models.ForeignKey(Mattress, on_delete=models.CASCADE, related_name="+")

    class Meta:
        unique_together = [("coupon", "mattress")]


class CouponRedemption(models.Model):
    """One row per PAID order that used a coupon. Written by settlement, never at
    redirect — see decision 4."""
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name="redemptions")
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name="redemption")
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="+")
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
```

On `Cart`: `coupon = models.ForeignKey(Coupon, null=True, blank=True,
on_delete=models.SET_NULL, related_name="+")`.

On `Order`: three additions.

```python
coupon = models.ForeignKey(
    Coupon, null=True, blank=True, on_delete=models.PROTECT, related_name="orders"
)
# Snapshot: a coupon renamed or deactivated later must not rewrite history.
coupon_code = models.CharField(max_length=32, blank=True, default="")
discount_amount = models.DecimalField(max_digits=18, decimal_places=2, default=0)
```

`total_amount` keeps its current meaning — what the customer owes — so every
existing consumer (payment amount, SMS, public order page, admin panel) stays
correct with no change. The subtotal is not stored: it stays derivable from
`OrderItem.line_total` so the two cannot drift.

`on_delete=PROTECT` on `Order.coupon` means a redeemed coupon cannot be deleted.
The admin API turns that into a Persian message rather than a 500.

### Cart money properties

```python
@property
def subtotal(self) -> Decimal:     # the body of the old `total`
    return sum((item.line_total for item in self.items.all()), Decimal("0"))

@property
def discount_amount(self) -> Decimal:
    if self.coupon_id is None:
        return Decimal("0")
    # Local import: promotions imports this module for CouponRedemption.
    from .promotions import calculate_discount
    return calculate_discount(self.coupon, self)

@property
def total(self) -> Decimal:        # payable
    return max(self.subtotal - self.discount_amount, Decimal("0"))
```

Keeping the name `total` for the payable amount is what makes
`payments/views.py:87` (`toman_to_rial(cart.total)`) correct without editing it.

## Engine — `orders/promotions.py`

Pure functions over an already-fetched cart, so they are testable without HTTP. It
imports `apply_discount` from `mattress/models.py` rather than re-deriving
rounding, so coupon cents round by the same rule the product sale already uses.

```python
def eligible_items(coupon, cart) -> list[CartItem]
def eligible_subtotal(coupon, cart) -> Decimal
def validate_coupon(coupon, cart, customer) -> str | None    # Persian error or None
def calculate_discount(coupon, cart) -> Decimal
def coupon_status(coupon) -> str        # INACTIVE|SCHEDULED|ACTIVE|EXPIRED|EXHAUSTED
def redeemed_count(coupon) -> int
def customer_redemption_count(coupon, customer) -> int
```

`eligible_items` returns every item when `applies_to_all_products`, otherwise items
whose `mattress_id` is in the coupon's `CouponProduct` set.

`redeemed_count` and `customer_redemption_count` both exclude cancelled orders, so
cancelling gives the use back:

```python
CouponRedemption.objects.filter(coupon=coupon).exclude(
    order__status=Order.CANCELLED
).count()
```

`validate_coupon` returns the first failing rule, in this order, so the customer is
told the most specific thing that is wrong:

| Rule | Message |
|---|---|
| `not coupon.is_active` | این کد تخفیف غیرفعال است. |
| `starts_at` in the future | این کد تخفیف هنوز فعال نشده است. |
| `expires_at` in the past | این کد تخفیف منقضی شده است. |
| eligible subtotal is zero | این کد تخفیف برای محصولات سبد خرید شما معتبر نیست. |
| eligible subtotal < `min_order_amount` | این کد تخفیف برای سفارش‌های بالای {amount} تومان است. |
| `usage_limit` reached | ظرفیت استفاده از این کد تخفیف تکمیل شده است. |
| `per_customer_limit` reached | شما پیش‌تر از این کد تخفیف استفاده کرده‌اید. |

`{amount}` is formatted with thousands separators in Persian digits by a private
`_fa_amount(value)` helper in this module, so the message is ready to display
without the frontend having to parse it.

`calculate_discount`:

```python
subtotal = eligible_subtotal(coupon, cart)
if subtotal <= 0:
    return Decimal("0")
if coupon.discount_type == Coupon.PERCENT:
    discount = subtotal - apply_discount(subtotal, coupon.percent)
    if coupon.max_discount_amount is not None:
        discount = min(discount, coupon.max_discount_amount)
else:
    discount = coupon.amount
return max(min(discount, subtotal), Decimal("0"))
```

The final clamp is what guarantees a coupon can never make the payable negative,
including a fixed amount larger than the eligible subtotal.

## API

### Customer

`CartSerializer` gains `subtotal`, `discount_amount`, and a nested read-only
`coupon`; `total` keeps its name and becomes the payable amount.

```json
{
  "id": 1, "count": 2, "items": [ ... ],
  "subtotal": "43000000.00",
  "discount_amount": "4000000.00",
  "total": "39000000.00",
  "coupon": {"code": "SALYCO10", "discount_type": "PERCENT", "percent": 10, "amount": null}
}
```

`CartItemSerializer` gains `covered_by_coupon` (boolean, true when a coupon is
applied and this item is eligible). Without it a mixed cart shows a discount
smaller than the headline percentage with no explanation on screen.

New `CartCouponView` in `orders/views.py`, `IsAuthenticated`, operating on the
customer's own cart:

- `POST /api/cart/coupon/` body `{"code": "salyco10"}` → `200` with the full cart
  payload above; `400 {"detail": "..."}` for an unknown code («کد تخفیف یافت نشد.»)
  or any rule from `validate_coupon`. An empty cart returns the existing
  `EMPTY_CART_MESSAGE`. Applying a code while one is already applied replaces it.
- `DELETE /api/cart/coupon/` → `200` with the cart payload, coupon cleared.
  Idempotent: removing when nothing is applied is a `200`, not an error, so the
  frontend never has to check first.

### Admin

Same shape as the `AllowedLocation` pair: `IsAdminUser`, `ListCreateAPIView` +
`RetrieveUpdateDestroyAPIView`, `pagination_class = None`.

- `GET|POST /api/admin/coupons/`
- `GET|PATCH|DELETE /api/admin/coupons/<pk>/`
- `GET /api/admin/coupons/<pk>/redemptions/` — order id, customer name and phone,
  amount, `created_at`. A separate endpoint rather than embedded so the list view
  stays light.

`AdminCouponSerializer` takes `product_ids` (list of ints) as the write side of
`CouponProduct`, and adds computed read-only fields: `redeemed_count`,
`remaining_uses` (null when unlimited), `total_discount_given`, and `status`
(`INACTIVE|SCHEDULED|ACTIVE|EXPIRED|EXHAUSTED`, labelled in the frontend).
Validation mirrors `Coupon.clean()`. `DELETE` on a coupon referenced by an order
returns `400 {"detail": "این کد تخفیف استفاده شده و قابل حذف نیست؛ آن را غیرفعال کنید."}`.

`AdminOrderSerializer`, `OrderSerializer` and `PublicOrderSerializer` each gain
`coupon_code` and `discount_amount`, so staff and the customer can both see why a
total sits below the sum of its line items.

## Checkout and settlement

`orders/checkout.py::create_order_from_cart` copies the coupon onto the order and
freezes the amount:

```python
order = Order.objects.create(
    customer=cart.customer,
    method=Order.ONLINE,
    total_amount=cart.total,              # payable, discount already applied
    coupon=cart.coupon,
    coupon_code=cart.coupon.code if cart.coupon_id else "",
    discount_amount=cart.discount_amount,
    **cleaned,
)
```

`payments/views.py::PaymentStartView` re-validates immediately before creating the
order, since the cart may have been sitting since yesterday:

```python
if cart.coupon_id:
    error = validate_coupon(cart.coupon, cart, cart.customer)
    if error:
        # Clear it, or every retry hits the same wall.
        cart.coupon = None
        cart.save(update_fields=["coupon", "updated_at"])
        return Response({"detail": error, "coupon_cleared": True},
                        status=status.HTTP_400_BAD_REQUEST)
```

This runs after the existing `validate_checkout` call and before `amount_rial` is
computed, so the discounted amount is what reaches `Payment` and therefore what
settlement verifies against.

`payments/settlement.py` writes the redemption where the payment is confirmed and
the cart is cleared:

```python
if order.coupon_id:
    CouponRedemption.objects.get_or_create(
        order=order,
        defaults={
            "coupon": order.coupon,
            "customer": order.customer,
            "amount": order.discount_amount,
        },
    )
```

`get_or_create` on the `OneToOneField` is what makes this idempotent: settlement
can be reached twice for one payment (the browser callback and a later status
inquiry), and the redemption must still be one row. Clearing the cart at settlement
also clears `Cart.coupon`.

## Admin panel

New `CouponsPanel.jsx` at `/admin/coupons`, registered in the `AdminWorkspace`
nav next to «مناطق مجاز ارسال», and routed in `App.jsx` alongside the other admin
children. It follows `AllowedLocationsPanel.jsx` closely.

- List: code, type and value (٪۱۰ or ۲۰۰٬۰۰۰ تومان), validity window, usage
  (۱۲ از ۱۰۰), minimum order, scope (همهٔ محصولات / N محصول), status badge.
- Create/edit form: code, description, type toggle, value, max discount, minimum
  order, `starts_at` / `expires_at` as `<input type="date">` (matching
  `CreateInstancePanel.jsx:123` — there is no Jalali picker in this codebase),
  usage limit, per-customer limit, and an «همهٔ محصولات» switch that reveals a
  product multi-select when off.
- The product list comes from the existing `listMattresses()` in `api/warranty.js`
  (`GET /api/mattress/`), which the admin panels already reuse. No new endpoint.
- An expandable row per coupon showing its redemptions.

## Storefront

- `CartContext` gains `applyCoupon(code)` and `removeCoupon()`, each calling the API
  and replacing state with the returned cart payload — the same pattern the existing
  cart mutations use.
- `CartPage` gets a code input with an applied state («کد تخفیف: SALYCO10» plus a
  remove control) and a «تخفیف» line in the totals block.
- `CheckoutOrder` shows the applied code and the discount line read-only, so the
  amount beside the pay button is never a surprise.
- Amounts and counters use the existing `toPersianNumber`; prices keep the existing
  price formatter.
- Error text from `{"detail": ...}` is displayed as-is, which is why the messages
  are written in Persian on the server.

## Edge cases

- Coupon expires or fills up between cart and payment → re-validated at
  `PaymentStartView`, coupon cleared, customer sees the reason and can still order.
- The eligible product is removed from the cart → the discount is recomputed and
  frozen at payment time. A coupon with nothing eligible left fails validation with
  the «معتبر نیست» message.
- A fixed amount larger than the eligible subtotal → clamped, payable never negative.
- A cancelled order → the redemption row stays for history but is excluded from both
  usage counts, so the use is available again.
- Migration is purely additive: existing orders get `discount_amount = 0` and a null
  coupon, so no backfill and no data migration.

## Tests

A new `orders/tests_promotions.py`, alongside `payments/tests.py`:

- Percentage math and rounding agree with `apply_discount`.
- Fixed amount, and a fixed amount larger than the eligible subtotal clamps.
- `max_discount_amount` bounds a percent coupon.
- Mixed cart: discount lands on the eligible line only; `covered_by_coupon` is
  correct per item.
- Minimum order is measured against the eligible subtotal, not the cart subtotal.
- Stacking: a 20%-off product plus a 10% coupon gives 28% off list.
- All-products coupon discounts the whole cart.
- One test per eligibility rule, asserting the exact Persian message.
- `inactive`, `starts_at` in the future, `expires_at` in the past, boundary at
  exactly `expires_at`.
- `usage_limit` and `per_customer_limit`, including that a second order from the
  same customer is refused at limit 1.
- No redemption row is written at redirect; one is written at settlement; a second
  settlement does not double it.
- Cancelling an order frees the use.
- `create_order_from_cart` freezes `discount_amount`, `coupon_code` and the payable
  `total_amount`.
- Admin API: create with `product_ids`, patch, the delete-refused message, and
  `403` for a non-admin.

Frontend has no test runner, so verification stays eslint (69-problem baseline) +
`npm run build` + CDP screenshots of the cart and checkout with a coupon applied.

## Out of scope

Stacking two codes on one order, per-size scoping, automatic/campaign coupons that
apply without a code, gift cards, referral codes, a Shamsi date picker, and
surfacing the code in the order SMS.

## Files touched

Backend: `orders/models.py`, `orders/promotions.py` (new), `orders/serializers.py`,
`orders/admin_serializers.py`, `orders/admin_views.py`, `orders/views.py`,
`orders/urls.py`, `orders/checkout.py`, `orders/migrations/0005_coupons.py` (new),
`orders/tests_promotions.py` (new), `payments/views.py`, `payments/settlement.py`.

Frontend: `src/api/cart.js`, `src/api/admin.js`, `src/context/CartContext.jsx`,
`src/pages/CartPage.jsx`, `src/pages/checkout/CheckoutOrder.jsx`,
`src/pages/admin/CouponsPanel.jsx` (new), `src/pages/admin/AdminWorkspace.jsx`,
`src/pages/admin/OrdersPanel.jsx` (a discount column and the code, so staff can see
why a total sits below its line items), `src/App.jsx`.
