# Warranty Image Matching + Admin Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** After scanning a product QR code the customer sees the product's photo and specs to confirm they scanned the right unit, and submitting the warranty form creates a pending request that an admin must approve before the warranty goes live.

**Architecture:** A `warranty_status` CharField on `MattressInstance` replaces the stored `is_warranty_active` boolean, which returns as a read-only Python property so all 25 existing consumers keep working. Four states: `UNREGISTERED → PENDING → APPROVED`, with `PENDING → REJECTED → PENDING` for resubmission. Two new admin endpoints drive a review queue panel modeled on the existing reviews panel.

**Tech Stack:** Django 5 + DRF (`Backend/`), React 19 + Vite + Tailwind 4 + react-router 7 (`Frontend/salyco-front/`), sms.ir for notifications.

**Spec:** `docs/superpowers/specs/2026-08-23-warranty-admin-approval-design.md`

## Global Constraints

- **Backend tests:** run from `Backend/` with `env/Scripts/python.exe manage.py test mattress -v 2`. Django `TestCase`/`APITestCase` only — this project has no pytest.
- **Frontend has no test framework.** No vitest, no testing-library, zero `*.test.*` files. Frontend tasks verify with `npm run lint` and `npm run build` from `Frontend/salyco-front/`, plus the stated manual check. **Do not add a test framework** — it is outside this plan's scope.
- **All customer-facing copy is Persian.** Wrap UI text in `font-persian`, set `dir="rtl"` on containers, and render numbers through the existing `faNum()`/`toLocaleString("fa-IR")` helpers. Serial numbers stay `dir="ltr"` and `font-mono`.
- **Palette — use these exact values, do not invent colours:** navy `#003087`, green `#019C34`, cyan `#009CDE`, red `#D20000`, amber `#F5BA2E`, grey text `#687173`, dark text `#1A1A2E`, border `#CBD2D6`, surface `#F5F7FA`. Badge fills: green `#E6F4EA`, cyan `#E7F3FB`, red `#FDE7E7`, amber `#FFF8E1`.
- **No new dependencies** (frontend or backend) and **no new sms.ir templates**. Approval reuses `SMS_IR_TEMPLATE_WARRANTY` via the existing `send_warranty_activated_sms`.
- **Migration numbering:** the latest existing migration is `0011_mattress_category_and_properties`. The new one is `0012`.
- **Never invent a Jalali formatter.** Use `format_jalali()` from `mattress/utils.py` for any Shamsi date passed to SMS.

## File Structure

**Backend (`Backend/mattress/`)**

| File | Responsibility for this change |
|---|---|
| `models.py` | `WarrantyStatus` choices, 5 new fields, `is_warranty_active` property |
| `migrations/0012_warranty_status.py` | Add fields, migrate data, drop old column |
| `serializers.py` | Registration gate + PENDING write; `WarrantyCheckSerializer` product fields; `MattressInstanceSerializer` status fields |
| `views.py` | Registration returns pending; customer list shows all claimed states |
| `admin_serializers.py` | `AdminWarrantyRequestSerializer`, `WarrantyReviewActionSerializer` |
| `admin_views.py` | Queue list + review action views; filter/stats/CSV updates |
| `urls.py` | Two new admin routes |
| `admin.py` | Django admin list field swap |
| `tests.py` | Updated factories + new `WarrantyApprovalTests` |

**Frontend (`Frontend/salyco-front/src/`)**

| File | Responsibility for this change |
|---|---|
| `components/warranty/ProductPreviewCard.jsx` (new) | Photo + name + brand + dimensions matching card |
| `pages/admin/WarrantyRequestsPanel.jsx` (new) | Admin review queue |
| `components/warranty/StatusBadge.jsx` | 4-state badge |
| `components/warranty/ActionButton.jsx` | 4-state button |
| `components/warranty/WarrantyRegistration.jsx` | Status-driven form gating + rejection callout |
| `pages/WarrantyStatusPage.jsx` | Renders preview card; new unauth CTA rule |
| `pages/MyWarrantiesPage.jsx` | Status badge + thumbnail per row |
| `api/admin.js` | Two queue API functions |
| `pages/admin/AdminWorkspace.jsx` | Sidebar control entry |
| `App.jsx` | Nested admin route |
| `pages/admin/DashboardPanel.jsx` | Status-aware badges, pending stat, filter options |

`api/warranty.js` is expected to need **no change**: `checkWarranty` returns `res.data` wholesale, and `registerWarranty`'s error extraction already surfaces the new 400 messages.

---

### Task 1: Move `is_warranty_active` from column to property

**Behaviour must not change in this task.** Registration still approves immediately and the SMS still fires on submit. This is a pure refactor that swaps the storage mechanism, so the whole existing suite must still pass unmodified except for the factory kwarg rename. Task 2 changes behaviour.

**Files:**
- Modify: `Backend/mattress/models.py:363-453`
- Create: `Backend/mattress/migrations/0012_warranty_status.py`
- Modify: `Backend/mattress/serializers.py:235-254, 292-345, 348-366`
- Modify: `Backend/mattress/admin_serializers.py:11-52`
- Modify: `Backend/mattress/admin_views.py:78-93, 96-113, 118-164`
- Modify: `Backend/mattress/views.py:157-169`
- Modify: `Backend/mattress/admin.py:70-85`
- Test: `Backend/mattress/tests.py`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: on `MattressInstance` — class constants `UNREGISTERED`, `PENDING`, `APPROVED`, `REJECTED` (all `str`, value equals name); `WARRANTY_STATUS_CHOICES`; fields `warranty_status: str`, `warranty_submitted_at: datetime | None`, `warranty_reviewed_at: datetime | None`, `warranty_reviewed_by: User | None`, `warranty_rejection_reason: str`; read-only property `is_warranty_active -> bool`.

- [x] **Step 1: Restore the virtualenv, then capture a green baseline**

The venv at `Backend/env/` is missing `requests` (it is in `requirements.txt` but not installed), so `manage.py` cannot even boot. Fix that first.

Run from `Backend/`:

```bash
env/Scripts/python.exe -m pip install -r requirements.txt
env/Scripts/python.exe manage.py test mattress -v 2
```

Expected: all existing tests PASS. **If they do not, stop and report** — you need a green baseline before a refactor this wide, otherwise you cannot tell your breakage from pre-existing breakage.

- [x] **Step 2: Write the failing test**

Append to `Backend/mattress/tests.py`:

```python
class WarrantyStatusModelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.mattress = Mattress.objects.create(
            name="Status Probe",
            description="Status probe mattress",
            slug="status-probe",
            warranty_months=120,
            price=Decimal("799.00"),
            image=create_test_image("status.jpg"),
        )

    def _instance(self, serial_number: str, **kwargs) -> MattressInstance:
        return MattressInstance.objects.create(
            serial_number=serial_number,
            mattress=self.mattress,
            manufacture_date=date(2024, 1, 1),
            **kwargs,
        )

    def test_default_status_is_unregistered(self):
        instance = self._instance("ST-001")
        self.assertEqual(instance.warranty_status, MattressInstance.UNREGISTERED)
        self.assertFalse(instance.is_warranty_active)

    def test_is_warranty_active_true_only_when_approved(self):
        approved = self._instance("ST-002", warranty_status=MattressInstance.APPROVED)
        pending = self._instance("ST-003", warranty_status=MattressInstance.PENDING)
        rejected = self._instance("ST-004", warranty_status=MattressInstance.REJECTED)
        self.assertTrue(approved.is_warranty_active)
        self.assertFalse(pending.is_warranty_active)
        self.assertFalse(rejected.is_warranty_active)

    def test_pending_has_expiration_date_but_is_not_under_warranty(self):
        """activation_date is set at submission, so the expiration properties
        return real dates while review is still pending. Only is_under_warranty
        gates actual validity — see the spec's "Known sharp edge"."""
        instance = self._instance(
            "ST-005",
            warranty_status=MattressInstance.PENDING,
            activation_date=timezone.localdate(),
        )
        self.assertIsNotNone(instance.warranty_expiration_date)
        self.assertGreater(instance.warranty_remaining_days, 0)
        self.assertFalse(instance.is_under_warranty)

    def test_is_warranty_active_is_read_only(self):
        instance = self._instance("ST-006")
        with self.assertRaises(AttributeError):
            instance.is_warranty_active = True

    def test_review_fields_default_empty(self):
        instance = self._instance("ST-007")
        self.assertIsNone(instance.warranty_submitted_at)
        self.assertIsNone(instance.warranty_reviewed_at)
        self.assertIsNone(instance.warranty_reviewed_by)
        self.assertEqual(instance.warranty_rejection_reason, "")
```

- [x] **Step 3: Run the test to verify it fails**

```bash
env/Scripts/python.exe manage.py test mattress.tests.WarrantyStatusModelTests -v 2
```

Expected: FAIL — `TypeError: MattressInstance() got unexpected keyword arguments: 'warranty_status'`.

- [x] **Step 4: Add the state field set and the property to the model**

In `Backend/mattress/models.py`, inside `class MattressInstance`, add the constants directly above `serial_number`:

```python
    # Warranty lifecycle. A submission no longer activates the warranty — it
    # creates a PENDING request for an admin to approve or reject, so a
    # mistyped serial or a mismatched product is caught before coverage
    # starts. REJECTED is not terminal: the customer corrects the details and
    # resubmits, returning the row to PENDING.
    UNREGISTERED = "UNREGISTERED"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    WARRANTY_STATUS_CHOICES = [
        (UNREGISTERED, "Unregistered"),
        (PENDING, "Pending review"),
        (APPROVED, "Approved"),
        (REJECTED, "Rejected"),
    ]
```

Replace the `is_warranty_active` field (currently at `models.py:393-396`) with:

```python
    warranty_status = models.CharField(
        max_length=12,
        choices=WARRANTY_STATUS_CHOICES,
        default=UNREGISTERED,
        db_index=True,
        verbose_name="warranty status",
    )
    # Second-precision claim time. created_at records when we minted the
    # serial, not when a customer claimed it, and activation_date is only
    # day-precise — neither can order the review queue.
    warranty_submitted_at = models.DateTimeField(
        null=True, blank=True, verbose_name="warranty submitted at"
    )
    warranty_reviewed_at = models.DateTimeField(
        null=True, blank=True, verbose_name="warranty reviewed at"
    )
    warranty_reviewed_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_warranties",
        verbose_name="warranty reviewed by",
    )
    warranty_rejection_reason = models.TextField(
        blank=True, default="", verbose_name="warranty rejection reason"
    )
```

Then add the property next to the other properties (after `buyer_full_name`, around `models.py:430`):

```python
    @property
    def is_warranty_active(self) -> bool:
        """True only for an admin-approved warranty.

        This was a stored BooleanField before the approval flow existed. It is
        kept as a property so serializers, the CSV export, and the admin
        dashboard keep reading the same name while `warranty_status` is the
        only stored truth. It cannot be used in a queryset filter — use
        `warranty_status=MattressInstance.APPROVED` there.
        """
        return self.warranty_status == self.APPROVED
```

`is_under_warranty` needs no edit: it reads `self.is_warranty_active`, which now resolves to the property.

- [x] **Step 5: Generate the migration and add the data step**

```bash
env/Scripts/python.exe manage.py makemigrations mattress --name warranty_status
```

That produces `0012_warranty_status.py` with five `AddField` ops and one `RemoveField` for `is_warranty_active`. Edit it: add these two functions above `class Migration`, and insert the `RunPython` op **between** the `AddField`s and the `RemoveField`.

```python
from datetime import datetime, time

from django.utils import timezone


def set_status_from_boolean(apps, schema_editor):
    """True -> APPROVED, False -> UNREGISTERED (the field default).

    Also backfills warranty_submitted_at from activation_date at local
    midnight, so no legacy approved row sorts as null in the review queue.
    """
    MattressInstance = apps.get_model("mattress", "MattressInstance")
    tz = timezone.get_current_timezone()
    for row in MattressInstance.objects.filter(is_warranty_active=True).iterator():
        submitted_at = None
        if row.activation_date is not None:
            submitted_at = timezone.make_aware(
                datetime.combine(row.activation_date, time.min), tz
            )
        MattressInstance.objects.filter(pk=row.pk).update(
            warranty_status="APPROVED", warranty_submitted_at=submitted_at
        )


def set_boolean_from_status(apps, schema_editor):
    """Reverse. Lossy: PENDING and REJECTED both collapse to False, so
    reversing discards the fact that a request was submitted or declined."""
    MattressInstance = apps.get_model("mattress", "MattressInstance")
    MattressInstance.objects.filter(warranty_status="APPROVED").update(
        is_warranty_active=True
    )
```

The op to insert:

```python
        migrations.RunPython(set_status_from_boolean, set_boolean_from_status),
```

Order matters — `is_warranty_active` must still exist when `RunPython` runs forward, and must have been restored before it runs backward. `AddField`s → `RunPython` → `RemoveField` gives both.

- [x] **Step 6: Declare `is_warranty_active` explicitly in the three serializers that expose it**

A `ModelSerializer` would auto-build a `ReadOnlyField` for the property, but every sibling computed field here is declared explicitly, so match that. (Verified against DRF 3.17.1: declaring a field that also appears in `read_only_fields` does not assert — `get_extra_kwargs` only merges kwargs.)

`Backend/mattress/serializers.py` — add to `MattressInstanceSerializer` (beside `is_under_warranty` at line 239) and to `WarrantyCheckSerializer` (beside line 353):

```python
    is_warranty_active = serializers.BooleanField(read_only=True)
```

`Backend/mattress/admin_serializers.py` — add the same line to `AdminInstanceSerializer`, beside `is_under_warranty` at line 21.

- [x] **Step 7: Update the write path**

