"""Admin configuration for payments."""

from django.contrib import admin

from .models import Donation, ExpenseCategory, ExpenseRecord, PaymentRecord, PassbookEntry


@admin.register(PaymentRecord)
class PaymentRecordAdmin(admin.ModelAdmin):
    list_display = ("id", "donor", "amount", "mode", "status", "created_at")
    list_filter = ("status", "mode")
    search_fields = ("donor__phone_number", "donor__name", "transaction_reference")


@admin.register(ExpenseRecord)
class ExpenseRecordAdmin(admin.ModelAdmin):
    list_display = ("id", "transaction_no", "category", "amount", "transaction_date", "created_by", "created_at")
    list_filter = ("category", "transaction_date")
    search_fields = ("transaction_no", "category", "comments", "remarks", "created_by__name", "created_by__phone_number")


@admin.register(ExpenseCategory)
class ExpenseCategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "group_key", "display_order", "is_active", "updated_at")
    list_filter = ("group_key", "is_active")
    search_fields = ("name",)


@admin.register(PassbookEntry)
class PassbookEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "donor", "entry_date", "entry_type", "closing_due", "created_at")
    list_filter = ("entry_type", "entry_date", "donor")
    search_fields = ("donor__name", "donor__phone_number", "transaction_details")
    readonly_fields = ("opening_balance", "due_amount", "paid_amount", "closing_due", "created_at", "updated_at")


@admin.register(Donation)
class DonationAdmin(admin.ModelAdmin):
    list_display = ("id", "donor_name", "donor_phone_no", "amount_paid", "donation_date", "transaction_id")
    list_filter = ("donation_date",)
    search_fields = ("donor_name", "donor_phone_no", "transaction_id")
