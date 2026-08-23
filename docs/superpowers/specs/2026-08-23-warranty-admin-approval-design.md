# Warranty: product-image matching + admin approval

Date: 2026-08-23
Status: approved for planning

## Problem

Two gaps in the warranty activation flow.

1. After scanning a product's QR code, the customer sees only a product
   name. Nothing lets them confirm the sticker they scanned belongs to the
   product in front of them.
2. Activation is immediate. `WarrantyRegistrationSerializer.save()` sets
   `is_warranty_active = True` the moment the form is submitted, so a
   mistyped serial, a mismatched product, or a fraudulent claim becomes a
   live warranty with no review.

## Current flow

QR code encodes `/warranty/mattress/<serial>`. `WarrantyStatusPage.jsx`
calls `checkWarranty()` → `WarrantyCheckSerializer`, which returns
`mattress_name` and warranty dates. An authenticated visitor gets
`WarrantyRegistration.jsx`, whose form POSTs to
`WarrantyRegistrationView`. That serializer writes the buyer snapshot,
sets `is_warranty_active = True` and `activation_date = today`, and the
view fires the activation SMS.

`is_warranty_active` is a `BooleanField` on `MattressInstance`, read in 20
places across the backend and 5 in the frontend.

## Decisions

| Question | Decision |
|---|---|
| Warranty period counts from | The customer's submission date. Review delay must not shorten coverage. |
| Rejection | Admin rejects with a reason; the customer sees it and may resubmit. |
| SMS | Only on approval, reusing `SMS_IR_TEMPLATE_WARRANTY`. No new sms.ir templates. |
| Customer's warranty list | Shows every state with a badge, so a submitted request is never invisible. |
| Matching card | Image, name, brand, and dimensions. |

## Approach

`warranty_status` replaces `is_warranty_active` as the stored field.
`is_warranty_active` returns as a read-only property
(`warranty_status == APPROVED`) and is serialized with
`BooleanField(read_only=True)` — the idiom `is_under_warranty` already
uses. Every API response keeps its present shape, so the CSV export,
`DashboardPanel.jsx`, and other consumers keep working unchanged.

The six ORM `.filter(is_warranty_active=...)` call sites must move to
`warranty_status=`. A property cannot be filtered on, so a missed site
raises `FieldError` immediately rather than returning wrong rows.

Two alternatives were rejected. Keeping the boolean *and* adding the
status field leaves two columns encoding one fact, free to disagree —
the same class of bug that produced the `buyer_*` snapshot fields
(`models.py:383`). A separate `WarrantyRequest` table would give a full
audit trail, but costs a new table, joins on every read, and a buyer
snapshot duplicated in two places; only the current state and a
rejection reason are needed.

## Data model

States on `MattressInstance`:

- `UNREGISTERED` — no one has claimed this serial
- `PENDING` — customer submitted, awaiting review
- `APPROVED` — admin confirmed; warranty is live
- `REJECTED` — admin declined; customer may resubmit

New fields:

| Field | Type | Purpose |
|---|---|---|
| `warranty_status` | `CharField(max_length=12, choices, default=UNREGISTERED, db_index=True)` | single source of truth |
| `warranty_submitted_at` | `DateTimeField(null=True, blank=True)` | second-precision; the review queue's sort key |
| `warranty_reviewed_at` | `DateTimeField(null=True, blank=True)` | when an admin acted |
| `warranty_reviewed_by` | `FK(AUTH_USER_MODEL, null=True, blank=True, on_delete=SET_NULL)` | which admin acted |
| `warranty_rejection_reason` | `TextField(blank=True, default="")` | shown to the customer |

`activation_date` keeps its type and is set at submission.
`is_warranty_active` loses its column and becomes a property.

`warranty_submitted_at` is not redundant: `created_at` records when the
serial was minted, not when it was claimed, and `activation_date` is
day-precision so it cannot order same-day requests.

### Transitions

```
UNREGISTERED --submit--> PENDING --approve--> APPROVED   (terminal; fires SMS)
                            |
                            +--reject---> REJECTED --resubmit--> PENDING
```

`REJECTED → PENDING` overwrites the `buyer_*` snapshot with the corrected
form data, clears `warranty_rejection_reason`, `warranty_reviewed_at`,
and `warranty_reviewed_by`, and resets `activation_date` and
`warranty_submitted_at` to the new submission — a resubmitted warranty is
dated from the resubmission. Any other transition is a 400. `APPROVED`
has no outgoing transition through the API; corrections go through the
Django admin.

### Migration

One reversible migration: `AddField` x5, then `RunPython`, then
`RemoveField('is_warranty_active')`. Forward maps `True → APPROVED` and
`False → UNREGISTERED`, and backfills `warranty_submitted_at` from
`activation_date` at local midnight so no legacy row sorts as null in the
queue. Reverse maps `APPROVED → True` and every other state → `False`,
which is lossy for `PENDING` and `REJECTED` — reversing this migration
discards the fact that a request was ever submitted or declined.

### Known sharp edge