`Backend/mattress/serializers.py`, in `WarrantyRegistrationSerializer.save()`: replace `instance.is_warranty_active = True` (line 332) with

```python
        instance.warranty_status = MattressInstance.APPROVED
```

and in the `update_fields` list (line 342), replace `"is_warranty_active"` with `"warranty_status"`.

The `validate()` guard at line 277 (`if instance.is_warranty_active:`) reads the property and keeps working — leave it for Task 2.

- [x] **Step 8: Update the six ORM filter sites and the Django admin**

`Backend/mattress/admin_views.py` — import the constant holder if not already imported (`from .models import MattressInstance, Review` is already there at line 20), then:

Lines 78-82 in `filter_instances`:

```python
    warranty = request.query_params.get("warranty")
    if warranty == "active":
        qs = qs.filter(warranty_status=MattressInstance.APPROVED)
    elif warranty == "inactive":
        qs = qs.exclude(warranty_status=MattressInstance.APPROVED)
```

Line 101 in `filter_customers`:

```python
            filter=Q(mattress_instances__warranty_status=MattressInstance.APPROVED),
```

Lines 127 and 130-132 in `AdminStatsView.get`:

```python
        active = instances.filter(warranty_status=MattressInstance.APPROVED).count()
```

```python
        active_qs = instances.filter(
            warranty_status=MattressInstance.APPROVED,
            activation_date__isnull=False,
        ).select_related("mattress")
```

Line 228 (CSV export) reads `i.is_warranty_active` as an attribute — the property works, leave it.

`Backend/mattress/views.py` line 166 in `CustomerWarrantyListView.get_queryset`:

```python
            MattressInstance.objects.filter(
                customer=customer, warranty_status=MattressInstance.APPROVED
            )
```

`Backend/mattress/admin.py` lines 76 and 80: replace `"is_warranty_active"` with `"warranty_status"` in `list_display`, and `("is_warranty_active", ...)` with `("warranty_status", ...)` in `list_filter`.

- [x] **Step 9: Update the existing test factories**

`Backend/mattress/tests.py`:

In `MattressInstanceWarrantyPropertyTests._create_instance` (lines 48-59), change the signature parameter `is_warranty_active: bool = False` to `warranty_status: str = MattressInstance.UNREGISTERED` and the `objects.create(...)` kwarg `is_warranty_active=is_warranty_active` to `warranty_status=warranty_status`.

At its four call sites (lines 70, 82, 91, 99), replace `is_warranty_active=True` with `warranty_status=MattressInstance.APPROVED`.

In `WarrantyAPITests.setUpTestData` (line 129), replace `is_warranty_active=True` with `warranty_status=MattressInstance.APPROVED`.

Leave the assertion at line 152 (`assertTrue(self.instance.is_warranty_active)`) alone — behaviour is unchanged in this task, so it must still pass. Task 2 rewrites it.

- [x] **Step 10: Run the full suite**

```bash
env/Scripts/python.exe manage.py test mattress -v 2
```

Expected: PASS, including all five new `WarrantyStatusModelTests` and every pre-existing test. If `FieldError: Cannot resolve keyword 'is_warranty_active' into field` appears, a filter site was missed — grep for it:

```bash
grep -rn "is_warranty_active" ../Backend --include=*.py
```

Every remaining hit must be attribute access or a serializer field name, never a `filter()`/`exclude()`/`Q()` argument.

- [x] **Step 11: Commit**

```bash
git add Backend/mattress/
git commit -m "refactor: store warranty state as warranty_status, keep is_warranty_active as property

No behaviour change. The boolean column becomes a four-state CharField;
is_warranty_active returns as a read-only property so serializers, the
CSV export, and the admin dashboard keep their current shape."
```

---

### Task 2: Registration creates a pending request instead of activating

**Files:**
- Modify: `Backend/mattress/serializers.py:273-345`
- Modify: `Backend/mattress/views.py:119-147`
- Test: `Backend/mattress/tests.py`

**Interfaces:**
- Consumes: `MattressInstance.PENDING/APPROVED/REJECTED`, `warranty_status`, `warranty_submitted_at`, `warranty_rejection_reason`, `warranty_reviewed_at`, `warranty_reviewed_by` from Task 1.
- Produces: `POST /api/warranty/register/` returns `201` with body `{...MattressInstanceSerializer fields, "detail": str}` and leaves the instance at `PENDING`. No SMS is sent by this endpoint any more — Task 4 sends it on approval.

- [x] **Step 1: Write the failing tests**

Append to `Backend/mattress/tests.py`. Note `unittest.mock.patch` — add `from unittest.mock import patch` to the imports at the top of the file if absent.

The SMS function is imported into `mattress.views` by name (`views.py:24`), so patch it **there**, not in `users.notifications`.

```python
class WarrantyRegistrationPendingTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.mattress = Mattress.objects.create(
            name="Pending Probe",
            description="Pending probe mattress",
            slug="pending-probe",
            warranty_months=24,
            price=Decimal("499.00"),
            image=create_test_image("pending.jpg"),
        )
        cls.user = User.objects.create_user(
            username="pendinguser", password="testpass123"
        )

    def setUp(self):
        self.instance = MattressInstance.objects.create(
            serial_number="PEND-001",
            mattress=self.mattress,
            manufacture_date=date(2024, 1, 1),
        )
        self.client.force_authenticate(user=self.user)

    def _register(self, serial_number="PEND-001"):
        return self.client.post(
            reverse("warranty-register"),
            {
                "serial_number": serial_number,
                "first_name": "Jane",
                "last_name": "Doe",
                "address": "123 Main St",
                "phone_number": "555-0100",
                "postal_code": "12345",
            },
            format="json",
        )

    @patch("mattress.views.send_warranty_activated_sms")
    def test_registration_creates_pending_request_without_sms(self, mock_sms):
        response = self._register()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("detail", response.data)

        self.instance.refresh_from_db()
        self.assertEqual(self.instance.warranty_status, MattressInstance.PENDING)
        self.assertFalse(self.instance.is_warranty_active)
        self.assertFalse(self.instance.is_under_warranty)
        mock_sms.assert_not_called()

    @patch("mattress.views.send_warranty_activated_sms")
    def test_registration_records_submission_time_and_activation_date(self, _mock_sms):
        self._register()
        self.instance.refresh_from_db()
        self.assertEqual(self.instance.activation_date, timezone.localdate())
        self.assertIsNotNone(self.instance.warranty_submitted_at)

    @patch("mattress.views.send_warranty_activated_sms")
    def test_registration_still_records_buyer_snapshot(self, _mock_sms):
        self._register()
        self.instance.refresh_from_db()
        self.assertEqual(self.instance.buyer_first_name, "Jane")
        self.assertEqual(self.instance.buyer_phone_number, "555-0100")
        self.assertEqual(self.instance.customer.user, self.user)

    @patch("mattress.views.send_warranty_activated_sms")
    def test_second_submission_while_pending_is_rejected(self, _mock_sms):
        self._register()
        response = self._register()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("serial_number", response.data)

    @patch("mattress.views.send_warranty_activated_sms")
    def test_submission_for_approved_instance_is_rejected(self, _mock_sms):
        self.instance.warranty_status = MattressInstance.APPROVED
        self.instance.save(update_fields=["warranty_status"])
        response = self._register()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("serial_number", response.data)

    @patch("mattress.views.send_warranty_activated_sms")
    def test_rejected_instance_accepts_resubmission(self, _mock_sms):
        self.instance.warranty_status = MattressInstance.REJECTED
        self.instance.warranty_rejection_reason = "تصویر فاکتور ناخوانا بود"
        self.instance.warranty_reviewed_at = timezone.now()
        self.instance.save(
            update_fields=[
                "warranty_status",
                "warranty_rejection_reason",
                "warranty_reviewed_at",
            ]
        )

        response = self._register()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.instance.refresh_from_db()
        self.assertEqual(self.instance.warranty_status, MattressInstance.PENDING)
        self.assertEqual(self.instance.warranty_rejection_reason, "")
        self.assertIsNone(self.instance.warranty_reviewed_at)
        self.assertIsNone(self.instance.warranty_reviewed_by)
```

- [x] **Step 2: Update the existing registration test that asserts immediate activation**

`test_register_warranty_success` (`tests.py:136`) asserts `assertTrue(self.instance.is_warranty_active)`, which is now wrong by design. Replace that one line with:

```python
        self.assertEqual(self.instance.warranty_status, MattressInstance.PENDING)
```

Keep the rest of that test as-is — the customer link and `activation_date` assertions still hold.

`test_register_warranty_duplicate_activation_rejected` (`tests.py:156`) still passes: `activated_instance` is `APPROVED` from Task 1, and approved still blocks.

- [x] **Step 3: Run the tests to verify they fail**

```bash
env/Scripts/python.exe manage.py test mattress.tests.WarrantyRegistrationPendingTests -v 2
```

Expected: FAIL — status is `APPROVED`, not `PENDING`, and `mock_sms.assert_not_called()` fails because the view still sends it.

- [x] **Step 4: Replace the status gate in the serializer**

`Backend/mattress/serializers.py`, in `WarrantyRegistrationSerializer.validate()`, replace the `if instance.is_warranty_active:` block (lines 277-280) with:

```python
        if instance.warranty_status == MattressInstance.APPROVED:
            raise serializers.ValidationError(
                {"serial_number": "گارانتی این محصول قبلاً فعال شده است."}
            )
        if instance.warranty_status == MattressInstance.PENDING:
            raise serializers.ValidationError(
                {
                    "serial_number": (
                        "درخواست ثبت گارانتی این محصول قبلاً ارسال شده و "
                        "در انتظار تأیید است."
                    )
                }
            )
```

`UNREGISTERED` and `REJECTED` fall through and are allowed. Leave the `is_warranty_registrable` category check below untouched.

- [x] **Step 5: Write PENDING instead of APPROVED in `save()`**

In the same file, replace the `instance.warranty_status = MattressInstance.APPROVED` line from Task 1 (and keep the `activation_date` line above it) so the block reads:

```python
        instance.activation_date = timezone.localdate()
        # A resubmission after rejection must not carry the old verdict
        # forward — clear the review fields as well as setting PENDING.
        instance.warranty_status = MattressInstance.PENDING
        instance.warranty_submitted_at = timezone.now()
        instance.warranty_rejection_reason = ""
        instance.warranty_reviewed_at = None
        instance.warranty_reviewed_by = None
        instance.save(
            update_fields=[
                "customer",
                "buyer_first_name",
                "buyer_last_name",
                "buyer_phone_number",
                "buyer_address",
                "buyer_postal_code",
                "activation_date",
                "warranty_status",
                "warranty_submitted_at",
                "warranty_rejection_reason",
                "warranty_reviewed_at",
                "warranty_reviewed_by",
            ]
        )
        return instance
```

- [x] **Step 6: Stop sending the SMS on submission**

`Backend/mattress/views.py`, in `WarrantyRegistrationView.post`: delete the whole `send_warranty_activated_sms(...)` call and its preceding comment block (lines 130-142), and return a `detail` alongside the payload:

```python
        return Response(
            {
                **MattressInstanceSerializer(instance).data,
                "detail": (
                    "درخواست ثبت گارانتی شما ارسال شد و پس از تأیید کارشناسان "
                    "فعال می‌شود."
                ),
            },
            status=status.HTTP_201_CREATED,
        )
```

Leave the `from users.notifications import send_warranty_activated_sms` import at line 24 in place — Task 4's approve action uses it from this module, and the tests patch `mattress.views.send_warranty_activated_sms`.

Also remove the now-unused `timezone` and `format_jalali` references **only if** nothing else in the file uses them. Check first:

```bash
grep -n "timezone\|format_jalali" Backend/mattress/views.py
```

Leave any import that still has a user.

- [x] **Step 7: Run the tests to verify they pass**

```bash
env/Scripts/python.exe manage.py test mattress -v 2
```

Expected: PASS, all tests including the six new ones.

- [x] **Step 8: Commit**

```bash
git add Backend/mattress/
git commit -m "feat: warranty registration creates a pending request

Submitting the form now sets PENDING and records the submission time
instead of activating the warranty. The activation SMS no longer fires
here; Task 4 sends it on admin approval. A resubmission after rejection
clears the previous verdict."
```

---

### Task 3: Public warranty check returns the product's photo and specs

This is feature 1's backend half. `WarrantyCheckSerializer` currently returns only `mattress_name`, so the scan page has nothing to show.

**Files:**
- Modify: `Backend/mattress/serializers.py:348-366`
- Test: `Backend/mattress/tests.py`

**Interfaces:**
- Consumes: `warranty_status`, `warranty_rejection_reason` from Task 1.
- Produces: `GET /api/warranty/check/<serial>/` gains `warranty_status: str`, `warranty_rejection_reason: str`, `mattress_image: str | None` (absolute URL), `mattress_brand: str`, `mattress_category_label: str`, `mattress_width: int`, `mattress_length: int`, `mattress_height: int`. Consumed by Tasks 6 and 7.

- [x] **Step 1: Write the failing test**

Append to `Backend/mattress/tests.py`:

