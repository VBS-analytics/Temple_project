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
    RecurringPoojaPlan,
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


@admin.register(RecurringPoojaPlan)
class RecurringPoojaPlanAdmin(admin.ModelAdmin):
    list_display = ("id", "donor", "pooja_option", "day_option", "recurrence_kind", "recurrence_frequency", "next_occurrence", "is_active", "created_at")
    list_filter = ("is_active", "recurrence_kind", "recurrence_frequency")
    search_fields = ("donor__phone_number", "donor__name", "pooja_option__name")
    readonly_fields = ("id", "created_at", "updated_at", "cart_payload", "metadata", "upcoming_dates_display")
    fields = (
        "id",
        "donor",
        "pooja_option",
        "day_option",
        "recurrence_kind",
        "recurrence_frequency",
        "start_date",
        "next_occurrence",
        "last_occurrence",
        "one_time_date",
        "amount",
        "is_active",
        "pause_from",
        "pause_until",
        "origin_registration",
        "metadata",
        "cart_payload",
        "upcoming_dates_display",
        "created_at",
        "updated_at",
    )

    def upcoming_dates_display(self, obj):
        """Display all upcoming occurrence dates from cart_payload."""
        if not obj.cart_payload:
            return "No dates configured"
        
        occurrences = obj.cart_payload.get("dayOptionOccurrences", [])
        if not occurrences:
            # Fall back to next_occurrence if no occurrences in cart_payload
            if obj.next_occurrence:
                return str(obj.next_occurrence)
            return "No upcoming dates"
        
        # Format all occurrences
        dates_list = []
        for occ in occurrences:
            date_str = occ.get("date")
            label = occ.get("label", "")
            if date_str:
                dates_list.append(f"{date_str}" + (f" ({label})" if label else ""))
        
        return "\n".join(dates_list) if dates_list else "No dates configured"
    
    upcoming_dates_display.short_description = "Upcoming Occurrence Dates"


