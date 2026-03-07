from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0009_donorprofile_pooja_registration_access"),
    ]

    operations = [
        migrations.AddField(
            model_name="donorprofile",
            name="payment_delete_access",
            field=models.BooleanField(
                default=False,
                help_text="Controls whether donor can delete payment records from payment statement.",
            ),
        ),
    ]
