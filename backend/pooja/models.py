"""Core pooja domain models."""

from django.conf import settings
from django.db import models


class PoojaOption(models.Model):
    code = models.CharField(max_length=16, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    min_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    max_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    default_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        related_name="children",
        null=True,
        blank=True,
    )
    is_group_header = models.BooleanField(default=False)

    class Meta:
        ordering = ("parent_id", "code")

    def __str__(self):
        return f"{self.code} - {self.name}"


class DayOptionCategory(models.TextChoices):
    WEEKDAY = "weekday", "Weekday"
    CODE = "code", "Template Code"
    TAMIL_STAR = "tamil_star", "Tamil Star"


class PoojaDayOption(models.Model):
    code = models.CharField(max_length=16, unique=True)
    description = models.CharField(max_length=255)
    category = models.CharField(max_length=32, choices=DayOptionCategory.choices, default=DayOptionCategory.CODE)
    display_order = models.PositiveIntegerField(default=0, db_index=True)

    class Meta:
        ordering = ("display_order", "id")

    def __str__(self):
        return f"{self.code} - {self.description}"


class DailyMessage(models.Model):
    label = models.CharField(max_length=64, unique=True)
    header_text = models.TextField()
    footer_text = models.TextField(blank=True)

    class Meta:
        ordering = ("label",)

    def __str__(self):
        return self.label


class DonorMessageTemplate(models.Model):
    donor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="daily_texts")
    preferred_date = models.DateField(null=True, blank=True)
    day_option = models.ForeignKey(PoojaDayOption, on_delete=models.SET_NULL, null=True, blank=True)
    summary_text = models.TextField()
    tamil_text = models.TextField(blank=True)
    gothra_details = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ("donor", "preferred_date")

    def __str__(self):
        return f"Daily text for {self.donor}"


class PoojaStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    CONFIRMED = "confirmed", "Pooja Confirmed"
    COMPLETED = "completed", "Pooja Completed"


class PoojaRegistration(models.Model):
    donor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pooja_registrations")
    pooja_option = models.ForeignKey(PoojaOption, on_delete=models.CASCADE, related_name="registrations")
    day_option = models.ForeignKey(PoojaDayOption, null=True, blank=True, on_delete=models.SET_NULL)
    start_date = models.DateField(null=True, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    is_group_registration = models.BooleanField(default=False)
    post_prasadam = models.BooleanField(default=False)
    additional_notes = models.TextField(blank=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    status = models.CharField(
        max_length=16,
        choices=PoojaStatus.choices,
        default=PoojaStatus.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"Registration #{self.pk} for {self.donor}"


class PoojaRegistrationMember(models.Model):
    registration = models.ForeignKey(PoojaRegistration, on_delete=models.CASCADE, related_name="members")
    name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=15, blank=True)
    relationship = models.CharField(max_length=128, blank=True)

    class Meta:
        ordering = ("registration", "name")

    def __str__(self):
        return f"{self.name} ({self.registration_id})"


class FeaturedPooja(models.Model):
    """Lightweight content blocks for the landing page pooja section."""

    name = models.CharField(max_length=255)
    image = models.ImageField(upload_to="featured-poojas/")
    amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at", "id")

    def __str__(self):  # pragma: no cover - human readable repr
        return self.name
