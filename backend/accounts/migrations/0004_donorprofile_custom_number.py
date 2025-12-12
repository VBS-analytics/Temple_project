from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_donorprofile_tamil_name"),
    ]

    operations = [
        migrations.AddField(
            model_name="donorprofile",
            name="custom_number",
            field=models.IntegerField(blank=True, null=True),
        ),
    ]
