from django.shortcuts import render
from rest_framework import generics
from .serializers import Mattressserializer
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import Mattress

# Create your views here.
class MattressCreate(generics.ListCreateAPIView):
    serializer_class = Mattressserializer
    queryset = Mattress.objects.all()
    permission_classes = [AllowAny]