```python
class WarrantyCheckProductDetailTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.mattress = Mattress.objects.create(
            name="Check Probe",
            brand="سالیکو",
            description="Check probe mattress",
            slug="check-probe",
            category="mattress",
            warranty_months=120,
            price=Decimal("999.00"),
            width=180,
            length=200,
            height=25,
            image=create_test_image("check.jpg"),
        )
        cls.instance = MattressInstance.objects.create(
            serial_number="CHK-001",
            mattress=cls.mattress,
            manufacture_date=date(2024, 1, 1),
        )

    def test_check_returns_product_matching_fields_unauthenticated(self):
        response = self.client.get(reverse("warranty-check", args=["CHK-001"]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertEqual(response.data["mattress_brand"], "سالیکو")
        self.assertEqual(response.data["mattress_width"], 180)
        self.assertEqual(response.data["mattress_length"], 200)
        self.assertEqual(response.data["mattress_height"], 25)
        self.assertTrue(response.data["mattress_image"].startswith("http"))
        self.assertIn("mattress_category_label", response.data)

    def test_check_returns_warranty_status(self):
        response = self.client.get(reverse("warranty-check", args=["CHK-001"]))
        self.assertEqual(
            response.data["warranty_status"], MattressInstance.UNREGISTERED
        )
        self.assertEqual(response.data["warranty_rejection_reason"], "")

    def test_check_does_not_leak_pricing_to_anonymous_callers(self):
        """This endpoint is AllowAny. It must not nest the full mattress
        serializer, which would ship price and rating aggregates."""
        response = self.client.get(reverse("warranty-check", args=["CHK-001"]))
        for leaked in ("price", "discount_price", "average_rating", "review_count"):
            self.assertNotIn(leaked, response.data)
```

`category="mattress"` is valid — `Mattress.CATEGORY_MATTRESS == "mattress"` and `get_category_display()` returns `"تشک"` (`models.py:52,58`). It is also in `WARRANTY_REGISTRABLE_CATEGORIES`, so these instances are legitimately registrable.

- [x] **Step 2: Run the test to verify it fails**

```bash
env/Scripts/python.exe manage.py test mattress.tests.WarrantyCheckProductDetailTests -v 2
```

Expected: FAIL — `KeyError: 'mattress_brand'`.

- [x] **Step 3: Add the fields to `WarrantyCheckSerializer`**

Replace `WarrantyCheckSerializer` in `Backend/mattress/serializers.py` with:

```python
class WarrantyCheckSerializer(serializers.ModelSerializer):
    # Deliberately NOT nesting MattressSerializer the way
    # MattressInstanceSerializer does: this endpoint is AllowAny, and nesting
    # would ship price, discount_price and the rating aggregates to an
    # unauthenticated scan. Only the fields the customer needs in order to
    # confirm they scanned the right unit are exposed.
    mattress_name = serializers.CharField(source="mattress.name", read_only=True)
    mattress_brand = serializers.CharField(source="mattress.brand", read_only=True)
    mattress_category_label = serializers.CharField(
        source="mattress.get_category_display", read_only=True
    )
    mattress_width = serializers.IntegerField(source="mattress.width", read_only=True)
    mattress_length = serializers.IntegerField(source="mattress.length", read_only=True)
    mattress_height = serializers.IntegerField(source="mattress.height", read_only=True)
    mattress_image = serializers.SerializerMethodField()
    warranty_months = serializers.IntegerField(
        source="mattress.warranty_months", read_only=True
    )
    warranty_expiration_date = serializers.DateField(read_only=True)
    warranty_remaining_days = serializers.IntegerField(read_only=True)
    is_under_warranty = serializers.BooleanField(read_only=True)
    is_warranty_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = MattressInstance
        fields = [
            "serial_number",
            "mattress_name",
            "mattress_brand",
            "mattress_category_label",
            "mattress_width",
            "mattress_length",
            "mattress_height",
            "mattress_image",
            "warranty_months",
            "warranty_status",
            "warranty_rejection_reason",
            "is_warranty_active",
            "activation_date",
            "warranty_expiration_date",
            "warranty_remaining_days",
            "is_under_warranty",
        ]

    def get_mattress_image(self, obj: MattressInstance) -> str | None:
        image = obj.mattress.image
        if not image:
            return None
        request = self.context.get("request")
        if request is not None:
            return request.build_absolute_uri(image.url)
        return image.url
```

`WarrantyCheckView` is a `RetrieveAPIView`, so DRF puts `request` in the serializer context automatically and `build_absolute_uri` yields the absolute URL the test asserts.

- [x] **Step 4: Run the tests to verify they pass**

```bash
env/Scripts/python.exe manage.py test mattress -v 2
```

Expected: PASS. `test_check_warranty_by_serial_number` (`tests.py:166`) still passes — it only asserts `serial_number`, `mattress_name`, and the presence of `warranty_expiration_date`, all still present.

- [x] **Step 5: Commit**

```bash
git add Backend/mattress/serializers.py Backend/mattress/tests.py
git commit -m "feat: warranty check returns product photo, brand and dimensions

Gives the scan page what it needs for visual matching, plus the warranty
status and rejection reason. Uses explicit source fields rather than
nesting MattressSerializer, which would leak pricing on this AllowAny
endpoint."
```

---

### Task 4: Admin approve/reject endpoints

**Files:**
- Modify: `Backend/mattress/admin_serializers.py` (append two serializers)
- Modify: `Backend/mattress/admin_views.py` (append two views)
- Modify: `Backend/mattress/urls.py:26-35`
- Test: `Backend/mattress/tests.py`

**Interfaces:**
- Consumes: Task 1's state constants and fields; `send_warranty_activated_sms` from `users.notifications`; `format_jalali` from `mattress/utils.py`.
- Produces:
  - `GET /api/admin/warranty-requests/` (url name `admin-warranty-requests`) → list of `AdminWarrantyRequestSerializer` rows. Query params `status`, `search`.
  - `PATCH /api/admin/warranty-requests/<serial_number>/` (url name `admin-warranty-request-detail`) → body `{"action": "approve"}` or `{"action": "reject", "rejection_reason": str}`; returns the updated row. Consumed by Task 9.

- [x] **Step 1: Write the failing tests**

Append to `Backend/mattress/tests.py`. The SMS is sent from `admin_views`, so patch `mattress.admin_views.send_warranty_activated_sms`. Also widen the datetime import at the top of the file to `from datetime import date, timedelta`.

```python
class WarrantyApprovalTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.mattress = Mattress.objects.create(
            name="Approve Probe",
            brand="سالیکو",
            description="Approve probe mattress",
            slug="approve-probe",
            warranty_months=120,
            price=Decimal("999.00"),
            image=create_test_image("approve.jpg"),
        )
        cls.admin = User.objects.create_user(
            username="warrantyadmin", password="testpass123", is_staff=True
        )
        cls.plain_user = User.objects.create_user(
            username="plainuser", password="testpass123"
        )

    def setUp(self):
        self.submitted_on = date(2024, 6, 1)
        self.instance = MattressInstance.objects.create(
            serial_number="APP-001",
            mattress=self.mattress,
            manufacture_date=date(2024, 1, 1),
            warranty_status=MattressInstance.PENDING,
            activation_date=self.submitted_on,
            warranty_submitted_at=timezone.now(),
            buyer_first_name="Jane",
            buyer_last_name="Doe",
            buyer_phone_number="555-0100",
        )
        self.url = reverse("admin-warranty-request-detail", args=["APP-001"])

    def _patch(self, payload, user=None):
        self.client.force_authenticate(user=user or self.admin)
        return self.client.patch(self.url, payload, format="json")

    @patch("mattress.admin_views.send_warranty_activated_sms")
    def test_approve_activates_warranty_and_sends_one_sms(self, mock_sms):
        response = self._patch({"action": "approve"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.instance.refresh_from_db()
        self.assertEqual(self.instance.warranty_status, MattressInstance.APPROVED)
        self.assertTrue(self.instance.is_warranty_active)
        self.assertTrue(self.instance.is_under_warranty)
        self.assertEqual(self.instance.warranty_reviewed_by, self.admin)
        self.assertIsNotNone(self.instance.warranty_reviewed_at)
        self.assertEqual(mock_sms.call_count, 1)

    @patch("mattress.admin_views.send_warranty_activated_sms")
    def test_approve_preserves_submission_activation_date(self, _mock_sms):
        """The customer must not lose coverage to review delay — the spec's
        first decision."""
        self._patch({"action": "approve"})
        self.instance.refresh_from_db()
        self.assertEqual(self.instance.activation_date, self.submitted_on)
        self.assertEqual(
            self.instance.warranty_expiration_date,
            add_months(self.submitted_on, 120),
        )

    @patch("mattress.admin_views.send_warranty_activated_sms")
    def test_approving_twice_is_rejected_and_sms_sent_once(self, mock_sms):
        self.assertEqual(self._patch({"action": "approve"}).status_code, 200)
        second = self._patch({"action": "approve"})
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(mock_sms.call_count, 1)

    @patch("mattress.admin_views.send_warranty_activated_sms")
    def test_reject_without_reason_is_rejected(self, mock_sms):
        response = self._patch({"action": "reject"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.instance.refresh_from_db()
        self.assertEqual(self.instance.warranty_status, MattressInstance.PENDING)
        mock_sms.assert_not_called()

    @patch("mattress.admin_views.send_warranty_activated_sms")
    def test_reject_with_reason_stores_verdict_and_sends_no_sms(self, mock_sms):
        reason = "تصویر فاکتور ناخوانا بود"
        response = self._patch({"action": "reject", "rejection_reason": reason})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.instance.refresh_from_db()
        self.assertEqual(self.instance.warranty_status, MattressInstance.REJECTED)
        self.assertEqual(self.instance.warranty_rejection_reason, reason)
        self.assertEqual(self.instance.warranty_reviewed_by, self.admin)
        self.assertFalse(self.instance.is_warranty_active)
        mock_sms.assert_not_called()

    @patch("mattress.admin_views.send_warranty_activated_sms")
    def test_sms_gateway_failure_does_not_fail_the_approval(self, mock_sms):
        """The transition is committed before the send, so a gateway error must
        not surface as a 500 or roll the approval back."""
        mock_sms.side_effect = RuntimeError("gateway down")
        response = self._patch({"action": "approve"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.instance.refresh_from_db()
        self.assertEqual(self.instance.warranty_status, MattressInstance.APPROVED)

    def test_non_staff_cannot_review(self):
        response = self._patch({"action": "approve"}, user=self.plain_user)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_cannot_review(self):
        response = self.client.patch(self.url, {"action": "approve"}, format="json")
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_queue_lists_claimed_requests_oldest_first(self):
        MattressInstance.objects.create(
            serial_number="APP-002",
            mattress=self.mattress,
            manufacture_date=date(2024, 1, 1),
            warranty_status=MattressInstance.PENDING,
            warranty_submitted_at=timezone.now() + timedelta(hours=1),
        )
        MattressInstance.objects.create(
            serial_number="APP-003",
            mattress=self.mattress,
            manufacture_date=date(2024, 1, 1),
        )  # UNREGISTERED — nothing to review

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse("admin-warranty-requests"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        serials = [row["serial_number"] for row in response.data]
        self.assertEqual(serials, ["APP-001", "APP-002"])

    def test_queue_filters_by_status(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            reverse("admin-warranty-requests"), {"status": "REJECTED"}
        )
        self.assertEqual(list(response.data), [])

    def test_queue_row_carries_buyer_and_product_detail(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse("admin-warranty-requests"))
        row = response.data[0]
        self.assertEqual(row["customer_name"], "Jane Doe")
        self.assertEqual(row["customer_phone"], "555-0100")
        self.assertEqual(row["warranty_status"], MattressInstance.PENDING)
        self.assertEqual(row["warranty_months"], 120)
        self.assertIn("mattress_image", row)
        self.assertIn("buyer_address", row)
        self.assertIn("buyer_postal_code", row)

    @patch("mattress.admin_views.send_warranty_activated_sms")
    def test_patch_unknown_serial_returns_404(self, mock_sms):
        """A missing serial must 404, not 500. `DoesNotExist` never reaches
        DRF's exception handler, so a bare `.get()` in `update()` would surface
        as a server error — and GET on this same view already 404s, so the two
        verbs would disagree."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            reverse("admin-warranty-request-detail", args=["NO-SUCH-SERIAL"]),
            {"action": "approve"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        mock_sms.assert_not_called()
```

- [x] **Step 2: Run the tests to verify they fail**

```bash
env/Scripts/python.exe manage.py test mattress.tests.WarrantyApprovalTests -v 2
```

Expected: FAIL — `NoReverseMatch: Reverse for 'admin-warranty-request-detail' not found`.

- [x] **Step 3: Add the two serializers**

Append to `Backend/mattress/admin_serializers.py`:

```python
class AdminWarrantyRequestSerializer(AdminInstanceSerializer):
    """A row in the warranty review queue.

    Carries the full buyer snapshot and the product photo, because approving is
    a verification decision: the reviewer compares what the customer submitted
    against the product the serial actually belongs to.
    """

    warranty_months = serializers.IntegerField(
        source="mattress.warranty_months", read_only=True
    )
    mattress_image = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta(AdminInstanceSerializer.Meta):
        fields = AdminInstanceSerializer.Meta.fields + [
            "warranty_months",
            "mattress_image",
            "warranty_status",
            "warranty_submitted_at",
            "warranty_reviewed_at",
            "reviewed_by_name",
            "warranty_rejection_reason",
            "buyer_address",
            "buyer_postal_code",
        ]

    def get_mattress_image(self, obj: MattressInstance) -> str | None:
        image = obj.mattress.image
        if not image:
            return None
        request = self.context.get("request")
        if request is not None:
            return request.build_absolute_uri(image.url)
        return image.url

    def get_reviewed_by_name(self, obj: MattressInstance) -> str:
        reviewer = obj.warranty_reviewed_by
        if reviewer is None:
            return ""
        full_name = f"{reviewer.first_name} {reviewer.last_name}".strip()
        return full_name or reviewer.get_username()


class WarrantyReviewActionSerializer(serializers.Serializer):
    """Applies an approve/reject decision to a pending warranty request.

    An explicit `action` rather than a writable `warranty_status`, so the API
    cannot be used to drive an illegal transition — APPROVED back to PENDING,
    for instance.
    """

    APPROVE = "approve"
    REJECT = "reject"

    action = serializers.ChoiceField(choices=[APPROVE, REJECT])
    rejection_reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs: dict) -> dict:
        if attrs["action"] == self.REJECT and not (
            attrs.get("rejection_reason") or ""
        ).strip():
            raise serializers.ValidationError(
                {"rejection_reason": "دلیل رد درخواست الزامی است."}
            )
        return attrs
```

