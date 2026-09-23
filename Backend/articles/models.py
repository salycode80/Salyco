from django.db import models
from django.utils.text import slugify

# Re-exported so Django's app registry sees them. Snippets live in their own
# module to keep this file readable, but a model in a module that models.py never
# imports is not part of the app at all: makemigrations reports "No changes
# detected" and the tables are never created. The dependency runs one way only —
# snippets.py imports nothing from here.
from .snippets import ArticleAuthor, ArticleCategory, GlobalSeoSettings  # noqa: F401


class Article(models.Model):
    title = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, blank=True)
    excerpt = models.TextField(max_length=500, blank=True)
    content = models.TextField()
    image = models.ImageField(upload_to="articles/", blank=True, null=True)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title, allow_unicode=True)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title
