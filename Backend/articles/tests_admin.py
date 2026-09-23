"""Access to, and branding of, the editorial CMS.

The thing worth pinning here is not that Wagtail's admin works — that is
Wagtail's job. It is *who can open it* and *what this project added to it*,
because the first has a surprising answer and the second is invisible until
someone removes it.
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from wagtail.models import Page

from articles.models import ArticleIndexPage
from articles.testing_support import plain_staticfiles

User = get_user_model()


# The CMS is this project's second Django-rendered surface, and the branding hook
# is its first {% static %} consumer: insert_global_admin_css resolves
# articles/admin.css through whitenoise's manifest storage, which has no entry
# for it until collectstatic has run. Without this the admin raises "Missing
# staticfiles manifest entry" and every test here dies on a branding detail.
# See articles/testing_support.py.
@plain_staticfiles
class AdminAccessTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        root = Page.objects.get(depth=1)
        cls.index = ArticleIndexPage(title="مقالات", slug="articles")
        root.add_child(instance=cls.index)
        cls.staff = User.objects.create_user(
            username="editor", password="x", is_staff=True
        )
        # is_staff is NOT enough, and the way it fails is misleading: a staff user
        # without admin access is redirected to the login page rather than shown a
        # 403, so it reads as "my session is broken" and sends you looking in the
        # wrong place. Two gates have to be satisfied:
        #
        #   wagtail.admin.auth.require_admin_access needs `wagtailadmin.access_admin`
        #   (superusers pass implicitly), and the page explorer needs at least one
        #   page permission — without it IndexView redirects to the dashboard.
        #
        # Wagtail's own Editors group grants both and is created by Wagtail's
        # initial-data migration, so it is present in a fresh test database. Using
        # it rather than hand-granting permissions keeps this fixture honest about
        # how a real editor is set up.
        cls.staff.groups.add(Group.objects.get(name="Editors"))
        # Re-read so the permission caches built during creation are dropped;
        # has_perm() caches per instance and would answer from the stale set.
        cls.staff = User.objects.get(pk=cls.staff.pk)

    def dashboard(self):
        self.client.force_login(self.staff)
        return self.client.get("/cms/").content.decode()

    def test_an_anonymous_visitor_is_sent_to_the_cms_login(self):
        response = self.client.get("/cms/")
        self.assertIn("/cms/login/", response["Location"])

    def test_an_editor_reaches_the_dashboard(self):
        self.client.force_login(self.staff)
        response = self.client.get("/cms/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("مدیریت محتوای سالیکو", response.content.decode())

    def test_the_articles_pages_are_listed_in_the_explorer(self):
        self.client.force_login(self.staff)
        response = self.client.get("/cms/pages/")
        self.assertEqual(response.status_code, 200)

    def test_an_anonymous_visitor_cannot_reach_the_editor(self):
        response = self.client.get("/cms/pages/")
        self.assertNotEqual(response.status_code, 200)

    def test_the_menu_links_straight_to_the_articles_index(self):
        # The menu is serialized into the page as a React component tree, so the
        # label arrives as a JSON escape sequence ("مق…") rather than as
        # Persian text — asserting on the label would test the serialiser. The URL
        # and the icon are what actually distinguish this entry.
        html = self.dashboard()
        self.assertIn(f"/cms/pages/{self.index.id}/edit/", html)
        self.assertIn("doc-full-inverse", html)

    def test_the_branding_stylesheet_is_linked(self):
        self.assertIn("articles/admin.css", self.dashboard())

    def test_the_unused_menu_entries_are_hidden(self):
        # construct_main_menu drops Forms and Documents: this project has no
        # content for either, and a menu of things an editor cannot use is worse
        # than a short one. Without this the filter could be deleted in a
        # refactor and nothing would notice.
        self.assertNotIn("/cms/forms/", self.dashboard())

    def test_the_menu_falls_back_when_the_index_does_not_exist(self):
        # The hook resolves the index id on every admin page render, and an
        # exception there takes down the CMS — including the screen an editor
        # would use to create the missing page. Falling back to the root page
        # means the worst case is a menu item that opens the wrong page.
        from articles.wagtail_hooks import _articles_index_id

        self.index.delete()
        self.assertEqual(_articles_index_id(), 1)