- [x] **Step 4: Add the two views**

First extend the imports at the top of `Backend/mattress/admin_views.py`:

```python
import logging

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError

from users.notifications import send_warranty_activated_sms

from .admin_serializers import (
    AdminCustomerSerializer,
    AdminInstanceDetailSerializer,
    AdminInstanceSerializer,
    AdminReviewSerializer,
    AdminWarrantyRequestSerializer,
    WarrantyReviewActionSerializer,
)
from .utils import format_jalali

logger = logging.getLogger(__name__)
```

`status`, `Response`, `generics` (lines 8-9), `timezone` (line 7), and `Q` (line 5) are already imported. Then append the views:

```python
class AdminWarrantyRequestListView(generics.ListAPIView):
    """The warranty review queue: every instance a customer has claimed."""

    permission_classes = [IsAdminUser]
    serializer_class = AdminWarrantyRequestSerializer
    pagination_class = None

    def get_queryset(self):
        qs = MattressInstance.objects.select_related(
            "mattress", "customer", "warranty_reviewed_by"
        ).exclude(warranty_status=MattressInstance.UNREGISTERED)

        requested = (self.request.query_params.get("status") or "").strip()
        valid = {value for value, _label in MattressInstance.WARRANTY_STATUS_CHOICES}
        if requested in valid:
            qs = qs.filter(warranty_status=requested)

        search = (self.request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(serial_number__icontains=search)
                | Q(buyer_first_name__icontains=search)
                | Q(buyer_last_name__icontains=search)
                | Q(buyer_phone_number__icontains=search)
            )

        # Oldest first. Every other admin list here is newest-first, but a
        # newest-first review queue starves the oldest request — the one a
        # customer has already been waiting on longest.
        return qs.order_by("warranty_submitted_at", "serial_number")


class AdminWarrantyRequestDetailView(generics.RetrieveUpdateAPIView):
    """PATCH {"action": "approve"} or {"action": "reject", "rejection_reason": ...}."""

    permission_classes = [IsAdminUser]
    serializer_class = AdminWarrantyRequestSerializer
    lookup_field = "serial_number"
    queryset = MattressInstance.objects.select_related(
        "mattress", "customer", "warranty_reviewed_by"
    )
    http_method_names = ["get", "patch", "head", "options"]

    def update(self, request, *args, **kwargs):
        action = WarrantyReviewActionSerializer(data=request.data)
        action.is_valid(raise_exception=True)
        decision = action.validated_data
        approved = decision["action"] == WarrantyReviewActionSerializer.APPROVE

        # Lock the row and re-check inside the transaction: two admins clicking
        # approve at the same moment, or a customer resubmitting mid-review,
        # would otherwise both pass the status check and double-send the SMS.
        # get_object_or_404, not a bare .get(): DoesNotExist does not reach DRF's
        # exception handler, so a bare .get() answers an unknown serial with a
        # 500. GET on this same view already 404s via DRF's get_object(), and the
        # two verbs must not disagree.
        with transaction.atomic():
            instance = get_object_or_404(
                MattressInstance.objects.select_for_update().select_related(
                    "mattress", "customer"
                ),
                serial_number=self.kwargs["serial_number"],
            )
            if instance.warranty_status != MattressInstance.PENDING:
                raise ValidationError({"detail": "این درخواست قبلاً بررسی شده است."})

            instance.warranty_status = (
                MattressInstance.APPROVED if approved else MattressInstance.REJECTED
            )
            instance.warranty_rejection_reason = (
                "" if approved else decision["rejection_reason"].strip()
            )
            instance.warranty_reviewed_at = timezone.now()
            instance.warranty_reviewed_by = request.user
            instance.save(
                update_fields=[
                    "warranty_status",
                    "warranty_rejection_reason",
                    "warranty_reviewed_at",
                    "warranty_reviewed_by",
                ]
            )

        if approved:
            # Best-effort, and outside the transaction: the approval is
            # committed by now, so a gateway failure must not roll it back or
            # surface as a 500. Prefer the phone recorded for this sale over
            # the account's — a dealer may have registered for the customer.
            try:
                send_warranty_activated_sms(
                    phone_number=instance.buyer_phone_number
                    or (
                        instance.customer.phone_number
                        if instance.customer_id
                        else ""
                    ),
                    customer_name=instance.buyer_full_name,
                    activation_date=format_jalali(
                        instance.activation_date or timezone.localdate()
                    ),
                    product_name=instance.mattress.name,
                )
            except Exception:
                logger.exception(
                    "Warranty approval SMS failed for %s", instance.serial_number
                )

        instance.refresh_from_db()
        return Response(self.get_serializer(instance).data, status=status.HTTP_200_OK)
```

- [x] **Step 5: Wire the URLs**

In `Backend/mattress/urls.py`, add to `urlpatterns` after the reviews routes:

```python
    path(
        "admin/warranty-requests/",
        admin_views.AdminWarrantyRequestListView.as_view(),
        name="admin-warranty-requests",
    ),
    path(
        "admin/warranty-requests/<str:serial_number>/",
        admin_views.AdminWarrantyRequestDetailView.as_view(),
        name="admin-warranty-request-detail",
    ),
```

- [x] **Step 6: Run the tests to verify they pass**

```bash
env/Scripts/python.exe manage.py test mattress -v 2
```

Expected: PASS, all tests including the twelve new ones.

If `test_sms_gateway_failure_does_not_fail_the_approval` fails, the `try/except` is missing or too narrow — it must catch `Exception`, since the send calls out to a network gateway.

- [x] **Step 7: Commit**

```bash
git add Backend/mattress/
git commit -m "feat: admin endpoints to approve or reject warranty requests

GET /api/admin/warranty-requests/ serves an oldest-first review queue;
PATCH applies an approve/reject decision under select_for_update so
concurrent approvals cannot double-send the activation SMS. The SMS moves
here from registration and reuses the existing sms.ir template."
```

---

### Task 5: Broaden the read surface — customer list, stats, CSV, filters

**Files:**
- Modify: `Backend/mattress/views.py:157-169`
- Modify: `Backend/mattress/serializers.py:241-254`
- Modify: `Backend/mattress/admin_views.py:78-93, 118-164, 192-238`
- Test: `Backend/mattress/tests.py`

**Interfaces:**
- Consumes: Task 1's fields and constants.
- Produces: `GET /api/warranty/my/` returns every claimed state, each row gaining `warranty_status`, `warranty_rejection_reason`, `warranty_submitted_at` (consumed by Task 8). `GET /api/admin/stats/` gains `pending_warranties: int` (consumed by Task 10). `filter_instances` accepts `warranty=pending|rejected` alongside `active|inactive` (consumed by Task 10).

- [x] **Step 1: Write the failing tests**

Append to `Backend/mattress/tests.py`:

```python
class WarrantyReadSurfaceTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.mattress = Mattress.objects.create(
            name="Surface Probe",
            description="Surface probe mattress",
            slug="surface-probe",
            warranty_months=24,
            price=Decimal("499.00"),
            image=create_test_image("surface.jpg"),
        )
        cls.user = User.objects.create_user(
            username="surfaceuser", password="testpass123"
        )
        cls.admin = User.objects.create_user(
            username="surfaceadmin", password="testpass123", is_staff=True
        )
        cls.customer = Customer.objects.create(
            user=cls.user,
            first_name="Jane",
            last_name="Doe",
            address="123 Main St",
            phone_number="555-0100",
            postal_code="12345",
        )
        owned = {
            "mattress": cls.mattress,
            "manufacture_date": date(2024, 1, 1),
            "customer": cls.customer,
        }
        MattressInstance.objects.create(
            serial_number="SRF-APPROVED",
            warranty_status=MattressInstance.APPROVED,
            activation_date=date(2024, 2, 1),
            warranty_submitted_at=timezone.now(),
            **owned,
        )
        MattressInstance.objects.create(
            serial_number="SRF-PENDING",
            warranty_status=MattressInstance.PENDING,
            warranty_submitted_at=timezone.now(),
            **owned,
        )
        MattressInstance.objects.create(
            serial_number="SRF-REJECTED",
            warranty_status=MattressInstance.REJECTED,
            warranty_rejection_reason="سریال با محصول همخوانی ندارد",
            warranty_submitted_at=timezone.now(),
            **owned,
        )
        MattressInstance.objects.create(
            serial_number="SRF-UNCLAIMED",
            mattress=cls.mattress,
            manufacture_date=date(2024, 1, 1),
        )

    def test_my_warranties_includes_pending_and_rejected(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(reverse("warranty-my-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        by_serial = {row["serial_number"]: row for row in response.data}
        self.assertEqual(
            set(by_serial), {"SRF-APPROVED", "SRF-PENDING", "SRF-REJECTED"}
        )
        self.assertEqual(
            by_serial["SRF-PENDING"]["warranty_status"], MattressInstance.PENDING
        )
        self.assertEqual(
            by_serial["SRF-REJECTED"]["warranty_rejection_reason"],
            "سریال با محصول همخوانی ندارد",
        )

    def test_stats_report_pending_count(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse("admin-stats"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["pending_warranties"], 1)
        self.assertEqual(response.data["active_warranties"], 1)

    def test_instance_filter_accepts_pending(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse("admin-instances"), {"warranty": "pending"})
        serials = [row["serial_number"] for row in response.data]
        self.assertEqual(serials, ["SRF-PENDING"])

    def test_instance_filter_inactive_excludes_only_approved(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse("admin-instances"), {"warranty": "inactive"})
        serials = {row["serial_number"] for row in response.data}
        self.assertNotIn("SRF-APPROVED", serials)
        self.assertIn("SRF-PENDING", serials)
        self.assertIn("SRF-UNCLAIMED", serials)

    def test_csv_export_reports_warranty_status(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse("admin-instances-export"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.content.decode("utf-8-sig")
        self.assertIn("Warranty Status", body)
        self.assertIn("Pending review", body)
```

- [x] **Step 2: Run the tests to verify they fail**

```bash
env/Scripts/python.exe manage.py test mattress.tests.WarrantyReadSurfaceTests -v 2
```

Expected: FAIL — the customer list returns only `SRF-APPROVED`, and `pending_warranties` is absent from stats.

- [x] **Step 3: Broaden the customer warranty list**

`Backend/mattress/views.py`, `CustomerWarrantyListView.get_queryset` — replace the return:

```python
        # Every instance this customer has claimed, in any state. A submitted
        # request that vanished from this page until an admin acted would read
        # as data loss.
        return (
            MattressInstance.objects.filter(customer=customer)
            .exclude(warranty_status=MattressInstance.UNREGISTERED)
            .select_related("mattress", "customer")
            .order_by("-warranty_submitted_at")
        )
```

- [x] **Step 4: Expose the status fields to the customer**

`Backend/mattress/serializers.py`, `MattressInstanceSerializer.Meta.fields` — add three entries after `"is_warranty_active"`:

```python
            "warranty_status",
            "warranty_rejection_reason",
            "warranty_submitted_at",
```

`read_only_fields = fields` already covers them.

- [x] **Step 5: Add the pending filter values and the pending stat**

`Backend/mattress/admin_views.py`, in `filter_instances`, extend the warranty branch:

```python
    warranty = request.query_params.get("warranty")
    if warranty == "active":
        qs = qs.filter(warranty_status=MattressInstance.APPROVED)
    elif warranty == "inactive":
        qs = qs.exclude(warranty_status=MattressInstance.APPROVED)
    elif warranty == "pending":
        qs = qs.filter(warranty_status=MattressInstance.PENDING)
    elif warranty == "rejected":
        qs = qs.filter(warranty_status=MattressInstance.REJECTED)
```

In `AdminStatsView.get`, add the count beside `active`:

```python
        pending = instances.filter(warranty_status=MattressInstance.PENDING).count()
```

and add to the response dict beside `"active_warranties"`:

```python
                "pending_warranties": pending,
```

- [x] **Step 6: Report the status in the CSV export**

`Backend/mattress/admin_views.py`, `AdminInstanceExportView.get` — in the header row replace `"Warranty Active"` with `"Warranty Status"`, and in the data row replace `"Yes" if i.is_warranty_active else "No"` with:

```python
                    i.get_warranty_status_display(),
```

Four states do not fit a Yes/No column, and this export is internal.

- [x] **Step 7: Run the full suite**

```bash
env/Scripts/python.exe manage.py test mattress -v 2
```

Expected: PASS. `test_customer_warranty_list` (`tests.py:173`) still passes — it asserts its approved instance is present, and a broader list still contains it.

- [x] **Step 8: Commit**

```bash
git add Backend/mattress/
git commit -m "feat: surface pending and rejected warranties to customer and admin

My-warranties lists every claimed state with its status and rejection
reason; stats report a pending count; the instance filter accepts
pending/rejected; the CSV export reports the four-state status instead of
a Yes/No column."
```

---

### Task 6: Product matching card on the scan page

Feature 1's frontend half. After a QR scan the customer sees only a product
name; this puts the photo, brand, category and dimensions in front of them so a
mis-scanned or mislabelled unit is caught before they claim it.

**Files:**
- Create: `Frontend/salyco-front/src/components/warranty/ProductPreviewCard.jsx`
- Modify: `Frontend/salyco-front/src/pages/WarrantyStatusPage.jsx:109-157`
- Modify: `Frontend/salyco-front/src/components/warranty/WarrantyRegistration.jsx:65-73`

