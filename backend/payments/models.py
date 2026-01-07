"""Payment tracking models."""

from django.conf import settings
from django.db import models

from pooja.models import PoojaRegistration


class PaymentMode(models.TextChoices):
    NEFT = "neft", "NEFT"
    UPI = "upi", "UPI"
    CASH = "cash", "Cash"
    CARD = "card", "Credit/Debit"
    AUTO_DEBIT = "auto_debit", "Auto Debit"
    OTHER = "other", "Other"


class PaymentStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    SUCCESS = "success", "Success"
    FAILED = "failed", "Failed"
    REFUNDED = "refunded", "Refunded"


class PaymentRecord(models.Model):
    donor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="payments")
    registration = models.ForeignKey(
        PoojaRegistration,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payments",
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=8, default="INR")
    mode = models.CharField(max_length=32, choices=PaymentMode.choices)
    status = models.CharField(max_length=32, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    transaction_reference = models.CharField(max_length=255, blank=True)
    payment_month = models.DateField(null=True, blank=True, help_text="Represents the month the payment covers")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"Payment {self.pk} - {self.donor}"


class ExpenseRecord(models.Model):
    transaction_date = models.DateField()
    category = models.CharField(max_length=128)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="expense_records",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-transaction_date", "-created_at")

    def __str__(self):
        return f"Expense {self.pk} - {self.category or 'anonymous'}"
