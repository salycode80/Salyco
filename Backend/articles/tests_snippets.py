from django.test import TestCase

from articles.snippets import ArticleAuthor, ArticleCategory, GlobalSeoSettings


class ArticleCategoryTests(TestCase):
    def test_slug_is_generated_from_the_persian_name(self):
        category = ArticleCategory.objects.create(name="راهنمای خرید")
        # allow_unicode keeps the slug readable in Persian rather than reducing
        # it to an empty string, which is what plain slugify() would do here.
        self.assertEqual(category.slug, "راهنمای-خرید")

    def test_an_explicit_slug_is_kept(self):
        category = ArticleCategory.objects.create(name="راهنمای خرید", slug="guide")
        self.assertEqual(category.slug, "guide")

    def test_str_is_the_name(self):
        self.assertEqual(str(ArticleCategory(name="خواب")), "خواب")


class ArticleAuthorTests(TestCase):
    def test_author_type_defaults_to_person(self):
        author = ArticleAuthor.objects.create(name="تحریریه سالیکو")
        self.assertEqual(author.author_type, "Person")

    def test_organization_is_available(self):
        # An Organization emitted in JSON-LD as a Person is a factual error in
        # structured data, so the distinction has to exist.
        author = ArticleAuthor.objects.create(
            name="تحریریه سالیکو", author_type="Organization"
        )
        self.assertEqual(author.author_type, "Organization")


class GlobalSeoSettingsTests(TestCase):
    def test_is_a_registered_setting(self):
        from wagtail.contrib.settings.registry import registry

        self.assertIn(GlobalSeoSettings, registry)
