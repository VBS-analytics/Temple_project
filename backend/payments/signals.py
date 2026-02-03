"""
Django signals for payment and registration changes.
Auto-regenerates passbook entries when data changes.
"""

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from pooja.models import PoojaRegistration
from accounts.models import DonorProfile
from .models import PaymentRecord
from .services import regenerate_donor_passbook, passbook_guard_active


@receiver(post_save, sender=PaymentRecord)
def update_passbook_on_payment(sender, instance, created, **kwargs):
    """Regenerate passbook when a payment is recorded."""
    if instance.donor_id and not passbook_guard_active():
        regenerate_donor_passbook(instance.donor_id, ensure_dues=False)


@receiver(post_delete, sender=PaymentRecord)
def update_passbook_on_payment_delete(sender, instance, **kwargs):
    """Regenerate passbook when a payment is deleted."""
    if instance.donor_id and not passbook_guard_active():
        regenerate_donor_passbook(instance.donor_id, ensure_dues=False)


@receiver(post_save, sender=PoojaRegistration)
def update_passbook_on_registration(sender, instance, created, **kwargs):
    """Regenerate passbook when a pooja registration is made."""
    if instance.donor_id and not passbook_guard_active():
        regenerate_donor_passbook(instance.donor_id, ensure_dues=False)


@receiver(post_delete, sender=PoojaRegistration)
def update_passbook_on_registration_delete(sender, instance, **kwargs):
    """Regenerate passbook when a registration is deleted."""
    if instance.donor_id and not passbook_guard_active():
        regenerate_donor_passbook(instance.donor_id, ensure_dues=False)


@receiver(post_save, sender=DonorProfile)
def update_passbook_on_opening_balance_change(sender, instance, created, **kwargs):
    """Regenerate passbook when opening balance is updated."""
    if instance.user_id and not passbook_guard_active():
        regenerate_donor_passbook(instance.user_id, ensure_dues=False)


def ready():
    """This function is called when the app is ready."""
    pass
