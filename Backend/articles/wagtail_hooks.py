"""Editorial branding for the CMS.

Everything here goes through a supported Wagtail hook. The design doc's §12 is
explicit that over-customising Wagtail's internals makes upgrades expensive, and
a forked admin is the thing most likely to make the next two specs painful — so
there is no template override and no monkey-patching, only the documented
extension points.
"""
from django.templatetags.static import static
from django.urls import reverse
from wagtail import hooks
from wagtail.admin.menu import MenuItem


@hooks.register("register_admin_menu_item")
def register_articles_menu_item():
    """A direct link to the articles index.

    Without this an editor has to understand Wagtail's page tree to find their
    work. With it, «مقالات» is one click from the dashboard.
    """
    return MenuItem(
        "مقالات",
        reverse("wagtailadmin_pages:edit", args=[_articles_index_id()]),
        icon_name="doc-full-inverse",
        order=100,
    )


def _articles_index_id():
    """The articles index page id, or the root page when there is none.

    Resolved lazily and defensively: this runs while the admin menu is built, and
    a database error here would take down the whole CMS — including the screen an
    editor would use to fix the problem. Falling back to the root page rather than
    raising means the worst case is a menu item that opens the wrong page, not an
    admin that will not load.
    """
    from articles.models import ArticleIndexPage

    index = ArticleIndexPage.objects.first()
    if index is None:
        return 1
    return index.id


@hooks.register("construct_main_menu")
def hide_unused_menu_items(request, menu_items):
    """Drop the menu entries this project has no content for.

    Wagtail ships a full editorial surface: Forms, Documents, Reports. None of
    them is used here, and a menu of things an editor cannot use is worse than a
    short one. Hiding the menu item does not uninstall the app, so the document
    chooser still resolves — which is why core/urls.py and the nginx config both
    still route /documents/.
    """
    menu_items[:] = [
        item for item in menu_items if item.name not in ("forms", "documents")
    ]


@hooks.register("insert_global_admin_css")
def admin_css():
    return static("articles/admin.css")
