from datetime import date

from django.db import migrations, models


def _default_effective_from():
    today = date.today()
    return date(today.year, today.month, 1)


class Migration(migrations.Migration):

    dependencies = [
        ("payments", "0004_combinepaymentmapping_main_donor_name_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="combinepaymentmapping",
            name="effective_from",
            field=models.DateField(
                default=_default_effective_from,
                help_text="First month (inclusive) when this combine mapping is active.",
            ),
        ),
        migrations.AddField(
            model_name="combinepaymentmapping",
            name="effective_to",
            field=models.DateField(
                blank=True,
                help_text="First month when this combine mapping is no longer active (exclusive).",
                null=True,
            ),
        ),
    ]
