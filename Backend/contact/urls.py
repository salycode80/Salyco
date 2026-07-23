from django.urls import path

from . import views

urlpatterns = [
    path("contact/", views.SuggestionCreateView.as_view(), name="contact-create"),
    path("admin/suggestions/", views.AdminSuggestionListView.as_view(), name="admin-suggestions"),
    path("admin/suggestions/<int:pk>/", views.AdminSuggestionDetailView.as_view(), name="admin-suggestion-detail"),
]
