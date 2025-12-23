from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0005_gothraoption"),
    ]

    operations = [
        migrations.AddField(
            model_name="donorprofile",
            name="monthly_donation_amount",
            field=models.DecimalField(
                default=Decimal("0.00"),
                max_digits=12,
                decimal_places=2,
            ),
        ),
    ]
