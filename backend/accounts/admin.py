"""Admin registrations for accounts app."""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import DonorProfile, FamilyMember, OtpToken, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("phone_number", "name", "role", "is_staff", "is_active")
    list_filter = ("role", "is_staff", "is_active")
    ordering = ("phone_number",)
    fieldsets = (
        (None, {"fields": ("phone_number", "password")} ),
        ("Personal info", {"fields": ("name", "email")}),
        (
            "Permissions",
            {
                "fields": (
                    "role",
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Important dates", {"fields": ("last_login",)}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("phone_number", "name", "password1", "password2", "role"),
            },
        ),
    )
    search_fields = ("phone_number", "name")


@admin.register(DonorProfile)
class DonorProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "city", "tamil_star", "rasi", "gothra")
    search_fields = ("user__phone_number", "user__name", "tamil_star", "rasi", "gothra")


@admin.register(OtpToken)
class OtpTokenAdmin(admin.ModelAdmin):
    list_display = ("phone_number", "purpose", "code", "is_used", "expires_at")
    list_filter = ("purpose", "is_used")
    search_fields = ("phone_number", "code")


@admin.register(FamilyMember)
class FamilyMemberAdmin(admin.ModelAdmin):
    list_display = ("user", "name", "relationship", "gender", "rasi")
    search_fields = ("name", "relationship", "user__phone_number", "user__name", "rasi")
