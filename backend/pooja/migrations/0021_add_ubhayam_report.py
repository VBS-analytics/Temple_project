import django.db.models.deletion
from django.db import migrations, models

ANY_DAY_OPTION_LABEL = "Any Day of Month"


def _resolve_donor_identifier(donor) -> str:
    if donor is None:
        return ""
    profile = getattr(donor, "profile", None)
    donor_number = getattr(profile, "donor_number", None)
    if donor_number:
        return f"D{donor_number}"
    return str(donor.id)


def _resolve_day_option_label(day_option) -> str:
    if day_option is None:
        return ANY_DAY_OPTION_LABEL
    label = (day_option.description or day_option.code or "").strip()
    return label or ANY_DAY_OPTION_LABEL


def backfill_ubhayam_report(apps, schema_editor):
    PoojaRegistration = apps.get_model("pooja", "PoojaRegistration")
    UbhayamReport = apps.get_model("pooja", "UbhayamReport")

    registrations = (
        PoojaRegistration.objects.select_related("donor", "donor__profile", "day_option")
        .order_by("id")
    )
    entries = []
    for registration in registrations:
        donor = getattr(registration, "donor", None)
        if donor is None:
            continue
        entries.append(
            UbhayamReport(
                pooja_registration_id=registration.id,
                donor_id=_resolve_donor_identifier(donor),
                donor_name=(donor.name or "").strip(),
                donor_phone_number=(donor.phone_number or "").strip(),
                pooja_day_option=_resolve_day_option_label(getattr(registration, "day_option", None)),
            )
        )
    if entries:
        UbhayamReport.objects.bulk_create(entries, ignore_conflicts=True)


def clear_ubhayam_report(apps, schema_editor):
    UbhayamReport = apps.get_model("pooja", "UbhayamReport")
    UbhayamReport.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("pooja", "0020_drop_legacy_recurring_index"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveConstraint(
                    model_name="recurringpoojaplan",
                    name="pooja_recurring_unique",
                ),
                migrations.AddConstraint(
                    model_name="recurringpoojaplan",
                    constraint=models.UniqueConstraint(
                        fields=("donor", "pooja_option", "day_option", "recurrence_kind"),
                        condition=models.Q(
                            recurrence_kind="recurring",
                            one_time_date__isnull=True,
                        ),
                        name="pooja_recurring_unique_null_one_time_date",
                    ),
                ),
                migrations.AddConstraint(
                    model_name="recurringpoojaplan",
                    constraint=models.UniqueConstraint(
                        fields=("donor", "pooja_option", "day_option", "recurrence_kind", "one_time_date"),
                        condition=models.Q(
                            recurrence_kind="recurring",
                            one_time_date__isnull=False,
                        ),
                        name="pooja_recurring_unique_with_one_time_date",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="UbhayamReport",
            fields=[
                ("s_no", models.BigAutoField(primary_key=True, serialize=False)),
                ("donor_id", models.CharField(db_index=True, max_length=32)),
                ("donor_name", models.CharField(max_length=255)),
                ("donor_phone_number", models.CharField(blank=True, max_length=15)),
                ("pooja_day_option", models.CharField(blank=True, max_length=255)),
                (
                    "pooja_registration",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="ubhayam_report_entry",
                        to="pooja.poojaregistration",
                    ),
                ),
            ],
            options={
                "db_table": "ubhayam_report",
                "ordering": ("s_no",),
            },
        ),
        migrations.RunPython(backfill_ubhayam_report, clear_ubhayam_report),
    ]
