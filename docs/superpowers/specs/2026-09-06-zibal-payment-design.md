# Zibal IPG: online payment for the shopping flow

Date: 2026-09-06
Status: approved for planning

## Problem

Checkout can only produce a phone order. `CheckoutOrder.jsx` renders the
"خرید آنلاین" button permanently disabled next to "در حال حاضر فروش آنلاین
در دسترس نیست", and the only live path is `ثبت سفارش تلفنی`, which posts
`method: "PHONE"` and waits for a sales call. `Order.ONLINE` already exists
in `METHOD_CHOICES` and is never written by anything.

The task is to make that button work: take the money through Zibal's
internet payment gateway (IPG), and couple the result to the existing order
system so that a paid order is indistinguishable — to staff, to the SMS, to
the customer's order list — from one confirmed by hand.

## What "transactional" can and cannot mean here

The money moves in the customer's browser, at their bank, on Zibal's page.
No database transaction can span that. `Payment.status` therefore tracks a
state machine across three processes (us, Zibal, the bank), and the
guarantee we actually implement is a reconciliation invariant:

> An order is never CONFIRMED without a Zibal `/v1/verify` response of
> `result: 100` (or `201`, "already verified") whose `amount` matches what
> we asked for. And captured money never stays captured without a matching
> confirmed order — anything stuck is settled by `/v1/inquiry`.

The first half is enforced in the callback view. The second half is why
`reconcile_payments` exists; without it, a callback lost to a deploy or a
network blip leaves a real customer charged with no order, and nothing in
the system would ever notice.

## Zibal's contract

Source: `api-1.json` (OpenAPI 3.1.1, `Zibal IPG API`) and `zibal-doc.txt`,
both provided by the user. Server: `https://gateway.zibal.ir`.

Four calls, in the order they happen:

| Step | Call | Sends | Returns |
| :--- | :--- | :--- | :--- |
| 1. Request | `POST /v1/request` | `merchant`, `amount` (**Rial**), `callbackUrl`, `orderId`, `description`, `mobile` | `trackId`, `result`, `message` |
| 2. Start | `GET /start/{trackId}` | browser navigation, `Referer` required | the payment page |
| 3. Callback | Zibal → `GET` our `callbackUrl` | `trackId`, `success`, `status`, `orderId` as query string | — |
| 4. Verify | `POST /v1/verify` | `merchant`, `trackId` | `result`, `status`, `amount`, `refNumber`, `cardNumber`, `paidAt`, `orderId` |

Plus `POST /v1/inquiry` (`merchant`, `trackId`), which returns the same
shape as verify with `createdAt`/`verifiedAt`/`wage` added, and does not
change anything. That read-only property is what makes it safe to poll in
reconciliation.

Result codes for request: `100` success; `102`/`103`/`104` merchant not
found / inactive / invalid; `105` amount must exceed 1,000 Rial; `106`
invalid callbackUrl; `113` over the transaction ceiling; `115` our IP is not
registered in the Zibal panel; `107`/`108`–`112`/`114`/`116` concern
splitting, national code and fee mode, which this integration does not use.

Result codes for verify: `100` success; `201` already verified; `202` order
not paid or failed; `203` invalid trackId; `102`–`104` merchant problems.

