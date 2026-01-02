"""Admin registrations for pooja master data."""

from django.contrib import admin

from .models import (
    DailyMessage,
    DonorMessageTemplate,
    FeaturedPooja,
    PoojaDayOption,
    PoojaOption,
    PoojaRegistration,
    PoojaRegistrationMember,
    SpecialAnnouncement,
)


@admin.register(PoojaOption)
class PoojaOptionAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "parent", "is_group_header", "is_active")
    list_filter = ("is_group_header", "is_active")
    search_fields = ("code", "name")


@admin.register(PoojaDayOption)
class PoojaDayOptionAdmin(admin.ModelAdmin):
    list_display = ("code", "description", "category")
    list_filter = ("category",)
    search_fields = ("code", "description")


@admin.register(DailyMessage)
class DailyMessageAdmin(admin.ModelAdmin):
    list_display = ("label",)
    search_fields = ("label",)


@admin.register(SpecialAnnouncement)
class SpecialAnnouncementAdmin(admin.ModelAdmin):
    list_display = ("label",)
    search_fields = ("label",)


class PoojaRegistrationMemberInline(admin.TabularInline):
    model = PoojaRegistrationMember
    extra = 0


@admin.register(PoojaRegistration)
class PoojaRegistrationAdmin(admin.ModelAdmin):
    list_display = ("id", "donor", "pooja_option", "day_option", "is_group_registration", "created_at")
    list_filter = ("is_group_registration", "pooja_option")
    search_fields = ("donor__phone_number", "donor__name")
    inlines = [PoojaRegistrationMemberInline]


@admin.register(DonorMessageTemplate)
class DonorMessageTemplateAdmin(admin.ModelAdmin):
    list_display = ("donor", "preferred_date", "day_option")
    search_fields = ("donor__name", "donor__phone_number")


@admin.register(FeaturedPooja)
class FeaturedPoojaAdmin(admin.ModelAdmin):
    list_display = ("name", "amount", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name",)
