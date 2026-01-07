from django.db import migrations

DAY_OPTION_DESCRIPTION_UPDATES = {
    "FE": "1st day of English Month",
    "PRM": "On Pournami day of month",
}

DAY_OPTION_DESCRIPTION_REVERTS = {
    "FE": "1st day of the English month",
    "PRM": "Pournami (Full moon)",
}


def apply_description_updates(apps, schema_editor):
    PoojaDayOption = apps.get_model("pooja", "PoojaDayOption")
    for code, description in DAY_OPTION_DESCRIPTION_UPDATES.items():
        PoojaDayOption.objects.filter(code=code).update(description=description)


def revert_description_updates(apps, schema_editor):
    PoojaDayOption = apps.get_model("pooja", "PoojaDayOption")
    for code, description in DAY_OPTION_DESCRIPTION_REVERTS.items():
        PoojaDayOption.objects.filter(code=code).update(description=description)


class Migration(migrations.Migration):
    dependencies = [
        ("pooja", "0011_seed_default_day_options"),
    ]

    operations = [
        migrations.RunPython(apply_description_updates, revert_description_updates),
    ]
