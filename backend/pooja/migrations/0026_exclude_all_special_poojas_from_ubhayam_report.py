import re

from django.db import migrations

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


def _normalize_text(value: str | None) -> str:
    return re.sub(
        r"\s+",
        " ",
        re.sub(r"[^a-z0-9 ]", " ", (value or "").strip().lower()),
    ).strip()


UBHAYAM_EXCLUDED_POOJA_NORMALIZED_NAMES = {
    _normalize_text(name) for name in UBHAYAM_EXCLUDED_POOJA_NAMES
}


def _is_any_day_option(code: str | None, description: str | None) -> bool:
    normalized_code = (code or "").strip().upper()
    if normalized_code in ANY_DAY_OPTION_CODES:
        return True
    return _normalize_text(description) in ANY_DAY_OPTION_DESCRIPTIONS


def _resolve_day_option_label(day_option) -> str:
    if day_option is None:
        return ANY_DAY_OPTION_LABEL
    code = getattr(day_option, "code", None)
    description = getattr(day_option, "description", None)
    if _is_any_day_option(code, description):
        return ANY_DAY_OPTION_LABEL
    label = (description or code or "").strip()
    return label or ANY_DAY_OPTION_LABEL


def _is_ubhayam_excluded_pooja(option) -> bool:
    if option is None:
        return False

    normalized_parent_code = (
        getattr(getattr(option, "parent", None), "code", None) or ""
    ).strip().upper()
    if normalized_parent_code in UBHAYAM_EXCLUDED_PARENT_CODES:
        return True

    normalized_code = (getattr(option, "code", None) or "").strip().upper()
    if normalized_code in UBHAYAM_EXCLUDED_POOJA_CODES:
        return True

    normalized_name = _normalize_text(getattr(option, "name", None))
    return normalized_name in UBHAYAM_EXCLUDED_POOJA_NORMALIZED_NAMES


def _resolve_donor_identifier(donor, donor_numbers: dict[int, int]) -> str:
    if donor is None:
        return ""
    donor_number = donor_numbers.get(donor.id)
    if donor_number:
        return f"D{donor_number}"
    return str(donor.id)


def rebuild_ubhayam_report_rows(apps, schema_editor):
    PoojaRegistration = apps.get_model("pooja", "PoojaRegistration")
    UbhayamReport = apps.get_model("pooja", "UbhayamReport")
    DonorProfile = apps.get_model("accounts", "DonorProfile")

    donor_numbers = {
        profile.user_id: profile.donor_number
        for profile in DonorProfile.objects.only("user_id", "donor_number")
        if profile.donor_number is not None
    }

    grouped_rows: dict[tuple[str, str], dict[str, str]] = {}
    registrations = (
        PoojaRegistration.objects.select_related("donor", "day_option", "pooja_option", "pooja_option__parent")
        .order_by("id")
    )
    for registration in registrations:
        donor = getattr(registration, "donor", None)
        if donor is None:
            continue
        if _is_ubhayam_excluded_pooja(getattr(registration, "pooja_option", None)):
            continue

        donor_identifier = _resolve_donor_identifier(donor, donor_numbers)
        day_option_label = _resolve_day_option_label(getattr(registration, "day_option", None))
        key = (donor_identifier, day_option_label)
        grouped_rows.setdefault(
            key,
            {
                "donor_id": donor_identifier,
                "donor_name": (donor.name or "").strip(),
                "donor_phone_number": (donor.phone_number or "").strip(),
                "pooja_day_option": day_option_label,
            },
        )

    UbhayamReport.objects.all().delete()
    if grouped_rows:
        UbhayamReport.objects.bulk_create(
            [UbhayamReport(**row) for row in grouped_rows.values()],
            batch_size=1000,
        )


class Migration(migrations.Migration):
    dependencies = [
        ("pooja", "0025_exclude_gen_donation_from_ubhayam_report"),
    ]

    operations = [
        migrations.RunPython(rebuild_ubhayam_report_rows, migrations.RunPython.noop),
    ]
