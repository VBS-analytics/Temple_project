"""Payment tracking models."""

from datetime import date

from django.conf import settings
from django.db import models
from django.utils import timezone

from pooja.models import PoojaRegistration


def _first_day_of_month(value: date) -> date:
    return value.replace(day=1)


def _default_effective_from() -> date:
    today = timezone.localdate()
    return today.replace(day=1)


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


class Donation(models.Model):
    donor_name = models.CharField(max_length=255)
    donor_phone_no = models.CharField(max_length=20)
    transaction_id = models.CharField(max_length=255)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2)
    donation_date = models.DateField()
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "donation"
        ordering = ("-donation_date", "-id")

    def __str__(self):
        return f"Donation {self.pk} - {self.donor_name}"


class PassbookEntry(models.Model):
    """
    Stores pre-calculated passbook entries for each donor.
    These are the final calculated values shown in the payment statement passbook.
    """
    ENTRY_TYPE_CHOICES = [
        ("balance", "Opening Balance"),
        ("due", "Pooja Due"),
        ("paid", "Payment Received"),
    ]

    donor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="passbook_entries",
    )
    entry_date = models.DateField(help_text="Date of the transaction/entry (e.g., 31/12/2025 for opening balance)")
    entry_type = models.CharField(max_length=10, choices=ENTRY_TYPE_CHOICES)
    
    # Transaction details
    transaction_details = models.CharField(max_length=255, blank=True, help_text="e.g., transaction ID or 'Pooja DUE'")
    payment_record = models.ForeignKey(
        PaymentRecord,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="passbook_entries",
    )
    registration = models.ForeignKey(
        PoojaRegistration,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="passbook_entries",
    )
    
    # Calculated amounts
    opening_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    due_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Due for current month")
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Amount received")
    closing_due = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Closing due for current month")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("donor", "entry_date")
        indexes = [
            models.Index(fields=["donor", "entry_date"]),
            models.Index(fields=["donor", "-entry_date"]),
        ]

    def __str__(self):
        return f"Passbook {self.donor} - {self.entry_date} ({self.entry_type})"


class CombinePaymentMapping(models.Model):
    main_donor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="combine_payment_mappings",
    )
    parent_donor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="combine_payment_children",
    )
    main_donor_phone = models.CharField(max_length=15, blank=True)
    main_donor_name = models.CharField(max_length=255, blank=True)
    parent_donor_phone = models.CharField(max_length=15, blank=True)
    parent_donor_name = models.CharField(max_length=255, blank=True)
    effective_from = models.DateField(
        default=_default_effective_from,
        help_text="First month (inclusive) when this combine mapping is active.",
    )
    effective_to = models.DateField(
        null=True,
        blank=True,
        help_text="First month when this combine mapping is no longer active (exclusive).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("main_donor", "parent_donor"), name="unique_main_parent_mapping"),
        ]
        ordering = ("-updated_at", "-created_at")

    def __str__(self):
        return f"{self.main_donor} ← {self.parent_donor}"

    def save(self, *args, **kwargs):
        if self.main_donor:
            self.main_donor_phone = self.main_donor.phone_number
            self.main_donor_name = self.main_donor.name
        if self.parent_donor:
            self.parent_donor_phone = self.parent_donor.phone_number
            self.parent_donor_name = self.parent_donor.name
        if self.effective_from:
            self.effective_from = _first_day_of_month(self.effective_from)
        else:
            self.effective_from = _default_effective_from()
        if self.effective_to:
            self.effective_to = _first_day_of_month(self.effective_to)
        super().save(*args, **kwargs)

    def is_active_on(self, reference_date: date | None = None) -> bool:
        reference = reference_date or timezone.localdate()
        month_start = reference.replace(day=1)
        if self.effective_from and self.effective_from > month_start:
            return False
        if self.effective_to and self.effective_to <= month_start:
            return False
        return True


class ExpenseCategoryGroup(models.TextChoices):
    POOJARI = "poojari", "We pay to poojari for"
    COORDINATOR = "coordinator", "We pay to co ordinator"
    BANK = "bank", "We remit to bank"
    OTHER = "other", "Other"


class ExpenseCategory(models.Model):
    name = models.CharField(max_length=128, unique=True)
    group_key = models.CharField(
        max_length=24,
        choices=ExpenseCategoryGroup.choices,
        default=ExpenseCategoryGroup.OTHER,
    )
    display_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("group_key", "display_order", "name", "id")

    def __str__(self):
        return self.name


class IncomeCategory(models.Model):
    name = models.CharField(max_length=128, unique=True)
    display_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("display_order", "name", "id")

    def __str__(self):
        return self.name


class AdditionIncomeRecord(models.Model):
    transaction_date = models.DateField()
    category = models.CharField(max_length=128)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_no = models.CharField(max_length=128, blank=True)
    comments = models.TextField(blank=True)
    remarks = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="addition_income_records",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-transaction_date", "-created_at")

    def __str__(self):
        return f"Addition Income {self.pk} - {self.category or 'anonymous'}"


class ExpenseRecord(models.Model):
    transaction_date = models.DateField()
    category = models.CharField(max_length=128)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_no = models.CharField(max_length=128, blank=True)
    comments = models.TextField(blank=True)
    remarks = models.TextField(blank=True)
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
