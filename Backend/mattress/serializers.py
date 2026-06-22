from rest_framework import serializers
from .models import Mattress


class Mattressserializer(serializers.ModelSerializer):
        class Meta:
            model = Mattress
            fields = ["name","description","slug","warranty_months","price","width","length","image"]
            extra_kwargs = {}