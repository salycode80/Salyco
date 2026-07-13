from django.urls import path

from . import views

urlpatterns = [
    path("contact/", views.SuggestionCreateView.as_view(), name="contact-create"),
]
