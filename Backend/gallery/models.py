from django.db import models


class GalleryImage(models.Model):
    """An image in the public "گالری سالیکو" section of the About page.

    The section used to be a hard-coded list of paths in the frontend, which
    meant adding a photo was a code change and a deploy. Rows here are the
    whole of that list now: the section renders whatever is active, in order,
    and disappears when nothing is.
    """

    title = models.CharField(
        max_length=200,
        verbose_name="عنوان",
        help_text="برای متن جایگزین تصویر (alt) و فهرست پنل مدیریت استفاده می‌شود.",
    )
    image = models.ImageField(upload_to="gallery/", verbose_name="تصویر")
    order = models.PositiveIntegerField(default=0, verbose_name="ترتیب نمایش")
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "-created_at"]
        verbose_name = "تصویر گالری"
        verbose_name_plural = "گالری تصاویر"

    def __str__(self):
        return self.title
