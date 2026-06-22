from django.db import models

# Create your models here.0
class Mattress(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField()
    slug = models.SlugField(unique=True)
    warranty_months = models.IntegerField(default=120) # 10 years default
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image = models.ImageField(upload_to='mattresses/', blank=True, null=True)
    width = models.IntegerField(default=0)
    length = models.IntegerField(default=0)