`warranty_expiration_date` and `warranty_remaining_days` derive from
`activation_date` alone. Because `activation_date` is now set at
submission, both return real-looking numbers while a request is still
`PENDING`. `is_under_warranty` is unaffected — it reads the property, so
it requires `APPROVED` and correctly stays `False`.

Consequence: the frontend must branch on `warranty_status`, never on
`warranty_remaining_days > 0`. Covered by test 8 below.

## Backend

### Registration becomes a request

`WarrantyRegistrationSerializer.validate()` gains a status gate:
`APPROVED` → 400 "قبلاً فعال شده"; `PENDING` → 400 "در انتظار تأیید";
`UNREGISTERED` and `REJECTED` pass. The `is_warranty_registrable`
category check is unchanged.

`save()` keeps its buyer-snapshot and `Customer` backfill logic. Only the
final write changes: `warranty_status=PENDING`,
`warranty_submitted_at=now()`, `activation_date=localdate()`, and the
three review fields cleared so a resubmit does not carry the old reason
forward.

`WarrantyRegistrationView` loses its `send_warranty_activated_sms` call
and returns a `detail` message alongside the instance, mirroring the
review-submission response.

### Admin queue endpoints

`GET /api/admin/warranty-requests/` — `AdminWarrantyRequestListView`,
`IsAdminUser`, no pagination, `select_related("mattress", "customer",
"warranty_reviewed_by")`. Excludes `UNREGISTERED`. Filters: `status`,
`search` (serial, buyer name, phone).

Ordered by `warranty_submitted_at` **ascending**. Every other admin list
is newest-first, but a newest-first review queue starves the oldest
request — the one a customer is already waiting on.

`AdminWarrantyRequestSerializer` extends `AdminInstanceSerializer`,
adding the status and review fields, the rejection reason,
`warranty_months`, the buyer's address and postal code, and the product
image (the admin needs the photo the customer saw in order to verify the
match).

`PATCH /api/admin/warranty-requests/<serial_number>/` — body is
`{"action": "approve"}` or `{"action": "reject", "rejection_reason":
"..."}`. `WarrantyReviewActionSerializer` requires current status
`PENDING` (else 400 "این درخواست قبلاً بررسی شده است") and a non-empty
reason for a rejection. Approve sets the status, `warranty_reviewed_at`,
and `warranty_reviewed_by=request.user`, then sends the SMS. Reject sets
the status, review fields, and reason; no SMS.

The transition runs inside `transaction.atomic()` with
`select_for_update()` and a status re-check. Without it, two admins
clicking approve simultaneously — or a customer resubmitting mid-review —
could double-fire the SMS.

### SMS

`send_warranty_activated_sms` moves verbatim from
`WarrantyRegistrationView` to the approve action, keeping its
best-effort contract: the transition is committed by then, so a gateway
failure must not surface as a 500. It still passes
`instance.activation_date`, the submission date, so the message quotes
the correct coverage start.

### Read surface and filter sites

- `filter_instances`: `active` → `APPROVED`, `inactive` →
  `exclude(APPROVED)` so DashboardPanel's existing dropdown keeps
  working; new `pending` and `rejected` values.
- `filter_customers` and `AdminStatsView`: `warranty_status=APPROVED`.
  Stats gains `pending_warranties`.
- CSV export: the Yes/No "Warranty Active" column is replaced by a
  human-readable "Warranty Status" — four states do not fit a boolean.
- `CustomerWarrantyListView`: `exclude(warranty_status=UNREGISTERED)`
  instead of active-only, ordered `-warranty_submitted_at`.
  `MattressInstanceSerializer` gains status, reason, and submitted-at.
- `admin.py`: swap the field in `list_display` and `list_filter`.

### `WarrantyCheckSerializer`

Adds `warranty_status`, `warranty_rejection_reason`, `mattress_image`,
`mattress_brand`, `mattress_width`, `mattress_length`,
`mattress_height`, and `mattress_category_label`.

This endpoint is `AllowAny`, so it does *not* nest the full
`MattressSerializer` the way `MattressInstanceSerializer` does — that
would ship `price`, `discount_price`, and rating aggregates to an
unauthenticated scan. Nothing there is secret, but the payload is wider
than the job needs, so explicit `source=` fields are used instead.

## Frontend

### Matching card

New `components/warranty/ProductPreviewCard.jsx`: photo, name, brand,
category label, and dimensions as `۱۸۰ × ۲۰۰ × ۲۵ سانتی‌متر` in Persian
digits. The image goes through the existing `getProductImageUrl()`
helper, which falls back to `/matress.png`, plus an `onError` fallback
for a broken upload. Repo card idiom: `rounded-xl border-[#CBD2D6]`,
`dir="rtl"`, `font-persian`.

Rendered in both branches of `WarrantyStatusPage.jsx` — pre-login and
inside `WarrantyRegistration`. A customer who scanned the wrong unit
should learn that before going through a login. `ProductHeader` stays as
it is (it carries the copy-serial button and home link); the new card
sits beneath it, above the `GuaranteeDisk` row.

### Four states

