from datetime import date
from decimal import Decimal
from io import BytesIO

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
        is_warranty_active: bool = False,
    ) -> MattressInstance:
        return MattressInstance.objects.create(
            serial_number=serial_number,
            mattress=self.mattress,
            manufacture_date=date(2024, 1, 1),
            activation_date=activation_date,
            is_warranty_active=is_warranty_active,
        )

    def test_warranty_expiration_date_when_not_activated(self):
        instance = self._create_instance("SN-001")
        self.assertIsNone(instance.warranty_expiration_date)

    def test_warranty_expiration_date_calculation(self):
        activation_date = date(2024, 6, 1)
        instance = self._create_instance(
            "SN-002",
            activation_date=activation_date,
            is_warranty_active=True,
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
            is_warranty_active=True,
        )
        expected_days = (instance.warranty_expiration_date - today).days
        self.assertEqual(instance.warranty_remaining_days, expected_days)

    def test_is_under_warranty_true(self):
        instance = self._create_instance(
            "SN-004",
            activation_date=timezone.localdate(),
            is_warranty_active=True,
        )
        self.assertTrue(instance.is_under_warranty)

    def test_is_under_warranty_false_when_expired(self):
        instance = self._create_instance(
            "SN-005",
            activation_date=date(2010, 1, 1),
            is_warranty_active=True,
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
            is_warranty_active=True,
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
        self.assertTrue(self.instance.is_warranty_active)
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