**Interfaces:**
- Consumes: Task 3's `GET /api/warranty/check/<serial>/` fields —
  `mattress_image`, `mattress_brand`, `mattress_category_label`,
  `mattress_width`, `mattress_length`, `mattress_height`, `mattress_name`.
- Produces: default-exported `ProductPreviewCard({ warrantyData })`, where
  `warrantyData` is the raw `checkWarranty()` response. Rendered by Task 7's
  restructured `WarrantyStatusPage` unauth branch.

There is no frontend test framework (see Global Constraints), so each step below
verifies with `npm run lint`, `npm run build`, and the stated manual check.

- [x] **Step 1: Create the card component**

Create `Frontend/salyco-front/src/components/warranty/ProductPreviewCard.jsx`:

```jsx
import { useState } from "react";
import { Ruler, Tag } from "lucide-react";
import { getProductImageUrl } from "../../utils/productImage";
import { toPersianNumber } from "../../utils/persian";

const FALLBACK_IMAGE = "/matress.png";

// Shown right after a QR scan so the customer can compare the photo against the
// product in front of them before claiming the warranty. A mismatch is cheapest
// to catch here — before a login, a form, and an admin review.
const ProductPreviewCard = ({ warrantyData }) => {
  // Track only the failure, not the resolved URL: keeping the URL in state
  // would freeze it at mount and ignore a later refetch.
  const [imageFailed, setImageFailed] = useState(false);
  const src = imageFailed
    ? FALLBACK_IMAGE
    : getProductImageUrl(warrantyData.mattress_image);

  const {
    mattress_width: width,
    mattress_length: length,
    mattress_height: height,
  } = warrantyData;
  // All three default to 0 on the model, so only show the line when it is real.
  const dimensions =
    width && length && height
      ? `${toPersianNumber(width)} × ${toPersianNumber(length)} × ${toPersianNumber(
          height,
        )} سانتی‌متر`
      : null;

  return (
    <div
      className="mb-6 flex flex-col gap-4 rounded-xl border border-[#CBD2D6] bg-white p-4 text-right sm:flex-row sm:items-center sm:p-5"
      dir="rtl"
    >
      <img
        src={src}
        onError={() => setImageFailed(true)}
        alt={warrantyData.mattress_name || "تصویر محصول"}
        className="h-32 w-32 shrink-0 self-center rounded-xl border border-[#CBD2D6] bg-[#F5F7FA] object-cover sm:h-28 sm:w-28"
      />

      <div className="min-w-0 flex-1">
        <p className="font-persian text-xs text-[#687173]">
          محصول اسکن‌شده — مطابقت را بررسی کنید
        </p>
        <h3 className="mt-1 font-persian text-lg font-semibold text-[#1A1A2E]">
          {warrantyData.mattress_name || "—"}
        </h3>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-persian text-sm text-[#687173]">
          {warrantyData.mattress_brand && (
            <span className="inline-flex items-center gap-1.5">
              <Tag size={14} className="text-[#009CDE]" strokeWidth={2} />
              {warrantyData.mattress_brand}
            </span>
          )}
          {warrantyData.mattress_category_label && (
            <span>{warrantyData.mattress_category_label}</span>
          )}
        </div>

        {dimensions && (
          <p className="mt-2 inline-flex items-center gap-1.5 font-persian text-sm text-[#1A1A2E]">
            <Ruler size={14} className="text-[#009CDE]" strokeWidth={2} />
            {dimensions}
          </p>
        )}
      </div>
    </div>
  );
};

export default ProductPreviewCard;
```

`getProductImageUrl` already falls back to `/matress.png` for a null/empty
value; the `onError` handler covers the other case — a stored path whose file is
missing from the media volume.

- [x] **Step 2: Render the card inside the registration card**

`Frontend/salyco-front/src/components/warranty/WarrantyRegistration.jsx` — add
the import beside the other component imports:

```jsx
import ProductPreviewCard from "./ProductPreviewCard";
```

Then insert the card between `<ProductHeader … />` and the GuaranteeDisk row, so
the JSX at lines 67-73 reads:

```jsx
      <div className="p-6 sm:p-8">
        <ProductHeader product={product} onCopy={clearMessage} />

        <ProductPreviewCard warrantyData={warrantyData} />

        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-[#CBD2D6] bg-[#F5F7FA] p-4 sm:p-5">
          <GuaranteeDisk product={product} />
          <StatusBadge isRegistered={isRegistered} />
        </div>
```

Leave `StatusBadge isRegistered={…}` alone — Task 7 changes it.

- [x] **Step 3: Render the card in the unauthenticated branch**

A customer who scanned the wrong unit should learn that *before* being sent
through a login. In `Frontend/salyco-front/src/pages/WarrantyStatusPage.jsx`,
add the import:

```jsx
import ProductPreviewCard from "../components/warranty/ProductPreviewCard";
```

Then, in the unauthenticated block, replace the `<ShieldCheck …/>` icon and the
`<h2>{warrantyData.mattress_name}</h2>` heading (lines 113-123) with the card —
it now carries the photo and the name:

```jsx
              <div className="overflow-hidden rounded-xl border border-[#CBD2D6] bg-white p-8 text-center shadow-[0_1px_4px_rgba(0,48,135,0.06)]">
                <ProductPreviewCard warrantyData={warrantyData} />
                <p
                  className="mt-1 font-mono text-sm text-[#687173]"
                  dir="ltr"
                >
                  {serialNumber}
                </p>
```

Everything from that `<p>` onward (the serial, the explanation, the login
button) stays as it is. `ShieldCheck` is still used by the error block's button
at line 103, so leave its import in place.

- [x] **Step 4: Verify lint and build pass**

Run from `Frontend/salyco-front/`:

```bash
npm run lint
npm run build
```

Expected: both succeed with no new errors. If lint reports `ShieldCheck` as
unused, the error-block button at line 103 was edited by mistake — restore it.

- [ ] **Step 5: Manual check**  ← NOT RUN: needs a browser + running stack

With the backend running, open `/warranty/mattress/<serial>` for a serial whose
mattress has an uploaded image, both signed out and signed in. Expected: the
photo, name, brand, category and `۱۸۰ × ۲۰۰ × ۲۵ سانتی‌متر` dimensions appear in
both views. Then check a mattress with no image — expected: the `/matress.png`
placeholder, no broken-image icon, and no dimensions line for a product whose
width/length/height are 0.

- [x] **Step 6: Commit**

```bash
git add Frontend/salyco-front/src/components/warranty/ProductPreviewCard.jsx \
        Frontend/salyco-front/src/components/warranty/WarrantyRegistration.jsx \
        Frontend/salyco-front/src/pages/WarrantyStatusPage.jsx
git commit -m "feat: show the scanned product's photo and specs on the warranty page

The scan page showed only a product name, so nothing let the customer
confirm the sticker they scanned belongs to the product in front of them.
Renders in both the signed-out and signed-in views."
```

---

### Task 7: Four warranty states in the customer UI

Feature 2's customer-facing half. `StatusBadge` and `ActionButton` switch from
an `isRegistered` boolean to a `status` string, `WarrantyRegistration` gates the
form on it, and the unauthenticated branch stops pushing pending/approved
visitors to a login that cannot help them.

**Files:**
- Modify: `Frontend/salyco-front/src/components/warranty/StatusBadge.jsx` (rewrite)
- Modify: `Frontend/salyco-front/src/components/warranty/ActionButton.jsx` (rewrite)
- Modify: `Frontend/salyco-front/src/components/warranty/WarrantyRegistration.jsx`
- Modify: `Frontend/salyco-front/src/pages/WarrantyStatusPage.jsx:109-157`

**Interfaces:**
- Consumes: Task 3's `warranty_status` and `warranty_rejection_reason` on the
  check response; Task 2's `detail` string on the registration 201; Task 6's
  `ProductPreviewCard`.
- Produces: `StatusBadge({ status, expired })` and
  `ActionButton({ status, onClick })`, both taking one of the four status
  strings `"UNREGISTERED" | "PENDING" | "APPROVED" | "REJECTED"` and falling
  back to `UNREGISTERED` for anything unrecognised. `StatusBadge` renders a bare
  `<span>` with no positioning wrapper — callers position it. Consumed by
  Task 8's `MyWarrantiesPage`.

Status strings are compared against string literals rather than an imported
enum, matching how the codebase already compares order statuses.

- [x] **Step 1: Rewrite `StatusBadge` for four states**

Replace the whole of
`Frontend/salyco-front/src/components/warranty/StatusBadge.jsx` with:

```jsx
import { CheckCircle2, Clock, XCircle, Circle, ShieldOff } from "lucide-react";

// Four states, not a boolean: a submitted request is waiting on an admin, and a
// rejected one has to say so or the customer sees no difference from never
// having applied. `expired` is a separate axis — an approved warranty whose
// period has run out — so callers that track it can pass it in.
const STATES = {
  APPROVED: {
    label: "فعال",
    fill: "bg-[#E6F4EA]",
    text: "text-[#019C34]",
    Icon: CheckCircle2,
  },
  PENDING: {
    label: "در انتظار تأیید",
    fill: "bg-[#E7F3FB]",
    text: "text-[#009CDE]",
    Icon: Clock,
  },
  REJECTED: {
    label: "رد شده",
    fill: "bg-[#FDE7E7]",
    text: "text-[#D20000]",
    Icon: XCircle,
  },
  UNREGISTERED: {
    label: "غیرفعال",
    fill: "bg-[#FFF8E1]",
    text: "text-[#F5BA2E]",
    Icon: Circle,
  },
  EXPIRED: {
    label: "منقضی",
    fill: "bg-[#F5F7FA]",
    text: "text-[#687173]",
    Icon: ShieldOff,
  },
};

const StatusBadge = ({ status, expired = false }) => {
  const key = status === "APPROVED" && expired ? "EXPIRED" : status;
  const state = STATES[key] || STATES.UNREGISTERED;
  const { Icon } = state;

  return (
    <span
      className={`inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm font-semibold ${state.fill} ${state.text}`}
    >
      <Icon size={14} strokeWidth={2} />
      <span className="font-persian">{state.label}</span>
    </span>
  );
};

export default StatusBadge;
```

The old component wrapped itself in `<div className="ml-auto">`. That wrapper
moves to the call site in Step 3 — a badge that positions itself cannot be
reused in Task 8's card rows.

- [x] **Step 2: Rewrite `ActionButton` for four states**

Replace the whole of
`Frontend/salyco-front/src/components/warranty/ActionButton.jsx` with:

```jsx
import { CheckCircle2, PenLine, Clock, RotateCcw } from "lucide-react";

const ACTIONS = {
  APPROVED: {
    label: "مشاهده گارانتی",
    Icon: CheckCircle2,
    className: "bg-[#019C34] hover:brightness-95",
    disabled: false,
  },
  // Disabled on purpose: there is no customer action while an admin reviews.
  PENDING: {
    label: "در انتظار تأیید کارشناسان",
    Icon: Clock,
    className: "bg-[#009CDE]",
    disabled: true,
  },
  REJECTED: {
    label: "ثبت مجدد درخواست",
    Icon: RotateCcw,
    className: "bg-[#003087] hover:bg-[#00246B]",
    disabled: false,
  },
  UNREGISTERED: {
    label: "ثبت گارانتی",
    Icon: PenLine,
    className: "bg-[#003087] hover:bg-[#00246B]",
    disabled: false,
  },
};

const ActionButton = ({ status, onClick }) => {
  const action = ACTIONS[status] || ACTIONS.UNREGISTERED;
  const { Icon } = action;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={action.disabled}
      className={`flex h-12 w-full items-center justify-center gap-3 rounded-lg px-6 text-lg font-medium text-white shadow-[0_1px_4px_rgba(0,48,135,0.06)] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70 ${action.className}`}
    >
      <Icon size={20} strokeWidth={2} />
      <span className="font-persian text-base">{action.label}</span>
    </button>
  );
};

export default ActionButton;
```

- [x] **Step 3: Drive `WarrantyRegistration` from the status**

In `Frontend/salyco-front/src/components/warranty/WarrantyRegistration.jsx`,
replace the `isRegistered` line (line 11) with:

```jsx
  // The one component that needs all four states rather than a boolean — which
  // is why is_warranty_active stayed a property for every other consumer.
  const status = warrantyData.warranty_status || "UNREGISTERED";
  const isApproved = status === "APPROVED";
  const canSubmit = status === "UNREGISTERED" || status === "REJECTED";
```

Replace the success branch of `handleRegister` (lines 39-44) with:

```jsx
      const result = await registerWarranty({
        serial_number: serialNumber,
        ...formData,
      });
      setShowForm(false);
      setMessage({
        type: "success",
        text:
          result?.detail ||
          "درخواست ثبت گارانتی ارسال شد و پس از تأیید کارشناسان فعال می‌شود",
      });
      onRegistrationSuccess?.();
```

(That replaces the whole `await registerWarranty({…})` call too — the response
is now used, so it has to be captured.)

Then replace the render block at lines 70-94 with:

