from datetime import date
from decimal import Decimal
from io import BytesIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Customer, Mattress, MattressInstance, add_months

User = get_user_model()


def create_test_image(name: str = "test.jpg") -> SimpleUploadedFile:
    image = Image.new("RGB", (100, 100), color="red")
    buffer = BytesIO()
    image.save(buffer, format="JPEG")
    buffer.seek(0)
    return SimpleUploadedFile(name, buffer.read(), content_type="image/jpeg")


class AddMonthsTests(TestCase):
    def test_add_months_same_day(self):
        self.assertEqual(add_months(date(2024, 1, 15), 3), date(2024, 4, 15))

    def test_add_months_end_of_month_clamped(self):
        self.assertEqual(add_months(date(2024, 1, 31), 1), date(2024, 2, 29))


class MattressInstanceWarrantyPropertyTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.mattress = Mattress.objects.create(
            name="Cloud Comfort",
            description="Premium mattress",
            slug="cloud-comfort",
            warranty_months=120,
            price=Decimal("999.99"),
            image=create_test_image(),
        )

    def _create_instance(
        self,
        serial_number: str,
        activation_date: date | None = None,
        warranty_status: str = MattressInstance.UNREGISTERED,
    ) -> MattressInstance:
        return MattressInstance.objects.create(
            serial_number=serial_number,
            mattress=self.mattress,
            manufacture_date=date(2024, 1, 1),
            activation_date=activation_date,
            warranty_status=warranty_status,
        )

    def test_warranty_expiration_date_when_not_activated(self):
        instance = self._create_instance("SN-001")
        self.assertIsNone(instance.warranty_expiration_date)

    def test_warranty_expiration_date_calculation(self):
        activation_date = date(2024, 6, 1)
        instance = self._create_instance(
            "SN-002",
            activation_date=activation_date,
            warranty_status=MattressInstance.APPROVED,
        )
        self.assertEqual(
            instance.warranty_expiration_date,
            add_months(activation_date, self.mattress.warranty_months),
        )

    def test_warranty_remaining_days(self):
        today = timezone.localdate()
        instance = self._create_instance(
            "SN-003",
            activation_date=today,
            warranty_status=MattressInstance.APPROVED,
        )
        expected_days = (instance.warranty_expiration_date - today).days
        self.assertEqual(instance.warranty_remaining_days, expected_days)

    def test_is_under_warranty_true(self):
        instance = self._create_instance(
            "SN-004",
            activation_date=timezone.localdate(),
            warranty_status=MattressInstance.APPROVED,
        )
        self.assertTrue(instance.is_under_warranty)

    def test_is_under_warranty_false_when_expired(self):
        instance = self._create_instance(
            "SN-005",
            activation_date=date(2010, 1, 1),
            warranty_status=MattressInstance.APPROVED,
        )
        self.assertFalse(instance.is_under_warranty)

    def test_is_under_warranty_false_when_inactive(self):
        instance = self._create_instance("SN-006")
        self.assertFalse(instance.is_under_warranty)


class WarrantyAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.mattress = Mattress.objects.create(
            name="Dream Sleep",
            description="Comfort mattress",
            slug="dream-sleep",
            warranty_months=24,
            price=Decimal("499.00"),
            image=create_test_image("dream.jpg"),
        )
        cls.instance = MattressInstance.objects.create(
            serial_number="API-SN-001",
            mattress=cls.mattress,
            manufacture_date=date(2024, 1, 1),
        )
        cls.activated_instance = MattressInstance.objects.create(
            serial_number="API-SN-002",
            mattress=cls.mattress,
            manufacture_date=date(2024, 1, 1),
            activation_date=date(2024, 2, 1),
            warranty_status=MattressInstance.APPROVED,
        )
        cls.user = User.objects.create_user(
            username="warrantyuser",
            password="testpass123",
        )

    def test_register_warranty_success(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            reverse("warranty-register"),
            {
                "serial_number": "API-SN-001",
                "first_name": "Jane",
                "last_name": "Doe",
                "address": "123 Main St",
                "phone_number": "555-0100",
                "postal_code": "12345",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.instance.refresh_from_db()
        self.assertEqual(self.instance.warranty_status, MattressInstance.PENDING)
        self.assertEqual(self.instance.customer.user, self.user)
        self.assertEqual(self.instance.activation_date, timezone.localdate())

    def test_register_warranty_duplicate_activation_rejected(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            reverse("warranty-register"),
            {"serial_number": "API-SN-002"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("serial_number", response.data)

    def test_check_warranty_by_serial_number(self):
        response = self.client.get(reverse("warranty-check", args=["API-SN-002"]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["serial_number"], "API-SN-002")
        self.assertEqual(response.data["mattress_name"], "Dream Sleep")
        self.assertIn("warranty_expiration_date", response.data)

    def test_customer_warranty_list(self):
        customer = Customer.objects.create(
            user=self.user,
            first_name="Jane",
            last_name="Doe",
            address="123 Main St",
            phone_number="555-0100",
            postal_code="12345",
        )
        self.activated_instance.customer = customer
        self.activated_instance.save()

        self.client.force_authenticate(user=self.user)
        response = self.client.get(reverse("warranty-my-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["serial_number"], "API-SN-002")


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
