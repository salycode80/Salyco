"""The About page gallery: what the public sees, and what the panel may write.

The section was hard-coded paths in the frontend until this app replaced it, so
the two things worth pinning are the ones that changed meaning: which rows the
public endpoint returns, and whether a non-staff user can write at all.

These are the project's only tests that upload a file, so they are also the only
ones that would write into `media/`: `FileSystemStorage` honours `MEDIA_ROOT`
whatever the database is doing, and the test database being temporary does not
make the files it points at temporary. Every test class here therefore runs
against a throwaway directory that `tearDownModule` removes.
"""

from __future__ import annotations

import shutil
import tempfile
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from .models import GalleryImage

User = get_user_model()

# Module-scoped so the whole run shares one directory, removed in one place.
TEST_MEDIA_ROOT = tempfile.mkdtemp(prefix="salyco-gallery-tests-")


def tearDownModule():
    shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)


def create_test_image(name: str = "gallery.jpg") -> SimpleUploadedFile:
    image = Image.new("RGB", (100, 100), color="blue")
    buffer = BytesIO()
    image.save(buffer, format="JPEG")
    buffer.seek(0)
    return SimpleUploadedFile(name, buffer.read(), content_type="image/jpeg")


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class GalleryPublicTests(APITestCase):
    def setUp(self):
        self.url = reverse("gallery-list")
        self.visible = GalleryImage.objects.create(
            title="نمای کارگاه", image=create_test_image(), order=1, is_active=True
        )
        self.hidden = GalleryImage.objects.create(
            title="تصویر آزمایشی", image=create_test_image(), order=2, is_active=False
        )

    def test_anonymous_sees_only_active_images(self):
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual([row["id"] for row in res.data], [self.visible.id])

    def test_response_is_unpaginated(self):
        """The section is a masonry column, not a browsing list — a `results`
        wrapper would give it nowhere to put page two."""
        res = self.client.get(self.url)
        self.assertIsInstance(res.data, list)

    def test_ordered_by_order_then_newest(self):
        GalleryImage.objects.create(
            title="دوم", image=create_test_image(), order=0, is_active=True
        )
        res = self.client.get(self.url)
        self.assertEqual(res.data[0]["title"], "دوم")

    def test_image_url_is_servable(self):
        res = self.client.get(self.url)
        self.assertTrue(res.data[0]["image_url"].endswith(".jpg"))


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class GalleryAdminTests(APITestCase):
    def setUp(self):
        self.list_url = reverse("admin-gallery")
        self.staff = User.objects.create_user(
            username="09120000000", password="x", is_staff=True
        )
        self.customer = User.objects.create_user(
            username="09120000001", password="x", is_staff=False
        )

    def test_anonymous_cannot_list(self):
        res = self.client.get(self.list_url)
        self.assertIn(
            res.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_non_staff_cannot_list(self):
        self.client.force_authenticate(user=self.customer)
        res = self.client.get(self.list_url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_can_create_with_multipart_upload(self):
        self.client.force_authenticate(user=self.staff)
        res = self.client.post(
            self.list_url,
            {
                "title": "گالری تازه",
                "image": create_test_image(),
                "order": 3,
                "is_active": "true",
            },
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(GalleryImage.objects.count(), 1)
        self.assertEqual(res.data["title"], "گالری تازه")

    def test_create_without_image_is_refused(self):
        self.client.force_authenticate(user=self.staff)
        res = self.client.post(
            self.list_url, {"title": "بدون تصویر"}, format="multipart"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("image", res.data)

    def test_admin_list_includes_inactive_rows(self):
        """The panel has to see a hidden image in order to unhide it."""
        GalleryImage.objects.create(
            title="پنهان", image=create_test_image(), is_active=False
        )
        self.client.force_authenticate(user=self.staff)
        res = self.client.get(self.list_url)
        self.assertEqual(len(res.data), 1)

    def test_toggle_active_leaves_the_image_alone(self):
        """A PATCH that only flips is_active must not blank the stored file —
        this is why the panel omits `image` unless a new one was picked."""
        row = GalleryImage.objects.create(title="تصویر", image=create_test_image())
        self.client.force_authenticate(user=self.staff)
        res = self.client.patch(
            reverse("admin-gallery-detail", args=[row.id]),
            {"is_active": "false"},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        row.refresh_from_db()
        self.assertFalse(row.is_active)
        self.assertTrue(row.image)

    def test_delete_removes_the_row(self):
        row = GalleryImage.objects.create(title="تصویر", image=create_test_image())
        self.client.force_authenticate(user=self.staff)
        res = self.client.delete(reverse("admin-gallery-detail", args=[row.id]))
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(GalleryImage.objects.count(), 0)
