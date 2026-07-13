from rest_framework import generics
from rest_framework.permissions import AllowAny

from .models import Suggestion
from .serializers import SuggestionSerializer


class SuggestionCreateView(generics.CreateAPIView):
    """Public endpoint: anyone can submit a suggestion / contact message."""

    queryset = Suggestion.objects.all()
    serializer_class = SuggestionSerializer
    permission_classes = [AllowAny]
