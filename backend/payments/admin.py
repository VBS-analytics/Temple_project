"""Admin configuration for payments."""

from django.contrib import admin

from .models import PaymentRecord


@admin.register(PaymentRecord)
class PaymentRecordAdmin(admin.ModelAdmin):
    list_display = ("id", "donor", "amount", "mode", "status", "created_at")
    list_filter = ("status", "mode")
    search_fields = ("donor__phone_number", "donor__name", "transaction_reference")