Payment status values (Zibal's `status` field): `-1` awaiting payment, `-2`
internal error, `1` paid and verified, `2` paid but unverified, `3`
cancelled by user, `4` invalid card, `5` insufficient funds, `6` wrong PIN,
`7`–`9` request/count/amount limits exceeded, `10` invalid card issuer, `11`
switch error, `12` card unavailable, `15`/`16` refunded / refunding, `18`
reversed, `21` invalid merchant.

Status `2` — paid but unverified — is the state reconciliation exists for.

Two decisions taken from the docs rather than by preference:

- **Standard verify, not Lazy.** Lazy auto-refunds the customer if we fail
  to verify within 20 minutes. That trades stranded charges for silently
  lost sales, and with `reconcile_payments` covering the stranded case, the
  standard flow keeps the money.
- **A full-page browser navigation to `/start/{trackId}`, never fetch.**
  The docs make `Referer` mandatory and require its domain to match the
  gateway's registered website; an XHR would not send a usable one and the
  gateway would refuse to load. `Caddyfile` sets no `Referrer-Policy`, so
  the browser's default `strict-origin-when-cross-origin` sends the origin
  — which is what Zibal matches on.

## Currency

Every price in this project is Toman: `Mattress.price`, `MattressSize.price`,
`Order.total_amount`, and the `تومان` suffix rendered in `CartPage.jsx`,
`ProductCard.jsx` and `CheckoutOrder.jsx`. Zibal's `amount` is Rial.

`amount_rial = int(total_toman * 10)`, computed once when the payment is
created and stored on the `Payment` row. Storing it is what makes the
verify-time amount comparison meaningful — comparing against a
recomputed cart total would compare against a number that may have moved.

Zibal rejects amounts at or below 1,000 Rial with `result: 105`, so a cart
totalling 100 Toman or less is refused locally, with a Persian message,
before any HTTP call.

## Architecture

A new `payments` app, following the one-app-per-domain convention
(`orders`, `users`, `mattress`, …). Four units:

**`payments/zibal.py`** — the gateway client, and the only place that knows
Zibal's wire format. Modelled on `users/sms_service.py`: a class holding the
merchant, methods `request()` / `verify()` / `inquiry()`, a 15-second
timeout, and no exception allowed past its boundary — every method returns
`(ok: bool, data: dict)`. Result and status codes map to Persian messages in
two module-level dicts, so a failure code has one translation, used by both
the API response and the admin.

Unlike `users/notifications.py`, this client is not best-effort. Those
functions swallow failures because they fire after the thing they describe
is already committed. A failed payment request has the opposite property:
the customer has not paid, and telling them to pay when the gateway refused
the order would be a lie. `POST /api/payments/start/` fails loudly.

**`payments/models.py`** — one model, `Payment`:

```
order          FK → Order, related_name="payments", on_delete=PROTECT
amount_rial    BigIntegerField        # exactly what Zibal was asked for
track_id       BigIntegerField        # null until /v1/request succeeds; unique when set
status         INITIATED | REDIRECTED | PAID_UNVERIFIED | VERIFIED | FAILED | CANCELLED
zibal_result   IntegerField, null     # raw result code from the last call
zibal_status   IntegerField, null     # raw status from Zibal's status table
ref_number     CharField, blank       # bank reference, shown to the customer
card_number    CharField, blank       # masked, e.g. "62741****44"
paid_at        DateTimeField, null    # from Zibal's response, not our clock
verified_at    DateTimeField, null    # our latch — set once, never twice
failure_reason CharField, blank       # Persian, ready to display
created_at     DateTimeField
```

One row per attempt, not one per order. A customer whose card is declined
and who retries leaves two rows, and the first stays readable — overwriting
it would destroy the record of a real bank interaction. `PROTECT` mirrors
`Order.customer`: a paid order must not be deletable out from under its
payment record.

`zibal_result` and `zibal_status` are stored raw because Zibal support asks
for exactly those numbers, and a translated string cannot be un-translated.

**`payments/views.py`** — three endpoints.

```
POST /api/payments/start/            IsAuthenticated
GET  /api/payments/callback/         AllowAny   (Zibal's browser redirect)
GET  /api/payments/<track_id>/status/ IsAuthenticated, own orders only
```

**`payments/management/commands/reconcile_payments.py`** — the invariant's
second half, described under Reconciliation below.

## Flow

### Starting a payment

`POST /api/payments/start/` with the same body the phone-order path sends.

1. Validate the cart is non-empty and the checkout fields pass, including
   the allowed-area rule. Reuses `orders/checkout.py` (see Refactor).
2. Reject a cart total at or below 100 Toman, before any HTTP call.
3. In one `transaction.atomic()`: create `Order(method=ONLINE,
   status=PENDING)` with its `OrderItem`s, and `Payment(status=INITIATED,
   amount_rial=…)`. The cart is **not** cleared and **no** SMS is sent —
   nothing has been paid yet.
4. After the transaction commits, call `POST /v1/request` with
   `orderId=str(order.pk)`, `callbackUrl` built from
   `ZIBAL_CALLBACK_BASE_URL`, `mobile` from the order's phone number (it
   makes the customer's saved cards appear on the payment page), and a short
   Persian `description` naming the order.
5. `result: 100` → store `track_id`, set `REDIRECTED`, return
   `{payment_url: "https://gateway.zibal.ir/start/<trackId>", track_id}`.
   Any other result → `Payment.status = FAILED` with the Persian reason,
   HTTP 502, and the PENDING order stays for staff to see.

The HTTP call sits outside the atomic block deliberately, matching the
comment in `OrderCreateView` about not making a network request while a
transaction is open. A slow gateway must not hold a write transaction open.

The order is created before payment (rather than staging the cart on the
Payment row) so that an abandoned payment leaves a PENDING ONLINE order
visible in the admin panel — a customer who reached the bank page and
stopped is a sales lead, not something to discard. It also means prices are
fixed in `OrderItem.unit_price` at redirect time, so a discount expiring
mid-payment cannot change what the customer owes.

### The callback

Zibal redirects the customer's browser to
`GET /api/payments/callback/?trackId=…&success=…&status=…&orderId=…`.

1. Look the `Payment` up by `track_id`. Unknown → log at WARNING, redirect
   to the failure page. No 500s: this is a page a real customer is looking at.
2. `select_for_update()` on the payment row. If `verified_at` is already
   set, skip straight to the redirect — the work is done, and a refresh must
   not repeat it.
3. Call `POST /v1/verify`.
4. `result: 100` or `201`, **and** `amount == payment.amount_rial`:
   `Payment` → `VERIFIED` with `ref_number`, `card_number`, `paid_at`,
   `verified_at`; `Order.status` → `CONFIRMED`; clear the cart; then, after
   commit, `send_order_confirmation(order)`.
5. `result: 202` (not paid / failed): `Payment` → `FAILED`, or `CANCELLED`
   when Zibal's `status` is `3` (cancelled by user), which deserves its own
   message rather than being reported as an error. Order stays PENDING.
6. Amount mismatch: `FAILED`, log at ERROR, order stays PENDING. Money may
   have moved, so this must be loud enough for a human to chase.
7. Redirect to `{FRONTEND_BASE_URL}/payment/result?status=…&order=…&ref=…`.

Three properties this shape has, each of which is the point of it:

- **`success` and `status` from the query string are never trusted.** They
  are logged and otherwise ignored; only the server-to-server verify
  response decides. A hand-typed `?success=1&trackId=…` confirms nothing.
- **The amount is checked against what we stored.** A payment for the wrong
  amount does not confirm an order, whatever Zibal's result code says.
- **`select_for_update` plus the `verified_at` latch makes it idempotent.**
  A re-sent callback, a customer refreshing, and two concurrent requests all
  produce one confirmation, one cleared cart, one SMS. `result: 201` is
  treated as success because that is what it means: this payment was already
  verified.

The SMS uses the existing `send_order_confirmation()`, whose own
`confirmation_sms_sent_at` latch gives a second, independent guarantee
against a duplicate message, and whose failure is already best-effort — a
dead SMS gateway must not unwind a real payment.

### Reconciliation

`python manage.py reconcile_payments [--minutes 30] [--dry-run]`

For every `Payment` in `REDIRECTED` or `PAID_UNVERIFIED` older than
`--minutes`, call `POST /v1/inquiry` and settle by Zibal's `status`:

| Zibal status | Action |
| :--- | :--- |
| `1` (paid, verified) | Treat as verified: confirm the order, clear the cart, send the SMS. Zibal has the money and considers it settled. |
| `2` (paid, unverified) | Call `/v1/verify` now, then settle as above. This is the lost-callback case. |
| `-1` (awaiting payment) | Leave alone; the customer may still be on the bank page. |
| `3`–`12`, `21`, `-2` | `FAILED`/`CANCELLED` with the Persian reason. Order stays PENDING. |
| `15`, `16`, `18` (refunded / refunding / reversed) | `FAILED`, logged at ERROR — money came back and a human should know. |

Same locking and latch as the callback, so running it while a callback is in
flight is safe, and running it twice does nothing the second time.

## Refactor: extracting checkout

`OrderCreateView.post` currently holds, inline: cart-empty checking, method
validation, field normalisation, the six-field required check, the
`_location_error` allowed-area rule, and order+item creation. The payment
path needs all of it, identically.

Duplicating it would let the two checkout paths drift — most damagingly on
the allowed-area rule, where a divergence means selling to somewhere the
business cannot deliver. So `orders/checkout.py` gains two functions:

```python
validate_checkout(cart, data, method) -> (cleaned: dict, errors: dict)
create_order_from_cart(cart, cleaned, method) -> Order   # assumes atomic
```

`create_order_from_cart` creates the Order and its OrderItems and does
**not** clear the cart, because the two callers differ on exactly that
point: a phone order is complete on creation, an online order is not
complete until paid. `OrderCreateView` clears the cart itself, immediately;
the callback clears it after verification.

`OrderCreateView` becomes a thin caller of both. PHONE behaviour is
unchanged, including error messages and their Persian wording, which the
existing tests assert on.

## Frontend

**`CheckoutOrder.jsx`** — the disabled "خرید آنلاین" button becomes live.
It runs the same `validate()` the phone button does, calls
`startPayment(form)`, and on success sets `window.location.href =
payment_url`. A full navigation, not a router transition, for the `Referer`
reason above. The cart is deliberately not cleared here — the customer has
not paid, and clearing it would strand someone who abandons the bank page.

**`pages/PaymentResult.jsx`** (new, route `/payment/result`) — reads the
redirect's query string and shows either success, with the order number, the
bank reference and a link to the order page, or the Persian failure reason
with a route back to the cart to retry. Cancellation gets its own copy: a
customer who chose to abort should not be shown an error.

**`api/payments.js`** (new) — `startPayment()` and `getPaymentStatus()`,
following the error-unwrapping shape already in `api/orders.js`.

**`App.jsx`** — one route. Declared before the existing `/orders/:token`
pattern is irrelevant here (different prefix), but it belongs with the other
public routes.

## Configuration

```
ZIBAL_MERCHANT=zibal                          # docs' test account
ZIBAL_CALLBACK_BASE_URL=https://salyco.ir     # public HTTPS, Zibal must reach it
```

Both read via `os.getenv` in `core/settings.py`, alongside the `SMS_IR_*`
block, and documented in `.env.example`. `ZIBAL_MERCHANT` defaults to
`zibal` so the flow is exercisable before the real gateway is signed; the
production key is dropped into `.env` with no code change.

`ZIBAL_CALLBACK_BASE_URL` must be publicly reachable — Zibal redirects a
real browser to it. `localhost` cannot work, so end-to-end verification
needs staging or a tunnel. Unit tests need neither.

If the production gateway is IP-restricted in the Zibal panel, the server's
egress IP must be registered there or every request returns `result: 115`.

## Testing

TDD, with `requests` mocked at the `payments.zibal` boundary — no test
touches the network, matching how the suite already treats SMS. Cases:

*Start:* happy path creates order + payment and returns a `payment_url`;
empty cart; failed field validation; disallowed area; a total under the
1,000-Rial floor; each gateway failure code marks the payment FAILED and
returns 502; the cart survives every failure.

*Callback:* verified payment confirms the order, clears the cart and sends
one SMS; a forged `?success=1` on an unpaid payment confirms nothing; an
amount mismatch fails the payment and leaves the order PENDING; a duplicate
callback is a no-op; `result: 201` counts as success; `status: 3` reads as
cancelled, not failed; an unknown `trackId` redirects rather than 500s.

*Reconciliation:* status `1` and `2` both settle the order; `-1` is left
alone; terminal codes fail it; a refund logs at ERROR; running twice changes
nothing the second time.

*Refactor:* the existing order tests pass unchanged.

## Out of scope

Refunds (Zibal's IPG docs cover no refund call — status `15`/`16` are
observations, not actions), payment splitting (`multiplexingInfos`),
`nationalCode` and `allowedCards` card restrictions, saved cards, partial
payments, and the Zibal trust badge for the site footer. Each is additive
and none changes the model above.
