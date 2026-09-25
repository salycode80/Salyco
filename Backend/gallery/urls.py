from django.urls import path

from . import admin_views, views

urlpatterns = [
    path("gallery/", views.GalleryImageListView.as_view(), name="gallery-list"),
    path(
        "admin/gallery/",
        admin_views.AdminGalleryImageListView.as_view(),
        name="admin-gallery",
    ),
    path(
        "admin/gallery/<int:pk>/",
        admin_views.AdminGalleryImageDetailView.as_view(),
        name="admin-gallery-detail",
    ),
]
