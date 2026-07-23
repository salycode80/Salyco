from django.contrib import admin

from .models import AllowedLocation, Cart, CartItem, Order, OrderItem


class CartItemInline(admin.TabularInline):
    model = CartItem
    extra = 0


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ("id", "customer", "updated_at")
    inlines = [CartItemInline]


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "customer", "method", "status", "total_amount", "created_at")
    list_filter = ("method", "status")
    inlines = [OrderItemInline]


@admin.register(AllowedLocation)
class AllowedLocationAdmin(admin.ModelAdmin):
    list_display = ("province", "city", "is_active")
    list_filter = ("is_active", "province")
