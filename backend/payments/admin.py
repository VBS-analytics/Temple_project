"""Admin configuration for payments."""

from django.contrib import admin

from .models import ExpenseRecord, PaymentRecord


@admin.register(PaymentRecord)
class PaymentRecordAdmin(admin.ModelAdmin):
    list_display = ("id", "donor", "amount", "mode", "status", "created_at")
    list_filter = ("status", "mode")
    search_fields = ("donor__phone_number", "donor__name", "transaction_reference")


@admin.register(ExpenseRecord)
class ExpenseRecordAdmin(admin.ModelAdmin):
    list_display = ("id", "category", "amount", "transaction_date", "created_by", "created_at")
    list_filter = ("category", "transaction_date")
    search_fields = ("category", "created_by__name", "created_by__phone_number")
