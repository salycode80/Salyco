from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAdminUser

from .models import Suggestion
from .serializers import AdminSuggestionSerializer, SuggestionSerializer


class SuggestionCreateView(generics.CreateAPIView):
    """Public endpoint: anyone can submit a suggestion / contact message."""

    queryset = Suggestion.objects.all()
    serializer_class = SuggestionSerializer
    permission_classes = [AllowAny]


class AdminSuggestionListView(generics.ListAPIView):
    """List all submitted suggestions for staff. Filter by `is_read`, search by
    name/email/phone/message."""

    permission_classes = [IsAdminUser]
    serializer_class = AdminSuggestionSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Suggestion.objects.all().order_by("-created_at")

        is_read = self.request.query_params.get("is_read")
        if is_read == "true":
            qs = qs.filter(is_read=True)
        elif is_read == "false":
            qs = qs.filter(is_read=False)

        search = (self.request.query_params.get("search") or "").strip()
        if search:
            from django.db.models import Q

            qs = qs.filter(
                Q(name__icontains=search)
                | Q(email__icontains=search)
                | Q(phone__icontains=search)
                | Q(message__icontains=search)
            )
        return qs


class AdminSuggestionDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve/update/delete one suggestion. PATCH to toggle `is_read`,
    DELETE to remove it."""

    permission_classes = [IsAdminUser]
    serializer_class = AdminSuggestionSerializer
    queryset = Suggestion.objects.all()