`StatusBadge.jsx` and `ActionButton.jsx` both switch from an
`isRegistered` boolean to `status`:

| status | badge | button |
|---|---|---|
| `UNREGISTERED` | غیرفعال (amber) | ثبت گارانتی |
| `PENDING` | در انتظار تأیید (cyan) | در انتظار تأیید کارشناسان — disabled |
| `APPROVED` | فعال (green) | مشاهده گارانتی |
| `REJECTED` | رد شده (red) | ثبت مجدد درخواست |

Colour pairs are the ones already in the codebase
(`bg-[#E6F4EA]/text-[#019C34]`, `bg-[#FFF8E1]/text-[#F5BA2E]`, and the
rest appear verbatim in `ReviewsPanel.jsx:49`).

`WarrantyRegistration.jsx` switches to reading `warranty_status`
directly — it is the one component that needs four states rather than a
boolean, which is why the property keeps every other consumer unchanged.
The success toast becomes "درخواست ارسال شد و پس از تأیید فعال می‌شود",
the rejection reason renders in a red callout above the resubmit button,
and the form shows for `UNREGISTERED` and `REJECTED` but never for
`PENDING`.

The unauthenticated gate in `WarrantyStatusPage.jsx` currently keys off
`!is_warranty_active`, so an unauth visitor to a pending serial is
pushed to a login that cannot help them. New rule: unauth +
`UNREGISTERED`/`REJECTED` → login CTA; unauth + `PENDING`/`APPROVED` →
read-only status card, no CTA.

`MyWarrantiesPage.jsx` rows gain the status badge and a thumbnail, and
rejected rows show the reason. Its serializer already nests
`MattressSerializer`, so `w.mattress.image` is available with no extra
API work.

### Admin panel

New `pages/admin/WarrantyRequestsPanel.jsx`, modeled on
`ReviewsPanel.jsx` — same header, filter bar, card list, and `busyId`
pattern. Defaults to `status=PENDING`. Each card shows the product photo
and name, the serial, the full buyer snapshot (name, phone, address,
postal code), the submitted date, and warranty months. Approve is one
click; reject opens an inline reason textarea that will not submit
empty. Reviewed cards show who acted, when, and the reason.

Wiring: `listAdminWarrantyRequests(params)` and
`reviewAdminWarrantyRequest(serial, data)` in `api/admin.js` following
the `listAdminReviews`/`updateAdminReview` shape; a `controls` entry in
`AdminWorkspace.jsx` (label "تأیید گارانتی‌ها", icon `ShieldCheck`) at
the extension point its line-17 comment documents; a nested route in
`App.jsx`; and the boolean `Badge ok={...}` in `DashboardPanel.jsx`
becomes status-aware, with a pending-count stat card.

The pending count comes from stats in `DashboardPanel` (which already
fetches them) and from loaded rows in `WarrantyRequestsPanel`, the same
approach `ReviewsPanel.jsx:120` uses. No new fetch in `AdminWorkspace`,
so the sidebar stays as cheap as it is now.

## Testing

Mechanical updates: the `is_warranty_active` factory kwarg in
`tests.py`, its five call sites, and the assertion at line 152.

New `WarrantyApprovalTests` (`APITestCase`, matching existing style),
with `send_warranty_activated_sms` mocked:

1. Registration lands `PENDING`, `is_warranty_active` False, no SMS.
2. A second submission while pending returns 400.
3. Approve sets `APPROVED`, `is_under_warranty` True, SMS called once.
4. Approving twice returns 400 the second time; SMS still called once.
5. Reject with no reason returns 400; with a reason, stores `REJECTED`
   and the reason.
6. Resubmitting after rejection returns to `PENDING` with the reason
   cleared.
7. The `activation_date` set at submission survives approval unchanged.
8. A pending instance has a non-null `warranty_expiration_date` but
   `is_under_warranty` False.
9. A non-admin PATCH returns 403.
10. An unauthenticated warranty check returns the image and status.
11. The customer list includes pending and rejected rows.

## Scope

Backend: `models.py`, one migration, `serializers.py`, `views.py`,
`admin_serializers.py`, `admin_views.py`, `urls.py`, `admin.py`,
`tests.py`.

Frontend: `ProductPreviewCard.jsx` (new),
`WarrantyRequestsPanel.jsx` (new), `StatusBadge.jsx`,
`ActionButton.jsx`, `WarrantyRegistration.jsx`, `WarrantyStatusPage.jsx`,
`MyWarrantiesPage.jsx`, `AdminWorkspace.jsx`, `App.jsx`,
`api/admin.js`.

`api/warranty.js` is expected to need no change: `checkWarranty` returns
`res.data` wholesale so new fields flow through, and
`registerWarranty`'s error extraction already surfaces the new 400
messages.

No new dependencies. No new sms.ir templates.

## Deployment note

The migration drops a column. Deploy the backend and frontend together:
a frontend built against `is_warranty_active` still works (the property
preserves it), but a `WarrantyRegistration.jsx` built before this change
would show "فعال" for a pending request.
