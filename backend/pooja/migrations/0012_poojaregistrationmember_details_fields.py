from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pooja", "0011_merge_0006_0010"),
    ]

    operations = [
        migrations.AddField(
            model_name="poojaregistrationmember",
            name="date_of_birth",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="poojaregistrationmember",
            name="family_name",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="poojaregistrationmember",
            name="gothra",
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.AddField(
            model_name="poojaregistrationmember",
            name="tamil_star",
            field=models.CharField(blank=True, max_length=128),
        ),
    ]
