from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0011_nakshatraoption_rasioption"),
    ]

    operations = [
        migrations.AddField(
            model_name="familymember",
            name="is_active",
            field=models.BooleanField(default=True),
        ),
    ]
