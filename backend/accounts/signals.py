"""Signals for accounts app."""

from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import DonorProfile


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_profile(sender, instance, created, **kwargs):  # pragma: no cover - simple signal
    if created and not hasattr(instance, "profile"):
        DonorProfile.objects.create(user=instance)
