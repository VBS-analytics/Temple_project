"""Models for authentication and donor data."""

from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models, transaction
from django.utils import timezone


class UserRole(models.TextChoices):
    DONOR = "donor", "Donor"
    ADMIN = "admin", "Admin"


class UserManager(BaseUserManager):
    """Custom manager using phone numbers as the primary login."""

    def _create_user(self, phone_number: str, name: str, password: str | None, **extra_fields):
        if not phone_number:
            raise ValueError("Users must have a phone number")
        phone_number = (phone_number or "").strip().replace(" ", "")
        user = self.model(phone_number=phone_number, name=name or "", **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_user(self, phone_number: str, name: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        extra_fields.setdefault("role", UserRole.DONOR)
        return self._create_user(phone_number, name, password, **extra_fields)

    def create_superuser(self, phone_number: str, name: str, password: str, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", UserRole.ADMIN)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(phone_number, name, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    phone_number = models.CharField(max_length=15, unique=True)
    name = models.CharField(max_length=255)
    email = models.EmailField(blank=True, null=True)
    role = models.CharField(max_length=20, choices=UserRole.choices, default=UserRole.DONOR)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "phone_number"
    REQUIRED_FIELDS = ["name"]

    class Meta:
        ordering = ("phone_number",)

    def __str__(self) -> str:
        return f"{self.phone_number} ({self.name})"


class OtpPurpose(models.TextChoices):
    REGISTRATION = "registration", "Registration"
    LOGIN = "login", "Login"
    RESET_PASSWORD = "reset_password", "Password Reset"


class OtpToken(models.Model):
    phone_number = models.CharField(max_length=15)
    code = models.CharField(max_length=6)
    purpose = models.CharField(max_length=32, choices=OtpPurpose.choices)
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        indexes = [
            models.Index(fields=("phone_number", "purpose")),
            models.Index(fields=("expires_at",)),
        ]
        ordering = ("-created_at",)

    def mark_used(self):
        self.is_used = True
        self.save(update_fields=["is_used"])

    @classmethod
    def create_code(cls, phone_number: str, purpose: str, ttl_minutes: int = 10) -> "OtpToken":
        code = cls.generate_code()
        token = cls.objects.create(
            phone_number=phone_number,
            code=code,
            purpose=purpose,
            expires_at=timezone.now() + timedelta(minutes=ttl_minutes),
        )
        return token

    @staticmethod
    def generate_code() -> str:
        from secrets import randbelow

        return f"{randbelow(1000000):06d}"

    def is_valid(self, value: str) -> bool:
        return not self.is_used and self.code == value and self.expires_at >= timezone.now()


class DonorProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    address_line1 = models.CharField(max_length=255, blank=True)
    address_line2 = models.CharField(max_length=255, blank=True)
    address_line3 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=128, blank=True)
    state = models.CharField(max_length=128, blank=True)
    postal_code = models.CharField(max_length=12, blank=True)
    gothra = models.CharField(max_length=128, blank=True)
    tamil_star = models.CharField(max_length=128, blank=True)
    rasi = models.CharField(max_length=128, blank=True)
    gender = models.CharField(max_length=32, blank=True, default="")
    date_of_birth = models.DateField(blank=True, null=True)
    family_name = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True)
    donor_number = models.PositiveIntegerField(unique=True, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("user__name",)

    def __str__(self) -> str:
        return f"Profile for {self.user}"

    @property
    def donor_id(self) -> str | None:
        if self.donor_number is None:
            return None
        return f"D{self.donor_number}"

    def save(self, *args, **kwargs):
        if self.donor_number is None:
            with transaction.atomic():
                if self.donor_number is None:
                    last_number = (
                        self.__class__.objects.select_for_update()
                        .order_by("-donor_number")
                        .values_list("donor_number", flat=True)
                        .first()
                    )
                    self.donor_number = (last_number or 0) + 1
        super().save(*args, **kwargs)


class FamilyMember(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="family_members",
    )
    name = models.CharField(max_length=255)
    gender = models.CharField(max_length=32, blank=True)
    relationship = models.CharField(max_length=64, blank=True)
    date_of_birth = models.DateField(blank=True, null=True)
    tamil_star = models.CharField(max_length=128, blank=True)
    gothra = models.CharField(max_length=128, blank=True)
    rasi = models.CharField(max_length=128, blank=True)
    family_name = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name", "id")

    def __str__(self) -> str:
        return f"{self.name} ({self.relationship or 'member'})"
