"""Core pooja domain models."""

from django.conf import settings
from django.db import models, transaction


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
    display_order = models.PositiveIntegerField(default=0, db_index=True)

    class Meta:
        ordering = ("parent_id", "display_order", "code")

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


class SpecialAnnouncement(models.Model):
    label = models.CharField(max_length=64)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at", "id")
        verbose_name = "Special Announcement"
        verbose_name_plural = "Special Announcements"

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
    registration_number = models.PositiveIntegerField(unique=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"Registration #{self.pk} for {self.donor}"

    @property
    def pooja_reg_id(self) -> str | None:
        if self.registration_number is None:
            return None
        return f"PR{self.registration_number}"

    def save(self, *args, **kwargs):
        if self.registration_number is None:
            with transaction.atomic():
                if self.registration_number is None:
                    last_number = (
                        self.__class__.objects.select_for_update()
                        .order_by("-registration_number")
                        .values_list("registration_number", flat=True)
                        .first()
                    )
                    self.registration_number = (last_number or 0) + 1
        super().save(*args, **kwargs)


class PoojaRegistrationMember(models.Model):
    registration = models.ForeignKey(PoojaRegistration, on_delete=models.CASCADE, related_name="members")
    name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=15, blank=True)
    relationship = models.CharField(max_length=128, blank=True)
    date_of_birth = models.DateField(blank=True, null=True)
    family_name = models.CharField(max_length=255, blank=True, default="")
    tamil_star = models.CharField(max_length=128, blank=True)
    gothra = models.CharField(max_length=128, blank=True)
    rasi = models.CharField(max_length=128, blank=True, default="")

    class Meta:
        ordering = ("registration", "name")

    def __str__(self):
        return f"{self.name} ({self.registration_id})"


class RecurrenceKind(models.TextChoices):
    RECURRING = "recurring", "Recurring"
    ONE_TIME_EXTRA = "one_time_extra", "One-time extra"


class RecurrenceFrequency(models.TextChoices):
    MONTHLY = "monthly", "Monthly"
    QUARTERLY = "quarterly", "Quarterly"
    ANNUALLY = "annually", "Annually"


class RecurringPoojaPlan(models.Model):
    donor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="recurrence_plans",
    )
    pooja_option = models.ForeignKey(
        PoojaOption,
        on_delete=models.CASCADE,
        related_name="recurrence_plans",
    )
    day_option = models.ForeignKey(
        PoojaDayOption,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    recurrence_kind = models.CharField(
        max_length=32,
        choices=RecurrenceKind.choices,
        default=RecurrenceKind.RECURRING,
    )
    recurrence_frequency = models.CharField(
        max_length=32,
        choices=RecurrenceFrequency.choices,
        default=RecurrenceFrequency.MONTHLY,
    )
    start_date = models.DateField(null=True, blank=True)
    next_occurrence = models.DateField(null=True, blank=True)
    last_occurrence = models.DateField(null=True, blank=True)
    one_time_date = models.DateField(null=True, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    pause_from = models.DateField(null=True, blank=True)
    pause_until = models.DateField(null=True, blank=True)
    origin_registration = models.ForeignKey(
        PoojaRegistration,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="originating_recurring_plans",
    )
    due_registration = models.ForeignKey(
        PoojaRegistration,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="due_recurring_plans",
        help_text="Auto-created registration for the next scheduled occurrence of this plan",
    )
    metadata = models.JSONField(default=dict, blank=True)
    cart_payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at", "id")
        constraints = [
            models.UniqueConstraint(
                fields=["donor", "pooja_option", "day_option", "recurrence_kind"],
                condition=models.Q(recurrence_kind=RecurrenceKind.RECURRING, one_time_date__isnull=True),
                name="pooja_recurring_unique_null_one_time_date",
            ),
            models.UniqueConstraint(
                fields=["donor", "pooja_option", "day_option", "recurrence_kind", "one_time_date"],
                condition=models.Q(recurrence_kind=RecurrenceKind.RECURRING, one_time_date__isnull=False),
                name="pooja_recurring_unique_with_one_time_date",
            ),
            models.UniqueConstraint(
                fields=["donor", "pooja_option", "day_option", "recurrence_kind", "one_time_date"],
                condition=models.Q(recurrence_kind=RecurrenceKind.ONE_TIME_EXTRA),
                name="pooja_one_time_unique",
            ),
        ]

    def __str__(self):
        kind_label = self.get_recurrence_kind_display()
        pooja_label = self.pooja_option.name if self.pooja_option else "Pooja"
        next_label = self.next_occurrence.isoformat() if self.next_occurrence else "pending"
        return f"{self.donor} – {pooja_label} ({kind_label}) → {next_label}"


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


class PoojaCartSnapshot(models.Model):
    donor = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="pooja_cart_snapshot",
    )
    items = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at",)

    def __str__(self):
        return f"Cart snapshot for {self.donor} ({len(self.items)} items)"


class PoojaCartSnapshotExportBatch(models.Model):
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="cart_snapshot_exports",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        creator = self.created_by or "Unknown admin"
        return f"Cart snapshot export {self.created_at.isoformat()} by {creator}"


class PoojaCartSnapshotExportEntry(models.Model):
    batch = models.ForeignKey(
        PoojaCartSnapshotExportBatch,
        on_delete=models.CASCADE,
        related_name="entries",
    )
    donor_id = models.PositiveIntegerField(null=True)
    donor_name = models.CharField(max_length=255, blank=True)
    donor_phone = models.CharField(max_length=32, blank=True)
    items = models.JSONField(default=list, blank=True)
    source_updated_at = models.DateTimeField(null=True)

    class Meta:
        ordering = ("donor_id", "id")

    def __str__(self):
        label = self.donor_name or f"Donor {self.donor_id or 'unknown'}"
        return f"{label} snapshot for batch {self.batch_id}"