```jsx
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-[#CBD2D6] bg-[#F5F7FA] p-4 sm:p-5">
          {/* activation_date is set at submission, so warranty_remaining_days
              returns a real positive number while a request is still PENDING.
              Rendering the dial then would tell the customer their coverage had
              already started — the spec's "Known sharp edge", which is why the
              rule is to branch on warranty_status and never on
              warranty_remaining_days > 0. Gated on APPROVED, exactly as
              MyWarrantiesPage does. */}
          {isApproved ? (
            <GuaranteeDisk product={product} />
          ) : (
            <p className="font-persian text-sm text-[#687173]" dir="rtl">
              {status === "PENDING"
                ? "پوشش گارانتی پس از تأیید کارشناسان، از تاریخ ثبت درخواست محاسبه می‌شود."
                : status === "REJECTED"
                  ? "برای فعال‌سازی گارانتی، درخواست را دوباره ثبت کنید."
                  : "گارانتی این محصول هنوز ثبت نشده است."}
            </p>
          )}
          <div className="ml-auto">
            <StatusBadge status={status} />
          </div>
        </div>

        {status === "REJECTED" && (
          <div
            className="mb-4 rounded-lg border border-[#D20000] bg-[#FDE7E7] px-5 py-3"
            dir="rtl"
          >
            <p className="font-persian text-sm font-semibold text-[#D20000]">
              درخواست قبلی شما رد شد
            </p>
            {warrantyData.warranty_rejection_reason && (
              <p className="mt-1 font-persian text-sm leading-6 text-[#D20000]">
                {warrantyData.warranty_rejection_reason}
              </p>
            )}
            <p className="mt-1 font-persian text-xs text-[#D20000]/80">
              اطلاعات را اصلاح کنید و درخواست را دوباره ثبت کنید.
            </p>
          </div>
        )}

        <ActionButton
          status={status}
          onClick={
            isApproved ? handleShowWarrantyInfo : () => setShowForm(true)
          }
        />

        {message.type && (
          <MessageToast type={message.type} text={message.text} />
        )}

        {canSubmit && showForm && (
          <RegistrationForm
            formData={formData}
            setFormData={setFormData}
            onCancel={() => setShowForm(false)}
            onSubmit={handleRegister}
            loading={loading}
          />
        )}
```

`PENDING` never reaches `onClick` — the button is disabled — and `canSubmit`
keeps the form off the page entirely for `PENDING` and `APPROVED`.

- [x] **Step 4: Fix the unauthenticated gate**

The gate currently keys off `!warrantyData.is_warranty_active`, so an
unauthenticated visitor to a *pending* serial is pushed to a login that cannot
help them. New rule: unauth + `UNREGISTERED`/`REJECTED` → login CTA; unauth +
`PENDING`/`APPROVED` → read-only status, no CTA.

In `Frontend/salyco-front/src/pages/WarrantyStatusPage.jsx`, add the import:

```jsx
import StatusBadge from "../components/warranty/StatusBadge";
```

Then replace the whole `{!loading && !error && warrantyData && ( … )}` block
(lines 109-157) with:

```jsx
        {!loading && !error && warrantyData && <WarrantyView
          warrantyData={warrantyData}
          serialNumber={serialNumber}
          isAuthenticated={isAuthenticated}
          onNavigate={navigate}
          onRefresh={fetchWarranty}
        />}
```

and add this component below `WarrantyStatusPage` in the same file:

```jsx
// Signed-in customers get the full registration card. Signed-out ones get a
// login CTA only when logging in would actually let them do something: a
// pending or approved serial is read-only, so the CTA would be a dead end.
function WarrantyView({
  warrantyData,
  serialNumber,
  isAuthenticated,
  onNavigate,
  onRefresh,
}) {
  if (isAuthenticated) {
    return (
      <WarrantyRegistration
        warrantyData={warrantyData}
        serialNumber={serialNumber}
        onRegistrationSuccess={onRefresh}
      />
    );
  }

  const status = warrantyData.warranty_status || "UNREGISTERED";
  const canClaim = status === "UNREGISTERED" || status === "REJECTED";

  const READ_ONLY_MESSAGE = {
    PENDING:
      "درخواست ثبت گارانتی این محصول ارسال شده و در انتظار تأیید کارشناسان است.",
    APPROVED: "گارانتی این محصول فعال است.",
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[#CBD2D6] bg-white p-8 text-center shadow-[0_1px_4px_rgba(0,48,135,0.06)]">
      <ProductPreviewCard warrantyData={warrantyData} />

      <p className="mt-1 font-mono text-sm text-[#687173]" dir="ltr">
        {serialNumber}
      </p>

      <div className="mt-4 flex justify-center">
        <StatusBadge status={status} />
      </div>

      {canClaim ? (
        <>
          <p className="mt-4 font-persian text-sm text-[#687173]" dir="rtl">
            برای ثبت درخواست گارانتی وارد حساب کاربری خود شوید.
          </p>
          <button
            onClick={() =>
              onNavigate(`/auth?redirect=/warranty/mattress/${serialNumber}`)
            }
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-lg bg-[#003087] px-6 font-persian font-semibold text-white shadow-[0_1px_4px_rgba(0,48,135,0.06)] transition hover:bg-[#00246B]"
          >
            <LogIn size={18} strokeWidth={2} />
            ورود / ثبت‌نام برای ثبت گارانتی
          </button>
        </>
      ) : (
        <p className="mt-4 font-persian text-sm text-[#687173]" dir="rtl">
          {READ_ONLY_MESSAGE[status]}
        </p>
      )}
    </div>
  );
}
```

Step 3 of Task 6 put `ProductPreviewCard` inline in the old block; this replaces
that block wholesale, so the card moves into `WarrantyView` and the import added
in Task 6 is still the one being used.

- [x] **Step 5: Verify lint and build pass**

```bash
npm run lint
npm run build
```

Expected: both succeed. Lint will flag `ShieldCheck` if the error block above
was disturbed — it must still be there. It will also flag `isRegistered` if any
reference survived; grep to be sure:

```bash
grep -rn "isRegistered" src/
```

Expected: no output.

- [ ] **Step 6: Manual check of all four states**  ← NOT RUN: needs a browser + running stack

Set a serial's state directly in the Django shell and reload
`/warranty/mattress/<serial>` for each:

```bash
env/Scripts/python.exe manage.py shell -c "
from mattress.models import MattressInstance
i = MattressInstance.objects.get(serial_number='YOUR-SERIAL')
i.warranty_status = MattressInstance.REJECTED
i.warranty_rejection_reason = 'سریال با محصول همخوانی ندارد'
i.save()
"
```

Expected, signed in: `UNREGISTERED` → amber غیرفعال badge + ثبت گارانتی button
opening the form; `PENDING` → cyan در انتظار تأیید badge + disabled button + no
form; `APPROVED` → green فعال badge + مشاهده گارانتی; `REJECTED` → red رد شده
badge + the reason in a red callout + ثبت مجدد درخواست opening the form. Signed
out: the login CTA appears for `UNREGISTERED`/`REJECTED` only, and the pending
and approved states show a read-only message with no button.

**Check the coverage dial specifically.** It must appear for `APPROVED` only. For
`PENDING`, `REJECTED` and `UNREGISTERED` you must see the explanatory sentence
instead — never a percentage or a "ماه باقی‌مانده" figure. A dial next to a
"در انتظار تأیید" badge is the exact failure this feature exists to prevent: it
tells the customer their coverage has already started. `activation_date` is set
at submission, so `warranty_remaining_days` returns a real positive number in
that state and the dial would render convincingly wrong.

- [x] **Step 7: Commit**

```bash
git add Frontend/salyco-front/src/components/warranty/ \
        Frontend/salyco-front/src/pages/WarrantyStatusPage.jsx
git commit -m "feat: show all four warranty states to the customer

StatusBadge and ActionButton take a status instead of an isRegistered
boolean; a pending request disables the button and hides the form; a
rejection shows its reason above a resubmit button. Signed-out visitors
only see a login CTA when logging in would let them act."
```

---

### Task 8: Status and thumbnail on the customer's warranty list

Task 5 broadened `GET /api/warranty/my/` to return pending and rejected rows.
Right now the page renders every row with a فعال/منقضی badge driven by
`is_under_warranty`, so a pending request would display as منقضی — worse than
invisible, because it is wrong.

**Files:**
- Modify: `Frontend/salyco-front/src/pages/MyWarrantiesPage.jsx:123-194`

**Interfaces:**
- Consumes: Task 5's `warranty_status`, `warranty_rejection_reason` on each
  `MattressInstanceSerializer` row; Task 7's `StatusBadge({ status, expired })`;
  the existing nested `item.mattress.image` (already served — the serializer
  nests `MattressSerializer`, which includes `image`).
- Produces: nothing consumed downstream.

- [x] **Step 1: Add the imports**

In `Frontend/salyco-front/src/pages/MyWarrantiesPage.jsx`, replace the
`lucide-react` import (line 6) and add two more:

```jsx
import { ShieldOff, Plus, AlertTriangle } from "lucide-react";
import StatusBadge from "../components/warranty/StatusBadge";
import { getProductImageUrl } from "../utils/productImage";
```

`ShieldCheck` was only used by the badge this task replaces, so it comes out of
the import list; `ShieldOff` is still used by the empty state at line 96.

- [x] **Step 2: Replace the row body**

Replace the whole `warranties.map(…)` callback body (lines 125-191) with:

```jsx
            {warranties.map((item) => {
              const product = {
                name: item.mattress?.name || "—",
                serial: item.serial_number,
                totalWarrantyMonths: item.mattress?.warranty_months || 0,
                remainingMonths: Math.max(
                  0,
                  Math.round((item.warranty_remaining_days || 0) / 30),
                ),
              };
              const status = item.warranty_status || "UNREGISTERED";
              // Only an approved warranty can be expired; for the other states
              // the badge's own label is the whole story.
              const expired =
                status === "APPROVED" && !item.is_under_warranty;

              return (
                <Link
                  key={item.serial_number}
                  to={`/warranty/mattress/${item.serial_number}`}
                  className="group overflow-hidden rounded-xl border border-[#CBD2D6] bg-white p-6 shadow-[0_1px_4px_rgba(0,48,135,0.06)] transition-all duration-300 hover:shadow-[0_4px_16px_rgba(0,48,135,0.1)]"
                >
                  <div className="mb-4 flex items-start gap-3" dir="rtl">
                    <img
                      src={getProductImageUrl(item.mattress?.image)}
                      alt={product.name}
                      className="h-16 w-16 shrink-0 rounded-xl border border-[#CBD2D6] bg-[#F5F7FA] object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-persian text-lg font-semibold text-[#1A1A2E]">
                        {product.name}
                      </h3>
                      <p
                        className="mt-1 font-mono text-xs text-[#687173]"
                        dir="ltr"
                      >
                        {item.serial_number}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 flex" dir="rtl">
                    <StatusBadge status={status} expired={expired} />
                  </div>

                  {status === "REJECTED" && item.warranty_rejection_reason && (
                    <p
                      className="mb-4 rounded-lg border border-[#D20000] bg-[#FDE7E7] px-4 py-2 font-persian text-xs leading-6 text-[#D20000]"
                      dir="rtl"
                    >
                      {item.warranty_rejection_reason}
                    </p>
                  )}

                  {status === "APPROVED" ? (
                    <div className="flex items-center gap-4 rounded-xl border border-[#CBD2D6] bg-[#F5F7FA] p-3">
                      <GuaranteeDisk product={product} />
                      <div dir="rtl" className="text-sm">
                        {item.activation_date && (
                          <p className="font-persian text-[#687173]">
                            فعال‌سازی:{" "}
                            {new Date(item.activation_date).toLocaleDateString(
                              "fa-IR",
                            )}
                          </p>
                        )}
                        {item.warranty_expiration_date && (
                          <p className="font-persian text-[#687173]">
                            انقضا:{" "}
                            {new Date(
                              item.warranty_expiration_date,
                            ).toLocaleDateString("fa-IR")}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    // activation_date is set at submission, so the expiration
                    // properties return real-looking dates while a request is
                    // still pending. Showing the coverage dial here would tell
                    // the customer their warranty had started. See the spec's
                    // "Known sharp edge".
                    <p
                      className="rounded-xl border border-[#CBD2D6] bg-[#F5F7FA] p-3 font-persian text-sm text-[#687173]"
                      dir="rtl"
                    >
                      {status === "PENDING"
                        ? "پس از تأیید کارشناسان، پوشش گارانتی از تاریخ ثبت درخواست محاسبه می‌شود."
                        : "برای ثبت مجدد درخواست، این محصول را انتخاب کنید."}
                    </p>
                  )}
                </Link>
              );
            })}
```

The `GuaranteeDisk` import at line 4 stays — it is still used, now only in the
approved branch.

- [x] **Step 3: Verify lint and build pass**

```bash
npm run lint
npm run build
```

Expected: both succeed. If lint reports `ShieldCheck` as undefined, Step 1's
import edit was skipped; if it reports it as unused, the badge replacement was
skipped.

- [ ] **Step 4: Manual check**  ← NOT RUN: needs a browser + running stack

Sign in as a customer who owns one instance in each state (set them in the shell
as in Task 7 Step 6) and open `/warranty/my`. Expected: all three rows appear,
each with its product thumbnail and the matching badge; the rejected row shows
its reason; only the approved row shows the coverage dial and dates. Then expire
an approved one (set `activation_date` far in the past) and confirm its badge
reads منقضی.

- [x] **Step 5: Commit**

```bash
git add Frontend/salyco-front/src/pages/MyWarrantiesPage.jsx
git commit -m "feat: show warranty state and product thumbnail on my-warranties

Pending and rejected requests now appear with the right badge instead of
rendering as منقضی, and a rejected row carries its reason. The coverage
dial shows only for approved warranties — activation_date is set at
submission, so it would otherwise imply coverage had started."
```

---

### Task 9: Admin review queue panel

The panel an admin uses to approve or reject. Modeled on `ReviewsPanel.jsx` —
same header, filter bar, card list and `busyId` pattern.

**Files:**
- Modify: `Frontend/salyco-front/src/api/admin.js` (append two functions)
- Create: `Frontend/salyco-front/src/pages/admin/WarrantyRequestsPanel.jsx`
- Modify: `Frontend/salyco-front/src/pages/admin/AdminWorkspace.jsx:19-57`
- Modify: `Frontend/salyco-front/src/App.jsx:23-34, 112-118`

