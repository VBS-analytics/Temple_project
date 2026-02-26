import re

from django.db import migrations, models

ANY_DAY_OPTION_LABEL = "Any day of the month"
ANY_DAY_OPTION_CODES = {"AD", "ANYDAY"}
ANY_DAY_OPTION_DESCRIPTIONS = {"any day of month", "any day of the month"}


def _normalize_description(value: str | None) -> str:
    return re.sub(
        r"\s+",
        " ",
        re.sub(r"[^a-z0-9 ]", " ", (value or "").strip().lower()),
    ).strip()


def _is_any_day_option(code: str | None, description: str | None) -> bool:
    normalized_code = (code or "").strip().upper()
    if normalized_code in ANY_DAY_OPTION_CODES:
        return True
    return _normalize_description(description) in ANY_DAY_OPTION_DESCRIPTIONS


def _resolve_day_option_label(day_option) -> str:
    if day_option is None:
        return ANY_DAY_OPTION_LABEL
    code = getattr(day_option, "code", None)
    description = getattr(day_option, "description", None)
    if _is_any_day_option(code, description):
        return ANY_DAY_OPTION_LABEL
    label = (description or code or "").strip()
    return label or ANY_DAY_OPTION_LABEL


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
        PoojaRegistration.objects.select_related("donor", "day_option")
        .order_by("id")
    )
    for registration in registrations:
        donor = getattr(registration, "donor", None)
        if donor is None:
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
    UbhayamReport.objects.bulk_create(
        [UbhayamReport(**row) for row in grouped_rows.values()],
        batch_size=1000,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('pooja', '0021_add_ubhayam_report'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='ubhayamreport',
            name='pooja_registration',
        ),
        migrations.RunPython(rebuild_ubhayam_report_rows, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='ubhayamreport',
            constraint=models.UniqueConstraint(fields=('donor_id', 'pooja_day_option'), name='ubhayam_unique_donor_day_option'),
        ),
    ]
