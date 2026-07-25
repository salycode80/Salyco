from django.db import models


class Banner(models.Model):
    """Marketing banner carousel for homepage."""

    title = models.CharField(max_length=200, verbose_name="عنوان")
    image = models.ImageField(upload_to="banners/", verbose_name="تصویر")
    link = models.CharField(max_length=500, verbose_name="لینک", help_text="مسیر صفحه داخلی (مثال: /products/black-swan)")
    order = models.PositiveIntegerField(default=0, verbose_name="ترتیب نمایش")
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "-created_at"]
        verbose_name = "بنر"
        verbose_name_plural = "بنرها"

    def __str__(self):
        return self.title