**Interfaces:**
- Consumes: Task 4's `GET /api/admin/warranty-requests/` (params `status`,
  `search`) and `PATCH /api/admin/warranty-requests/<serial>/` (body
  `{action: "approve"}` or `{action: "reject", rejection_reason: str}`), and the
  row fields `serial_number`, `mattress_name`, `mattress_image`,
  `customer_name`, `customer_phone`, `buyer_address`, `buyer_postal_code`,
  `warranty_status`, `warranty_months`, `warranty_submitted_at`,
  `warranty_reviewed_at`, `reviewed_by_name`, `warranty_rejection_reason`.
- Produces: `listAdminWarrantyRequests(params)` and
  `reviewAdminWarrantyRequest(serialNumber, data)` in `api/admin.js`; the route
  `/admin/warranty-requests`.

- [x] **Step 1: Add the two API functions**

Append to `Frontend/salyco-front/src/api/admin.js`:

```js
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
```

- [x] **Step 2: Create the panel**

Create `Frontend/salyco-front/src/pages/admin/WarrantyRequestsPanel.jsx`:

```jsx
import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  Search,
  Filter,
  Check,
  X,
  Clock,
  Loader2,
  RotateCcw,
  Phone,
  MapPin,
  Mail,
  User,
  CalendarClock,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import {
  listAdminWarrantyRequests,
  reviewAdminWarrantyRequest,
} from "../../api/admin";
import { getProductImageUrl } from "../../utils/productImage";

const faNum = (n) => Number(n ?? 0).toLocaleString("fa-IR");

const faDateTime = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fa-IR");
  } catch {
    return iso;
  }
};

const STATES = {
  PENDING: {
    label: "در انتظار تأیید",
    fill: "bg-[#E7F3FB]",
    text: "text-[#009CDE]",
    Icon: Clock,
  },
  APPROVED: {
    label: "تأیید شده",
    fill: "bg-[#E6F4EA]",
    text: "text-[#019C34]",
    Icon: CheckCircle2,
  },
  REJECTED: {
    label: "رد شده",
    fill: "bg-[#FDE7E7]",
    text: "text-[#D20000]",
    Icon: XCircle,
  },
};

function StatusPill({ status }) {
  const state = STATES[status] || STATES.PENDING;
  const { Icon } = state;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${state.fill} ${state.text}`}
    >
      <Icon size={13} /> {state.label}
    </span>
  );
}

function InfoRow({ icon: Icon, value, ltr }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={14} className="mt-0.5 shrink-0 text-[#003087]" />
      <span
        className={`font-persian text-sm text-[#1A1A2E] ${ltr ? "font-mono" : ""}`}
        dir={ltr ? "ltr" : "rtl"}
      >
        {value || "—"}
      </span>
    </div>
  );
}

