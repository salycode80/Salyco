from django.urls import path
from . import views

urlpatterns = [
    path("mattress/", views.MattressCreate.as_view(), name="mattress-create"),
]