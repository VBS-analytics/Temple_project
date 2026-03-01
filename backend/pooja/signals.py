"""Signals to keep denormalized pooja report tables in sync."""

import re

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from accounts.models import DonorProfile, User

from .models import PoojaRegistration, UbhayamReport

ANY_DAY_OPTION_LABEL = "Any day of the month"
ANY_DAY_OPTION_CODES = {"AD", "ANYDAY"}
ANY_DAY_OPTION_DESCRIPTIONS = {"any day of month", "any day of the month"}
UBHAYAM_EXCLUDED_PARENT_CODES = {"SPECIAL"}
UBHAYAM_EXCLUDED_POOJA_CODES = {"GP1", "GP2", "GP3", "GP4", "GP6"}
UBHAYAM_EXCLUDED_POOJA_NAMES = {
    "till oil for lamps",
    "nitya neivedhyam",
    "gau samrakshana seva",
    "gau samrakhshana seva",
    "4 saturday navagraha pooja per month",
    "saturday navagraha pooja",
    "2 pradosha pooja per month",
    "pradosha pooja",
    "sivan koil kumbabishekam",
    "aarudhra darsanam pooja",
    "gen donation",
    "gen donation pooja",
    "mahashivrathri",
    "mahashivratri",
    "navarathri for 1 day pooja",
    "navaratri for 1 day pooja",
}


def _normalize_description(value: str | None) -> str:
    return re.sub(
        r"\s+",
        " ",
        re.sub(r"[^a-z0-9 ]", " ", (value or "").strip().lower()),
    ).strip()


UBHAYAM_EXCLUDED_POOJA_NORMALIZED_NAMES = {
    _normalize_description(name) for name in UBHAYAM_EXCLUDED_POOJA_NAMES
}


def _is_any_day_option(code: str | None, description: str | None) -> bool:
    normalized_code = (code or "").strip().upper()
    if normalized_code in ANY_DAY_OPTION_CODES:
        return True
    return _normalize_description(description) in ANY_DAY_OPTION_DESCRIPTIONS


def _resolve_donor_identifier(donor: User) -> str:
    if donor is None:
        return ""

    profile = getattr(donor, "profile", None)
    if profile is None:
        profile = DonorProfile.objects.filter(user_id=donor.id).only("donor_number").first()

    donor_number = getattr(profile, "donor_number", None)
    if donor_number:
        return f"D{donor_number}"
    return str(donor.id)


def _resolve_day_option_label(option) -> str:
    if option is None:
        return ANY_DAY_OPTION_LABEL
    if _is_any_day_option(getattr(option, "code", None), getattr(option, "description", None)):
        return ANY_DAY_OPTION_LABEL
    label = (option.description or option.code or "").strip()
    return label or ANY_DAY_OPTION_LABEL


def _is_ubhayam_excluded_pooja(option) -> bool:
    if option is None:
        return False

    normalized_parent_code = (getattr(getattr(option, "parent", None), "code", None) or "").strip().upper()
    if normalized_parent_code in UBHAYAM_EXCLUDED_PARENT_CODES:
        return True

    normalized_code = (getattr(option, "code", None) or "").strip().upper()
    if normalized_code in UBHAYAM_EXCLUDED_POOJA_CODES:
        return True

    normalized_name = _normalize_description(getattr(option, "name", None))
    return normalized_name in UBHAYAM_EXCLUDED_POOJA_NORMALIZED_NAMES


def _resolve_donor(instance: PoojaRegistration) -> User | None:
    donor = getattr(instance, "donor", None)
    if donor is not None:
        return donor
    if not instance.donor_id:
        return None
    return User.objects.filter(id=instance.donor_id).only("id", "name", "phone_number").first()


def _collect_unique_day_options_for_donor(donor_id: int) -> list[str]:
    labels: set[str] = set()
    registrations = (
        PoojaRegistration.objects.filter(donor_id=donor_id)
        .select_related("day_option", "pooja_option", "pooja_option__parent")
    )
    for registration in registrations:
        if _is_ubhayam_excluded_pooja(getattr(registration, "pooja_option", None)):
            continue
        labels.add(_resolve_day_option_label(getattr(registration, "day_option", None)))
    return sorted(labels, key=str.casefold)


def _sync_donor_ubhayam_rows(donor: User | None):
    if donor is None:
        return
    donor_identifier = _resolve_donor_identifier(donor)
    donor_name = (donor.name or "").strip()
    donor_phone = (donor.phone_number or "").strip()
    unique_day_options = _collect_unique_day_options_for_donor(donor.id)

    # Clear stale rows created before donor number was assigned.
    legacy_donor_identifier = str(donor.id)
    if donor_identifier != legacy_donor_identifier:
        UbhayamReport.objects.filter(donor_id=legacy_donor_identifier).delete()

    existing_rows = UbhayamReport.objects.filter(donor_id=donor_identifier)
    if not unique_day_options:
        existing_rows.delete()
        return

    existing_rows.exclude(pooja_day_option__in=unique_day_options).delete()
    for day_option_label in unique_day_options:
        UbhayamReport.objects.update_or_create(
            donor_id=donor_identifier,
            pooja_day_option=day_option_label,
            defaults={
                "donor_name": donor_name,
                "donor_phone_number": donor_phone,
            },
        )


@receiver(post_save, sender=PoojaRegistration)
def sync_ubhayam_report_entry(sender, instance: PoojaRegistration, **kwargs):
    _sync_donor_ubhayam_rows(_resolve_donor(instance))


@receiver(post_delete, sender=PoojaRegistration)
def delete_ubhayam_report_entry(sender, instance: PoojaRegistration, **kwargs):
    _sync_donor_ubhayam_rows(_resolve_donor(instance))


def ready():
    """Imported by AppConfig.ready()."""
    return None