export default function WarrantyRequestsPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  // Defaults to the queue that needs work, not to everything.
  const [statusFilter, setStatusFilter] = useState("PENDING");

  // Serial whose reject form is open, plus the reason typed into it.
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");

  const params = useCallback(
    () => ({ search, status: statusFilter }),
    [search, statusFilter]
  );

  const load = useCallback(() => {
    setLoading(true);
    listAdminWarrantyRequests(params())
      .then((d) => setRows(Array.isArray(d) ? d : d.results || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [params]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const applyDecision = async (serial, payload) => {
    setBusyId(serial);
    setError("");
    try {
      const updated = await reviewAdminWarrantyRequest(serial, payload);
      setRows((rs) =>
        // The decided row usually no longer matches the active filter — the
        // default view is PENDING and it just stopped being pending — so drop
        // it rather than leave a row the filter excludes.
        statusFilter && updated.warranty_status !== statusFilter
          ? rs.filter((r) => r.serial_number !== serial)
          : rs.map((r) => (r.serial_number === serial ? updated : r))
      );
      setRejecting(null);
      setReason("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (serial) => {
    setError("");
    setReason("");
    setRejecting(serial);
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("");
  };

  const hasFilters = search || statusFilter;
  const pending = rows.filter((r) => r.warranty_status === "PENDING").length;

  return (
    <>
      {/* header */}
      <header className="mb-8" dir="rtl">
        <p className="flex items-center gap-2 font-sans text-sm uppercase tracking-[0.3em] text-[#687173]">
          <ShieldCheck size={16} /> Warranty Approvals
        </p>
        <h1 className="mt-2 font-persian text-3xl font-bold text-[#003087] md:text-4xl">
          تأیید گارانتی‌ها
        </h1>
        <hr className="mt-4 w-24 border-t-2 border-[#003087]" />
        <p className="mt-4 font-persian text-sm text-[#687173]">
          درخواست‌های ثبت گارانتی را بررسی کنید. تصویر محصول را با اطلاعات
          خریدار مقایسه کنید؛ گارانتی فقط پس از تأیید شما فعال می‌شود.
          {pending > 0 && (
            <span className="mr-1 font-semibold text-[#009CDE]">
              ({faNum(pending)} درخواست در انتظار تأیید)
            </span>
          )}
        </p>
      </header>

      {/* filters */}
      <div
        className="mb-6 rounded-xl border border-[#CBD2D6] bg-white p-4 shadow-[0_1px_4px_rgba(0,48,135,0.06)]"
        dir="rtl"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search
              size={16}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#687173]"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی سریال، نام یا تلفن خریدار..."
              className="h-12 w-full rounded-lg border border-[#CBD2D6] bg-white pr-11 pl-4 text-sm text-[#1A1A2E] outline-none transition focus:border-[#003087] focus:ring-2 focus:ring-[#009CDE]/20"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-12 rounded-lg border border-[#CBD2D6] bg-white px-4 font-persian text-sm text-[#1A1A2E] outline-none transition focus:border-[#003087] focus:ring-2 focus:ring-[#009CDE]/20"
          >
            <option value="">وضعیت (همه)</option>
            <option value="PENDING">در انتظار تأیید</option>
            <option value="APPROVED">تأیید شده</option>
            <option value="REJECTED">رد شده</option>
          </select>

          {hasFilters && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#003087] bg-white px-4 py-2.5 font-persian text-sm text-[#003087] transition hover:bg-[#F5F7FA]"
            >
              <RotateCcw size={14} /> پاک کردن
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          className="mb-6 rounded-lg border border-[#D20000] bg-[#FDE7E7] px-5 py-3 font-persian text-sm text-[#D20000]"
          dir="rtl"
        >
          {error}
        </div>
      )}

      {/* list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#003087]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-[#CBD2D6] bg-white py-20 text-center shadow-[0_1px_4px_rgba(0,48,135,0.06)]">
          <Filter size={40} className="mx-auto mb-3 text-[#CBD2D6]" />
          <p className="font-persian text-sm text-[#687173]">
            درخواستی یافت نشد.
          </p>
        </div>
      ) : (
        <div className="space-y-4" dir="rtl">
          {rows.map((r) => (
            <div
              key={r.serial_number}
              className="rounded-xl border border-[#CBD2D6] bg-white p-5 shadow-[0_1px_4px_rgba(0,48,135,0.06)]"
            >
              <div className="flex flex-col gap-4 sm:flex-row">
                {/* The photo the customer saw. Approving is a verification
                    decision, so the reviewer needs the same image. */}
                <img
                  src={getProductImageUrl(r.mattress_image)}
                  alt={r.mattress_name}
                  className="h-28 w-28 shrink-0 self-center rounded-xl border border-[#CBD2D6] bg-[#F5F7FA] object-cover"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-persian text-base font-semibold text-[#1A1A2E]">
                      {r.mattress_name}
                    </h3>
                    <StatusPill status={r.warranty_status} />
                    <span className="font-persian text-xs text-[#687173]">
                      {faNum(r.warranty_months)} ماه گارانتی
                    </span>
                  </div>

                  <p
                    className="mt-1 font-mono text-sm text-[#003087]"
                    dir="ltr"
                  >
                    {r.serial_number}
                  </p>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <InfoRow icon={User} value={r.customer_name} />
                    <InfoRow icon={Phone} value={r.customer_phone} ltr />
                    <InfoRow icon={MapPin} value={r.buyer_address} />
                    <InfoRow icon={Mail} value={r.buyer_postal_code} ltr />
                  </div>

                  <p className="mt-3 inline-flex items-center gap-1.5 font-persian text-xs text-[#687173]">
                    <CalendarClock size={13} />
                    ثبت درخواست: {faDateTime(r.warranty_submitted_at)}
                  </p>

                  {r.warranty_status !== "PENDING" && (
                    <p className="mt-1 font-persian text-xs text-[#687173]">
                      بررسی‌شده توسط {r.reviewed_by_name || "—"} ·{" "}
                      {faDateTime(r.warranty_reviewed_at)}
                    </p>
                  )}

                  {r.warranty_rejection_reason && (
                    <p className="mt-3 rounded-lg border border-[#D20000] bg-[#FDE7E7] px-4 py-2 font-persian text-xs leading-6 text-[#D20000]">
                      دلیل رد: {r.warranty_rejection_reason}
                    </p>
                  )}
                </div>
              </div>

              {r.warranty_status === "PENDING" && (
                <div className="mt-4 border-t border-[#CBD2D6] pt-4">
                  {rejecting === r.serial_number ? (
                    <div className="space-y-3">
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        placeholder="دلیل رد درخواست — این متن به مشتری نشان داده می‌شود."
                        className="w-full rounded-lg border border-[#CBD2D6] bg-white p-3 font-persian text-sm text-[#1A1A2E] outline-none transition focus:border-[#003087] focus:ring-2 focus:ring-[#009CDE]/20"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() =>
                            applyDecision(r.serial_number, {
                              action: "reject",
                              rejection_reason: reason.trim(),
                            })
                          }
                          disabled={
                            !reason.trim() || busyId === r.serial_number
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#D20000] px-4 py-2 font-persian text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busyId === r.serial_number ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <X size={14} />
                          )}
                          ثبت رد درخواست
                        </button>
                        <button
                          onClick={() => {
                            setRejecting(null);
                            setReason("");
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#CBD2D6] bg-white px-4 py-2 font-persian text-sm text-[#687173] transition hover:bg-[#F5F7FA]"
                        >
                          انصراف
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          applyDecision(r.serial_number, { action: "approve" })
                        }
                        disabled={busyId === r.serial_number}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#019C34] px-4 py-2 font-persian text-sm font-semibold text-white transition hover:bg-[#017a29] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyId === r.serial_number ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Check size={14} />
                        )}
                        تأیید و فعال‌سازی گارانتی
                      </button>
                      <button
                        onClick={() => openReject(r.serial_number)}
                        disabled={busyId === r.serial_number}
                        className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#D20000] bg-white px-4 py-2 font-persian text-sm font-semibold text-[#D20000] transition hover:bg-[#FDE7E7] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <X size={14} /> رد درخواست
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p
        className="mt-4 text-center font-persian text-xs text-[#687173]"
        dir="rtl"
      >
        {faNum(rows.length)} درخواست نمایش داده شد
      </p>
    </>
  );
}
```

Approve is one click; reject needs a reason and the button stays disabled until
one is typed, so the backend's 400 is a backstop rather than the primary guard.

- [x] **Step 3: Add the sidebar entry**

`Frontend/salyco-front/src/pages/admin/AdminWorkspace.jsx` — insert into the
`controls` array, after the `/admin/create` entry:

```jsx
  {
    to: "/admin/warranty-requests",
    label: "تأیید گارانتی‌ها",
    hint: "بررسی درخواست‌های ثبت گارانتی",
    icon: ShieldCheck,
  },
```

`ShieldCheck` is already imported at line 9 for the sidebar header, so the import
list needs no change.

- [x] **Step 4: Add the route**

`Frontend/salyco-front/src/App.jsx` — add the import beside the other admin
panels:

```jsx
import WarrantyRequestsPanel from "./pages/admin/WarrantyRequestsPanel";
```

and the nested route inside the `/admin` route, after the `create` route:

```jsx
              <Route
                path="warranty-requests"
                element={<WarrantyRequestsPanel />}
              />
```

- [x] **Step 5: Verify lint and build pass**

```bash
npm run lint
npm run build
```

Expected: both succeed.

- [ ] **Step 6: Manual check**  ← NOT RUN: needs a browser + running stack

Sign in as staff, submit a warranty request as a customer in another browser
profile, then open `/admin/warranty-requests`. Expected: the request appears with
the product photo, the buyer's name/phone/address/postal code, and the submitted
timestamp. Click تأیید — the row leaves the default PENDING view, the customer's
page turns green فعال, and the activation SMS fires once. Submit a second
request, click رد درخواست, confirm the button stays disabled with an empty
textarea, type a reason and submit — the row leaves the PENDING view, and the
customer sees the reason with a resubmit button.

Then, with two browser tabs open on the queue, approve the same request from
both. Expected: the second one shows "این درخواست قبلاً بررسی شده است" in the
error banner and no second SMS is sent.

- [x] **Step 7: Commit**

```bash
git add Frontend/salyco-front/src/api/admin.js \
        Frontend/salyco-front/src/pages/admin/WarrantyRequestsPanel.jsx \
        Frontend/salyco-front/src/pages/admin/AdminWorkspace.jsx \
        Frontend/salyco-front/src/App.jsx
git commit -m "feat: admin panel to review warranty requests

Oldest-first queue defaulting to pending, showing the product photo next
to the buyer snapshot so the reviewer can verify the match. Approve is one
click; reject requires a reason, which the customer then sees."
```

---

### Task 10: Status-aware CRM dashboard

`DashboardPanel` renders warranty state from `is_warranty_active`, so a pending
request shows as غیرفعال — indistinguishable from an unclaimed serial. This task
gives the dashboard the four states, a pending stat card, and the new filter
values Task 5 added to the API.

It starts with a backend change: `AdminInstanceSerializer` — the serializer
behind both the instance table and the detail modal — does not expose
`warranty_status` at all, so there is nothing for the frontend to branch on.

**Files:**
- Modify: `Backend/mattress/admin_serializers.py` (`AdminInstanceSerializer.Meta.fields`, and `AdminWarrantyRequestSerializer.Meta.fields`)
- Modify: `Backend/mattress/tests.py` (append to `WarrantyReadSurfaceTests`)
- Modify: `Frontend/salyco-front/src/pages/admin/DashboardPanel.jsx:1-61, 128-153, 305-314, 349-360, 496-505`

**Interfaces:**
- Consumes: Task 5's `pending_warranties` stat and `warranty=pending|rejected`
  filter values; Task 1's `warranty_status` field.
- Produces: `GET /api/admin/instances/` rows and
  `GET /api/admin/instances/<serial>/` gain `warranty_status: str` and
  `warranty_rejection_reason: str`.

- [x] **Step 1: Write the failing tests**

Append these two methods to `WarrantyReadSurfaceTests` in
`Backend/mattress/tests.py` (the class Task 5 created — its fixtures already
include an approved, a pending, a rejected and an unclaimed instance plus a staff
user):

```python
    def test_instance_row_carries_warranty_status(self):
        """The CRM table branches on the status, so the compact row must carry
        it — is_warranty_active alone cannot distinguish pending from
        unregistered."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            reverse("admin-instances"), {"search": "SRF-REJECTED"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = response.data[0]
        self.assertEqual(row["warranty_status"], MattressInstance.REJECTED)
        self.assertEqual(
            row["warranty_rejection_reason"], "سریال با محصول همخوانی ندارد"
        )

    def test_instance_detail_carries_warranty_status(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            reverse("admin-instance-detail", args=["SRF-PENDING"])
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["warranty_status"], MattressInstance.PENDING
        )
```

- [x] **Step 2: Run the tests to verify they fail**

```bash
env/Scripts/python.exe manage.py test mattress.tests.WarrantyReadSurfaceTests -v 2
```

Expected: FAIL — `KeyError: 'warranty_status'`.

- [x] **Step 3: Expose the status on the admin instance serializers**

`Backend/mattress/admin_serializers.py` — add two entries to
`AdminInstanceSerializer.Meta.fields`, after `"is_warranty_active"`:

```python
            "warranty_status",
            "warranty_rejection_reason",
```

`AdminInstanceDetailSerializer` and `AdminWarrantyRequestSerializer` both build
their `fields` from `AdminInstanceSerializer.Meta.fields + [...]`, so they
inherit these automatically. That makes Task 4's copies redundant — **delete
`"warranty_status"` and `"warranty_rejection_reason"` from
`AdminWarrantyRequestSerializer.Meta.fields`**, leaving:

```python
    class Meta(AdminInstanceSerializer.Meta):
        fields = AdminInstanceSerializer.Meta.fields + [
            "warranty_months",
            "mattress_image",
            "warranty_submitted_at",
            "warranty_reviewed_at",
            "reviewed_by_name",
            "buyer_address",
            "buyer_postal_code",
        ]
```

A name listed twice in `fields` is not worth relying on either way — remove the
duplicate rather than test DRF's tolerance for it.

- [x] **Step 4: Run the full backend suite**

```bash
env/Scripts/python.exe manage.py test mattress -v 2
```

Expected: PASS, including Task 4's `test_queue_row_carries_buyer_and_product_detail`
— it asserts `row["warranty_status"]`, which is still present, now inherited.

- [x] **Step 5: Replace the dashboard's warranty badge**

`Frontend/salyco-front/src/pages/admin/DashboardPanel.jsx` — add two icons to
the `lucide-react` import (lines 10-29). `CheckCircle2` and `Circle` are already
there for `Badge`; only these two are new:

```jsx
  Clock,
  XCircle,
```

Then add this component directly below `Badge` (after line 61):

```jsx
// Four warranty states, not a boolean. An APPROVED instance still distinguishes
// in-period from expired — that was the old Badge's whole job here — while
// PENDING and REJECTED get their own colours so a submitted request is not
// mistaken for an unclaimed serial.
const WARRANTY_STATES = {
  PENDING: {
    label: "در انتظار تأیید",
    fill: "bg-[#E7F3FB]",
    text: "text-[#009CDE]",
    Icon: Clock,
  },
  REJECTED: {
    label: "رد شده",
    fill: "bg-[#FDE7E7]",
    text: "text-[#D20000]",
    Icon: XCircle,
  },
};

function WarrantyBadge({ row }) {
  if (row.warranty_status === "APPROVED") {
    return <Badge ok={row.is_under_warranty} yes="در دوره گارانتی" no="منقضی" />;
  }

  const state = WARRANTY_STATES[row.warranty_status];
  if (!state) return <Badge ok={false} yes="" no="غیرفعال" />;

  const { Icon } = state;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${state.fill} ${state.text}`}
    >
      <Icon size={13} /> {state.label}
    </span>
  );
}
```

In `InstanceTable`, replace the warranty cell (lines 499-505) with:

```jsx
              <td className="px-4 py-3">
                <WarrantyBadge row={r} />
              </td>
```

In `InstanceModal`, replace the two warranty badges (lines 139-142) with:

```jsx
                  <WarrantyBadge row={data} />
```

and add the rejection reason below the badge row — inside the same
`flex-1 space-y-2` div, directly after the closing `</div>` of the badge row:

```jsx
                {data.warranty_status === "REJECTED" &&
                  data.warranty_rejection_reason && (
                    <p className="rounded-lg border border-[#D20000] bg-[#FDE7E7] px-3 py-2 font-persian text-xs leading-6 text-[#D20000]">
                      دلیل رد: {data.warranty_rejection_reason}
                    </p>
                  )}
```

- [x] **Step 6: Add the pending stat card and the new filter values**

In the stats grid (lines 305-314), add a card after the "گارانتی فعال" one:

```jsx
        <StatCard icon={Clock} label="در انتظار تأیید" value={stats?.pending_warranties} accent="text-[#009CDE]" />
```

The grid is `sm:grid-cols-2 xl:grid-cols-4` with nine cards now; it wraps on its
own, so no layout change is needed.

In the warranty filter `<Select>` (lines 356-360), add the two new values:

```jsx
              <Select value={warranty} onChange={setWarranty}>
                <option value="">گارانتی (همه)</option>
                <option value="active">فعال</option>
                <option value="pending">در انتظار تأیید</option>
                <option value="rejected">رد شده</option>
                <option value="inactive">غیرفعال (هر وضعیتی جز فعال)</option>
              </Select>
```

`inactive` is relabelled because Task 5 defined it as `exclude(APPROVED)` — it
now covers pending and rejected too, and a bare "غیرفعال" would read as a
contradiction next to the two new options.

- [x] **Step 7: Verify lint and build pass**

```bash
npm run lint
npm run build
```

Expected: both succeed with no unused-import warnings.

- [ ] **Step 8: Manual check**  ← NOT RUN: needs a browser + running stack

Open `/admin`. Expected: the "در انتظار تأیید" stat card shows the pending count;
the instance table shows a cyan "در انتظار تأیید" pill for a pending serial, a
red "رد شده" pill for a rejected one, "در دوره گارانتی" for an approved one and
"غیرفعال" for an unclaimed one. Set the warranty filter to "در انتظار تأیید" and
confirm only pending rows remain. Open a rejected instance's detail modal and
confirm the reason appears.

- [x] **Step 9: Commit**

```bash
git add Backend/mattress/admin_serializers.py Backend/mattress/tests.py \
        Frontend/salyco-front/src/pages/admin/DashboardPanel.jsx
git commit -m "feat: show the four warranty states on the CRM dashboard

The admin instance serializers expose warranty_status and the rejection
reason, so the table and detail modal can tell a pending request from an
unclaimed serial. Adds a pending stat card and pending/rejected filter
values."
```

---

### Task 11: End-to-end verification and deployment note

The last five tasks each verified their own slice. This one walks the whole flow
once, confirms nothing outside the plan's scope was left reading the dropped
column, and checks that the migration reverses — the one operation here that
cannot be undone by a revert commit.

**Files:**
- Modify: `docs/superpowers/plans/2026-08-23-warranty-admin-approval.md` (tick the boxes)
- No source changes expected. Any defect found is fixed in the task that owns it.

**Interfaces:**
- Consumes: everything from Tasks 1-10.
- Produces: nothing.

- [x] **Step 1: Confirm no stale references to the dropped column**

```bash
grep -rn "is_warranty_active" Backend --include=*.py
grep -rn "is_warranty_active\|isRegistered" Frontend/salyco-front/src
```

Expected in the backend: only the property definition in `models.py`, the three
`BooleanField(read_only=True)` serializer declarations, the `"is_warranty_active"`
entries in serializer `fields` lists, and the CSV export's attribute read. **No
hit may be a `filter()`, `exclude()`, or `Q()` keyword** — a property cannot be
queried, and such a site raises `FieldError` at runtime rather than at import.

Expected in the frontend: no hits at all. Every consumer now branches on
`warranty_status`.

Also confirm the migration is the only one touching the column:

```bash
grep -rln "is_warranty_active" Backend/mattress/migrations/
```

Expected: `0012_warranty_status.py` and the earlier migration that created the
field. Nothing else.

- [x] **Step 2: Run the whole backend suite**

From `Backend/`:

```bash
env/Scripts/python.exe manage.py test mattress -v 2
```

Expected: PASS. Record the test count — every one of the roughly 30 tests added
across Tasks 1-10 should be in it, and no pre-existing test should have been
deleted to make it green.

- [x] **Step 3: Verify the migration reverses**

The forward migration drops a column, and the reverse is documented as lossy for
`PENDING` and `REJECTED`. Confirm it at least runs, so a bad deploy can be rolled
back:

```bash
env/Scripts/python.exe manage.py migrate mattress 0011
env/Scripts/python.exe manage.py migrate mattress 0012
```

Expected: both directions complete without error. Run this against a development
database only — the reverse leg discards pending and rejected requests, and the
second command restores the schema but not that information.

Then confirm the round trip preserved an approved warranty:

```bash
env/Scripts/python.exe manage.py shell -c "
from mattress.models import MattressInstance
print(MattressInstance.objects.filter(warranty_status=MattressInstance.APPROVED).count())
"
```

Expected: the same count as before Step 3. If it is 0 and it was not before, the
`RunPython` functions are in the wrong order relative to the `AddField`s and
`RemoveField` — see Task 1 Step 5.

- [x] **Step 4: Frontend lint and production build**

From `Frontend/salyco-front/`:

```bash
npm run lint
npm run build
```

Expected: both succeed.

- [ ] **Step 5: Walk the full flow manually**  ← NOT RUN: needs a browser + running stack

With the backend and frontend both running, and a serial whose mattress has an
uploaded image:

1. Scan or open `/warranty/mattress/<serial>` signed out. Expected: the product
   photo, name, brand and dimensions; a غیرفعال badge; a login CTA.
2. Sign in as a customer. Expected: the same card inside the registration view,
   with the ثبت گارانتی button.
3. Submit the form. Expected: "درخواست ثبت گارانتی شما ارسال شد و پس از تأیید
   کارشناسان فعال می‌شود", the badge turns cyan در انتظار تأیید, the button is
   disabled, the form is gone — **and no SMS arrives**.
4. Open `/warranty/my`. Expected: the row is listed with the pending badge, its
   thumbnail, and no coverage dial.
5. Sign in as staff, open `/admin/warranty-requests`. Expected: the request is in
   the queue with the photo and the full buyer snapshot.
6. Click رد درخواست, submit a reason. Expected: the customer's page shows the
   reason in a red callout with a ثبت مجدد درخواست button, and no SMS arrives.
7. Resubmit as the customer with corrected details. Expected: back to pending,
   the reason cleared.
8. Approve it as staff. Expected: the customer's page turns green فعال, the
   coverage dial appears on `/warranty/my`, **one** SMS arrives quoting the
   original submission date — not the approval date — and `/admin` shows the
   instance as "در دوره گارانتی" with the pending count down by one.

Any mismatch is a defect in the task that owns that surface; fix it there, re-run
that task's verification, and amend its commit.

- [x] **Step 6: Record the deployment constraint**

The migration drops a column, so the backend and frontend must ship together. A
frontend built before this change still *runs* — `is_warranty_active` survives as
a property — but it would show "فعال" for a pending request, which is the exact
failure this feature exists to prevent.

Append to `DEPLOYMENT.md`, under whatever migration or release-steps section it
already has:

```markdown
### Warranty approval flow (migration 0012)

`mattress.0012_warranty_status` drops `MattressInstance.is_warranty_active` and
replaces it with `warranty_status`. Deploy the backend and the frontend bundle in
the same release: an older frontend reads `is_warranty_active` — still served, as
a property — and would label a pending request "فعال".

Reversing `0012` is lossy. `APPROVED` maps back to `True`; `PENDING` and
`REJECTED` both collapse to `False`, discarding the fact that a request was ever
submitted or declined. Export the pending queue before rolling back.
```

- [x] **Step 7: Tick the plan's checkboxes and commit**

Mark every completed step in
`docs/superpowers/plans/2026-08-23-warranty-admin-approval.md`, then:

```bash
git add DEPLOYMENT.md docs/superpowers/plans/2026-08-23-warranty-admin-approval.md
git commit -m "docs: record warranty approval deployment constraint

Migration 0012 drops is_warranty_active, so backend and frontend must ship
together, and reversing it discards pending and rejected requests."
```

