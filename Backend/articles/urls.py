from django.urls import path

from . import views

urlpatterns = [
    path("articles/", views.ArticleListCreate.as_view(), name="article-list"),
    path("articles/<slug:slug>/", views.ArticleDetail.as_view(), name="article-detail"),
]
